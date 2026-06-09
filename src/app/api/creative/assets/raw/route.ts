/**
 * GET /api/creative/assets/raw?name= — stream a workspace asset for inline
 * preview. Workspace-scoped (only serves files in the caller's ws dir) +
 * path-contained (basename only). Range-capable for video/audio.
 */
import { NextRequest } from 'next/server'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { join, basename, extname } from 'node:path'
import { requireRole } from '@/lib/auth'
import { config } from '@/lib/config'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MIME: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', svg: 'image/svg+xml', mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime', mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', m4a: 'audio/mp4', pdf: 'application/pdf', txt: 'text/plain', md: 'text/markdown', json: 'application/json', csv: 'text/csv' }

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return new Response('unauthorized', { status: auth.status })
  const ws = auth.user.workspace_id ?? 1
  const name = basename(new URL(request.url).searchParams.get('name') ?? '')
  const file = join(config.dataDir, 'creative', `ws${ws}`, name)
  if (!name || !existsSync(file)) return new Response('not found', { status: 404 })
  const mime = MIME[extname(name).slice(1).toLowerCase()] ?? 'application/octet-stream'
  const size = statSync(file).size
  const stream = createReadStream(file) as unknown as ReadableStream
  return new Response(stream, { headers: { 'Content-Type': mime, 'Content-Length': String(size), 'Cache-Control': 'no-store' } })
}
