/**
 * GET /api/models
 *
 * Returns the catalogue rows (synced + curated + custom + local) plus the
 * resolved featured tiers and aliases. Every model selector in the
 * platform reads from here.
 *
 * Query params:
 *   ?source=openrouter|curated|custom|ollama|lm_studio
 *   ?provider=openai|anthropic|google|qwen|deepseek|mistral|meta|xai|moonshot|zai|openrouter|ollama|lm_studio|other
 *   ?status=available|deprecated|unavailable|custom
 */
import { NextRequest, NextResponse } from 'next/server'

import { requireRole } from '@/lib/auth'
import { listModels, type ListFilter } from '@/lib/models/store'
import { resolveAliases, resolveFeatured } from '@/lib/models/resolve'
import type { ModelProvider, ModelSource, ModelStatus } from '@/lib/models/types'

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const url = new URL(request.url)
  const filter: ListFilter = {}
  const src = url.searchParams.get('source') as ModelSource | null
  const prov = url.searchParams.get('provider') as ModelProvider | null
  const st = url.searchParams.get('status') as ModelStatus | null
  if (src) filter.source = src
  if (prov) filter.provider = prov
  if (st) filter.status = st

  const models = listModels(filter)
  const fullCatalog = listModels()
  const featured = resolveFeatured(fullCatalog)
  const aliases = resolveAliases(fullCatalog)

  return NextResponse.json({
    summary: {
      total: fullCatalog.length,
      by_source: bySource(fullCatalog),
      by_status: byStatus(fullCatalog),
      last_synced_at: latestSync(fullCatalog),
    },
    models,
    featured,
    aliases,
  })
}

function bySource(rows: ReturnType<typeof listModels>): Record<string, number> {
  const out: Record<string, number> = {}
  for (const r of rows) out[r.source] = (out[r.source] ?? 0) + 1
  return out
}

function byStatus(rows: ReturnType<typeof listModels>): Record<string, number> {
  const out: Record<string, number> = {}
  for (const r of rows) out[r.status] = (out[r.status] ?? 0) + 1
  return out
}

function latestSync(rows: ReturnType<typeof listModels>): number | null {
  let max: number | null = null
  for (const r of rows) {
    if (max === null || r.last_synced_at > max) max = r.last_synced_at
  }
  return max
}
