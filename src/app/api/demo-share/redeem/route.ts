/**
 * GET /api/demo-share/redeem?token=<token>
 *
 * Public entry point for a signed demo share link.
 *
 * Flow:
 *   1. Validate the token (HMAC + expiry + read-demo perm).
 *   2. On success, set TWO cookies:
 *      - `mc_demo_guest`  = signed guest credential (vertical + exp)
 *      - `mc_demo_template` = demo vertical (the existing demo overlay cookie)
 *      Both are short-lived and locked to the token's exp.
 *      The guest cookie is HttpOnly + SameSite=Lax so script can't read it.
 *   3. Redirect the prospect into `/app?demo=<vertical>&tour=1`.
 *
 * On failure → 302 to /demo/expired with a generic reason string. The
 * prospect never sees diagnostics; the salesperson can re-mint a link.
 *
 * Security:
 *   - The guest cookie carries the exact same expiry as the original token.
 *   - It grants ONLY `read-demo`. Backend route auth treats it as a
 *     non-authenticated "demo-guest" — never as an operator or admin.
 *   - No DB write, no live workspace data read.
 */
import { NextRequest, NextResponse } from 'next/server'
import { verifyDemoToken, signDemoToken } from '@/lib/demo-share'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  // Trust forwarded headers so the redirect lands on the public host the
  // prospect actually visited (Cloudflare / load balancer puts the original
  // host into x-forwarded-host).
  const forwardedHost = request.headers.get('x-forwarded-host') || request.headers.get('host') || url.host
  const forwardedProto = request.headers.get('x-forwarded-proto') || url.protocol.replace(':', '') || 'https'
  const publicOrigin = `${forwardedProto}://${forwardedHost.split(',')[0].trim()}`

  const token = url.searchParams.get('token')
  const result = verifyDemoToken(token)

  if (!result.ok) {
    const redirect = new URL('/demo/expired', publicOrigin)
    redirect.searchParams.set('reason', result.reason)
    return NextResponse.redirect(redirect, { status: 302 })
  }

  const { vertical, exp, tour } = result.payload
  const expiresInSec = Math.max(60, exp - Math.floor(Date.now() / 1000))

  // Mint a guest credential cookie with the SAME signing as the share token.
  const ttlDays = Math.max(1, Math.ceil(expiresInSec / 86_400))
  const { token: guestCookie } = signDemoToken({
    vertical,
    ttlDays,
    tour,
    watermark: true,
  })

  const target = new URL('/app', publicOrigin)
  target.searchParams.set('demo', vertical)
  if (tour) target.searchParams.set('tour', '1')
  if (token) target.searchParams.set('share', token)

  const response = NextResponse.redirect(target, { status: 302 })

  // Guest credential — HttpOnly so script can't read it.
  response.cookies.set('mc_demo_guest', guestCookie, {
    httpOnly: true,
    sameSite: 'lax',
    secure: url.protocol === 'https:',
    path: '/',
    maxAge: expiresInSec,
  })

  // Mirror the demo template cookie so the dashboard's demo overlay
  // applies on first paint without needing the gate to run.
  response.cookies.set('mc_demo_template', vertical, {
    sameSite: 'lax',
    secure: url.protocol === 'https:',
    path: '/',
    maxAge: expiresInSec,
  })

  return response
}
