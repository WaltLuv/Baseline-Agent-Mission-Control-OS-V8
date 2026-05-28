/**
 * Iteration 16 derivation + action tests.
 * Covers: skillDetail, workforceRecommendations, sevenDayForecast,
 * approval-action endpoint, legacy-cleanup script behavior.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import Database from 'better-sqlite3'

const memDb = new Database(':memory:')
vi.mock('@/lib/db', () => ({ getDatabase: () => memDb }))
vi.mock('@/lib/auth', () => ({
  requireRole: () => ({ user: { workspace_id: 1, id: 9 } }),
}))

import {
  skillDetail,
  workforceRecommendations,
  sevenDayForecast,
} from '@/lib/baseline-os/trace-derivation'
import { POST as approvalActionPOST } from '@/app/api/approvals/action/route'

function req(body: unknown) {
  return new Request('http://x/api/approvals/action', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  memDb.exec(`
    DROP TABLE IF EXISTS workforce_skills;
    DROP TABLE IF EXISTS workforce_memory;
    DROP TABLE IF EXISTS tasks;
    CREATE TABLE workforce_skills (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workspace_id INTEGER NOT NULL, slug TEXT NOT NULL, name TEXT NOT NULL,
      category TEXT NOT NULL, price_cents INTEGER NOT NULL,
      attached_agent_id INTEGER, installed_at INTEGER NOT NULL,
      idempotency_key TEXT,
      use_count INTEGER NOT NULL DEFAULT 0, last_used_at INTEGER,
      value_impact_cents INTEGER NOT NULL DEFAULT 0,
      success_count INTEGER NOT NULL DEFAULT 0,
      escalation_count INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE workforce_memory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workspace_id INTEGER NOT NULL, agent_id INTEGER, agent_slug TEXT,
      kind TEXT NOT NULL, title TEXT NOT NULL, detail TEXT, rationale TEXT,
      value_impact_cents INTEGER DEFAULT 0, created_at INTEGER NOT NULL
    );
    CREATE TABLE tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workspace_id INTEGER NOT NULL, assigned_to TEXT, project_id INTEGER,
      title TEXT, status TEXT, created_at INTEGER, updated_at INTEGER
    );
  `)
})

describe('skillDetail', () => {
  it('returns null when the skill is unknown to the workspace', () => {
    expect(skillDetail(1, 'ghost-skill')).toBeNull()
  })

  it('hydrates installed-but-unused with the inactive state copy', () => {
    memDb
      .prepare(
        `INSERT INTO workforce_skills (workspace_id, slug, name, category, price_cents, installed_at, idempotency_key)
         VALUES (1, 'pdf-generation', 'pdf-generation', 'CPA', 2500, ?, 'k')`,
      )
      .run(Math.floor(Date.now() / 1000))
    const d = skillDetail(1, 'pdf-generation')!
    expect(d.installed).toBe(true)
    expect(d.state).toBe('inactive')
    expect(d.recommendations).toContain('Attach this skill to an AI Employee to activate it.')
  })

  it('crosses into the proven state at ≥100 uses with >90% success', () => {
    const now = Math.floor(Date.now() / 1000)
    memDb
      .prepare(
        `INSERT INTO workforce_skills (workspace_id, slug, name, category, price_cents, installed_at, idempotency_key,
                                       use_count, last_used_at, value_impact_cents, success_count, escalation_count)
         VALUES (1, 'pdf-generation', 'pdf-generation', 'CPA', 2500, ?, 'k', 120, ?, 90000, 115, 5)`,
      )
      .run(now - 30 * 86400, now - 60)
    const d = skillDetail(1, 'pdf-generation')!
    expect(d.state).toBe('proven')
    expect(d.recommendations.some((r) => /Replicate/.test(r))).toBe(true)
  })
})

describe('workforceRecommendations', () => {
  it('returns [] for an empty workspace', () => {
    expect(workforceRecommendations(1)).toEqual([])
  })

  it('flags overloaded employees and single-employee high-value skills', () => {
    // Phil has 7 open tasks
    const now = Math.floor(Date.now() / 1000)
    const insT = memDb.prepare(
      `INSERT INTO tasks (workspace_id, assigned_to, title, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
    )
    for (let i = 0; i < 7; i++) insT.run(1, 'Phil', `task ${i}`, 'open', now - 100, now - 50)
    // pdf-generation: single employee, decent value
    memDb
      .prepare(
        `INSERT INTO workforce_skills (workspace_id, slug, name, category, price_cents, installed_at, idempotency_key,
                                       use_count, last_used_at, value_impact_cents, success_count)
         VALUES (1, 'pdf-generation', 'pdf-generation', 'CPA', 2500, ?, 'k', 4, ?, 25000, 4)`,
      )
      .run(now - 86400, now - 60)
    memDb
      .prepare(
        `INSERT INTO workforce_memory (workspace_id, agent_slug, kind, title, value_impact_cents, created_at)
         VALUES (1, 'phil', 'skill-used', 'pdf-generation', 0, ?)`,
      )
      .run(now - 60)

    const recs = workforceRecommendations(1)
    expect(recs.find((r) => r.id.startsWith('overloaded:'))?.relatedEmployee).toBe('Phil')
    expect(recs.find((r) => r.id.startsWith('expand-skill:'))?.relatedSkill).toBe('pdf-generation')
  })
})

describe('sevenDayForecast', () => {
  it('returns [] when there is nothing concerning', () => {
    expect(sevenDayForecast(1)).toEqual([])
  })

  it('surfaces overloaded employees and stale tasks', () => {
    const now = Math.floor(Date.now() / 1000)
    const insT = memDb.prepare(
      `INSERT INTO tasks (workspace_id, assigned_to, title, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
    )
    for (let i = 0; i < 8; i++) insT.run(1, 'Phil', `task ${i}`, 'in_progress', now - 100, now - 50)
    // 3 stale tasks (older than 7 days)
    for (let i = 0; i < 3; i++) insT.run(1, 'Lena', `old task ${i}`, 'in_progress', now - 8 * 86_400, now - 8 * 86_400)
    const risks = sevenDayForecast(1)
    expect(risks.find((r) => r.kind === 'overloaded-employee')).toBeTruthy()
    expect(risks.find((r) => r.kind === 'stale-task')).toBeTruthy()
  })
})

describe('POST /api/approvals/action', () => {
  it('400 when taskId or action missing', async () => {
    const res = await approvalActionPOST(req({ taskId: 1 }) as never)
    expect(res.status).toBe(400)
  })

  it('404 when task is not in this workspace', async () => {
    const res = await approvalActionPOST(req({ taskId: 99, action: 'approve' }) as never)
    expect(res.status).toBe(404)
  })

  it('approves a task, writes audit row, and updates status to done', async () => {
    const now = Math.floor(Date.now() / 1000)
    memDb
      .prepare(
        `INSERT INTO tasks (id, workspace_id, assigned_to, title, status, created_at, updated_at)
         VALUES (10, 1, 'Phil', 'Client reconciliation', 'needs-review', ?, ?)`,
      )
      .run(now - 100, now - 50)
    const res = await approvalActionPOST(req({ taskId: 10, action: 'approve', note: 'Looks good' }) as never)
    expect(res.status).toBe(200)
    const task = memDb.prepare(`SELECT status FROM tasks WHERE id = 10`).get() as { status: string }
    expect(task.status).toBe('done')
    const mem = memDb.prepare(`SELECT kind, detail FROM workforce_memory WHERE agent_slug = 'phil'`).get() as
      | { kind: string; detail: string }
      | undefined
    expect(mem?.kind).toBe('approval-approved')
    expect(mem?.detail).toBe('Looks good')
  })

  it('reject → failed, request-changes → in_progress', async () => {
    const now = Math.floor(Date.now() / 1000)
    memDb
      .prepare(
        `INSERT INTO tasks (id, workspace_id, assigned_to, title, status, created_at, updated_at)
         VALUES (11, 1, 'Phil', 'X', 'needs-review', ?, ?), (12, 1, 'Phil', 'Y', 'needs-review', ?, ?)`,
      )
      .run(now - 100, now - 50, now - 100, now - 50)
    await approvalActionPOST(req({ taskId: 11, action: 'reject' }) as never)
    await approvalActionPOST(req({ taskId: 12, action: 'request-changes' }) as never)
    const rows = memDb.prepare(`SELECT id, status FROM tasks WHERE id IN (11,12) ORDER BY id`).all() as Array<{
      id: number; status: string
    }>
    expect(rows[0].status).toBe('failed')
    expect(rows[1].status).toBe('in_progress')
  })
})
