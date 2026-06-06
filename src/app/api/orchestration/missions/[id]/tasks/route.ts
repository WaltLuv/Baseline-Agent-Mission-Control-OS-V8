/**
 * POST /api/orchestration/missions/[id]/tasks — create task under a mission
 */
import { NextRequest, NextResponse } from 'next/server'

import { requireRole } from '@/lib/auth'
import { createTask, getMission } from '@/lib/orchestration/store'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireRole(request, 'operator')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { id } = await params
  const missionId = Number(id)
  if (!Number.isFinite(missionId)) return NextResponse.json({ error: 'bad_mission_id' }, { status: 400 })

  const mission = getMission(auth.user.workspace_id, missionId)
  if (!mission) return NextResponse.json({ error: 'mission_not_found' }, { status: 404 })

  const body = (await request.json().catch(() => ({}))) as {
    title?: string
    description?: string
    tag?: string
    assignee?: string
    runtime_hint?: string
    priority?: number
    payload?: Record<string, unknown>
    approval_policy?: 'auto' | 'operator' | 'required'
    depends_on?: number[]
    maestro_task_id?: string
    source?: 'cloud' | 'baseline-local' | 'maestro-import'
  }
  if (!body.title) return NextResponse.json({ error: 'title_required' }, { status: 400 })

  try {
    const task = createTask({
      workspaceId: auth.user.workspace_id,
      missionId,
      title: String(body.title).slice(0, 240),
      description: body.description ? String(body.description).slice(0, 4000) : undefined,
      tag: body.tag ? String(body.tag).slice(0, 64) : undefined,
      assignee: body.assignee ? String(body.assignee).slice(0, 120) : undefined,
      runtime_hint: body.runtime_hint ? String(body.runtime_hint).slice(0, 120) : undefined,
      priority: Number.isFinite(body.priority) ? Number(body.priority) : 0,
      payload: body.payload && typeof body.payload === 'object' ? body.payload : undefined,
      approval_policy: body.approval_policy,
      depends_on: Array.isArray(body.depends_on) ? body.depends_on.map((n) => Number(n)).filter(Number.isFinite) : undefined,
      maestro_task_id: body.maestro_task_id ? String(body.maestro_task_id).slice(0, 120) : undefined,
      source: body.source,
      userId: auth.user.id > 0 ? auth.user.id : undefined,
    })
    return NextResponse.json({ task }, { status: 201 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'create_failed'
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
