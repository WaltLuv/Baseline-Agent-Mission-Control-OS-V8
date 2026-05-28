import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { workforceRecommendations, sevenDayForecast } from '@/lib/baseline-os/trace-derivation'

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const workspaceId = auth.user.workspace_id ?? 1
  return NextResponse.json({
    recommendations: workforceRecommendations(workspaceId),
    forecast: sevenDayForecast(workspaceId),
  })
}

export const dynamic = 'force-dynamic'
