import { describe, expect, it } from 'vitest'
import { buildMissionControlCsp, buildNonceRequestHeaders } from '@/lib/csp'

describe('buildMissionControlCsp', () => {
  it('includes the request nonce in script and style directives', () => {
    const csp = buildMissionControlCsp({ nonce: 'nonce-123', googleEnabled: false })

    expect(csp).toContain(`script-src 'self' 'nonce-nonce-123' 'strict-dynamic'`)
    expect(csp).toContain("style-src 'self' 'unsafe-inline'")
    expect(csp).toContain("style-src-elem 'self' 'unsafe-inline'")
    expect(csp).toContain("style-src-attr 'unsafe-inline'")
  })

  it('does NOT leak Google origins when GSI is disabled', () => {
    const csp = buildMissionControlCsp({ nonce: 'n', googleEnabled: false })
    expect(csp).not.toContain('accounts.google.com')
    expect(csp).not.toContain('googleusercontent.com')
  })

  it('grants ALL surfaces Google Identity Services needs when enabled', () => {
    const csp = buildMissionControlCsp({ nonce: 'n', googleEnabled: true })
    // script + frame + connect + img surfaces already worked. The missing
    // one that triggered "[GSI_LOGGER]: Check credential status returns
    // invalid response" was style-src-elem: the GSI prompt stylesheet
    // could not load. This test pins that fix.
    expect(csp).toContain('style-src-elem')
    const styleElem = csp.split('style-src-elem')[1].split(';')[0]
    expect(styleElem).toContain('https://accounts.google.com')
    expect(csp).toMatch(/script-src[^;]*https:\/\/accounts\.google\.com/)
    expect(csp).toMatch(/style-src[^;-][^;]*https:\/\/accounts\.google\.com/)
    expect(csp).toMatch(/frame-src[^;]*https:\/\/accounts\.google\.com/)
    expect(csp).toMatch(/connect-src[^;]*https:\/\/accounts\.google\.com/)
    expect(csp).toContain('https://*.googleusercontent.com')
  })
})

describe('buildNonceRequestHeaders', () => {
  it('propagates nonce and CSP into request headers for Next.js rendering', () => {
    const headers = buildNonceRequestHeaders({
      headers: new Headers({ host: 'localhost:3000' }),
      nonce: 'nonce-123',
      googleEnabled: false,
    })

    expect(headers.get('x-nonce')).toBe('nonce-123')
    expect(headers.get('Content-Security-Policy')).toContain("style-src 'self' 'unsafe-inline'")
  })
})
