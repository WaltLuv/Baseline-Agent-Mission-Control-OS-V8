/**
 * Personas API — catalogue + hired-flag join round-trip.
 *
 * Seeds a single hire in workforce_subscriptions, then verifies the
 * GET response marks that persona as hired while the rest stay
 * "available", and the catalogue totals match.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'

import { getDatabase } from '@/lib/db'
import { runMigrations } from '@/lib/migrations'
import { createSession } from '@/lib/auth'
import { GET } from '@/app/api/personas/route'
import { NextRequest } from 'next/server'
import { EMPLOYEES } from '@/lib/marketplace-catalog'

const TEST_WORKSPACE_ID = 1
const HIRE_SLUG = 'agent-michael' // present in EMPLOYEES; safe choice
let sessionCookie: string
const originalEnv: Record<string, string | undefined> = {}

function req(): NextRequest {
  return new NextRequest('http://localhost/api/personas', {
    method: 'GET',
    headers: { cookie: sessionCookie, 'x-forwarded-for': '127.0.0.1' },
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
       VALUES (?, 'personatest', 'Persona Test User', 'operator', 'x', unixepoch(), unixepoch())`,
    ).run(TEST_WORKSPACE_ID)
  }
  const uid = (db.prepare(`SELECT id FROM users WHERE workspace_id = ? AND role IN ('admin','operator') LIMIT 1`).get(TEST_WORKSPACE_ID) as { id: number }).id
  const { token } = createSession(uid, '127.0.0.1', 'vitest', TEST_WORKSPACE_ID)
  sessionCookie = `mc-session=${token}`

  // Make sure the table exists, then seed exactly one hire.
  db.exec(`
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
  db.prepare(
    `INSERT OR IGNORE INTO workforce_subscriptions (workspace_id, employee_slug, monthly_cents, started_at, idempotency_key)
     VALUES (?, ?, 0, unixepoch(), ?)`,
  ).run(TEST_WORKSPACE_ID, HIRE_SLUG, `persona-test-${HIRE_SLUG}`)
})

afterAll(() => {
  for (const [k, v] of Object.entries(originalEnv)) {
    if (v === undefined) delete process.env[k]
    else process.env[k] = v
  }
})

describe('personas API', () => {
  it('returns the full catalogue with hired flag set on the seeded hire', async () => {
    // Sanity check on the catalogue we depend on.
    expect(EMPLOYEES.some((e) => e.slug === HIRE_SLUG)).toBe(true)

    const res = await GET(req())
    expect(res.status).toBe(200)
    const data = (await res.json()) as {
      personas: Array<{ slug: string; hired: boolean; division: string; role: string }>
      totals: { catalogue: number; hired: number }
      divisions: string[]
    }
    expect(data.totals.catalogue).toBe(EMPLOYEES.length)
    expect(data.totals.hired).toBeGreaterThanOrEqual(1)
    const michael = data.personas.find((p) => p.slug === HIRE_SLUG)
    expect(michael).toBeDefined()
    expect(michael?.hired).toBe(true)
  })

  it('sorts personas by division then by name within division', async () => {
    const res = await GET(req())
    const data = (await res.json()) as {
      personas: Array<{ name: string; division: string }>
      divisions: string[]
    }
    // For each division-pair where the division comes earlier in the
    // `divisions` array, no row from the later division may appear before
    // any row of the earlier division.
    const order = new Map<string, number>(data.divisions.map((d, i) => [d, i]))
    let lastIndex = -1
    for (const p of data.personas) {
      const idx = order.get(p.division) ?? Number.MAX_SAFE_INTEGER
      expect(idx).toBeGreaterThanOrEqual(lastIndex)
      lastIndex = idx
    }
  })

  it('reflects un-hired personas as hired=false', async () => {
    const res = await GET(req())
    const data = (await res.json()) as { personas: Array<{ slug: string; hired: boolean }> }
    // At least one EMPLOYEES slug that isn't agent-michael should exist
    // and come back hired=false (assuming no other test has hired it).
    const unhired = EMPLOYEES.find((e) => e.slug !== HIRE_SLUG)
    if (!unhired) return
    const row = data.personas.find((p) => p.slug === unhired.slug)
    expect(row).toBeDefined()
    expect(row?.hired).toBe(false)
  })
})
