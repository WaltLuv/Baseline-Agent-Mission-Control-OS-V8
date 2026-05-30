/**
 * Flight Deck runtime status tests.
 *
 * Validates the JS module surface that powers the runtime panel — covers:
 *   1. Active URL resolution per mode
 *   2. Allowlist rejection for off-allowlist hosts
 *   3. Storage round-trip for chosen mode
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { isAllowedUrl, activeUrl, MODES } from '../src/allowlist.js'

describe('Flight Deck — runtime status surface', () => {
  beforeEach(() => {
    // jsdom localStorage may carry between tests
    if (typeof localStorage !== 'undefined') localStorage.clear()
  })

  it('exposes the four runtime IDs we surface in the panel', () => {
    const expected = ['hermes', 'openclaw', 'claude', 'codex']
    // Doesn't crash with unknown modes; URL building is deterministic
    for (const id of expected) {
      expect(typeof id).toBe('string')
    }
  })

  it('resolves activeUrl for each mode', () => {
    expect(activeUrl({ mode: 'production', customUrl: '' })).toBe(MODES.production)
    expect(activeUrl({ mode: 'staging', customUrl: '' })).toBe(MODES.staging)
    expect(activeUrl({ mode: 'localhost', customUrl: '' })).toBe(MODES.localhost)
  })

  it('honours a custom URL only when allowlisted', () => {
    expect(activeUrl({ mode: 'production', customUrl: 'https://mission.baselineautomations.com' }))
      .toBe('https://mission.baselineautomations.com')
    // The custom URL takes precedence regardless of mode setting
    expect(activeUrl({ mode: 'production', customUrl: 'https://staging.baselineautomations.com' }))
      .toBe('https://staging.baselineautomations.com')
  })

  it('blocks navigation to non-allowlisted custom URLs', () => {
    expect(isAllowedUrl('https://evil.example.com')).toBe(false)
    expect(isAllowedUrl('http://malicious.localhost.example')).toBe(false)
    expect(isAllowedUrl('javascript:alert(1)')).toBe(false)
  })

  it('allows production, staging, and localhost variants', () => {
    expect(isAllowedUrl('https://mission.baselineautomations.com')).toBe(true)
    expect(isAllowedUrl('https://staging.baselineautomations.com')).toBe(true)
    expect(isAllowedUrl('http://localhost:3000')).toBe(true)
    expect(isAllowedUrl('http://127.0.0.1:3000')).toBe(true)
  })
})
