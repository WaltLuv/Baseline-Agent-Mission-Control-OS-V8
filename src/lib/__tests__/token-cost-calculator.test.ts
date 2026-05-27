import { describe, it, expect } from 'vitest'
import { calculateTokenCosts } from '../token-cost-calculator'

describe('token-cost-calculator', () => {
  it('applies the default 2.5x markup', () => {
    const r = calculateTokenCosts({
      model: 'anthropic/claude-sonnet-4',
      provider: 'openrouter',
      inputTokens: 10_000,
      outputTokens: 5_000,
    })
    // wholesale: 10*0.003 + 5*0.015 = 0.03 + 0.075 = 0.105 USD
    expect(r.wholesaleCostUsd).toBeCloseTo(0.105, 5)
    expect(r.retailCostUsd).toBeCloseTo(0.2625, 5)
    expect(r.markupMultiplier).toBe(2.5)
    expect(r.retailCostCents).toBeGreaterThan(0)
    expect(r.wholesaleCostCents).toBeGreaterThan(0)
    expect(r.creditsRequired).toBeGreaterThanOrEqual(1)
  })

  it('never returns zero credits (Math.max(1, ...) safeguard)', () => {
    const r = calculateTokenCosts({
      model: 'gemini/gemini-2.5-flash',
      inputTokens: 1,
      outputTokens: 1,
    })
    expect(r.creditsRequired).toBeGreaterThanOrEqual(1)
    expect(r.retailCostCents).toBeGreaterThanOrEqual(1)
    expect(r.wholesaleCostCents).toBeGreaterThanOrEqual(1)
  })

  it('falls back to default rate for unknown models', () => {
    const known = calculateTokenCosts({
      model: 'totally/unknown-model',
      inputTokens: 1000,
      outputTokens: 1000,
    })
    expect(known.creditsRequired).toBeGreaterThan(0)
    expect(known.wholesaleCostUsd).toBeGreaterThan(0)
  })

  it('honors an explicit markup override', () => {
    const r = calculateTokenCosts({
      model: 'openai/gpt-4o',
      inputTokens: 1000,
      outputTokens: 1000,
      markupMultiplier: 5,
    })
    expect(r.markupMultiplier).toBe(5)
    expect(r.retailCostUsd).toBeCloseTo(r.wholesaleCostUsd * 5, 5)
  })

  it('correctly prices each LLM provider in the table', () => {
    // Spot-check three providers to confirm correct rate lookup.
    const sonnet = calculateTokenCosts({ model: 'anthropic/claude-sonnet-4', inputTokens: 1000, outputTokens: 1000 })
    const opus = calculateTokenCosts({ model: 'anthropic/claude-opus-4', inputTokens: 1000, outputTokens: 1000 })
    const flash = calculateTokenCosts({ model: 'gemini/gemini-2.5-flash', inputTokens: 1000, outputTokens: 1000 })
    expect(opus.wholesaleCostUsd).toBeGreaterThan(sonnet.wholesaleCostUsd)
    expect(flash.wholesaleCostUsd).toBeLessThan(sonnet.wholesaleCostUsd)
  })

  it('exposes a breakdown with input/output components', () => {
    const r = calculateTokenCosts({
      model: 'openai/gpt-4o',
      inputTokens: 2000,
      outputTokens: 1000,
    })
    expect(r.breakdown.inputUsd).toBeGreaterThan(0)
    expect(r.breakdown.outputUsd).toBeGreaterThan(0)
  })
})
