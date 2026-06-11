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

  // Provider internals (raw slugs, provider/source, sync counts, aliases) are
  // advanced detail. Customers (viewer) see only friendly tier labels +
  // display names; operator/admin get the full catalogue. Baseline OS, a
  // separate product, always shows advanced detail.
  const isAdvanced = auth.user.role === 'admin' || auth.user.role === 'operator'
  if (!isAdvanced) {
    return NextResponse.json({
      view: 'customer',
      summary: { available: fullCatalog.filter((r) => r.status === 'available').length },
      featured: featured.map((f) => ({
        tier: f.tier,
        label: TIER_LABELS[f.tier] ?? f.tier,
        display_name: f.resolved?.display_name ?? friendlyName(f.model_slug),
        rationale: f.rationale,
        status: f.status,
      })),
    })
  }

  return NextResponse.json({
    view: 'advanced',
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

/** Friendly tier labels shown to customers (no provider internals). */
const TIER_LABELS: Record<string, string> = {
  best_overall: 'Best overall',
  best_reasoning: 'Best reasoning',
  best_coding: 'Best coding',
  best_cheap_fast: 'Best fast / cheap',
  best_multimodal: 'Best multimodal',
  best_voice_realtime: 'Best voice / realtime',
  best_long_context: 'Best long-context',
}

/** Derive a human display name from a provider/slug without exposing the slug. */
function friendlyName(slug: string): string {
  const tail = slug.split('/').pop() ?? slug
  return tail
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
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
