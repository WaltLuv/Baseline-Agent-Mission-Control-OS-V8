/**
 * Tests for skillRoiLeaderboard() + approvalQueue() derivations.
 *
 * Both derivations must be honest: empty arrays when there's no
 * activity, real aggregation when there is. Workspace-scoped.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import Database from 'better-sqlite3'

const memDb = new Database(':memory:')
vi.mock('@/lib/db', () => ({ getDatabase: () => memDb }))

import { skillRoiLeaderboard, approvalQueue } from '@/lib/baseline-os/trace-derivation'

beforeEach(() => {
  memDb.exec(`
    DROP TABLE IF EXISTS workforce_skills;
    DROP TABLE IF EXISTS workforce_memory;
    DROP TABLE IF EXISTS tasks;
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
      escalation_count INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE workforce_memory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workspace_id INTEGER NOT NULL,
      agent_id INTEGER, agent_slug TEXT,
      kind TEXT NOT NULL, title TEXT NOT NULL,
      detail TEXT, rationale TEXT,
      value_impact_cents INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workspace_id INTEGER NOT NULL,
      assigned_to TEXT, project_id INTEGER,
      title TEXT, status TEXT,
      created_at INTEGER, updated_at INTEGER
    );
  `)
})

describe('skillRoiLeaderboard', () => {
  it('returns [] when nothing is installed', () => {
    expect(skillRoiLeaderboard(1)).toEqual([])
  })

  it('returns top skills sorted by value, then uses, with employees and label', () => {
    const now = Math.floor(Date.now() / 1000)
    const ins = memDb.prepare(
      `INSERT INTO workforce_skills (workspace_id, slug, name, category, price_cents, installed_at, idempotency_key,
                                     use_count, last_used_at, value_impact_cents, success_count)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    ins.run(1, 'document-chase', 'document-chase', 'CPA', 4900, now - 86400, 'a', 10, now, 250_00, 10)
    ins.run(1, 'sms-outbound', 'sms-outbound', 'CPA', 4900, now - 86400, 'b', 7, now, 120_00, 7)
    ins.run(1, 'reconciliation', 'reconciliation', 'CPA', 4900, now - 86400, 'c', 3, now, 50_00, 3)
    ins.run(1, 'idle-skill', 'idle-skill', 'CPA', 4900, now - 86400, 'd', 0, null, 0, 0)
    // employees pulled from workforce_memory
    const memIns = memDb.prepare(
      `INSERT INTO workforce_memory (workspace_id, agent_slug, kind, title, value_impact_cents, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    memIns.run(1, 'phil', 'skill-used', 'document-chase', 0, now - 60)
    memIns.run(1, 'lena', 'skill-used', 'document-chase', 0, now - 30)
    memIns.run(1, 'phil', 'skill-used', 'sms-outbound', 0, now - 60)

    const leaders = skillRoiLeaderboard(1, 3)
    expect(leaders).toHaveLength(3)
    expect(leaders[0].slug).toBe('document-chase')
    expect(leaders[0].valueUsdThisMonth).toBe(250)
    expect(leaders[0].label).toBe('Missing Document Outreach') // customer-facing override
    expect(leaders[0].employees.sort()).toEqual(['lena', 'phil'])
    expect(leaders[0].primaryEmployeeSlug).toBeTruthy()
    expect(leaders.map((l) => l.slug)).not.toContain('idle-skill')
  })
})

describe('approvalQueue', () => {
  it('returns [] when no tasks are pending review', () => {
    expect(approvalQueue(1)).toEqual([])
  })

  it('lists open approvals sorted by age with severity bands and rationale lookup', () => {
    const now = Math.floor(Date.now() / 1000)
    memDb
      .prepare(
        `INSERT INTO tasks (workspace_id, assigned_to, title, status, created_at, updated_at) VALUES
          (1, 'Phil', 'Client #88 reconciliation', 'needs-review', ?, ?),
          (1, 'Phil', 'Schedule partner review', 'review', ?, ?),
          (1, 'Lena', 'Pending vendor invoice', 'waiting-approval', ?, ?)`,
      )
      .run(now - 60 * 60 * 49, now - 60 * 60 * 49, now - 60 * 30, now - 60 * 30, now - 60 * 60 * 13, now - 60 * 60 * 13)
    // matching memory rationale for Phil
    memDb
      .prepare(
        `INSERT INTO workforce_memory (workspace_id, agent_slug, kind, title, rationale, created_at)
         VALUES (1, 'phil', 'operator-memory.obsidian', 'Q1 Doctrine', 'Never file when 1099 totals do not reconcile.', ?)`,
      )
      .run(now - 60)

    const items = approvalQueue(1)
    expect(items).toHaveLength(3)
    // sorted by age ASC — oldest first
    expect(items[0].title).toContain('Client #88')
    expect(items[0].severity).toBe('high') // 49h
    expect(items[0].reason).toMatch(/Never file/)
    expect(items[0].reasonSource).toBe('Obsidian')
    // Lena has no matched rationale
    const lenaItem = items.find((i) => i.assignedTo === 'Lena')!
    expect(lenaItem.reason).toBeNull()
    expect(lenaItem.severity).toBe('medium') // 13h
  })
})
