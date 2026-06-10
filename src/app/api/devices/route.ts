import { NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/auth'
import { deviceSummary, listDevices } from '@/lib/device-pairing'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/devices — authenticated, workspace-scoped list + summary counts.
 * Returns safe DTOs only (no hashes/tokens).
 */
export async function GET(request: Request) {
  const user = getUserFromRequest(request)
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  return NextResponse.json({
    devices: listDevices(user.workspace_id),
    summary: deviceSummary(user.workspace_id),
    can_manage: user.role === 'admin' || (user.role as string) === 'owner',
  })
}
