/**
 * Goals API — operator-managed objectives, workspace-scoped.
 *
 *   GET    /api/goals          → list workspace goals (default: non-archived)
 *   POST   /api/goals          → create a goal { title, due_date?, notes? }
 *   PATCH  /api/goals?id=N     → update { title?, status?, due_date?, notes? }
 *   DELETE /api/goals?id=N     → archive (soft-delete; status='archived')
 *
 * Same surface as Baseline OS `/goals` page; storage backend differs
 * (Obsidian vault locally, SQLite in the cloud).
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { getDatabase } from '@/lib/db'
import { mutationLimiter } from '@/lib/rate-limit'

interface GoalRow {
  id: number
  workspace_id: number
  author_user_id: number | null
  title: string
  status: 'open' | 'in_progress' | 'done' | 'archived'
  due_date: string | null
  notes: string | null
  created_at: number
  updated_at: number
  completed_at: number | null
}

const ALLOWED_STATUS = new Set(['open', 'in_progress', 'done', 'archived'])

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const workspaceId = auth.user.workspace_id ?? 1

  const url = new URL(request.url)
  const includeArchived = url.searchParams.get('include_archived') === '1'

  const db = getDatabase()
  const rows = db.prepare(
    includeArchived
      ? `SELECT * FROM goals WHERE workspace_id = ? ORDER BY status = 'done', updated_at DESC`
      : `SELECT * FROM goals WHERE workspace_id = ? AND status != 'archived' ORDER BY status = 'done', updated_at DESC`,
  ).all(workspaceId) as GoalRow[]

  return NextResponse.json({ goals: rows })
}

export async function POST(request: NextRequest) {
  const rl = mutationLimiter(request)
  if (rl) return rl
  const auth = requireRole(request, 'operator')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const workspaceId = auth.user.workspace_id ?? 1

  let body: { title?: string; due_date?: string | null; notes?: string | null }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'invalid JSON' }, { status: 400 }) }
  const title = (body.title ?? '').toString().trim()
  if (!title) return NextResponse.json({ error: 'title required' }, { status: 400 })
  if (title.length > 500) return NextResponse.json({ error: 'title too long (500 char max)' }, { status: 400 })

  const db = getDatabase()
  const result = db.prepare(
    `INSERT INTO goals (workspace_id, author_user_id, title, due_date, notes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, unixepoch(), unixepoch())`,
  ).run(workspaceId, auth.user.id, title, body.due_date ?? null, body.notes ?? null)
  const id = Number(result.lastInsertRowid)
  const row = db.prepare(`SELECT * FROM goals WHERE id = ?`).get(id) as GoalRow
  return NextResponse.json({ goal: row }, { status: 201 })
}

export async function PATCH(request: NextRequest) {
  const rl = mutationLimiter(request)
  if (rl) return rl
  const auth = requireRole(request, 'operator')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const workspaceId = auth.user.workspace_id ?? 1

  const id = Number(new URL(request.url).searchParams.get('id'))
  if (!id || !Number.isFinite(id)) return NextResponse.json({ error: 'id required' }, { status: 400 })

  let body: { title?: string; status?: string; due_date?: string | null; notes?: string | null }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'invalid JSON' }, { status: 400 }) }

  const db = getDatabase()
  const existing = db.prepare(`SELECT * FROM goals WHERE id = ? AND workspace_id = ?`).get(id, workspaceId) as GoalRow | undefined
  if (!existing) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const updates: string[] = []
  const args: unknown[] = []
  if (body.title !== undefined) {
    const t = body.title.toString().trim()
    if (!t) return NextResponse.json({ error: 'title cannot be empty' }, { status: 400 })
    if (t.length > 500) return NextResponse.json({ error: 'title too long' }, { status: 400 })
    updates.push('title = ?')
    args.push(t)
  }
  if (body.status !== undefined) {
    if (!ALLOWED_STATUS.has(body.status)) return NextResponse.json({ error: 'invalid status' }, { status: 400 })
    updates.push('status = ?')
    args.push(body.status)
    if (body.status === 'done' && existing.status !== 'done') {
      updates.push('completed_at = unixepoch()')
    } else if (body.status !== 'done') {
      updates.push('completed_at = NULL')
    }
  }
  if (body.due_date !== undefined) {
    updates.push('due_date = ?')
    args.push(body.due_date)
  }
  if (body.notes !== undefined) {
    updates.push('notes = ?')
    args.push(body.notes)
  }
  if (updates.length === 0) return NextResponse.json({ goal: existing })

  updates.push('updated_at = unixepoch()')
  args.push(id, workspaceId)
  db.prepare(`UPDATE goals SET ${updates.join(', ')} WHERE id = ? AND workspace_id = ?`).run(...args)
  const updated = db.prepare(`SELECT * FROM goals WHERE id = ?`).get(id) as GoalRow
  return NextResponse.json({ goal: updated })
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
  // Soft-delete: archive instead of removing the row so the audit trail
  // and any links from other tables survive.
  const res = db.prepare(
    `UPDATE goals SET status = 'archived', updated_at = unixepoch() WHERE id = ? AND workspace_id = ?`,
  ).run(id, workspaceId)
  if (res.changes === 0) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json({ ok: true, archived: id })
}
