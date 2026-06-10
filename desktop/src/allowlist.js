// ──────────────────────────────────────────────────────────────────────
// Baseline Flight Deck — Mission Control target allowlist
//
// The set of Mission Control deployments the desktop shell is allowed
// to load. Enforced in three places that MUST stay in sync:
//
//   1. This file (frontend guard before navigation)
//   2. desktop/src-tauri/tauri.conf.json `app.security.csp`
//   3. The Mission Control server's `MC_ALLOWED_HOSTS`
//
// Adding a host here without also extending the Tauri CSP will silently
// fail at runtime — the webview will refuse to load the page.
// ──────────────────────────────────────────────────────────────────────

// Named presets surfaced in the UI. The user can also enter a custom
// URL, which must match one of the host patterns in ALLOWED_HOSTS below.
//
// `emergent` is the placeholder for the URL the operator gets back from
// "Deploy" inside Emergent. The exact subdomain is assigned at deploy
// time, so it stays empty here — the operator pastes their host into
// the Custom field once and Flight Deck remembers it.
export const MODES = {
  emergent:     '',                              // filled in by operator after Emergent Deploy
  digitalocean: 'https://baseline-agents.com',   // canonical DO production host
  staging:      'https://mission-control-v8.preview.emergentagent.com',
  localhost:    'http://localhost:3000',
}

// Human label for each preset (kept here so it can be unit-tested).
export const MODE_LABELS = {
  emergent:     'Emergent Production',
  digitalocean: 'DigitalOcean Production',
  staging:      'Staging / Preview',
  localhost:    'Localhost',
}

// Strict allowlist. Custom URLs that don't match a host here are rejected.
// Wildcards on subdomains are supported via the `*.` prefix.
export const ALLOWED_HOSTS = new Set([
  // DigitalOcean production
  'baseline-agents.com',
  'mission.baseline-agents.com',
  'www.baseline-agents.com',
  // Emergent production — operator's deployed host lands under *.emergent.host
  // or *.emergentagent.com depending on the platform mode they pick.
  '*.emergent.host',
  '*.emergentagent.com',
  '*.preview.emergentagent.com',
  // Legacy Baseline Automations hosts (kept for in-flight pilots)
  'mission.baselineautomations.com',
  'staging.baselineautomations.com',
  // Local dev
  '127.0.0.1',
  'localhost',
])

function hostMatches(pattern, host) {
  if (pattern === host) return true
  if (pattern.startsWith('*.')) {
    const suffix = pattern.slice(2)
    return host === suffix || host.endsWith('.' + suffix)
  }
  return false
}

export function isAllowedUrl(input) {
  if (typeof input !== 'string' || !input.trim()) return false
  let parsed
  try { parsed = new URL(input) } catch { return false }
  if (!['http:', 'https:'].includes(parsed.protocol)) return false
  // Force HTTPS for non-loopback hosts.
  const host = parsed.hostname
  const isLoopback = host === '127.0.0.1' || host === 'localhost'
  if (!isLoopback && parsed.protocol !== 'https:') return false
  for (const candidate of ALLOWED_HOSTS) {
    if (hostMatches(candidate, host)) return true
  }
  return false
}

// Compute the URL Flight Deck should navigate to given current settings.
// Custom URL takes precedence over preset when set. When the operator has
// picked a known preset that has no URL yet (e.g. 'emergent' until they
// paste their Emergent Deploy host), this returns '' — the caller is
// expected to treat empty as "ask the operator for a Custom URL".
export function activeUrl(settings) {
  const customUrl = (settings?.customUrl || '').trim()
  if (customUrl) return customUrl
  const mode = settings?.mode
  if (typeof mode === 'string' && Object.prototype.hasOwnProperty.call(MODES, mode)) {
    return MODES[mode]
  }
  return MODES.digitalocean
}
