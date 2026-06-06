/**
 * POST /api/credentials/google/connect
 *
 * Starts the Google OAuth round-trip. Returns the consent URL the browser
 * should redirect to. State is generated server-side, persisted via the
 * oauth_states table, and scoped to (workspace_id, service). The callback
 * route validates that state echo before doing any token exchange.
 *
 * Admin only. Refuses if CREDENTIALS_ENCRYPTION_KEY is not set (so a
 * successful round-trip never lands plaintext refresh tokens in the DB).
 */
import { NextRequest, NextResponse } from 'next/server'

import { requireRole } from '@/lib/auth'
import { logAuditEvent } from '@/lib/db'
import {
  decryptCredentialForRuntime,
  isEncryptionConfigured,
} from '@/lib/credentials/store'
import { buildConsentUrl, GoogleOAuthError, isGoogleService } from '@/lib/credentials/google-oauth'
import { createState } from '@/lib/credentials/oauth-state'

export async function POST(request: NextRequest) {
  const auth = requireRole(request, 'admin')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  if (!isEncryptionConfigured()) {
    return NextResponse.json(
      {
        error: 'encryption_not_configured',
        code: 'ENCRYPTION_NOT_CONFIGURED',
        hint: 'Set CREDENTIALS_ENCRYPTION_KEY before starting an OAuth flow.',
      },
      { status: 412 },
    )
  }

  const body = (await request.json().catch(() => ({}))) as {
    service?: string
    return_to?: string
  }
  const service = String(body.service ?? '').trim()
  if (!isGoogleService(service)) {
    return NextResponse.json(
      { error: 'unknown_service', supported: ['gmail', 'google_drive', 'google_calendar', 'google_contacts'] },
      { status: 400 },
    )
  }

  const clientSecrets = decryptCredentialForRuntime(auth.user.workspace_id, 'google_oauth')
  if (!clientSecrets || typeof clientSecrets.client_secret !== 'string' || !clientSecrets.client_secret) {
    return NextResponse.json(
      {
        error: 'google_oauth_not_configured',
        code: 'MISSING_CLIENT_CONFIG',
        hint: 'Save the Google OAuth client_id + client_secret + redirect_uri in the credentials manager first.',
      },
      { status: 409 },
    )
  }

  // Public config (client_id + redirect_uri) lives on the row, NOT in the
  // encrypted secrets blob. Re-resolve it via the catalog read so we don't
  // need to keep a separate path.
  const { getCredential } = await import('@/lib/credentials/store')
  const row = getCredential(auth.user.workspace_id, 'google_oauth')
  const client_id = row?.public_config?.client_id ?? ''
  const redirect_uri = row?.public_config?.redirect_uri ?? ''
  if (!client_id || !redirect_uri) {
    return NextResponse.json(
      { error: 'google_oauth_not_configured', code: 'MISSING_CLIENT_CONFIG', hint: 'client_id and redirect_uri are required.' },
      { status: 409 },
    )
  }

  const { state } = createState({
    provider: 'google_oauth',
    service,
    workspaceId: auth.user.workspace_id,
    userId: auth.user.id,
    returnTo: typeof body.return_to === 'string' ? body.return_to.slice(0, 512) : undefined,
  })

  try {
    const consent_url = buildConsentUrl({
      client: { client_id, client_secret: clientSecrets.client_secret, redirect_uri },
      service,
      state,
    })
    logAuditEvent({
      action: 'google_oauth_connect_started',
      actor: String(auth.user.id),
      target_type: 'workspace_credential',
      detail: { service, workspace_id: auth.user.workspace_id },
    })
    return NextResponse.json({ consent_url, state, expires_in_seconds: 600 })
  } catch (e) {
    if (e instanceof GoogleOAuthError) {
      return NextResponse.json({ error: e.message, code: e.code }, { status: 400 })
    }
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}
