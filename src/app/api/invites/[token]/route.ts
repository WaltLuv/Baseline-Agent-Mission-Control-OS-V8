/**
 * GET  /api/invites/[token]         — look up an invite (for accept page).
 * POST /api/invites/[token]/accept  — accept an invite (creates user or attaches existing).
 */

import { NextResponse } from 'next/server'
import { createHash } from 'crypto'
import { createUser, createSession, getUserFromRequest } from '@/lib/auth'
import { getDatabase, logAuditEvent } from '@/lib/db'
import { upsertMembership, type WorkspaceRole } from '@/lib/memberships'
import { getMcSessionCookieName, getMcSessionCookieOptions, isRequestSecure } from '@/lib/session-cookie'
import { mutationLimiter } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

type InviteRow = {
  id: number
  email: string
  workspace_id: number
  role: WorkspaceRole
  expires_at: number
  used_at: number | null
  revoked_at: number | null
  invited_by: number
}

function loadInvite(token: string): InviteRow | null {
  const hash = createHash('sha256').update(token).digest('hex')
  const db = getDatabase()
  return (db.prepare(`
    SELECT id, email, workspace_id, role, expires_at, used_at, revoked_at, invited_by
    FROM invites WHERE token_hash = ? LIMIT 1
  `).get(hash) as InviteRow | undefined) ?? null
}

function inviteStatus(invite: InviteRow): 'valid' | 'used' | 'revoked' | 'expired' {
  if (invite.used_at) return 'used'
  if (invite.revoked_at) return 'revoked'
  if (invite.expires_at < Math.floor(Date.now() / 1000)) return 'expired'
  return 'valid'
}

export async function GET(_request: Request, ctx: { params: Promise<{ token: string }> }) {
  const params = await ctx.params
  const invite = loadInvite(params.token)
  if (!invite) return NextResponse.json({ error: 'Invite not found' }, { status: 404 })

  const db = getDatabase()
  const workspace = db.prepare(`SELECT id, slug, name FROM workspaces WHERE id = ?`).get(invite.workspace_id) as { id: number; slug: string; name: string } | undefined

  return NextResponse.json({
    invite: {
      email: invite.email,
      role: invite.role,
      workspace: workspace ?? null,
      status: inviteStatus(invite),
    },
  })
}

export async function POST(request: Request, ctx: { params: Promise<{ token: string }> }) {
  const rate = mutationLimiter(request); if (rate) return rate
  const params = await ctx.params

  try {
    const invite = loadInvite(params.token)
    if (!invite) return NextResponse.json({ error: 'Invite not found', code: 'INVITE_INVALID' }, { status: 404 })
    const status = inviteStatus(invite)
    if (status !== 'valid') return NextResponse.json({ error: `Invite ${status}`, code: `INVITE_${status.toUpperCase()}` }, { status: 400 })

    const body = await request.json().catch(() => ({})) as { full_name?: string; password?: string }
    const fullName = (body.full_name || '').trim()
    const password = body.password || ''

    const db = getDatabase()
    const existingUser = db.prepare(`SELECT id, username FROM users WHERE email = ? COLLATE NOCASE LIMIT 1`).get(invite.email) as { id: number; username: string } | undefined
    const currentUser = getUserFromRequest(request as Request)

    // Resolve the user we are attaching to this workspace.
    let userId: number
    let username: string
    let createdNew = false

    if (currentUser) {
      // Already logged in. They MUST be the invited email (or admin matching).
      const currentRow = db.prepare(`SELECT email FROM users WHERE id = ?`).get(currentUser.id) as { email: string | null } | undefined
      if (currentRow?.email?.toLowerCase() !== invite.email.toLowerCase()) {
        return NextResponse.json({ error: 'Sign in as the invited email to accept this invite', code: 'EMAIL_MISMATCH' }, { status: 403 })
      }
      userId = currentUser.id
      username = currentUser.username
    } else if (existingUser) {
      // Account exists; require login first.
      return NextResponse.json({ error: 'An account with this email already exists. Sign in to accept the invite.', code: 'LOGIN_REQUIRED' }, { status: 401 })
    } else {
      // Create new local user.
      if (!fullName) return NextResponse.json({ error: 'Full name is required', field: 'full_name' }, { status: 400 })
      if (password.length < 12) return NextResponse.json({ error: 'Password must be at least 12 characters', field: 'password' }, { status: 400 })

      const base = invite.email.split('@')[0].replace(/[^a-z0-9_-]/g, '').slice(0, 30) || `user${Date.now()}`
      let candidate = base
      let suffix = 1
      while (db.prepare(`SELECT id FROM users WHERE username = ?`).get(candidate)) {
        suffix += 1
        candidate = `${base}${suffix}`
      }

      const newUser = createUser(candidate, password, fullName, invite.role === 'owner' ? 'admin' : invite.role, {
        provider: 'local',
        email: invite.email,
        is_approved: 1,
        workspace_id: invite.workspace_id,
      })
      userId = newUser.id
      username = newUser.username
      createdNew = true
    }

    upsertMembership(userId, invite.workspace_id, invite.role, { invitedBy: invite.invited_by })

    db.prepare(`UPDATE invites SET used_at = unixepoch(), used_by_user_id = ? WHERE id = ?`).run(userId, invite.id)

    const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
    const userAgent = request.headers.get('user-agent') || undefined

    logAuditEvent({
      action: 'invite_accepted',
      actor: username,
      actor_id: userId,
      target_type: 'workspace',
      target_id: invite.workspace_id,
      detail: JSON.stringify({ role: invite.role, created_new_user: createdNew }),
      ip_address: ipAddress,
    })

    const { token, expiresAt } = createSession(userId, ipAddress, userAgent, invite.workspace_id)

    const response = NextResponse.json({
      ok: true,
      workspace_id: invite.workspace_id,
      role: invite.role,
      created_new_user: createdNew,
      next: '/onboarding',
    })
    const isSecureRequest = isRequestSecure(request)
    const cookieName = getMcSessionCookieName(isSecureRequest)
    response.cookies.set(cookieName, token, {
      ...getMcSessionCookieOptions({ maxAgeSeconds: expiresAt - Math.floor(Date.now() / 1000), isSecureRequest }),
    })
    return response
  } catch (err) {
    logger.error({ err }, 'invite accept failed')
    return NextResponse.json({ error: 'Could not accept invite' }, { status: 500 })
  }
}
