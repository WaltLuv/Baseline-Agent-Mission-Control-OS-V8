/**
 * Curated featured-model list — THE single source of truth for which models
 * Mission Control features. Current best-in-class (2026) premium models only.
 *
 * Rules (Walt's spec):
 *   · CURRENT, premium models only — no deprecated families (no GPT-3.5/4/4o,
 *     no Claude 2/3/3.5, no Gemini 1.x/pro, no Llama/Mixtral/PaLM, no o1).
 *   · We DO NOT invent rumored slugs. Each entry is an actually-released model
 *     id OR an OpenRouter alias OpenRouter documents.
 *   · Availability is resolved against the synced provider catalogue at read
 *     time; an unsynced slug renders as `unavailable` (setup-needed), never
 *     hidden — so the operator sees provider-access gaps honestly.
 *   · No stale Haiku / silent down-routing.
 *
 * Deprecated slugs are enumerated in DEPRECATED_MODEL_PATTERNS below and
 * guarded by a test so they cannot reappear anywhere in the codebase.
 */

import type { FeaturedEntry } from './types'

export const FEATURED_CATALOG: FeaturedEntry[] = [
  // ── Best overall ────────────────────────────────────────────────
  { tier: 'best_overall', source: 'openrouter', model_slug: 'anthropic/claude-opus-4-8', rationale: 'Claude Opus 4.8 — flagship reasoning, 1M context, vision + tool use. Default for complex execution.' },
  { tier: 'best_overall', source: 'openrouter', model_slug: 'openai/gpt-5.5', rationale: 'OpenAI GPT-5.5 — multimodal flagship (text / vision / voice).' },
  { tier: 'best_overall', source: 'openrouter', model_slug: 'google/gemini-3.5', rationale: 'Gemini 3.5 — frontier multimodal, very large context.' },

  // ── Best reasoning ──────────────────────────────────────────────
  { tier: 'best_reasoning', source: 'openrouter', model_slug: 'anthropic/claude-opus-4-8', rationale: 'Opus 4.8 — deliberate multi-step reasoning for complex workflows.' },
  { tier: 'best_reasoning', source: 'openrouter', model_slug: 'qwen/qwen-3.7', rationale: 'Qwen 3.7 — strong open-weight reasoning, large context.' },

  // ── Best coding ─────────────────────────────────────────────────
  { tier: 'best_coding', source: 'openrouter', model_slug: 'anthropic/claude-opus-4-8', rationale: 'Top coding model — preferred Claude Code default.' },
  { tier: 'best_coding', source: 'openrouter', model_slug: 'anthropic/claude-sonnet-4-6', rationale: 'Claude Sonnet 4.6 — fast, high-quality coding for high-volume PR/diff work.' },

  // ── Best fast / cheap ───────────────────────────────────────────
  { tier: 'best_cheap_fast', source: 'openrouter', model_slug: 'google/gemini-3.5-flash', rationale: 'Gemini 3.5 Flash — fast frontier, cheap; great for triage + intake.' },
  { tier: 'best_cheap_fast', source: 'openrouter', model_slug: 'qwen/qwen-3.6', rationale: 'Qwen 3.6 — fast, capable, low cost.' },

  // ── Best multimodal ─────────────────────────────────────────────
  { tier: 'best_multimodal', source: 'openrouter', model_slug: 'google/gemini-3.5', rationale: 'Gemini 3.5 — native image / audio / video + text.' },
  { tier: 'best_multimodal', source: 'openrouter', model_slug: 'openai/gpt-5.5', rationale: 'GPT-5.5 — strong multimodal (image + audio) alongside text.' },

  // ── Best voice / realtime ───────────────────────────────────────
  { tier: 'best_voice_realtime', source: 'openrouter', model_slug: 'openai/gpt-5.5', rationale: 'GPT-5.5 — realtime voice + low-latency multimodal turns.' },
  { tier: 'best_voice_realtime', source: 'openrouter', model_slug: 'google/gemini-3.5-flash', rationale: 'Gemini 3.5 Flash — low-latency realtime / voice.' },

  // ── Best long context ───────────────────────────────────────────
  { tier: 'best_long_context', source: 'openrouter', model_slug: 'anthropic/claude-opus-4-8', rationale: 'Opus 4.8 — 1M-token context for large-document workflows.' },
  { tier: 'best_long_context', source: 'openrouter', model_slug: 'moonshot/kimi-2.6', rationale: 'Kimi 2.6 — very long context for big-document workflows.' },
]

/**
 * Alias resolution — each alias names candidate slugs in priority order; the
 * resolver picks the first present in the synced catalogue. Current models only.
 */
export const ALIASES: Record<string, string[]> = {
  'latest-openai': ['openai/gpt-5.5'],
  'latest-anthropic': ['anthropic/claude-opus-4-8', 'anthropic/claude-sonnet-4-6'],
  'latest-google': ['google/gemini-3.5', 'google/gemini-3.5-flash'],
  'best-coding': ['anthropic/claude-opus-4-8', 'anthropic/claude-sonnet-4-6'],
  'best-reasoning': ['anthropic/claude-opus-4-8', 'qwen/qwen-3.7'],
  'cheapest-fast': ['google/gemini-3.5-flash', 'qwen/qwen-3.6'],
}

/**
 * Deprecated model families — must NOT appear anywhere customer-facing in
 * Mission Control. Enforced by the no-deprecated-models test.
 * (Substring/regex fragments; matched case-insensitively.)
 */
export const DEPRECATED_MODEL_PATTERNS: RegExp[] = [
  /gpt-3\.5/i,
  /gpt-4o/i, // gpt-4o, gpt-4o-mini
  /gpt-4\.1/i,
  /gpt-4-turbo/i,
  /gpt-4-32k/i,
  /\bo1-(preview|mini)\b/i,
  /claude-2/i,
  /claude-instant/i,
  /claude-3[.\-]/i, // claude-3-*, claude-3.5-*, claude-3-5-*
  /gemini-1\.[05]/i,
  /gemini-pro/i,
  /gemini-flash-1\.5/i,
  /text-davinci/i,
  /\bpalm-?2?\b/i,
  /chat-bison/i,
  /\bmixtral\b/i,
  /llama-?[23][.\d-]/i, // llama-2 / 3 / 3.1 / 3.3
  /llama3[.:]/i, // llama3.3:70b, llama3.1
  /deepseek-(chat|r1)/i,
  /qwen2\.5/i,
]

/** The canonical set of current model slugs MC features (for assertions/UX). */
export const CURRENT_MODEL_SLUGS: string[] = Array.from(
  new Set(FEATURED_CATALOG.map((e) => e.model_slug)),
)

/** Canonical default model slugs — every seeded agent / default reads these,
 *  so there is one place to bump when the flagship changes. */
export const DEFAULT_MODEL_SLUG = 'anthropic/claude-opus-4-8'
export const DEFAULT_CODING_MODEL_SLUG = 'anthropic/claude-sonnet-4-6'
export const DEFAULT_FAST_MODEL_SLUG = 'google/gemini-3.5-flash'

/** True if a model slug/name belongs to a deprecated family. */
export function isDeprecatedModel(slug: string): boolean {
  return DEPRECATED_MODEL_PATTERNS.some((re) => re.test(slug))
}
