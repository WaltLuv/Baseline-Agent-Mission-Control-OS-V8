/**
 * CLI inventory API — shape + key namespaces present.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'

import { getDatabase } from '@/lib/db'
import { runMigrations } from '@/lib/migrations'
import { createSession } from '@/lib/auth'
import { GET } from '@/app/api/cli/route'
import { NextRequest } from 'next/server'

const TEST_WORKSPACE_ID = 1
let sessionCookie: string
const originalEnv: Record<string, string | undefined> = {}

beforeAll(() => {
  for (const key of ['MC_DISABLE_RATE_LIMIT', 'MISSION_CONTROL_TEST_MODE']) {
    originalEnv[key] = process.env[key]
  }
  process.env.MC_DISABLE_RATE_LIMIT = '1'
  process.env.MISSION_CONTROL_TEST_MODE = '1'

  const db = getDatabase()
  runMigrations(db)

  const userRow = db.prepare(
    `SELECT id FROM users WHERE workspace_id = ? AND role IN ('admin','operator') LIMIT 1`,
  ).get(TEST_WORKSPACE_ID) as { id: number } | undefined
  if (!userRow) {
    db.prepare(
      `INSERT INTO users (workspace_id, username, display_name, role, password_hash, created_at, updated_at)
       VALUES (?, 'clitest', 'CLI Test User', 'operator', 'x', unixepoch(), unixepoch())`,
    ).run(TEST_WORKSPACE_ID)
  }
  const uid = (db.prepare(`SELECT id FROM users WHERE workspace_id = ? AND role IN ('admin','operator') LIMIT 1`).get(TEST_WORKSPACE_ID) as { id: number }).id
  const { token } = createSession(uid, '127.0.0.1', 'vitest', TEST_WORKSPACE_ID)
  sessionCookie = `mc-session=${token}`
})

afterAll(() => {
  for (const [k, v] of Object.entries(originalEnv)) {
    if (v === undefined) delete process.env[k]
    else process.env[k] = v
  }
})

function req(): NextRequest {
  return new NextRequest('http://localhost/api/cli', {
    method: 'GET',
    headers: { cookie: sessionCookie, 'x-forwarded-for': '127.0.0.1' },
  })
}

describe('CLI inventory API', () => {
  it('returns the documented shape', async () => {
    const res = await GET(req())
    expect(res.status).toBe(200)
    const data = (await res.json()) as {
      namespaces: Array<{ group: string; status: string }>
      legacy: Array<{ group: string }>
      shortcuts: Array<{ shortcut: string }>
      common_flags: Array<{ flag: string }>
      note: string
    }
    expect(Array.isArray(data.namespaces)).toBe(true)
    expect(Array.isArray(data.legacy)).toBe(true)
    expect(Array.isArray(data.shortcuts)).toBe(true)
    expect(Array.isArray(data.common_flags)).toBe(true)
    expect(typeof data.note).toBe('string')
  })

  it('includes the key operator groups', async () => {
    const res = await GET(req())
    const data = (await res.json()) as { namespaces: Array<{ group: string }> }
    const groups = new Set(data.namespaces.map((n) => n.group))
    // Core operator groups every operator should see.
    for (const required of ['auth', 'agent', 'task', 'runtime', 'gateway', 'workspace', 'billing', 'deploy', 'flightdeck']) {
      expect(groups.has(required)).toBe(true)
    }
  })

  it('marks every primary namespace with a known status', async () => {
    const res = await GET(req())
    const data = (await res.json()) as { namespaces: Array<{ status: string }> }
    const allowed = new Set(['working', 'stubbed', 'planned'])
    for (const n of data.namespaces) {
      expect(allowed.has(n.status)).toBe(true)
    }
  })
})
