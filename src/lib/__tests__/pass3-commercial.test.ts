/**
 * Pass 3 — Commercial Storylines & Sales Experience tests.
 *
 * These tests guard the customer-understanding promise:
 *   - Every required vertical (PM, CPA, Law, AI Agency) has a complete
 *     narrative — headline, wins, attention, value, hours, top employee,
 *     AND a workforce roster.
 *   - The guided demo is short enough to fit the 60–90s target.
 *   - Marketplace positioning never uses the "app store" framing.
 *   - ROI storytelling uses business outcomes, not generic metrics.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { getDemoNarrative, DEMO_TEMPLATE_IDS } from '../demo-narratives'
import { GUIDED_DEMO_STEPS } from '../guided-demo'

const REQUIRED_VERTICALS = ['pm', 'cpa', 'law-firm', 'ai-agency', 'mortgage', 'real-estate', 'gc', 'home-services'] as const

const GENERIC_METRIC_BAD_PATTERNS = [
  /^\d+ tasks completed$/i,
  /^\d+ items processed$/i,
  /^\d+ requests handled$/i,
  /^kpi /i,
]

describe('Pass 3 — required storylines', () => {
  for (const id of REQUIRED_VERTICALS) {
    describe(`vertical: ${id}`, () => {
      const narrative = getDemoNarrative(id)
      it('exists in the demo catalog', () => {
        expect(DEMO_TEMPLATE_IDS).toContain(id)
        expect(narrative).not.toBeNull()
      })
      it('has a one-sentence headline', () => {
        expect(narrative!.briefingHeadline.length).toBeGreaterThan(10)
        expect(narrative!.briefingHeadline.length).toBeLessThan(120)
      })
      it('has three daily wins in business language', () => {
        expect(narrative!.dailyWins).toHaveLength(3)
        for (const w of narrative!.dailyWins) {
          expect(w.title.length).toBeGreaterThan(0)
          expect(w.impact.length).toBeGreaterThan(0)
          for (const bad of GENERIC_METRIC_BAD_PATTERNS) {
            expect(w.title).not.toMatch(bad)
          }
        }
      })
      it('has at least one attention item with severity + reason', () => {
        expect(narrative!.attentionItems.length).toBeGreaterThan(0)
        for (const a of narrative!.attentionItems) {
          expect(['low', 'medium', 'high']).toContain(a.severity)
          expect(a.reason.length).toBeGreaterThan(0)
        }
      })
      it('reports value created and hours saved (real numbers)', () => {
        expect(narrative!.valueCreatedMonthUsd).toBeGreaterThan(0)
        expect(narrative!.hoursSavedMonth).toBeGreaterThan(0)
      })
      it('names a top employee with impact in plain English', () => {
        expect(narrative!.topEmployee.name).toMatch(/^AI /)
        expect(narrative!.topEmployee.impact.length).toBeGreaterThan(0)
      })
      it('has a workforce roster (lifeSignals) of 3+ employees', () => {
        expect(narrative!.lifeSignals).toBeDefined()
        expect(narrative!.lifeSignals!.length).toBeGreaterThanOrEqual(3)
        for (const s of narrative!.lifeSignals!) {
          expect(s.agentName.startsWith('AI ')).toBe(true)
          expect(s.presence).toBeDefined()
        }
      })
    })
  }
})

describe('Pass 3 — guided demo', () => {
  it('has exactly six steps (fits the 60–90s target)', () => {
    expect(GUIDED_DEMO_STEPS).toHaveLength(6)
  })
  it('covers the five mandated topics', () => {
    const ids = GUIDED_DEMO_STEPS.map((s) => s.id)
    expect(ids).toContain('baseline-os')
    expect(ids).toContain('mission-control')
    expect(ids).toContain('ai-employees')
    expect(ids).toContain('memory')
    expect(ids).toContain('approvals')
    expect(ids).toContain('value')
  })
  it('every step has a title and body in plain English', () => {
    for (const s of GUIDED_DEMO_STEPS) {
      expect(s.title.length).toBeGreaterThan(10)
      expect(s.body.length).toBeGreaterThan(20)
    }
  })
  it('vertical glosses exist for the four core verticals (PM/CPA/Law/AI Agency)', () => {
    const stepsWithGloss = GUIDED_DEMO_STEPS.filter((s) => !!s.forTemplate)
    expect(stepsWithGloss.length).toBeGreaterThanOrEqual(2)
    for (const v of ['pm', 'cpa', 'law-firm', 'ai-agency']) {
      const count = stepsWithGloss.filter((s) => s.forTemplate?.[v]).length
      expect(count, `vertical ${v} should have at least one gloss`).toBeGreaterThanOrEqual(2)
    }
  })
})

describe('Pass 3 — marketplace positioning', () => {
  const marketplaceSource = readFileSync(
    resolve(process.cwd(), 'src/app/marketplace/page.tsx'),
    'utf8',
  )

  it('does not frame the marketplace as an "app store"', () => {
    // Heading text must not contain "App Store"; comment / docs in the
    // file body may still mention it for developer context.
    expect(marketplaceSource).not.toMatch(/<h1[^>]*>[^<]*App Store/i)
    expect(marketplaceSource).not.toMatch(/<h1[^>]*>[^<]*App\s+Store/i)
  })

  it('uses executive verbs: Hire, Install, Deploy', () => {
    expect(marketplaceSource).toMatch(/Hire AI Employees/)
    expect(marketplaceSource).toMatch(/Install AI Skills/)
    expect(marketplaceSource).toMatch(/Deploy AI Teams/)
  })

  it('connects to business outcomes via the outcomes grid', () => {
    expect(marketplaceSource).toMatch(/data-testid="marketplace-outcomes"/)
  })
})
