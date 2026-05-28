import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { approvalQueue } from '@/lib/baseline-os/trace-derivation'

/**
 * GET /api/approvals/queue
 *
 * All open approvals across the workspace with the matched memory
 * rationale that surfaces "why this was escalated" directly on each
 * row. Read-only — actions (approve / reject / request changes) flow
 * through the existing task-update endpoints.
 */
export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const workspaceId = auth.user.workspace_id ?? 1
  return NextResponse.json({ items: approvalQueue(workspaceId) })
}

export const dynamic = 'force-dynamic'
