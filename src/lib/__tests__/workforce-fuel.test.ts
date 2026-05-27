import { describe, it, expect } from 'vitest'
import { computeFuelFromOverview } from '../../components/billing/workforce-fuel'

const PACKAGES = [
  { id: 1, name: 'Starter', description: '1,000 credits', price_cents: 1000, credits: 1000, bonus_credits: 0 },
  { id: 2, name: 'Power', description: '2,750 credits', price_cents: 2500, credits: 2500, bonus_credits: 250 },
  { id: 3, name: 'Pro', description: '6,000 credits', price_cents: 5000, credits: 5500, bonus_credits: 500 },
  { id: 4, name: 'Enterprise', description: '25,000 credits', price_cents: 20000, credits: 22500, bonus_credits: 2500 },
]

describe('computeFuelFromOverview', () => {
  it('flags a brand new workspace with zero balance as low-balance', () => {
    const fuel = computeFuelFromOverview({
      balance: { balance: 0 },
      recentUsage: [],
      packages: PACKAGES,
    })
    expect(fuel.lowBalance).toBe(true)
    expect(fuel.daysRemaining).toBe(0)
    expect(fuel.recommendedPackage).not.toBeNull()
  })

  it('computes runway from balance / dailyBurnRate', () => {
    const now = Math.floor(Date.now() / 1000)
    const fuel = computeFuelFromOverview({
      balance: { balance: 700 },
      recentUsage: [
        { credits_charged: 70, created_at: now - 86400 }, // 1 day ago
        { credits_charged: 70, created_at: now - 86400 * 2 },
        { credits_charged: 70, created_at: now - 86400 * 3 },
      ],
      packages: PACKAGES,
    })
    expect(fuel.dailyBurnRate).toBeGreaterThan(0)
    // 700 / ceil(210/14) = 700 / 15 = 46 days
    expect(fuel.daysRemaining).toBeGreaterThan(20)
  })

  it('marks lowBalance when runway < 5 days', () => {
    const now = Math.floor(Date.now() / 1000)
    const fuel = computeFuelFromOverview({
      balance: { balance: 50 },
      recentUsage: [
        { credits_charged: 280, created_at: now - 86400 }, // 280/14 = 20/day → 50/20 = 2.5 days
      ],
      packages: PACKAGES,
    })
    expect(fuel.lowBalance).toBe(true)
    expect(fuel.daysRemaining).toBeLessThan(5)
  })

  it('recommends the smallest package covering 30 days of runway', () => {
    const now = Math.floor(Date.now() / 1000)
    const fuel = computeFuelFromOverview({
      balance: { balance: 10 },
      // High burn rate: 100 credits/day average → 30-day requirement = 3000 credits → Pro pkg (6000 total)
      recentUsage: Array.from({ length: 14 }, (_, i) => ({
        credits_charged: 100,
        created_at: now - 86400 * i,
      })),
      packages: PACKAGES,
    })
    expect(fuel.recommendedPackage).not.toBeNull()
    if (fuel.recommendedPackage) {
      const totalCredits = fuel.recommendedPackage.credits + fuel.recommendedPackage.bonusCredits
      expect(totalCredits).toBeGreaterThanOrEqual(3000)
    }
  })

  it('is healthy when balance covers > 10 days of runway', () => {
    const now = Math.floor(Date.now() / 1000)
    const fuel = computeFuelFromOverview({
      balance: { balance: 50_000 },
      recentUsage: [
        { credits_charged: 70, created_at: now - 86400 },
      ],
      packages: PACKAGES,
    })
    expect(fuel.lowBalance).toBe(false)
  })
})
