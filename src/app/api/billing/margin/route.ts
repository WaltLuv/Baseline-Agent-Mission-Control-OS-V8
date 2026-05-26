import { NextResponse } from 'next/server'
import { getWorkspaceFromAuth } from '@/lib/auth'
import { getMarginReport } from '@/lib/billing'

export async function GET(request: Request) {
  const workspace = await getWorkspaceFromAuth()
  if (!workspace) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const timeframe = (searchParams.get('timeframe') as 'day' | 'week' | 'month' | 'all') || 'week'

  const report = getMarginReport(workspace.id, timeframe)
  return NextResponse.json(report)
}
