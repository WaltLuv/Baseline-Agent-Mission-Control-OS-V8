import { NextResponse } from 'next/server'
import { existsSync, readFileSync, statSync, readdirSync } from 'node:fs'
import path from 'node:path'

// Manifest of Flight Deck release artifacts shipped from this Mission Control
// deployment. Reads the SHA256SUMS produced by either the local Tauri build
// or the GitHub Actions release workflow. Returns honest "available" /
// "pending-build" status per platform.

const FLIGHT_DECK_VERSION = 'v0.1.0'
const ARTIFACT_ROOT = path.join(process.cwd(), 'public', 'downloads', 'flight-deck')

type ArtifactStatus = 'available' | 'pending-build' | 'unsupported'

type Artifact = {
  platform: string
  arch: string
  file_type: string
  filename: string
  size_bytes: number | null
  size_human: string | null
  sha256: string | null
  download_url: string | null
  status: ArtifactStatus
  signed: boolean
  notes?: string
}

const PLATFORM_MATRIX: Array<{
  platform: string
  arch: string
  file_type: string
  filename: string
  signed: boolean
  notes?: string
}> = [
  {
    platform: 'linux',
    arch: 'arm64',
    file_type: 'deb',
    filename: 'baseline-flight-deck_0.1.0_linux-arm64.deb',
    signed: false,
    notes: 'Unsigned developer build. Install with: sudo dpkg -i <file>',
  },
  {
    platform: 'linux',
    arch: 'arm64',
    file_type: 'AppImage',
    filename: 'baseline-flight-deck_0.1.0_linux-arm64.AppImage',
    signed: false,
    notes: 'Unsigned developer build. chmod +x and run.',
  },
  {
    platform: 'linux',
    arch: 'x86_64',
    file_type: 'AppImage',
    filename: 'baseline-flight-deck_0.1.0_linux-x86_64.AppImage',
    signed: false,
    notes: 'Built by GitHub Actions on tag flight-deck-v*.',
  },
  {
    platform: 'macos',
    arch: 'arm64',
    file_type: 'dmg',
    filename: 'baseline-flight-deck_0.1.0_macos-arm64.dmg',
    signed: false,
    notes: 'Built by GitHub Actions on macos-14 runner. Unsigned unless APPLE_* secrets are configured.',
  },
  {
    platform: 'macos',
    arch: 'x86_64',
    file_type: 'dmg',
    filename: 'baseline-flight-deck_0.1.0_macos-x86_64.dmg',
    signed: false,
    notes: 'Built by GitHub Actions on macos-13 runner. Unsigned unless APPLE_* secrets are configured.',
  },
  {
    platform: 'windows',
    arch: 'x86_64',
    file_type: 'msi',
    filename: 'baseline-flight-deck_0.1.0_windows-x86_64.msi',
    signed: false,
    notes: 'Built by GitHub Actions on windows-latest runner. Unsigned unless WINDOWS_CERTIFICATE secret is configured.',
  },
]

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

function parseShaSums(versionDir: string): Record<string, string> {
  const checksumFile = path.join(versionDir, 'SHA256SUMS')
  if (!existsSync(checksumFile)) return {}
  const out: Record<string, string> = {}
  for (const line of readFileSync(checksumFile, 'utf8').split('\n')) {
    const match = line.trim().match(/^([a-f0-9]{64})\s+(.+)$/i)
    if (match) out[match[2].trim()] = match[1].toLowerCase()
  }
  return out
}

// Default releases base. Used only when the operator explicitly opts in via
// `FLIGHT_DECK_RELEASE_PUBLISHED=true` (or sets a custom `FLIGHT_DECK_RELEASES_BASE`).
const DEFAULT_RELEASES_BASE = 'https://github.com/WaltLuv/baseline-agent-os/releases/download'

function releaseTagPageUrl(releasesBase: string, releaseTag: string): string {
  // Convert the GitHub "download" URL to the human-readable release page URL,
  // without doing a substring-replace (which would mangle URLs that contain
  // 'download' elsewhere in the path, e.g. self-hosted Gitea).
  // Pattern: <host>/<owner>/<repo>/releases/download → <host>/<owner>/<repo>/releases/tag
  const trimmed = releasesBase.replace(/\/+$/, '')
  if (trimmed.endsWith('/releases/download')) {
    return `${trimmed.slice(0, -'/download'.length)}/tag/${releaseTag}`
  }
  // Custom mirror — assume the convention `<base>/<tag>/<file>` and don't fabricate a page URL.
  return `${trimmed}/${releaseTag}`
}

function buildManifest() {
  const versionDir = path.join(ARTIFACT_ROOT, FLIGHT_DECK_VERSION)
  const shaSums = parseShaSums(versionDir)
  const presentFiles = existsSync(versionDir)
    ? new Set(readdirSync(versionDir))
    : new Set<string>()

  // Honest source of truth: an artifact is `available` ONLY if the operator
  // can actually pull a binary right now. That means either:
  //   (a) the file is sitting in `public/downloads/flight-deck/<version>/`, OR
  //   (b) the operator has opted in via FLIGHT_DECK_RELEASE_PUBLISHED=true,
  //       asserting that the corresponding GitHub Release exists.
  // Without either signal, status stays `pending-build` and `download_url`
  // stays `null` — the UI surfaces the build-from-source recipe instead.
  const releasesBase = (process.env.FLIGHT_DECK_RELEASES_BASE || DEFAULT_RELEASES_BASE).replace(/\/+$/, '')
  const releaseTag = `flight-deck-${FLIGHT_DECK_VERSION}`
  const releasePublished = String(process.env.FLIGHT_DECK_RELEASE_PUBLISHED || '').trim().toLowerCase() === 'true'

  const artifacts: Artifact[] = PLATFORM_MATRIX.map((entry) => {
    const filePath = path.join(versionDir, entry.filename)
    const present = presentFiles.has(entry.filename)
    let size: number | null = null
    if (present) {
      try { size = statSync(filePath).size } catch { size = null }
    }
    const localUrl = present
      ? `/api/flight-deck/download/${FLIGHT_DECK_VERSION}/${entry.filename}`
      : null
    const releaseUrl = releasePublished
      ? `${releasesBase}/${releaseTag}/${entry.filename}`
      : null
    const downloadUrl = localUrl ?? releaseUrl
    return {
      platform: entry.platform,
      arch: entry.arch,
      file_type: entry.file_type,
      filename: entry.filename,
      size_bytes: size,
      size_human: size !== null ? humanSize(size) : null,
      sha256: shaSums[entry.filename] || null,
      download_url: downloadUrl,
      status: downloadUrl ? 'available' : 'pending-build',
      signed: entry.signed,
      notes: entry.notes,
    }
  })

  return {
    version: FLIGHT_DECK_VERSION,
    release_url: releasePublished ? releaseTagPageUrl(releasesBase, releaseTag) : null,
    release_published: releasePublished,
    ci_workflow: '.github/workflows/flight-deck-release.yml',
    ci_tag_command: `git tag ${releaseTag} && git push origin ${releaseTag}`,
    available_count: artifacts.filter((a) => a.status === 'available').length,
    pending_count: artifacts.filter((a) => a.status === 'pending-build').length,
    artifacts,
  }
}

export async function GET() {
  const manifest = buildManifest()
  return NextResponse.json(manifest, {
    headers: {
      'Cache-Control': 'public, max-age=60',
    },
  })
}
