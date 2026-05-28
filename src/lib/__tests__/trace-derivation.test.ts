/**
 * Trace derivation tests — exercise the workspace-isolated, honest-empty
 * behavior of the derivation core that powers the employee trace view,
 * skills-active inventory, and collaboration graph.
 *
 * Schema mirrors the production SQLite store:
 *   agents.last_seen, tasks.assigned_to, workforce_memory.{agent_id, agent_slug, value_impact_cents}
 *   usage_events.agent_id (no skill_name — skills are derived from workforce_memory).
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import Database from 'better-sqlite3'

// Stub getDatabase to return our in-memory DB per test.
const inMemoryDb = new Database(':memory:')
vi.mock('@/lib/db', () => ({
  getDatabase: () => inMemoryDb,
}))

import {
  employeeTrace,
  skillsInventory,
  collaborationGraph,
  customerSkillLabel,
  humanizeSlug,
} from '@/lib/baseline-os/trace-derivation'

beforeEach(() => {
  inMemoryDb.exec(`
    DROP TABLE IF EXISTS agents;
    DROP TABLE IF EXISTS tasks;
    DROP TABLE IF EXISTS usage_events;
    DROP TABLE IF EXISTS workforce_memory;
    CREATE TABLE agents (
      id INTEGER PRIMARY KEY,
      workspace_id INTEGER NOT NULL,
      name TEXT, role TEXT, status TEXT,
      last_activity TEXT, last_seen INTEGER
    );
    CREATE TABLE tasks (
      id INTEGER PRIMARY KEY,
      workspace_id INTEGER NOT NULL,
      assigned_to TEXT, project_id INTEGER,
      title TEXT, status TEXT,
      created_at INTEGER, updated_at INTEGER
    );
    CREATE TABLE usage_events (
      id INTEGER PRIMARY KEY,
      workspace_id INTEGER NOT NULL,
      agent_id INTEGER,
      retail_cost_cents INTEGER,
      created_at INTEGER NOT NULL
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

describe('humanizeSlug + customerSkillLabel', () => {
  it('humanizes raw slugs for safe fallback rendering', () => {
    expect(humanizeSlug('document-chase')).toBe('Document Chase')
    expect(humanizeSlug('w-2-collection')).toBe('W 2 Collection')
  })
  it('overrides slugs with customer-facing labels', () => {
    expect(customerSkillLabel('document-chase')).toBe('Missing Document Outreach')
    expect(customerSkillLabel('sms-outbound')).toBe('SMS Reminders')
    expect(customerSkillLabel('unknown-skill-xyz')).toBe('Unknown Skill Xyz')
  })
})

describe('employeeTrace', () => {
  it('returns null when the agent does not exist in the workspace', () => {
    expect(employeeTrace(1, 'ghost-agent')).toBeNull()
  })

  it('returns an honest empty shape for a brand-new agent', () => {
    inMemoryDb
      .prepare(`INSERT INTO agents (id, workspace_id, name, status) VALUES (1, 1, 'Phil', 'idle')`)
      .run()
    const t = employeeTrace(1, 'Phil')
    expect(t).not.toBeNull()
    expect(t!.todayActions).toEqual([])
    expect(t!.activeTasks).toEqual([])
    expect(t!.memoryUsed).toEqual([])
    expect(t!.skillsUsed).toEqual([])
    expect(t!.collaborators).toEqual([])
    expect(t!.blockedItems).toEqual([])
    expect(t!.needsApproval).toEqual([])
    expect(t!.presence === 'idle' || t!.presence === 'online').toBe(true)
  })

  it('surfaces today actions + active tasks + blocked items', () => {
    const now = Math.floor(Date.now() / 1000)
    inMemoryDb
      .prepare(`INSERT INTO agents (id, workspace_id, name, status) VALUES (1, 1, 'Phil', 'busy')`)
      .run()
    inMemoryDb
      .prepare(
        `INSERT INTO tasks (workspace_id, assigned_to, title, status, created_at, updated_at) VALUES
          (1, 'Phil', 'Filed extension for client #88', 'done', ?, ?),
          (1, 'Phil', 'Reconcile Q1 books for client #211', 'in_progress', ?, ?),
          (1, 'Phil', 'Stuck on partner sign-off', 'blocked', ?, ?)`,
      )
      .run(now - 100, now - 50, now - 200, now - 100, now - 300, now - 200)
    // value attribution lives in workforce_memory in the production schema.
    inMemoryDb
      .prepare(
        `INSERT INTO workforce_memory (workspace_id, agent_slug, kind, title, value_impact_cents, created_at)
         VALUES (1, 'phil', 'task-closed', 'Filed extension for client #88', 54000, ?)`,
      )
      .run(now - 50)
    const t = employeeTrace(1, 'Phil')!
    expect(t.todayActions.length).toBe(1)
    expect(t.activeTasks.find((x) => x.status === 'in_progress')).toBeTruthy()
    expect(t.blockedItems.length).toBe(1)
    expect(t.presence).toBe('blocked')
    expect(t.valueThisMonthCents).toBe(54000)
  })

  it('cites memory entries that mention the agent', () => {
    inMemoryDb
      .prepare(`INSERT INTO agents (id, workspace_id, name, status) VALUES (1, 1, 'Phil', 'idle')`)
      .run()
    inMemoryDb
      .prepare(
        `INSERT INTO workforce_memory (workspace_id, kind, title, detail, rationale, created_at) VALUES
         (1, 'operator-memory.obsidian', 'Q1 Doctrine', 'Never file when 1099 totals do not reconcile.',
          'Source: Obsidian operator vault · 00-doctrine.md · #doctrine', ?)`,
      )
      .run(Math.floor(Date.now() / 1000))
    // The agent name "Phil" doesn't appear in the memory — should still be empty
    const t1 = employeeTrace(1, 'Phil')!
    expect(t1.memoryUsed.length).toBe(0)
    // But if the memory is scoped to this agent's slug (`phil`), it surfaces.
    inMemoryDb
      .prepare(
        `INSERT INTO workforce_memory (workspace_id, agent_slug, kind, title, detail, rationale, created_at) VALUES
         (1, 'phil', 'operator-memory.obsidian', 'Phil SOP', 'Cadence: T+0, T+72h, T+7d.',
          'Source: Obsidian operator vault · 02-sop.md', ?)`,
      )
      .run(Math.floor(Date.now() / 1000))
    const t2 = employeeTrace(1, 'Phil')!
    expect(t2.memoryUsed.length).toBe(1)
    expect(t2.memoryUsed[0].source).toBe('Obsidian')
  })

  it('respects workspace isolation', () => {
    inMemoryDb
      .prepare(`INSERT INTO agents (id, workspace_id, name, status) VALUES (1, 1, 'Phil', 'idle')`)
      .run()
    inMemoryDb
      .prepare(`INSERT INTO agents (id, workspace_id, name, status) VALUES (2, 2, 'Phil', 'idle')`)
      .run()
    inMemoryDb
      .prepare(
        `INSERT INTO tasks (workspace_id, assigned_to, title, status, created_at, updated_at) VALUES (1, 'Phil', 'Workspace 1 task', 'done', ?, ?)`,
      )
      .run(Math.floor(Date.now() / 1000) - 100, Math.floor(Date.now() / 1000) - 50)
    const w1 = employeeTrace(1, 'Phil')!
    const w2 = employeeTrace(2, 'Phil')!
    expect(w1.todayActions.length).toBe(1)
    expect(w2.todayActions.length).toBe(0)
  })
})

describe('skillsInventory', () => {
  it('returns [] when workforce_memory has no skill-* rows', () => {
    expect(skillsInventory(1)).toEqual([])
  })

  it('aggregates uses across employees and labels with customer-facing names', () => {
    const now = Math.floor(Date.now() / 1000)
    const insert = inMemoryDb.prepare(
      `INSERT INTO workforce_memory (workspace_id, agent_slug, kind, title, value_impact_cents, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
    )
    // skillsInventory derives the slug as LOWER(REPLACE(title, ' ', '-')).
    // Using the exact override-known slugs as the row title keeps assertions
    // honest about customer-facing labels.
    for (let i = 0; i < 12; i++) insert.run(1, 'phil', 'skill-used', 'document-chase', 150, now - i * 60)
    for (let i = 0; i < 4; i++) insert.run(1, 'lena', 'skill-used', 'document-chase', 150, now - i * 60)
    for (let i = 0; i < 3; i++) insert.run(1, 'phil', 'skill-used', 'sms-outbound', 100, now - i * 60)

    const skills = skillsInventory(1)
    expect(skills.length).toBeGreaterThan(0)
    const dc = skills.find((s) => s.slug === 'document-chase')!
    expect(dc.label).toBe('Missing Document Outreach')
    expect(dc.employees.sort()).toEqual(['lena', 'phil'])
    expect(dc.uses).toBe(16)
    expect(dc.state).toBe('active')
  })
})

describe('collaborationGraph', () => {
  it('returns empty graph when no shared projects exist', () => {
    expect(collaborationGraph(1)).toEqual({ nodes: [], edges: [], topPair: null })
  })

  it('derives edges from shared project tasks', () => {
    const now = Math.floor(Date.now() / 1000)
    const ins = inMemoryDb.prepare(
      `INSERT INTO tasks (workspace_id, project_id, assigned_to, title, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    // Project 10: Phil + Lena collaborate across 3 tasks
    for (let i = 0; i < 3; i++) {
      ins.run(1, 10, 'Phil', `t-${i}`, 'done', now, now)
      ins.run(1, 10, 'Lena', `t-${i}-l`, 'done', now, now)
    }
    const g = collaborationGraph(1)
    expect(g.edges.length).toBeGreaterThan(0)
    const philLena = g.edges.find((e) => e.from === 'Phil' && e.to === 'Lena')
    expect(philLena).toBeTruthy()
    expect(g.topPair).toBeTruthy()
  })

  it('does NOT fabricate edges where no shared work exists', () => {
    inMemoryDb
      .prepare(
        `INSERT INTO tasks (workspace_id, project_id, assigned_to, title, status, created_at, updated_at) VALUES (1, 1, 'Phil', 't1', 'done', ?, ?)`,
      )
      .run(Math.floor(Date.now() / 1000), Math.floor(Date.now() / 1000))
    inMemoryDb
      .prepare(
        `INSERT INTO tasks (workspace_id, project_id, assigned_to, title, status, created_at, updated_at) VALUES (1, 2, 'Lena', 't2', 'done', ?, ?)`,
      )
      .run(Math.floor(Date.now() / 1000), Math.floor(Date.now() / 1000))
    const g = collaborationGraph(1)
    expect(g.edges).toEqual([])
  })
})
