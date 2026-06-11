export interface ModelConfig {
  alias: string
  name: string
  provider: string
  description: string
  costPer1k: number
}

// Current best-in-class (2026) premium models only — no deprecated families.
// The featured/curated catalogue lives in src/lib/models/featured.ts; this
// alias map mirrors the same current slugs for legacy alias→model lookups.
export const MODEL_CATALOG: ModelConfig[] = [
  // Anthropic
  { alias: 'opus', name: 'anthropic/claude-opus-4-8', provider: 'anthropic', description: 'Flagship reasoning, 1M context', costPer1k: 15.0 },
  { alias: 'sonnet', name: 'anthropic/claude-sonnet-4-6', provider: 'anthropic', description: 'Fast high-quality workhorse / coding', costPer1k: 3.0 },
  { alias: 'haiku', name: 'anthropic/claude-haiku-4-5', provider: 'anthropic', description: 'Fast, low-cost current Haiku', costPer1k: 0.8 },
  // OpenAI
  { alias: 'gpt', name: 'openai/gpt-5.5', provider: 'openai', description: 'GPT-5.5 multimodal flagship (text/vision/voice)', costPer1k: 2.0 },
  // Google
  { alias: 'gemini', name: 'google/gemini-3.5', provider: 'google', description: 'Gemini 3.5 — frontier multimodal', costPer1k: 1.25 },
  { alias: 'gemini-flash', name: 'google/gemini-3.5-flash', provider: 'google', description: 'Gemini 3.5 Flash — fast + cheap', costPer1k: 0.15 },
  // Open-weight (current)
  { alias: 'qwen', name: 'qwen/qwen-3.7', provider: 'qwen', description: 'Qwen 3.7 — strong reasoning, large context', costPer1k: 0.6 },
  { alias: 'qwen-fast', name: 'qwen/qwen-3.6', provider: 'qwen', description: 'Qwen 3.6 — fast + cheap', costPer1k: 0.3 },
  // Other providers
  { alias: 'kimi', name: 'moonshot/kimi-2.6', provider: 'moonshot', description: 'Kimi 2.6 — very long context', costPer1k: 1.0 },
  { alias: 'minimax', name: 'minimax/minimax-m2.1', provider: 'minimax', description: 'Cost-effective, strong coding', costPer1k: 0.3 },
]

export function getModelByAlias(alias: string): ModelConfig | undefined {
  return MODEL_CATALOG.find(m => m.alias === alias)
}

export function getModelByName(name: string): ModelConfig | undefined {
  return MODEL_CATALOG.find(m => m.name === name)
}

export function getAllModels(): ModelConfig[] {
  return [...MODEL_CATALOG]
}
