/**
 * Regression test for the /flight-deck public download page.
 *
 * The contract: don't show download buttons for binaries that don't
 * exist. The single source-of-truth flag in the page module is
 * `releaseStatus`. While that says 'pending-build', the page must:
 *   • render the "Build pending" amber banner
 *   • render `flight-deck-version` + every platform card
 *   • NOT render a Download href anywhere
 *   • render the local build commands the operator needs
 *
 * This guards against accidental dishonesty when someone wants to
 * "make the buttons live" before binaries actually ship.
 */
import { readFileSync } from 'fs'
import { describe, it, expect } from 'vitest'

const src = readFileSync('src/app/flight-deck/page.tsx', 'utf8')

describe('flight-deck — public download page', () => {
  it('declares releaseStatus and releaseUrl explicitly', () => {
    expect(src).toMatch(/const\s+releaseStatus\s*:\s*'pending-build'\s*\|\s*'available'\s*=/)
    expect(src).toMatch(/const\s+releaseUrl\s*:\s*string\s*\|\s*null\s*=/)
  })

  it('starts in pending-build state (no broken download buttons)', () => {
    // Pin the safe default. When operators flip this to "available"
    // they should also set releaseUrl and re-run vitest.
    expect(src).toMatch(/releaseStatus\s*:[^=]*=\s*'pending-build'/)
    expect(src).toMatch(/releaseUrl\s*:[^=]*=\s*null/)
  })

  it('renders the "Build pending" banner test id', () => {
    expect(src).toContain('flight-deck-artifact-status')
  })

  it('declares all three platform cards with honest status', () => {
    // Platform cards use templated testids: data-testid={`platform-${p.id}`}
    // so we look for the id strings in the source platforms array.
    expect(src).toMatch(/id:\s*'macos'/)
    expect(src).toMatch(/id:\s*'windows'/)
    expect(src).toMatch(/id:\s*'linux'/)
    // The build command pre-id pattern is the literal `platform-${p.id}-build`
    expect(src).toContain('platform-${p.id}-build')
  })

  it('surfaces the GitHub Actions tagging workflow', () => {
    expect(src).toContain('flight-deck-v0.1.0')
    expect(src).toContain('flight-deck-release.yml')
  })

  it('never renders a Download anchor while binaries are pending', () => {
    // The Download <a href> only appears inside `p.status === 'available' && releaseUrl && (...)`.
    // While releaseStatus is 'pending-build', no platform should be available.
    const availableConditional = /releaseUrl\s*&&\s*\(\s*<a\s+href={releaseUrl}/
    expect(src).toMatch(availableConditional)
    // …and the JSX guard surrounding it must depend on `releaseUrl`.
    const guarded = /p\.status\s*===\s*'available'\s*&&\s*releaseUrl/
    expect(src).toMatch(guarded)
  })

  it('exposes the canonical version label', () => {
    expect(src).toMatch(/FLIGHT_DECK_VERSION\s*=\s*'v0\.1\.0'/)
  })
})
