/**
 * GET /api/workspace/capabilities — the Workspace Capability Matrix.
 *
 * The single source of truth for what can/cannot execute in this workspace and
 * why. viewer+ (read-only). Workspace-scoped. No fake connected states.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { getDatabase } from '@/lib/db'
import { computeCapabilityMatrix } from '@/lib/workspace/capability-matrix'

export const dynamic = 'force-dynamic'

function flightDeckOnline(ws: number): boolean {
  try {
    const cutoff = Math.floor(Date.now() / 1000) - 120
    const row = getDatabase()
      .prepare(`SELECT COUNT(*) n FROM paired_devices WHERE workspace_id = ? AND status = 'paired' AND last_seen_at >= ?`)
      .get(ws, cutoff) as { n: number } | undefined
    return (row?.n ?? 0) > 0
  } catch {
    return false
  }
}

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const ws = auth.user.workspace_id ?? 1
  const capabilities = computeCapabilityMatrix(ws, { flightDeckOnline: flightDeckOnline(ws) })
  const summary = {
    total: capabilities.length,
    ready: capabilities.filter((c) => ['ready', 'connected', 'workflow_ready', 'api_connected', 'browser_automation_ready'].includes(c.status)).length,
    blocked: capabilities.filter((c) => ['needs_credentials', 'needs_runtime', 'setup_needed', 'offline'].includes(c.status)).length,
  }
  return NextResponse.json({ workspace_id: ws, summary, capabilities })
}
