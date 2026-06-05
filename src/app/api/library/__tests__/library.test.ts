/**
 * Library API — read-only inventory aggregator.
 *
 * Seeds workforce_skills + workforce_subscriptions rows for a test
 * workspace, then verifies that GET /api/library partitions them into
 * skills / workflows / employees with correct totals + filtering.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'

import { getDatabase } from '@/lib/db'
import { runMigrations } from '@/lib/migrations'
import { createSession } from '@/lib/auth'
import { GET } from '@/app/api/library/route'
import { NextRequest } from 'next/server'

const TEST_WORKSPACE_ID = 1
let sessionCookie: string
const originalEnv: Record<string, string | undefined> = {}

function req(): NextRequest {
  return new NextRequest('http://localhost/api/library', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      cookie: sessionCookie,
      'x-forwarded-for': '127.0.0.1',
    },
  })
}

beforeAll(() => {
  for (const key of ['MC_DISABLE_RATE_LIMIT', 'MISSION_CONTROL_TEST_MODE']) {
    originalEnv[key] = process.env[key]
  }
  process.env.MC_DISABLE_RATE_LIMIT = '1'
  process.env.MISSION_CONTROL_TEST_MODE = '1'

  const db = getDatabase()
  runMigrations(db)

  // Auth seed
  const userRow = db.prepare(
    `SELECT id FROM users WHERE workspace_id = ? AND role IN ('admin','operator') LIMIT 1`,
  ).get(TEST_WORKSPACE_ID) as { id: number } | undefined
  if (!userRow) {
    db.prepare(
      `INSERT INTO users (workspace_id, username, display_name, role, password_hash, created_at, updated_at)
       VALUES (?, 'librarytest', 'Library Test User', 'operator', 'x', unixepoch(), unixepoch())`,
    ).run(TEST_WORKSPACE_ID)
  }
  const uid = (db.prepare(`SELECT id FROM users WHERE workspace_id = ? AND role IN ('admin','operator') LIMIT 1`).get(TEST_WORKSPACE_ID) as { id: number }).id
  const { token } = createSession(uid, '127.0.0.1', 'vitest', TEST_WORKSPACE_ID)
  sessionCookie = `mc-session=${token}`

  // Workforce inventory seed — three skills, one workflow, two employees.
  // The DB is persistent across test-suite runs, so wipe any leftovers
  // from a previous run before seeding fresh rows. The slug prefix is
  // unique to this test file (`lib-test-`), so this is safe.
  db.exec(`
    CREATE TABLE IF NOT EXISTS workforce_skills (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workspace_id INTEGER NOT NULL,
      slug TEXT NOT NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      price_cents INTEGER NOT NULL,
      attached_agent_id INTEGER,
      installed_at INTEGER NOT NULL,
      idempotency_key TEXT,
      UNIQUE(workspace_id, slug, idempotency_key)
    );
    CREATE TABLE IF NOT EXISTS workforce_subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workspace_id INTEGER NOT NULL,
      employee_slug TEXT NOT NULL,
      monthly_cents INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      started_at INTEGER NOT NULL,
      idempotency_key TEXT,
      UNIQUE(workspace_id, employee_slug, idempotency_key)
    );
  `)
  db.prepare(`DELETE FROM workforce_skills WHERE workspace_id = ? AND slug LIKE 'lib-test-%'`).run(TEST_WORKSPACE_ID)
  db.prepare(`DELETE FROM workforce_subscriptions WHERE workspace_id = ? AND employee_slug LIKE 'lib-test-%'`).run(TEST_WORKSPACE_ID)
  db.exec(`
    CREATE TABLE IF NOT EXISTS workforce_skills (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workspace_id INTEGER NOT NULL,
      slug TEXT NOT NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      price_cents INTEGER NOT NULL,
      attached_agent_id INTEGER,
      installed_at INTEGER NOT NULL,
      idempotency_key TEXT,
      UNIQUE(workspace_id, slug, idempotency_key)
    );
    CREATE TABLE IF NOT EXISTS workforce_subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      workspace_id INTEGER NOT NULL,
      employee_slug TEXT NOT NULL,
      monthly_cents INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      started_at INTEGER NOT NULL,
      idempotency_key TEXT,
      UNIQUE(workspace_id, employee_slug, idempotency_key)
    );
  `)
  const stamp = Math.floor(Date.now() / 1000)
  const insertSkill = db.prepare(
    `INSERT OR IGNORE INTO workforce_skills (workspace_id, slug, name, category, price_cents, installed_at, idempotency_key)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
  insertSkill.run(TEST_WORKSPACE_ID, 'lib-test-skill-a', 'Test Skill A', 'Property Management', 5000, stamp, `libtest-skl-a-${stamp}`)
  insertSkill.run(TEST_WORKSPACE_ID, 'lib-test-skill-b', 'Test Skill B', 'AI Intelligence', 7500, stamp, `libtest-skl-b-${stamp}`)
  insertSkill.run(TEST_WORKSPACE_ID, 'lib-test-workflow-a', 'Test Workflow A', 'Workflow', 15000, stamp, `libtest-wf-a-${stamp}`)
  const insertSub = db.prepare(
    `INSERT OR IGNORE INTO workforce_subscriptions (workspace_id, employee_slug, monthly_cents, status, started_at, idempotency_key)
     VALUES (?, ?, ?, 'active', ?, ?)`,
  )
  insertSub.run(TEST_WORKSPACE_ID, 'lib-test-emp-a', 0, stamp, `libtest-emp-a-${stamp}`)
  insertSub.run(TEST_WORKSPACE_ID, 'lib-test-emp-b', 0, stamp, `libtest-emp-b-${stamp}`)
})

afterAll(() => {
  for (const [k, v] of Object.entries(originalEnv)) {
    if (v === undefined) delete process.env[k]
    else process.env[k] = v
  }
})

describe('library API', () => {
  it('returns the inventory grouped into skills, workflows, employees', async () => {
    const res = await GET(req())
    expect(res.status).toBe(200)
    const data = (await res.json()) as {
      skills: Array<{ slug: string }>
      workflows: Array<{ slug: string }>
      employees: Array<{ employee_slug: string }>
      totals: { skills: number; workflows: number; employees: number }
    }
    // Library aggregates across the whole workspace, so we filter on the
    // unique test slugs to assert against just what this test seeded.
    const testSkills = data.skills.filter((s) => s.slug.startsWith('lib-test-skill-'))
    const testWorkflows = data.workflows.filter((w) => w.slug.startsWith('lib-test-workflow-'))
    const testEmployees = data.employees.filter((e) => e.employee_slug.startsWith('lib-test-emp-'))
    expect(testSkills.map((s) => s.slug).sort()).toEqual(['lib-test-skill-a', 'lib-test-skill-b'])
    expect(testWorkflows.map((w) => w.slug)).toEqual(['lib-test-workflow-a'])
    expect(testEmployees.map((e) => e.employee_slug).sort()).toEqual(['lib-test-emp-a', 'lib-test-emp-b'])
    // Totals match the actual array lengths even if other tests added rows.
    expect(data.totals.skills).toBe(data.skills.length)
    expect(data.totals.workflows).toBe(data.workflows.length)
    expect(data.totals.employees).toBe(data.employees.length)
  })

  it('classifies workflows by category regardless of casing', async () => {
    const db = getDatabase()
    const stamp = Math.floor(Date.now() / 1000) + 1
    db.prepare(
      `INSERT OR IGNORE INTO workforce_skills (workspace_id, slug, name, category, price_cents, installed_at, idempotency_key)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(TEST_WORKSPACE_ID, 'lib-test-workflow-mixed', 'Mixed-case Workflow', 'pm-workflow', 10000, stamp, `libtest-wf-mixed-${stamp}`)
    const res = await GET(req())
    const data = (await res.json()) as { workflows: Array<{ slug: string }>; skills: Array<{ slug: string }> }
    expect(data.workflows.some((w) => w.slug === 'lib-test-workflow-mixed')).toBe(true)
    expect(data.skills.some((s) => s.slug === 'lib-test-workflow-mixed')).toBe(false)
  })

  it('survives a fresh workspace with no installs (lazy-creates the tables)', async () => {
    const db = getDatabase()
    // Make a fresh workspace + user + session so the auth path resolves
    // but no inventory exists.
    const wsRes = db.prepare(
      `INSERT INTO workspaces (slug, name, tenant_id, created_at, updated_at)
       VALUES (?, ?, 1, unixepoch(), unixepoch())`,
    ).run(`library-fresh-${Date.now()}`, 'Library fresh test ws')
    const freshWsId = Number(wsRes.lastInsertRowid)
    const userRes = db.prepare(
      `INSERT INTO users (workspace_id, username, display_name, role, password_hash, created_at, updated_at)
       VALUES (?, ?, 'Fresh User', 'operator', 'x', unixepoch(), unixepoch())`,
    ).run(freshWsId, `librarytest-fresh-${Date.now()}`)
    const { token } = createSession(Number(userRes.lastInsertRowid), '127.0.0.1', 'vitest', freshWsId)
    const r = new NextRequest('http://localhost/api/library', {
      method: 'GET',
      headers: { cookie: `mc-session=${token}`, 'x-forwarded-for': '127.0.0.1' },
    })
    const res = await GET(r)
    expect(res.status).toBe(200)
    const data = (await res.json()) as { skills: unknown[]; workflows: unknown[]; employees: unknown[]; totals: { skills: number; workflows: number; employees: number } }
    expect(data.totals.skills).toBe(0)
    expect(data.totals.workflows).toBe(0)
    expect(data.totals.employees).toBe(0)
  })
})
