import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { collaborationGraph } from '@/lib/baseline-os/trace-derivation'

/**
 * GET /api/baseline-os/collaboration-graph
 *
 * Derived collaboration intelligence — who works with whom, who hands off
 * to whom, who's a bottleneck — inferred from shared tasks in
 * `tasks(project_id, assignee)`. Honest empty graph when no shared work
 * exists. No fake edges in live mode.
 */
export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const workspaceId = auth.user.workspace_id ?? 1
  const graph = collaborationGraph(workspaceId)
  return NextResponse.json(graph)
}

export const dynamic = 'force-dynamic'
