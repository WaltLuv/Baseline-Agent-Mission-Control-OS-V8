/**
 * /api/credentials/[provider_id]
 *
 * GET    — return the workspace's saved row for this provider (no secrets).
 * PUT    — upsert secret + public config (admin only). Refuses if
 *          CREDENTIALS_ENCRYPTION_KEY is not configured.
 * DELETE — remove the row entirely (admin only).
 *
 * Security guarantees:
 *   · No secret value is ever logged.
 *   · No raw secret is ever returned by GET — only `secret_preview`.
 *   · Writes are workspace-scoped via the session's workspace_id.
 *   · An audit row is written on every create / update / delete.
 */
import { NextRequest, NextResponse } from 'next/server'

import { requireRole, requireVerifiedEmail } from '@/lib/auth'
import { logAuditEvent } from '@/lib/db'
import { getProvider } from '@/lib/credentials/catalog'
import {
  CredentialStoreError,
  deleteCredential,
  getCredential,
  isEncryptionConfigured,
  upsertCredential,
} from '@/lib/credentials/store'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider_id: string }> },
) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })
  const { provider_id } = await params
  if (!getProvider(provider_id)) {
    return NextResponse.json({ error: 'unknown_provider' }, { status: 404 })
  }
  const row = getCredential(auth.user.workspace_id, provider_id)
  return NextResponse.json({ credential: row })
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ provider_id: string }> },
) {
  const auth = requireVerifiedEmail(request, 'admin')
  if ('error' in auth) return NextResponse.json({ error: auth.error, code: auth.code }, { status: auth.status })

  const { provider_id } = await params
  const provider = getProvider(provider_id)
  if (!provider) return NextResponse.json({ error: 'unknown_provider' }, { status: 404 })

  if (!isEncryptionConfigured()) {
    return NextResponse.json(
      {
        error: 'encryption_not_configured',
        code: 'ENCRYPTION_NOT_CONFIGURED',
        hint: 'Set CREDENTIALS_ENCRYPTION_KEY (64-char hex or a strong passphrase) before saving credentials.',
      },
      { status: 412 },
    )
  }

  const body = (await request.json().catch(() => ({}))) as {
    secrets?: Record<string, string>
    public_config?: Record<string, string>
    mode?: 'mission_control_credits' | 'bring_your_own_key' | 'both'
  }

  try {
    const view = upsertCredential({
      workspaceId: auth.user.workspace_id,
      providerId: provider_id,
      secrets: body.secrets ?? {},
      publicConfig: body.public_config ?? {},
      mode: body.mode,
      userId: auth.user.id,
    })
    // Audit — never log secret values, only the action + provider id.
    logAuditEvent({
      action: 'credential_upserted',
      actor: String(auth.user.id),
      target_type: 'workspace_credential',
      detail: { provider_id, workspace_id: auth.user.workspace_id },
    })
    return NextResponse.json({ credential: view })
  } catch (e) {
    if (e instanceof CredentialStoreError) {
      const httpStatus =
        e.code === 'ENCRYPTION_NOT_CONFIGURED'
          ? 412
          : e.code === 'UNKNOWN_PROVIDER'
            ? 404
            : e.code === 'MISSING_SECRET' || e.code === 'BAD_INPUT'
              ? 400
              : 500
      return NextResponse.json({ error: e.message, code: e.code }, { status: httpStatus })
    }
    return NextResponse.json({ error: 'internal' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ provider_id: string }> },
) {
  const auth = requireVerifiedEmail(request, 'admin')
  if ('error' in auth) return NextResponse.json({ error: auth.error, code: auth.code }, { status: auth.status })

  const { provider_id } = await params
  if (!getProvider(provider_id)) {
    return NextResponse.json({ error: 'unknown_provider' }, { status: 404 })
  }
  const ok = deleteCredential(auth.user.workspace_id, provider_id)
  if (!ok) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  logAuditEvent({
    action: 'credential_deleted',
    actor: String(auth.user.id),
    target_type: 'workspace_credential',
    detail: { provider_id, workspace_id: auth.user.workspace_id },
  })
  return NextResponse.json({ ok: true })
}
