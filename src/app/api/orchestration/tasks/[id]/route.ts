/**
 * GET /api/orchestration/tasks/[id]      — single task (workspace-scoped)
 * PUT /api/orchestration/tasks/[id]      — runtime / operator status update + heartbeat
 */
import { NextRequest, NextResponse } from 'next/server'

import { requireRole } from '@/lib/auth'
import { getTask, updateTask, type TaskStatus } from '@/lib/orchestration/store'

const ALLOWED_STATUS: TaskStatus[] = [
  'todo', 'ready', 'in_progress', 'approval_required', 'blocked', 'failed', 'done',
]

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { id } = await params
  const taskId = Number(id)
  if (!Number.isFinite(taskId)) return NextResponse.json({ error: 'bad_task_id' }, { status: 400 })
  const task = getTask(auth.user.workspace_id, taskId)
  if (!task) return NextResponse.json({ error: 'task_not_found' }, { status: 404 })
  return NextResponse.json({ task })
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireRole(request, 'operator')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id } = await params
  const taskId = Number(id)
  if (!Number.isFinite(taskId)) return NextResponse.json({ error: 'bad_task_id' }, { status: 400 })

  const body = (await request.json().catch(() => ({}))) as {
    status?: TaskStatus
    heartbeat?: boolean
    result?: Record<string, unknown>
    error?: string
  }
  if (body.status && !ALLOWED_STATUS.includes(body.status)) {
    return NextResponse.json({ error: 'bad_status' }, { status: 400 })
  }

  const runtimeKeyId = auth.user.id < 0 ? -auth.user.id : null

  try {
    const task = updateTask({
      workspaceId: auth.user.workspace_id,
      taskId,
      runtimeKeyId,
      userId: auth.user.id > 0 ? auth.user.id : null,
      status: body.status,
      heartbeat: !!body.heartbeat,
      result: body.result,
      error: body.error ? String(body.error).slice(0, 1024) : undefined,
    })
    if (!task) return NextResponse.json({ error: 'task_not_found' }, { status: 404 })
    return NextResponse.json({ task })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'update_failed'
    const status = msg === 'runtime_key_mismatch' ? 403 : 400
    return NextResponse.json({ error: msg }, { status })
  }
}
