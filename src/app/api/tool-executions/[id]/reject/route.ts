/**
 * POST /api/tool-executions/:id/reject
 * Owner / admin rejects a pending HIGH-risk execution with optional
 * reason. Audit logged.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { mutationLimiter } from '@/lib/rate-limit'
import { rejectToolExecution } from '@/lib/baseline-os/tool-executions'

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const rl = mutationLimiter(request)
  if (rl) return rl
  const auth = requireRole(request, 'admin')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const params = await ctx.params
  const id = Number(params.id)
  if (!Number.isFinite(id) || id <= 0) return NextResponse.json({ error: 'invalid id' }, { status: 400 })
  const workspaceId = auth.user.workspace_id ?? 1

  let body: { reason?: string } = {}
  try {
    body = await request.json()
  } catch {
    // empty body is fine
  }
  try {
    const updated = rejectToolExecution(
      workspaceId,
      id,
      auth.user.username || `user:${auth.user.id}`,
      body.reason?.toString().slice(0, 500),
    )
    if (!updated) return NextResponse.json({ error: 'not found' }, { status: 404 })
    return NextResponse.json({ execution: updated })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'reject failed' }, { status: 409 })
  }
}

export const dynamic = 'force-dynamic'
