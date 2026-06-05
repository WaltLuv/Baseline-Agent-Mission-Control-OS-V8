/**
 * SEO targets API — workspace-scoped keyword/URL targets the operator
 * is trying to rank for.
 *
 *   GET    /api/seo[?status=…&include_archived=1]
 *   POST   /api/seo            { target_keyword, target_url?, page_title?, target_rank?, notes? }
 *   PATCH  /api/seo?id=N       { target_keyword?, target_url?, page_title?, status?,
 *                                 current_rank?, target_rank?, notes?, last_checked? }
 *   DELETE /api/seo?id=N       — archive (soft-delete)
 *
 * Ranks are operator-recorded integers (1 = #1 on the SERP). The cloud
 * never auto-fetches rank — it records whatever the operator or an
 * upstream rank-tracker agent writes.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { getDatabase } from '@/lib/db'
import { mutationLimiter } from '@/lib/rate-limit'

interface TargetRow {
  id: number
  workspace_id: number
  author_user_id: number | null
  target_keyword: string
  target_url: string | null
  page_title: string | null
  status: 'planned' | 'drafting' | 'published' | 'ranking' | 'archived'
  current_rank: number | null
  target_rank: number | null
  notes: string | null
  last_checked_at: number | null
  created_at: number
  updated_at: number
}

const ALLOWED_STATUS = new Set(['planned', 'drafting', 'published', 'ranking', 'archived'])
const KEYWORD_MAX = 280
const URL_MAX = 2048
const NOTES_MAX = 8000

function clampRank(n: unknown): number | null {
  if (typeof n !== 'number' || !Number.isFinite(n)) return null
  return Math.max(1, Math.min(1000, Math.round(n)))
}

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const workspaceId = auth.user.workspace_id ?? 1

  const url = new URL(request.url)
  const status = url.searchParams.get('status')
  const includeArchived = url.searchParams.get('include_archived') === '1'

  const db = getDatabase()
  let rows: TargetRow[]
  if (status) {
    rows = db.prepare(
      `SELECT * FROM seo_targets WHERE workspace_id = ? AND status = ? ORDER BY updated_at DESC LIMIT 500`,
    ).all(workspaceId, status) as TargetRow[]
  } else if (includeArchived) {
    rows = db.prepare(
      `SELECT * FROM seo_targets WHERE workspace_id = ? ORDER BY status = 'ranking', updated_at DESC LIMIT 500`,
    ).all(workspaceId) as TargetRow[]
  } else {
    rows = db.prepare(
      `SELECT * FROM seo_targets WHERE workspace_id = ? AND status != 'archived' ORDER BY status = 'ranking' DESC, updated_at DESC LIMIT 500`,
    ).all(workspaceId) as TargetRow[]
  }
  return NextResponse.json({ targets: rows })
}

export async function POST(request: NextRequest) {
  const rl = mutationLimiter(request)
  if (rl) return rl
  const auth = requireRole(request, 'operator')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const workspaceId = auth.user.workspace_id ?? 1

  let body: Record<string, unknown>
  try { body = (await request.json()) as Record<string, unknown> } catch { return NextResponse.json({ error: 'invalid JSON' }, { status: 400 }) }

  const keyword = typeof body.target_keyword === 'string' ? body.target_keyword.trim() : ''
  if (!keyword) return NextResponse.json({ error: 'target_keyword required' }, { status: 400 })
  if (keyword.length > KEYWORD_MAX) return NextResponse.json({ error: `target_keyword too long (${KEYWORD_MAX} char max)` }, { status: 400 })

  const targetUrl = typeof body.target_url === 'string' ? body.target_url.trim() : null
  if (targetUrl && targetUrl.length > URL_MAX) return NextResponse.json({ error: 'target_url too long' }, { status: 400 })

  const pageTitle = typeof body.page_title === 'string' ? body.page_title.trim() : null
  const notes = typeof body.notes === 'string' ? body.notes : null
  if (notes && notes.length > NOTES_MAX) return NextResponse.json({ error: 'notes too long' }, { status: 400 })
  const targetRank = clampRank(body.target_rank)

  const db = getDatabase()
  const res = db.prepare(
    `INSERT INTO seo_targets (workspace_id, author_user_id, target_keyword, target_url, page_title, target_rank, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, unixepoch(), unixepoch())`,
  ).run(workspaceId, auth.user.id, keyword, targetUrl, pageTitle, targetRank, notes)
  const id = Number(res.lastInsertRowid)
  const row = db.prepare(`SELECT * FROM seo_targets WHERE id = ?`).get(id) as TargetRow
  return NextResponse.json({ target: row }, { status: 201 })
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
  const existing = db.prepare(`SELECT * FROM seo_targets WHERE id = ? AND workspace_id = ?`).get(id, workspaceId) as TargetRow | undefined
  if (!existing) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const updates: string[] = []
  const args: unknown[] = []
  if (typeof body.target_keyword === 'string') {
    const v = body.target_keyword.trim()
    if (!v) return NextResponse.json({ error: 'target_keyword cannot be empty' }, { status: 400 })
    if (v.length > KEYWORD_MAX) return NextResponse.json({ error: 'target_keyword too long' }, { status: 400 })
    updates.push('target_keyword = ?')
    args.push(v)
  }
  if (body.target_url !== undefined) {
    const v = body.target_url === null ? null : String(body.target_url).trim()
    if (v && v.length > URL_MAX) return NextResponse.json({ error: 'target_url too long' }, { status: 400 })
    updates.push('target_url = ?')
    args.push(v)
  }
  if (body.page_title !== undefined) {
    updates.push('page_title = ?')
    args.push(body.page_title === null ? null : String(body.page_title).trim())
  }
  if (body.status !== undefined) {
    if (typeof body.status !== 'string' || !ALLOWED_STATUS.has(body.status)) return NextResponse.json({ error: 'invalid status' }, { status: 400 })
    updates.push('status = ?')
    args.push(body.status)
  }
  if (body.current_rank !== undefined) {
    updates.push('current_rank = ?')
    args.push(body.current_rank === null ? null : clampRank(body.current_rank))
    updates.push('last_checked_at = unixepoch()')
  }
  if (body.target_rank !== undefined) {
    updates.push('target_rank = ?')
    args.push(body.target_rank === null ? null : clampRank(body.target_rank))
  }
  if (body.notes !== undefined) {
    const v = body.notes === null ? null : String(body.notes)
    if (v && v.length > NOTES_MAX) return NextResponse.json({ error: 'notes too long' }, { status: 400 })
    updates.push('notes = ?')
    args.push(v)
  }
  if (body.last_checked === true) {
    updates.push('last_checked_at = unixepoch()')
  }
  if (updates.length === 0) return NextResponse.json({ target: existing })

  updates.push('updated_at = unixepoch()')
  args.push(id, workspaceId)
  db.prepare(`UPDATE seo_targets SET ${updates.join(', ')} WHERE id = ? AND workspace_id = ?`).run(...args)
  const updated = db.prepare(`SELECT * FROM seo_targets WHERE id = ?`).get(id) as TargetRow
  return NextResponse.json({ target: updated })
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
    `UPDATE seo_targets SET status = 'archived', updated_at = unixepoch() WHERE id = ? AND workspace_id = ?`,
  ).run(id, workspaceId)
  if (res.changes === 0) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json({ ok: true, archived: id })
}
