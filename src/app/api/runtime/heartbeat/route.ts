import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { tokenReportLimiter } from '@/lib/rate-limit'
import { recordHeartbeat } from '@/lib/baseline-os/runtime-registry'

/**
 * POST /api/runtime/heartbeat
 *
 * Lightweight periodic ping. Runtimes call this every ~60s. Updates
 * `last_seen_at`, active task count, and health.
 */
export async function POST(request: NextRequest) {
  const rl = tokenReportLimiter(request)
  if (rl) return rl
  const auth = requireRole(request, 'operator')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const workspaceId = auth.user.workspace_id ?? 1
  let body: { kind?: string; installationId?: string; taskCount?: number; health?: 'green' | 'amber' | 'red' }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'invalid JSON' }, { status: 400 }) }
  if (!body.kind || !body.installationId) {
    return NextResponse.json({ error: 'kind and installationId are required' }, { status: 400 })
  }
  const rec = recordHeartbeat(workspaceId, {
    kind: body.kind,
    installationId: body.installationId,
    taskCount: body.taskCount,
    health: body.health,
  })
  if (!rec) return NextResponse.json({ error: 'runtime not registered — call /api/runtime/handshake first' }, { status: 404 })
  return NextResponse.json({ ok: true, runtime: rec })
}

export const dynamic = 'force-dynamic'
