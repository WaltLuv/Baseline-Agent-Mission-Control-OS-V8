/**
 * GET /api/runtimes/:id  — single runtime detail, workspace-scoped.
 * :id is the numeric `runtime_registry.id`. Returns the Phase 1 projection
 * shape used by Mission Control UI surfaces.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { getRuntimeByInternalId, toProjection } from '@/lib/baseline-os/runtime-registry'

export async function GET(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const params = await ctx.params
  const id = Number(params.id)
  if (!Number.isFinite(id) || id <= 0) return NextResponse.json({ error: 'invalid id' }, { status: 400 })
  const workspaceId = auth.user.workspace_id ?? 1
  const rec = getRuntimeByInternalId(workspaceId, id)
  if (!rec) return NextResponse.json({ error: 'not found' }, { status: 404 })
  return NextResponse.json({ runtime: toProjection(rec) })
}

export const dynamic = 'force-dynamic'
