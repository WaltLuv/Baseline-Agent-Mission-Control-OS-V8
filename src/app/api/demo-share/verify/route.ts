/**
 * GET /api/demo-share/verify?token=...
 *
 * Public endpoint. Returns the parsed demo token payload only when the
 * token is valid, unexpired, and grants read-demo permission. Otherwise
 * returns a clean reason string so the UI can show the expired-link state.
 *
 * No authentication required: the token itself is the credential.
 * No DB read or write happens. No live workspace data is touched.
 */
import { NextRequest, NextResponse } from 'next/server'
import { verifyDemoToken } from '@/lib/demo-share'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const token = new URL(request.url).searchParams.get('token')
  const result = verifyDemoToken(token)
  if (!result.ok) {
    return NextResponse.json({ ok: false, reason: result.reason }, { status: 200 })
  }
  // Strip the "by" field from the public response — it's audit-only.
  const { v, vertical, iat, exp, perms, tour, watermark } = result.payload
  return NextResponse.json({ ok: true, payload: { v, vertical, iat, exp, perms, tour, watermark } })
}
