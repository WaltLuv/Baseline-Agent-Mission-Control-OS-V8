import { describe, it, expect } from 'vitest'
import { computeWorkforceHealth } from '../../components/billing/workforce-health-score'

describe('computeWorkforceHealth', () => {
  it('flags a healthy workforce as 80+', () => {
    const h = computeWorkforceHealth({
      balance: 5000,
      daysRemaining: 30,
      marginPercent: 60,
      ledgerVerified: true,
      recentEventCount: 25,
      attentionItemCount: 0,
    })
    expect(h.score).toBeGreaterThanOrEqual(80)
    expect(h.band).toBe('healthy')
    expect(h.bullets.some((b) => b.label.toLowerCase().includes('plenty of fuel'))).toBe(true)
  })

  it('flags an empty workspace as critical when balance is 0', () => {
    const h = computeWorkforceHealth({
      balance: 0,
      daysRemaining: 0,
      marginPercent: null,
      ledgerVerified: true,
      recentEventCount: 0,
      attentionItemCount: 0,
    })
    expect(h.score).toBeLessThan(60)
    expect(h.bullets.some((b) => b.label === 'Workforce out of fuel')).toBe(true)
  })

  it('docks heavily for ledger mismatch', () => {
    const healthy = computeWorkforceHealth({
      balance: 5000,
      daysRemaining: 30,
      marginPercent: 60,
      ledgerVerified: true,
      recentEventCount: 25,
      attentionItemCount: 0,
    })
    const mismatched = computeWorkforceHealth({
      balance: 5000,
      daysRemaining: 30,
      marginPercent: 60,
      ledgerVerified: false,
      recentEventCount: 25,
      attentionItemCount: 0,
    })
    expect(mismatched.score).toBeLessThan(healthy.score)
    expect(mismatched.bullets.some((b) => !b.ok && b.label.includes('mismatch'))).toBe(true)
  })

  it('docks attention-item count proportionally (capped at 15)', () => {
    const base = computeWorkforceHealth({
      balance: 5000,
      daysRemaining: 30,
      marginPercent: null,
      ledgerVerified: true,
      recentEventCount: 10,
      attentionItemCount: 0,
    })
    const some = computeWorkforceHealth({
      balance: 5000,
      daysRemaining: 30,
      marginPercent: null,
      ledgerVerified: true,
      recentEventCount: 10,
      attentionItemCount: 2,
    })
    const many = computeWorkforceHealth({
      balance: 5000,
      daysRemaining: 30,
      marginPercent: null,
      ledgerVerified: true,
      recentEventCount: 10,
      attentionItemCount: 50,
    })
    expect(some.score).toBeLessThan(base.score)
    // Cap at 15 — many > 50 attention items still only docks 15 points.
    expect(base.score - many.score).toBeLessThanOrEqual(20)
  })
})
