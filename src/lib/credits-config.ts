/**
 * Credits configuration — the money math for the unified token-pack model.
 *
 * Two env-driven knobs:
 *   CREDIT_USD_VALUE              · default 0.10  (1 credit = $0.10)
 *   DEFAULT_MARKUP_MULTIPLIER     · default 2.5   (Walt's standing rule)
 *
 * Stripe sells token packs. Everything else inside Mission Control —
 * employees, skills, workflows, marketplace items, AI/API usage —
 * debits credits from the workspace ledger. Cost-incurring actions are
 * marked up via `applyMarkup` before being converted to credits.
 *
 * Source of truth: this file. Do NOT hardcode 0.10 or 2.5 anywhere else.
 */

const DEFAULT_CREDIT_USD_VALUE = 0.10
const DEFAULT_MARKUP_MULTIPLIER = 2.5

export function getCreditUsdValue(): number {
  const raw = process.env.CREDIT_USD_VALUE
  if (!raw) return DEFAULT_CREDIT_USD_VALUE
  const n = Number(raw)
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_CREDIT_USD_VALUE
  return n
}

export function getDefaultMarkupMultiplier(): number {
  const raw = process.env.DEFAULT_MARKUP_MULTIPLIER
  if (!raw) return DEFAULT_MARKUP_MULTIPLIER
  const n = Number(raw)
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_MARKUP_MULTIPLIER
  return n
}

/** Apply markup to a raw provider cost in USD; rounds half-up at the cent. */
export function applyMarkup(rawCostUsd: number, multiplier = getDefaultMarkupMultiplier()): number {
  if (!Number.isFinite(rawCostUsd) || rawCostUsd <= 0) return 0
  return Math.round(rawCostUsd * multiplier * 100) / 100
}

/**
 * Convert a customer-facing USD price to credits.
 * Ceil so 1¢ never sneaks through as 0 credits.
 */
export function usdToCredits(customerPriceUsd: number): number {
  if (!Number.isFinite(customerPriceUsd) || customerPriceUsd <= 0) return 0
  return Math.ceil(customerPriceUsd / getCreditUsdValue())
}

/**
 * One-shot helper for usage events: raw provider cost → markup → credits.
 * Returns the credit charge plus the intermediate values so the caller
 * can stamp them on the ledger row for audit.
 */
export function priceUsageInCredits(rawCostUsd: number, multiplier?: number): {
  raw_cost_usd: number
  markup_multiplier: number
  customer_price_usd: number
  charged_credits: number
} {
  const m = multiplier ?? getDefaultMarkupMultiplier()
  const customerPrice = applyMarkup(rawCostUsd, m)
  return {
    raw_cost_usd: rawCostUsd,
    markup_multiplier: m,
    customer_price_usd: customerPrice,
    charged_credits: usdToCredits(customerPrice),
  }
}

/**
 * Catalogue pricing → credits. Marketplace items declare a USD list
 * price (legacy `priceUsd` / `monthlyUsd` columns) plus an optional
 * `price_credits` override. When the override is present we honour it
 * verbatim; otherwise we convert USD → credits using the live config.
 */
export function itemPriceToCredits(opts: {
  price_credits?: number | null
  list_price_usd?: number | null
  pricing_type?: 'free' | 'credits' | 'included' | null
}): number {
  if (opts.pricing_type === 'free' || opts.pricing_type === 'included') return 0
  if (typeof opts.price_credits === 'number' && opts.price_credits > 0) {
    return Math.ceil(opts.price_credits)
  }
  if (typeof opts.list_price_usd === 'number' && opts.list_price_usd > 0) {
    return usdToCredits(opts.list_price_usd)
  }
  return 0
}
