import { NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { approvePairing, canManageDevices } from '@/lib/device-pairing'
import { logSecurityEvent } from '@/lib/security-events'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * POST /api/devices/pairing/approve
 * Authenticated + workspace-scoped + role-gated (owner/admin only).
 * Approves a pending device into the caller's workspace with a role + permissions.
 */
export async function POST(request: Request) {
  const user = getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!canManageDevices(user.role)) {
    return NextResponse.json({ error: 'forbidden', detail: 'owner/admin role required' }, { status: 403 })
  }

  let body: any = {}
  try {
    body = await request.json()
  } catch {
    /* */
  }
  const pairingCode = typeof body.pairing_code === 'string' ? body.pairing_code : ''
  if (!pairingCode.trim()) return NextResponse.json({ error: 'pairing_code required' }, { status: 400 })

  const result = approvePairing({
    pairing_code: pairingCode,
    workspace_id: user.workspace_id,
    user_id: user.id,
    role: body.role,
    permissions: body.permissions,
  })

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.error === 'pairing_expired' ? 410 : 400 })
  }

  try {
    logSecurityEvent({
      event_type: 'device_paired',
      severity: 'info',
      source: 'device-pairing',
      detail: JSON.stringify({ device_id: result.device!.device_id, role: result.device!.role, by: user.username }),
      workspace_id: user.workspace_id,
    })
  } catch {
    /* */
  }

  return NextResponse.json({ ok: true, device: result.device })
}
