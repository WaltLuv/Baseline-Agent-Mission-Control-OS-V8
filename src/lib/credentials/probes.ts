/**
 * Real test-connection probes per provider.
 *
 * Rule (Walt): "No simulated success states." Each probe makes a real,
 * low-cost API call against the provider with the supplied secret and
 * returns a typed result. The route layer marks the credential
 * `connected` or `error` based on the outcome.
 *
 * Test surface: every probe accepts an optional `fetcher` so unit tests
 * can stub the network without monkey-patching globals.
 */

export type ProbeResult = { ok: true } | { ok: false; status?: number; error: string }
type Fetcher = typeof fetch

type Secrets = Record<string, string>
type PublicCfg = Record<string, string>

type Probe = (secrets: Secrets, publicCfg: PublicCfg, fetcher?: Fetcher) => Promise<ProbeResult>

const ua = 'mission-control-credential-probe/1.0'

async function get(
  url: string,
  init: RequestInit,
  fetcher: Fetcher,
): Promise<ProbeResult> {
  try {
    const res = await fetcher(url, { ...init, method: init.method ?? 'GET' })
    if (res.ok) return { ok: true }
    const body = await res.text().catch(() => '')
    return { ok: false, status: res.status, error: `HTTP ${res.status} ${body.slice(0, 240)}` }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'network error' }
  }
}

const probeOpenAI: Probe = (secrets, _pub, fetcher = fetch) => {
  const key = (secrets.api_key ?? '').trim()
  if (!key) return Promise.resolve({ ok: false, error: 'missing api_key' })
  return get('https://api.openai.com/v1/models?limit=1', {
    headers: { authorization: `Bearer ${key}`, accept: 'application/json', 'user-agent': ua },
  }, fetcher)
}

const probeAnthropic: Probe = (secrets, _pub, fetcher = fetch) => {
  const key = (secrets.api_key ?? '').trim()
  if (!key) return Promise.resolve({ ok: false, error: 'missing api_key' })
  return get('https://api.anthropic.com/v1/models', {
    headers: {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      accept: 'application/json',
      'user-agent': ua,
    },
  }, fetcher)
}

const probeGemini: Probe = (secrets, _pub, fetcher = fetch) => {
  const key = (secrets.api_key ?? '').trim()
  if (!key) return Promise.resolve({ ok: false, error: 'missing api_key' })
  return get(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`,
    { headers: { accept: 'application/json', 'user-agent': ua } },
    fetcher,
  )
}

const probeOpenRouter: Probe = (secrets, _pub, fetcher = fetch) => {
  const key = (secrets.api_key ?? '').trim()
  return get('https://openrouter.ai/api/v1/models', {
    headers: {
      accept: 'application/json',
      'user-agent': ua,
      ...(key ? { authorization: `Bearer ${key}` } : {}),
    },
  }, fetcher)
}

const probeStripe: Probe = (secrets, _pub, fetcher = fetch) => {
  const key = (secrets.secret_key ?? '').trim()
  if (!key) return Promise.resolve({ ok: false, error: 'missing secret_key' })
  return get('https://api.stripe.com/v1/account', {
    headers: { authorization: `Bearer ${key}`, accept: 'application/json', 'user-agent': ua },
  }, fetcher)
}

const probeResend: Probe = (secrets, _pub, fetcher = fetch) => {
  const key = (secrets.api_key ?? '').trim()
  if (!key) return Promise.resolve({ ok: false, error: 'missing api_key' })
  return get('https://api.resend.com/domains', {
    headers: { authorization: `Bearer ${key}`, accept: 'application/json', 'user-agent': ua },
  }, fetcher)
}

const probeTelegram: Probe = (secrets, _pub, fetcher = fetch) => {
  const token = (secrets.bot_token ?? '').trim()
  if (!token) return Promise.resolve({ ok: false, error: 'missing bot_token' })
  return get(`https://api.telegram.org/bot${token}/getMe`, {
    headers: { accept: 'application/json', 'user-agent': ua },
  }, fetcher)
}

const probeGitHub: Probe = (secrets, _pub, fetcher = fetch) => {
  const token = (secrets.token ?? '').trim()
  if (!token) return Promise.resolve({ ok: false, error: 'missing token' })
  return get('https://api.github.com/user', {
    headers: {
      authorization: `Bearer ${token}`,
      accept: 'application/vnd.github+json',
      'user-agent': ua,
    },
  }, fetcher)
}

const probeSupabase: Probe = (secrets, publicCfg, fetcher = fetch) => {
  const url = (publicCfg.url ?? '').trim().replace(/\/+$/, '')
  const key = (secrets.service_role_key ?? '').trim()
  if (!url || !key) return Promise.resolve({ ok: false, error: 'missing url or service_role_key' })
  return get(`${url}/auth/v1/health`, {
    headers: {
      apikey: key,
      authorization: `Bearer ${key}`,
      accept: 'application/json',
      'user-agent': ua,
    },
  }, fetcher)
}

// ── LLM providers (additional) ──────────────────────────────────────

const probeMistral: Probe = (secrets, _pub, fetcher = fetch) => {
  const key = (secrets.api_key ?? '').trim()
  if (!key) return Promise.resolve({ ok: false, error: 'missing api_key' })
  return get('https://api.mistral.ai/v1/models', {
    headers: { authorization: `Bearer ${key}`, accept: 'application/json', 'user-agent': ua },
  }, fetcher)
}

// ── Communication ──────────────────────────────────────────────────

const probeDiscord: Probe = (secrets, _pub, fetcher = fetch) => {
  // Discord bot tokens authenticate as `Bot <token>`, not `Bearer`.
  const token = (secrets.bot_token ?? '').trim()
  if (!token) return Promise.resolve({ ok: false, error: 'missing bot_token' })
  return get('https://discord.com/api/v10/users/@me', {
    headers: { authorization: `Bot ${token}`, accept: 'application/json', 'user-agent': ua },
  }, fetcher)
}

const probeSlack: Probe = (secrets, _pub, fetcher = fetch) => {
  const token = (secrets.bot_token ?? '').trim()
  if (!token) return Promise.resolve({ ok: false, error: 'missing bot_token' })
  // Slack returns 200 with { ok: false, error } on bad auth; we need to
  // peek at the body to distinguish from a real success.
  return (async () => {
    try {
      const res = await fetcher('https://slack.com/api/auth.test', {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, accept: 'application/json', 'user-agent': ua },
      })
      const body = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null
      if (body?.ok === true) return { ok: true } as const
      return { ok: false, status: res.status, error: `slack: ${body?.error ?? 'unknown'}` } as const
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'network error' } as const
    }
  })()
}

const probeTwilio: Probe = (secrets, publicCfg, fetcher = fetch) => {
  const sid = (publicCfg.account_sid ?? '').trim()
  const token = (secrets.auth_token ?? '').trim()
  if (!sid || !token) return Promise.resolve({ ok: false, error: 'missing account_sid or auth_token' })
  // Twilio uses HTTP Basic with sid:token.
  const auth = 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64')
  return get(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}.json`, {
    headers: { authorization: auth, accept: 'application/json', 'user-agent': ua },
  }, fetcher)
}

// ── Creative / media ───────────────────────────────────────────────

const probeElevenLabs: Probe = (secrets, _pub, fetcher = fetch) => {
  const key = (secrets.api_key ?? '').trim()
  if (!key) return Promise.resolve({ ok: false, error: 'missing api_key' })
  return get('https://api.elevenlabs.io/v1/user', {
    headers: { 'xi-api-key': key, accept: 'application/json', 'user-agent': ua },
  }, fetcher)
}

const probeMiniMax: Probe = (secrets, _pub, fetcher = fetch) => {
  const key = (secrets.api_key ?? '').trim()
  if (!key) return Promise.resolve({ ok: false, error: 'missing api_key' })
  // MiniMax exposes a sync handshake at /v1/text/chatcompletion_v2 is too
  // expensive; their docs recommend the lighter /v1/files for verification.
  return get('https://api.minimax.chat/v1/files', {
    headers: { authorization: `Bearer ${key}`, accept: 'application/json', 'user-agent': ua },
  }, fetcher)
}

// ── Data / Search / Memory ─────────────────────────────────────────

const probeNotion: Probe = (secrets, _pub, fetcher = fetch) => {
  const key = (secrets.api_key ?? '').trim()
  if (!key) return Promise.resolve({ ok: false, error: 'missing api_key' })
  return get('https://api.notion.com/v1/users/me', {
    headers: {
      authorization: `Bearer ${key}`,
      'notion-version': '2022-06-28',
      accept: 'application/json',
      'user-agent': ua,
    },
  }, fetcher)
}

const probePinecone: Probe = (secrets, _pub, fetcher = fetch) => {
  const key = (secrets.api_key ?? '').trim()
  if (!key) return Promise.resolve({ ok: false, error: 'missing api_key' })
  // Pinecone's serverless control plane lives at api.pinecone.io and
  // accepts a flat Api-Key header.
  return get('https://api.pinecone.io/indexes', {
    headers: { 'api-key': key, accept: 'application/json', 'user-agent': ua },
  }, fetcher)
}

// ── DevOps ─────────────────────────────────────────────────────────

const probeVercel: Probe = (secrets, _pub, fetcher = fetch) => {
  const token = (secrets.token ?? '').trim()
  if (!token) return Promise.resolve({ ok: false, error: 'missing token' })
  return get('https://api.vercel.com/v2/user', {
    headers: { authorization: `Bearer ${token}`, accept: 'application/json', 'user-agent': ua },
  }, fetcher)
}

const probeNetlify: Probe = (secrets, _pub, fetcher = fetch) => {
  const token = (secrets.token ?? '').trim()
  if (!token) return Promise.resolve({ ok: false, error: 'missing token' })
  return get('https://api.netlify.com/api/v1/user', {
    headers: { authorization: `Bearer ${token}`, accept: 'application/json', 'user-agent': ua },
  }, fetcher)
}

const probeDigitalOcean: Probe = (secrets, _pub, fetcher = fetch) => {
  const token = (secrets.token ?? '').trim()
  if (!token) return Promise.resolve({ ok: false, error: 'missing token' })
  return get('https://api.digitalocean.com/v2/account', {
    headers: { authorization: `Bearer ${token}`, accept: 'application/json', 'user-agent': ua },
  }, fetcher)
}

export const PROBES: Record<string, Probe> = {
  // LLM providers
  openai: probeOpenAI,
  anthropic: probeAnthropic,
  google_gemini: probeGemini,
  openrouter: probeOpenRouter,
  mistral: probeMistral,
  // Comms
  resend: probeResend,
  telegram_bot: probeTelegram,
  discord: probeDiscord,
  slack: probeSlack,
  twilio: probeTwilio,
  // Creative / media
  elevenlabs: probeElevenLabs,
  minimax: probeMiniMax,
  // Data / search / memory
  notion: probeNotion,
  pinecone: probePinecone,
  // Billing
  stripe: probeStripe,
  // DevOps
  github: probeGitHub,
  vercel: probeVercel,
  netlify: probeNetlify,
  digitalocean: probeDigitalOcean,
  // Backend
  supabase: probeSupabase,
}

export function isProbeSupported(providerId: string): boolean {
  return providerId in PROBES
}
