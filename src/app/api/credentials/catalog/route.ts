/**
 * GET /api/credentials/catalog
 *
 * Returns the static provider catalog merged with the workspace's saved
 * credential state. Secret fields are NEVER returned raw — only the
 * per-row `secret_preview` (e.g. `sk-...abcd`).
 *
 * Auth: viewer+ can read (so any user can see what's connected vs missing);
 * write routes are admin-only.
 */
import { NextRequest, NextResponse } from 'next/server'

import { requireRole } from '@/lib/auth'
import { PROVIDER_CATALOG } from '@/lib/credentials/catalog'
import { isEncryptionConfigured, listCredentials } from '@/lib/credentials/store'
import { ensureEnvCredentialsSynced } from '@/lib/credentials/env-sync'

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  // Import any env-provided keys (.env.local etc.) into the store, once per
  // process per workspace, and verify them — so configured keys show as
  // connected instead of "missing" without manual re-entry.
  await ensureEnvCredentialsSynced(auth.user.workspace_id, true)

  const rows = listCredentials(auth.user.workspace_id)
  const byProvider = new Map(rows.map((r) => [r.provider_id, r]))

  const providers = PROVIDER_CATALOG.map((p) => {
    const saved = byProvider.get(p.id)
    return {
      ...p,
      saved: saved
        ? {
            status: saved.status,
            mode: saved.mode,
            secret_preview: saved.secret_preview,
            public_config: saved.public_config,
            last_verified_at: saved.last_verified_at,
            last_error: saved.last_error,
          }
        : null,
    }
  })

  const summary = {
    total: PROVIDER_CATALOG.length,
    connected: rows.filter((r) => r.status === 'connected').length,
    pending: rows.filter((r) => r.status === 'pending').length,
    error: rows.filter((r) => r.status === 'error').length,
    missing: PROVIDER_CATALOG.length - rows.length,
  }

  return NextResponse.json({
    encryption_configured: isEncryptionConfigured(),
    summary,
    providers,
  })
}
