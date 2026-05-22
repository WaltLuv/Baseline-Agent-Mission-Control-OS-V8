import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { runDiscoveryScan, getScanRuns, markRegistered } from '@/lib/agent-scanner'

/**
 * POST /api/scanner/scan
 * Admin-only. Triggers a discovery scan of local AI tools.
 * Scanner is read-only and disabled by default.
 */
export async function POST(request: NextRequest) {
  const auth = requireRole(request, 'admin')
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const { register } = body as { register?: Array<{ scanId: string; locationId: string }> }

    // If registration requests are included, process them
    if (register && Array.isArray(register)) {
      for (const entry of register) {
        markRegistered(entry.scanId, entry.locationId)
      }
    }

    // Always run a fresh scan on POST
    const scanRun = await runDiscoveryScan()

    return NextResponse.json({
      success: true,
      scan: scanRun,
      message: `Discovery complete. Found ${scanRun.summary.detected} of ${scanRun.summary.total} locations.`,
    })
  } catch (error) {
    logger.error({ err: error }, 'Agent scanner error')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * GET /api/scanner/runs
 * Admin-only. Returns scan run history.
 */
export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'admin')
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  try {
    const runs = getScanRuns()
    return NextResponse.json({ runs, total: runs.length })
  } catch (error) {
    logger.error({ err: error }, 'Agent scanner runs error')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
