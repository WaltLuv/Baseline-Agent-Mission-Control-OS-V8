/**
 * Model catalogue — shared types.
 *
 * Single source of truth for the row shape every model selector reads.
 * The on-disk schema lives in migration 065_model_catalog.
 */

export type ModelProvider =
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'qwen'
  | 'deepseek'
  | 'mistral'
  | 'meta'
  | 'xai'
  | 'moonshot'
  | 'zai'
  | 'openrouter'
  | 'ollama'
  | 'lm_studio'
  | 'other'

export type ModelSource = 'openrouter' | 'curated' | 'custom' | 'ollama' | 'lm_studio'

export type ModelStatus = 'available' | 'deprecated' | 'unavailable' | 'custom'

export type ModelRow = {
  id: number
  provider: ModelProvider
  model_slug: string
  display_name: string
  family: string | null
  context_window: number | null
  input_price_usd_per_million: number | null
  output_price_usd_per_million: number | null
  supports_tools: boolean
  supports_images: boolean
  supports_audio: boolean
  supports_video: boolean
  supports_reasoning: boolean
  supports_json: boolean
  source: ModelSource
  status: ModelStatus
  last_synced_at: number
  metadata: Record<string, unknown>
  created_at: number
  updated_at: number
}

/**
 * Curated featured-model list. The UI surfaces these tiers; if the slug is
 * not present in the synced catalogue we still render the row but mark it
 * `unavailable` so the operator sees the gap honestly (Walt's rule).
 */
export type FeaturedTier =
  | 'best_overall'
  | 'best_coding'
  | 'best_reasoning'
  | 'best_cheap_fast'
  | 'best_long_context'
  | 'best_multimodal'
  | 'best_local'
  | 'best_free'

export type FeaturedEntry = {
  tier: FeaturedTier
  /**
   * Provider+slug the operator personally wants featured. Resolved against
   * the synced catalogue at read time.
   */
  source: ModelSource
  model_slug: string
  rationale: string
}

export type ResolvedFeaturedEntry = FeaturedEntry & {
  resolved: ModelRow | null
  status: 'available' | 'unavailable'
}

export type AliasName =
  | 'latest-openai'
  | 'latest-anthropic'
  | 'latest-google'
  | 'best-coding'
  | 'best-reasoning'
  | 'cheapest-fast'
  | 'local-default'

export type ResolvedAlias = {
  alias: AliasName
  resolved: ModelRow | null
  status: 'available' | 'unavailable'
}
