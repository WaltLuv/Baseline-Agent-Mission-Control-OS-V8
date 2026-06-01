/**
 * POST /api/tool-executions/:id/approve
 * Owner / admin approves a HIGH-risk execution. Only valid from
 * `awaiting_approval`. Audit logged.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { mutationLimiter } from '@/lib/rate-limit'
import { approveToolExecution } from '@/lib/baseline-os/tool-executions'

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const rl = mutationLimiter(request)
  if (rl) return rl
  const auth = requireRole(request, 'admin')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const params = await ctx.params
  const id = Number(params.id)
  if (!Number.isFinite(id) || id <= 0) return NextResponse.json({ error: 'invalid id' }, { status: 400 })
  const workspaceId = auth.user.workspace_id ?? 1
  try {
    const updated = approveToolExecution(workspaceId, id, auth.user.username || `user:${auth.user.id}`)
    if (!updated) return NextResponse.json({ error: 'not found' }, { status: 404 })
    return NextResponse.json({ execution: updated })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'approve failed' }, { status: 409 })
  }
}

export const dynamic = 'force-dynamic'
