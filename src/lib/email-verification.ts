/**
 * Email verification — secure, single-use, expiring tokens.
 *
 * Security contract:
 *   - The raw token is returned to the caller ONCE (to build the email link)
 *     and NEVER stored. Only its SHA-256 hash lives in the DB.
 *   - Tokens are single-use (used_at), expire (24h), and resends are
 *     rate-limited by a per-user cooldown (60s).
 *   - Verifying sets users.email_verified_at and invalidates outstanding
 *     tokens for that user.
 *   - No raw tokens in logs (audit events record only the user/email/action).
 */
import crypto from 'node:crypto'
import { getDatabase, logAuditEvent } from '@/lib/db'
import { sendEmail, getEmailProvider } from '@/lib/email'
import { logger } from '@/lib/logger'

export const VERIFICATION_TTL_SECONDS = 24 * 60 * 60 // 24h
export const RESEND_COOLDOWN_SECONDS = 60

function now(): number {
  return Math.floor(Date.now() / 1000)
}

function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex')
}

/** Seconds until the user may request another verification email (0 = now). */
export function secondsUntilResend(userId: number): number {
  const db = getDatabase()
  const row = db
    .prepare('SELECT MAX(created_at) AS last FROM email_verification_tokens WHERE user_id = ?')
    .get(userId) as { last: number | null } | undefined
  if (!row?.last) return 0
  const elapsed = now() - row.last
  return elapsed >= RESEND_COOLDOWN_SECONDS ? 0 : RESEND_COOLDOWN_SECONDS - elapsed
}

export interface MintResult {
  ok: boolean
  /** Raw token — only returned here, never persisted. Use to build the link. */
  rawToken?: string
  expiresAt?: number
  cooldownRemaining?: number
  reason?: string
}

/**
 * Mint a fresh verification token for a user. Enforces the resend cooldown.
 * Supersedes the user's previous unused tokens (defence-in-depth: only the
 * newest link works).
 */
export function createVerificationToken(
  userId: number,
  email: string,
  ip?: string | null,
  opts?: { ignoreCooldown?: boolean },
): MintResult {
  const cooldown = secondsUntilResend(userId)
  if (cooldown > 0 && !opts?.ignoreCooldown) {
    return { ok: false, cooldownRemaining: cooldown, reason: 'cooldown' }
  }
  const db = getDatabase()
  const rawToken = crypto.randomBytes(32).toString('base64url')
  const tokenHash = hashToken(rawToken)
  const ts = now()
  const expiresAt = ts + VERIFICATION_TTL_SECONDS
  // Invalidate prior unused tokens for this user, then insert the new one.
  db.transaction(() => {
    db.prepare('UPDATE email_verification_tokens SET used_at = ? WHERE user_id = ? AND used_at IS NULL').run(ts, userId)
    db.prepare(
      `INSERT INTO email_verification_tokens (user_id, token_hash, email, expires_at, used_at, created_at, created_ip)
       VALUES (?, ?, ?, ?, NULL, ?, ?)`,
    ).run(userId, tokenHash, email.toLowerCase(), expiresAt, ts, ip || null)
  })()
  return { ok: true, rawToken, expiresAt }
}

export function buildVerifyUrl(origin: string, rawToken: string): string {
  const base = origin.replace(/\/$/, '')
  return `${base}/api/auth/verify-email?token=${encodeURIComponent(rawToken)}`
}

function verificationEmailBody(verifyUrl: string): { subject: string; text: string } {
  return {
    subject: 'Verify your email — Mission Control',
    text:
      `Welcome to Mission Control.\n\n` +
      `Verify your email to activate your workspace — you'll need this before ` +
      `connecting runtimes, storing API keys, buying credits, or activating your workforce.\n\n` +
      `Verify your email:\n${verifyUrl}\n\n` +
      `This link expires in 24 hours and can be used once.\n` +
      `If you didn't create a Mission Control account, you can ignore this email.\n`,
  }
}

/**
 * Mint + email a verification link. Respects the cooldown. Returns whether the
 * email was actually sent (best-effort; provider may be unconfigured) plus the
 * provider status so the UI can surface "email not configured" honestly.
 */
export async function sendVerificationEmail(
  user: { id: number; email: string | null },
  origin: string,
  ip?: string | null,
  opts?: { ignoreCooldown?: boolean },
): Promise<{ ok: boolean; sent: boolean; provider: string; cooldownRemaining?: number; reason?: string }> {
  if (!user.email) return { ok: false, sent: false, provider: getEmailProvider(), reason: 'no_email' }
  const mint = createVerificationToken(user.id, user.email, ip, opts)
  if (!mint.ok || !mint.rawToken) {
    return { ok: false, sent: false, provider: getEmailProvider(), cooldownRemaining: mint.cooldownRemaining, reason: mint.reason }
  }
  const { subject, text } = verificationEmailBody(buildVerifyUrl(origin, mint.rawToken))
  const result = await sendEmail({ to: user.email, subject, text })
  try {
    logAuditEvent({
      action: 'email_verification_sent',
      actor: String(user.id),
      target_type: 'user',
      target_id: user.id,
      detail: JSON.stringify({ email: user.email, provider: result.provider, sent: result.sent }),
    })
  } catch { /* audit is best-effort */ }
  if (!result.sent) {
    logger.warn({ userId: user.id, provider: result.provider }, 'Verification email not delivered (provider unconfigured or send failed)')
  }
  return { ok: true, sent: result.sent, provider: result.provider, reason: result.reason }
}

export type VerifyResult =
  | { ok: true; userId: number; email: string }
  | { ok: false; reason: 'invalid' | 'expired' | 'used' }

/**
 * Validate a raw verification token and, on success, mark the user verified.
 * Single-use: the token's used_at is stamped atomically with setting
 * users.email_verified_at.
 */
export function verifyEmailToken(rawToken: string): VerifyResult {
  if (!rawToken) return { ok: false, reason: 'invalid' }
  const db = getDatabase()
  const tokenHash = hashToken(rawToken)
  const row = db
    .prepare(
      `SELECT id, user_id, email, expires_at, used_at FROM email_verification_tokens WHERE token_hash = ?`,
    )
    .get(tokenHash) as
    | { id: number; user_id: number; email: string; expires_at: number; used_at: number | null }
    | undefined
  if (!row) return { ok: false, reason: 'invalid' }
  if (row.used_at) return { ok: false, reason: 'used' }
  const ts = now()
  if (row.expires_at < ts) return { ok: false, reason: 'expired' }

  db.transaction(() => {
    db.prepare('UPDATE email_verification_tokens SET used_at = ? WHERE id = ?').run(ts, row.id)
    db.prepare('UPDATE users SET email_verified_at = ?, updated_at = ? WHERE id = ?').run(ts, ts, row.user_id)
  })()

  try {
    logAuditEvent({
      action: 'email_verified',
      actor: String(row.user_id),
      target_type: 'user',
      target_id: row.user_id,
      detail: JSON.stringify({ email: row.email }),
    })
  } catch { /* best-effort */ }

  return { ok: true, userId: row.user_id, email: row.email }
}
