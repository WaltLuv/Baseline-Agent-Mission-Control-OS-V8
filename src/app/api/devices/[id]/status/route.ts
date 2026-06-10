import { NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { claimDeviceStatus, listDevices } from '@/lib/device-pairing'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/devices/:id/status
 *
 * Two callers:
 *  - Device poll: :id = device_id, with ?claim=<claim_token>. Once approved, the
 *    device token is minted and returned ONCE; subsequent polls return status only.
 *  - Authenticated view: :id = device_id, no claim → returns workspace-scoped status.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const claim = new URL(request.url).searchParams.get('claim') || request.headers.get('x-claim-token') || ''

  if (claim) {
    // Device-side poll/claim — authenticated by the one-time claim token.
    return NextResponse.json(claimDeviceStatus(id, claim))
  }

  // Authenticated, workspace-scoped status view.
  const user = getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const device = listDevices(user.workspace_id).find((d) => d.device_id === id)
  if (!device) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  return NextResponse.json({ device })
}
