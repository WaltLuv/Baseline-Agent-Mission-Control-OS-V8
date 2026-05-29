// Lightweight unit tests for the Flight Deck shell allowlist. Pure
// node — no Tauri runtime needed. Runs in the root vitest suite via
// the workspace tsconfig.

import { describe, it, expect } from 'vitest'
import { isAllowedUrl, activeUrl, MODES, ALLOWED_HOSTS } from '../src/allowlist.js'

describe('Flight Deck — URL allowlist', () => {
  it('accepts the three default modes', () => {
    expect(isAllowedUrl(MODES.production)).toBe(true)
    expect(isAllowedUrl(MODES.staging)).toBe(true)
    expect(isAllowedUrl(MODES.localhost)).toBe(true)
  })

  it('rejects non-allowlisted https hosts', () => {
    expect(isAllowedUrl('https://attacker.example.com')).toBe(false)
    expect(isAllowedUrl('https://github.com')).toBe(false)
  })

  it('rejects non-http(s) protocols', () => {
    expect(isAllowedUrl('file:///etc/passwd')).toBe(false)
    expect(isAllowedUrl('javascript:alert(1)')).toBe(false)
    expect(isAllowedUrl('ftp://mission.baselineautomations.com')).toBe(false)
  })

  it('only allows http for loopback', () => {
    expect(isAllowedUrl('http://127.0.0.1:3000')).toBe(true)
    expect(isAllowedUrl('http://localhost:3000')).toBe(true)
    expect(isAllowedUrl('http://mission.baselineautomations.com')).toBe(false)
  })

  it('rejects malformed input', () => {
    expect(isAllowedUrl('')).toBe(false)
    expect(isAllowedUrl('not-a-url')).toBe(false)
    expect(isAllowedUrl('https://')).toBe(false)
  })

  it('ALLOWED_HOSTS does NOT include arbitrary preview-host wildcards', () => {
    // We allow the specific preview host we use for staging — not all
    // of *.preview.emergentagent.com. CSP allows a wider net for assets,
    // but the navigation allowlist is the strict gate.
    expect(ALLOWED_HOSTS.has('token-monetization.preview.emergentagent.com')).toBe(true)
    expect(ALLOWED_HOSTS.has('preview.emergentagent.com')).toBe(false)
  })

  it('activeUrl prefers a saved custom URL when it is allowlisted', () => {
    expect(activeUrl({ mode: 'production', customUrl: '' })).toBe(MODES.production)
    expect(activeUrl({ mode: 'production', customUrl: 'https://mission.baselineautomations.com' })).toBe('https://mission.baselineautomations.com')
    // Disallowed custom URL falls back to the mode default
    expect(activeUrl({ mode: 'staging', customUrl: 'https://attacker.example.com' })).toBe(MODES.staging)
  })
})
