/**
 * OpenRouter model sync.
 *
 * GET https://openrouter.ai/api/v1/models returns the full live catalogue
 * — provider-prefixed slugs (e.g. `openai/gpt-5.5`), context window,
 * pricing, modality. We hit this every sync, upsert each row into
 * `model_catalog (source='openrouter')`, and mark missing rows
 * 'deprecated' so they stop showing up as selectable.
 *
 * The endpoint is public and works without an API key; if the operator
 * has saved `OPENROUTER_API_KEY` we attach it so the response includes
 * any privately-scoped models / pricing tiers.
 */

import type { ModelProvider, ModelSource } from './types'
import { listModels, markDeprecated, upsertModel } from './store'

const OPENROUTER_MODELS_URL = 'https://openrouter.ai/api/v1/models'

type OrPricing = {
  prompt?: string | number
  completion?: string | number
  image?: string | number
  request?: string | number
}

type OrArchitecture = {
  modality?: string
  input_modalities?: string[]
  output_modalities?: string[]
  tokenizer?: string
}

type OrTopProvider = {
  context_length?: number
  max_completion_tokens?: number
  is_moderated?: boolean
}

type OrModel = {
  id: string
  name?: string
  description?: string
  context_length?: number
  architecture?: OrArchitecture
  top_provider?: OrTopProvider
  pricing?: OrPricing
  per_request_limits?: Record<string, string | number> | null
  supported_parameters?: string[]
}

type OrEnvelope = { data?: OrModel[] }

function providerFromSlug(slug: string): ModelProvider {
  const head = slug.split('/')[0]?.toLowerCase() ?? 'other'
  if (head.includes('openai')) return 'openai'
  if (head.includes('anthropic')) return 'anthropic'
  if (head.includes('google')) return 'google'
  if (head.includes('qwen')) return 'qwen'
  if (head.includes('deepseek')) return 'deepseek'
  if (head.includes('mistral')) return 'mistral'
  if (head.includes('meta')) return 'meta'
  if (head.includes('xai') || head.includes('x-ai')) return 'xai'
  if (head.includes('moonshot') || head.includes('kimi')) return 'moonshot'
  if (head.includes('zhipu') || head.includes('glm') || head === 'z') return 'zai'
  return 'other'
}

function priceToFloat(v: string | number | undefined): number | null {
  if (v === undefined || v === null) return null
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n)) return null
  // OpenRouter prices are USD per token. The catalogue stores per-million.
  return n * 1_000_000
}

function hasModality(arch: OrArchitecture | undefined, kind: string): boolean {
  const ins = arch?.input_modalities ?? []
  const outs = arch?.output_modalities ?? []
  return [...ins, ...outs, arch?.modality ?? ''].some((m) => m && m.toLowerCase().includes(kind))
}

function supportsTools(model: OrModel): boolean {
  return (model.supported_parameters ?? []).some((p) => p === 'tools' || p === 'tool_choice')
}

function supportsJsonMode(model: OrModel): boolean {
  return (model.supported_parameters ?? []).some(
    (p) => p === 'response_format' || p === 'structured_outputs',
  )
}

function supportsReasoning(model: OrModel): boolean {
  // OpenRouter exposes reasoning via the `reasoning` supported_parameter or
  // a name hint (`o1`, `r1`, `reasoner`).
  if ((model.supported_parameters ?? []).includes('reasoning')) return true
  const lower = (model.id + ' ' + (model.name ?? '')).toLowerCase()
  return /\bo1\b|\br1\b|\breasoner\b|\bthinking\b/.test(lower)
}

export class OpenRouterSyncError extends Error {
  status: number
  body: string
  constructor(message: string, status: number, body: string) {
    super(message)
    this.status = status
    this.body = body
  }
}

export type SyncResult = {
  fetched: number
  upserted: number
  deprecated: number
  source: ModelSource
}

/**
 * Performs the sync. Caller-injected `fetcher` so tests can stub the HTTP
 * round-trip without monkey-patching globals.
 */
export async function syncOpenRouterModels(opts: {
  apiKey?: string | null
  fetcher?: typeof fetch
} = {}): Promise<SyncResult> {
  const fetcher = opts.fetcher ?? fetch
  const headers: Record<string, string> = {
    accept: 'application/json',
    'user-agent': 'mission-control-model-sync/1.0',
  }
  if (opts.apiKey && opts.apiKey.trim() !== '') {
    headers.authorization = `Bearer ${opts.apiKey.trim()}`
  }

  const res = await fetcher(OPENROUTER_MODELS_URL, { headers })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new OpenRouterSyncError(`openrouter sync failed: HTTP ${res.status}`, res.status, body)
  }

  const json = (await res.json()) as OrEnvelope
  const models = Array.isArray(json.data) ? json.data : []

  // Snapshot the slugs we currently consider 'available' so any model that
  // disappears upstream gets marked 'deprecated' (Walt: deprecated/unavailable
  // models do not appear as selectable).
  const beforeSlugs = new Set(
    listModels({ source: 'openrouter', status: 'available' }).map((r) => r.model_slug),
  )

  let upserted = 0
  for (const m of models) {
    if (!m.id) continue
    upsertModel({
      provider: providerFromSlug(m.id),
      model_slug: m.id,
      display_name: m.name?.trim() || m.id,
      family: m.id.includes('/') ? m.id.split('/')[1].split(/[-:]/)[0] : null,
      context_window: m.context_length ?? m.top_provider?.context_length ?? null,
      input_price_usd_per_million: priceToFloat(m.pricing?.prompt),
      output_price_usd_per_million: priceToFloat(m.pricing?.completion),
      supports_tools: supportsTools(m),
      supports_images: hasModality(m.architecture, 'image'),
      supports_audio: hasModality(m.architecture, 'audio'),
      supports_video: hasModality(m.architecture, 'video'),
      supports_reasoning: supportsReasoning(m),
      supports_json: supportsJsonMode(m),
      source: 'openrouter',
      status: 'available',
      metadata: {
        description: m.description ?? null,
        max_completion_tokens: m.top_provider?.max_completion_tokens ?? null,
        is_moderated: m.top_provider?.is_moderated ?? null,
      },
    })
    upserted += 1
    beforeSlugs.delete(m.id)
  }

  // Anything left in beforeSlugs vanished upstream — mark deprecated.
  let deprecated = 0
  for (const stale of beforeSlugs) {
    if (markDeprecated('openrouter', stale)) deprecated += 1
  }

  return { fetched: models.length, upserted, deprecated, source: 'openrouter' }
}
