import { NextResponse } from 'next/server'
import { requireRole, isEmailVerified } from '@/lib/auth'
import { sendVerificationEmail, secondsUntilResend } from '@/lib/email-verification'

/**
 * POST /api/auth/resend-verification
 *
 * Re-sends the verification email for the currently logged-in user. Enforces
 * the per-user resend cooldown. No-op (200) if the user is already verified.
 * Never returns or logs a raw token.
 */
export async function POST(request: Request) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { user } = auth

  if (!user.email) {
    return NextResponse.json({ error: 'This account has no email to verify.' }, { status: 400 })
  }
  if (isEmailVerified(user)) {
    return NextResponse.json({ ok: true, alreadyVerified: true })
  }

  const cooldown = secondsUntilResend(user.id)
  if (cooldown > 0) {
    return NextResponse.json(
      { ok: false, cooldownRemaining: cooldown, error: `Please wait ${cooldown}s before resending.` },
      { status: 429 },
    )
  }

  const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || null
  const origin = (process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin).replace(/\/$/, '')
  const result = await sendVerificationEmail({ id: user.id, email: user.email }, origin, ip)

  return NextResponse.json({
    ok: result.ok,
    sent: result.sent,
    provider: result.provider,
    cooldownRemaining: result.cooldownRemaining,
    // Surface honestly when no email provider is configured (do not pretend).
    emailConfigured: result.provider !== 'setup_required',
  })
}
