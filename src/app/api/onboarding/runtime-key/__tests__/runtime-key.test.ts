/**
 * Vitest spec for POST /api/onboarding/runtime-key — the Runtime Connect
 * Wizard's "Generate API key + command" endpoint.
 *
 * Regression contract:
 *   1. Unauthenticated callers get 401.
 *   2. Authenticated admin can mint a runtime API key for any of the four
 *      supported runtimes (claude / codex / openclaw / hermes).
 *   3. The INSERT into `agents` matches the actual SQLite schema — no
 *      `capacity` column, no other phantom columns. This is the bug that
 *      blocked the Activation Pass.
 *   4. The response includes everything the wizard needs to render the
 *      paste-able command: api_key (shown once), api_key_hint (masked),
 *      connect_command (MC_URL/MC_API_KEY/RUNTIME_TYPE), mission_control_url.
 *   5. Invalid runtime is rejected with 400.
 */
import { describe, it, expect, beforeAll } from 'vitest'

process.env.MC_DISABLE_RATE_LIMIT = '1'

import { POST as runtimeKeyPOST } from '@/app/api/onboarding/runtime-key/route'
import { POST as signupPOST } from '@/app/api/auth/signup/route'
import { getDatabase } from '@/lib/db'
import '@/lib/migrations'
import { runMigrations } from '@/lib/migrations'

async function makeAdminSession(): Promise<{ cookie: string; workspaceId: number }> {
  const ts = Date.now() + Math.floor(Math.random() * 10000)
  const res = await signupPOST(
    new Request('http://localhost/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': `10.0.0.${ts % 250}` },
      body: JSON.stringify({
        email: `rk_${ts}@acme.test`,
        password: 'CorrectHorseBattery42',
        full_name: 'Runtime Tester',
        company_name: `RuntimeCo ${ts}`,
        business_type: 'pm',
      }),
    }),
  )
  expect(res.status).toBe(200)
  const data = (await res.json()) as { workspace: { id: number }; user?: { id: number } }
  const setCookie = res.headers.get('set-cookie') || ''
  const m = setCookie.match(/(?:mc-session|__Secure-mc-session)=([^;]+)/i)
  if (!m) throw new Error('no session cookie returned from signup')
  // Mark the freshly-signed-up user verified so the email-verification gate on
  // sensitive routes (runtime-key mint) lets this admin through.
  getDatabase().prepare('UPDATE users SET email_verified_at = unixepoch() WHERE email = ?').run(`rk_${ts}@acme.test`)
  return { cookie: `mc-session=${m[1]}`, workspaceId: data.workspace.id }
}

function makeRequest(body: unknown, cookie?: string): Request {
  return new Request('http://localhost/api/onboarding/runtime-key', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body),
  })
}

describe('POST /api/onboarding/runtime-key — runtime wizard mint', () => {
  beforeAll(() => {
    runMigrations(getDatabase())
  })

  it('rejects unauthenticated callers with 401', async () => {
    const res = await runtimeKeyPOST(makeRequest({ runtime: 'claude' }))
    expect(res.status).toBe(401)
  })

  it.each(['claude', 'codex', 'openclaw', 'hermes', 'hermes-vps', 'omp'] as const)(
    'mints a runtime key + paste command for %s without hitting non-existent columns',
    async (runtime) => {
      const { cookie, workspaceId } = await makeAdminSession()
      const res = await runtimeKeyPOST(makeRequest({ runtime, label: `${runtime}-wizard` }, cookie))
      expect(res.status).toBe(200)
      const body = (await res.json()) as {
        runtime: string
        agent_id: number
        agent_name: string
        workspace_id: number
        api_key: string
        api_key_hint: string
        connect_command: string
        mission_control_url: string
      }
      expect(body.runtime).toBe(runtime)
      expect(body.workspace_id).toBe(workspaceId)
      expect(body.agent_id).toBeGreaterThan(0)
      expect(body.api_key).toMatch(/^mca_/)
      expect(body.api_key_hint).toContain('...')
      expect(body.connect_command).toContain('MC_URL=')
      expect(body.connect_command).toContain('MC_API_KEY=')
      expect(body.connect_command).toContain(`RUNTIME_TYPE=${runtime}`)
      expect(body.connect_command).toContain('connect-runtime.mjs')

      // Schema integrity: the agent row inserted must exist and be bound to
      // the calling workspace. This is the regression check for the bug
      // "table agents has no column named capacity".
      const db = getDatabase()
      const agent = db.prepare('SELECT id, workspace_id, runtime_type FROM agents WHERE id = ?').get(body.agent_id) as
        | { id: number; workspace_id: number; runtime_type: string }
        | undefined
      expect(agent).toBeDefined()
      expect(agent!.workspace_id).toBe(workspaceId)
      expect(agent!.runtime_type).toBe(runtime)

      // And the API key hash is persisted, key_prefix matches the visible prefix.
      const key = db
        .prepare('SELECT key_prefix, scopes FROM agent_api_keys WHERE agent_id = ?')
        .get(body.agent_id) as { key_prefix: string; scopes: string } | undefined
      expect(key).toBeDefined()
      expect(body.api_key.startsWith(key!.key_prefix)).toBe(true)
      expect(JSON.parse(key!.scopes)).toContain('runtime')
    },
  )

  it('rejects unknown runtime with 400', async () => {
    const { cookie } = await makeAdminSession()
    const res = await runtimeKeyPOST(makeRequest({ runtime: 'totally-fake' }, cookie))
    expect(res.status).toBe(400)
  })

  it('is idempotent: re-entering the wizard with the same label reuses the agent', async () => {
    const { cookie, workspaceId } = await makeAdminSession()
    const label = 'idem-runtime'
    const a = await runtimeKeyPOST(makeRequest({ runtime: 'claude', label }, cookie))
    const b = await runtimeKeyPOST(makeRequest({ runtime: 'claude', label }, cookie))
    expect(a.status).toBe(200)
    expect(b.status).toBe(200)
    const ja = (await a.json()) as { agent_id: number; workspace_id: number }
    const jb = (await b.json()) as { agent_id: number; workspace_id: number }
    expect(ja.agent_id).toBe(jb.agent_id)
    expect(ja.workspace_id).toBe(workspaceId)
  })

  // Walt's D-A3 — VPS Hermes pairing must:
  //   - use the singleton agent name `hermes-vps` (no timestamp suffix), so
  //     re-entering the wizard from the VPS Hermes panel re-keys the
  //     existing agent rather than spawning a new one per click;
  //   - surface a curl-only command in addition to the Node connect script,
  //     since the VPS does not necessarily have the script colocated;
  //   - default capabilities include 'production-controller', 'pipelines',
  //     'agent-orchestration' so the MC UI shows the role honestly.
  it('hermes-vps uses a singleton agent identity per workspace (no timestamp sprawl)', async () => {
    const { cookie, workspaceId } = await makeAdminSession()
    const a = await runtimeKeyPOST(makeRequest({ runtime: 'hermes-vps' }, cookie))
    const b = await runtimeKeyPOST(makeRequest({ runtime: 'hermes-vps' }, cookie))
    expect(a.status).toBe(200)
    expect(b.status).toBe(200)
    const ja = (await a.json()) as { agent_id: number; agent_name: string; workspace_id: number }
    const jb = (await b.json()) as { agent_id: number; agent_name: string }
    expect(ja.agent_name).toBe('hermes-vps')
    expect(jb.agent_name).toBe('hermes-vps')
    expect(ja.agent_id).toBe(jb.agent_id) // same agent row reused
    expect(ja.workspace_id).toBe(workspaceId)
  })

  it('hermes-vps response surfaces a curl_command with the api key + hermes-vps capabilities', async () => {
    const { cookie } = await makeAdminSession()
    const res = await runtimeKeyPOST(makeRequest({ runtime: 'hermes-vps' }, cookie))
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      curl_command: string
      api_key: string
      docs_url: string
    }
    expect(body.curl_command).toContain('curl -sS -X POST')
    expect(body.curl_command).toContain('/api/runtime/handshake')
    expect(body.curl_command).toContain(body.api_key) // pre-filled, ready to paste on VPS
    expect(body.curl_command).toContain('"kind":"hermes-vps"')
    expect(body.curl_command).toContain('production-controller')
    expect(body.docs_url).toContain('VPS_HERMES_PAIRING')
  })
})
