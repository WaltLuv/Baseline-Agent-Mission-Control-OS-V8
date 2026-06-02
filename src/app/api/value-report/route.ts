import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { aggregateValueReport } from '@/lib/value-report/aggregator'

/**
 * GET /api/value-report
 *
 * Lifetime "Show your boss" value for the current workspace. Uses the
 * same Mission Control tables as Daily Brief — never reaches into
 * Baseline OS decisioning. When Baseline OS exposes a value endpoint,
 * `BASELINE_OS_VALUE_REPORT_URL` proxies it through unchanged.
 */
export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }
  const workspaceId = auth.user.workspace_id ?? 1

  const baselineOsUrl = process.env.BASELINE_OS_VALUE_REPORT_URL
  if (baselineOsUrl) {
    try {
      const r = await fetch(`${baselineOsUrl}?workspace_id=${workspaceId}`, { cache: 'no-store' })
      if (r.ok) {
        const payload = await r.json()
        if (payload && typeof payload === 'object' && 'lifetime' in payload) {
          return NextResponse.json(payload)
        }
      }
    } catch {
      /* fall through */
    }
  }

  const report = aggregateValueReport(workspaceId)
  return NextResponse.json(report)
}

export const dynamic = 'force-dynamic'
