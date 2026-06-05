/**
 * SEO targets API — create → patch (rank/status) → archive round-trip.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'

import { getDatabase } from '@/lib/db'
import { runMigrations } from '@/lib/migrations'
import { createSession } from '@/lib/auth'
import { GET, POST, PATCH, DELETE } from '@/app/api/seo/route'
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
       VALUES (?, 'seotest', 'SEO Test User', 'operator', 'x', unixepoch(), unixepoch())`,
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

function req(method: string, path = '/api/seo', body?: unknown): NextRequest {
  return new NextRequest(`http://localhost${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      cookie: sessionCookie,
      'x-forwarded-for': '127.0.0.1',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

describe('SEO targets API', () => {
  let createdId = 0

  it('rejects empty keyword', async () => {
    const res = await POST(req('POST', '/api/seo', { target_keyword: '   ' }))
    expect(res.status).toBe(400)
  })

  it('creates a target with default status=planned', async () => {
    const res = await POST(req('POST', '/api/seo', {
      target_keyword: 'baseline OS mission control',
      target_url: 'https://example.com/baseline-os',
      target_rank: 3,
    }))
    expect(res.status).toBe(201)
    const data = (await res.json()) as { target: { id: number; status: string; target_keyword: string; target_rank: number | null; current_rank: number | null } }
    expect(data.target.id).toBeGreaterThan(0)
    expect(data.target.status).toBe('planned')
    expect(data.target.target_rank).toBe(3)
    expect(data.target.current_rank).toBeNull()
    createdId = data.target.id
  })

  it('lists workspace targets including the new one', async () => {
    const res = await GET(req('GET'))
    expect(res.status).toBe(200)
    const data = (await res.json()) as { targets: Array<{ id: number; target_keyword: string }> }
    expect(data.targets.some((t) => t.id === createdId)).toBe(true)
  })

  it('patches status + current_rank, stamping last_checked_at', async () => {
    const before = (await (await GET(req('GET'))).json()) as { targets: Array<{ id: number; last_checked_at: number | null }> }
    expect(before.targets.find((t) => t.id === createdId)?.last_checked_at).toBeNull()

    const res = await PATCH(req('PATCH', `/api/seo?id=${createdId}`, {
      status: 'ranking',
      current_rank: 2,
    }))
    expect(res.status).toBe(200)
    const data = (await res.json()) as { target: { status: string; current_rank: number | null; last_checked_at: number | null } }
    expect(data.target.status).toBe('ranking')
    expect(data.target.current_rank).toBe(2)
    expect(data.target.last_checked_at).toBeGreaterThan(0)
  })

  it('refuses unknown status', async () => {
    const res = await PATCH(req('PATCH', `/api/seo?id=${createdId}`, { status: 'invalid' }))
    expect(res.status).toBe(400)
  })

  it('clamps oversized ranks to the 1-1000 range', async () => {
    const res = await PATCH(req('PATCH', `/api/seo?id=${createdId}`, { current_rank: 99999 }))
    expect(res.status).toBe(200)
    const data = (await res.json()) as { target: { current_rank: number | null } }
    expect(data.target.current_rank).toBe(1000)
  })

  it('archives via DELETE; default GET no longer returns it', async () => {
    const res = await DELETE(req('DELETE', `/api/seo?id=${createdId}`))
    expect(res.status).toBe(200)
    const list = await GET(req('GET'))
    const data = (await list.json()) as { targets: Array<{ id: number }> }
    expect(data.targets.some((t) => t.id === createdId)).toBe(false)
  })
})
