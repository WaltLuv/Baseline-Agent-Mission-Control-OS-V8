/**
 * Regression test for the /flight-deck public download page.
 *
 * The contract evolved from a hard-coded `releaseStatus` / `releaseUrl`
 * pair to a **manifest-driven** model: the page fetches
 * `/api/flight-deck/manifest` at runtime and renders each artifact's
 * status (`available` | `pending-build` | `unsupported`) independently.
 *
 * What we still guarantee — and what this test pins:
 *   • A canonical version label exists (`FLIGHT_DECK_VERSION`).
 *   • The `Artifact` type carries the three statuses the UI branches on.
 *   • Every platform card has a stable test id (`platform-${platform}`)
 *     and a copy-paste local-build command (`platform-${platform}-build`).
 *   • macOS / Windows / Linux build commands are wired through
 *     `BUILD_COMMANDS`.
 *   • Download anchors render ONLY when an artifact is `available` AND
 *     has a non-null `download_url` — i.e. the page can never show a
 *     dishonest "Download" button against missing binaries.
 *   • Pending artifacts surface a `pending-${platform}-${arch}-${type}`
 *     stub so the operator sees the honest state.
 *   • Manifest summary banner has a stable test id
 *     (`flight-deck-artifact-status`).
 *   • The GitHub Actions tagging workflow is documented inline.
 */
import { readFileSync } from 'fs'
import { describe, it, expect } from 'vitest'

const src = readFileSync('src/app/flight-deck/page.tsx', 'utf8')

describe('flight-deck — manifest-driven download page', () => {
  it('declares a canonical FLIGHT_DECK_VERSION constant', () => {
    expect(src).toMatch(/FLIGHT_DECK_VERSION\s*=\s*'v0\.1\.0'/)
  })

  it('models the three artifact statuses the UI branches on', () => {
    expect(src).toMatch(
      /type\s+ArtifactStatus\s*=\s*'available'\s*\|\s*'pending-build'\s*\|\s*'unsupported'/,
    )
  })

  it('models the Artifact shape returned by the manifest API', () => {
    expect(src).toMatch(/type\s+Artifact\s*=\s*{/)
    expect(src).toMatch(/download_url:\s*string\s*\|\s*null/)
    expect(src).toMatch(/status:\s*ArtifactStatus/)
  })

  it('renders the manifest status banner with a stable test id', () => {
    expect(src).toContain('flight-deck-artifact-status')
  })

  it('renders a platform card test id for every grouped platform', () => {
    // `data-testid={`platform-${platform}`}` is rendered inside the
    // `Object.entries(groups)` loop — the literal template must exist.
    expect(src).toContain('platform-${platform}')
  })

  it('renders a local build CopyBlock per platform', () => {
    expect(src).toContain('platform-${platform}-build')
  })

  it('wires build commands for macOS, Windows, and Linux', () => {
    expect(src).toMatch(/macos:\s*'cd desktop[^']*tauri:build:mac'/)
    expect(src).toMatch(/windows:\s*'cd desktop[^']*tauri:build:win'/)
    expect(src).toMatch(/linux:\s*'cd desktop[^']*tauri:build:linux'/)
  })

  it('only renders a Download anchor when an artifact is available AND has a URL', () => {
    // The truthy-and-double guard `a.status === 'available' && a.download_url`
    // is the single source of honesty for live download buttons.
    expect(src).toMatch(
      /a\.status\s*===\s*'available'\s*&&\s*a\.download_url/,
    )
    // …and the anchor's href reads from the artifact's signed manifest URL.
    expect(src).toMatch(/href={a\.download_url}/)
  })

  it('surfaces a "CI build pending" stub for unavailable artifacts', () => {
    expect(src).toContain('CI build pending')
    // pending-${platform}-${arch}-${file_type}
    expect(src).toContain('pending-${a.platform}-${a.arch}-${a.file_type}')
  })

  it('documents the GitHub Actions release-tag workflow', () => {
    // Pinning both the tag command and the workflow file path.
    expect(src).toContain('flight-deck-')
    expect(src).toContain('flight-deck-release.yml')
  })
})
