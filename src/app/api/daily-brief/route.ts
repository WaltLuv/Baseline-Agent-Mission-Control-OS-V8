import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { aggregateDailyBrief } from '@/lib/daily-brief/aggregator'
import type { DailyBriefPayload, DailyBriefWindow } from '@/lib/daily-brief/types'

/**
 * GET /api/daily-brief?window=since-yesterday|since-last-login
 *
 * Owner: Mission Control consumes; Baseline OS is the eventual source of
 * truth. Today the route runs the Mission Control fallback aggregator.
 *
 * When Baseline OS exposes a brief, set `BASELINE_OS_DAILY_BRIEF_URL` and
 * this route will proxy that payload through unchanged (only validating
 * the `source` field). Until then, the local aggregator returns
 * `source: 'mission-control-fallback'` and the UI consumes the same shape.
 */
export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  const workspaceId = auth.user.workspace_id ?? 1
  const userId = auth.user.id ?? 0

  const url = new URL(request.url)
  const windowParam = (url.searchParams.get('window') ?? 'since-yesterday') as DailyBriefWindow
  const window: DailyBriefWindow =
    windowParam === 'since-last-login' ? 'since-last-login' : 'since-yesterday'

  // Future: proxy through Baseline OS if it exposes a brief endpoint.
  const baselineOsUrl = process.env.BASELINE_OS_DAILY_BRIEF_URL
  if (baselineOsUrl) {
    try {
      const r = await fetch(
        `${baselineOsUrl}?workspace_id=${workspaceId}&user_id=${userId}&window=${window}`,
        { headers: { 'x-mission-control-workspace': String(workspaceId) }, cache: 'no-store' },
      )
      if (r.ok) {
        const payload = (await r.json()) as DailyBriefPayload
        if (payload && typeof payload.headline === 'string') {
          return NextResponse.json(payload)
        }
      }
    } catch {
      // Fall through to local aggregator.
    }
  }

  const payload = aggregateDailyBrief({ workspaceId, userId, window })
  return NextResponse.json(payload)
}

export const dynamic = 'force-dynamic'
