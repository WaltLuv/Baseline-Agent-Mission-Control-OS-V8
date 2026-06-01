/**
 * GET /api/runtimes/:id/tasks
 *
 * Tasks Baseline OS's Workforce Router assigned to this runtime. The
 * router writes `assigned_runtime` on the task with the runtime's
 * `installationId` (a.k.a. runtime_id in the Phase 1 projection). We
 * join those rows back here. Workspace-scoped at the SQL level.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { getDatabase } from '@/lib/db'
import { getRuntimeByInternalId } from '@/lib/baseline-os/runtime-registry'

export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const params = await ctx.params
  const id = Number(params.id)
  if (!Number.isFinite(id) || id <= 0) return NextResponse.json({ error: 'invalid id' }, { status: 400 })
  const workspaceId = auth.user.workspace_id ?? 1
  const rec = getRuntimeByInternalId(workspaceId, id)
  if (!rec) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const db = getDatabase()
  const tasks = db
    .prepare(
      `SELECT id, title, status, priority, assigned_to,
              assigned_runtime, selected_tool, selected_skill,
              routing_reason, routing_confidence, router_approval_required,
              router_decided_at, created_at, updated_at, completed_at
       FROM tasks
       WHERE workspace_id = ? AND assigned_runtime = ?
       ORDER BY router_decided_at DESC NULLS LAST, id DESC
       LIMIT 100`,
    )
    .all(workspaceId, rec.installationId)
  return NextResponse.json({
    runtime_id: rec.installationId,
    internal_id: rec.id,
    tasks,
  })
}

export const dynamic = 'force-dynamic'
