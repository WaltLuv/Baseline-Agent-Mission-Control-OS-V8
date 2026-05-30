/**
 * POST /api/workspaces/[id]/invites  — create an invite
 * GET  /api/workspaces/[id]/invites  — list pending invites
 *
 * Only owner / admin can manage invites.
 * Stores SHA-256(token); the raw token is returned ONCE to the caller (and
 * emailed if a provider is configured).
 */

import { NextResponse } from 'next/server'
import { randomBytes, createHash } from 'crypto'
import { getUserFromRequest } from '@/lib/auth'
import { getDatabase, logAuditEvent } from '@/lib/db'
import { resolveRole, hasMinRole, type WorkspaceRole } from '@/lib/memberships'
import { sendEmail, getEmailProvider } from '@/lib/email'
import { mutationLimiter } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'

const INVITE_TTL_SECONDS = 7 * 24 * 60 * 60 // 7 days
const VALID_ROLES = new Set<WorkspaceRole>(['admin', 'operator', 'viewer'])

function parseWorkspaceId(params: { id: string }): number | null {
  const id = Number(params.id)
  return Number.isFinite(id) && id > 0 ? id : null
}

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const rate = mutationLimiter(request); if (rate) return rate

  const params = await ctx.params
  const workspaceId = parseWorkspaceId(params)
  if (!workspaceId) return NextResponse.json({ error: 'Invalid workspace id' }, { status: 400 })

  const user = getUserFromRequest(request as Request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = resolveRole(user.id, workspaceId)
  if (!hasMinRole(role, 'admin')) {
    return NextResponse.json({ error: 'Only owner or admin can invite members' }, { status: 403 })
  }

  try {
    const body = await request.json().catch(() => ({})) as { email?: string; role?: string }
    const email = (body.email || '').trim().toLowerCase()
    const inviteRole = (body.role || 'operator') as WorkspaceRole

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Valid email required', field: 'email' }, { status: 400 })
    }
    if (!VALID_ROLES.has(inviteRole)) {
      return NextResponse.json({ error: 'Role must be admin, operator, or viewer', field: 'role' }, { status: 400 })
    }

    const db = getDatabase()
    const token = randomBytes(32).toString('base64url')
    const tokenHash = createHash('sha256').update(token).digest('hex')
    const expiresAt = Math.floor(Date.now() / 1000) + INVITE_TTL_SECONDS

    const result = db.prepare(`
      INSERT INTO invites (token_hash, email, workspace_id, role, invited_by, expires_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(tokenHash, email, workspaceId, inviteRole, user.id, expiresAt)

    const workspace = db.prepare(`SELECT name FROM workspaces WHERE id = ?`).get(workspaceId) as { name: string } | undefined
    const forwardedHost = request.headers.get('x-forwarded-host') || request.headers.get('host')
    const forwardedProto = request.headers.get('x-forwarded-proto') || (new URL(request.url).protocol.replace(':', ''))
    const origin = forwardedHost ? `${forwardedProto}://${forwardedHost}` : new URL(request.url).origin
    const acceptUrl = `${origin}/invite/${token}`

    const emailResult = await sendEmail({
      to: email,
      subject: `You're invited to ${workspace?.name || 'a workspace'} on Baseline OS`,
      text: `${user.display_name || user.username} has invited you to join "${workspace?.name}" on Baseline OS as ${inviteRole}.

Accept the invite (link expires in 7 days):
${acceptUrl}

If you don't recognize this invite you can ignore this email.

— Mission Control · Baseline OS`,
    })

    logAuditEvent({
      action: 'invite_created',
      actor: user.username,
      actor_id: user.id,
      target_type: 'workspace',
      target_id: workspaceId,
      detail: JSON.stringify({ email, role: inviteRole, provider: emailResult.provider, sent: emailResult.sent }),
    })

    return NextResponse.json({
      ok: true,
      invite: {
        id: Number(result.lastInsertRowid),
        email,
        workspace_id: workspaceId,
        role: inviteRole,
        expires_at: expiresAt,
      },
      // Surface the URL to the caller so they can copy/paste when the email
      // provider is set up to setup_required.
      accept_url: acceptUrl,
      email_status: emailResult.sent ? 'sent' : 'not_sent',
      email_provider: emailResult.provider,
    })
  } catch (err) {
    logger.error({ err }, 'create invite failed')
    return NextResponse.json({ error: 'Could not create invite' }, { status: 500 })
  }
}

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const params = await ctx.params
  const workspaceId = parseWorkspaceId(params)
  if (!workspaceId) return NextResponse.json({ error: 'Invalid workspace id' }, { status: 400 })

  const user = getUserFromRequest(request as Request)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = resolveRole(user.id, workspaceId)
  if (!hasMinRole(role, 'admin')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const db = getDatabase()
  const rows = db.prepare(`
    SELECT id, email, role, expires_at, used_at, revoked_at, created_at, invited_by
    FROM invites
    WHERE workspace_id = ?
    ORDER BY created_at DESC
    LIMIT 100
  `).all(workspaceId)

  return NextResponse.json({
    invites: rows,
    email_provider: getEmailProvider(),
  })
}
