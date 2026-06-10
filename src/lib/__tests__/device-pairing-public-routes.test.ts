import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Regression guard for a real bug found during pairing validation: the
 * device-facing pairing endpoints are device-authed (pairing code / claim token
 * / Bearer device token), NOT session-authed — they MUST bypass the proxy's
 * session gate, or a device can never start/claim/heartbeat (every call 401s).
 * The approve / list / revoke endpoints stay session-gated.
 */
const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')

describe('Flight Deck device endpoints bypass the session gate', () => {
  const proxy = read('src/proxy.ts')

  it('pairing/start, heartbeat, and */status are public (device-authed)', () => {
    expect(proxy).toContain('isPublicDeviceEndpoint')
    expect(proxy).toContain("pathname === '/api/devices/pairing/start'")
    expect(proxy).toContain("pathname === '/api/devices/heartbeat'")
    expect(proxy).toContain("pathname.startsWith('/api/devices/') && pathname.endsWith('/status')")
  })

  it('the public bypass is wired into the allowlist condition', () => {
    expect(proxy).toMatch(/if \(isPublicDeviceEndpoint \|\|/)
  })

  it('approve / list / revoke are NOT in the public bypass (stay session-gated)', () => {
    expect(proxy).not.toContain("'/api/devices/pairing/approve'")
    expect(proxy).not.toContain("'/api/devices/' && pathname.endsWith('/revoke')")
  })
})

describe('Mission Control approval UI', () => {
  const approve = read('src/components/flight-deck/approve-device.tsx')
  const panel = read('src/components/panels/flight-deck-panel.tsx')

  it('approval form prefills the code from the ?pair= link and posts to approve', () => {
    expect(approve).toContain("get('pair')")
    expect(approve).toContain('/api/devices/pairing/approve')
    expect(approve).toContain('data-testid="approve-device-code"')
    expect(approve).toContain('data-testid="approve-device-submit"')
  })
  it('approval form offers the four device roles', () => {
    for (const r of ['owner', 'admin', 'operator', 'limited']) expect(approve).toContain(`'${r}'`)
  })
  it('is mounted in the Flight Deck panel', () => {
    expect(panel).toContain('<ApproveDevice />')
  })
})
