import { NextResponse } from 'next/server'
import { randomBytes, createHash } from 'crypto'
import { getDatabase } from '@/lib/db'
import { logAuditEvent } from '@/lib/db'
import { selfRegisterLimiter } from '@/lib/rate-limit'
import { sendEmail, getEmailProvider } from '@/lib/email'
import { logger } from '@/lib/logger'

const RESET_TTL_SECONDS = 60 * 60 // 1 hour

/**
 * POST /api/auth/forgot-password
 *
 * Security:
 *   - Always returns 200 with the same shape regardless of whether the email
 *     exists (no enumeration).
 *   - Stores SHA-256(token) — never the plaintext token.
 *   - Rate-limited per IP via selfRegisterLimiter.
 *   - Emails the reset link via the configured provider. If no provider is
 *     configured the endpoint still creates the token so an operator can
 *     surface it manually — but the body says "If an account exists you will
 *     receive an email" so behaviour is identical to the user.
 */
export async function POST(request: Request) {
  const rateCheck = selfRegisterLimiter(request)
  if (rateCheck) return rateCheck

  try {
    const body = await request.json().catch(() => ({})) as { email?: string }
    const email = (body.email || '').trim().toLowerCase()
    if (!email || !email.includes('@')) {
      return NextResponse.json({ ok: true, message: 'If an account with that email exists, we have sent reset instructions.' })
    }

    const db = getDatabase()
    const user = db.prepare(`SELECT id, username, email FROM users WHERE email = ? COLLATE NOCASE LIMIT 1`).get(email) as { id: number; username: string; email: string } | undefined

    // Always respond identically — but only generate/send if user actually exists.
    if (user) {
      const token = randomBytes(32).toString('base64url')
      const tokenHash = createHash('sha256').update(token).digest('hex')
      const expiresAt = Math.floor(Date.now() / 1000) + RESET_TTL_SECONDS
      const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'

      db.prepare(`
        INSERT INTO password_reset_tokens (token_hash, user_id, expires_at, ip_address)
        VALUES (?, ?, ?, ?)
      `).run(tokenHash, user.id, expiresAt, ipAddress)

      const forwardedHost = request.headers.get('x-forwarded-host') || request.headers.get('host')
      const forwardedProto = request.headers.get('x-forwarded-proto') || (new URL(request.url).protocol.replace(':', ''))
      const origin = forwardedHost ? `${forwardedProto}://${forwardedHost}` : new URL(request.url).origin
      const resetUrl = `${origin}/reset-password?token=${token}`

      const result = await sendEmail({
        to: user.email,
        subject: 'Reset your Baseline OS password',
        text: `A password reset was requested for your Baseline OS account.

Reset your password (link expires in 1 hour):
${resetUrl}

If you didn't request this, you can ignore this email — your password will not be changed.

— Mission Control · Baseline OS`,
      })

      logAuditEvent({
        action: 'password_reset_requested',
        actor: user.username,
        actor_id: user.id,
        target_type: 'user',
        target_id: user.id,
        detail: JSON.stringify({ provider: result.provider, sent: result.sent, reason: result.reason }),
        ip_address: ipAddress,
      })

      // If provider is setup_required, log the reset URL so operators can
      // surface it manually during initial deployment.
      if (!result.sent) {
        logger.warn({ resetUrl: '<redacted-in-prod>' }, 'Password reset created but email not delivered — operator must convey link manually')
      }
    }

    return NextResponse.json({ ok: true, message: 'If an account with that email exists, we have sent reset instructions.', provider: getEmailProvider() })
  } catch (err) {
    logger.error({ err }, 'forgot-password failed')
    // Even on error, do not leak enumeration.
    return NextResponse.json({ ok: true, message: 'If an account with that email exists, we have sent reset instructions.' })
  }
}
