/**
 * Model catalogue tests — sync, resolution, pricing.
 *
 * Walt's rules pinned here:
 *   · OpenRouter sync parses real model shapes + fills price/context.
 *   · Models that disappear from the upstream response get marked
 *     `deprecated` (so they stop appearing as selectable).
 *   · Featured + alias resolution against the synced catalogue is
 *     honest — unavailable entries are surfaced, not hidden.
 *   · Pricing → credits goes through `priceUsageInCredits` (one markup
 *     rule, 2.5× default), with `has_price_data=false` when the row has
 *     no upstream pricing — no fabrication.
 */
import { describe, it, expect, beforeAll } from 'vitest'

import { getDatabase } from '@/lib/db'
import { runMigrations } from '@/lib/migrations'
import { listModels, deleteModel } from '@/lib/models/store'
import { syncOpenRouterModels, OpenRouterSyncError } from '@/lib/models/openrouter'
import { resolveAliases, resolveFeatured } from '@/lib/models/resolve'
import { estimateCredits } from '@/lib/models/pricing'

beforeAll(() => {
  runMigrations(getDatabase())
})

/**
 * Build a stub fetcher that returns a canned OpenRouter response.
 */
function stubFetcher(envelope: unknown, opts: { ok?: boolean; status?: number } = {}): typeof fetch {
  const ok = opts.ok ?? true
  const status = opts.status ?? 200
  return (async () =>
    ({
      ok,
      status,
      async json() {
        return envelope
      },
      async text() {
        return JSON.stringify(envelope)
      },
    } as unknown as Response)) as unknown as typeof fetch
}

describe('OpenRouter sync', () => {
  it('parses real model shape: provider, slug, price, context, tools', async () => {
    const fetcher = stubFetcher({
      data: [
        {
          id: 'openai/gpt-test-9000',
          name: 'GPT Test 9000',
          context_length: 128_000,
          architecture: { input_modalities: ['text', 'image'], output_modalities: ['text'] },
          pricing: { prompt: '0.000005', completion: '0.000015' },
          top_provider: { context_length: 128_000, max_completion_tokens: 16_384 },
          supported_parameters: ['tools', 'response_format', 'tool_choice'],
        },
      ],
    })
    const result = await syncOpenRouterModels({ fetcher })
    expect(result.fetched).toBe(1)
    expect(result.upserted).toBe(1)

    const rows = listModels({ source: 'openrouter' })
    const row = rows.find((r) => r.model_slug === 'openai/gpt-test-9000')!
    expect(row).toBeDefined()
    expect(row.provider).toBe('openai')
    expect(row.context_window).toBe(128_000)
    // 0.000005 USD/token → 5 USD per million.
    expect(row.input_price_usd_per_million).toBeCloseTo(5, 5)
    expect(row.output_price_usd_per_million).toBeCloseTo(15, 5)
    expect(row.supports_tools).toBe(true)
    expect(row.supports_json).toBe(true)
    expect(row.supports_images).toBe(true)
    expect(row.status).toBe('available')

    // Cleanup so subsequent tests start fresh.
    deleteModel('openrouter', 'openai/gpt-test-9000')
  })

  it('marks vanished upstream slugs as deprecated', async () => {
    // First sync ships two slugs.
    await syncOpenRouterModels({
      fetcher: stubFetcher({
        data: [
          { id: 'a/model-stays', pricing: { prompt: '0', completion: '0' } },
          { id: 'b/model-disappears', pricing: { prompt: '0', completion: '0' } },
        ],
      }),
    })
    // Second sync drops the second slug — it must flip to deprecated.
    await syncOpenRouterModels({
      fetcher: stubFetcher({
        data: [{ id: 'a/model-stays', pricing: { prompt: '0', completion: '0' } }],
      }),
    })
    const all = listModels({ source: 'openrouter' })
    const stays = all.find((r) => r.model_slug === 'a/model-stays')!
    const gone = all.find((r) => r.model_slug === 'b/model-disappears')!
    expect(stays.status).toBe('available')
    expect(gone.status).toBe('deprecated')

    deleteModel('openrouter', 'a/model-stays')
    deleteModel('openrouter', 'b/model-disappears')
  })

  it('throws OpenRouterSyncError on non-2xx upstream', async () => {
    await expect(
      syncOpenRouterModels({ fetcher: stubFetcher({ error: 'boom' }, { ok: false, status: 502 }) }),
    ).rejects.toBeInstanceOf(OpenRouterSyncError)
  })
})

describe('featured + alias resolution', () => {
  it('marks a featured entry unavailable when its slug is not in the catalogue', () => {
    const catalog = listModels()
    const featured = resolveFeatured(catalog)
    const claudeBestCoding = featured.find(
      (f) => f.tier === 'best_coding' && f.model_slug === 'anthropic/claude-opus-4-8',
    )
    expect(claudeBestCoding).toBeDefined()
    // If the current flagship has not been synced yet, it must be 'unavailable',
    // not silently hidden.
    if (!claudeBestCoding!.resolved) {
      expect(claudeBestCoding!.status).toBe('unavailable')
    }
  })

  it('resolves an alias to the first available candidate slug', async () => {
    // Plant the current OpenAI flagship so latest-openai can resolve to it.
    await syncOpenRouterModels({
      fetcher: stubFetcher({
        data: [{ id: 'openai/gpt-5.5', pricing: { prompt: '0.000002', completion: '0.000008' } }],
      }),
    })
    const aliases = resolveAliases(listModels())
    const latestOpenai = aliases.find((a) => a.alias === 'latest-openai')!
    expect(latestOpenai.status).toBe('available')
    expect(latestOpenai.resolved?.model_slug).toBe('openai/gpt-5.5')
    deleteModel('openrouter', 'openai/gpt-5.5')
  })
})

describe('pricing → credits with 2.5× markup', () => {
  it('estimates credits for a synced model using the platform multiplier', async () => {
    // 5 USD / million input, 15 USD / million output.
    await syncOpenRouterModels({
      fetcher: stubFetcher({
        data: [
          {
            id: 'openai/gpt-price-test',
            pricing: { prompt: '0.000005', completion: '0.000015' },
          },
        ],
      }),
    })
    const row = listModels({ source: 'openrouter' }).find((r) => r.model_slug === 'openai/gpt-price-test')!
    const est = estimateCredits({ model: row, input_tokens: 1_000_000, output_tokens: 200_000 })
    // raw = 5 + 0.2 * 15 = 5 + 3 = $8.00. customer = 8 * 2.5 = $20.00 → 200 credits.
    expect(est.raw_total_usd).toBeCloseTo(8, 5)
    expect(est.customer_price_usd).toBeCloseTo(20, 5)
    expect(est.charged_credits).toBe(200)
    expect(est.markup_multiplier).toBe(2.5)
    expect(est.has_price_data).toBe(true)
    deleteModel('openrouter', 'openai/gpt-price-test')
  })

  it('returns has_price_data=false when the row has no pricing — never fabricates a number', async () => {
    await syncOpenRouterModels({
      fetcher: stubFetcher({
        data: [{ id: 'openai/gpt-no-price-test' }],
      }),
    })
    const row = listModels({ source: 'openrouter' }).find((r) => r.model_slug === 'openai/gpt-no-price-test')!
    const est = estimateCredits({ model: row, input_tokens: 1_000_000, output_tokens: 200_000 })
    expect(est.has_price_data).toBe(false)
    expect(est.charged_credits).toBe(0)
    deleteModel('openrouter', 'openai/gpt-no-price-test')
  })
})
