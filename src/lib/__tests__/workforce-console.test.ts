/**
 * Interactive Workforce OS Console — directive model tests.
 * Verifies the 3 general + 5 industry directives, per-directive agent maps +
 * sim logs, human gates, and that every CTA route is real (no dead links).
 */
import { describe, it, expect } from 'vitest'
import { CONSOLE_DIRECTIVES, getDirective, directivesByGroup, INDUSTRIES } from '@/lib/workforce-console'

// Real route allow-list for landing CTAs (these exist in the app).
const REAL_BASE_ROUTES = ['/app/activate', '/app/orchestration', '/marketplace', '/skills', '/agents/claude-code-studio']
const INSTALLABLE_SLUGS = new Set(INDUSTRIES.map((i) => i.slug))

describe('Workforce OS console directives', () => {
  it('keeps the original three general directives', () => {
    const general = directivesByGroup('general').map((d) => d.directiveId)
    expect(general).toContain('software-release')
    expect(general).toContain('saas-launch')
    expect(general).toContain('market-intel')
  })

  it('adds the six industry workforce directives', () => {
    const industry = directivesByGroup('industry').map((d) => d.verticalId)
    for (const v of ['property-management', 'real-estate', 'cpa', 'marketing-agency', 'home-services', 'general-contractor']) {
      expect(industry, `missing industry directive ${v}`).toContain(v)
    }
    expect(directivesByGroup('industry').length).toBe(6)
  })

  it('each directive has a non-empty agent map, sim log, and proof summary', () => {
    for (const d of CONSOLE_DIRECTIVES) {
      expect(d.agentMap.length, `${d.directiveId} empty agent map`).toBeGreaterThan(0)
      expect(d.steps.length, `${d.directiveId} empty sim log`).toBeGreaterThan(2)
      expect(d.proofSummary.length).toBeGreaterThan(0)
      // every directive logs a proof package step (truthful proof)
      expect(d.steps.some((s) => /proof package/i.test(s))).toBe(true)
    }
  })

  it('selecting each vertical changes the agent map to that workforce', () => {
    expect(getDirective('pm-maintenance')!.agentMap).toContain('Maintenance Dispatcher')
    expect(getDirective('re-new-lead')!.agentMap).toContain('Transaction Coordinator')
    expect(getDirective('cpa-intake')!.agentMap).toContain('Deadline Monitor')
    expect(getDirective('mktg-campaign')!.agentMap).toContain('Content Calendar Manager')
    expect(getDirective('hs-service')!.agentMap).toContain('Technician Scheduler')
    expect(getDirective('gc-bid')!.agentMap).toContain('Change Order Tracker')
    // agent maps are distinct per vertical
    const maps = ['pm-maintenance', 're-new-lead', 'cpa-intake', 'mktg-campaign', 'hs-service', 'gc-bid'].map((id) => getDirective(id)!.agentMap.join('|'))
    expect(new Set(maps).size).toBe(6)
  })

  it('General Contractor directive is GC-specific with a change-order human gate', () => {
    const gc = getDirective('gc-bid')!
    expect(gc.verticalId).toBe('general-contractor')
    expect(gc.steps.some((s) => /subcontractor bid/i.test(s))).toBe(true)
    expect(gc.steps.some((s) => /material quote tracker/i.test(s))).toBe(true)
    expect(gc.humanGates.join(' ')).toMatch(/change order/i)
    expect(gc.ctaRoute).toBe('/app/activate?template=general-contractor')
  })

  it('every directive surfaces at least one human gate', () => {
    for (const d of CONSOLE_DIRECTIVES) {
      expect(d.humanGates.length, `${d.directiveId} has no human gate`).toBeGreaterThan(0)
    }
    expect(getDirective('pm-maintenance')!.humanGates.join(' ')).toMatch(/owner approval/i)
    expect(getDirective('cpa-intake')!.humanGates.join(' ')).toMatch(/partner approval/i)
  })

  it('every CTA route is real (no dead links) + industry CTAs install a real template', () => {
    for (const d of CONSOLE_DIRECTIVES) {
      const [base, query] = d.ctaRoute.split('?')
      expect(REAL_BASE_ROUTES, `${d.directiveId} cta base ${base} not a real route`).toContain(base)
      if (query) {
        const m = query.match(/template=([a-z-]+)/)
        if (m) expect(INSTALLABLE_SLUGS.has(m[1]), `${d.directiveId} installs unknown template ${m[1]}`).toBe(true)
      }
    }
  })

  it('the 11 installable industries are present (hero choose-your-workforce)', () => {
    expect(INDUSTRIES.length).toBe(11)
    for (const slug of ['property-management', 'insurance', 'real-estate', 'mortgage', 'cpa', 'law-firm', 'general-contractor', 'home-services', 'marketing-agency', 'ai-agency', 'ai-product-launch']) {
      expect(INDUSTRIES.map((i) => i.slug)).toContain(slug)
    }
  })
})
