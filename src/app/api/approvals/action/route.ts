import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { getDatabase } from '@/lib/db'

/**
 * POST /api/approvals/action
 *
 * Operator-facing approval queue actions. Routes through existing
 * task-update behavior + writes an audit row to `workforce_memory` so
 * the trace shows the operator's decision and rationale.
 *
 * Body:
 *   { taskId: number, action: 'approve' | 'reject' | 'request-changes', note?: string }
 *
 * Status mapping:
 *   approve         → 'done'
 *   reject          → 'failed'
 *   request-changes → 'in_progress'
 */
interface Body {
  taskId?: number
  action?: 'approve' | 'reject' | 'request-changes'
  note?: string
}

export async function POST(request: NextRequest) {
  const auth = requireRole(request, 'operator')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const workspaceId = auth.user.workspace_id ?? 1
  const actorId = auth.user.id
  let body: Body
  try { body = (await request.json()) as Body } catch { return NextResponse.json({ error: 'invalid JSON' }, { status: 400 }) }
  if (!body.taskId || !body.action) return NextResponse.json({ error: 'taskId and action are required' }, { status: 400 })

  const db = getDatabase()
  const task = db
    .prepare(`SELECT id, title, status, assigned_to FROM tasks WHERE id = ? AND workspace_id = ? LIMIT 1`)
    .get(body.taskId, workspaceId) as { id: number; title: string; status: string; assigned_to: string | null } | undefined
  if (!task) return NextResponse.json({ error: 'task not found' }, { status: 404 })

  const newStatus = body.action === 'approve' ? 'done' : body.action === 'reject' ? 'failed' : 'in_progress'
  const now = Math.floor(Date.now() / 1000)
  try {
    db.prepare(`UPDATE tasks SET status = ?, updated_at = ? WHERE id = ? AND workspace_id = ?`)
      .run(newStatus, now, body.taskId, workspaceId)
  } catch (e) {
    return NextResponse.json({ error: 'task update failed', detail: String(e).slice(0, 200) }, { status: 500 })
  }

  // Write a memory row so the trace + activity feed see the operator's decision.
  db.exec(`CREATE TABLE IF NOT EXISTS workforce_memory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workspace_id INTEGER NOT NULL, agent_id INTEGER, agent_slug TEXT,
    kind TEXT NOT NULL, title TEXT NOT NULL, detail TEXT, rationale TEXT,
    value_impact_cents INTEGER DEFAULT 0, created_at INTEGER NOT NULL
  )`)
  const assignedSlug = task.assigned_to ? task.assigned_to.toLowerCase().replace(/[^a-z0-9]+/g, '-') : null
  db.prepare(
    `INSERT INTO workforce_memory (workspace_id, agent_slug, kind, title, detail, rationale, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    workspaceId,
    assignedSlug,
    body.action === 'approve' ? 'approval-approved' : body.action === 'reject' ? 'approval-rejected' : 'approval-changes-requested',
    body.action === 'approve' ? `Approved: ${task.title}` : body.action === 'reject' ? `Rejected: ${task.title}` : `Changes requested: ${task.title}`,
    body.note?.slice(0, 240) ?? null,
    `Operator #${actorId} action`,
    now,
  )

  return NextResponse.json({ ok: true, taskId: body.taskId, status: newStatus })
}

export const dynamic = 'force-dynamic'
