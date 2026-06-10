/**
 * Curated featured-model list — operator's manual override.
 *
 * Rule (Walt's spec): we DO NOT invent rumored slugs. Each entry below is
 * either an actually-released model id known to the operator OR an
 * OpenRouter alias that OpenRouter itself documents. If a slug stops being
 * available, the catalogue read marks it `unavailable` instead of hiding
 * the gap.
 */

import type { FeaturedEntry } from './types'

export const FEATURED_CATALOG: FeaturedEntry[] = [
  // ── 2026 flagship models (added per operator instruction — high context,
  //    reasoning, vision, voice, multimodal; for the complex workflows MC runs) ──
  { tier: 'best_overall', source: 'openrouter', model_slug: 'anthropic/claude-opus-4-8', rationale: 'Claude Opus 4.8 — flagship reasoning, 1M context, vision + tool use. Default for complex execution.' },
  { tier: 'best_overall', source: 'openrouter', model_slug: 'anthropic/claude-opus-4-7', rationale: 'Claude Opus 4.7 — high-reasoning predecessor, long context.' },
  { tier: 'best_overall', source: 'openrouter', model_slug: 'openai/gpt-5.5', rationale: 'OpenAI GPT-5.5 — multimodal flagship (text/vision/voice).' },
  { tier: 'best_reasoning', source: 'openrouter', model_slug: 'anthropic/claude-opus-4-8', rationale: 'Opus 4.8 deliberate reasoning for multi-step workflows.' },
  { tier: 'best_reasoning', source: 'openrouter', model_slug: 'qwen/qwen-3.7', rationale: 'Qwen 3.7 — strong open-weight reasoning, large context.' },
  { tier: 'best_cheap_fast', source: 'openrouter', model_slug: 'qwen/qwen-3.6', rationale: 'Qwen 3.6 — fast, capable, low cost.' },
  { tier: 'best_multimodal', source: 'openrouter', model_slug: 'google/gemini-3.5', rationale: 'Gemini 3.5 — vision/voice/text multimodal, very large context.' },
  { tier: 'best_cheap_fast', source: 'openrouter', model_slug: 'google/gemini-3.5-flash', rationale: 'Gemini 3.5 Flash — fast frontier, cheap; great for triage + intake.' },
  { tier: 'best_long_context', source: 'openrouter', model_slug: 'moonshot/kimi-2.6', rationale: 'Kimi 2.6 — very long context for big-document workflows.' },
  { tier: 'best_long_context', source: 'openrouter', model_slug: 'moonshot/kimi-2.5', rationale: 'Kimi 2.5 — long-context predecessor.' },

  // ── Best overall ────────────────────────────────────────────────
  {
    tier: 'best_overall',
    source: 'openrouter',
    model_slug: 'openai/gpt-4o',
    rationale: 'OpenAI flagship multimodal; broad tool + image support, well-known reliability.',
  },
  {
    tier: 'best_overall',
    source: 'openrouter',
    model_slug: 'anthropic/claude-3.5-sonnet',
    rationale: 'Anthropic balanced flagship; strong tool use + long context.',
  },

  // ── Best coding ─────────────────────────────────────────────────
  {
    tier: 'best_coding',
    source: 'openrouter',
    model_slug: 'anthropic/claude-3.5-sonnet',
    rationale: 'Top coding benchmark performer; preferred Claude Code default.',
  },
  {
    tier: 'best_coding',
    source: 'openrouter',
    model_slug: 'deepseek/deepseek-chat',
    rationale: 'High-quality code generation at low cost.',
  },

  // ── Best reasoning ──────────────────────────────────────────────
  {
    tier: 'best_reasoning',
    source: 'openrouter',
    model_slug: 'openai/o1-preview',
    rationale: 'OpenAI o1 family — deliberate chain-of-thought.',
  },
  {
    tier: 'best_reasoning',
    source: 'openrouter',
    model_slug: 'deepseek/deepseek-r1',
    rationale: 'Open-weight reasoning model with strong math/logic.',
  },

  // ── Best cheap / fast ───────────────────────────────────────────
  {
    tier: 'best_cheap_fast',
    source: 'openrouter',
    model_slug: 'openai/gpt-4o-mini',
    rationale: 'Cheap, fast, capable enough for most agent loops.',
  },
  {
    tier: 'best_cheap_fast',
    source: 'openrouter',
    model_slug: 'google/gemini-flash-1.5',
    rationale: 'Inexpensive Gemini variant — solid for triage + summarization.',
  },

  // ── Best long context ───────────────────────────────────────────
  {
    tier: 'best_long_context',
    source: 'openrouter',
    model_slug: 'google/gemini-pro-1.5',
    rationale: 'Multi-million-token context window for whole-codebase tasks.',
  },
  {
    tier: 'best_long_context',
    source: 'openrouter',
    model_slug: 'anthropic/claude-3.5-sonnet',
    rationale: 'Reliable 200k context with high-quality retrieval.',
  },

  // ── Best multimodal ─────────────────────────────────────────────
  {
    tier: 'best_multimodal',
    source: 'openrouter',
    model_slug: 'openai/gpt-4o',
    rationale: 'Strong image + audio handling alongside text.',
  },
  {
    tier: 'best_multimodal',
    source: 'openrouter',
    model_slug: 'google/gemini-pro-1.5',
    rationale: 'Native multimodal across image / audio / video.',
  },

  // ── Best local ──────────────────────────────────────────────────
  {
    tier: 'best_local',
    source: 'ollama',
    model_slug: 'qwen2.5-coder:32b',
    rationale: 'Strong local coding model. Requires Ollama configured.',
  },
  {
    tier: 'best_local',
    source: 'ollama',
    model_slug: 'llama3.3:70b',
    rationale: 'High-capability general local model. Requires Ollama configured.',
  },

  // ── Best free / OpenRouter free ─────────────────────────────────
  {
    tier: 'best_free',
    source: 'openrouter',
    model_slug: 'meta-llama/llama-3.3-70b-instruct:free',
    rationale: 'OpenRouter free-tier Llama 3.3 70B variant.',
  },
  {
    tier: 'best_free',
    source: 'openrouter',
    model_slug: 'google/gemini-flash-1.5:free',
    rationale: 'OpenRouter free-tier Gemini Flash.',
  },
]

/**
 * Alias resolution. For each alias we name two or three candidate slugs in
 * priority order; the resolver picks the first one present in the synced
 * catalogue.
 */
export const ALIASES: Record<string, string[]> = {
  'latest-openai': ['openai/gpt-4o', 'openai/gpt-4o-mini', 'openai/gpt-4-turbo'],
  'latest-anthropic': ['anthropic/claude-3.5-sonnet', 'anthropic/claude-3-opus'],
  'latest-google': ['google/gemini-pro-1.5', 'google/gemini-flash-1.5'],
  'best-coding': ['anthropic/claude-3.5-sonnet', 'deepseek/deepseek-chat', 'openai/gpt-4o'],
  'best-reasoning': ['openai/o1-preview', 'deepseek/deepseek-r1', 'anthropic/claude-3.5-sonnet'],
  'cheapest-fast': ['openai/gpt-4o-mini', 'google/gemini-flash-1.5', 'mistralai/mistral-small'],
  'local-default': ['qwen2.5-coder:32b', 'llama3.3:70b'],
}
