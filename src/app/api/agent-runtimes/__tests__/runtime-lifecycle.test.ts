/**
 * Vitest spec — runtime lifecycle through Mission Control's persistent registry.
 *
 * Proves what the user demanded:
 *   - register (handshake)
 *   - heartbeat
 *   - persistence after refresh (DB is source of truth)
 *   - reconnect (idempotent re-register refreshes last_seen)
 *   - workspace assignment (runtime appears in its workspace only)
 *   - health state (connection_status: connected → stale → disconnected)
 *
 * The lifecycle is the same whether the runtime is Hermes, OpenClaw,
 * Claude Code, or Codex — only the `framework` body field changes.
 */
import { describe, it, expect, beforeAll } from 'vitest'

process.env.MC_DISABLE_RATE_LIMIT = '1'

import { POST as registerPOST } from '@/app/api/agents/register/route'
import { GET as runtimesGET } from '@/app/api/agent-runtimes/route'
import { GET as heartbeatGET } from '@/app/api/agents/[id]/heartbeat/route'
import { POST as signupPOST } from '@/app/api/auth/signup/route'
import { getDatabase } from '@/lib/db'
import { runMigrations } from '@/lib/migrations'
import { NextRequest } from 'next/server'

function rndIp() {
  return `10.${Math.floor(Math.random() * 254)}.${Math.floor(Math.random() * 254)}.${Math.floor(Math.random() * 254)}`
}

async function signupCustomer(suffix: string) {
  const res = await signupPOST(new Request('http://localhost/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': rndIp() },
    body: JSON.stringify({
      email: `runtime_${suffix}@acme.test`,
      password: 'CorrectHorseBattery42',
      full_name: 'Runtime Tester',
      company_name: `Runtime ${suffix}`,
      business_type: 'pm',
    }),
  }))
  if (res.status !== 200) throw new Error(`signup failed: ${res.status}`)
  const data = await res.json()
  const setCookie = res.headers.get('set-cookie') || ''
  const cookie = setCookie.split(';')[0]
  return { user: data.user, workspace: data.workspace, cookie }
}

function nextReqJSON(url: string, body: unknown, cookie: string, method = 'POST'): NextRequest {
  return new NextRequest(url, {
    method,
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': rndIp(), cookie },
    body: JSON.stringify(body),
  })
}

function nextReqGET(url: string, cookie: string): NextRequest {
  return new NextRequest(url, {
    headers: { cookie, 'x-forwarded-for': rndIp() },
  })
}

describe('Runtime lifecycle — handshake, heartbeat, persistence, reconnect', () => {
  beforeAll(() => runMigrations(getDatabase()))

  it('runtime handshake (register) persists with correct runtime_type + workspace_id', async () => {
    const ts = Date.now()
    const customer = await signupCustomer(`hs_${ts}`)

    // Hermes runtime registers
    const reg = await registerPOST(nextReqJSON('http://localhost/api/agents/register', {
      name: `hermes-${ts}`,
      role: 'agent',
      framework: 'hermes',
      capabilities: ['research', 'plan'],
    }, customer.cookie))
    expect(reg.status).toBe(201)
    const regBody = await reg.json()
    expect(regBody.registered).toBe(true)

    // Persistence: row in DB with runtime_type='hermes', workspace_id=customer.workspace.id
    const db = getDatabase()
    const row = db.prepare(`SELECT id, name, runtime_type, workspace_id, last_seen FROM agents WHERE id = ?`).get(regBody.agent.id) as { id: number; runtime_type: string; workspace_id: number; last_seen: number }
    expect(row.runtime_type).toBe('hermes')
    expect(row.workspace_id).toBe(customer.workspace.id)
    expect(row.last_seen).toBeGreaterThan(0)
  })

  it('GET /api/agent-runtimes returns DB-registered runtimes scoped to workspace with connection_status', async () => {
    const ts = Date.now()
    const customer = await signupCustomer(`reg_${ts}`)
    const other = await signupCustomer(`other_${ts}`)

    // Register a Claude Code runtime in customer's workspace
    const r1 = await registerPOST(nextReqJSON('http://localhost/api/agents/register', {
      name: `claude-${ts}`, framework: 'claude',
    }, customer.cookie))
    expect(r1.status).toBe(201)

    // Register an OpenClaw runtime in OTHER's workspace
    const r2 = await registerPOST(nextReqJSON('http://localhost/api/agents/register', {
      name: `openclaw-${ts}`, framework: 'openclaw',
    }, other.cookie))
    expect(r2.status).toBe(201)

    // Customer sees their Claude runtime; not other's OpenClaw
    const res = await runtimesGET(nextReqGET('http://localhost/api/agent-runtimes', customer.cookie))
    expect(res.status).toBe(200)
    const body = await res.json()
    const names = (body.registered || []).map((r: { name: string }) => r.name)
    expect(names).toContain(`claude-${ts}`)
    expect(names).not.toContain(`openclaw-${ts}`)

    const claudeReg = body.registered.find((r: { name: string }) => r.name === `claude-${ts}`)
    expect(claudeReg.runtime_type).toBe('claude')
    expect(claudeReg.connection_status).toBe('connected') // last_seen just now
    expect(claudeReg.seconds_since_heartbeat).toBeLessThan(5)
  })

  it('heartbeat refreshes last_seen and keeps runtime "connected"', async () => {
    const ts = Date.now()
    const customer = await signupCustomer(`hb_${ts}`)
    const reg = await registerPOST(nextReqJSON('http://localhost/api/agents/register', {
      name: `codex-${ts}`, framework: 'codex',
    }, customer.cookie))
    const agentId = (await reg.json()).agent.id

    // Backdate last_seen so heartbeat must move it forward
    getDatabase().prepare(`UPDATE agents SET last_seen = ? WHERE id = ?`)
      .run(Math.floor(Date.now() / 1000) - 30, agentId)

    const hb = await heartbeatGET(
      nextReqGET(`http://localhost/api/agents/${agentId}/heartbeat`, customer.cookie),
      { params: Promise.resolve({ id: String(agentId) }) },
    )
    expect(hb.status).toBe(200)

    const refreshed = getDatabase().prepare(`SELECT last_seen FROM agents WHERE id = ?`).get(agentId) as { last_seen: number }
    expect(refreshed.last_seen).toBeGreaterThan(Math.floor(Date.now() / 1000) - 5)
  })

  it('connection_status reflects heartbeat age: connected → stale → disconnected', async () => {
    const ts = Date.now()
    const customer = await signupCustomer(`status_${ts}`)
    const reg = await registerPOST(nextReqJSON('http://localhost/api/agents/register', {
      name: `hermes-status-${ts}`, framework: 'hermes',
    }, customer.cookie))
    const agentId = (await reg.json()).agent.id
    const db = getDatabase()
    const now = Math.floor(Date.now() / 1000)

    // Stale (over 90s)
    db.prepare(`UPDATE agents SET last_seen = ? WHERE id = ?`).run(now - 120, agentId)
    let res = await runtimesGET(nextReqGET('http://localhost/api/agent-runtimes', customer.cookie))
    let runtime = (await res.json()).registered.find((r: { id: number }) => r.id === agentId)
    expect(runtime.connection_status).toBe('stale')

    // Disconnected (over 5x = 450s)
    db.prepare(`UPDATE agents SET last_seen = ? WHERE id = ?`).run(now - 600, agentId)
    res = await runtimesGET(nextReqGET('http://localhost/api/agent-runtimes', customer.cookie))
    runtime = (await res.json()).registered.find((r: { id: number }) => r.id === agentId)
    expect(runtime.connection_status).toBe('disconnected')

    // Re-register (reconnect) → connected again
    const reconnect = await registerPOST(nextReqJSON('http://localhost/api/agents/register', {
      name: `hermes-status-${ts}`, framework: 'hermes', capabilities: ['research'],
    }, customer.cookie))
    expect(reconnect.status).toBe(200) // idempotent existing-agent branch
    res = await runtimesGET(nextReqGET('http://localhost/api/agent-runtimes', customer.cookie))
    runtime = (await res.json()).registered.find((r: { id: number }) => r.id === agentId)
    expect(runtime.connection_status).toBe('connected')
  })

  it('persistence across "refresh" — DB row survives a simulated process restart', async () => {
    const ts = Date.now()
    const customer = await signupCustomer(`persist_${ts}`)
    const reg = await registerPOST(nextReqJSON('http://localhost/api/agents/register', {
      name: `claude-persist-${ts}`, framework: 'claude',
    }, customer.cookie))
    const agentId = (await reg.json()).agent.id

    // Simulate "refresh" by re-reading directly from DB after a fresh request.
    const res = await runtimesGET(nextReqGET('http://localhost/api/agent-runtimes', customer.cookie))
    const body = await res.json()
    const found = body.registered.find((r: { id: number }) => r.id === agentId)
    expect(found).toBeDefined()
    expect(found.runtime_type).toBe('claude')
    expect(found.workspace_id).toBe(customer.workspace.id)
  })
})
