/**
 * Documents API — workspace-scoped file storage.
 *
 *   GET    /api/documents[?q=…&include_archived=1]
 *          → { documents, totals }
 *   POST   /api/documents
 *          multipart/form-data { file, notes?, tags? (comma-separated) }
 *          → { document } (201)
 *   PATCH  /api/documents?id=N
 *          { notes?, tags?, restore?: true } — flips status='live'
 *   DELETE /api/documents?id=N
 *          → soft-delete (status='archived'); blob remains on disk
 *
 * Storage: SQLite metadata + content-addressed blobs at
 * `<dataDir>/documents/<workspace_id>/<sha256>`. See `documents-store.ts`.
 *
 * Security:
 *   · workspace scoped on every read/write
 *   · filename sanitised (no slashes, control chars, empty names)
 *   · path traversal blocked at the storage layer
 *   · 50 MB per file cap (DOCUMENT_MAX_BYTES)
 *   · MIME type must be a plain "type/subtype" string; rejected otherwise
 *
 * Honest stance: Mission Control cloud stores blobs on a persistent disk
 * volume today. The interface is designed so a future S3 adapter can
 * replace `documents-store` without touching this route.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { getDatabase, logAuditEvent } from '@/lib/db'
import { mutationLimiter } from '@/lib/rate-limit'
import { DOCUMENT_MAX_BYTES, putBlob } from '@/lib/documents-store'

interface DocumentRow {
  id: number
  workspace_id: number
  author_user_id: number | null
  filename: string
  mime_type: string
  size_bytes: number
  sha256: string
  storage_key: string
  status: 'live' | 'archived'
  tags_json: string | null
  notes: string | null
  created_at: number
  updated_at: number
}

const FILENAME_MAX = 255
const NOTES_MAX = 4000
const TAGS_MAX = 24

function sanitiseFilename(raw: string): string {
  // Strip any path components and control characters; keep the basename.
  const cleaned = raw
    .replace(/\\/g, '/')
    .split('/')
    .pop() ?? ''
  return cleaned
    .replace(/[\x00-\x1f\x7f]/g, '')
    .trim()
    .slice(0, FILENAME_MAX)
}

function parseTagsCsv(raw: unknown): string[] {
  if (typeof raw !== 'string') return []
  return raw
    .split(',')
    .map((t) => t.trim())
    .filter((t) => t.length > 0 && t.length <= 64)
    .slice(0, TAGS_MAX)
}

function isPlainMime(value: string): boolean {
  return /^[a-zA-Z0-9._+-]+\/[a-zA-Z0-9._+-]+$/.test(value)
}

function rowToWire(row: DocumentRow) {
  let tags: string[] = []
  if (row.tags_json) {
    try {
      const v = JSON.parse(row.tags_json)
      if (Array.isArray(v)) tags = v.filter((x): x is string => typeof x === 'string')
    } catch { /* ignore */ }
  }
  return {
    id: row.id,
    filename: row.filename,
    mime_type: row.mime_type,
    size_bytes: row.size_bytes,
    sha256: row.sha256,
    status: row.status,
    tags,
    notes: row.notes,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

/**
 * Core upload — POST handler delegates here after parsing FormData. The
 * route logic is exposed as a function so route tests can avoid the
 * jsdom Request-formData() round-trip, which hangs under vitest.
 *
 * Returns the wire-shape document row plus the dedup flag.
 */
export function uploadDocumentFromBuffer(opts: {
  workspaceId: number
  userId: number
  username?: string
  filename: string
  mimeType: string
  buffer: Buffer
  notes?: string | null
  tags?: string[] | null
}): { document: ReturnType<typeof rowToWire>; dedup: boolean; status: number; error?: string } {
  const filename = sanitiseFilename(opts.filename)
  if (!filename) return { document: null as never, dedup: false, status: 400, error: 'filename required after sanitisation' }
  const mimeType = (opts.mimeType || 'application/octet-stream').toLowerCase()
  if (!isPlainMime(mimeType)) return { document: null as never, dedup: false, status: 400, error: 'invalid MIME type' }
  if (opts.buffer.byteLength > DOCUMENT_MAX_BYTES) {
    return { document: null as never, dedup: false, status: 413, error: `file exceeds ${DOCUMENT_MAX_BYTES} byte limit` }
  }

  let blob
  try { blob = putBlob(opts.workspaceId, opts.buffer) }
  catch (err) {
    const code = (err as { code?: string }).code
    if (code === 'TOO_LARGE') return { document: null as never, dedup: false, status: 413, error: 'file exceeds size limit' }
    return { document: null as never, dedup: false, status: 500, error: 'storage write failed' }
  }

  const tags = (opts.tags ?? [])
    .map((t) => t.trim())
    .filter((t) => t.length > 0 && t.length <= 64)
    .slice(0, TAGS_MAX)
  const notes = opts.notes ? String(opts.notes).slice(0, NOTES_MAX) : null

  const db = getDatabase()
  const res = db.prepare(
    `INSERT INTO documents (workspace_id, author_user_id, filename, mime_type, size_bytes, sha256, storage_key, tags_json, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, unixepoch(), unixepoch())`,
  ).run(opts.workspaceId, opts.userId, filename, mimeType, blob.size_bytes, blob.sha256, blob.storage_key, JSON.stringify(tags), notes)
  const id = Number(res.lastInsertRowid)
  const row = db.prepare(`SELECT * FROM documents WHERE id = ?`).get(id) as DocumentRow

  logAuditEvent({
    action: 'document.upload',
    actor: opts.username ?? `user:${opts.userId}`,
    actor_id: opts.userId,
    detail: { document_id: id, filename, size_bytes: blob.size_bytes, mime_type: mimeType, dedup: blob.dedup },
  })

  return { document: rowToWire(row), dedup: blob.dedup, status: 201 }
}

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const workspaceId = auth.user.workspace_id ?? 1

  const url = new URL(request.url)
  const q = (url.searchParams.get('q') ?? '').trim().toLowerCase()
  const includeArchived = url.searchParams.get('include_archived') === '1'

  const db = getDatabase()
  const rows = db.prepare(
    includeArchived
      ? `SELECT * FROM documents WHERE workspace_id = ? ORDER BY updated_at DESC LIMIT 500`
      : `SELECT * FROM documents WHERE workspace_id = ? AND status = 'live' ORDER BY updated_at DESC LIMIT 500`,
  ).all(workspaceId) as DocumentRow[]

  const filtered = q
    ? rows.filter((r) =>
        r.filename.toLowerCase().includes(q) ||
        (r.notes ?? '').toLowerCase().includes(q) ||
        (r.tags_json ?? '').toLowerCase().includes(q),
      )
    : rows

  const totals = {
    live: rows.filter((r) => r.status === 'live').length,
    archived: rows.filter((r) => r.status === 'archived').length,
    total_size_bytes: rows.filter((r) => r.status === 'live').reduce((acc, r) => acc + r.size_bytes, 0),
  }

  return NextResponse.json({
    documents: filtered.map(rowToWire),
    totals,
  })
}

export async function POST(request: NextRequest) {
  const rl = mutationLimiter(request)
  if (rl) return rl
  const auth = requireRole(request, 'operator')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const workspaceId = auth.user.workspace_id ?? 1

  let formData: FormData
  try { formData = await request.formData() } catch { return NextResponse.json({ error: 'expected multipart/form-data' }, { status: 400 }) }

  const file = formData.get('file')
  if (!(file instanceof File)) return NextResponse.json({ error: 'file field required' }, { status: 400 })

  const notesRaw = formData.get('notes')
  const notes = typeof notesRaw === 'string' && notesRaw.trim() ? notesRaw.trim() : null
  const tags = parseTagsCsv(formData.get('tags'))

  const buf = Buffer.from(await file.arrayBuffer())
  const result = uploadDocumentFromBuffer({
    workspaceId,
    userId: auth.user.id,
    username: auth.user.username,
    filename: file.name,
    mimeType: file.type || 'application/octet-stream',
    buffer: buf,
    notes,
    tags,
  })
  if (result.status !== 201) return NextResponse.json({ error: result.error }, { status: result.status })
  return NextResponse.json({ document: result.document, dedup: result.dedup }, { status: 201 })
}

export async function PATCH(request: NextRequest) {
  const rl = mutationLimiter(request)
  if (rl) return rl
  const auth = requireRole(request, 'operator')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const workspaceId = auth.user.workspace_id ?? 1

  const id = Number(new URL(request.url).searchParams.get('id'))
  if (!id || !Number.isFinite(id)) return NextResponse.json({ error: 'id required' }, { status: 400 })

  let body: Record<string, unknown>
  try { body = (await request.json()) as Record<string, unknown> } catch { return NextResponse.json({ error: 'invalid JSON' }, { status: 400 }) }

  const db = getDatabase()
  const existing = db.prepare(`SELECT * FROM documents WHERE id = ? AND workspace_id = ?`).get(id, workspaceId) as DocumentRow | undefined
  if (!existing) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const updates: string[] = []
  const args: unknown[] = []
  if (body.notes !== undefined) {
    const v = body.notes === null ? null : String(body.notes).slice(0, NOTES_MAX)
    updates.push('notes = ?')
    args.push(v)
  }
  if (body.tags !== undefined) {
    const tags = Array.isArray(body.tags)
      ? body.tags.filter((t): t is string => typeof t === 'string').map((t) => t.trim()).filter((t) => t.length > 0 && t.length <= 64).slice(0, TAGS_MAX)
      : []
    updates.push('tags_json = ?')
    args.push(JSON.stringify(tags))
  }
  if (body.restore === true) {
    updates.push("status = 'live'")
  }
  if (updates.length === 0) return NextResponse.json({ document: rowToWire(existing) })

  updates.push('updated_at = unixepoch()')
  args.push(id, workspaceId)
  db.prepare(`UPDATE documents SET ${updates.join(', ')} WHERE id = ? AND workspace_id = ?`).run(...args)
  const updated = db.prepare(`SELECT * FROM documents WHERE id = ?`).get(id) as DocumentRow

  if (body.restore === true) {
    logAuditEvent({
      action: 'document.restore',
      actor: auth.user.username,
      actor_id: auth.user.id,
      detail: { document_id: id, filename: updated.filename },
    })
  }
  return NextResponse.json({ document: rowToWire(updated) })
}

export async function DELETE(request: NextRequest) {
  const rl = mutationLimiter(request)
  if (rl) return rl
  const auth = requireRole(request, 'operator')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const workspaceId = auth.user.workspace_id ?? 1

  const id = Number(new URL(request.url).searchParams.get('id'))
  if (!id || !Number.isFinite(id)) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const db = getDatabase()
  const row = db.prepare(`SELECT * FROM documents WHERE id = ? AND workspace_id = ?`).get(id, workspaceId) as DocumentRow | undefined
  if (!row) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const res = db.prepare(
    `UPDATE documents SET status = 'archived', updated_at = unixepoch() WHERE id = ? AND workspace_id = ?`,
  ).run(id, workspaceId)
  if (res.changes === 0) return NextResponse.json({ error: 'not found' }, { status: 404 })

  logAuditEvent({
    action: 'document.archive',
    actor: auth.user.username,
    actor_id: auth.user.id,
    detail: { document_id: id, filename: row.filename },
  })
  return NextResponse.json({ ok: true, archived: id, restore_window_days: 30 })
}
