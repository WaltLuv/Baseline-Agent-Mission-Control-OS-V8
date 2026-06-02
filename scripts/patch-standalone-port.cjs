#!/usr/bin/env node
/**
 * patch-standalone-port.cjs — Mission Control post-build patch.
 *
 * WHY THIS EXISTS
 * ────────────────────────────────────────────────────────────────────────
 * Emergent's deployment pipeline routes Cloudflare → Kubernetes service →
 * container on container port **8080**. Their Dockerfile template attempts
 * to coerce the Next.js standalone server to listen on 8080 via a build-
 * step `sed -i` chain, but those patterns are version-sensitive and DO NOT
 * MATCH the line format that current Next.js (16.1.x) generates. The
 * patches no-op silently, the container ends up listening on 3000, the
 * ingress probes 8080, gets nothing, returns 520, and the health check
 * fails.
 *
 * WHAT THIS DOES
 * ────────────────────────────────────────────────────────────────────────
 * After `next build`, we own the produced `.next/standalone/server.js`.
 * This script unconditionally rewrites the port-resolution line so the
 * default (when no PORT env var is set) becomes **8080** instead of 3000.
 * If PORT *is* set in the environment, we still honour it — preview pods
 * pass PORT=3000 via supervisor and continue to work locally.
 *
 * The script is idempotent — running it twice produces the same file.
 * It exits 0 even when the standalone output is missing, so it never
 * breaks a non-standalone build.
 */
'use strict'

const fs = require('node:fs')
const path = require('node:path')

const SERVER_JS = path.resolve(__dirname, '..', '.next', 'standalone', 'server.js')
const DEFAULT_PORT = process.env.MC_PROD_PORT || '8080'

function patch() {
  if (!fs.existsSync(SERVER_JS)) {
    console.log(`[patch-standalone-port] skip — ${SERVER_JS} not present (non-standalone build).`)
    return
  }

  const original = fs.readFileSync(SERVER_JS, 'utf8')

  // Replace ANY form of the currentPort assignment. Next.js 16.1.x emits:
  //   const currentPort = parseInt(process.env.PORT, 10) || 3000
  // Older Next versions emitted:
  //   const currentPort = process.env.PORT || 3000
  // We normalise both into a port resolver that defaults to 8080 while
  // still respecting an explicit PORT env override.
  const replacement = `const currentPort = parseInt(process.env.PORT, 10) || ${DEFAULT_PORT}`

  let patched = original.replace(
    /const\s+currentPort\s*=\s*[^\n]+/m,
    replacement,
  )

  if (patched === original) {
    console.warn('[patch-standalone-port] warning — no `const currentPort = ...` line found; nothing changed.')
    return
  }

  // Also align hostname so the server binds on every interface even when
  // HOSTNAME env is missing. Emergent's pod template does set HOSTNAME,
  // but defensive default matches the documented Next standalone contract.
  patched = patched.replace(
    /const\s+hostname\s*=\s*process\.env\.HOSTNAME\s*\|\|\s*['"][^'"]+['"]/m,
    "const hostname = process.env.HOSTNAME || '0.0.0.0'",
  )

  fs.writeFileSync(SERVER_JS, patched, 'utf8')
  console.log(`[patch-standalone-port] ok — default port set to ${DEFAULT_PORT} in ${SERVER_JS}`)
}

try {
  patch()
} catch (err) {
  console.error('[patch-standalone-port] failed:', err)
  process.exit(1)
}
