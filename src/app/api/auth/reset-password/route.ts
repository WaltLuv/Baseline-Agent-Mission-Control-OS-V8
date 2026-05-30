import { NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { getDatabase, logAuditEvent } from '@/lib/db'
import { updateUser, destroyAllUserSessions } from '@/lib/auth'
import { selfRegisterLimiter } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

export async function POST(request: Request) {
  const rateCheck = selfRegisterLimiter(request)
  if (rateCheck) return rateCheck

  try {
    const body = await request.json().catch(() => ({})) as { token?: string; password?: string }
    const token = (body.token || '').trim()
    const password = body.password || ''

    if (!token) return NextResponse.json({ error: 'Reset token is required', code: 'TOKEN_MISSING' }, { status: 400 })
    if (password.length < 12) return NextResponse.json({ error: 'Password must be at least 12 characters', field: 'password' }, { status: 400 })

    const tokenHash = createHash('sha256').update(token).digest('hex')
    const db = getDatabase()
    const row = db.prepare(`
      SELECT id, user_id, expires_at, used_at FROM password_reset_tokens WHERE token_hash = ? LIMIT 1
    `).get(tokenHash) as { id: number; user_id: number; expires_at: number; used_at: number | null } | undefined

    if (!row) return NextResponse.json({ error: 'Invalid or expired reset link', code: 'TOKEN_INVALID' }, { status: 400 })
    if (row.used_at) return NextResponse.json({ error: 'This reset link has already been used', code: 'TOKEN_USED' }, { status: 400 })
    if (row.expires_at < Math.floor(Date.now() / 1000)) {
      return NextResponse.json({ error: 'This reset link has expired. Request a new one.', code: 'TOKEN_EXPIRED' }, { status: 400 })
    }

    // Mark the token used FIRST so a race cannot consume it twice.
    db.prepare(`UPDATE password_reset_tokens SET used_at = unixepoch() WHERE id = ?`).run(row.id)

    const updated = updateUser(row.user_id, { password })
    if (!updated) return NextResponse.json({ error: 'Account not found', code: 'USER_MISSING' }, { status: 404 })

    // Invalidate every existing session so the attacker (if any) is kicked out.
    destroyAllUserSessions(row.user_id)

    const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    logAuditEvent({
      action: 'password_reset_completed',
      actor: updated.username,
      actor_id: updated.id,
      target_type: 'user',
      target_id: updated.id,
      ip_address: ipAddress,
    })

    return NextResponse.json({ ok: true, message: 'Password updated. You can now sign in.' })
  } catch (err) {
    logger.error({ err }, 'reset-password failed')
    return NextResponse.json({ error: 'Could not reset password' }, { status: 500 })
  }
}
