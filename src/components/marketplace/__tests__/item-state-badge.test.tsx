/**
 * Marketplace item-state derivation + label tests.
 *
 * Covers Walt's required UI states:
 *   Free · Included · X credits · Purchased · Locked · Insufficient credits
 * and the per-item-type button labels.
 */
import { describe, it, expect } from 'vitest'
import { deriveItemState, buttonLabelFor } from '@/components/marketplace/item-state-badge'

describe('deriveItemState', () => {
  it('returns "purchased" when the workspace already owns the item', () => {
    const s = deriveItemState({ priceCredits: 100, pricingType: 'credits', purchased: true, balance: 0 })
    expect(s.kind).toBe('purchased')
  })

  it('returns "free" when pricing_type=free or price is 0', () => {
    expect(deriveItemState({ priceCredits: 0, pricingType: 'free', purchased: false, balance: 0 }).kind).toBe('free')
    expect(deriveItemState({ priceCredits: 0, pricingType: 'credits', purchased: false, balance: 9999 }).kind).toBe('free')
  })

  it('returns "included" when pricing_type=included and not yet purchased', () => {
    const s = deriveItemState({ priceCredits: 100, pricingType: 'included', purchased: false, balance: 999 })
    expect(s.kind).toBe('included')
  })

  it('returns "insufficient_credits" with required + balance when balance is low', () => {
    const s = deriveItemState({ priceCredits: 500, pricingType: 'credits', purchased: false, balance: 100 })
    expect(s.kind).toBe('insufficient_credits')
    if (s.kind === 'insufficient_credits') {
      expect(s.required).toBe(500)
      expect(s.balance).toBe(100)
    }
  })

  it('returns "credits" with the price when balance covers it', () => {
    const s = deriveItemState({ priceCredits: 250, pricingType: 'credits', purchased: false, balance: 1000 })
    expect(s.kind).toBe('credits')
    if (s.kind === 'credits') expect(s.priceCredits).toBe(250)
  })
})

describe('buttonLabelFor', () => {
  it('labels free items per item type', () => {
    expect(buttonLabelFor({ kind: 'free' }, 'skill')).toBe('Install (free)')
    expect(buttonLabelFor({ kind: 'free' }, 'employee')).toBe('Install (free)')
    expect(buttonLabelFor({ kind: 'free' }, 'bundle')).toBe('Deploy (free)')
  })

  it('labels included items', () => {
    expect(buttonLabelFor({ kind: 'included' }, 'skill')).toBe('Included')
  })

  it('labels credit-priced items with the cost', () => {
    expect(buttonLabelFor({ kind: 'credits', priceCredits: 500 }, 'skill')).toBe('Buy with 500 credits')
    expect(buttonLabelFor({ kind: 'credits', priceCredits: 25_000 }, 'employee')).toBe('Buy with 25,000 credits')
  })

  it('labels purchased items per item type', () => {
    expect(buttonLabelFor({ kind: 'purchased' }, 'employee')).toBe('Open')
    expect(buttonLabelFor({ kind: 'purchased' }, 'skill')).toBe('Configure')
    expect(buttonLabelFor({ kind: 'purchased' }, 'workflow')).toBe('Configure')
  })

  it('labels insufficient_credits as "Buy Credits"', () => {
    expect(buttonLabelFor({ kind: 'insufficient_credits', required: 500, balance: 100 }, 'skill')).toBe('Buy Credits')
    expect(buttonLabelFor({ kind: 'insufficient_credits', required: 500, balance: 100 }, 'employee')).toBe('Buy Credits')
  })

  it('labels locked items', () => {
    expect(buttonLabelFor({ kind: 'locked', reason: 'plan' }, 'skill')).toBe('Locked')
  })
})
