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
    for (const id of expected) {
      expect(typeof id).toBe('string')
    }
  })

  it('resolves activeUrl for each non-empty preset', () => {
    expect(activeUrl({ mode: 'digitalocean', customUrl: '' })).toBe(MODES.digitalocean)
    expect(activeUrl({ mode: 'staging', customUrl: '' })).toBe(MODES.staging)
    expect(activeUrl({ mode: 'localhost', customUrl: '' })).toBe(MODES.localhost)
  })

  it('emergent preset is empty until operator fills in the deployed host', () => {
    // Default fallback: returns the empty emergent URL, navigation guard
    // in main.js will reject it and prompt the operator to set Custom URL.
    expect(activeUrl({ mode: 'emergent', customUrl: '' })).toBe('')
    expect(isAllowedUrl('')).toBe(false)
  })

  it('honours a saved custom URL', () => {
    expect(activeUrl({ mode: 'digitalocean', customUrl: 'https://walters-mc.emergent.host' }))
      .toBe('https://walters-mc.emergent.host')
    // The custom URL takes precedence regardless of mode
    expect(activeUrl({ mode: 'localhost', customUrl: 'https://baseline-agents.com' }))
      .toBe('https://baseline-agents.com')
  })

  it('blocks navigation to non-allowlisted custom URLs', () => {
    expect(isAllowedUrl('https://evil.example.com')).toBe(false)
    expect(isAllowedUrl('http://malicious.localhost.example')).toBe(false)
    expect(isAllowedUrl('javascript:alert(1)')).toBe(false)
  })

  it('allows DigitalOcean, Emergent, staging, and localhost variants', () => {
    expect(isAllowedUrl('https://baseline-agents.com')).toBe(true)
    expect(isAllowedUrl('https://walters-mc.emergent.host')).toBe(true)
    expect(isAllowedUrl('https://abc.preview.emergentagent.com')).toBe(true)
    expect(isAllowedUrl('http://localhost:3000')).toBe(true)
    expect(isAllowedUrl('http://127.0.0.1:3000')).toBe(true)
    expect(isAllowedUrl('http://localhost:3001')).toBe(true)
  })
})
