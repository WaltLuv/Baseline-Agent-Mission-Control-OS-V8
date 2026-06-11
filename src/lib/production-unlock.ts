/**
 * Production Unlock Center — the curated list of external systems that must be
 * connected to unlock full production functionality.
 *
 * This is a focused, ordered view OVER the provider catalog
 * (src/lib/credentials/catalog.ts). Each unlock item references one or more
 * real providers and adds production-readiness metadata: where it's used, what
 * it unlocks, the setup steps, and a production-impact weight.
 *
 * TRUTH-FIRST: this module is data only. Live status is merged at render time
 * from /api/credentials/catalog (connected / pending / error / missing). No
 * fake-ready states — an item with no saved credential renders as "missing".
 */
import { PROVIDER_CATALOG, getProvider, type ProviderEntry } from '@/lib/credentials/catalog'

/** How much a missing credential blocks going to production. */
export type ProductionImpact = 'critical' | 'high' | 'medium' | 'low'

export interface UnlockItem {
  /** Stable unlock id (distinct from a provider id; an unlock may span providers). */
  id: string
  name: string
  /** Backing provider catalog ids (must all exist in PROVIDER_CATALOG). */
  providerIds: string[]
  impact: ProductionImpact
  /** Where in the product this credential is consumed. */
  whereUsed: string
  /** Features that light up once this is connected. */
  featuresUnlocked: string[]
  /** Env var names accepted as a fallback (merged from providers). */
  requiredEnvVars: string[]
  /** Plain-English setup instructions. */
  setupInstructions: string
  /** External setup URL (from the first backing provider). */
  setupUrl?: string
  /** Whether a test-connection probe exists for at least one backing provider. */
  testConnectionSupported: boolean
}

const IMPACT_ORDER: Record<ProductionImpact, number> = { critical: 0, high: 1, medium: 2, low: 3 }

/** Build an unlock item, auto-deriving env vars / setup url / test support from providers. */
function unlock(
  id: string,
  name: string,
  providerIds: string[],
  impact: ProductionImpact,
  whereUsed: string,
  setupInstructions: string,
  extraFeatures: string[] = [],
): UnlockItem {
  const providers = providerIds.map((pid) => getProvider(pid)).filter(Boolean) as ProviderEntry[]
  if (providers.length !== providerIds.length) {
    const missing = providerIds.filter((pid) => !getProvider(pid))
    throw new Error(`production-unlock "${id}" references unknown provider(s): ${missing.join(', ')}`)
  }
  const requiredEnvVars = Array.from(new Set(providers.flatMap((p) => p.env_var_names)))
  const featuresUnlocked = Array.from(
    new Set([...providers.flatMap((p) => p.required_for_features), ...extraFeatures]),
  )
  return {
    id,
    name,
    providerIds,
    impact,
    whereUsed,
    featuresUnlocked,
    requiredEnvVars,
    setupInstructions,
    setupUrl: providers.find((p) => p.setup_url)?.setup_url,
    testConnectionSupported: providers.some((p) => p.test_connection_supported),
  }
}

/**
 * The production unlock checklist, in the order Walt requested. Ordered by
 * production impact, then by the request order, at render time.
 */
export const UNLOCK_ITEMS: UnlockItem[] = [
  unlock(
    'stripe',
    'Stripe (+ webhook secret)',
    ['stripe'],
    'critical',
    'Billing page — credit packs, checkout, and webhook fulfillment.',
    'Create a Stripe account, copy the Secret API key (sk_live_…) and the Webhook signing secret (whsec_…) from the Stripe dashboard, and add both in Credentials → Stripe. The webhook secret is required for credit fulfillment to land after checkout.',
    ['Paid credit packs', 'Checkout', 'Webhook fulfillment'],
  ),
  unlock(
    'claude_code_runtime',
    'Claude Code runtime',
    ['claude_code', 'anthropic'],
    'high',
    'Agent Factory primary build engine + Claude Code runtime ingest.',
    'Install and authenticate the Claude Code CLI (the Agent Factory primary engine). Optionally add an Anthropic API key for raw-API mode. Ollama remains an optional local fallback — it is never required.',
    ['Agent Factory (Claude Code primary)', 'Claude Code session ingest'],
  ),
  unlock(
    'google_oauth',
    'Google OAuth',
    ['google_oauth'],
    'high',
    'Login page — "Sign in with Google" and Google workspace integrations.',
    'Create an OAuth client in Google Cloud Console, set the redirect URI, then add the client ID + client secret in Credentials → Google OAuth.',
    ['Sign in with Google'],
  ),
  unlock(
    'telegram',
    'Telegram',
    ['telegram_bot'],
    'high',
    'Human-in-the-loop approval gate + mobile alerts.',
    'Create a bot with @BotFather, copy the bot token and your numeric chat id, and add them in Credentials → Telegram Bot.',
    ['Telegram approval gate', 'Mobile alerts'],
  ),
  unlock(
    'realtime_voice',
    'OpenAI Realtime / Gemini Live',
    ['openai', 'google_gemini'],
    'high',
    'Native speech-to-speech voice for the workspace voice assistant.',
    'Add an OpenAI API key (GPT Realtime) and/or a Google Gemini key (Gemini Live). Either unlocks the native realtime voice path; without one the voice surface stays in honest setup-needed state.',
    ['Realtime speech-to-speech voice'],
  ),
  unlock(
    'elevenlabs',
    'ElevenLabs',
    ['elevenlabs'],
    'medium',
    'Voice synthesis + audio briefs (workspace fallback voice).',
    'Create an ElevenLabs account and add the API key in Credentials → ElevenLabs.',
    ['Voice synthesis', 'Audio briefs'],
  ),
  unlock(
    'notebooklm',
    'NotebookLM / Google Drive import',
    ['notebooklm', 'google_drive'],
    'medium',
    'NotebookLM Brain Layer — Drive import + notebook chat.',
    'Authorize Google Drive and NotebookLM access (Google consent required). NotebookLM has no public write API; the import/preview surfaces are honest about what needs Google sign-in.',
    ['NotebookLM import center', 'Drive file ingest'],
  ),
  unlock(
    'notion',
    'Notion',
    ['notion'],
    'medium',
    'Brain Layer 2 — structured business memory + Notion-backed skills.',
    'Create a Notion internal integration, share the target databases with it, then add the integration secret in Credentials → Notion.',
  ),
  unlock(
    'pinecone',
    'Pinecone',
    ['pinecone'],
    'medium',
    'Brain Layer 3 — long-term semantic memory / vector graph.',
    'Create a Pinecone index and add the API key (and index name) in Credentials → Pinecone.',
  ),
  unlock(
    'github',
    'GitHub',
    ['github'],
    'medium',
    'Engineering escalations, PR drafting, repo memory.',
    'Create a fine-grained personal access token and add it in Credentials → GitHub.',
  ),
  unlock(
    'openrouter',
    'OpenRouter',
    ['openrouter'],
    'medium',
    'Multi-provider agent routing + live PAYG balance/burn-rate.',
    'Create an OpenRouter key and add it in Credentials → OpenRouter.',
  ),
  unlock(
    'higgsfield',
    'Higgsfield',
    ['higgsfield'],
    'low',
    'Higgsfield Supercomputer — AI video + image generation.',
    'Add a Higgsfield API key in Credentials → Higgsfield to enable live generation.',
  ),
  unlock(
    'vercel',
    'Vercel',
    ['vercel'],
    'low',
    'Deploy + observability skills.',
    'Create a Vercel token and add it in Credentials → Vercel.',
  ),
  unlock(
    'supabase',
    'Supabase',
    ['supabase'],
    'low',
    'Optional hosted Postgres + auth for Supabase-backed skills.',
    'Create a Supabase project and add the project URL + service-role key in Credentials → Supabase.',
  ),
  unlock(
    'ollama',
    'Ollama (optional fallback)',
    ['ollama'],
    'low',
    'Optional local/offline fallback engine for Agent Factory. Never required.',
    'Install Ollama and pull a model (e.g. `ollama pull qwen3`). Set the endpoint in Credentials → Ollama. This is an optional fallback only — Agent Factory builds through Claude Code by default.',
  ),
]

/** All unlock items, sorted by production impact (critical → low). */
export function unlockItemsByImpact(): UnlockItem[] {
  return [...UNLOCK_ITEMS].sort((a, b) => IMPACT_ORDER[a.impact] - IMPACT_ORDER[b.impact])
}

export function getUnlockItem(id: string): UnlockItem | undefined {
  return UNLOCK_ITEMS.find((u) => u.id === id)
}

/** Sanity helper: every backing provider id resolves to a real catalog entry. */
export function allProviderRefsResolve(): boolean {
  return UNLOCK_ITEMS.every((u) => u.providerIds.every((pid) => PROVIDER_CATALOG.some((p) => p.id === pid)))
}
