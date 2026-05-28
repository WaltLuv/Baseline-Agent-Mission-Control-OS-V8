import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { skillRoiLeaderboard } from '@/lib/baseline-os/trace-derivation'

/**
 * GET /api/baseline-os/skill-leaderboard
 *
 * Top value-creating skills this month — drives the Executive Briefing
 * leaderboard. Workspace-scoped. Honest empty array when no activity.
 */
export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const workspaceId = auth.user.workspace_id ?? 1
  const url = new URL(request.url)
  const limit = Math.min(10, Math.max(1, Number(url.searchParams.get('limit') ?? 3)))
  return NextResponse.json({ leaders: skillRoiLeaderboard(workspaceId, limit) })
}

export const dynamic = 'force-dynamic'
