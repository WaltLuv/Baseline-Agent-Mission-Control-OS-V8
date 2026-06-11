/**
 * POST /api/demo/reset → reset the demo workspace to a clean running state.
 *
 * Wipes the seeded PM operational data (work orders, owner approvals,
 * comms log, maintenance replays) and re-provisions the full first-run demo
 * (workforce template + live scenarios + performance), so an operator can
 * experiment freely and reset back to a pristine, already-running business.
 *
 * operator+ (mutating). Workspace-scoped. Idempotent.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { logAuditEvent } from '@/lib/db'
import { clearDemo, demoStatus } from '@/lib/pm/demo-seed'
import { provisionFirstRunDemo } from '@/lib/pm/first-run-demo'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const auth = requireRole(request, 'operator')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const ws = auth.user.workspace_id ?? 1
  clearDemo(ws)
  const provisioned = await provisionFirstRunDemo(ws, auth.user.username)

  logAuditEvent({
    action: 'demo_reset',
    actor: auth.user.username,
    actor_id: auth.user.id,
    detail: { workspace_id: ws, provisioned },
  })

  return NextResponse.json({ ok: true, reset: true, provisioned, status: demoStatus(ws) }, { status: 200 })
}
