/**
 * Goals API — create, list, patch, archive round-trip.
 *
 * Uses a real ephemeral session against the seeded workspace_id=1
 * so requireRole returns a valid auth. Each test asserts a single
 * round-trip behaviour: create → list → patch → archive.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'

import { getDatabase, logAuditEvent } from '@/lib/db'
import { runMigrations } from '@/lib/migrations'
import { createSession } from '@/lib/auth'
import { GET, POST, PATCH, DELETE } from '@/app/api/goals/route'
import { NextRequest } from 'next/server'

const TEST_WORKSPACE_ID = 1
let sessionCookie: string

const originalEnv: Record<string, string | undefined> = {}

beforeAll(async () => {
  for (const key of ['MC_DISABLE_RATE_LIMIT', 'MISSION_CONTROL_TEST_MODE']) {
    originalEnv[key] = process.env[key]
  }
  process.env.MC_DISABLE_RATE_LIMIT = '1'
  process.env.MISSION_CONTROL_TEST_MODE = '1'

  const db = getDatabase()
  runMigrations(db)

  // Seed a user + active session for the test workspace. requireRole(operator)
  // will resolve via the session cookie.
  const userRow = db.prepare(
    `SELECT id FROM users WHERE workspace_id = ? AND role IN ('admin','operator') LIMIT 1`,
  ).get(TEST_WORKSPACE_ID) as { id: number } | undefined
  if (!userRow) {
    // Default seeded user not present — install one.
    db.prepare(
      `INSERT INTO users (workspace_id, username, display_name, role, password_hash, created_at, updated_at)
       VALUES (?, 'goalstest', 'Goals Test User', 'operator', 'x', unixepoch(), unixepoch())`,
    ).run(TEST_WORKSPACE_ID)
  }
  const uid = (db.prepare(`SELECT id FROM users WHERE workspace_id = ? AND role IN ('admin','operator') LIMIT 1`).get(TEST_WORKSPACE_ID) as { id: number }).id
  const { token } = createSession(uid, '127.0.0.1', 'vitest', TEST_WORKSPACE_ID)
  // Use the legacy cookie name because the test Request is not HTTPS.
  sessionCookie = `mc-session=${token}`

  // Silence audit logger side-effects from any test that touches it.
  try { logAuditEvent({ action: 'test_bootstrap', actor: 'goals-test' }) } catch { /* noop */ }
})

afterAll(() => {
  for (const [k, v] of Object.entries(originalEnv)) {
    if (v === undefined) delete process.env[k]
    else process.env[k] = v
  }
})

function req(method: string, path = '/api/goals', body?: unknown): NextRequest {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    cookie: sessionCookie,
    'x-forwarded-for': '127.0.0.1',
  }
  return new NextRequest(`http://localhost${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

describe('goals API', () => {
  let createdId = 0

  it('rejects empty title with 400', async () => {
    const res = await POST(req('POST', '/api/goals', { title: '   ' }))
    expect(res.status).toBe(400)
  })

  it('creates a goal and returns the row', async () => {
    const res = await POST(req('POST', '/api/goals', { title: 'Ship v1 of Goals' }))
    expect(res.status).toBe(201)
    const data = (await res.json()) as { goal: { id: number; title: string; status: string } }
    expect(data.goal.id).toBeGreaterThan(0)
    expect(data.goal.title).toBe('Ship v1 of Goals')
    expect(data.goal.status).toBe('open')
    createdId = data.goal.id
  })

  it('lists workspace goals and includes the new one', async () => {
    const res = await GET(req('GET'))
    expect(res.status).toBe(200)
    const data = (await res.json()) as { goals: Array<{ id: number; title: string }> }
    expect(data.goals.some((g) => g.id === createdId)).toBe(true)
  })

  it('patches status to done and stamps completed_at', async () => {
    const res = await PATCH(req('PATCH', `/api/goals?id=${createdId}`, { status: 'done' }))
    expect(res.status).toBe(200)
    const data = (await res.json()) as { goal: { id: number; status: string; completed_at: number | null } }
    expect(data.goal.status).toBe('done')
    expect(data.goal.completed_at).toBeGreaterThan(0)
  })

  it('refuses invalid status updates', async () => {
    const res = await PATCH(req('PATCH', `/api/goals?id=${createdId}`, { status: 'bogus' }))
    expect(res.status).toBe(400)
  })

  it('archives the goal via DELETE', async () => {
    const res = await DELETE(req('DELETE', `/api/goals?id=${createdId}`))
    expect(res.status).toBe(200)
    const data = (await res.json()) as { ok: boolean; archived: number }
    expect(data.ok).toBe(true)
    expect(data.archived).toBe(createdId)

    // Default GET excludes archived rows; the archived id should be gone.
    const list = await GET(req('GET'))
    const listData = (await list.json()) as { goals: Array<{ id: number }> }
    expect(listData.goals.some((g) => g.id === createdId)).toBe(false)
  })
})
