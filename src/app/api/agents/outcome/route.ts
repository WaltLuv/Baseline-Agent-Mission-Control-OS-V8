import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { getDatabase } from '@/lib/db'
import { tokenReportLimiter } from '@/lib/rate-limit'

/**
 * POST /api/agents/outcome
 *
 * Runtime phone-home: an AI Employee finished (or failed) a task.
 * Updates `tasks.status` if a `taskId` is provided and writes a
 * `workforce_memory` row with the value impact so the trust trajectory
 * + cost/value rollup stay accurate.
 */
interface Body {
  agentSlug?: string
  agentId?: number
  taskId?: number
  status: 'done' | 'failed' | 'partial'
  valueImpactCents?: number
  durationMinutes?: number
  summary?: string
}

export async function POST(request: NextRequest) {
  const rl = tokenReportLimiter(request)
  if (rl) return rl
  const auth = requireRole(request, 'operator')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const workspaceId = auth.user.workspace_id ?? 1
  let body: Body
  try { body = (await request.json()) as Body } catch { return NextResponse.json({ error: 'invalid JSON' }, { status: 400 }) }
  if (!body.status) return NextResponse.json({ error: 'status is required' }, { status: 400 })
  const db = getDatabase()
  db.exec(`CREATE TABLE IF NOT EXISTS workforce_memory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    workspace_id INTEGER NOT NULL, agent_id INTEGER, agent_slug TEXT,
    kind TEXT NOT NULL, title TEXT NOT NULL, detail TEXT, rationale TEXT,
    value_impact_cents INTEGER DEFAULT 0, created_at INTEGER NOT NULL
  )`)
  const now = Math.floor(Date.now() / 1000)
  const value = Math.max(0, Math.floor(body.valueImpactCents ?? 0))
  db.prepare(
    `INSERT INTO workforce_memory (workspace_id, agent_id, agent_slug, kind, title, detail, rationale, value_impact_cents, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    workspaceId,
    body.agentId ?? null,
    body.agentSlug ?? null,
    body.status === 'done' ? 'outcome-done' : body.status === 'failed' ? 'outcome-failed' : 'outcome-partial',
    body.summary?.slice(0, 180) ?? `Task ${body.taskId ?? ''} ${body.status}`,
    body.durationMinutes ? `~${body.durationMinutes}m elapsed` : null,
    body.taskId ? `task #${body.taskId}` : null,
    value,
    now,
  )
  if (body.taskId) {
    try {
      db.prepare(
        `UPDATE tasks SET status = ?, updated_at = ? WHERE id = ? AND workspace_id = ?`,
      ).run(body.status === 'done' ? 'done' : body.status === 'failed' ? 'failed' : 'in_progress', now, body.taskId, workspaceId)
    } catch {
      // tasks table may not exist in this workspace yet — ignore.
    }
  }
  return NextResponse.json({ ok: true })
}

export const dynamic = 'force-dynamic'
