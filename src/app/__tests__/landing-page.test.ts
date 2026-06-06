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

  it('AI Product Launch Team section is present with Walt\'s headline + subheadline', () => {
    expect(src).toContain('data-testid="ai-product-launch-team"')
    expect(src).toMatch(/AI Team to[\s\S]*Build Faster and Win Customers/)
    expect(src).toMatch(/A full AI team that helps you launch faster at a lower cost/)
    // Project types Walt enumerated.
    for (const p of ['SaaS', 'Internal Tools', 'Personal Websites', 'E-commerce', 'Automations', 'AI Agent Apps']) {
      expect(src).toContain(p)
    }
  })

  it('AI Product Launch section explicitly mentions credits, Stripe, SEO, GitHub, multilingual, integrations', () => {
    const block = src.split('data-testid="ai-product-launch-team"')[1]?.split('data-testid="ai-product-launch-truth-note"')[0] ?? ''
    expect(block).toBeTruthy()
    expect(block.toLowerCase()).toContain('credit')
    expect(block.toLowerCase()).toContain('stripe')
    expect(block.toLowerCase()).toContain('seo')
    expect(block.toLowerCase()).toContain('github')
    expect(block.toLowerCase()).toContain('multilingual')
    // "not a demo" — Walt's phrase
    expect(block.toLowerCase()).toContain('not a demo')
  })

  it('AI Product Launch section uses truthful language and avoids every forbidden marketing claim Walt named', () => {
    const block = src.split('data-testid="ai-product-launch-team"')[1]?.split("VERTICALS")[0] ?? ''
    const haystack = block.toLowerCase()
    const forbidden = [
      'guaranteed revenue',
      'guaranteed seo',
      'guaranteed ranking',
      'guaranteed success',
      'no bugs ever',
      'fully autonomous',
      'deployment always works',
    ]
    for (const phrase of forbidden) {
      expect(haystack).not.toContain(phrase)
    }
    // And uses Walt's preferred verbs.
    expect(haystack).toMatch(/helps|assists|drafts|supervises/)
  })
})
