import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { tokenReportLimiter } from '@/lib/rate-limit'
import { registerHandshake, recordHeartbeat, runtimeRegistrySnapshot } from '@/lib/baseline-os/runtime-registry'

/**
 * GET /api/runtime/handshake — snapshot of runtimes registered in this workspace.
 * POST /api/runtime/handshake — runtime boot announcement. Idempotent.
 * Body: { kind, installationId, label?, version?, capabilities?[] }
 */
export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const workspaceId = auth.user.workspace_id ?? 1
  return NextResponse.json({ runtimes: runtimeRegistrySnapshot(workspaceId) })
}

export async function POST(request: NextRequest) {
  const rl = tokenReportLimiter(request)
  if (rl) return rl
  const auth = requireRole(request, 'operator')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const workspaceId = auth.user.workspace_id ?? 1
  let body: { kind?: string; installationId?: string; label?: string; version?: string; capabilities?: string[]; heartbeat?: boolean; taskCount?: number; health?: 'green' | 'amber' | 'red' }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'invalid JSON' }, { status: 400 }) }
  if (!body.kind || !body.installationId) {
    return NextResponse.json({ error: 'kind and installationId are required' }, { status: 400 })
  }
  // Composite call: a heartbeat payload may be sent with handshake (re-registration on reboot).
  const record = body.heartbeat
    ? recordHeartbeat(workspaceId, { kind: body.kind, installationId: body.installationId, taskCount: body.taskCount, health: body.health })
    : registerHandshake(workspaceId, {
        kind: body.kind,
        installationId: body.installationId,
        label: body.label,
        version: body.version ?? null,
        capabilities: body.capabilities ?? [],
      })
  return NextResponse.json({ ok: true, runtime: record })
}

export const dynamic = 'force-dynamic'
