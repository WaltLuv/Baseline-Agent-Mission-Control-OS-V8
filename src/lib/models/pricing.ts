/**
 * Model pricing → credits estimation.
 *
 * Hooks the catalogue's USD-per-million prices into the existing
 * billing math (CREDIT_USD_VALUE × DEFAULT_MARKUP_MULTIPLIER from
 * `@/lib/credits-config`). One source of truth — no second markup rule.
 */

import { priceUsageInCredits } from '@/lib/credits-config'
import type { ModelRow } from './types'

export type EstimateInput = {
  model: ModelRow
  input_tokens: number
  output_tokens: number
  /** Override the markup just for this call (defaults to platform 2.5×). */
  markup_multiplier?: number
}

export type EstimateResult = {
  raw_input_usd: number
  raw_output_usd: number
  raw_total_usd: number
  customer_price_usd: number
  charged_credits: number
  markup_multiplier: number
  /**
   * When the catalogue row has no price metadata we return zero credits —
   * caller must surface "unknown cost" rather than guess.
   */
  has_price_data: boolean
}

export function estimateCredits(input: EstimateInput): EstimateResult {
  const { model, input_tokens, output_tokens, markup_multiplier } = input
  const inputRate = model.input_price_usd_per_million
  const outputRate = model.output_price_usd_per_million

  const has_price_data = typeof inputRate === 'number' && typeof outputRate === 'number'
  if (!has_price_data) {
    return {
      raw_input_usd: 0,
      raw_output_usd: 0,
      raw_total_usd: 0,
      customer_price_usd: 0,
      charged_credits: 0,
      markup_multiplier: markup_multiplier ?? 0,
      has_price_data: false,
    }
  }

  const raw_input_usd = (input_tokens / 1_000_000) * (inputRate ?? 0)
  const raw_output_usd = (output_tokens / 1_000_000) * (outputRate ?? 0)
  const raw_total_usd = raw_input_usd + raw_output_usd

  // priceUsageInCredits handles markup + ceil + zero/negative guards.
  const credits = priceUsageInCredits(raw_total_usd, markup_multiplier)

  return {
    raw_input_usd,
    raw_output_usd,
    raw_total_usd,
    customer_price_usd: credits.customer_price_usd,
    charged_credits: credits.charged_credits,
    markup_multiplier: credits.markup_multiplier,
    has_price_data: true,
  }
}
