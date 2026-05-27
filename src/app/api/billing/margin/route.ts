import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { getMarginReport } from '@/lib/billing'

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const workspaceId = auth.user.workspace_id ?? 1
  const { searchParams } = new URL(request.url)
  const tf = (searchParams.get('timeframe') || 'week') as 'day' | 'week' | 'month' | 'all'
  const timeframe: 'day' | 'week' | 'month' | 'all' =
    tf === 'day' || tf === 'week' || tf === 'month' || tf === 'all' ? tf : 'week'

  const report = getMarginReport(workspaceId, timeframe)
  return NextResponse.json(report)
}
