/**
 * GET /api/documents/[id]/content
 * Streams the blob for a workspace-scoped document.
 *
 *   ?disposition=inline   → Content-Disposition: inline (preview tab)
 *   ?disposition=attachment (default) → forces download
 */
import { NextRequest } from 'next/server'
import { requireRole } from '@/lib/auth'
import { getDatabase } from '@/lib/db'
import { readBlob } from '@/lib/documents-store'

interface DocumentRow {
  workspace_id: number
  filename: string
  mime_type: string
  size_bytes: number
  storage_key: string
  status: string
}

export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return new Response(JSON.stringify({ error: auth.error }), {
    status: auth.status,
    headers: { 'Content-Type': 'application/json' },
  })

  const workspaceId = auth.user.workspace_id ?? 1
  const params = await ctx.params
  const id = Number(params.id)
  if (!id || !Number.isFinite(id)) return new Response(JSON.stringify({ error: 'invalid id' }), { status: 400, headers: { 'Content-Type': 'application/json' } })

  const db = getDatabase()
  const row = db.prepare(
    `SELECT workspace_id, filename, mime_type, size_bytes, storage_key, status FROM documents WHERE id = ? AND workspace_id = ?`,
  ).get(id, workspaceId) as DocumentRow | undefined
  if (!row) return new Response(JSON.stringify({ error: 'not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } })
  if (row.status !== 'live') return new Response(JSON.stringify({ error: 'document archived' }), { status: 410, headers: { 'Content-Type': 'application/json' } })

  let buf: Buffer
  try { buf = readBlob(row.workspace_id, row.storage_key) } catch { return new Response(JSON.stringify({ error: 'storage read failed' }), { status: 500, headers: { 'Content-Type': 'application/json' } }) }

  const disposition = new URL(request.url).searchParams.get('disposition') === 'inline' ? 'inline' : 'attachment'
  // Quote filename per RFC 6266 to handle spaces / non-ASCII.
  const encodedName = encodeURIComponent(row.filename)
  return new Response(new Uint8Array(buf), {
    status: 200,
    headers: {
      'Content-Type': row.mime_type || 'application/octet-stream',
      'Content-Length': String(row.size_bytes),
      'Content-Disposition': `${disposition}; filename*=UTF-8''${encodedName}`,
      'Cache-Control': 'private, max-age=0, must-revalidate',
    },
  })
}
