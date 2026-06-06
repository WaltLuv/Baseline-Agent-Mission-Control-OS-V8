/**
 * GET /api/credentials/google/callback?code=…&state=…
 *
 * The OAuth provider redirects the browser back here. We:
 *   1. Validate the state echo against an oauth_states row WE created at
 *      consent time. Single-use; replays rejected; expired rows rejected.
 *   2. Exchange the code for { access_token, refresh_token } using the
 *      workspace-scoped Google OAuth client.
 *   3. Encrypt + store the refresh_token in the per-service credential row
 *      (gmail / google_drive / google_calendar / google_contacts).
 *   4. Mark the row `connected`; record verification time.
 *   5. Redirect the browser to the return-to path (default /app/credentials)
 *      with a status hint in the query string.
 *
 * Refresh tokens NEVER appear in the redirect URL or any response body.
 */
import { NextRequest, NextResponse } from 'next/server'

import { requireRole } from '@/lib/auth'
import { logAuditEvent } from '@/lib/db'
import {
  decryptCredentialForRuntime,
  getCredential,
  isEncryptionConfigured,
  markVerified,
  upsertCredential,
} from '@/lib/credentials/store'
import { exchangeCodeForTokens, GoogleOAuthError, isGoogleService } from '@/lib/credentials/google-oauth'
import { consumeState } from '@/lib/credentials/oauth-state'

function safeRedirect(returnTo: string | null | undefined, status: 'ok' | 'error', detail?: string): string {
  // Same-origin paths only — never honor a full URL the caller could craft.
  const base = returnTo && returnTo.startsWith('/') ? returnTo : '/app/credentials'
  const sep = base.includes('?') ? '&' : '?'
  const detailPart = detail ? `&google_error=${encodeURIComponent(detail.slice(0, 120))}` : ''
  return `${base}${sep}google=${status}${detailPart}`
}

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'admin')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const error = url.searchParams.get('error')
  if (error) {
    return NextResponse.redirect(new URL(safeRedirect(null, 'error', error), url.origin))
  }
  if (!code || !state) {
    return NextResponse.redirect(new URL(safeRedirect(null, 'error', 'missing_code_or_state'), url.origin))
  }

  // CSRF gate.
  const stateRow = consumeState(state, 'google_oauth')
  if (!stateRow) {
    return NextResponse.redirect(new URL(safeRedirect(null, 'error', 'invalid_state'), url.origin))
  }
  if (stateRow.workspace_id !== auth.user.workspace_id) {
    return NextResponse.redirect(new URL(safeRedirect(null, 'error', 'workspace_mismatch'), url.origin))
  }
  const service = stateRow.service ?? ''
  if (!isGoogleService(service)) {
    return NextResponse.redirect(new URL(safeRedirect(stateRow.return_to, 'error', 'unknown_service'), url.origin))
  }

  if (!isEncryptionConfigured()) {
    return NextResponse.redirect(new URL(safeRedirect(stateRow.return_to, 'error', 'encryption_not_configured'), url.origin))
  }

  // Re-fetch client config (must still be present at exchange time).
  const clientSecrets = decryptCredentialForRuntime(auth.user.workspace_id, 'google_oauth')
  const clientRow = getCredential(auth.user.workspace_id, 'google_oauth')
  const client_id = clientRow?.public_config?.client_id ?? ''
  const redirect_uri = clientRow?.public_config?.redirect_uri ?? ''
  if (!clientSecrets?.client_secret || !client_id || !redirect_uri) {
    return NextResponse.redirect(new URL(safeRedirect(stateRow.return_to, 'error', 'google_oauth_not_configured'), url.origin))
  }

  try {
    const tokens = await exchangeCodeForTokens({
      client: { client_id, client_secret: clientSecrets.client_secret, redirect_uri },
      code,
    })
    if (!tokens.refresh_token) {
      // Google withholds refresh_token when an existing grant is reused. We
      // forced `prompt=consent`, but if a previous grant survived, ask the
      // operator to disconnect first.
      return NextResponse.redirect(
        new URL(safeRedirect(stateRow.return_to, 'error', 'no_refresh_token_returned_disconnect_and_retry'), url.origin),
      )
    }

    upsertCredential({
      workspaceId: auth.user.workspace_id,
      providerId: service,
      secrets: { refresh_token: tokens.refresh_token },
      publicConfig: { scope: tokens.scope ?? '' },
      mode: 'bring_your_own_key',
      userId: auth.user.id,
    })
    markVerified(auth.user.workspace_id, service, true)

    logAuditEvent({
      action: 'google_oauth_connected',
      actor: String(auth.user.id),
      target_type: 'workspace_credential',
      detail: { service, workspace_id: auth.user.workspace_id, scope: tokens.scope ?? '' },
    })

    return NextResponse.redirect(new URL(safeRedirect(stateRow.return_to, 'ok'), url.origin))
  } catch (e) {
    const detail = e instanceof GoogleOAuthError ? e.code : 'token_exchange_failed'
    logAuditEvent({
      action: 'google_oauth_failed',
      actor: String(auth.user.id),
      target_type: 'workspace_credential',
      detail: { service, workspace_id: auth.user.workspace_id, code: detail },
    })
    return NextResponse.redirect(new URL(safeRedirect(stateRow.return_to, 'error', detail), url.origin))
  }
}
