/**
 * Token Cost Calculator - converts raw LLM token usage into wholesale cost,
 * applies markup, and converts to retail credits.
 * This is the missing link between provider billing and user-facing credits.
 */

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

const PROVIDER_RATES: Record<string, { input1k: number; output1k: number; cache1k?: number }> = {
  "anthropic/claude-sonnet-4":     { input1k: 0.003, output1k: 0.015 },
  "anthropic/claude-opus-4":       { input1k: 0.015, output1k: 0.075 },
  "anthropic/claude-3.5-sonnet":   { input1k: 0.003, output1k: 0.015 },
  "anthropic/claude-haiku-3":      { input1k: 0.0008, output1k: 0.004 },
  "openai/gpt-4o":                 { input1k: 0.0025, output1k: 0.01 },
  "openai/gpt-4-turbo":            { input1k: 0.01, output1k: 0.03 },
  "gemini/gemini-2.5-flash":       { input1k: 0.00015, output1k: 0.0006 },
  "gemini/gemini-2.5-pro":         { input1k: 0.00125, output1k: 0.01 },
  "qwen/qwen3-235b":               { input1k: 0.0002, output1k: 0.001 },
  "groq/whisper":                  { input1k: 0.001, output1k: 0 },
  "elevenlabs":                    { input1k: 0, output1k: 0 },
  "default":                       { input1k: 0.003, output1k: 0.015 },
}

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
