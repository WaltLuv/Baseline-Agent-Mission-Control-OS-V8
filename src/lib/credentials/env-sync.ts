/**
 * Env → credential-store sync.
 *
 * The Credentials surface reads ONLY the encrypted workspace store, so keys
 * that live in the environment (.env.local, container env, etc.) showed up as
 * "missing" even though they were configured. This module imports those env
 * values into the store so a provider is connected the moment its key exists in
 * the environment — no manual re-entry in the UI.
 *
 * Behaviour:
 *   · Only fills providers that have NO row yet (never clobbers a credential a
 *     human entered/edited through the UI).
 *   · Encrypts via the same store (refuses if CREDENTIALS_ENCRYPTION_KEY unset).
 *   · Optionally runs the real test-connection probe so imported rows flip from
 *     `pending` to `connected`/`error` instead of staying unverified.
 */
import { PROVIDER_CATALOG } from './catalog'
import { getCredential, upsertCredential, markVerified, isEncryptionConfigured, decryptCredentialForRuntime } from './store'
import { PROBES, isProbeSupported } from './probes'
import { logger } from '../logger'

/** Per-provider mapping: which env var(s) feed which field key. First match wins. */
type FieldEnvMap = { secrets?: Record<string, string[]>; public?: Record<string, string[]> }

const ENV_MAP: Record<string, FieldEnvMap> = {
  // ── LLM ──
  openai: { secrets: { api_key: ['OPENAI_API_KEY'] } },
  anthropic: { secrets: { api_key: ['ANTHROPIC_API_KEY'] } },
  google_gemini: { secrets: { api_key: ['GEMINI_API_KEY', 'GOOGLE_API_KEY'] } },
  groq: { secrets: { api_key: ['GROQ_API_KEY'] } },
  openrouter: { secrets: { api_key: ['OPENROUTER_API_KEY'] }, public: { base_url: ['OPENROUTER_BASE_URL'] } },
  perplexity: { secrets: { api_key: ['PERPLEXITY_API_KEY'] } },
  mistral: { secrets: { api_key: ['MISTRAL_API_KEY'] } },
  xai: { secrets: { api_key: ['XAI_API_KEY'] } },
  ollama: { public: { endpoint: ['OLLAMA_HOST'] } },
  lm_studio: { public: { endpoint: ['LM_STUDIO_HOST'] } },
  // ── Agent runtimes ──
  openclaw: { secrets: { gateway_token: ['OPENCLAW_GATEWAY_TOKEN'] }, public: { gateway_url: ['OPENCLAW_GATEWAY_URL'] } },
  hermes: { secrets: { token: ['HERMES_TOKEN'] }, public: { dashboard_url: ['HERMES_DASHBOARD_URL'] } },
  browser_use: { secrets: { api_key: ['BROWSER_USE_API_KEY'] } },
  notebooklm_agent: { secrets: { token: ['NOTEBOOKLM_TOKEN'] } },
  // ── Creative / media ──
  higgsfield: { secrets: { api_key: ['HIGGSFIELD_API_KEY'] } },
  hyperframes: { secrets: { api_key: ['HYPERFRAMES_API_KEY'] } },
  hyperedit: { secrets: { api_key: ['HYPEREDIT_API_KEY'] } },
  minimax: { secrets: { api_key: ['MINIMAX_API_KEY'] } },
  runway: { secrets: { api_key: ['RUNWAY_API_KEY'] } },
  elevenlabs: { secrets: { api_key: ['ELEVENLABS_API_KEY', 'ELEVEN_API_KEY'] } },
  pika: { secrets: { api_key: ['PIKA_API_KEY'] } },
  heygen: { secrets: { api_key: ['HEYGEN_API_KEY'] } },
  // ── Productivity ──
  google_oauth: {
    secrets: { client_secret: ['GOOGLE_OAUTH_CLIENT_SECRET', 'GOOGLE_CLIENT_SECRET'] },
    public: { client_id: ['GOOGLE_OAUTH_CLIENT_ID', 'GOOGLE_CLIENT_ID'], redirect_uri: ['GOOGLE_OAUTH_REDIRECT_URI'] },
  },
  notebooklm: { secrets: { refresh_token: ['NOTEBOOKLM_REFRESH_TOKEN'] } },
  // ── Communication ──
  telegram_bot: { secrets: { bot_token: ['TELEGRAM_BOT_TOKEN'] }, public: { chat_id: ['TELEGRAM_CHAT_ID'] } },
  slack: { secrets: { bot_token: ['SLACK_BOT_TOKEN'], signing_secret: ['SLACK_SIGNING_SECRET'] }, public: { default_channel: ['SLACK_DEFAULT_CHANNEL'] } },
  discord: { secrets: { bot_token: ['DISCORD_BOT_TOKEN'] }, public: { guild_id: ['DISCORD_GUILD_ID'] } },
  twilio: {
    secrets: { auth_token: ['TWILIO_AUTH_TOKEN'] },
    public: { account_sid: ['TWILIO_ACCOUNT_SID'], from_number: ['TWILIO_FROM', 'TWILIO_FROM_NUMBER'] },
  },
  retell: { secrets: { api_key: ['RETELL_API_KEY'] } },
  vapi: { secrets: { api_key: ['VAPI_API_KEY'] } },
  resend: { secrets: { api_key: ['RESEND_API_KEY', 'MC_RESEND_API_KEY'] }, public: { from_address: ['RESEND_FROM', 'MC_EMAIL_FROM', 'SMTP_FROM'] } },
  smtp: { secrets: { password: ['SMTP_PASSWORD'] }, public: { host: ['SMTP_HOST'], port: ['SMTP_PORT'], username: ['SMTP_USERNAME'], from_address: ['SMTP_FROM'] } },
  // ── Data / search / memory ──
  notion: { secrets: { api_key: ['NOTION_API_KEY'] } },
  pinecone: { secrets: { api_key: ['PINECONE_API_KEY'] }, public: { index: ['PINECONE_INDEX'] } },
  supabase: { secrets: { service_role_key: ['SUPABASE_SERVICE_ROLE_KEY'] }, public: { url: ['SUPABASE_URL'] } },
  qdrant: { secrets: { api_key: ['QDRANT_API_KEY'] }, public: { url: ['QDRANT_URL'] } },
  firecrawl: { secrets: { api_key: ['FIRECRAWL_API_KEY'] } },
  serpapi: { secrets: { api_key: ['SERPAPI_API_KEY', 'SERP_API_KEY'] } },
  browserbase: { secrets: { api_key: ['BROWSERBASE_API_KEY'] }, public: { project_id: ['BROWSERBASE_PROJECT_ID'] } },
  apify: { secrets: { api_token: ['APIFY_API_TOKEN', 'APIFY_TOKEN'] } },
  // ── Billing ──
  stripe: {
    secrets: { secret_key: ['STRIPE_SECRET_KEY'], webhook_secret: ['STRIPE_WEBHOOK_SECRET'] },
    public: { publishable_key: ['STRIPE_PUBLISHABLE_KEY', 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY'] },
  },
  // ── DevOps ──
  github: { secrets: { token: ['GITHUB_TOKEN', 'GH_TOKEN'] }, public: { default_repo: ['GITHUB_DEFAULT_REPO'] } },
  vercel: { secrets: { token: ['VERCEL_TOKEN'] }, public: { team_id: ['VERCEL_TEAM_ID'] } },
  netlify: { secrets: { token: ['NETLIFY_TOKEN', 'NETLIFY_AUTH_TOKEN'] } },
  digitalocean: { secrets: { token: ['DIGITALOCEAN_TOKEN', 'DIGITALOCEAN_ACCESS_TOKEN'] } },
  docker_registry: { secrets: { password: ['DOCKER_REGISTRY_PASSWORD'] }, public: { username: ['DOCKER_REGISTRY_USERNAME'], registry_url: ['DOCKER_REGISTRY_URL'] } },
  // ── Vertical APIs ──
  rentcast: { secrets: { api_key: ['RENTCAST_API_KEY'] } },
  zillow_rapidapi: { secrets: { rapidapi_key: ['RAPIDAPI_KEY'] } },
  mls_bridge: { secrets: { api_key: ['BRIDGE_API_KEY'] }, public: { dataset_id: ['BRIDGE_DATASET_ID'] } },
  propcontrol: { secrets: { token: ['PROPCONTROL_TOKEN'] }, public: { base_url: ['PROPCONTROL_BASE_URL'] } },
  visionops: { secrets: { token: ['VISIONOPS_TOKEN', 'VISIONOPS_SERVICE_TOKEN'] }, public: { base_url: ['VISIONOPS_BASE_URL'] } },
  voiceops: { secrets: { token: ['VOICEOPS_TOKEN'] }, public: { base_url: ['VOICEOPS_BASE_URL'] } },
}

function firstEnv(names: string[] | undefined): string | undefined {
  for (const n of names ?? []) {
    const v = process.env[n]
    if (typeof v === 'string' && v.trim() !== '') return v.trim()
  }
  return undefined
}

function collect(providerId: string): { secrets: Record<string, string>; publicConfig: Record<string, string> } {
  const map = ENV_MAP[providerId] ?? {}
  const secrets: Record<string, string> = {}
  const publicConfig: Record<string, string> = {}
  for (const [field, names] of Object.entries(map.secrets ?? {})) {
    const v = firstEnv(names)
    if (v !== undefined) secrets[field] = v
  }
  for (const [field, names] of Object.entries(map.public ?? {})) {
    const v = firstEnv(names)
    if (v !== undefined) publicConfig[field] = v
  }
  return { secrets, publicConfig }
}

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('probe_timeout')), ms)),
  ])
}

export type EnvSyncReport = {
  imported: string[]
  verified: string[]
  failed: { id: string; error: string }[]
  skippedExisting: string[]
  skippedNoValue: string[]
}

/**
 * Import any env-provided credentials into the workspace store.
 * @param probe when true, runs the real test-connection probe for imported rows.
 */
export async function syncCredentialsFromEnv(
  workspaceId: number,
  opts: { probe?: boolean } = {},
): Promise<EnvSyncReport> {
  const report: EnvSyncReport = { imported: [], verified: [], failed: [], skippedExisting: [], skippedNoValue: [] }
  if (!isEncryptionConfigured()) {
    logger.warn('[env-sync] CREDENTIALS_ENCRYPTION_KEY not set — skipping env credential import')
    return report
  }

  for (const provider of PROVIDER_CATALOG) {
    const existing = getCredential(workspaceId, provider.id)
    if (existing) {
      // Keep human-entered/working rows. But if a row has a stored secret that
      // can NO LONGER be decrypted (encrypted under a previous
      // CREDENTIALS_ENCRYPTION_KEY), it's dead — re-import it from env.
      let decryptable = true
      if (existing.secret_preview) {
        try {
          decryptCredentialForRuntime(workspaceId, provider.id)
        } catch {
          decryptable = false
        }
      }
      if (decryptable) {
        report.skippedExisting.push(provider.id)
        continue
      }
    }
    const { secrets, publicConfig } = collect(provider.id)
    const hasValue = Object.keys(secrets).length > 0 || Object.keys(publicConfig).length > 0
    if (!hasValue) {
      report.skippedNoValue.push(provider.id)
      continue
    }
    // Required secret fields must be present, else upsert refuses.
    const missingRequired = provider.secret_fields.filter((f) => !f.optional && !secrets[f.key])
    if (missingRequired.length > 0) {
      report.failed.push({ id: provider.id, error: `missing required: ${missingRequired.map((f) => f.key).join(', ')}` })
      continue
    }
    try {
      upsertCredential({ workspaceId, providerId: provider.id, secrets, publicConfig, mode: provider.mode })
      report.imported.push(provider.id)
    } catch (err) {
      report.failed.push({ id: provider.id, error: (err as Error).message })
      continue
    }

    if (opts.probe && isProbeSupported(provider.id)) {
      try {
        const result = await withTimeout(PROBES[provider.id](secrets, publicConfig), 6000)
        if (result.ok) {
          markVerified(workspaceId, provider.id, true)
          report.verified.push(provider.id)
        } else {
          markVerified(workspaceId, provider.id, false, `${result.status ? `HTTP ${result.status}: ` : ''}${result.error}`.slice(0, 480))
        }
      } catch (err) {
        markVerified(workspaceId, provider.id, false, (err as Error).message.slice(0, 480))
      }
    }
  }
  logger.info(
    { imported: report.imported.length, verified: report.verified.length, failed: report.failed.length },
    '[env-sync] credential import complete',
  )
  return report
}

let syncedWorkspaces = new Set<number>()
/** Run the import once per process per workspace (used by read routes). */
export async function ensureEnvCredentialsSynced(workspaceId: number, probe = false): Promise<void> {
  if (syncedWorkspaces.has(workspaceId)) return
  syncedWorkspaces.add(workspaceId)
  try {
    await syncCredentialsFromEnv(workspaceId, { probe })
  } catch (err) {
    syncedWorkspaces.delete(workspaceId)
    logger.warn({ err }, '[env-sync] sync failed; will retry on next read')
  }
}
