/**
 * Understand API — create, list, patch (confidence + supersede), archive.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'

import { getDatabase } from '@/lib/db'
import { runMigrations } from '@/lib/migrations'
import { createSession } from '@/lib/auth'
import { GET, POST, PATCH, DELETE } from '@/app/api/understand/route'
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
       VALUES (?, 'understandtest', 'Understand Test User', 'operator', 'x', unixepoch(), unixepoch())`,
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

function req(method: string, path = '/api/understand', body?: unknown): NextRequest {
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

describe('Understand API', () => {
  let firstId = 0
  let supersederId = 0

  it('rejects missing required fields', async () => {
    const res = await POST(req('POST', '/api/understand', { topic: 'pricing', question: '', conclusion: '' }))
    expect(res.status).toBe(400)
  })

  it('records a decision with conclusion + confidence + tags', async () => {
    const res = await POST(req('POST', '/api/understand', {
      topic: 'understand-test-monetization',
      question: 'Why monthly subscriptions vs usage-based?',
      conclusion: 'Usage-based for v2 because customers pause workforces during slow seasons and monthly creates churn.',
      evidence_md: '- Walt feedback 2026-06-04\n- Customer interview: 7/10 prefer pay-per-use',
      confidence: 85,
      tags: ['monetization', 'q2'],
    }))
    expect(res.status).toBe(201)
    const data = (await res.json()) as { entry: { id: number; status: string; confidence: number; tags: string[] } }
    expect(data.entry.id).toBeGreaterThan(0)
    expect(data.entry.status).toBe('live')
    expect(data.entry.confidence).toBe(85)
    expect(data.entry.tags).toEqual(['monetization', 'q2'])
    firstId = data.entry.id
  })

  it('lists entries with topic tallies', async () => {
    const res = await GET(req('GET'))
    expect(res.status).toBe(200)
    const data = (await res.json()) as { entries: Array<{ id: number; topic: string }>; topics: Array<{ topic: string; count: number }> }
    const ours = data.entries.find((e) => e.id === firstId)
    expect(ours).toBeDefined()
    const topicRow = data.topics.find((t) => t.topic === 'understand-test-monetization')
    expect(topicRow).toBeDefined()
    expect(topicRow!.count).toBeGreaterThanOrEqual(1)
  })

  it('clamps out-of-range confidence values to 0-100', async () => {
    const res = await PATCH(req('PATCH', `/api/understand?id=${firstId}`, { confidence: 9999 }))
    expect(res.status).toBe(200)
    const data = (await res.json()) as { entry: { confidence: number } }
    expect(data.entry.confidence).toBe(100)
    const res2 = await PATCH(req('PATCH', `/api/understand?id=${firstId}`, { confidence: -50 }))
    const data2 = (await res2.json()) as { entry: { confidence: number } }
    expect(data2.entry.confidence).toBe(0)
  })

  it('supersedes an earlier entry — older flips to status=superseded', async () => {
    // First put confidence back to a sane value.
    await PATCH(req('PATCH', `/api/understand?id=${firstId}`, { confidence: 80 }))

    // Now create a follow-up entry.
    const create = await POST(req('POST', '/api/understand', {
      topic: 'understand-test-monetization',
      question: 'Why monthly subscriptions vs usage-based? (v2)',
      conclusion: 'Hybrid: a free platform + usage credits, no monthly subscription, no setup fees.',
      confidence: 90,
    }))
    const createData = (await create.json()) as { entry: { id: number } }
    supersederId = createData.entry.id

    // Mark the FIRST as superseded by the new one.
    const patch = await PATCH(req('PATCH', `/api/understand?id=${firstId}`, { supersedes_id: supersederId }))
    expect(patch.status).toBe(200)
    const patchData = (await patch.json()) as { entry: { status: string; superseded_by: number | null } }
    expect(patchData.entry.status).toBe('superseded')
    expect(patchData.entry.superseded_by).toBe(supersederId)
  })

  it('archives via DELETE; default GET no longer returns archived rows', async () => {
    const res = await DELETE(req('DELETE', `/api/understand?id=${supersederId}`))
    expect(res.status).toBe(200)
    const list = await GET(req('GET'))
    const data = (await list.json()) as { entries: Array<{ id: number }> }
    expect(data.entries.some((e) => e.id === supersederId)).toBe(false)
  })
})
