/**
 * Landing page (/) — credit-model truth + deployment-mode disclosure.
 *
 * Walt's rule: "sellable front door using Workforce OS layout, honest about
 * free vs credits." Before this slice the landing pricing teaser still
 * showed a $499/mo "Professional" plan that no longer existed in
 * /pricing — bait-and-switch. This test pins the new contract.
 *
 * What we guarantee:
 *   · Pricing teaser is the credit-pack model (Starter $10 / Power $25 /
 *     Pro $50) matching CREDIT_PACKS in src/app/pricing/page.tsx.
 *   · There is no leftover $/mo subscription claim on the landing page.
 *   · The two deployment modes (Baseline OS local, Mission Control cloud)
 *     are surfaced via a dedicated section.
 *   · The footer surfaces /flight-deck, /pricing, and /help.
 */
import { readFileSync } from 'fs'
import { describe, it, expect } from 'vitest'

const src = readFileSync('src/app/page.tsx', 'utf8')

describe('Landing page — credit-model + deployment modes', () => {
  it('has a credit-pack pricing teaser (no stale subscription plans)', () => {
    expect(src).toContain('data-testid="pricing-card-pack-starter"')
    expect(src).toContain('data-testid="pricing-card-pack-power"')
    expect(src).toContain('data-testid="pricing-card-pack-pro"')
    // Specific pack prices match the canonical CREDIT_PACKS in pricing/page.tsx
    expect(src).toMatch(/Starter Pack[\s\S]*\$10[\s\S]*1,000 credits/)
    expect(src).toMatch(/Power Pack[\s\S]*\$25[\s\S]*2,750 credits/)
    expect(src).toMatch(/Pro Pack[\s\S]*\$50[\s\S]*6,000 credits/)
  })

  it('does not advertise any monthly subscription on the landing page', () => {
    // The old "Professional $499/mo" copy must not return.
    expect(src).not.toMatch(/\$499/)
    expect(src).not.toMatch(/\$\d+\s*\/\s*mo\b/)
    expect(src).not.toMatch(/\/month\b/)
    expect(src).not.toMatch(/data-testid="pricing-card-professional"/)
    expect(src).not.toMatch(/data-testid="pricing-card-enterprise"/)
  })

  it('discloses the 2.5× markup + $0.10/credit unit math', () => {
    expect(src).toContain('data-testid="pricing-credit-disclosure"')
    expect(src).toMatch(/1 credit = \$0\.10/)
    expect(src).toMatch(/2\.5×/)
  })

  it('surfaces the two deployment modes (local Baseline OS + cloud Mission Control)', () => {
    expect(src).toContain('data-testid="deployment-modes"')
    expect(src).toContain('data-testid="mode-local"')
    expect(src).toContain('data-testid="mode-cloud"')
    expect(src).toMatch(/Baseline OS/)
    expect(src).toMatch(/Mission Control/)
    // Anchors to the desktop terminal install page.
    expect(src).toContain('data-testid="deployment-modes-flight-deck"')
    expect(src).toMatch(/href="\/flight-deck"/)
  })

  it('footer surfaces /flight-deck, /pricing, and /help', () => {
    expect(src).toContain('data-testid="footer-link-flight-deck"')
    expect(src).toContain('data-testid="footer-link-pricing"')
    expect(src).toContain('data-testid="footer-link-help"')
  })

  it('top nav promotes Marketplace / VisionOps / PropControl / Mission Control (Walt’s correction)', () => {
    expect(src).toContain('data-testid="nav-marketplace"')
    expect(src).toContain('data-testid="nav-visionops"')
    expect(src).toContain('data-testid="nav-propcontrol"')
    expect(src).toContain('data-testid="nav-mission-control"')
  })

  it('industry vertical list includes Insurance as a first-class item', () => {
    // Walt: "Insurance must be visible in: industry/vertical list".
    // Walt: "It is not optional."
    const verticalsBlock = src.match(/\[\s*\n?\s*'Property Management'[\s\S]*?\]\.map/)
    expect(verticalsBlock, 'verticals array not found').toBeTruthy()
    expect(verticalsBlock![0]).toContain("'Insurance'")
    // Sanity — the canonical 10 verticals per Walt's spec.
    for (const v of [
      'Property Management',
      'Real Estate',
      'Insurance',
      'Mortgage',
      'CPA',
      'Law',
      'General Contractors',
      'Home Services',
      'Marketing Agencies',
      'AI Agencies',
    ]) {
      expect(verticalsBlock![0]).toContain(`'${v}'`)
    }
  })

  it('preserves the existing scroll-friendly min-h-screen wrapper', () => {
    expect(src).toMatch(/\bmin-h-screen\b/)
  })
})
