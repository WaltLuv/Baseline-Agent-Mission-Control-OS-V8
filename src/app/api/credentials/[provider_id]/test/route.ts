/**
 * POST /api/credentials/[provider_id]/test
 *
 * Runs a real test-connection probe against the provider with the
 * workspace's saved (decrypted) secret. Updates the row's status to
 * `connected` on success or `error` (with last_error) on failure.
 *
 * Admin-only — same as upsert.
 */
import { NextRequest, NextResponse } from 'next/server'

import { requireRole } from '@/lib/auth'
import { logAuditEvent } from '@/lib/db'
import { getProvider } from '@/lib/credentials/catalog'
import {
  decryptCredentialForRuntime,
  getCredential,
  isEncryptionConfigured,
  markVerified,
} from '@/lib/credentials/store'
import { PROBES, isProbeSupported } from '@/lib/credentials/probes'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ provider_id: string }> },
) {
  const auth = requireRole(request, 'admin')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { provider_id } = await params
  const provider = getProvider(provider_id)
  if (!provider) return NextResponse.json({ error: 'unknown_provider' }, { status: 404 })
  if (!isProbeSupported(provider_id)) {
    return NextResponse.json(
      { error: 'probe_not_implemented', hint: 'No real test-connection probe is wired for this provider yet.' },
      { status: 501 },
    )
  }
  if (!isEncryptionConfigured()) {
    return NextResponse.json(
      { error: 'encryption_not_configured', code: 'ENCRYPTION_NOT_CONFIGURED' },
      { status: 412 },
    )
  }

  const row = getCredential(auth.user.workspace_id, provider_id)
  if (!row) {
    return NextResponse.json(
      { error: 'no_credential_saved', hint: 'Save a credential for this provider before testing.' },
      { status: 404 },
    )
  }
  const secrets = decryptCredentialForRuntime(auth.user.workspace_id, provider_id) ?? {}

  const probe = PROBES[provider_id]
  const result = await probe(secrets, row.public_config)

  if (result.ok) {
    markVerified(auth.user.workspace_id, provider_id, true)
    logAuditEvent({
      action: 'credential_tested',
      actor: String(auth.user.id),
      target_type: 'workspace_credential',
      detail: { provider_id, workspace_id: auth.user.workspace_id, result: 'ok' },
    })
    return NextResponse.json({ ok: true, status: 'connected' })
  }

  const errorMsg = `${result.status ? `HTTP ${result.status}: ` : ''}${result.error}`.slice(0, 480)
  markVerified(auth.user.workspace_id, provider_id, false, errorMsg)
  logAuditEvent({
    action: 'credential_tested',
    actor: String(auth.user.id),
    target_type: 'workspace_credential',
    detail: { provider_id, workspace_id: auth.user.workspace_id, result: 'error', http_status: result.status ?? null },
  })
  return NextResponse.json({ ok: false, status: 'error', error: errorMsg })
}
