/**
 * Credentials test-connection probes.
 *
 * Walt's rule: "No simulated success states." Each probe MUST call the
 * real provider URL with the real auth header. We use a stub fetcher to
 * inspect the outbound request without hitting the network.
 */
import { describe, it, expect } from 'vitest'

import { PROBES, isProbeSupported } from '@/lib/credentials/probes'

type CapturedCall = { url: string; init: RequestInit }

function makeFetcher(
  capture: CapturedCall[],
  resp: { ok?: boolean; status?: number; body?: unknown } = {},
): typeof fetch {
  const ok = resp.ok ?? true
  const status = resp.status ?? 200
  const body = resp.body ?? {}
  return (async (input: RequestInfo | URL, init: RequestInit = {}) => {
    capture.push({ url: typeof input === 'string' ? input : input.toString(), init })
    return {
      ok,
      status,
      async json() {
        return body
      },
      async text() {
        return JSON.stringify(body)
      },
    } as unknown as Response
  }) as unknown as typeof fetch
}

describe('credentials probes — wire shape', () => {
  it('every advertised provider has a probe registered', () => {
    for (const id of ['openai', 'anthropic', 'google_gemini', 'openrouter', 'stripe', 'resend', 'telegram_bot', 'github', 'supabase']) {
      expect(isProbeSupported(id)).toBe(true)
    }
  })

  it('OpenAI probe hits /v1/models with the bearer token', async () => {
    const calls: CapturedCall[] = []
    const fetcher = makeFetcher(calls)
    const res = await PROBES.openai({ api_key: 'sk-test-PROBE-12345' }, {}, fetcher)
    expect(res.ok).toBe(true)
    expect(calls).toHaveLength(1)
    expect(calls[0].url).toContain('api.openai.com/v1/models')
    expect((calls[0].init.headers as Record<string, string>).authorization).toBe('Bearer sk-test-PROBE-12345')
  })

  it('Anthropic probe sets x-api-key and anthropic-version', async () => {
    const calls: CapturedCall[] = []
    const res = await PROBES.anthropic({ api_key: 'sk-ant-test' }, {}, makeFetcher(calls))
    expect(res.ok).toBe(true)
    const h = calls[0].init.headers as Record<string, string>
    expect(h['x-api-key']).toBe('sk-ant-test')
    expect(h['anthropic-version']).toBe('2023-06-01')
  })

  it('Gemini probe passes the key as a query param', async () => {
    const calls: CapturedCall[] = []
    await PROBES.google_gemini({ api_key: 'AIza-test' }, {}, makeFetcher(calls))
    expect(calls[0].url).toContain('generativelanguage.googleapis.com')
    expect(calls[0].url).toContain('key=AIza-test')
  })

  it('OpenRouter probe works without an API key (public catalogue)', async () => {
    const calls: CapturedCall[] = []
    const res = await PROBES.openrouter({}, {}, makeFetcher(calls))
    expect(res.ok).toBe(true)
    expect(calls[0].url).toContain('openrouter.ai/api/v1/models')
    expect((calls[0].init.headers as Record<string, string>).authorization).toBeUndefined()
  })

  it('Stripe probe hits /v1/account with the secret key', async () => {
    const calls: CapturedCall[] = []
    await PROBES.stripe({ secret_key: 'sk_test_stripe' }, {}, makeFetcher(calls))
    expect(calls[0].url).toContain('api.stripe.com/v1/account')
    expect((calls[0].init.headers as Record<string, string>).authorization).toBe('Bearer sk_test_stripe')
  })

  it('Telegram probe hits getMe at the bot-token URL', async () => {
    const calls: CapturedCall[] = []
    await PROBES.telegram_bot({ bot_token: '123:ABC' }, {}, makeFetcher(calls))
    expect(calls[0].url).toContain('api.telegram.org/bot123:ABC/getMe')
  })

  it('GitHub probe hits /user with the token + github accept header', async () => {
    const calls: CapturedCall[] = []
    await PROBES.github({ token: 'ghp_test' }, {}, makeFetcher(calls))
    expect(calls[0].url).toBe('https://api.github.com/user')
    const h = calls[0].init.headers as Record<string, string>
    expect(h.authorization).toBe('Bearer ghp_test')
    expect(h.accept).toContain('vnd.github')
  })

  it('Supabase probe requires url + service_role_key; sets apikey + authorization', async () => {
    const missing = await PROBES.supabase({}, {})
    expect(missing.ok).toBe(false)

    const calls: CapturedCall[] = []
    await PROBES.supabase(
      { service_role_key: 'srk_test' },
      { url: 'https://abc.supabase.co' },
      makeFetcher(calls),
    )
    expect(calls[0].url).toBe('https://abc.supabase.co/auth/v1/health')
    const h = calls[0].init.headers as Record<string, string>
    expect(h.apikey).toBe('srk_test')
    expect(h.authorization).toBe('Bearer srk_test')
  })

  it('returns ok:false with HTTP info when the upstream rejects', async () => {
    const res = await PROBES.openai({ api_key: 'invalid' }, {}, makeFetcher([], { ok: false, status: 401 }))
    expect(res.ok).toBe(false)
    if (!res.ok) {
      expect(res.status).toBe(401)
      expect(res.error).toContain('HTTP 401')
    }
  })

  it('returns ok:false on network error without throwing', async () => {
    const failing: typeof fetch = (async () => {
      throw new Error('econnreset')
    }) as unknown as typeof fetch
    const res = await PROBES.openai({ api_key: 'sk-test' }, {}, failing)
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error).toBe('econnreset')
  })
})
