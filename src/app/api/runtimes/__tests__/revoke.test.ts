/**
 * DELETE /api/runtimes/:id — Hermes VPS "Revoke runtime" kill switch (#105).
 *
 * Contract: removing a runtime revokes its API keys (so the VPS can no longer
 * heartbeat → 401) AND drops the runtime_registry row. Admin-only.
 */
import { describe, it, expect, beforeAll } from 'vitest'

process.env.MC_DISABLE_RATE_LIMIT = '1'

import { NextRequest } from 'next/server'
import { DELETE as runtimeDELETE } from '@/app/api/runtimes/[id]/route'
import { POST as runtimeKeyPOST } from '@/app/api/onboarding/runtime-key/route'
import { POST as signupPOST } from '@/app/api/auth/signup/route'
import { getDatabase } from '@/lib/db'
import { runMigrations } from '@/lib/migrations'
import { registerHandshake, runtimeRegistrySnapshot, getRuntime } from '@/lib/baseline-os/runtime-registry'

async function makeAdminSession(): Promise<{ cookie: string; workspaceId: number }> {
  const ts = Date.now() + Math.floor(Math.random() * 100000)
  const res = await signupPOST(
    new Request('http://localhost/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': `10.0.2.${ts % 250}` },
      body: JSON.stringify({
        email: `revoke_${ts}@acme.test`,
        password: 'CorrectHorseBattery42',
        full_name: 'Revoke Tester',
        company_name: `RevokeCo ${ts}`,
        business_type: 'pm',
      }),
    }),
  )
  expect(res.status).toBe(200)
  const data = (await res.json()) as { workspace: { id: number } }
  const setCookie = res.headers.get('set-cookie') || ''
  const m = setCookie.match(/(?:mc-session|__Secure-mc-session)=([^;]+)/i)
  if (!m) throw new Error('no session cookie')
  return { cookie: `mc-session=${m[1]}`, workspaceId: data.workspace.id }
}

describe('DELETE /api/runtimes/:id — revoke kill switch', () => {
  beforeAll(() => { runMigrations(getDatabase()) })

  it('removes the registry row and revokes the runtime API keys', async () => {
    const { cookie, workspaceId } = await makeAdminSession()

    // 1. Mint a hermes-vps pairing key (creates the singleton agent + key).
    const mintRes = await runtimeKeyPOST(
      new Request('http://localhost/api/onboarding/runtime-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie },
        body: JSON.stringify({ runtime: 'hermes-vps' }),
      }),
    )
    expect(mintRes.status).toBe(200)
    const mint = (await mintRes.json()) as { agent_id: number }

    // 2. VPS handshakes → registry row appears.
    registerHandshake(workspaceId, {
      kind: 'hermes-vps',
      installationId: 'hermes-vps',
      label: 'Hermes VPS',
      version: '0.15.1',
      capabilities: ['production-controller'],
    })
    const row = runtimeRegistrySnapshot(workspaceId).find((r) => r.kind === 'hermes-vps')
    expect(row).toBeDefined()

    const db = getDatabase()
    const keysBefore = db
      .prepare('SELECT COUNT(*) AS c FROM agent_api_keys WHERE agent_id = ? AND revoked_at IS NULL')
      .get(mint.agent_id) as { c: number }
    expect(keysBefore.c).toBeGreaterThan(0)

    // 3. Revoke via the DELETE route (admin session).
    const delRes = await runtimeDELETE(
      new NextRequest(`http://localhost/api/runtimes/${row!.id}`, { method: 'DELETE', headers: { cookie } }),
      { params: Promise.resolve({ id: String(row!.id) }) },
    )
    expect(delRes.status).toBe(200)
    const body = (await delRes.json()) as { ok: boolean; removed: boolean; revoked_keys: number; runtime_id: string }
    expect(body.ok).toBe(true)
    expect(body.removed).toBe(true)
    expect(body.revoked_keys).toBeGreaterThan(0)
    expect(body.runtime_id).toBe('hermes-vps')

    // 4. Registry row gone + keys revoked.
    expect(getRuntime(workspaceId, 'hermes-vps', 'hermes-vps')).toBeNull()
    const keysAfter = db
      .prepare('SELECT COUNT(*) AS c FROM agent_api_keys WHERE agent_id = ? AND revoked_at IS NULL')
      .get(mint.agent_id) as { c: number }
    expect(keysAfter.c).toBe(0)
  })

  it('rejects unauthenticated callers', async () => {
    const res = await runtimeDELETE(
      new NextRequest('http://localhost/api/runtimes/1', { method: 'DELETE' }),
      { params: Promise.resolve({ id: '1' }) },
    )
    expect(res.status).toBe(401)
  })

  it('404 for a runtime that does not exist in the workspace', async () => {
    const { cookie } = await makeAdminSession()
    const res = await runtimeDELETE(
      new NextRequest('http://localhost/api/runtimes/999999', { method: 'DELETE', headers: { cookie } }),
      { params: Promise.resolve({ id: '999999' }) },
    )
    expect(res.status).toBe(404)
  })
})
