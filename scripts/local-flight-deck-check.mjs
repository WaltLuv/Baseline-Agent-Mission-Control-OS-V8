#!/usr/bin/env node
// ──────────────────────────────────────────────────────────────────────
// local-flight-deck-check.mjs
//
// Quick local readiness probe for a developer who just cloned the repo
// and wants to run Flight Deck against a local Mission Control.
//
// Usage:
//   node scripts/local-flight-deck-check.mjs              # checks http://localhost:3000
//   node scripts/local-flight-deck-check.mjs --port 3001  # checks http://localhost:3001
//   node scripts/local-flight-deck-check.mjs --url http://127.0.0.1:3000
//
// Exits 0 if Mission Control is reachable and serving the expected
// endpoints. Exits non-zero with a concrete remediation hint otherwise.
// No deps — uses node:http + Node 22's fetch.
// ──────────────────────────────────────────────────────────────────────

const args = new Map()
for (let i = 2; i < process.argv.length; i += 2) {
  const key = process.argv[i]?.replace(/^--/, '')
  const val = process.argv[i + 1]
  if (key && val) args.set(key, val)
}

const port = args.get('port') || '3000'
const url = args.get('url') || `http://localhost:${port}`

const PASS = '\x1b[32m✓\x1b[0m'
const FAIL = '\x1b[31m✗\x1b[0m'
const WARN = '\x1b[33m⚠\x1b[0m'
const DIM  = '\x1b[2m'
const RST  = '\x1b[0m'

let failed = 0
let warned = 0

function ok(msg)   { console.log(`${PASS} ${msg}`) }
function err(msg, hint) {
  failed++
  console.log(`${FAIL} ${msg}`)
  if (hint) console.log(`  ${DIM}→ ${hint}${RST}`)
}
function warn(msg, hint) {
  warned++
  console.log(`${WARN} ${msg}`)
  if (hint) console.log(`  ${DIM}→ ${hint}${RST}`)
}

console.log(`\n${DIM}Flight Deck local readiness — checking ${url}${RST}\n`)

async function probe(path, opts = {}) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 4000)
  try {
    const r = await fetch(url + path, { signal: ctrl.signal, ...opts })
    return { ok: r.ok, status: r.status, json: await r.json().catch(() => null) }
  } catch (e) {
    return { ok: false, status: 0, error: e?.message || String(e) }
  } finally {
    clearTimeout(t)
  }
}

// ── 1. Server is up
const root = await probe('/')
if (root.status === 0) {
  err(
    `Mission Control unreachable at ${url}`,
    `Start it in another terminal: \`pnpm dev\` (default port 3000). ` +
    `If using a different port: \`node scripts/local-flight-deck-check.mjs --port <PORT>\`.`,
  )
  console.log()
  process.exit(1)
}
ok(`Mission Control responds (HTTP ${root.status})`)

// ── 2. Health endpoint
const health = await probe('/api/status?action=health')
if (!health.ok) {
  err(
    `Health endpoint /api/status returned HTTP ${health.status}`,
    `If you see 403, your hostname isn't in MC_ALLOWED_HOSTS. ` +
    `Add 'localhost,127.0.0.1' to MC_ALLOWED_HOSTS in .env and restart the server.`,
  )
} else if (health.json?.status === 'healthy') {
  ok(`Health endpoint reports "healthy"`)
} else {
  warn(
    `Health endpoint reports "${health.json?.status || 'unknown'}"`,
    `Server is up but degraded. Check supervisor / dev log.`,
  )
}

// ── 3. Runtime registry endpoint
const runtimes = await probe('/api/agent-runtimes')
if (runtimes.status === 401 || runtimes.status === 403) {
  warn(
    `Runtime registry /api/agent-runtimes requires login (HTTP ${runtimes.status})`,
    `That's expected when no session cookie is set. From Flight Deck, click "Open Mission Control", sign in, then click "Refresh".`,
  )
} else if (!runtimes.ok) {
  err(
    `Runtime registry /api/agent-runtimes returned HTTP ${runtimes.status}`,
    `If the response is HTML rather than JSON, your dev server may not be ready yet. Try again in 5 seconds.`,
  )
} else {
  const count = runtimes.json?.runtimes?.length || 0
  const registered = runtimes.json?.registered?.length || 0
  ok(`Runtime registry serves ${count} known runtime${count === 1 ? '' : 's'}, ${registered} registered`)
}

// ── 4. Login page exists
const login = await probe('/login')
if (!login.ok) {
  warn(`/login page returned HTTP ${login.status}`, `Login may be temporarily unavailable.`)
} else {
  ok(`Login page reachable`)
}

console.log()
if (failed > 0) {
  console.log(`${FAIL} ${failed} check${failed === 1 ? '' : 's'} failed. Fix the above before running Flight Deck.`)
  process.exit(1)
}
if (warned > 0) {
  console.log(`${WARN} Ready with ${warned} expected warning${warned === 1 ? '' : 's'}.`)
  console.log(`${DIM}Next: \`cd desktop && yarn install && yarn tauri:dev\`, then pick the Localhost preset.${RST}\n`)
  process.exit(0)
}
console.log(`${PASS} All checks passed. Flight Deck can connect to ${url}.`)
console.log(`${DIM}Next: \`cd desktop && yarn install && yarn tauri:dev\`, then pick the Localhost preset.${RST}\n`)
