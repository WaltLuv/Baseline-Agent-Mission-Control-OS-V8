import { NextResponse } from 'next/server'
import { heartbeat } from '@/lib/device-pairing'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function extractDeviceToken(request: Request): string | null {
  const bearer = (request.headers.get('authorization') || '').trim()
  if (bearer.toLowerCase().startsWith('bearer ')) return bearer.slice(7).trim() || null
  const header = (request.headers.get('x-device-token') || '').trim()
  return header || null
}

/**
 * POST /api/devices/heartbeat
 * Authenticated by the raw device token (Bearer / x-device-token). A revoked or
 * expired device gets 401 — the client clears its local token on that signal.
 */
export async function POST(request: Request) {
  const token = extractDeviceToken(request)
  if (!token) return NextResponse.json({ error: 'missing_device_token' }, { status: 401 })

  const result = heartbeat(token)
  if (!result.ok) {
    // 401 revoked / 410 expired → client must re-pair and clear local token.
    return NextResponse.json({ status: result.status }, { status: result.status === 'expired' ? 410 : 401 })
  }
  return NextResponse.json({
    status: result.status,
    role: result.role,
    permissions: result.permissions,
    workspace_id: result.workspace_id,
  })
}
