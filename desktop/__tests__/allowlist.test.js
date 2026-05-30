// Lightweight unit tests for the Flight Deck shell allowlist. Pure
// node — no Tauri runtime needed. Runs in the root vitest suite via
// the workspace tsconfig.

import { describe, it, expect } from 'vitest'
import { isAllowedUrl, activeUrl, MODES, MODE_LABELS, ALLOWED_HOSTS } from '../src/allowlist.js'

describe('Flight Deck — URL allowlist', () => {
  it('accepts every non-empty default mode URL', () => {
    expect(isAllowedUrl(MODES.digitalocean)).toBe(true)
    expect(isAllowedUrl(MODES.staging)).toBe(true)
    expect(isAllowedUrl(MODES.localhost)).toBe(true)
    // emergent preset starts blank — operator fills it in via Custom URL
    expect(MODES.emergent).toBe('')
  })

  it('exposes a human label for every mode', () => {
    expect(MODE_LABELS.emergent).toBe('Emergent Production')
    expect(MODE_LABELS.digitalocean).toBe('DigitalOcean Production')
    expect(MODE_LABELS.staging).toBe('Staging / Preview')
    expect(MODE_LABELS.localhost).toBe('Localhost')
  })

  it('accepts any Emergent Deploy host via *.emergent.host wildcard', () => {
    expect(isAllowedUrl('https://walters-mc.emergent.host')).toBe(true)
    expect(isAllowedUrl('https://baseline-united-mission-control.emergent.host')).toBe(true)
    // Just the apex of the wildcard alone is OK
    expect(isAllowedUrl('https://emergent.host')).toBe(true)
  })

  it('accepts any *.emergentagent.com preview', () => {
    expect(isAllowedUrl('https://abc123.preview.emergentagent.com')).toBe(true)
    expect(isAllowedUrl('https://some-app.emergentagent.com')).toBe(true)
  })

  it('rejects non-allowlisted https hosts', () => {
    expect(isAllowedUrl('https://attacker.example.com')).toBe(false)
    expect(isAllowedUrl('https://github.com')).toBe(false)
  })

  it('rejects non-http(s) protocols', () => {
    expect(isAllowedUrl('file:///etc/passwd')).toBe(false)
    expect(isAllowedUrl('javascript:alert(1)')).toBe(false)
    expect(isAllowedUrl('ftp://baseline-agents.com')).toBe(false)
  })

  it('only allows http for loopback', () => {
    expect(isAllowedUrl('http://127.0.0.1:3000')).toBe(true)
    expect(isAllowedUrl('http://localhost:3000')).toBe(true)
    expect(isAllowedUrl('http://baseline-agents.com')).toBe(false)
  })

  it('rejects malformed input', () => {
    expect(isAllowedUrl('')).toBe(false)
    expect(isAllowedUrl('not-a-url')).toBe(false)
    expect(isAllowedUrl('https://')).toBe(false)
    expect(isAllowedUrl(null)).toBe(false)
    expect(isAllowedUrl(undefined)).toBe(false)
  })

  it('ALLOWED_HOSTS contains the canonical production hosts', () => {
    expect(ALLOWED_HOSTS.has('baseline-agents.com')).toBe(true)
    expect(ALLOWED_HOSTS.has('*.emergent.host')).toBe(true)
    expect(ALLOWED_HOSTS.has('localhost')).toBe(true)
    expect(ALLOWED_HOSTS.has('127.0.0.1')).toBe(true)
  })

  it('activeUrl returns the mode URL when no custom URL is set', () => {
    expect(activeUrl({ mode: 'digitalocean', customUrl: '' })).toBe(MODES.digitalocean)
    expect(activeUrl({ mode: 'localhost', customUrl: '' })).toBe(MODES.localhost)
  })

  it('activeUrl prefers a saved custom URL over the mode default', () => {
    expect(activeUrl({ mode: 'digitalocean', customUrl: 'https://walters-mc.emergent.host' })).toBe('https://walters-mc.emergent.host')
  })

  it('activeUrl falls back to digitalocean for unknown modes', () => {
    expect(activeUrl({ mode: 'unknown-mode', customUrl: '' })).toBe(MODES.digitalocean)
    expect(activeUrl({})).toBe(MODES.digitalocean)
    expect(activeUrl(null)).toBe(MODES.digitalocean)
  })
})
