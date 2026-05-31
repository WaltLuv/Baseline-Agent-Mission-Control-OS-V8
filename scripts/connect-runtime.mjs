#!/usr/bin/env node
/**
 * connect-runtime — copy-paste connector for an external runtime
 * (Hermes / OpenClaw / Claude Code / Codex / agent-gateway) running anywhere
 * reachable from Mission Control.
 *
 * Two auth modes — pick exactly ONE per deployment:
 *
 *   1. API key (recommended for unattended daemons on a VPS):
 *
 *        MC_URL=https://mission.example.com \
 *        MC_API_KEY=mca_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx \
 *        RUNTIME_NAME=hermes-prod-1 \
 *        RUNTIME_TYPE=hermes \
 *        node scripts/connect-runtime.mjs
 *
 *      MC_API_KEY can be either:
 *        - a workspace-wide key from `process.env.API_KEY` on the MC side, or
 *        - an agent-scoped key minted via POST /api/agents/{id}/keys.
 *
 *      The key is sent as `x-api-key: <value>`. No cookie required. No
 *      browser session needed. Restart-safe.
 *
 *   2. Session cookie (manual / interactive testing only):
 *
 *        MC_URL=https://mission.example.com \
 *        MC_SESSION="<value of mc-session cookie>" \
 *        RUNTIME_NAME=openclaw-prod-1 \
 *        RUNTIME_TYPE=openclaw \
 *        node scripts/connect-runtime.mjs
 *
 * Optional vars:
 *   RUNTIME_URL              probe target — if set, the runtime is HTTP-probed
 *                            before each heartbeat (alive / 401 / 403 = alive)
 *   RUNTIME_TOKEN            bearer used when probing RUNTIME_URL
 *   RUNTIME_CAPABILITIES     comma-list, defaults to "execute"
 *   HEARTBEAT_MS             default 30000
 *
 * Exits cleanly on SIGINT. Logs each heartbeat result.
 */

const REQUIRED_ALWAYS = ['MC_URL', 'RUNTIME_NAME', 'RUNTIME_TYPE']
for (const k of REQUIRED_ALWAYS) {
  if (!process.env[k]) {
    console.error(`[connect-runtime] missing required env var: ${k}`)
    process.exit(2)
  }
}

const MC_URL = process.env.MC_URL.replace(/\/+$/, '')
const MC_API_KEY = (process.env.MC_API_KEY || '').trim()
const MC_SESSION_COOKIE = (process.env.MC_SESSION || '').trim()

if (!MC_API_KEY && !MC_SESSION_COOKIE) {
  console.error('[connect-runtime] auth required — set MC_API_KEY (preferred) or MC_SESSION')
  process.exit(2)
}

const RUNTIME_NAME = process.env.RUNTIME_NAME
const RUNTIME_TYPE = process.env.RUNTIME_TYPE
const RUNTIME_URL = process.env.RUNTIME_URL || null
const RUNTIME_TOKEN = process.env.RUNTIME_TOKEN || null
const CAPABILITIES = (process.env.RUNTIME_CAPABILITIES || 'execute')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
const HEARTBEAT_MS = parseInt(process.env.HEARTBEAT_MS || '30000', 10)

const authMode = MC_API_KEY ? 'api-key' : 'session-cookie'

const cookieHeader = MC_SESSION_COOKIE
  ? (MC_SESSION_COOKIE.includes('=') ? MC_SESSION_COOKIE : `mc-session=${MC_SESSION_COOKIE}`)
  : null

function authHeaders() {
  const h = {}
  if (MC_API_KEY) {
    h['x-api-key'] = MC_API_KEY
    // Some upstream proxies strip x-api-key; mirror it on authorization.
    h['authorization'] = `Bearer ${MC_API_KEY}`
  }
  if (cookieHeader) {
    h['cookie'] = cookieHeader
  }
  return h
}

async function mcCall(path, init = {}) {
  const res = await fetch(`${MC_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
      ...(init.headers || {}),
    },
  })
  let body
  try { body = await res.json() } catch { body = null }
  return { status: res.status, body }
}

async function probeRuntime() {
  if (!RUNTIME_URL) return { alive: true, note: 'no-probe-configured' }
  try {
    const res = await fetch(RUNTIME_URL, {
      headers: RUNTIME_TOKEN ? { 'Authorization': `Bearer ${RUNTIME_TOKEN}` } : {},
    })
    return { alive: res.ok || res.status === 401 || res.status === 403, status: res.status }
  } catch (err) {
    return { alive: false, error: err.message }
  }
}

let agentId = null

async function register() {
  const { status, body } = await mcCall('/api/agents/register', {
    method: 'POST',
    body: JSON.stringify({
      name: RUNTIME_NAME,
      role: 'agent',
      framework: RUNTIME_TYPE,
      capabilities: CAPABILITIES,
    }),
  })
  if (status !== 200 && status !== 201) {
    console.error(`[connect-runtime] register failed: ${status}`, body)
    if (status === 401 || status === 403) {
      console.error(`[connect-runtime] auth rejected (mode=${authMode}) — verify the MC_${MC_API_KEY ? 'API_KEY' : 'SESSION'} value`)
    }
    process.exit(3)
  }
  agentId = body.agent.id
  console.log(
    `[connect-runtime] registered name=${RUNTIME_NAME} runtime_type=${body.agent.runtime_type || RUNTIME_TYPE} ` +
    `agent_id=${agentId} new=${body.registered} auth=${authMode}`
  )
}

async function heartbeat() {
  if (!agentId) return
  const probe = await probeRuntime()
  if (!probe.alive) {
    console.warn(`[connect-runtime] runtime probe failed (${JSON.stringify(probe)}) — sending heartbeat anyway so Mission Control marks stale`)
  }
  // Use the agent name heartbeat endpoint — works for both API key and cookie.
  // The :id route also accepts the agent's name (resolves by name in workspace).
  const { status, body } = await mcCall(`/api/agents/${agentId}/heartbeat`, { method: 'GET' })
  if (status !== 200) {
    console.error(`[connect-runtime] heartbeat failed: ${status}`, body)
    if (status === 401 || status === 403) {
      console.error(`[connect-runtime] auth rejected during heartbeat (mode=${authMode}). ${MC_API_KEY ? 'Check MC_API_KEY is still active and not revoked.' : 'Re-login on Mission Control and update MC_SESSION.'}`)
      process.exit(4)
    }
  } else {
    console.log(`[connect-runtime] heartbeat ok @ ${new Date().toISOString()}  probe=${probe.alive ? 'alive' : 'down'}  auth=${authMode}`)
  }
}

let hbTimer = null
process.on('SIGINT', () => {
  console.log('\n[connect-runtime] stopping')
  if (hbTimer) clearInterval(hbTimer)
  process.exit(0)
})

;(async () => {
  await register()
  await heartbeat()
  hbTimer = setInterval(heartbeat, HEARTBEAT_MS)
  console.log(`[connect-runtime] heartbeating every ${HEARTBEAT_MS}ms — auth=${authMode} — Ctrl+C to stop`)
})().catch((err) => {
  console.error('[connect-runtime] fatal:', err)
  process.exit(1)
})
