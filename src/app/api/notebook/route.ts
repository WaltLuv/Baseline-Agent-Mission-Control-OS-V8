/**
 * Notebook API — long-form notes per workspace.
 *
 *   GET    /api/notebook[?include_archived=1]
 *   POST   /api/notebook            { title, body_md?, tags?: string[] }
 *   PATCH  /api/notebook?id=N       { title?, body_md?, tags?, archived? }
 *   DELETE /api/notebook?id=N       — archive (soft-delete)
 *
 * Same surface as Baseline OS `/journal` / `/notebook`; cloud writes to
 * SQLite instead of the Obsidian vault.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { getDatabase } from '@/lib/db'
import { mutationLimiter } from '@/lib/rate-limit'

interface NotebookRow {
  id: number
  workspace_id: number
  author_user_id: number | null
  title: string
  body_md: string
  source: 'operator' | 'agent' | 'daily_brief' | 'import'
  tags_json: string | null
  archived: number
  created_at: number
  updated_at: number
}

const TITLE_MAX = 280
const BODY_MAX = 200_000 // 200 KB per entry

function parseTags(body: { tags?: unknown }): string[] | null {
  if (!Array.isArray(body.tags)) return null
  const cleaned = body.tags
    .filter((t): t is string => typeof t === 'string')
    .map((t) => t.trim())
    .filter((t) => t.length > 0 && t.length <= 64)
  return cleaned.slice(0, 24) // hard cap on tag count
}

function rowToWire(row: NotebookRow) {
  let tags: string[] = []
  if (row.tags_json) {
    try {
      const v = JSON.parse(row.tags_json)
      if (Array.isArray(v)) tags = v.filter((x): x is string => typeof x === 'string')
    } catch { /* ignore */ }
  }
  return { ...row, tags, archived: row.archived === 1 }
}

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const workspaceId = auth.user.workspace_id ?? 1

  const includeArchived = new URL(request.url).searchParams.get('include_archived') === '1'
  const db = getDatabase()
  const rows = db.prepare(
    includeArchived
      ? `SELECT * FROM notebook_entries WHERE workspace_id = ? ORDER BY updated_at DESC LIMIT 500`
      : `SELECT * FROM notebook_entries WHERE workspace_id = ? AND archived = 0 ORDER BY updated_at DESC LIMIT 500`,
  ).all(workspaceId) as NotebookRow[]

  return NextResponse.json({ entries: rows.map(rowToWire) })
}

export async function POST(request: NextRequest) {
  const rl = mutationLimiter(request)
  if (rl) return rl
  const auth = requireRole(request, 'operator')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const workspaceId = auth.user.workspace_id ?? 1

  let body: { title?: string; body_md?: string; tags?: string[]; source?: string }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'invalid JSON' }, { status: 400 }) }

  const title = (body.title ?? '').toString().trim()
  if (!title) return NextResponse.json({ error: 'title required' }, { status: 400 })
  if (title.length > TITLE_MAX) return NextResponse.json({ error: `title too long (${TITLE_MAX} char max)` }, { status: 400 })
  const bodyMd = (body.body_md ?? '').toString()
  if (bodyMd.length > BODY_MAX) return NextResponse.json({ error: `body too long (${BODY_MAX} char max)` }, { status: 400 })

  const tags = parseTags(body) ?? []
  const source = body.source && ['operator', 'agent', 'daily_brief', 'import'].includes(body.source) ? body.source : 'operator'

  const db = getDatabase()
  const res = db.prepare(
    `INSERT INTO notebook_entries (workspace_id, author_user_id, title, body_md, source, tags_json, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, unixepoch(), unixepoch())`,
  ).run(workspaceId, auth.user.id, title, bodyMd, source, JSON.stringify(tags))
  const id = Number(res.lastInsertRowid)
  const row = db.prepare(`SELECT * FROM notebook_entries WHERE id = ?`).get(id) as NotebookRow
  return NextResponse.json({ entry: rowToWire(row) }, { status: 201 })
}

export async function PATCH(request: NextRequest) {
  const rl = mutationLimiter(request)
  if (rl) return rl
  const auth = requireRole(request, 'operator')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const workspaceId = auth.user.workspace_id ?? 1

  const id = Number(new URL(request.url).searchParams.get('id'))
  if (!id || !Number.isFinite(id)) return NextResponse.json({ error: 'id required' }, { status: 400 })

  let body: { title?: string; body_md?: string; tags?: string[]; archived?: boolean }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'invalid JSON' }, { status: 400 }) }

  const db = getDatabase()
  const existing = db.prepare(`SELECT * FROM notebook_entries WHERE id = ? AND workspace_id = ?`).get(id, workspaceId) as NotebookRow | undefined
  if (!existing) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const updates: string[] = []
  const args: unknown[] = []
  if (body.title !== undefined) {
    const t = body.title.toString().trim()
    if (!t) return NextResponse.json({ error: 'title cannot be empty' }, { status: 400 })
    if (t.length > TITLE_MAX) return NextResponse.json({ error: `title too long (${TITLE_MAX} char max)` }, { status: 400 })
    updates.push('title = ?')
    args.push(t)
  }
  if (body.body_md !== undefined) {
    const m = body.body_md.toString()
    if (m.length > BODY_MAX) return NextResponse.json({ error: `body too long (${BODY_MAX} char max)` }, { status: 400 })
    updates.push('body_md = ?')
    args.push(m)
  }
  if (body.tags !== undefined) {
    const tags = parseTags(body) ?? []
    updates.push('tags_json = ?')
    args.push(JSON.stringify(tags))
  }
  if (body.archived !== undefined) {
    updates.push('archived = ?')
    args.push(body.archived ? 1 : 0)
  }
  if (updates.length === 0) return NextResponse.json({ entry: rowToWire(existing) })

  updates.push('updated_at = unixepoch()')
  args.push(id, workspaceId)
  db.prepare(`UPDATE notebook_entries SET ${updates.join(', ')} WHERE id = ? AND workspace_id = ?`).run(...args)
  const updated = db.prepare(`SELECT * FROM notebook_entries WHERE id = ?`).get(id) as NotebookRow
  return NextResponse.json({ entry: rowToWire(updated) })
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
  const res = db.prepare(
    `UPDATE notebook_entries SET archived = 1, updated_at = unixepoch() WHERE id = ? AND workspace_id = ?`,
  ).run(id, workspaceId)
  if (res.changes === 0) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json({ ok: true, archived: id })
}
