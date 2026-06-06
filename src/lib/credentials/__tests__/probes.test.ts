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
    for (const id of [
      // Original 9
      'openai', 'anthropic', 'google_gemini', 'openrouter', 'stripe', 'resend',
      'telegram_bot', 'github', 'supabase',
      // 11 new in this slice
      'mistral', 'discord', 'slack', 'twilio', 'elevenlabs', 'minimax',
      'notion', 'pinecone', 'vercel', 'netlify', 'digitalocean',
    ]) {
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

  // ── New probes (11) — each verified for: URL + auth header shape. ──

  it('Mistral probe hits /v1/models with Bearer auth', async () => {
    const calls: CapturedCall[] = []
    await PROBES.mistral({ api_key: 'mst_test' }, {}, makeFetcher(calls))
    expect(calls[0].url).toContain('api.mistral.ai/v1/models')
    expect((calls[0].init.headers as Record<string, string>).authorization).toBe('Bearer mst_test')
  })

  it('Discord probe uses Bot <token> auth (NOT Bearer)', async () => {
    const calls: CapturedCall[] = []
    await PROBES.discord({ bot_token: 'discord_test' }, {}, makeFetcher(calls))
    expect(calls[0].url).toContain('discord.com/api/v10/users/@me')
    expect((calls[0].init.headers as Record<string, string>).authorization).toBe('Bot discord_test')
  })

  it('Slack probe hits /api/auth.test and parses the ok field from the body', async () => {
    const calls: CapturedCall[] = []
    // Slack returns HTTP 200 even on bad auth; the `ok` field is the real signal.
    const ok = await PROBES.slack({ bot_token: 'xoxb-good' }, {}, makeFetcher(calls, { body: { ok: true } }))
    expect(ok.ok).toBe(true)
    expect(calls[0].url).toContain('slack.com/api/auth.test')
    expect((calls[0].init.headers as Record<string, string>).authorization).toBe('Bearer xoxb-good')

    const bad = await PROBES.slack(
      { bot_token: 'xoxb-bad' },
      {},
      makeFetcher([], { body: { ok: false, error: 'invalid_auth' } }),
    )
    expect(bad.ok).toBe(false)
    if (!bad.ok) expect(bad.error).toContain('slack: invalid_auth')
  })

  it('Twilio probe uses Basic auth (sid:token) on the Accounts endpoint', async () => {
    const calls: CapturedCall[] = []
    await PROBES.twilio(
      { auth_token: 'tw_token' },
      { account_sid: 'AC123' },
      makeFetcher(calls),
    )
    expect(calls[0].url).toContain('api.twilio.com/2010-04-01/Accounts/AC123.json')
    const auth = (calls[0].init.headers as Record<string, string>).authorization
    expect(auth.startsWith('Basic ')).toBe(true)
    const decoded = Buffer.from(auth.slice('Basic '.length), 'base64').toString()
    expect(decoded).toBe('AC123:tw_token')
  })

  it('ElevenLabs probe uses xi-api-key header (NOT Bearer)', async () => {
    const calls: CapturedCall[] = []
    await PROBES.elevenlabs({ api_key: 'el_test' }, {}, makeFetcher(calls))
    expect(calls[0].url).toContain('api.elevenlabs.io/v1/user')
    expect((calls[0].init.headers as Record<string, string>)['xi-api-key']).toBe('el_test')
  })

  it('MiniMax probe hits /v1/files with Bearer auth', async () => {
    const calls: CapturedCall[] = []
    await PROBES.minimax({ api_key: 'mm_test' }, {}, makeFetcher(calls))
    expect(calls[0].url).toContain('api.minimax.chat/v1/files')
    expect((calls[0].init.headers as Record<string, string>).authorization).toBe('Bearer mm_test')
  })

  it('Notion probe sets notion-version header', async () => {
    const calls: CapturedCall[] = []
    await PROBES.notion({ api_key: 'secret_test' }, {}, makeFetcher(calls))
    expect(calls[0].url).toContain('api.notion.com/v1/users/me')
    const h = calls[0].init.headers as Record<string, string>
    expect(h.authorization).toBe('Bearer secret_test')
    expect(h['notion-version']).toBe('2022-06-28')
  })

  it('Pinecone probe uses flat api-key header on the control plane', async () => {
    const calls: CapturedCall[] = []
    await PROBES.pinecone({ api_key: 'pc_test' }, {}, makeFetcher(calls))
    expect(calls[0].url).toContain('api.pinecone.io/indexes')
    const h = calls[0].init.headers as Record<string, string>
    expect(h['api-key']).toBe('pc_test')
    expect(h.authorization).toBeUndefined()
  })

  it('Vercel probe hits /v2/user with Bearer auth', async () => {
    const calls: CapturedCall[] = []
    await PROBES.vercel({ token: 'vc_test' }, {}, makeFetcher(calls))
    expect(calls[0].url).toContain('api.vercel.com/v2/user')
    expect((calls[0].init.headers as Record<string, string>).authorization).toBe('Bearer vc_test')
  })

  it('Netlify probe hits /api/v1/user with Bearer auth', async () => {
    const calls: CapturedCall[] = []
    await PROBES.netlify({ token: 'nf_test' }, {}, makeFetcher(calls))
    expect(calls[0].url).toContain('api.netlify.com/api/v1/user')
    expect((calls[0].init.headers as Record<string, string>).authorization).toBe('Bearer nf_test')
  })

  it('DigitalOcean probe hits /v2/account with Bearer auth', async () => {
    const calls: CapturedCall[] = []
    await PROBES.digitalocean({ token: 'do_test' }, {}, makeFetcher(calls))
    expect(calls[0].url).toContain('api.digitalocean.com/v2/account')
    expect((calls[0].init.headers as Record<string, string>).authorization).toBe('Bearer do_test')
  })

  it('all 11 new probes refuse with ok:false when their required secret is missing', async () => {
    expect((await PROBES.mistral({}, {})).ok).toBe(false)
    expect((await PROBES.discord({}, {})).ok).toBe(false)
    expect((await PROBES.slack({}, {})).ok).toBe(false)
    expect((await PROBES.twilio({ auth_token: 'x' }, {})).ok).toBe(false) // missing sid
    expect((await PROBES.twilio({}, { account_sid: 'AC' })).ok).toBe(false) // missing token
    expect((await PROBES.elevenlabs({}, {})).ok).toBe(false)
    expect((await PROBES.minimax({}, {})).ok).toBe(false)
    expect((await PROBES.notion({}, {})).ok).toBe(false)
    expect((await PROBES.pinecone({}, {})).ok).toBe(false)
    expect((await PROBES.vercel({}, {})).ok).toBe(false)
    expect((await PROBES.netlify({}, {})).ok).toBe(false)
    expect((await PROBES.digitalocean({}, {})).ok).toBe(false)
  })
})
