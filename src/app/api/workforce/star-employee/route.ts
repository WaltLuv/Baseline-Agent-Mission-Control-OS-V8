/**
 * GET /api/workforce/star-employee
 *
 * The workspace's current top-performing AI employee, ranked by completed
 * work × accuracy. viewer+ (read-only). Returns { star: null } when there is
 * no performance data yet so the dashboard can hide the card.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { getStarEmployee } from '@/lib/pm/star-employee'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const star = getStarEmployee(auth.user.workspace_id ?? 1)
  return NextResponse.json({ star })
}
