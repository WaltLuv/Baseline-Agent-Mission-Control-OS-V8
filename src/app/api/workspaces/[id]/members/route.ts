import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { listWorkspaceMembers } from '@/lib/memberships'

/**
 * GET /api/workspaces/[id]/members
 *
 * Returns the workspace's roster. Workspace-scoped: only members of the
 * workspace can see the roster. Used by the TeamPanel (`/app/team`).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const workspaceId = parseInt(id, 10)
  if (!Number.isFinite(workspaceId) || workspaceId <= 0) {
    return NextResponse.json({ error: 'Invalid workspace id' }, { status: 400 })
  }
  if (workspaceId !== user.workspace_id) {
    return NextResponse.json({ error: 'Forbidden — cross-workspace access denied' }, { status: 403 })
  }

  const members = listWorkspaceMembers(workspaceId)
  return NextResponse.json({ members, workspace_id: workspaceId, count: members.length })
}

export const dynamic = 'force-dynamic'
