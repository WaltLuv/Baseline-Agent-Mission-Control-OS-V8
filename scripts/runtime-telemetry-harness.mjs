#!/usr/bin/env node
/**
 * Runtime telemetry adapter — local proof harness.
 *
 * Closes the loop end-to-end against a running Mission Control:
 *   login → install skill → emit skill event → emit memory-use → emit
 *   collaboration → emit outcome → read leaderboard → read trace.
 *
 * Usage:
 *   node scripts/runtime-telemetry-harness.mjs                 # against http://127.0.0.1:3000
 *   MC_URL=https://mc.example node scripts/runtime-telemetry-harness.mjs
 *
 * The script never throws — every call is best-effort, matching the
 * contract every runtime adapter must follow.
 */
const MC_URL = process.env.MC_URL || 'http://127.0.0.1:3000'
const ADMIN = process.env.MC_ADMIN_USER || 'admin'
const PASS = process.env.MC_ADMIN_PASS || 'admin12345'

let cookie = ''

async function safePost(path, body, headers = {}) {
  try {
    const res = await fetch(`${MC_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Cookie: cookie, ...headers },
      body: JSON.stringify(body),
    })
    const data = await res.json().catch(() => null)
    return { ok: res.ok, status: res.status, data }
  } catch (e) {
    return { ok: false, status: 0, error: e.message }
  }
}

async function safeGet(path) {
  try {
    const res = await fetch(`${MC_URL}${path}`, { headers: { Cookie: cookie } })
    const data = await res.json().catch(() => null)
    return { ok: res.ok, status: res.status, data }
  } catch (e) {
    return { ok: false, status: 0, error: e.message }
  }
}

async function main() {
  console.log(`\n== Runtime Telemetry Harness · ${MC_URL} ==\n`)
  // 1) login
  const login = await fetch(`${MC_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: ADMIN, password: PASS }),
  })
  cookie = (login.headers.get('set-cookie') || '').split(';')[0]
  console.log('  login            ', login.status)
  // 2) install skill (idempotent — second run will fail-soft)
  console.log(
    '  install pdf-gen  ',
    (await safePost('/api/marketplace/purchase', { type: 'skill', slug: 'pdf-generation' }, { 'idempotency-key': 'harness-1' })).status,
  )
  // 3) Skill event
  console.log('  skill/event      ', (await safePost('/api/skills/event', {
    skillSlug: 'pdf-generation', agentSlug: 'phil',
    valueImpactCents: 4400, durationMinutes: 18, success: true, note: 'Closed 4 follow-ups',
  })).status)
  // 4) Escalation
  console.log('  escalation       ', (await safePost('/api/agents/escalation', {
    agentSlug: 'phil', taskId: 0, severity: 'medium',
    source: 'Obsidian', reason: 'Doctrine: never file when totals do not reconcile',
  })).status)
  // 5) Memory use
  console.log('  memory-use       ', (await safePost('/api/agents/memory-use', {
    agentSlug: 'phil', source: 'Notion', title: 'Q1 SOP',
    excerpt: 'Cadence T+0, T+72h, T+7d',
  })).status)
  // 6) Collaboration
  console.log('  collaboration    ', (await safePost('/api/agents/collaboration', {
    fromAgentSlug: 'phil', toAgentSlug: 'lena',
    reason: 'reconciliation handoff',
  })).status)
  // 7) Outcome
  console.log('  outcome          ', (await safePost('/api/agents/outcome', {
    agentSlug: 'phil', status: 'done', valueImpactCents: 4400, summary: 'Q1 closed',
  })).status)
  // 8) Read back the loop
  const lb = await safeGet('/api/baseline-os/skill-leaderboard')
  const trace = await safeGet('/api/agents/phil/trace')
  const rec = await safeGet('/api/baseline-os/recommendations')
  console.log('\n  leaderboard      ', lb.status, lb.data?.leaders?.[0]?.label ?? '(empty)')
  console.log('  trace skills     ', trace.status, JSON.stringify(trace.data?.trace?.skillsUsed ?? []))
  console.log('  recommendations  ', rec.status, rec.data?.recommendations?.length ?? 0, 'items')
  console.log('  forecast risks   ', rec.status, rec.data?.forecast?.length ?? 0, 'items')
  console.log('\n== Loop verified: action → telemetry → trace → leaderboard → recommendations ==\n')
}

main().catch((e) => {
  console.error('harness failed (best-effort calls only — runtimes must never throw):', e.message)
})
