import { stat } from 'node:fs/promises'
import { existsSync, createReadStream } from 'node:fs'
import { Readable } from 'node:stream'
import type { ReadableStream as NodeReadableStream } from 'node:stream/web'
import path from 'node:path'
import { FACTORY_SCRATCH_ROOT } from '@/lib/agent-factory/workspace'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Serves Agent Factory builds for the preview iframe.
 * URL: /api/agent-factory/preview/<project>/<...rel>
 * Relative asset paths inside a built HTML page resolve because the URL mirrors
 * the real file tree. Path traversal is blocked.
 */
const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.htm': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.gif': 'image/gif', '.svg': 'image/svg+xml', '.avif': 'image/avif',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.m4a': 'audio/mp4', '.ogg': 'audio/ogg',
}
const mimeFor = (p: string) => MIME[path.extname(p).toLowerCase()] ?? 'application/octet-stream'

export async function GET(req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const { path: segments } = await ctx.params
  if (!Array.isArray(segments) || segments.length < 2) return new Response('path must be /project/...rel', { status: 400 })
  const [project, ...restSegs] = segments
  if (!/^[A-Za-z0-9_.-]+$/.test(project)) return new Response('invalid project', { status: 400 })
  const rel = restSegs.join('/')
  if (!rel) return new Response('file path required', { status: 400 })

  const base = path.join(FACTORY_SCRATCH_ROOT, project)
  const abs = path.resolve(base, rel)
  if (abs !== base && !abs.startsWith(base + path.sep)) return new Response('forbidden', { status: 403 })
  if (!existsSync(abs)) return new Response('not found', { status: 404 })
  const s = await stat(abs)
  if (!s.isFile()) return new Response('not a file', { status: 400 })

  const stream = createReadStream(abs)
  const web = Readable.toWeb(stream) as unknown as NodeReadableStream<Uint8Array>
  return new Response(web as unknown as ReadableStream<Uint8Array>, {
    headers: { 'Content-Type': mimeFor(abs), 'Cache-Control': 'no-store', 'Content-Length': String(s.size) },
  })
}
