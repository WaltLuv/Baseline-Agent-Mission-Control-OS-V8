/**
 * Google OAuth round-trip — security + storage invariants.
 *
 * Walt's required test list:
 *   · consent URL generation
 *   · state creation
 *   · invalid state rejected
 *   · callback exchanges code
 *   · refresh token stored encrypted
 *   · token not returned raw
 *   · reconnect overwrites old token
 *   · missing encryption key blocks storage safely
 *
 * Every assertion that touches a token value also runs `expect(JSON.stringify(...))
 * .not.toContain(RAW_REFRESH)` so a regression that accidentally surfaces the
 * token in a response body or audit detail fails loudly.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'

import { getDatabase } from '@/lib/db'
import { runMigrations } from '@/lib/migrations'
import { createSession } from '@/lib/auth'
import {
  buildConsentUrl,
  exchangeCodeForTokens,
  GoogleOAuthError,
  refreshAccessToken,
} from '@/lib/credentials/google-oauth'
import { consumeState, createState } from '@/lib/credentials/oauth-state'
import { decryptCredentialForRuntime, getCredential, upsertCredential } from '@/lib/credentials/store'
import { POST as connectPOST } from '@/app/api/credentials/google/connect/route'
import { GET as callbackGET } from '@/app/api/credentials/google/callback/route'
import { POST as disconnectPOST } from '@/app/api/credentials/google/disconnect/route'

const TEST_WORKSPACE_ID = 1
let adminCookie = ''

const RAW_CLIENT_SECRET = 'gocspx-TEST-SECRET-' + Math.random().toString(36).slice(2, 12)
const RAW_REFRESH = 'refresh-TEST-' + Math.random().toString(36).slice(2, 12)
const RAW_ACCESS = 'access-TEST-' + Math.random().toString(36).slice(2, 12)

const originalEnv: Record<string, string | undefined> = {}

function jsonContainsNoSecret(payload: unknown) {
  const s = JSON.stringify(payload)
  expect(s).not.toContain(RAW_REFRESH)
  expect(s).not.toContain(RAW_ACCESS)
  expect(s).not.toContain(RAW_CLIENT_SECRET)
}

beforeAll(() => {
  for (const k of ['MC_DISABLE_RATE_LIMIT', 'MISSION_CONTROL_TEST_MODE', 'CREDENTIALS_ENCRYPTION_KEY']) {
    originalEnv[k] = process.env[k]
  }
  process.env.MC_DISABLE_RATE_LIMIT = '1'
  process.env.MISSION_CONTROL_TEST_MODE = '1'

  const db = getDatabase()
  runMigrations(db)

  let uid = (db
    .prepare(`SELECT id FROM users WHERE workspace_id = ? AND role = 'admin' LIMIT 1`)
    .get(TEST_WORKSPACE_ID) as { id: number } | undefined)?.id
  if (!uid) {
    const ins = db
      .prepare(
        `INSERT INTO users (workspace_id, username, display_name, role, password_hash, created_at, updated_at)
         VALUES (?, 'google-oauth-test', 'Google OAuth Test', 'admin', 'x', unixepoch(), unixepoch())`,
      )
      .run(TEST_WORKSPACE_ID)
    uid = Number(ins.lastInsertRowid)
  }
  const { token } = createSession(uid, '127.0.0.1', 'vitest', TEST_WORKSPACE_ID)
  adminCookie = `mc-session=${token}`
})

afterAll(() => {
  for (const [k, v] of Object.entries(originalEnv)) {
    if (v === undefined) delete process.env[k]
    else process.env[k] = v
  }
})

beforeEach(() => {
  // Default each test to encryption enabled with a stable test key so the
  // store accepts writes. Individual tests disable it explicitly to pin
  // the "missing key blocks storage safely" rule.
  process.env.CREDENTIALS_ENCRYPTION_KEY = 'test-passphrase-for-google-oauth'
  // Reset the relevant rows so order doesn't leak between tests.
  const db = getDatabase()
  db.prepare(`DELETE FROM workspace_credentials WHERE workspace_id = ? AND provider_id IN ('google_oauth','gmail','google_drive','google_calendar','google_contacts')`).run(TEST_WORKSPACE_ID)
  db.prepare(`DELETE FROM oauth_states WHERE workspace_id = ?`).run(TEST_WORKSPACE_ID)
})

function req(method: string, path: string, body?: unknown): NextRequest {
  return new NextRequest(`http://localhost${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', cookie: adminCookie, 'x-forwarded-for': '127.0.0.1' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

function seedClient() {
  upsertCredential({
    workspaceId: TEST_WORKSPACE_ID,
    providerId: 'google_oauth',
    secrets: { client_secret: RAW_CLIENT_SECRET },
    publicConfig: {
      client_id: 'test-client-id.apps.googleusercontent.com',
      redirect_uri: 'http://localhost/api/credentials/google/callback',
    },
  })
}

describe('Google OAuth — consent + state', () => {
  it('builds a proper consent URL with offline access + per-service scopes', () => {
    const url = buildConsentUrl({
      client: {
        client_id: 'cid',
        client_secret: 'csec',
        redirect_uri: 'http://example.com/cb',
      },
      service: 'gmail',
      state: 'STATE123',
    })
    expect(url).toMatch(/^https:\/\/accounts\.google\.com\/o\/oauth2\/v2\/auth\?/)
    expect(url).toContain('client_id=cid')
    expect(url).toContain('access_type=offline')
    expect(url).toContain('prompt=consent')
    expect(url).toContain('state=STATE123')
    // gmail.modify or send+readonly — must include the scope literal.
    expect(decodeURIComponent(url)).toContain('https://www.googleapis.com/auth/gmail.send')
  })

  it('rejects unknown service when building consent URL', () => {
    expect(() =>
      buildConsentUrl({
        client: { client_id: 'a', client_secret: 'b', redirect_uri: 'c' },
        // @ts-expect-error — exercising the runtime guard
        service: 'not_a_google_service',
        state: 'X',
      }),
    ).toThrow(GoogleOAuthError)
  })

  it('createState + consumeState — single-use, provider-bound, time-bound', () => {
    const { state } = createState({ provider: 'google_oauth', service: 'gmail', workspaceId: TEST_WORKSPACE_ID, userId: 1 })
    expect(state).toMatch(/^[A-Za-z0-9_-]+$/)
    const row = consumeState(state, 'google_oauth')
    expect(row).not.toBeNull()
    expect(row!.service).toBe('gmail')
    expect(row!.workspace_id).toBe(TEST_WORKSPACE_ID)
    // Single-use: a replay must fail.
    expect(consumeState(state, 'google_oauth')).toBeNull()
  })

  it('consumeState rejects when the expected provider does not match', () => {
    const { state } = createState({ provider: 'google_oauth', service: 'gmail', workspaceId: TEST_WORKSPACE_ID })
    expect(consumeState(state, 'github')).toBeNull()
    // The above call still consumed it, so the legitimate caller now also gets null —
    // confirms the row is deleted on any consume attempt to prevent further replay.
    expect(consumeState(state, 'google_oauth')).toBeNull()
  })

  it('connect endpoint refuses without google_oauth client config (returns 409)', async () => {
    const res = await connectPOST(req('POST', '/api/credentials/google/connect', { service: 'gmail' }))
    expect(res.status).toBe(409)
    const json = await res.json()
    expect(json.code).toBe('MISSING_CLIENT_CONFIG')
  })

  it('connect endpoint refuses with 412 when CREDENTIALS_ENCRYPTION_KEY is unset', async () => {
    delete process.env.CREDENTIALS_ENCRYPTION_KEY
    const res = await connectPOST(req('POST', '/api/credentials/google/connect', { service: 'gmail' }))
    expect(res.status).toBe(412)
    const json = await res.json()
    expect(json.code).toBe('ENCRYPTION_NOT_CONFIGURED')
  })

  it('connect endpoint returns a consent URL + state when client is configured', async () => {
    seedClient()
    const res = await connectPOST(req('POST', '/api/credentials/google/connect', { service: 'google_drive' }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.consent_url).toMatch(/accounts\.google\.com/)
    expect(json.state).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(json.expires_in_seconds).toBe(600)
    jsonContainsNoSecret(json)
  })
})

describe('Google OAuth — code exchange + storage', () => {
  function tokenFetcher(opts: { ok?: boolean; status?: number; body?: unknown } = {}): typeof fetch {
    const ok = opts.ok ?? true
    const status = opts.status ?? 200
    const body =
      opts.body ?? {
        access_token: RAW_ACCESS,
        refresh_token: RAW_REFRESH,
        expires_in: 3600,
        scope: 'https://www.googleapis.com/auth/gmail.readonly',
        token_type: 'Bearer',
      }
    return (async () =>
      ({
        ok,
        status,
        async json() {
          return body
        },
        async text() {
          return JSON.stringify(body)
        },
      } as unknown as Response)) as unknown as typeof fetch
  }

  it('exchangeCodeForTokens parses a successful response', async () => {
    const tokens = await exchangeCodeForTokens({
      client: { client_id: 'a', client_secret: 'b', redirect_uri: 'c' },
      code: 'AUTHCODE',
      fetcher: tokenFetcher(),
    })
    expect(tokens.access_token).toBe(RAW_ACCESS)
    expect(tokens.refresh_token).toBe(RAW_REFRESH)
  })

  it('exchangeCodeForTokens raises TOKEN_EXCHANGE_FAILED on non-2xx', async () => {
    await expect(
      exchangeCodeForTokens({
        client: { client_id: 'a', client_secret: 'b', redirect_uri: 'c' },
        code: 'AUTHCODE',
        fetcher: tokenFetcher({ ok: false, status: 401, body: { error: 'invalid_client' } }),
      }),
    ).rejects.toBeInstanceOf(GoogleOAuthError)
  })

  it('refreshAccessToken preserves an existing refresh_token when Google does not return one', async () => {
    const tokens = await refreshAccessToken({
      client: { client_id: 'a', client_secret: 'b', redirect_uri: 'c' },
      refresh_token: 'EXISTING-RT',
      fetcher: tokenFetcher({
        body: {
          access_token: 'fresh-access',
          expires_in: 3599,
          scope: 'https://www.googleapis.com/auth/gmail.readonly',
          token_type: 'Bearer',
        },
      }),
    })
    expect(tokens.refresh_token).toBe('EXISTING-RT')
    expect(tokens.access_token).toBe('fresh-access')
  })

  it('callback rejects an invalid state with redirect carrying ?google=error', async () => {
    seedClient()
    const res = await callbackGET(
      new NextRequest(
        `http://localhost/api/credentials/google/callback?code=AUTHCODE&state=NOT-A-REAL-STATE`,
        { headers: { cookie: adminCookie, 'x-forwarded-for': '127.0.0.1' } },
      ),
    )
    expect(res.status).toBe(307)
    const loc = res.headers.get('location') ?? ''
    expect(loc).toContain('google=error')
    expect(loc).toContain('invalid_state')
  })

  it('callback happy path: exchanges code, stores encrypted refresh token, marks connected', async () => {
    seedClient()
    // Plant a real state.
    const { state } = createState({
      provider: 'google_oauth',
      service: 'gmail',
      workspaceId: TEST_WORKSPACE_ID,
      userId: 1,
    })
    // Inject our stub fetcher by monkey-patching globalThis.fetch around the call —
    // exchangeCodeForTokens defaults to global fetch when the helper isn't
    // passed an explicit fetcher.
    const origFetch = global.fetch
    global.fetch = tokenFetcher()
    try {
      const res = await callbackGET(
        new NextRequest(
          `http://localhost/api/credentials/google/callback?code=AUTHCODE&state=${state}`,
          { headers: { cookie: adminCookie, 'x-forwarded-for': '127.0.0.1' } },
        ),
      )
      expect(res.status).toBe(307)
      const loc = res.headers.get('location') ?? ''
      expect(loc).toContain('google=ok')
      // Crucially: the raw token must not appear in the redirect URL.
      expect(loc).not.toContain(RAW_REFRESH)
      expect(loc).not.toContain(RAW_ACCESS)

      // Saved row exists and exposes only the preview.
      const stored = getCredential(TEST_WORKSPACE_ID, 'gmail')
      expect(stored).not.toBeNull()
      expect(stored!.status).toBe('connected')
      expect(stored!.secret_preview).not.toBe(RAW_REFRESH)
      jsonContainsNoSecret(stored)

      // Internal decryption path returns the original plaintext.
      const decrypted = decryptCredentialForRuntime(TEST_WORKSPACE_ID, 'gmail')
      expect(decrypted?.refresh_token).toBe(RAW_REFRESH)
    } finally {
      global.fetch = origFetch
    }
  })

  it('reconnect overwrites the previously-stored refresh token', async () => {
    seedClient()
    upsertCredential({
      workspaceId: TEST_WORKSPACE_ID,
      providerId: 'gmail',
      secrets: { refresh_token: 'OLD-TOKEN' },
    })
    const { state } = createState({
      provider: 'google_oauth',
      service: 'gmail',
      workspaceId: TEST_WORKSPACE_ID,
      userId: 1,
    })
    const origFetch = global.fetch
    global.fetch = tokenFetcher()
    try {
      await callbackGET(
        new NextRequest(
          `http://localhost/api/credentials/google/callback?code=AUTHCODE&state=${state}`,
          { headers: { cookie: adminCookie, 'x-forwarded-for': '127.0.0.1' } },
        ),
      )
      const decrypted = decryptCredentialForRuntime(TEST_WORKSPACE_ID, 'gmail')
      expect(decrypted?.refresh_token).toBe(RAW_REFRESH)
      expect(decrypted?.refresh_token).not.toBe('OLD-TOKEN')
    } finally {
      global.fetch = origFetch
    }
  })

  it('callback fails safely when encryption is unset — redirects with encryption_not_configured', async () => {
    seedClient()
    const { state } = createState({
      provider: 'google_oauth',
      service: 'gmail',
      workspaceId: TEST_WORKSPACE_ID,
      userId: 1,
    })
    delete process.env.CREDENTIALS_ENCRYPTION_KEY
    const res = await callbackGET(
      new NextRequest(
        `http://localhost/api/credentials/google/callback?code=AUTHCODE&state=${state}`,
        { headers: { cookie: adminCookie, 'x-forwarded-for': '127.0.0.1' } },
      ),
    )
    expect(res.status).toBe(307)
    const loc = res.headers.get('location') ?? ''
    expect(loc).toContain('google=error')
    expect(loc).toContain('encryption_not_configured')
    // No row should have been written.
    const stored = getCredential(TEST_WORKSPACE_ID, 'gmail')
    expect(stored).toBeNull()
  })

  it('disconnect best-effort revokes + deletes the row', async () => {
    seedClient()
    upsertCredential({
      workspaceId: TEST_WORKSPACE_ID,
      providerId: 'gmail',
      secrets: { refresh_token: RAW_REFRESH },
    })
    const origFetch = global.fetch
    // Stub Google's revoke endpoint to return 200.
    global.fetch = (async () => ({ ok: true, status: 200, async json() { return {} }, async text() { return '' } } as unknown as Response)) as unknown as typeof fetch
    try {
      const res = await disconnectPOST(req('POST', '/api/credentials/google/disconnect', { service: 'gmail' }))
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.deleted).toBe(true)
      jsonContainsNoSecret(json)
      expect(getCredential(TEST_WORKSPACE_ID, 'gmail')).toBeNull()
    } finally {
      global.fetch = origFetch
    }
  })
})
