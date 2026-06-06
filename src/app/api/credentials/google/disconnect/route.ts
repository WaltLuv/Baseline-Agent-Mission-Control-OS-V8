/**
 * POST /api/credentials/google/disconnect
 *
 * Revokes the stored refresh token at Google's revoke endpoint (best
 * effort — already-revoked is a terminal state, not an error) and deletes
 * the encrypted row for the named service. Also clears any in-flight
 * oauth_states rows for the workspace so a stale consent loop can't
 * silently re-link.
 *
 * Admin only.
 */
import { NextRequest, NextResponse } from 'next/server'

import { requireRole } from '@/lib/auth'
import { logAuditEvent } from '@/lib/db'
import {
  decryptCredentialForRuntime,
  deleteCredential,
} from '@/lib/credentials/store'
import { isGoogleService, revokeToken } from '@/lib/credentials/google-oauth'
import { deleteStatesForWorkspace } from '@/lib/credentials/oauth-state'

export async function POST(request: NextRequest) {
  const auth = requireRole(request, 'admin')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const body = (await request.json().catch(() => ({}))) as { service?: string }
  const service = String(body.service ?? '').trim()
  if (!isGoogleService(service)) {
    return NextResponse.json({ error: 'unknown_service' }, { status: 400 })
  }

  // Best-effort revoke at Google. Failure is logged but does not block the
  // local delete — operator intent is "sever the link from this workspace".
  let revoked = false
  let revoke_error: string | null = null
  try {
    const secrets = decryptCredentialForRuntime(auth.user.workspace_id, service)
    if (secrets?.refresh_token) {
      await revokeToken({ token: secrets.refresh_token })
      revoked = true
    }
  } catch (e) {
    revoke_error = e instanceof Error ? e.message.slice(0, 200) : 'revoke_failed'
  }

  const deleted = deleteCredential(auth.user.workspace_id, service)
  deleteStatesForWorkspace(auth.user.workspace_id)

  logAuditEvent({
    action: 'google_oauth_disconnected',
    actor: String(auth.user.id),
    target_type: 'workspace_credential',
    detail: { service, workspace_id: auth.user.workspace_id, revoked, deleted },
  })

  return NextResponse.json({ ok: true, revoked, deleted, revoke_error })
}
