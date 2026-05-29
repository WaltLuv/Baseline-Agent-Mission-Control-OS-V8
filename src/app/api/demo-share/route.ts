/**
 * POST /api/demo-share
 *
 * Creates a signed, time-limited, watermarked demo share link for the
 * given vertical. Requires authentication (operator or admin) — only
 * staff can mint demo links.
 *
 * Body: { vertical: string, ttlDays?: number, tour?: boolean, watermark?: boolean }
 * Returns: { ok, url, token, expiresAt, vertical }
 *
 * Security:
 *   - Vertical must be a known demo storyline (no arbitrary input).
 *   - TTL clamped to 1..30 days.
 *   - Token is self-contained — no DB row.
 *   - The token only grants read-demo permission; it can never mutate
 *     workspace state or expose live customer data, because demo mode
 *     overlays a curated storyline on the dashboard.
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/auth'
import { signDemoToken, buildShareUrl, DEFAULT_TTL_DAYS, MAX_TTL_DAYS } from '@/lib/demo-share'
import { DEMO_TEMPLATE_IDS } from '@/lib/demo-narratives'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const auth = requireRole(request, 'operator')
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  let body: { vertical?: string; ttlDays?: number; tour?: boolean; watermark?: boolean }
  try {
    body = (await request.json()) as typeof body
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const vertical = String(body.vertical ?? '').trim()
  if (!vertical || !DEMO_TEMPLATE_IDS.includes(vertical)) {
    return NextResponse.json(
      { error: 'Unknown vertical', supported: DEMO_TEMPLATE_IDS },
      { status: 400 },
    )
  }

  const ttlDays = Math.max(1, Math.min(MAX_TTL_DAYS, Number(body.ttlDays ?? DEFAULT_TTL_DAYS)))
  const tour = body.tour !== false
  const watermark = body.watermark !== false

  const { token, payload } = signDemoToken({
    vertical,
    ttlDays,
    by: auth.user.workspace_id ?? undefined,
    tour,
    watermark,
  })

  // Build the public origin from forwarded headers so the URL is reachable
  // from the prospect's browser, not the internal dev host.
  const forwardedHost = request.headers.get('x-forwarded-host') || request.headers.get('host') || ''
  const forwardedProto = request.headers.get('x-forwarded-proto') || new URL(request.url).protocol.replace(':', '') || 'https'
  const origin =
    request.headers.get('origin') ||
    (forwardedHost ? `${forwardedProto}://${forwardedHost.split(',')[0].trim()}` : `${new URL(request.url).protocol}//${request.headers.get('host')}`)
  // Public share URL goes through /api/demo-share/redeem so the prospect's
  // browser receives the guest cookie *before* landing on /app. The direct
  // `/app?share=...` URL is kept as `directUrl` for in-app previews.
  const url = `${origin}/api/demo-share/redeem?token=${encodeURIComponent(token)}`
  const directUrl = buildShareUrl(origin, token, vertical, tour)

  return NextResponse.json({
    ok: true,
    url,
    directUrl,
    token,
    expiresAt: payload.exp,
    expiresInDays: ttlDays,
    vertical,
    tour,
    watermark,
  })
}
