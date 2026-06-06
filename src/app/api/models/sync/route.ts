/**
 * POST /api/models/sync
 *
 * Trigger an OpenRouter catalogue sync. Admin-only.
 *
 * If the workspace has an OpenRouter credential saved, it's decrypted
 * and used as the bearer key (so private models / pricing tiers come
 * through). Otherwise the public catalogue is fetched anonymously —
 * OpenRouter's /api/v1/models endpoint allows that.
 */
import { NextRequest, NextResponse } from 'next/server'

import { requireRole } from '@/lib/auth'
import { logAuditEvent } from '@/lib/db'
import { decryptCredentialForRuntime, isEncryptionConfigured } from '@/lib/credentials/store'
import { OpenRouterSyncError, syncOpenRouterModels } from '@/lib/models/openrouter'

export async function POST(request: NextRequest) {
  const auth = requireRole(request, 'admin')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  let apiKey: string | null = null
  if (isEncryptionConfigured()) {
    try {
      const secrets = decryptCredentialForRuntime(auth.user.workspace_id, 'openrouter')
      if (secrets && typeof secrets.api_key === 'string') apiKey = secrets.api_key
    } catch {
      // Fall through to anonymous sync.
    }
  }

  try {
    const result = await syncOpenRouterModels({ apiKey })
    logAuditEvent({
      action: 'model_catalog_synced',
      actor: String(auth.user.id),
      target_type: 'model_catalog',
      detail: {
        source: result.source,
        fetched: result.fetched,
        upserted: result.upserted,
        deprecated: result.deprecated,
        used_workspace_key: !!apiKey,
      },
    })
    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    if (e instanceof OpenRouterSyncError) {
      return NextResponse.json(
        { error: 'openrouter_sync_failed', status: e.status, hint: 'Check OPENROUTER_API_KEY or upstream availability.' },
        { status: 502 },
      )
    }
    return NextResponse.json({ error: 'sync_failed' }, { status: 500 })
  }
}
