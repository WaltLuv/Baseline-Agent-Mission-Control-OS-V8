import { NextResponse } from 'next/server'
import { startPairing } from '@/lib/device-pairing'
import { logSecurityEvent } from '@/lib/security-events'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * POST /api/devices/pairing/start
 * Device-initiated. Unauthenticated (a pending request that an owner/admin must
 * approve while logged in). Returns a pairing code + a one-time claim token.
 */
export async function POST(request: Request) {
  let body: any = {}
  try {
    body = await request.json()
  } catch {
    /* empty body ok */
  }

  const result = startPairing({
    device_id: typeof body.device_id === 'string' ? body.device_id : undefined,
    device_name: typeof body.device_name === 'string' ? body.device_name.slice(0, 120) : undefined,
    device_type: typeof body.device_type === 'string' ? body.device_type.slice(0, 60) : undefined,
    platform: typeof body.platform === 'string' ? body.platform.slice(0, 60) : undefined,
    app_version: typeof body.app_version === 'string' ? body.app_version.slice(0, 40) : undefined,
    public_key: typeof body.public_key === 'string' ? body.public_key.slice(0, 1024) : undefined,
    device_fingerprint:
      typeof body.device_fingerprint === 'string' ? body.device_fingerprint.slice(0, 256) : undefined,
  })

  try {
    logSecurityEvent({
      event_type: 'device_pairing_started',
      severity: 'info',
      source: 'device-pairing',
      detail: JSON.stringify({ device_id: result.device_id, platform: body.platform ?? null }),
    })
  } catch {
    /* startup race */
  }

  const origin = new URL(request.url).origin
  return NextResponse.json({
    device_id: result.device_id,
    pairing_code: result.pairing_code,
    claim_token: result.claim_token,
    expires_at: result.expires_at,
    pairing_url: `${origin}/app/flight-deck?pair=${encodeURIComponent(result.pairing_code)}`,
  })
}
