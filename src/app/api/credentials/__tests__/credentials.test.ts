/**
 * Credentials Manager — security invariants.
 *
 * Walt's rules (do-NOT list):
 *   · Secrets must not be logged.
 *   · Secrets must not be returned raw from APIs.
 *   · Plaintext storage in the cloud DB is refused without
 *     CREDENTIALS_ENCRYPTION_KEY.
 *
 * What this test pins:
 *   · GET /api/credentials/catalog returns the static catalog and never
 *     leaks a raw secret field.
 *   · PUT /api/credentials/openai with encryption disabled refuses with
 *     412 ENCRYPTION_NOT_CONFIGURED.
 *   · PUT with encryption enabled stores the secret, but the row visible
 *     to GET only carries a masked preview — never the raw value.
 *   · DELETE removes the row and a follow-up GET shows no saved row.
 *   · A second workspace cannot see workspace 1's credentials
 *     (isolation guard).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { NextRequest } from 'next/server'

import { getDatabase } from '@/lib/db'
import { runMigrations } from '@/lib/migrations'
import { createSession } from '@/lib/auth'
import { GET as catalogGET } from '@/app/api/credentials/catalog/route'
import {
  PUT as providerPUT,
  GET as providerGET,
  DELETE as providerDELETE,
} from '@/app/api/credentials/[provider_id]/route'

const TEST_WORKSPACE_ID = 1
let adminCookie = ''
let otherWorkspaceCookie = ''
let otherWorkspaceId = 0

const RAW_OPENAI_KEY = 'sk-test-INTERNAL-DO-NOT-LEAK-' + Math.random().toString(36).slice(2, 14)
const originalEnv: Record<string, string | undefined> = {}

beforeAll(() => {
  for (const k of ['MC_DISABLE_RATE_LIMIT', 'MISSION_CONTROL_TEST_MODE', 'CREDENTIALS_ENCRYPTION_KEY']) {
    originalEnv[k] = process.env[k]
  }
  process.env.MC_DISABLE_RATE_LIMIT = '1'
  process.env.MISSION_CONTROL_TEST_MODE = '1'
  // Default to encryption DISABLED so the refusal test below is meaningful.
  delete process.env.CREDENTIALS_ENCRYPTION_KEY

  const db = getDatabase()
  runMigrations(db)

  function adminFor(workspaceId: number): string {
    let uid = (db
      .prepare(`SELECT id FROM users WHERE workspace_id = ? AND role = 'admin' LIMIT 1`)
      .get(workspaceId) as { id: number } | undefined)?.id
    if (!uid) {
      const ins = db
        .prepare(
          `INSERT INTO users (workspace_id, username, display_name, role, password_hash, created_at, updated_at)
           VALUES (?, ?, ?, 'admin', 'x', unixepoch(), unixepoch())`,
        )
        .run(workspaceId, `cred-admin-${workspaceId}`, `Cred Admin ${workspaceId}`)
      uid = Number(ins.lastInsertRowid)
    }
    const { token } = createSession(uid, '127.0.0.1', 'vitest', workspaceId)
    return `mc-session=${token}`
  }
  adminCookie = adminFor(TEST_WORKSPACE_ID)

  // Second workspace for isolation guard.
  const wsRes = db
    .prepare(
      `INSERT INTO workspaces (slug, name, tenant_id, created_at, updated_at)
       VALUES (?, ?, 1, unixepoch(), unixepoch())`,
    )
    .run(`cred-ws-${Date.now()}`, 'Cred Test WS 2')
  otherWorkspaceId = Number(wsRes.lastInsertRowid)
  otherWorkspaceCookie = adminFor(otherWorkspaceId)
})

afterAll(() => {
  for (const [k, v] of Object.entries(originalEnv)) {
    if (v === undefined) delete process.env[k]
    else process.env[k] = v
  }
})

function req(method: string, path: string, cookie: string, body?: unknown): NextRequest {
  return new NextRequest(`http://localhost${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', cookie, 'x-forwarded-for': '127.0.0.1' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

async function readJson(res: Response): Promise<Record<string, unknown>> {
  return (await res.json()) as Record<string, unknown>
}

function jsonNoSecret(json: unknown): void {
  const s = JSON.stringify(json)
  expect(s).not.toContain(RAW_OPENAI_KEY)
}

describe('credentials manager — security invariants', () => {
  it('catalog endpoint surfaces the static catalog without raw secrets', async () => {
    const res = await catalogGET(req('GET', '/api/credentials/catalog', adminCookie))
    expect(res.status).toBe(200)
    const json = await readJson(res)
    expect(json.providers).toBeDefined()
    const providers = json.providers as Array<{ id: string; saved: unknown }>
    expect(providers.length).toBeGreaterThan(20) // catalog ships >20 providers
    expect(providers.some((p) => p.id === 'openai')).toBe(true)
    expect(providers.some((p) => p.id === 'anthropic')).toBe(true)
    expect(providers.some((p) => p.id === 'stripe')).toBe(true)
    jsonNoSecret(json)
  })

  it('PUT refuses with 412 ENCRYPTION_NOT_CONFIGURED when CREDENTIALS_ENCRYPTION_KEY is unset', async () => {
    delete process.env.CREDENTIALS_ENCRYPTION_KEY
    const res = await providerPUT(
      req('PUT', '/api/credentials/openai', adminCookie, { secrets: { api_key: RAW_OPENAI_KEY } }),
      { params: Promise.resolve({ provider_id: 'openai' }) },
    )
    expect(res.status).toBe(412)
    const json = await readJson(res)
    expect(json.code).toBe('ENCRYPTION_NOT_CONFIGURED')
    jsonNoSecret(json)
  })

  it('with encryption configured, save → read flow returns only the masked preview, never the raw secret', async () => {
    process.env.CREDENTIALS_ENCRYPTION_KEY = 'test-passphrase-for-vitest-only'
    try {
      const putRes = await providerPUT(
        req('PUT', '/api/credentials/openai', adminCookie, { secrets: { api_key: RAW_OPENAI_KEY } }),
        { params: Promise.resolve({ provider_id: 'openai' }) },
      )
      expect(putRes.status).toBe(200)
      const putJson = await readJson(putRes)
      jsonNoSecret(putJson)
      const cred = putJson.credential as { secret_preview: string; status: string }
      expect(cred.secret_preview).toBeTruthy()
      expect(cred.secret_preview).not.toBe(RAW_OPENAI_KEY)
      expect(cred.secret_preview).toMatch(/[^.]+…[^.]+/) // sk-t…XXXX
      expect(cred.status).toBe('pending')

      const getRes = await providerGET(
        req('GET', '/api/credentials/openai', adminCookie),
        { params: Promise.resolve({ provider_id: 'openai' }) },
      )
      expect(getRes.status).toBe(200)
      const getJson = await readJson(getRes)
      jsonNoSecret(getJson)

      const catRes = await catalogGET(req('GET', '/api/credentials/catalog', adminCookie))
      const catJson = await readJson(catRes)
      jsonNoSecret(catJson)
    } finally {
      delete process.env.CREDENTIALS_ENCRYPTION_KEY
    }
  })

  it('DELETE removes the row and follow-up GET returns null', async () => {
    process.env.CREDENTIALS_ENCRYPTION_KEY = 'test-passphrase-for-vitest-only'
    try {
      await providerPUT(
        req('PUT', '/api/credentials/anthropic', adminCookie, { secrets: { api_key: 'sk-ant-test-12345' } }),
        { params: Promise.resolve({ provider_id: 'anthropic' }) },
      )
      const delRes = await providerDELETE(
        req('DELETE', '/api/credentials/anthropic', adminCookie),
        { params: Promise.resolve({ provider_id: 'anthropic' }) },
      )
      expect(delRes.status).toBe(200)
      const getRes = await providerGET(
        req('GET', '/api/credentials/anthropic', adminCookie),
        { params: Promise.resolve({ provider_id: 'anthropic' }) },
      )
      expect(getRes.status).toBe(200)
      const getJson = await readJson(getRes)
      expect(getJson.credential).toBeNull()
    } finally {
      delete process.env.CREDENTIALS_ENCRYPTION_KEY
    }
  })

  it('isolation: workspace 2 cannot see workspace 1 credentials', async () => {
    process.env.CREDENTIALS_ENCRYPTION_KEY = 'test-passphrase-for-vitest-only'
    try {
      // ws 1 stores a credential
      await providerPUT(
        req('PUT', '/api/credentials/resend', adminCookie, { secrets: { api_key: 're_test_isolation_ws1' } }),
        { params: Promise.resolve({ provider_id: 'resend' }) },
      )
      // ws 2 queries — should NOT see ws 1's row
      const res = await providerGET(
        req('GET', '/api/credentials/resend', otherWorkspaceCookie),
        { params: Promise.resolve({ provider_id: 'resend' }) },
      )
      expect(res.status).toBe(200)
      const json = await readJson(res)
      expect(json.credential).toBeNull()
    } finally {
      delete process.env.CREDENTIALS_ENCRYPTION_KEY
    }
  })

  it('rejects unknown provider with 404', async () => {
    const res = await providerGET(
      req('GET', '/api/credentials/this-is-not-a-real-provider', adminCookie),
      { params: Promise.resolve({ provider_id: 'this-is-not-a-real-provider' }) },
    )
    expect(res.status).toBe(404)
  })

  it('rejects missing required secret field with 400', async () => {
    process.env.CREDENTIALS_ENCRYPTION_KEY = 'test-passphrase-for-vitest-only'
    try {
      const res = await providerPUT(
        req('PUT', '/api/credentials/openai', adminCookie, { secrets: { api_key: '' } }),
        { params: Promise.resolve({ provider_id: 'openai' }) },
      )
      expect(res.status).toBe(400)
      const json = await readJson(res)
      expect(json.code).toBe('MISSING_SECRET')
    } finally {
      delete process.env.CREDENTIALS_ENCRYPTION_KEY
    }
  })
})
