import { NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { canManageDevices, revokeDevice } from '@/lib/device-pairing'
import { logSecurityEvent } from '@/lib/security-events'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * POST /api/devices/:id/revoke
 * Authenticated + workspace-scoped + role-gated (owner/admin). Clears the device
 * token so its next heartbeat fails; the device then drops its local token.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  if (!canManageDevices(user.role)) {
    return NextResponse.json({ error: 'forbidden', detail: 'owner/admin role required' }, { status: 403 })
  }

  const numericId = Number(id)
  if (!Number.isFinite(numericId)) return NextResponse.json({ error: 'invalid_id' }, { status: 400 })

  const result = revokeDevice(numericId, user.workspace_id)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 404 })

  try {
    logSecurityEvent({
      event_type: 'device_revoked',
      severity: 'warning',
      source: 'device-pairing',
      detail: JSON.stringify({ device_row_id: numericId, by: user.username }),
      workspace_id: user.workspace_id,
    })
  } catch {
    /* */
  }

  return NextResponse.json({ ok: true })
}
