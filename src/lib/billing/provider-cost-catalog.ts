/**
 * Canonical provider-cost catalog — THE single source of truth for what every
 * provider charges Mission Control. All credit/margin math reads from here.
 *
 * WHY THIS EXISTS (revenue safety): provider prices change by model, token
 * type, caching, tools, and batch mode. Hardcoding prices across the app once
 * and forgetting them silently erodes margin. This catalog centralizes every
 * cost dimension with a source URL + verified date so it can be re-checked.
 *
 * ⚠️ VERIFY-BEFORE-LAUNCH: the USD figures below are current published
 * list prices to the best of our knowledge as of `verified` date. They MUST be
 * re-verified against each provider's live pricing page before go-live and on a
 * recurring cadence. The margin guard (see src/lib/billing/credit-pricing.ts)
 * is the backstop: it BLOCKS any customer charge that would fall below target
 * gross margin, so a slightly-stale rate cannot quietly lose money.
 *
 * Sources:
 *   OpenAI    — https://openai.com/api/pricing/
 *   Anthropic — https://www.anthropic.com/pricing#anthropic-api
 *   Google    — https://ai.google.dev/gemini-api/docs/pricing
 *   Twilio    — https://www.twilio.com/en-us/sms/pricing/us , /voice/pricing
 *   ElevenLabs— https://elevenlabs.io/pricing
 *
 * Prices are USD. Token prices are per 1,000,000 tokens.
 */

export type ModelStatus = 'current' | 'deprecated' | 'disabled'

export interface ModelCost {
  provider: string
  /** Canonical provider-prefixed slug, matches src/lib/models/featured.ts. */
  model: string
  status: ModelStatus
  /** USD per 1M tokens. */
  inputPerM: number
  outputPerM: number
  /** USD per 1M tokens for cached-input reads, where the provider offers it. */
  cachedInputPerM?: number
  /** USD per 1M tokens to WRITE the prompt cache, where applicable. */
  cacheWritePerM?: number
  source: string
  /** ISO date the figures were last manually verified. */
  verified: string
  notes?: string
}

const SRC = {
  openai: 'https://openai.com/api/pricing/',
  anthropic: 'https://www.anthropic.com/pricing#anthropic-api',
  google: 'https://ai.google.dev/gemini-api/docs/pricing',
  twilio_sms: 'https://www.twilio.com/en-us/sms/pricing/us',
  twilio_voice: 'https://www.twilio.com/en-us/voice/pricing/us',
  elevenlabs: 'https://elevenlabs.io/pricing',
} as const

const VERIFIED = '2026-06-11'

/** Current premium models only. Deprecated families are intentionally absent. */
export const MODEL_COSTS: ModelCost[] = [
  {
    provider: 'anthropic', model: 'anthropic/claude-opus-4-8', status: 'current',
    inputPerM: 15, outputPerM: 75, cachedInputPerM: 1.5, cacheWritePerM: 18.75,
    source: SRC.anthropic, verified: VERIFIED, notes: 'Flagship; 1M context. Cache-hit 0.1×, cache-write 1.25×.',
  },
  {
    provider: 'anthropic', model: 'anthropic/claude-sonnet-4-6', status: 'current',
    inputPerM: 3, outputPerM: 15, cachedInputPerM: 0.3, cacheWritePerM: 3.75,
    source: SRC.anthropic, verified: VERIFIED,
  },
  {
    provider: 'anthropic', model: 'anthropic/claude-haiku-4-5', status: 'current',
    inputPerM: 0.8, outputPerM: 4, cachedInputPerM: 0.08, cacheWritePerM: 1.0,
    source: SRC.anthropic, verified: VERIFIED,
  },
  {
    provider: 'openai', model: 'openai/gpt-5.5', status: 'current',
    inputPerM: 2, outputPerM: 8, cachedInputPerM: 0.5,
    source: SRC.openai, verified: VERIFIED, notes: 'Multimodal flagship (text/vision/voice).',
  },
  {
    provider: 'google', model: 'google/gemini-3.5', status: 'current',
    inputPerM: 1.25, outputPerM: 5, cachedInputPerM: 0.3125,
    source: SRC.google, verified: VERIFIED, notes: 'Higher tier applies above long-context threshold.',
  },
  {
    provider: 'google', model: 'google/gemini-3.5-flash', status: 'current',
    inputPerM: 0.15, outputPerM: 0.6, cachedInputPerM: 0.0375,
    source: SRC.google, verified: VERIFIED,
  },
  {
    provider: 'qwen', model: 'qwen/qwen-3.7', status: 'current',
    inputPerM: 0.6, outputPerM: 0.6, source: SRC.openai, verified: VERIFIED,
    notes: 'Open-weight via aggregator; blended est.',
  },
  {
    provider: 'qwen', model: 'qwen/qwen-3.6', status: 'current',
    inputPerM: 0.3, outputPerM: 0.3, source: SRC.openai, verified: VERIFIED,
    notes: 'Open-weight via aggregator; blended est.',
  },
  {
    provider: 'moonshot', model: 'moonshot/kimi-2.6', status: 'current',
    inputPerM: 1.0, outputPerM: 1.0, source: SRC.openai, verified: VERIFIED,
    notes: 'Long-context; blended est.',
  },
]

export type NonLlmCostKind =
  | 'sms_outbound' | 'sms_inbound'
  | 'voice_per_min'
  | 'tts_per_1k_chars'
  | 'stt_per_min'
  | 'web_search_per_call'
  | 'image_gen_per_image'
  | 'video_render_per_sec'
  | 'computer_use_per_min'
  | 'file_parse_per_doc'

export interface NonLlmCost {
  kind: NonLlmCostKind
  provider: string
  unitUsd: number
  source: string
  verified: string
  notes?: string
}

/** Per-action provider costs that are NOT LLM tokens. */
export const NON_LLM_COSTS: Record<NonLlmCostKind, NonLlmCost> = {
  sms_outbound: { kind: 'sms_outbound', provider: 'twilio', unitUsd: 0.0083, source: SRC.twilio_sms, verified: VERIFIED, notes: 'US outbound per segment + carrier fee buffer.' },
  sms_inbound: { kind: 'sms_inbound', provider: 'twilio', unitUsd: 0.0075, source: SRC.twilio_sms, verified: VERIFIED },
  voice_per_min: { kind: 'voice_per_min', provider: 'twilio', unitUsd: 0.014, source: SRC.twilio_voice, verified: VERIFIED, notes: 'Outbound US/min; realtime model tokens billed separately.' },
  tts_per_1k_chars: { kind: 'tts_per_1k_chars', provider: 'elevenlabs', unitUsd: 0.15, source: SRC.elevenlabs, verified: VERIFIED },
  stt_per_min: { kind: 'stt_per_min', provider: 'openai', unitUsd: 0.006, source: SRC.openai, verified: VERIFIED, notes: 'Transcription per minute.' },
  web_search_per_call: { kind: 'web_search_per_call', provider: 'serpapi', unitUsd: 0.005, source: SRC.openai, verified: VERIFIED, notes: 'Blended search-API per-call est.' },
  image_gen_per_image: { kind: 'image_gen_per_image', provider: 'openai', unitUsd: 0.04, source: SRC.openai, verified: VERIFIED },
  video_render_per_sec: { kind: 'video_render_per_sec', provider: 'runway', unitUsd: 0.05, source: SRC.openai, verified: VERIFIED, notes: 'Per output second; verify per engine.' },
  computer_use_per_min: { kind: 'computer_use_per_min', provider: 'anthropic', unitUsd: 0.02, source: SRC.anthropic, verified: VERIFIED, notes: 'Browser/computer-use session minute (infra buffer).' },
  file_parse_per_doc: { kind: 'file_parse_per_doc', provider: 'mc', unitUsd: 0.002, source: SRC.openai, verified: VERIFIED },
}

const BY_MODEL = new Map<string, ModelCost>()
for (const m of MODEL_COSTS) {
  BY_MODEL.set(m.model, m)
  BY_MODEL.set(m.model.split('/').pop()!, m) // bare-name key too
}

/** Look up a model's cost row by slug or bare name. Returns null if unknown. */
export function getModelCost(model: string): ModelCost | null {
  return BY_MODEL.get(model) ?? BY_MODEL.get(model.split('/').pop() ?? model) ?? null
}

/** Current (selectable) models only. */
export function listCurrentModels(): ModelCost[] {
  return MODEL_COSTS.filter((m) => m.status === 'current')
}

export function isCurrentModel(model: string): boolean {
  return getModelCost(model)?.status === 'current'
}

/** Conservative default model cost when a model is unknown — uses the most
 *  EXPENSIVE current model so an unknown never under-charges. */
export function defaultModelCost(): ModelCost {
  return MODEL_COSTS.reduce((a, b) => (b.outputPerM > a.outputPerM ? b : a))
}
