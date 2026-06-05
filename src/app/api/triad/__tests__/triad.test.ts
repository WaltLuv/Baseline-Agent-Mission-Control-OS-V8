/**
 * Triad Council API — create decision → record votes → resolve → archive.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'

import { getDatabase } from '@/lib/db'
import { runMigrations } from '@/lib/migrations'
import { createSession } from '@/lib/auth'
import { GET, POST, DELETE } from '@/app/api/triad/route'
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
       VALUES (?, 'triadtest', 'Triad Test User', 'operator', 'x', unixepoch(), unixepoch())`,
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

function req(method: string, path = '/api/triad', body?: unknown): NextRequest {
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

describe('triad council API', () => {
  let createdId = 0

  it('rejects empty prompt', async () => {
    const res = await POST(req('POST', '/api/triad', { prompt: '   ' }))
    expect(res.status).toBe(400)
  })

  it('creates a decision with status=voting', async () => {
    const res = await POST(req('POST', '/api/triad', { prompt: 'Ship v2 of the billing model?', summary: 'Q3 readiness check' }))
    expect(res.status).toBe(201)
    const data = (await res.json()) as { decision: { id: number; status: string; prompt: string; tallies: Record<string, number>; votes: unknown[] } }
    expect(data.decision.id).toBeGreaterThan(0)
    expect(data.decision.status).toBe('voting')
    expect(data.decision.prompt).toBe('Ship v2 of the billing model?')
    expect(data.decision.votes).toEqual([])
    expect(data.decision.tallies).toEqual({ approve: 0, reject: 0, abstain: 0, veto: 0 })
    createdId = data.decision.id
  })

  it('records votes from three models with tallies', async () => {
    const triadModels = [
      { model_id: 'opus-4-7', model_label: 'Opus 4.7', vote: 'approve' as const, confidence: 92 },
      { model_id: 'sonnet-4-6', model_label: 'Sonnet 4.6', vote: 'approve' as const, confidence: 88 },
      { model_id: 'haiku-4-5', model_label: 'Haiku 4.5', vote: 'reject' as const, confidence: 70 },
    ]
    for (const v of triadModels) {
      const res = await POST(req('POST', `/api/triad?id=${createdId}&action=vote`, v))
      expect(res.status).toBe(201)
    }
    const list = await GET(req('GET'))
    const data = (await list.json()) as { decisions: Array<{ id: number; tallies: Record<string, number>; votes: Array<{ model_id: string }> }> }
    const decision = data.decisions.find((d) => d.id === createdId)
    expect(decision).toBeDefined()
    expect(decision?.tallies.approve).toBe(2)
    expect(decision?.tallies.reject).toBe(1)
    expect(decision?.votes.map((v) => v.model_id).sort()).toEqual(['haiku-4-5', 'opus-4-7', 'sonnet-4-6'])
  })

  it('is idempotent on duplicate vote by same model', async () => {
    const res = await POST(req('POST', `/api/triad?id=${createdId}&action=vote`, {
      model_id: 'opus-4-7',
      vote: 'reject', // attempt to flip — should NOT overwrite
    }))
    expect(res.status).toBe(200)
    const data = (await res.json()) as { idempotent: boolean; vote: { vote: string }; decision: { tallies: Record<string, number> } }
    expect(data.idempotent).toBe(true)
    expect(data.vote.vote).toBe('approve') // original vote preserved
    // Tally unchanged: still 2 approve / 1 reject.
    expect(data.decision.tallies.approve).toBe(2)
    expect(data.decision.tallies.reject).toBe(1)
  })

  it('refuses unknown vote kinds', async () => {
    const res = await POST(req('POST', `/api/triad?id=${createdId}&action=vote`, {
      model_id: 'gpt-fake',
      vote: 'kinda',
    }))
    expect(res.status).toBe(400)
  })

  it('resolves with an outcome and archives via DELETE', async () => {
    const resResolve = await POST(req('POST', `/api/triad?id=${createdId}&action=resolve`, {
      outcome: 'Ship v2 — Opus + Sonnet aligned, Haiku flagged a perf concern queued for follow-up.',
    }))
    expect(resResolve.status).toBe(200)
    const dataResolve = (await resResolve.json()) as { decision: { status: string; resolved_outcome: string | null; resolved_at: number | null } }
    expect(dataResolve.decision.status).toBe('resolved')
    expect(dataResolve.decision.resolved_outcome).toContain('Ship v2')
    expect(dataResolve.decision.resolved_at).toBeGreaterThan(0)

    const resArchive = await DELETE(req('DELETE', `/api/triad?id=${createdId}`))
    expect(resArchive.status).toBe(200)
    // Default GET excludes archived rows.
    const list = await GET(req('GET'))
    const listData = (await list.json()) as { decisions: Array<{ id: number }> }
    expect(listData.decisions.some((d) => d.id === createdId)).toBe(false)
  })
})
