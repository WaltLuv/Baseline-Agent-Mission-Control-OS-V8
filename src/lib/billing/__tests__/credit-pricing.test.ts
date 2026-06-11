/**
 * Revenue-safety tests — prove Mission Control cannot lose money on execution.
 */
import { describe, it, expect } from 'vitest'
import {
  priceUsage,
  priceWorkflow,
  providerCostUsd,
  workflowMarginTable,
  WORKFLOW_PROFILES,
  assertMarginSafe,
  MarginViolationError,
  TARGET_GROSS_MARGIN,
  CREDIT_USD,
  MIN_CHARGE_CREDITS,
} from '../credit-pricing'
import { MODEL_COSTS, getModelCost } from '../provider-cost-catalog'

describe('canonical provider-cost catalog', () => {
  it('contains current models only (no deprecated/disabled selectable)', () => {
    for (const m of MODEL_COSTS) expect(m.status).toBe('current')
    expect(getModelCost('anthropic/claude-opus-4-8')).not.toBeNull()
    expect(getModelCost('openai/gpt-4o')).toBeNull() // deprecated absent
  })
})

describe('profit-safe credit calculation', () => {
  it('every workflow is priced ABOVE provider cost', () => {
    for (const w of WORKFLOW_PROFILES) {
      const r = priceWorkflow(w.id)
      expect(r.customerUsd, w.label).toBeGreaterThan(r.providerCostUsd)
    }
  })

  it('every workflow meets or exceeds the target gross margin (launch-safe)', () => {
    for (const w of WORKFLOW_PROFILES) {
      const r = priceWorkflow(w.id)
      expect(r.grossMargin, `${w.label} margin`).toBeGreaterThanOrEqual(TARGET_GROSS_MARGIN)
      expect(r.marginSafe, w.label).toBe(true)
    }
  })

  it('includes OUTPUT token cost (not only input)', () => {
    const base = { model: 'anthropic/claude-opus-4-8', inputTokens: 5000, outputTokens: 0 }
    const withOutput = { ...base, outputTokens: 5000 }
    expect(providerCostUsd(withOutput)).toBeGreaterThan(providerCostUsd(base))
  })

  it('includes tool / SMS / voice costs (not only LLM tokens)', () => {
    const base = { model: 'anthropic/claude-sonnet-4-6', inputTokens: 3000, outputTokens: 1000 }
    const withSms = { ...base, tools: { sms_outbound: 2 } as const }
    expect(providerCostUsd(withSms)).toBeGreaterThan(providerCostUsd(base))
  })

  it('applies a minimum charge', () => {
    const tiny = priceUsage({ model: 'anthropic/claude-haiku-4-5', inputTokens: 1, outputTokens: 1 })
    expect(tiny.customerCredits).toBeGreaterThanOrEqual(MIN_CHARGE_CREDITS)
  })

  it('rounds UP to whole credits, never down', () => {
    const r = priceUsage({ model: 'anthropic/claude-opus-4-8', inputTokens: 7777, outputTokens: 3333 })
    expect(Number.isInteger(r.customerCredits)).toBe(true)
    expect(r.customerUsd).toBeGreaterThanOrEqual(r.providerCostUsd) // never below cost
    // charged credits cover the marked-up cost
    expect(r.customerUsd).toBeCloseTo(r.customerCredits * CREDIT_USD, 10)
  })

  it('unknown model uses the most-expensive current model (never under-charges)', () => {
    const unknown = providerCostUsd({ model: 'totally/unknown', inputTokens: 10000, outputTokens: 10000 })
    const opus = providerCostUsd({ model: 'anthropic/claude-opus-4-8', inputTokens: 10000, outputTokens: 10000 })
    expect(unknown).toBe(opus)
  })

  it('margin guard throws when a charge would fall below target', () => {
    // Force an absurd sub-margin charge by markup < 1 and no min/rounding rescue.
    const bad = priceUsage(
      { model: 'anthropic/claude-opus-4-8', inputTokens: 1_000_000, outputTokens: 1_000_000 },
      { markup: 0.5, minCredits: 1 },
    )
    expect(bad.marginSafe).toBe(false)
    expect(() => assertMarginSafe(bad)).toThrow(MarginViolationError)
  })
})

describe('workflow margin table', () => {
  it('every row is launch-safe (>= target margin)', () => {
    const table = workflowMarginTable()
    expect(table.length).toBe(WORKFLOW_PROFILES.length)
    const unsafe = table.filter((r) => !r.launchSafe)
    expect(unsafe, `unsafe rows: ${JSON.stringify(unsafe)}`).toEqual([])
  })
})
