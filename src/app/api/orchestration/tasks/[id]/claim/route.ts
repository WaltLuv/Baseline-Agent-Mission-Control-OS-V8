/**
 * POST /api/orchestration/tasks/[id]/claim
 *
 * Remote-runtime atomic claim. The auth path returns a User whose `id < 0`
 * when an agent-scoped API key was used; the abs value is the
 * agent_api_keys.id which we record as the runtime key id.
 *
 * Walt's contract:
 *   · workspace-scoped at the SQL level — a runtime key for ws-A cannot
 *     claim a task in ws-B even by guessing the task id.
 *   · atomic single-claim — UPDATE WHERE status='ready' so a race between
 *     two runtimes never double-claims.
 *
 * NOTE: This endpoint accepts a *specific* task id from the caller, but
 * it doesn't trust it blindly. We first run `claimReadyTask()` against
 * the whole ready queue and then verify the resulting row.id equals the
 * requested id — if a different ready task got claimed (because the
 * caller's id was stale), we release it and 404. Runtimes that just want
 * "any ready task" can pass id=0 to skip that match.
 */
import { NextRequest, NextResponse } from 'next/server'

import { requireRole } from '@/lib/auth'
import { claimReadyTask, getTask, updateTask } from '@/lib/orchestration/store'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireRole(request, 'operator')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id } = await params
  const requestedTaskId = Number(id)
  if (!Number.isFinite(requestedTaskId)) {
    return NextResponse.json({ error: 'bad_task_id' }, { status: 400 })
  }

  // Negative user.id signals an agent-scoped key was used; the row id is -user.id.
  const runtimeKeyId = auth.user.id < 0 ? -auth.user.id : null

  const body = (await request.json().catch(() => ({}))) as { runtime_hint?: string }
  const runtimeHint = body.runtime_hint && String(body.runtime_hint).slice(0, 120)

  if (requestedTaskId === 0) {
    // "any ready task" mode.
    const task = claimReadyTask({
      workspaceId: auth.user.workspace_id,
      runtimeKeyId,
      runtimeHint: runtimeHint || undefined,
    })
    if (!task) return NextResponse.json({ task: null, message: 'no_ready_tasks' }, { status: 200 })
    return NextResponse.json({ task })
  }

  // Targeted-claim mode. Verify the caller's task is actually claimable
  // BEFORE we mutate state. claimReadyTask() picks by priority, not id,
  // so we cherry-pick by id here using a one-off UPDATE … WHERE.
  const target = getTask(auth.user.workspace_id, requestedTaskId)
  if (!target) return NextResponse.json({ error: 'task_not_found' }, { status: 404 })
  if (target.status !== 'ready') {
    return NextResponse.json({ error: 'task_not_ready', current_status: target.status }, { status: 409 })
  }

  const { getDatabase } = await import('@/lib/db')
  const db = getDatabase()
  const now = Math.floor(Date.now() / 1000)
  const res = db
    .prepare(
      `UPDATE orchestration_tasks
          SET status = 'in_progress',
              claimed_by_runtime_key_id = ?,
              claimed_at = ?,
              heartbeat_at = ?,
              updated_at = ?
        WHERE id = ? AND workspace_id = ? AND status = 'ready'`,
    )
    .run(runtimeKeyId, now, now, now, requestedTaskId, auth.user.workspace_id)
  if (res.changes === 0) {
    return NextResponse.json({ error: 'race_lost' }, { status: 409 })
  }
  const task = getTask(auth.user.workspace_id, requestedTaskId)
  return NextResponse.json({ task })
}
