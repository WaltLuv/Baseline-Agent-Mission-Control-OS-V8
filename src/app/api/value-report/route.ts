import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { aggregateValueReport, type ValueReport } from '@/lib/value-report/aggregator'
import {
  adaptBaselineOsRoiToConsumer,
  isClaudeBaselineOsRoi,
} from '@/lib/value-report/baseline-os-adapter'

/**
 * GET /api/value-report
 *
 * Lifetime "Show your boss" value for the current workspace.
 * - If BASELINE_OS_VALUE_REPORT_URL is set, this route proxies that
 *   payload, runs it through the Claude→consumer ROI adapter (no
 *   formulas, pure rename), and ships it as `source: 'baseline-os'`.
 * - Otherwise the Mission Control fallback aggregator runs locally
 *   and returns `source: 'mission-control-fallback'`.
 *
 * Lane discipline: Baseline OS owns labor-value / hours / cost
 * formulas. Mission Control owns how the report is rendered.
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
      const target =
        `${baselineOsUrl}` +
        (baselineOsUrl.includes('?') ? '&' : '?') +
        `workspace_id=${workspaceId}`
      const r = await fetch(target, {
        headers: {
          'x-mission-control-workspace': String(workspaceId),
          accept: 'application/json',
        },
        cache: 'no-store',
        signal: AbortSignal.timeout(5000),
      })
      if (r.ok) {
        const raw = (await r.json()) as unknown
        if (
          raw &&
          typeof raw === 'object' &&
          'lifetime' in raw &&
          'by_persona' in raw
        ) {
          const passthrough = raw as ValueReport
          return NextResponse.json({ ...passthrough, source: 'baseline-os' })
        }
        if (isClaudeBaselineOsRoi(raw)) {
          const adapted = adaptBaselineOsRoiToConsumer(raw, { workspaceId })
          return NextResponse.json(adapted)
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
