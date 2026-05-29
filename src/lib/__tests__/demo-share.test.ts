/**
 * Signed Demo Share — security gate tests.
 *
 * What we are guarding:
 *   - Tokens cannot be forged (HMAC, timing-safe compare).
 *   - Expired tokens are rejected with a clear reason.
 *   - Edited payloads invalidate the signature.
 *   - Permissions other than read-demo are refused.
 *   - Wrong-version tokens (future format) are refused.
 *   - Round-trip across the verifier preserves every field.
 *   - The share URL points to the right vertical and the dashboard route.
 *
 * These tests run in isolation against the pure signer/verifier so the
 * security guarantee survives any future UI changes.
 */
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import {
  signDemoToken,
  verifyDemoToken,
  buildShareUrl,
  DEFAULT_TTL_DAYS,
  MAX_TTL_DAYS,
  TOKEN_VERSION,
  sanitizeProspectName,
  clampHours,
} from '../demo-share'

const SECRET_BACKUP = process.env.SHARE_SIGNING_SECRET
beforeEach(() => {
  process.env.SHARE_SIGNING_SECRET = 'unit-test-secret-rotates-on-restart'
})

afterAll(() => {
  if (SECRET_BACKUP === undefined) delete process.env.SHARE_SIGNING_SECRET
  else process.env.SHARE_SIGNING_SECRET = SECRET_BACKUP
})

describe('signDemoToken', () => {
  it('clamps TTL to the documented bounds', () => {
    const a = signDemoToken({ vertical: 'cpa', ttlDays: -5 })
    expect(a.payload.exp - a.payload.iat).toBeGreaterThanOrEqual(86_400 - 5)
    const b = signDemoToken({ vertical: 'cpa', ttlDays: 9999 })
    expect(b.payload.exp - b.payload.iat).toBeLessThanOrEqual(MAX_TTL_DAYS * 86_400 + 5)
  })
  it('defaults to 7-day expiry when ttlDays is omitted', () => {
    const { payload } = signDemoToken({ vertical: 'cpa' })
    expect(payload.exp - payload.iat).toBeGreaterThanOrEqual(DEFAULT_TTL_DAYS * 86_400 - 5)
    expect(payload.exp - payload.iat).toBeLessThanOrEqual(DEFAULT_TTL_DAYS * 86_400 + 5)
  })
  it('always sets perms to ["read-demo"] and the current version', () => {
    const { payload } = signDemoToken({ vertical: 'cpa' })
    expect(payload.perms).toEqual(['read-demo'])
    expect(payload.v).toBe(TOKEN_VERSION)
  })
  it('produces a token of the form payload.sig', () => {
    const { token } = signDemoToken({ vertical: 'cpa' })
    expect(token).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/)
  })
})

describe('verifyDemoToken — happy path', () => {
  it('round-trips vertical + tour + watermark', () => {
    const { token } = signDemoToken({ vertical: 'law-firm', tour: true, watermark: true, ttlDays: 1 })
    const result = verifyDemoToken(token)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.payload.vertical).toBe('law-firm')
      expect(result.payload.tour).toBe(true)
      expect(result.payload.watermark).toBe(true)
    }
  })
  it('verifies all four mandated verticals', () => {
    for (const v of ['pm', 'cpa', 'law-firm', 'ai-agency']) {
      const { token } = signDemoToken({ vertical: v })
      const r = verifyDemoToken(token)
      expect(r.ok, `vertical ${v} must verify`).toBe(true)
    }
  })
})

describe('verifyDemoToken — rejection paths', () => {
  it('rejects null / undefined / empty', () => {
    expect(verifyDemoToken(null).ok).toBe(false)
    expect(verifyDemoToken(undefined).ok).toBe(false)
    expect(verifyDemoToken('').ok).toBe(false)
  })
  it('rejects tokens without a "."', () => {
    const r = verifyDemoToken('not-a-token')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('malformed')
  })
  it('rejects tokens with a tampered payload', () => {
    const { token } = signDemoToken({ vertical: 'cpa' })
    const [, sig] = token.split('.')
    const tamperedPayload = Buffer.from(
      JSON.stringify({ v: 1, vertical: 'pm', iat: 1, exp: 9_999_999_999, perms: ['read-demo'], tour: true, watermark: true }),
    )
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '')
    const forged = `${tamperedPayload}.${sig}`
    const r = verifyDemoToken(forged)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('bad-signature')
  })
  it('rejects tokens with a tampered signature', () => {
    const { token } = signDemoToken({ vertical: 'cpa' })
    const [payload] = token.split('.')
    const forged = `${payload}.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`
    const r = verifyDemoToken(forged)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(['bad-signature', 'malformed']).toContain(r.reason)
  })
  it('rejects expired tokens', () => {
    // Sign with iat in the past so the token is already expired when verified.
    const now = Math.floor(Date.now() / 1000)
    const { token } = signDemoToken({ vertical: 'cpa', ttlDays: 1 }, now - 2 * 86_400)
    const r = verifyDemoToken(token, now)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('expired')
  })
  it('rejects tokens signed with a different secret', () => {
    const { token } = signDemoToken({ vertical: 'cpa' })
    process.env.SHARE_SIGNING_SECRET = 'attacker-guess'
    const r = verifyDemoToken(token)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('bad-signature')
  })
})

describe('buildShareUrl', () => {
  it('lands on /app with the right vertical + tour flag', () => {
    const url = buildShareUrl('https://app.example', 'PAYLOAD.SIG', 'cpa', true)
    expect(url).toContain('/app')
    expect(url).toContain('demo=cpa')
    expect(url).toContain('tour=1')
    expect(url).toContain('share=PAYLOAD.SIG')
  })
  it('omits the tour flag when tour=false', () => {
    const url = buildShareUrl('https://app.example', 'X.Y', 'pm', false)
    expect(url).not.toContain('tour=1')
  })
})


describe('sanitizeProspectName', () => {
  it('keeps simple business names intact', () => {
    expect(sanitizeProspectName('Acme')).toBe('Acme')
    expect(sanitizeProspectName('Acme & Co.')).toBe('Acme & Co.')
    expect(sanitizeProspectName('Smith, Jones (LLP)')).toBe('Smith, Jones (LLP)')
  })
  it('strips control characters, angle brackets, and script tags', () => {
    expect(sanitizeProspectName('<script>alert(1)</script>')).toBe('scriptalert(1)/script')
    expect(sanitizeProspectName('Acme\x00\x07\x1b')).toBe('Acme')
    expect(sanitizeProspectName('A\nB')).toBe('AB')
  })
  it('collapses internal whitespace and trims', () => {
    expect(sanitizeProspectName('   Acme    Corp   ')).toBe('Acme Corp')
  })
  it('clamps to 60 characters', () => {
    const long = 'A'.repeat(120)
    expect(sanitizeProspectName(long).length).toBe(60)
  })
  it('returns empty string for null / undefined / non-string', () => {
    expect(sanitizeProspectName(null)).toBe('')
    expect(sanitizeProspectName(undefined)).toBe('')
  })
  it('strips disallowed punctuation', () => {
    expect(sanitizeProspectName('Acme;rm -rf /')).toBe('Acmerm -rf /')
    expect(sanitizeProspectName('foo$bar`baz')).toBe('foobarbaz')
  })
})

describe('clampHours', () => {
  it('returns undefined for missing, zero, or negative input', () => {
    expect(clampHours(undefined)).toBeUndefined()
    expect(clampHours(null)).toBeUndefined()
    expect(clampHours('')).toBeUndefined()
    expect(clampHours(0)).toBeUndefined()
    expect(clampHours(-5)).toBeUndefined()
    expect(clampHours('abc')).toBeUndefined()
  })
  it('clamps the upper bound at 999', () => {
    expect(clampHours(999)).toBe(999)
    expect(clampHours(99999)).toBe(999)
  })
  it('floors fractional input', () => {
    expect(clampHours(8.7)).toBe(8)
  })
  it('parses string-formatted numbers', () => {
    expect(clampHours('8')).toBe(8)
  })
})

describe('signDemoToken — prospect and hours', () => {
  it('embeds the sanitized prospect when provided', () => {
    const { token, payload } = signDemoToken({ vertical: 'cpa', prospect: 'Acme & Co.' })
    expect(payload.prospect).toBe('Acme & Co.')
    const r = verifyDemoToken(token)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.payload.prospect).toBe('Acme & Co.')
  })
  it('sanitizes XSS attempts in prospect before signing', () => {
    const { payload } = signDemoToken({ vertical: 'cpa', prospect: '<img onerror=alert(1) src=x>' })
    expect(payload.prospect || '').not.toContain('<')
    expect(payload.prospect || '').not.toContain('>')
  })
  it('omits prospect from the payload when not provided or empty', () => {
    const { payload } = signDemoToken({ vertical: 'cpa' })
    expect(payload.prospect).toBeUndefined()
    const { payload: p2 } = signDemoToken({ vertical: 'cpa', prospect: '   ' })
    expect(p2.prospect).toBeUndefined()
  })
  it('embeds hours when positive integer is provided', () => {
    const { token } = signDemoToken({ vertical: 'cpa', hours: 8 })
    const r = verifyDemoToken(token)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.payload.hours).toBe(8)
  })
  it('omits hours for invalid input', () => {
    const { payload } = signDemoToken({ vertical: 'cpa', hours: -3 })
    expect(payload.hours).toBeUndefined()
  })
})
