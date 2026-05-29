// ───────────────────────────────────────────────────────────────────
// Baseline Flight Deck — pure allowlist + mode helpers.
//
// Lives in its own module (no DOM access) so it can be imported by
// both the browser shell and the unit tests without pulling in the
// document object.
// ───────────────────────────────────────────────────────────────────

export const MODES = {
  production: 'https://mission.baselineautomations.com',
  staging:    'https://token-monetization.preview.emergentagent.com',
  localhost:  'http://127.0.0.1:3000',
}

// Strict allowlist. Custom URLs that don't match a host here are rejected.
export const ALLOWED_HOSTS = new Set([
  'mission.baselineautomations.com',
  'staging.baselineautomations.com',
  'token-monetization.preview.emergentagent.com',
  '127.0.0.1',
  'localhost',
])

export function isAllowedUrl(rawUrl) {
  try {
    const u = new URL(rawUrl)
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return false
    if (u.protocol === 'http:' && u.hostname !== '127.0.0.1' && u.hostname !== 'localhost') return false
    return ALLOWED_HOSTS.has(u.hostname)
  } catch { return false }
}

export function activeUrl(settings) {
  if (settings.customUrl && isAllowedUrl(settings.customUrl)) return settings.customUrl
  return MODES[settings.mode] || MODES.production
}
