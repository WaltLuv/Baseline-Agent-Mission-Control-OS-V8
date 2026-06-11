/**
 * Agent Factory engine priority.
 *
 * PRIMARY engine: Claude Code (a paired/connected Claude Code coding runtime).
 * Ollama is ONLY an optional local/free fallback for quick HTML demos — it must
 * never be the reason Agent Factory works or doesn't. Other configured coding
 * backends (OpenRouter / OpenAI / Gemini) can also serve as fallbacks.
 *
 * Readiness is honest and derived from real signals:
 *   READY                     — a Claude Code runtime is connected/authenticated
 *   SETUP_NEEDED              — no Claude Code runtime; an optional fallback IS available
 *   BLOCKED                   — no Claude Code runtime AND no fallback at all
 * plus a separate `fallback` flag for whether Ollama (or another) is available.
 */
export type FactoryEngine = 'claude-code' | 'ollama' | 'openrouter' | 'openai' | 'gemini'

export type FactoryReadiness = 'ready' | 'setup-needed' | 'blocked'

export interface FactorySignals {
  /** A Claude Code coding runtime is paired + authenticated. */
  claudeCodeConnected?: boolean
  /** Optional local fallback (Ollama) is running. */
  ollamaRunning?: boolean
  /** Any other configured cloud coding backend (OpenRouter/OpenAI/Gemini). */
  cloudFallbackConfigured?: boolean
}

export interface FactoryStatus {
  readiness: FactoryReadiness
  /** The engine a build will actually use right now. */
  primaryEngine: FactoryEngine | null
  fallbackAvailable: boolean
  fallbackEngine: FactoryEngine | null
  message: string
}

export function deriveFactoryStatus(s: FactorySignals): FactoryStatus {
  const fallbackEngine: FactoryEngine | null = s.ollamaRunning
    ? 'ollama'
    : s.cloudFallbackConfigured
      ? 'openrouter'
      : null
  const fallbackAvailable = fallbackEngine !== null

  if (s.claudeCodeConnected) {
    return {
      readiness: 'ready',
      primaryEngine: 'claude-code',
      fallbackAvailable,
      fallbackEngine,
      message: 'Agent Factory builds through Claude Code.' + (fallbackAvailable ? ' Ollama fallback available (optional).' : ''),
    }
  }
  if (fallbackAvailable) {
    return {
      readiness: 'setup-needed',
      primaryEngine: fallbackEngine, // a build can still run on the optional fallback
      fallbackAvailable,
      fallbackEngine,
      message: 'Connect a Claude Code runtime to build with the primary engine. An optional fallback is available in the meantime.',
    }
  }
  return {
    readiness: 'blocked',
    primaryEngine: null,
    fallbackAvailable: false,
    fallbackEngine: null,
    message: 'Connect Claude Code runtime to build apps. (Ollama is an optional local fallback, not required.)',
  }
}

/** Recommended local fallback models (only relevant if Walt opts into Ollama). */
export const OLLAMA_RECOMMENDED_MODELS = [
  { id: 'gemma3', note: 'solid all-rounder (~5 GB)' },
  { id: 'qwen3', note: 'sharper code + reasoning (16 GB+ RAM)' },
]

/** Detect a connected Claude Code coding runtime from the runtime registry list. */
export function hasClaudeCodeRuntime(runtimes: { name?: string; framework?: string; status?: string }[]): boolean {
  return runtimes.some((r) => {
    const tag = `${r.name ?? ''} ${r.framework ?? ''}`.toLowerCase()
    const live = !r.status || r.status === 'connected' || r.status === 'online' || r.status === 'active'
    return /claude[\s-]?code|claude-code|\bccr\b/.test(tag) && live
  })
}
