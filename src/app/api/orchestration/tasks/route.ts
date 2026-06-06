/**
 * GET /api/orchestration/tasks?mission_id=&status= — list workspace tasks
 */
import { NextRequest, NextResponse } from 'next/server'

import { requireRole } from '@/lib/auth'
import { listTasks, type TaskStatus } from '@/lib/orchestration/store'

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const url = new URL(request.url)
  const filter: { mission_id?: number; status?: TaskStatus } = {}
  const mid = url.searchParams.get('mission_id')
  if (mid && Number.isFinite(Number(mid))) filter.mission_id = Number(mid)
  const st = url.searchParams.get('status') as TaskStatus | null
  if (st) filter.status = st
  return NextResponse.json({ tasks: listTasks(auth.user.workspace_id, filter) })
}
