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

export const PROBES: Record<string, Probe> = {
  openai: probeOpenAI,
  anthropic: probeAnthropic,
  google_gemini: probeGemini,
  openrouter: probeOpenRouter,
  stripe: probeStripe,
  resend: probeResend,
  telegram_bot: probeTelegram,
  github: probeGitHub,
  supabase: probeSupabase,
}

export function isProbeSupported(providerId: string): boolean {
  return providerId in PROBES
}
