/**
 * /api/tool-executions/:id
 *
 * GET   — full execution detail (workspace-scoped).
 * PATCH — runtime updates lifecycle: status, exit_code, stdout/stderr,
 *         proof, cost. Status transitions validated in the lib.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { mutationLimiter } from '@/lib/rate-limit'
import {
  getToolExecution,
  patchToolExecution,
  type ToolExecutionStatus,
} from '@/lib/baseline-os/tool-executions'

function parseId(s: string): number | null {
  const n = Number(s)
  return Number.isFinite(n) && n > 0 ? n : null
}

export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const params = await ctx.params
  const id = parseId(params.id)
  if (!id) return NextResponse.json({ error: 'invalid id' }, { status: 400 })
  const workspaceId = auth.user.workspace_id ?? 1
  const exec = getToolExecution(workspaceId, id)
  if (!exec) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json({ execution: exec })
}

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const rl = mutationLimiter(request)
  if (rl) return rl
  const auth = requireRole(request, 'operator')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const params = await ctx.params
  const id = parseId(params.id)
  if (!id) return NextResponse.json({ error: 'invalid id' }, { status: 400 })
  const workspaceId = auth.user.workspace_id ?? 1

  let body: {
    status?: ToolExecutionStatus
    started_at?: number
    completed_at?: number
    exit_code?: number
    stdout_summary?: string
    stderr_summary?: string
    proof_url?: string | null
    proof_payload?: Record<string, unknown> | null
    cost_estimate?: number | null
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 })
  }
  try {
    const updated = patchToolExecution({
      workspace_id: workspaceId,
      id,
      actor: auth.user.username || `user:${auth.user.id}`,
      ...body,
    })
    if (!updated) return NextResponse.json({ error: 'not found' }, { status: 404 })
    return NextResponse.json({ execution: updated })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'patch failed' }, { status: 409 })
  }
}

export const dynamic = 'force-dynamic'
