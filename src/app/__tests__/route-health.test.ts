/**
 * Route-health contracts — catches the "stale shell / wrong catalog" class of
 * bug at gate time (no server needed). The live HTTP smoke is scripts/route-health.mjs.
 */
import { readFileSync, existsSync } from 'fs'
import { describe, it, expect } from 'vitest'
import { listReadyTemplates } from '@/lib/baseline-os/workforce-templates/catalog'

describe('Route-health contracts', () => {
  it('the ready catalog is the full 11 production verticals (no stale 3)', () => {
    const ready = listReadyTemplates()
    expect(ready.length).toBe(11)
    const slugs = ready.map((t) => t.slug)
    for (const s of ['property-management', 'insurance', 'ai-product-launch', 'real-estate', 'mortgage', 'cpa', 'law-firm', 'general-contractor', 'home-services', 'marketing-agency', 'ai-agency']) {
      expect(slugs, `missing ready vertical ${s}`).toContain(s)
    }
  })

  it('the activation installer reads the live API, not a hardcoded catalog', () => {
    const src = readFileSync('src/components/activation/workforce-installer.tsx', 'utf8')
    expect(src).toContain("fetch('/api/workforce/templates'")
    // no inline hardcoded vertical list (the stale-3 bug source)
    expect(src).not.toMatch(/const\s+\w*[Tt]emplates\s*=\s*\[\s*\{[\s\S]*Insurance/)
  })

  it('the templates API surfaces ready-only templates', () => {
    const src = readFileSync('src/app/api/workforce/templates/route.ts', 'utf8')
    expect(src).toContain('listReadyTemplates')
  })

  it('the panel router wires the key customer-facing panels', () => {
    const src = readFileSync('src/app/app/[[...panel]]/page.tsx', 'utf8')
    for (const c of ["case 'billing'", "case 'creative'", "case 'higgsfield'", "case 'team'", "case 'overview'"]) {
      expect(src, `panel router missing ${c}`).toContain(c)
    }
    // every unmatched panel falls back (no blank screen)
    expect(src).toMatch(/default:\s*\{/)
  })

  it('dedicated app route dirs exist for activate/credentials/runtimes', () => {
    for (const p of ['src/app/app/activate/page.tsx', 'src/app/app/credentials/page.tsx', 'src/app/app/runtimes/page.tsx']) {
      expect(existsSync(p), `missing route ${p}`).toBe(true)
    }
  })

  it('a live route-health smoke script exists', () => {
    expect(existsSync('scripts/route-health.mjs')).toBe(true)
  })
})
