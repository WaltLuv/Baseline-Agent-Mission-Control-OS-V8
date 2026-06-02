import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { aggregateDailyBrief } from '@/lib/daily-brief/aggregator'
import {
  adaptBaselineOsBriefToConsumer,
  isClaudeBaselineOsBrief,
} from '@/lib/daily-brief/baseline-os-adapter'
import type { DailyBriefPayload, DailyBriefWindow } from '@/lib/daily-brief/types'

/**
 * GET /api/daily-brief?window=since-yesterday|since-last-login
 *
 * Owner: Mission Control consumes; Baseline OS is the source of truth.
 * - If BASELINE_OS_DAILY_BRIEF_URL is set, this route proxies that
 *   payload, runs it through the Claude→consumer adapter (no formulas,
 *   pure rename + safe defaults), and ships it to the UI as
 *   `source: 'baseline-os'`.
 * - Otherwise the Mission Control fallback aggregator runs locally and
 *   returns `source: 'mission-control-fallback'`.
 *
 * The consumer UI is identical in both cases — that's the lane line.
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

  const baselineOsUrl = process.env.BASELINE_OS_DAILY_BRIEF_URL
  if (baselineOsUrl) {
    try {
      const target =
        `${baselineOsUrl}` +
        (baselineOsUrl.includes('?') ? '&' : '?') +
        `workspace_id=${workspaceId}&user_id=${userId}&window=${window}`
      const r = await fetch(target, {
        headers: {
          'x-mission-control-workspace': String(workspaceId),
          accept: 'application/json',
        },
        cache: 'no-store',
        // 5s timeout — see lane discipline: MC must never block on Baseline OS.
        signal: AbortSignal.timeout(5000),
      })
      if (r.ok) {
        const raw = (await r.json()) as unknown
        // Already in the consumer shape — pass through as 'baseline-os'.
        if (
          raw &&
          typeof raw === 'object' &&
          'by_the_numbers' in raw &&
          'headline' in raw
        ) {
          const passthrough = raw as DailyBriefPayload
          return NextResponse.json({ ...passthrough, source: 'baseline-os' })
        }
        // Claude's v1 shape — adapt and ship.
        if (isClaudeBaselineOsBrief(raw)) {
          const adapted = adaptBaselineOsBriefToConsumer(raw, {
            workspaceId,
            window,
          })
          return NextResponse.json(adapted)
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
