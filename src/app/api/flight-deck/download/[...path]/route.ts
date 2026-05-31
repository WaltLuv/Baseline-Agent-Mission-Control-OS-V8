import { NextRequest, NextResponse } from 'next/server'
import { createReadStream, existsSync, statSync } from 'node:fs'
import path from 'node:path'
import { Readable } from 'node:stream'

// Streams Flight Deck release artifacts from the on-disk
// `public/downloads/flight-deck/<version>/` directory. Uses an explicit API
// route (not Next.js static serving) so newly built artifacts don't require
// a full `next build` to become downloadable.

const ARTIFACT_ROOT = path.join(process.cwd(), 'public', 'downloads', 'flight-deck')

// Strict allowlist — only known artifact patterns may be served.
const ALLOWED_FILE_RE = /^baseline-flight-deck_[0-9]+\.[0-9]+\.[0-9]+_[a-z0-9_-]+(?:\.deb|\.AppImage|\.dmg|\.msi|\.exe|\.app\.tar\.gz)?$/i
const ALLOWED_AUX_RE = /^(SHA256SUMS|RELEASE\.txt)$/

const CONTENT_TYPES: Record<string, string> = {
  '.deb': 'application/vnd.debian.binary-package',
  '.AppImage': 'application/vnd.appimage',
  '.dmg': 'application/x-apple-diskimage',
  '.msi': 'application/x-msi',
  '.exe': 'application/vnd.microsoft.portable-executable',
  '.tar.gz': 'application/gzip',
}

function contentTypeFor(filename: string): string {
  for (const [ext, type] of Object.entries(CONTENT_TYPES)) {
    if (filename.toLowerCase().endsWith(ext.toLowerCase())) return type
  }
  if (filename === 'SHA256SUMS' || filename === 'RELEASE.txt') return 'text/plain; charset=utf-8'
  return 'application/octet-stream'
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path: segments } = await params
  if (!Array.isArray(segments) || segments.length < 2) {
    return NextResponse.json({ error: 'expected /api/flight-deck/download/<version>/<filename>' }, { status: 400 })
  }

  const [version, ...rest] = segments
  const filename = rest.join('/')

  // Path safety: no traversal, no nested paths
  if (!/^v[0-9]+\.[0-9]+\.[0-9]+$/.test(version)) {
    return NextResponse.json({ error: 'invalid version' }, { status: 400 })
  }
  if (filename.includes('/') || filename.includes('..') || filename.includes('\\')) {
    return NextResponse.json({ error: 'invalid filename' }, { status: 400 })
  }
  if (!ALLOWED_FILE_RE.test(filename) && !ALLOWED_AUX_RE.test(filename)) {
    return NextResponse.json({ error: 'filename not in allowlist' }, { status: 400 })
  }

  const absPath = path.join(ARTIFACT_ROOT, version, filename)
  // Final containment check
  const root = path.resolve(ARTIFACT_ROOT)
  if (!path.resolve(absPath).startsWith(root + path.sep)) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  if (!existsSync(absPath)) {
    return NextResponse.json({
      error: 'artifact not yet built',
      hint: 'Run the .github/workflows/flight-deck-release.yml workflow by tagging the release: git tag flight-deck-' + version,
    }, { status: 404 })
  }

  const stat = statSync(absPath)

  // HEAD-only fast path
  if (request.method === 'HEAD') {
    return new NextResponse(null, {
      status: 200,
      headers: {
        'Content-Type': contentTypeFor(filename),
        'Content-Length': String(stat.size),
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'public, max-age=300',
      },
    })
  }

  const nodeStream = createReadStream(absPath)
  const webStream = Readable.toWeb(nodeStream) as unknown as ReadableStream

  return new NextResponse(webStream, {
    status: 200,
    headers: {
      'Content-Type': contentTypeFor(filename),
      'Content-Length': String(stat.size),
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'public, max-age=300',
      'X-Artifact-Version': version,
    },
  })
}

export async function HEAD(
  request: NextRequest,
  ctx: { params: Promise<{ path: string[] }> },
) {
  return GET(request, ctx)
}
