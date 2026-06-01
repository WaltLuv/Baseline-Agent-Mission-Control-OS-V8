/**
 * POST /api/tasks/:id/routing
 *
 * Workforce Router (Baseline OS Phase 2) records its decision on this
 * task. Mission Control STORES and DISPLAYS the decision — it never makes
 * one. Audit-logged. Workspace-scoped.
 *
 * Body fields (all optional except assigned_runtime):
 *   assigned_runtime     — installationId of the chosen runtime
 *   selected_tool        — CLI tool id (e.g. "stripe-cli")
 *   selected_skill       — skill slug
 *   routing_reason       — human-readable rationale (truncated to 1k)
 *   routing_confidence   — 0..1 numeric
 *   approval_required    — boolean; mirror of risk gate at task level
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { mutationLimiter } from '@/lib/rate-limit'
import { getDatabase, logAuditEvent, db_helpers } from '@/lib/db'

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const rl = mutationLimiter(request)
  if (rl) return rl
  const auth = requireRole(request, 'operator')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const params = await ctx.params
  const taskId = Number(params.id)
  if (!Number.isFinite(taskId) || taskId <= 0) {
    return NextResponse.json({ error: 'invalid task id' }, { status: 400 })
  }
  const workspaceId = auth.user.workspace_id ?? 1

  let body: {
    assigned_runtime?: string
    selected_tool?: string | null
    selected_skill?: string | null
    routing_reason?: string | null
    routing_confidence?: number | null
    approval_required?: boolean
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 })
  }
  if (!body.assigned_runtime || typeof body.assigned_runtime !== 'string') {
    return NextResponse.json(
      { error: 'assigned_runtime is required (the runtime_id / installationId)' },
      { status: 400 },
    )
  }
  if (
    body.routing_confidence !== undefined &&
    body.routing_confidence !== null &&
    (typeof body.routing_confidence !== 'number' ||
      body.routing_confidence < 0 ||
      body.routing_confidence > 1)
  ) {
    return NextResponse.json({ error: 'routing_confidence must be between 0 and 1' }, { status: 400 })
  }

  const db = getDatabase()
  const existing = db
    .prepare('SELECT id FROM tasks WHERE id = ? AND workspace_id = ?')
    .get(taskId, workspaceId) as { id: number } | undefined
  if (!existing) return NextResponse.json({ error: 'task not found' }, { status: 404 })

  const now = Math.floor(Date.now() / 1000)
  db.prepare(
    `UPDATE tasks
       SET assigned_runtime = ?, selected_tool = ?, selected_skill = ?,
           routing_reason = ?, routing_confidence = ?,
           router_approval_required = ?, router_decided_at = ?, updated_at = ?
     WHERE id = ? AND workspace_id = ?`,
  ).run(
    body.assigned_runtime,
    body.selected_tool ?? null,
    body.selected_skill ?? null,
    body.routing_reason ? body.routing_reason.toString().slice(0, 1000) : null,
    body.routing_confidence ?? null,
    body.approval_required ? 1 : 0,
    now,
    now,
    taskId,
    workspaceId,
  )

  const actor = auth.user.username || `user:${auth.user.id}`
  logAuditEvent({
    action: 'task_router_decision',
    actor,
    target_type: 'task',
    target_id: taskId,
    detail: {
      assigned_runtime: body.assigned_runtime,
      selected_tool: body.selected_tool ?? null,
      selected_skill: body.selected_skill ?? null,
      routing_confidence: body.routing_confidence ?? null,
      approval_required: !!body.approval_required,
    },
  })
  db_helpers.logActivity(
    'task_router_decision',
    'task',
    taskId,
    actor,
    `Router assigned ${body.assigned_runtime}${body.selected_tool ? ` · ${body.selected_tool}` : ''}`,
    {
      assigned_runtime: body.assigned_runtime,
      selected_tool: body.selected_tool ?? null,
      selected_skill: body.selected_skill ?? null,
      routing_reason: body.routing_reason ?? null,
      routing_confidence: body.routing_confidence ?? null,
      approval_required: !!body.approval_required,
    },
    workspaceId,
  )

  const updated = db
    .prepare(
      `SELECT id, title, status, assigned_runtime, selected_tool, selected_skill,
              routing_reason, routing_confidence, router_approval_required,
              router_decided_at
       FROM tasks WHERE id = ? AND workspace_id = ?`,
    )
    .get(taskId, workspaceId)
  return NextResponse.json({ task: updated })
}

export const dynamic = 'force-dynamic'
