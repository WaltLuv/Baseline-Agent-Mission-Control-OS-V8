/**
 * Launchers API — shape + honest env-driven configuration state.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'

import { getDatabase } from '@/lib/db'
import { runMigrations } from '@/lib/migrations'
import { createSession } from '@/lib/auth'
import { GET } from '@/app/api/launchers/route'
import { NextRequest } from 'next/server'

const TEST_WORKSPACE_ID = 1
let sessionCookie: string
const originalEnv: Record<string, string | undefined> = {}
const LAUNCHER_ENV_VARS = [
  'HIGGSFIELD_URL', 'HIGGSFIELD_API_KEY',
  'HYPEREDIT_URL', 'HYPEREDIT_API_KEY',
  'ANTIGRAVITY_DEEPLINK',
]

function req(): NextRequest {
  return new NextRequest('http://localhost/api/launchers', {
    method: 'GET',
    headers: { cookie: sessionCookie, 'x-forwarded-for': '127.0.0.1' },
  })
}

beforeAll(() => {
  for (const key of ['MC_DISABLE_RATE_LIMIT', 'MISSION_CONTROL_TEST_MODE', ...LAUNCHER_ENV_VARS]) {
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
       VALUES (?, 'launchertest', 'Launcher Test User', 'operator', 'x', unixepoch(), unixepoch())`,
    ).run(TEST_WORKSPACE_ID)
  }
  const uid = (db.prepare(`SELECT id FROM users WHERE workspace_id = ? AND role IN ('admin','operator') LIMIT 1`).get(TEST_WORKSPACE_ID) as { id: number }).id
  const { token } = createSession(uid, '127.0.0.1', 'vitest', TEST_WORKSPACE_ID)
  sessionCookie = `mc-session=${token}`
})

beforeEach(() => {
  for (const v of LAUNCHER_ENV_VARS) delete process.env[v]
})

afterAll(() => {
  for (const [k, v] of Object.entries(originalEnv)) {
    if (v === undefined) delete process.env[k]
    else process.env[k] = v
  }
})

describe('launchers API', () => {
  it('returns all catalogue entries with configured=false when env is empty', async () => {
    const res = await GET(req())
    expect(res.status).toBe(200)
    const data = (await res.json()) as {
      launchers: Array<{ id: string; configured: boolean; auth_present: boolean; url: string | null }>
      totals: { catalogue: number; configured: number }
    }
    expect(data.totals.catalogue).toBe(data.launchers.length)
    expect(data.totals.configured).toBe(0)
    for (const l of data.launchers) {
      expect(l.configured).toBe(false)
      expect(l.url).toBeNull()
      expect(l.auth_present).toBe(false)
    }
  })

  it('flips configured=true when the URL env var is set', async () => {
    process.env.HIGGSFIELD_URL = 'https://example.test/higgsfield'
    const res = await GET(req())
    const data = (await res.json()) as { launchers: Array<{ id: string; configured: boolean; url: string | null; auth_present: boolean }>; totals: { configured: number } }
    const higgs = data.launchers.find((l) => l.id === 'higgsfield')
    expect(higgs?.configured).toBe(true)
    expect(higgs?.url).toBe('https://example.test/higgsfield')
    expect(higgs?.auth_present).toBe(false) // no auth env set yet
    expect(data.totals.configured).toBe(1)
  })

  it('reports auth_present when the auth env var is also set', async () => {
    process.env.HYPEREDIT_URL = 'https://example.test/hyperedit'
    process.env.HYPEREDIT_API_KEY = 'shh-secret'
    const res = await GET(req())
    const data = (await res.json()) as { launchers: Array<{ id: string; configured: boolean; auth_present: boolean }> }
    const he = data.launchers.find((l) => l.id === 'hyperedit')
    expect(he?.configured).toBe(true)
    expect(he?.auth_present).toBe(true)
  })

  it('does not echo back the raw auth key', async () => {
    process.env.HYPEREDIT_URL = 'https://example.test/hyperedit'
    process.env.HYPEREDIT_API_KEY = 'should-never-appear'
    const res = await GET(req())
    const raw = await res.text()
    expect(raw.includes('should-never-appear')).toBe(false)
  })
})
