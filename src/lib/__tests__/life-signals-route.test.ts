/**
 * Smoke test for the life-signals API to lock the schema-correct query
 * paths (no `last_heartbeat`, no `tasks.assignee`, uses derived skills +
 * collaborators + escalation from real tables only).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import Database from 'better-sqlite3'

const memDb = new Database(':memory:')
vi.mock('@/lib/db', () => ({ getDatabase: () => memDb }))
vi.mock('@/lib/auth', () => ({
  requireRole: () => ({ user: { workspace_id: 1 } }),
}))

import { GET } from '@/app/api/agents/life-signals/route'

function makeReq(): Request {
  return new Request('http://x/api/agents/life-signals')
}

beforeEach(() => {
  memDb.exec(`
    DROP TABLE IF EXISTS agents;
    DROP TABLE IF EXISTS tasks;
    DROP TABLE IF EXISTS workforce_memory;
    CREATE TABLE agents (
      id INTEGER PRIMARY KEY,
      workspace_id INTEGER NOT NULL,
      name TEXT, role TEXT, status TEXT,
      last_activity TEXT, last_seen INTEGER, hidden INTEGER DEFAULT 0
    );
    CREATE TABLE tasks (
      id INTEGER PRIMARY KEY,
      workspace_id INTEGER NOT NULL,
      assigned_to TEXT, project_id INTEGER,
      title TEXT, status TEXT,
      created_at INTEGER, updated_at INTEGER
    );
    CREATE TABLE workforce_memory (
      id INTEGER PRIMARY KEY,
      workspace_id INTEGER NOT NULL,
      agent_id INTEGER, agent_slug TEXT,
      kind TEXT NOT NULL,
      title TEXT NOT NULL, detail TEXT, rationale TEXT,
      value_impact_cents INTEGER DEFAULT 0,
      created_at INTEGER NOT NULL
    );
  `)
})

describe('GET /api/agents/life-signals', () => {
  it('returns empty signals for an empty workspace without crashing', async () => {
    const res = await GET(makeReq() as never)
    const json = await res.json()
    expect(Array.isArray(json.signals)).toBe(true)
    expect(json.signals).toEqual([])
  })

  it('derives presence + confidence + collaborators + skills + escalation honestly', async () => {
    const now = Math.floor(Date.now() / 1000)
    memDb
      .prepare(
        `INSERT INTO agents (id, workspace_id, name, status, last_activity, last_seen)
         VALUES (1, 1, 'Phil', 'busy', 'Closing client #88', ?),
                (2, 1, 'Lena', 'idle', NULL, ?)`,
      )
      .run(now, now - 200)
    // Phil has 1 done, 1 needs-review (escalation), 1 in-progress; shares project with Lena
    memDb
      .prepare(
        `INSERT INTO tasks (workspace_id, project_id, assigned_to, title, status, created_at, updated_at)
         VALUES
          (1, 10, 'Phil', 'Filed extension', 'done', ?, ?),
          (1, 10, 'Phil', 'Reconcile Q1 books', 'in_progress', ?, ?),
          (1, 10, 'Phil', 'Partner sign-off pending', 'needs-review', ?, ?),
          (1, 10, 'Lena', 'Vendor outreach', 'in_progress', ?, ?)`,
      )
      .run(now - 200, now - 100, now - 300, now - 50, now - 400, now - 60, now - 200, now - 60)
    memDb
      .prepare(
        `INSERT INTO workforce_memory (workspace_id, agent_slug, kind, title, rationale, created_at)
         VALUES (1, 'phil', 'skill-used', 'Reconciliation Watch', 'Caught $3,200 discrepancy', ?),
                (1, 'phil', 'operator-memory.obsidian', 'Q1 Doctrine', 'Source: Obsidian operator vault', ?)`,
      )
      .run(now - 60, now - 30)

    const res = await GET(makeReq() as never)
    const { signals } = await res.json()
    const phil = signals.find((s: { agentName: string }) => s.agentName === 'Phil')
    expect(phil).toBeTruthy()
    expect(phil.presence).toBe('waiting-for-approval') // escalation overrides 'working'
    expect(phil.escalation).toBeTruthy()
    expect(phil.escalation.title).toBe('Partner sign-off pending')
    expect(phil.skillsActive).toContain('Reconciliation Watch')
    expect(phil.collaborators).toContain('Lena')
    expect(phil.memoryUsed?.source).toBe('Obsidian')
    expect(phil.recentWin).toBe('Filed extension')
    expect(phil.currentlyWorkingOn).toBe('Closing client #88')
  })
})
