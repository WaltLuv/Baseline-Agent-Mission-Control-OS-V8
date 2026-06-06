/**
 * POST /api/orchestration/tasks/[id]/dependencies — add a dependency edge
 */
import { NextRequest, NextResponse } from 'next/server'

import { requireRole } from '@/lib/auth'
import { addDependency } from '@/lib/orchestration/store'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireRole(request, 'operator')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id } = await params
  const taskId = Number(id)
  if (!Number.isFinite(taskId)) return NextResponse.json({ error: 'bad_task_id' }, { status: 400 })

  const body = (await request.json().catch(() => ({}))) as { depends_on?: number }
  const dep = Number(body.depends_on)
  if (!Number.isFinite(dep) || dep === taskId) {
    return NextResponse.json({ error: 'bad_depends_on' }, { status: 400 })
  }

  const ok = addDependency({
    workspaceId: auth.user.workspace_id,
    taskId,
    dependsOn: dep,
    userId: auth.user.id > 0 ? auth.user.id : undefined,
  })
  if (!ok) return NextResponse.json({ error: 'workspace_mismatch_or_duplicate' }, { status: 400 })
  return NextResponse.json({ ok: true })
}
