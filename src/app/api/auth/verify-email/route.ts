import { NextResponse } from 'next/server'
import { verifyEmailToken } from '@/lib/email-verification'

/**
 * GET /api/auth/verify-email?token=...
 *
 * Validates the (single-use, expiring) token from the email link and, on
 * success, marks the user verified, then redirects into onboarding. On any
 * failure redirects to /verify-email/expired so the user can resend.
 *
 * This is a link target clicked from an email client → it redirects (302),
 * it does not return JSON.
 */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const token = url.searchParams.get('token') || ''
  const origin = (process.env.NEXT_PUBLIC_APP_URL || url.origin).replace(/\/$/, '')

  const result = verifyEmailToken(token)
  if (result.ok) {
    // Verified → onboarding/activation now unlocked.
    return NextResponse.redirect(`${origin}/onboarding?verified=1`, { status: 302 })
  }
  // invalid / expired / used → the expired page offers a resend.
  return NextResponse.redirect(`${origin}/verify-email/expired?reason=${result.reason}`, { status: 302 })
}

export const dynamic = 'force-dynamic'
