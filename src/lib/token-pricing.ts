import { getProviderFromModel } from '@/lib/provider-subscriptions'

interface ModelPricing {
  inputPerMTok: number
  outputPerMTok: number
}

const DEFAULT_MODEL_PRICING: ModelPricing = {
  inputPerMTok: 3.0,
  outputPerMTok: 15.0,
}

// Current premium models only. Pricing for cost estimation in the token
// dashboard. Both slug and bare-name keys are supported.
const MODEL_PRICING: Record<string, ModelPricing> = {
  // Anthropic (current)
  'anthropic/claude-haiku-4-5': { inputPerMTok: 0.8, outputPerMTok: 4.0 },
  'claude-haiku-4-5': { inputPerMTok: 0.8, outputPerMTok: 4.0 },
  'anthropic/claude-sonnet-4-6': { inputPerMTok: 3.0, outputPerMTok: 15.0 },
  'claude-sonnet-4-6': { inputPerMTok: 3.0, outputPerMTok: 15.0 },
  'anthropic/claude-opus-4-8': { inputPerMTok: 15.0, outputPerMTok: 75.0 },
  'claude-opus-4-8': { inputPerMTok: 15.0, outputPerMTok: 75.0 },

  // OpenAI (current)
  'openai/gpt-5.5': { inputPerMTok: 2.0, outputPerMTok: 8.0 },
  'gpt-5.5': { inputPerMTok: 2.0, outputPerMTok: 8.0 },

  // Google (current)
  'google/gemini-3.5': { inputPerMTok: 1.25, outputPerMTok: 5.0 },
  'google/gemini-3.5-flash': { inputPerMTok: 0.15, outputPerMTok: 0.6 },

  // Open-weight / other (current)
  'qwen/qwen-3.7': { inputPerMTok: 0.6, outputPerMTok: 0.6 },
  'qwen/qwen-3.6': { inputPerMTok: 0.3, outputPerMTok: 0.3 },
  'moonshot/kimi-2.6': { inputPerMTok: 1.0, outputPerMTok: 1.0 },
  'minimax/minimax-m2.1': { inputPerMTok: 0.3, outputPerMTok: 0.3 },
}

function normalizedModelName(modelName: string): string {
  return modelName.trim().toLowerCase()
}

const ZERO_PRICING: ModelPricing = { inputPerMTok: 0, outputPerMTok: 0 }

export function getModelPricing(modelName: string): ModelPricing {
  const normalized = normalizedModelName(modelName)
  // Local / self-hosted runtimes have zero provider token cost.
  if (normalized.startsWith('ollama/') || normalized.startsWith('lm_studio/') || normalized.startsWith('lmstudio/')) {
    return ZERO_PRICING
  }
  if (MODEL_PRICING[normalized] !== undefined) return MODEL_PRICING[normalized]

  for (const [model, pricing] of Object.entries(MODEL_PRICING)) {
    const shortName = model.split('/').pop() || model
    if (normalized.includes(shortName)) return pricing
  }

  return DEFAULT_MODEL_PRICING
}

interface CostOptions {
  providerSubscriptions?: Record<string, boolean>
}

export function calculateTokenCost(
  modelName: string,
  inputTokens: number,
  outputTokens: number,
  options?: CostOptions,
): number {
  const provider = getProviderFromModel(modelName)
  if (provider !== 'unknown' && options?.providerSubscriptions?.[provider]) {
    return 0
  }

  const pricing = getModelPricing(modelName)
  return ((inputTokens * pricing.inputPerMTok) + (outputTokens * pricing.outputPerMTok)) / 1_000_000
}
