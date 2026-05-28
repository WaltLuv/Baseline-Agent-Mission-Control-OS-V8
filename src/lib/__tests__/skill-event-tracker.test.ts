/**
 * Skill-event tracker tests.
 *
 * Verifies:
 *   - POST /api/skills/event writes a workforce_memory row AND increments
 *     workforce_skills counters.
 *   - Validation: missing skillSlug → 400. Unknown skill → 404.
 *   - Failure events (success=false) increment escalation_count and write
 *     a `skill-escalated` kind row.
 *   - skillsInventory() merges workforce_skills + workforce_memory rows
 *     into a single ROI-aware ActiveSkill list (installed-but-unused
 *     surfaces as `inactive` with the install-recommendation copy).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import Database from 'better-sqlite3'

const memDb = new Database(':memory:')
vi.mock('@/lib/db', () => ({ getDatabase: () => memDb }))
vi.mock('@/lib/auth', () => ({
  requireRole: () => ({ user: { workspace_id: 1, id: 1 } }),
}))
vi.mock('@/lib/rate-limit', () => ({
  tokenReportLimiter: () => undefined,
}))

import { POST as skillEventPOST } from '@/app/api/skills/event/route'
import { skillsInventory } from '@/lib/baseline-os/trace-derivation'

function makeReq(body: unknown): Request {
  return new Request('http://x/api/skills/event', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  memDb.exec(`
    DROP TABLE IF EXISTS workforce_skills;
    DROP TABLE IF EXISTS workforce_memory;
    CREATE TABLE workforce_skills (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workspace_id INTEGER NOT NULL,
      slug TEXT NOT NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      price_cents INTEGER NOT NULL,
      attached_agent_id INTEGER,
      installed_at INTEGER NOT NULL,
      idempotency_key TEXT,
      use_count INTEGER NOT NULL DEFAULT 0,
      last_used_at INTEGER,
      value_impact_cents INTEGER NOT NULL DEFAULT 0,
      success_count INTEGER NOT NULL DEFAULT 0,
      escalation_count INTEGER NOT NULL DEFAULT 0,
      UNIQUE(workspace_id, slug, idempotency_key)
    );
    CREATE TABLE workforce_memory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workspace_id INTEGER NOT NULL,
      agent_id INTEGER, agent_slug TEXT,
      kind TEXT NOT NULL,
      title TEXT NOT NULL, detail TEXT, rationale TEXT,
      value_impact_cents INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL
    );
  `)
  memDb
    .prepare(
      `INSERT INTO workforce_skills (workspace_id, slug, name, category, price_cents, installed_at, idempotency_key)
       VALUES (1, 'document-chase', 'Missing Document Outreach', 'CPA', 4900, ?, 'init-1')`,
    )
    .run(Math.floor(Date.now() / 1000))
})

describe('POST /api/skills/event', () => {
  it('rejects when skillSlug is missing', async () => {
    const res = await skillEventPOST(makeReq({}) as never)
    expect(res.status).toBe(400)
  })

  it('rejects when the skill is not installed in this workspace', async () => {
    const res = await skillEventPOST(makeReq({ skillSlug: 'phantom-skill' }) as never)
    expect(res.status).toBe(404)
  })

  it('writes a workforce_memory row and increments counters for a success event', async () => {
    const res = await skillEventPOST(
      makeReq({
        skillSlug: 'document-chase',
        agentSlug: 'phil',
        valueImpactCents: 5400,
        durationMinutes: 18,
        success: true,
        note: 'Closed 4 follow-ups without human intervention',
      }) as never,
    )
    expect(res.status).toBe(200)
    const row = memDb
      .prepare(`SELECT use_count, value_impact_cents, success_count, escalation_count FROM workforce_skills WHERE slug='document-chase'`)
      .get() as { use_count: number; value_impact_cents: number; success_count: number; escalation_count: number }
    expect(row.use_count).toBe(1)
    expect(row.value_impact_cents).toBe(5400)
    expect(row.success_count).toBe(1)
    expect(row.escalation_count).toBe(0)
    const mem = memDb.prepare(`SELECT kind, agent_slug, detail FROM workforce_memory WHERE title='document-chase'`).get() as { kind: string; agent_slug: string; detail: string }
    expect(mem.kind).toBe('skill-used')
    expect(mem.agent_slug).toBe('phil')
    expect(mem.detail).toContain('Closed 4 follow-ups')
  })

  it('records escalation events as skill-escalated and bumps escalation_count', async () => {
    await skillEventPOST(
      makeReq({ skillSlug: 'document-chase', agentSlug: 'phil', success: false }) as never,
    )
    const row = memDb
      .prepare(`SELECT use_count, success_count, escalation_count FROM workforce_skills WHERE slug='document-chase'`)
      .get() as { use_count: number; success_count: number; escalation_count: number }
    expect(row.use_count).toBe(1)
    expect(row.success_count).toBe(0)
    expect(row.escalation_count).toBe(1)
    const mem = memDb.prepare(`SELECT kind FROM workforce_memory WHERE title='document-chase'`).get() as { kind: string }
    expect(mem.kind).toBe('skill-escalated')
  })
})

describe('skillsInventory() merges installed + event sources', () => {
  it('surfaces an installed-but-unused skill as inactive with install copy', () => {
    const skills = skillsInventory(1)
    expect(skills.length).toBe(1)
    expect(skills[0].slug).toBe('document-chase')
    expect(skills[0].uses).toBe(0)
    expect(skills[0].state).toBe('inactive')
    expect(skills[0].recommendation).toMatch(/Installed but never used/)
  })

  it('flips to active and rolls up ROI once events arrive', async () => {
    await skillEventPOST(
      makeReq({ skillSlug: 'document-chase', agentSlug: 'phil', valueImpactCents: 7500, success: true }) as never,
    )
    await skillEventPOST(
      makeReq({ skillSlug: 'document-chase', agentSlug: 'lena', valueImpactCents: 3000, success: true }) as never,
    )
    const skills = skillsInventory(1)
    const dc = skills.find((s) => s.slug === 'document-chase')!
    expect(dc.uses).toBe(2)
    expect(dc.state).toBe('active')
    expect(dc.valueUsdThisMonth).toBe(105) // 10500 cents / 100
    expect(dc.employees.sort()).toEqual(['lena', 'phil'])
  })

  it('flags warning state when escalation rate is high', async () => {
    await skillEventPOST(makeReq({ skillSlug: 'document-chase', success: false }) as never)
    await skillEventPOST(makeReq({ skillSlug: 'document-chase', success: false }) as never)
    await skillEventPOST(makeReq({ skillSlug: 'document-chase', success: true }) as never)
    const skills = skillsInventory(1)
    const dc = skills.find((s) => s.slug === 'document-chase')!
    expect(dc.state).toBe('warning')
    expect(dc.recommendation).toMatch(/escalated/)
  })
})
