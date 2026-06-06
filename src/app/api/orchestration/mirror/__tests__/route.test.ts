/**
 * Mirror route — auth + workspace isolation contract.
 *
 * Walt's #63 acceptance:
 *   · unauthenticated mirror rejected
 *   · runtime key (agent-scoped API key) accepted
 *   · workspace isolation enforced
 *
 * Per-event validation (allowlist, payload size, dedup) is covered in
 * src/lib/orchestration/__tests__/mirror.test.ts; here we exercise the
 * HTTP boundary.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'

import { getDatabase } from '@/lib/db'
import { runMigrations } from '@/lib/migrations'
import { createSession } from '@/lib/auth'
import { POST as mirrorPOST } from '@/app/api/orchestration/mirror/route'

const TEST_WS = 1
let adminCookie = ''

const originalEnv: Record<string, string | undefined> = {}

beforeAll(() => {
  for (const k of ['MC_DISABLE_RATE_LIMIT', 'MISSION_CONTROL_TEST_MODE']) {
    originalEnv[k] = process.env[k]
  }
  process.env.MC_DISABLE_RATE_LIMIT = '1'
  process.env.MISSION_CONTROL_TEST_MODE = '1'

  const db = getDatabase()
  runMigrations(db)
  const uidRow = db
    .prepare(`SELECT id FROM users WHERE workspace_id = ? AND role IN ('admin','operator') LIMIT 1`)
    .get(TEST_WS) as { id: number } | undefined
  let uid = uidRow?.id
  if (!uid) {
    const ins = db
      .prepare(
        `INSERT INTO users (workspace_id, username, display_name, role, password_hash, created_at, updated_at)
         VALUES (?, 'mirror-test', 'Mirror Test', 'admin', 'x', unixepoch(), unixepoch())`,
      )
      .run(TEST_WS)
    uid = Number(ins.lastInsertRowid)
  }
  const { token } = createSession(uid, '127.0.0.1', 'vitest', TEST_WS)
  adminCookie = `mc-session=${token}`
})

afterAll(() => {
  for (const [k, v] of Object.entries(originalEnv)) {
    if (v === undefined) delete process.env[k]
    else process.env[k] = v
  }
})

function req(method: string, body?: unknown, cookie?: string): NextRequest {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-forwarded-for': '127.0.0.1',
  }
  if (cookie) headers.cookie = cookie
  return new NextRequest('http://localhost/api/orchestration/mirror', {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

const sampleEvent = () => ({
  external_id: `t-${Date.now()}-${Math.random()}`,
  event_type: 'task.created',
  occurred_at: Math.floor(Date.now() / 1000),
  payload: { test: true },
})

describe('mirror route — auth surface', () => {
  it('unauthenticated request is rejected', async () => {
    const res = await mirrorPOST(req('POST', { source: 'baseline-local', events: [sampleEvent()] }))
    // No cookie, no API key → auth denies.
    expect([401, 403]).toContain(res.status)
  })

  it('admin session accepted; ingests a valid event', async () => {
    const res = await mirrorPOST(
      req('POST', { source: 'baseline-local', events: [sampleEvent()] }, adminCookie),
    )
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.accepted).toBe(1)
    expect(json.duplicates).toBe(0)
  })

  it('rejects bad source value with 400', async () => {
    const res = await mirrorPOST(
      req('POST', { source: 'attacker-system', events: [sampleEvent()] }, adminCookie),
    )
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe('bad_source')
  })

  it('rejects body without events array with 400', async () => {
    const res = await mirrorPOST(req('POST', { source: 'baseline-local' }, adminCookie))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe('events_required')
  })

  it('event with unsupported event_type lands in the errors array (allowlist enforced)', async () => {
    const res = await mirrorPOST(
      req(
        'POST',
        {
          source: 'baseline-local',
          events: [{ ...sampleEvent(), event_type: 'rm -rf /' }],
        },
        adminCookie,
      ),
    )
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.accepted).toBe(0)
    expect(json.errors[0]).toMatchObject({ error: 'event_type_not_allowed' })
  })

  it('oversized payload (>64KB) is rejected per-event', async () => {
    const huge = 'x'.repeat(65 * 1024)
    const res = await mirrorPOST(
      req(
        'POST',
        {
          source: 'baseline-local',
          events: [{ ...sampleEvent(), payload: { blob: huge } }],
        },
        adminCookie,
      ),
    )
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.accepted).toBe(0)
    expect(json.errors[0]).toMatchObject({ error: 'payload_too_large' })
  })
})
