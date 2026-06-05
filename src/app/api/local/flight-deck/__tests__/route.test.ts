/**
 * /api/local/flight-deck — honest defaults regression test.
 *
 * Bug history: the route hard-coded
 *   const DEFAULT_DOWNLOAD_URL = 'https://flightdeck.example.com/download'
 * which leaked into both API responses and (via the office-panel state seed)
 * the in-app modal. Walt's rule: "No placeholder download links."
 *
 * This test pins the contract:
 *   · Default downloadUrl is the in-app /flight-deck page (NOT a placeholder
 *     external URL).
 *   · An operator can override via FLIGHT_DECK_DOWNLOAD_URL.
 *   · GET returns the install-status envelope.
 *   · POST with no installed app returns 404 + downloadUrl (not 500).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { NextRequest } from 'next/server'

import { getDatabase } from '@/lib/db'
import { runMigrations } from '@/lib/migrations'
import { createSession } from '@/lib/auth'
import { GET, POST } from '@/app/api/local/flight-deck/route'

const TEST_WORKSPACE_ID = 1
let sessionCookie: string
const originalEnv: Record<string, string | undefined> = {}

beforeAll(() => {
  for (const key of ['MC_DISABLE_RATE_LIMIT', 'MISSION_CONTROL_TEST_MODE', 'FLIGHT_DECK_DOWNLOAD_URL', 'FLIGHT_DECK_PATH']) {
    originalEnv[key] = process.env[key]
  }
  process.env.MC_DISABLE_RATE_LIMIT = '1'
  process.env.MISSION_CONTROL_TEST_MODE = '1'
  // Force the install probe to miss so we get the "not installed" envelope.
  process.env.FLIGHT_DECK_PATH = '/tmp/__nonexistent-flight-deck.app'
  delete process.env.FLIGHT_DECK_DOWNLOAD_URL

  const db = getDatabase()
  runMigrations(db)

  const uidRow = db.prepare(
    `SELECT id FROM users WHERE workspace_id = ? AND role IN ('admin','operator','viewer') LIMIT 1`,
  ).get(TEST_WORKSPACE_ID) as { id: number } | undefined
  let uid = uidRow?.id
  if (!uid) {
    const ins = db.prepare(
      `INSERT INTO users (workspace_id, username, display_name, role, password_hash, created_at, updated_at)
       VALUES (?, 'fdtest', 'Flight Deck Test', 'operator', 'x', unixepoch(), unixepoch())`,
    ).run(TEST_WORKSPACE_ID)
    uid = Number(ins.lastInsertRowid)
  }
  const { token } = createSession(uid, '127.0.0.1', 'vitest', TEST_WORKSPACE_ID)
  sessionCookie = `mc-session=${token}`
})

afterAll(() => {
  for (const [k, v] of Object.entries(originalEnv)) {
    if (v === undefined) delete process.env[k]
    else process.env[k] = v
  }
})

function req(method: string, body?: unknown): NextRequest {
  return new NextRequest('http://localhost/api/local/flight-deck', {
    method,
    headers: {
      'Content-Type': 'application/json',
      cookie: sessionCookie,
      'x-forwarded-for': '127.0.0.1',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

describe('/api/local/flight-deck — honest defaults', () => {
  it('GET defaults downloadUrl to the in-app /flight-deck page (NOT a placeholder external URL)', async () => {
    const res = await GET(req('GET'))
    expect(res.status).toBe(200)
    const json = (await res.json()) as {
      installed: boolean
      installPath: string | null
      appUrl: string
      downloadUrl: string
    }
    expect(json.downloadUrl).toBe('/flight-deck')
    expect(json.downloadUrl).not.toMatch(/flightdeck\.example\.com/i)
    expect(json.installed).toBe(false) // FLIGHT_DECK_PATH points at a missing dir
  })

  it('FLIGHT_DECK_DOWNLOAD_URL env override is honored', async () => {
    process.env.FLIGHT_DECK_DOWNLOAD_URL = 'https://artifacts.internal.example/flight-deck'
    try {
      const res = await GET(req('GET'))
      const json = await res.json()
      expect(json.downloadUrl).toBe('https://artifacts.internal.example/flight-deck')
    } finally {
      delete process.env.FLIGHT_DECK_DOWNLOAD_URL
    }
  })

  it('POST when Flight Deck is not installed returns 404 with the honest downloadUrl', async () => {
    const res = await POST(req('POST', { agent: 'aegis', session: 'sess-1' }))
    expect(res.status).toBe(404)
    const json = (await res.json()) as { installed: boolean; error: string; downloadUrl: string }
    expect(json.installed).toBe(false)
    expect(json.error).toMatch(/Flight Deck is not installed/i)
    expect(json.downloadUrl).toBe('/flight-deck')
    expect(json.downloadUrl).not.toMatch(/flightdeck\.example\.com/i)
  })
})
