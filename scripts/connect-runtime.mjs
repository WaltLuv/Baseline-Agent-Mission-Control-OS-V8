#!/usr/bin/env node
/**
 * connect-runtime — copy-paste connector for an external runtime
 * (Hermes / OpenClaw / Claude Code / Codex) running anywhere reachable.
 *
 * Registers the runtime with Mission Control's `/api/agents/register`, then
 * heartbeats it every 30s. Optionally probes the runtime to confirm it's
 * actually alive before each heartbeat.
 *
 * Usage:
 *   MC_URL=https://mission.baselineautomations.com \
 *   MC_SESSION="<cookie value of mc-session>" \
 *   RUNTIME_NAME=openclaw-prod-1 \
 *   RUNTIME_TYPE=openclaw \
 *   RUNTIME_URL=https://keen-matsumoto-2.preview.emergentagent.com \
 *   RUNTIME_TOKEN="<gateway-token>" \
 *   RUNTIME_CAPABILITIES=browser,tool \
 *   node scripts/connect-runtime.mjs
 *
 * Exits cleanly on SIGINT. Logs each heartbeat result.
 */

const REQUIRED = ['MC_URL', 'MC_SESSION', 'RUNTIME_NAME', 'RUNTIME_TYPE']
for (const k of REQUIRED) {
  if (!process.env[k]) {
    console.error(`[connect-runtime] missing required env var: ${k}`)
    process.exit(2)
  }
}

const MC_URL = process.env.MC_URL.replace(/\/+$/, '')
const MC_SESSION_COOKIE = process.env.MC_SESSION
const RUNTIME_NAME = process.env.RUNTIME_NAME
const RUNTIME_TYPE = process.env.RUNTIME_TYPE
const RUNTIME_URL = process.env.RUNTIME_URL || null
const RUNTIME_TOKEN = process.env.RUNTIME_TOKEN || null
const CAPABILITIES = (process.env.RUNTIME_CAPABILITIES || 'execute').split(',').map((s) => s.trim()).filter(Boolean)
const HEARTBEAT_MS = parseInt(process.env.HEARTBEAT_MS || '30000', 10)

const cookieHeader = MC_SESSION_COOKIE.includes('=')
  ? MC_SESSION_COOKIE
  : `mc-session=${MC_SESSION_COOKIE}`

async function mcCall(path, init = {}) {
  const res = await fetch(`${MC_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', 'cookie': cookieHeader, ...(init.headers || {}) },
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
    process.exit(3)
  }
  agentId = body.agent.id
  console.log(`[connect-runtime] registered name=${RUNTIME_NAME} runtime_type=${body.agent.runtime_type || RUNTIME_TYPE} agent_id=${agentId} new=${body.registered}`)
}

async function heartbeat() {
  if (!agentId) return
  const probe = await probeRuntime()
  if (!probe.alive) {
    console.warn(`[connect-runtime] runtime probe failed (${JSON.stringify(probe)}) — sending heartbeat anyway so Mission Control marks stale`)
  }
  const { status, body } = await mcCall(`/api/agents/${agentId}/heartbeat`, { method: 'GET' })
  if (status !== 200) {
    console.error(`[connect-runtime] heartbeat failed: ${status}`, body)
    if (status === 401 || status === 403) {
      console.error('[connect-runtime] session expired — re-login on Mission Control and update MC_SESSION')
      process.exit(4)
    }
  } else {
    console.log(`[connect-runtime] heartbeat ok @ ${new Date().toISOString()}  probe=${probe.alive ? 'alive' : 'down'}`)
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
  console.log(`[connect-runtime] heartbeating every ${HEARTBEAT_MS}ms — Ctrl+C to stop`)
})().catch((err) => {
  console.error('[connect-runtime] fatal:', err)
  process.exit(1)
})
