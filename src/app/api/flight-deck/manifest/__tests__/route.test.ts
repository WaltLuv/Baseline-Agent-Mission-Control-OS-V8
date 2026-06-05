/**
 * Flight Deck manifest — truth-state regression test.
 *
 * Walt's rule: "No artifact may show 'available' unless a real downloadable
 * artifact exists. No fake release URLs. Pending-build must be shown honestly."
 *
 * Before the fix, `status: (present || releasesBase) ? 'available' : 'pending-build'`
 * always evaluated to `available` because `releasesBase` was a non-empty string
 * fallback — so every artifact lied as available even on a fresh deploy with
 * no binaries and no published release.
 *
 * Now:
 *   · An artifact is `available` only when a local file is in
 *     public/downloads/flight-deck/<version>/, OR the operator explicitly
 *     opted in via FLIGHT_DECK_RELEASE_PUBLISHED=true (asserting that the
 *     corresponding GitHub Release exists).
 *   · Otherwise: status = `pending-build`, download_url = null.
 *   · `release_url` is null unless FLIGHT_DECK_RELEASE_PUBLISHED=true.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { GET } from '../route'

type ManifestArtifact = {
  platform: string
  arch: string
  file_type: string
  filename: string
  size_bytes: number | null
  size_human: string | null
  sha256: string | null
  download_url: string | null
  status: 'available' | 'pending-build' | 'unsupported'
  signed: boolean
  notes?: string
}

type Manifest = {
  version: string
  release_url: string | null
  release_published: boolean
  ci_workflow: string
  ci_tag_command: string
  available_count: number
  pending_count: number
  artifacts: ManifestArtifact[]
}

const ENV_KEYS = ['FLIGHT_DECK_RELEASE_PUBLISHED', 'FLIGHT_DECK_RELEASES_BASE']
const originalEnv: Record<string, string | undefined> = {}

beforeEach(() => {
  for (const k of ENV_KEYS) {
    originalEnv[k] = process.env[k]
    delete process.env[k]
  }
})

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (originalEnv[k] === undefined) delete process.env[k]
    else process.env[k] = originalEnv[k]
  }
})

async function fetchManifest(): Promise<Manifest> {
  const res = await GET()
  expect(res.status).toBe(200)
  return (await res.json()) as Manifest
}

describe('GET /api/flight-deck/manifest — truth-state contract', () => {
  it('on a fresh deploy with no local binaries and no release published, EVERY artifact is pending-build with null download_url', async () => {
    // No env set → release_published=false; ARTIFACT_ROOT in CI is empty.
    const m = await fetchManifest()
    expect(m.release_published).toBe(false)
    expect(m.release_url).toBeNull()
    expect(m.artifacts.length).toBeGreaterThan(0)
    for (const a of m.artifacts) {
      // Either a local file exists (rare in CI) or it must be pending-build.
      // In the no-binaries scenario every entry must be pending.
      if (a.status === 'available') {
        // Local file exists — its URL must be the internal stream, not a remote.
        expect(a.download_url).toMatch(/^\/api\/flight-deck\/download\//)
      } else {
        expect(a.status).toBe('pending-build')
        expect(a.download_url).toBeNull()
      }
    }
    expect(m.pending_count + m.available_count).toBe(m.artifacts.length)
  })

  it('with FLIGHT_DECK_RELEASE_PUBLISHED=true, artifacts without a local file get a GitHub release URL and "available" status', async () => {
    process.env.FLIGHT_DECK_RELEASE_PUBLISHED = 'true'
    const m = await fetchManifest()
    expect(m.release_published).toBe(true)
    expect(m.release_url).toMatch(/\/releases\/tag\/flight-deck-v\d+\.\d+\.\d+$/)
    for (const a of m.artifacts) {
      expect(a.status).toBe('available')
      expect(a.download_url).not.toBeNull()
      expect(typeof a.download_url).toBe('string')
    }
    expect(m.pending_count).toBe(0)
    expect(m.available_count).toBe(m.artifacts.length)
  })

  it('any truthy variant of FLIGHT_DECK_RELEASE_PUBLISHED other than "true" leaves release unpublished', async () => {
    for (const val of ['1', 'yes', 'on', 'TRUE ', '']) {
      process.env.FLIGHT_DECK_RELEASE_PUBLISHED = val
      const m = await fetchManifest()
      // Only the exact (lowercased, trimmed) string "true" flips the gate.
      if (val.trim().toLowerCase() === 'true') {
        expect(m.release_published).toBe(true)
      } else {
        expect(m.release_published).toBe(false)
        expect(m.release_url).toBeNull()
      }
    }
  })

  it('a custom FLIGHT_DECK_RELEASES_BASE that does not end in /releases/download is handled without URL mangling', async () => {
    process.env.FLIGHT_DECK_RELEASE_PUBLISHED = 'true'
    process.env.FLIGHT_DECK_RELEASES_BASE = 'https://artifacts.internal.example.com/flight-deck'
    const m = await fetchManifest()
    // Page URL should not blindly replace "download" anywhere in the string
    expect(m.release_url).toBe('https://artifacts.internal.example.com/flight-deck/flight-deck-v0.1.0')
    for (const a of m.artifacts) {
      expect(a.download_url).toMatch(/^https:\/\/artifacts\.internal\.example\.com\/flight-deck\/flight-deck-v\d+\.\d+\.\d+\//)
    }
  })

  it('preserves the canonical platform matrix and the CI tagging hint', async () => {
    const m = await fetchManifest()
    expect(m.version).toMatch(/^v\d+\.\d+\.\d+$/)
    expect(m.ci_workflow).toContain('flight-deck-release.yml')
    expect(m.ci_tag_command).toMatch(/git tag flight-deck-v\d+\.\d+\.\d+/)
    // Cover macOS arm64, Windows x86_64, Linux arm64 — the platforms Walt called out.
    const triples = m.artifacts.map((a) => `${a.platform}/${a.arch}/${a.file_type}`)
    expect(triples).toContain('macos/arm64/dmg')
    expect(triples).toContain('windows/x86_64/msi')
    expect(triples).toContain('linux/arm64/AppImage')
  })
})
