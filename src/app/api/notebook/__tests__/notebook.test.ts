/**
 * Notebook API — create, list, patch, archive round-trip + tag handling.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'

import { getDatabase } from '@/lib/db'
import { runMigrations } from '@/lib/migrations'
import { createSession } from '@/lib/auth'
import { GET, POST, PATCH, DELETE } from '@/app/api/notebook/route'
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
       VALUES (?, 'notebooktest', 'Notebook Test User', 'operator', 'x', unixepoch(), unixepoch())`,
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

function req(method: string, path = '/api/notebook', body?: unknown): NextRequest {
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

describe('notebook API', () => {
  let createdId = 0

  it('rejects empty title with 400', async () => {
    const res = await POST(req('POST', '/api/notebook', { title: '   ' }))
    expect(res.status).toBe(400)
  })

  it('creates a notebook entry with tags + returns the wire row', async () => {
    const res = await POST(req('POST', '/api/notebook', {
      title: 'Q2 onboarding playbook',
      body_md: '# Steps\n- review the pipeline\n- ship the first workforce',
      tags: ['onboarding', 'q2', 'playbook'],
    }))
    expect(res.status).toBe(201)
    const data = (await res.json()) as { entry: { id: number; title: string; tags: string[]; source: string; archived: boolean } }
    expect(data.entry.id).toBeGreaterThan(0)
    expect(data.entry.title).toBe('Q2 onboarding playbook')
    expect(data.entry.tags).toEqual(['onboarding', 'q2', 'playbook'])
    expect(data.entry.source).toBe('operator')
    expect(data.entry.archived).toBe(false)
    createdId = data.entry.id
  })

  it('lists workspace entries including the new one', async () => {
    const res = await GET(req('GET'))
    expect(res.status).toBe(200)
    const data = (await res.json()) as { entries: Array<{ id: number; tags: string[] }> }
    const mine = data.entries.find((e) => e.id === createdId)
    expect(mine).toBeDefined()
    expect(mine?.tags).toContain('playbook')
  })

  it('patches title + tags without affecting body', async () => {
    const res = await PATCH(req('PATCH', `/api/notebook?id=${createdId}`, {
      title: 'Q2 onboarding playbook — v2',
      tags: ['onboarding', 'v2'],
    }))
    expect(res.status).toBe(200)
    const data = (await res.json()) as { entry: { title: string; tags: string[]; body_md: string } }
    expect(data.entry.title).toBe('Q2 onboarding playbook — v2')
    expect(data.entry.tags).toEqual(['onboarding', 'v2'])
    expect(data.entry.body_md).toContain('review the pipeline')
  })

  it('rejects body over the 200 KB limit', async () => {
    const huge = 'x'.repeat(200_001)
    const res = await PATCH(req('PATCH', `/api/notebook?id=${createdId}`, { body_md: huge }))
    expect(res.status).toBe(400)
  })

  it('archives via DELETE; default GET no longer returns it', async () => {
    const res = await DELETE(req('DELETE', `/api/notebook?id=${createdId}`))
    expect(res.status).toBe(200)
    const list = await GET(req('GET'))
    const listData = (await list.json()) as { entries: Array<{ id: number }> }
    expect(listData.entries.some((e) => e.id === createdId)).toBe(false)

    const listArchived = await GET(req('GET', '/api/notebook?include_archived=1'))
    const archivedData = (await listArchived.json()) as { entries: Array<{ id: number; archived: boolean }> }
    expect(archivedData.entries.find((e) => e.id === createdId)?.archived).toBe(true)
  })
})
