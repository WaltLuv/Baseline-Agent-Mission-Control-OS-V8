/**
 * Token Cost Calculator - converts raw LLM token usage into wholesale cost,
 * applies markup, and converts to retail credits.
 * This is the missing link between provider billing and user-facing credits.
 *
 * LLM rates are DERIVED from the canonical provider-cost catalog
 * (src/lib/billing/provider-cost-catalog.ts) — there is no separate hardcoded
 * model price table here.
 */
import { MODEL_COSTS } from '@/lib/billing/provider-cost-catalog'

const DEFAULT_MARKUP = 2.5
const CREDIT_DOLLAR = 0.01   // 1 credit = $0.01 retail equivalent

export interface TokenUsageInput {
  model: string
  provider?: string
  inputTokens: number
  outputTokens: number
  cacheReadTokens?: number
  cacheWriteTokens?: number
  flatRequests?: number
  markupMultiplier?: number
}

export interface CostResult {
  wholesaleCostUsd: number
  wholesaleCostCents: number
  retailCostUsd: number
  retailCostCents: number
  creditsRequired: number
  markupMultiplier: number
  breakdown: {
    inputUsd: number
    outputUsd: number
    cacheReadUsd?: number
    cacheWriteUsd?: number
    flatFeeUsd?: number
  }
}

// Derived from the canonical catalog (per-1M → per-1k). Single source of truth.
const PROVIDER_RATES: Record<string, { input1k: number; output1k: number; cache1k?: number }> = (() => {
  const rates: Record<string, { input1k: number; output1k: number; cache1k?: number }> = {}
  for (const m of MODEL_COSTS) {
    const row = {
      input1k: m.inputPerM / 1000,
      output1k: m.outputPerM / 1000,
      ...(m.cachedInputPerM != null ? { cache1k: m.cachedInputPerM / 1000 } : {}),
    }
    rates[m.model] = row
    rates[m.model.split('/').pop()!] = row // bare-name key too
  }
  // Non-LLM + safe default (most-expensive current model so unknowns never under-charge).
  rates['groq/whisper'] = { input1k: 0.001, output1k: 0 }
  rates['elevenlabs'] = { input1k: 0, output1k: 0 }
  const dearest = MODEL_COSTS.reduce((a, b) => (b.outputPerM > a.outputPerM ? b : a))
  rates['default'] = { input1k: dearest.inputPerM / 1000, output1k: dearest.outputPerM / 1000 }
  return rates
})()

function normalizeModel(model: string): string {
  if (!model) return "default"
  const parts = model.split("/")
  if (parts.length >= 3) return parts.slice(1).join("/")
  return model
}

function getRates(model: string) {
  const norm = normalizeModel(model)
  if (PROVIDER_RATES[norm]) return PROVIDER_RATES[norm]
  const segments = norm.split("/")
  const short = segments[segments.length - 1] || ""
  for (const [key, r] of Object.entries(PROVIDER_RATES)) {
    const k = key.split("/").pop() || ""
    if (short.includes(k) || k.includes(short)) return r
  }
  return PROVIDER_RATES["default"]
}

export function calculateTokenCosts(input: TokenUsageInput): CostResult {
  const { model, inputTokens, outputTokens, cacheReadTokens = 0, cacheWriteTokens = 0 } = input
  const markup = input.markupMultiplier ?? DEFAULT_MARKUP
  const r = getRates(model)

  const inputUsd = (inputTokens / 1000) * r.input1k
  const outputUsd = (outputTokens / 1000) * r.output1k
  const cacheReadUsd = cacheReadTokens > 0 ? (cacheReadTokens / 1000) * (r.cache1k || 0) : 0
  const cacheWriteUsd = cacheWriteTokens > 0 ? (cacheWriteTokens / 1000) * (r.cache1k || 0) : 0

  const wholesaleUsd = inputUsd + outputUsd + cacheReadUsd + cacheWriteUsd
  const retailUsd = wholesaleUsd * markup

  const retailCents = Math.max(1, Math.ceil(retailUsd * 100))
  const wholesaleCents = Math.max(1, Math.ceil(wholesaleUsd * 100))
  const credits = Math.max(1, Math.ceil(retailUsd / CREDIT_DOLLAR))

  return {
    wholesaleCostUsd: Math.round(wholesaleUsd * 100000) / 100000,
    wholesaleCostCents: wholesaleCents,
    retailCostUsd: Math.round(retailUsd * 100000) / 100000,
    retailCostCents: retailCents,
    creditsRequired: credits,
    markupMultiplier: markup,
    breakdown: {
      inputUsd: Math.round(inputUsd * 100000) / 100000,
      outputUsd: Math.round(outputUsd * 100000) / 100000,
      ...(cacheReadUsd > 0 && { cacheReadUsd: Math.round(cacheReadUsd * 100000) / 100000 }),
      ...(cacheWriteUsd > 0 && { cacheWriteUsd: Math.round(cacheWriteUsd * 100000) / 100000 }),
    },
  }
}

export function estimatedTokensForModel(
  model: string, taskType: string
): { input: number; output: number } {
  const estimates: Record<string, { input: number; output: number }> = {
    text_generation: { input: 2000, output: 1000 },
    code_generation: { input: 4000, output: 2000 },
    chat_response:   { input: 1000, output: 500 },
    analysis:        { input: 5000, output: 2000 },
    vision:          { input: 10000, output: 1500 },
    default:         { input: 2000, output: 1000 },
  }
  return estimates[taskType] || estimates.default
}
