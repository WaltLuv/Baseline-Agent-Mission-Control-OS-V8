/**
 * credits-config — money math + env-driven knobs.
 */
import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import {
  getCreditUsdValue,
  getDefaultMarkupMultiplier,
  applyMarkup,
  usdToCredits,
  itemPriceToCredits,
  priceUsageInCredits,
} from '@/lib/credits-config'

const originalEnv: Record<string, string | undefined> = {
  CREDIT_USD_VALUE: process.env.CREDIT_USD_VALUE,
  DEFAULT_MARKUP_MULTIPLIER: process.env.DEFAULT_MARKUP_MULTIPLIER,
}

beforeEach(() => {
  delete process.env.CREDIT_USD_VALUE
  delete process.env.DEFAULT_MARKUP_MULTIPLIER
})

afterAll(() => {
  for (const [k, v] of Object.entries(originalEnv)) {
    if (v === undefined) delete process.env[k]
    else process.env[k] = v
  }
})

describe('credits-config', () => {
  it('defaults are 0.10 USD/credit and 2.5x markup', () => {
    expect(getCreditUsdValue()).toBe(0.10)
    expect(getDefaultMarkupMultiplier()).toBe(2.5)
  })

  it('honours CREDIT_USD_VALUE override', () => {
    process.env.CREDIT_USD_VALUE = '0.25'
    expect(getCreditUsdValue()).toBe(0.25)
  })

  it('honours DEFAULT_MARKUP_MULTIPLIER override', () => {
    process.env.DEFAULT_MARKUP_MULTIPLIER = '4'
    expect(getDefaultMarkupMultiplier()).toBe(4)
  })

  it('falls back to default when env vars are garbage', () => {
    process.env.CREDIT_USD_VALUE = 'banana'
    process.env.DEFAULT_MARKUP_MULTIPLIER = '-1'
    expect(getCreditUsdValue()).toBe(0.10)
    expect(getDefaultMarkupMultiplier()).toBe(2.5)
  })

  it('applyMarkup multiplies and rounds to cents', () => {
    expect(applyMarkup(1.00)).toBe(2.50)
    expect(applyMarkup(0.13)).toBe(0.33) // 0.13 * 2.5 = 0.325 → 0.33
    expect(applyMarkup(0, 5)).toBe(0)
    expect(applyMarkup(2, 1.7)).toBe(3.40)
  })

  it('usdToCredits ceils so cents don\'t round to zero', () => {
    // 1 credit = $0.10, so $1.00 → 10 credits, $1.05 → 11 credits (ceil)
    expect(usdToCredits(1.00)).toBe(10)
    expect(usdToCredits(1.05)).toBe(11)
    expect(usdToCredits(0.01)).toBe(1)
    expect(usdToCredits(0)).toBe(0)
  })

  it('itemPriceToCredits respects pricing_type', () => {
    expect(itemPriceToCredits({ list_price_usd: 50, pricing_type: 'free' })).toBe(0)
    expect(itemPriceToCredits({ list_price_usd: 50, pricing_type: 'included' })).toBe(0)
    expect(itemPriceToCredits({ list_price_usd: 50, pricing_type: 'credits' })).toBe(500)
    expect(itemPriceToCredits({ price_credits: 250 })).toBe(250)
    expect(itemPriceToCredits({})).toBe(0)
  })

  it('priceUsageInCredits returns the audit trail', () => {
    const r = priceUsageInCredits(1.00) // $1 raw cost
    expect(r.raw_cost_usd).toBe(1.00)
    expect(r.markup_multiplier).toBe(2.5)
    expect(r.customer_price_usd).toBe(2.50)
    expect(r.charged_credits).toBe(25)
  })

  it('priceUsageInCredits accepts a custom multiplier', () => {
    const r = priceUsageInCredits(2.00, 1.5)
    expect(r.customer_price_usd).toBe(3.00)
    expect(r.charged_credits).toBe(30)
  })
})
