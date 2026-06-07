/**
 * Landing page (/) — Workforce OS positioning.
 *
 * Walt's directive: the Mission Control landing must BE a "Workforce OS"
 * landing (workforce templates as the hero), not a "Baseline Automations /
 * Join Waitlist" product-marketing site. Structure: hero → Choose your
 * industry (11 installable templates) → Interactive Workforce OS Console →
 * Build / Operate / Scale / Knowledge / Creative layers.
 *
 * Honesty guards retained: no fake monthly-subscription claims, no forbidden
 * marketing claims, footer surfaces the real routes, scroll-friendly wrapper.
 */
import { readFileSync } from 'fs'
import { describe, it, expect } from 'vitest'
import { INDUSTRIES, CONSOLE_DIRECTIVES } from '@/lib/workforce-console'

const src = readFileSync('src/app/page.tsx', 'utf8')

describe('Landing page — Workforce OS positioning', () => {
  it('leads with the AI Workforce OS hero (Walt\'s rename)', () => {
    expect(src).toContain('Introducing Baseline Automations AI Workforce OS')
    expect(src).toContain('data-testid="hero-badge"')
    expect(src).toMatch(/Workforce OS/)
    expect(src).toMatch(/Install a complete AI workforce in minutes/)
  })

  it('makes workforce templates the hero — all 11 installable industries are present', () => {
    expect(src).toContain('data-testid="industries"')
    expect(src).toMatch(/What workforce do you want to install\?/)
    // The page maps INDUSTRIES into per-slug tiles (one dynamic template).
    expect(src).toContain('industry-${ind.slug}')
    expect(src).toMatch(/INDUSTRIES\.map/)
    // sanity: the lib carries the canonical 11, incl. Insurance.
    expect(INDUSTRIES.length).toBe(11)
    expect(INDUSTRIES.map((i) => i.slug)).toContain('insurance')
  })

  it('embeds the Interactive Workforce OS Console (labeled demo) with directives', () => {
    expect(src).toContain('data-testid="workforce-console"')
    expect(src).toContain('data-testid="console-demo-label"')
    expect(src).toContain('data-testid="console-run"')
    expect(src).toContain('data-testid="console-agent-map"')
    expect(src).toContain('data-testid="console-human-gate"')
    // 3 general + 6 industry directives drive the console
    expect(CONSOLE_DIRECTIVES.length).toBe(9)
  })

  it('surfaces the five product layers (Build / Operate / Scale / Knowledge / Creative)', () => {
    // LayerSection emits a dynamic data-testid={`layer-...`}; assert the titles.
    expect(src).toContain('data-testid={`layer-')
    for (const title of ['Build', 'Operate', 'Scale', 'Knowledge Layer', 'Creative Layer']) {
      expect(src, `missing layer ${title}`).toContain(`title="${title}"`)
    }
  })

  it('does not advertise any monthly subscription on the landing page', () => {
    expect(src).not.toMatch(/\$499/)
    expect(src).not.toMatch(/\$\d+\s*\/\s*mo\b/)
    expect(src).not.toMatch(/\/month\b/)
  })

  it('footer surfaces /flight-deck, /pricing, and /help', () => {
    expect(src).toContain('data-testid="footer-link-flight-deck"')
    expect(src).toContain('data-testid="footer-link-pricing"')
    expect(src).toContain('data-testid="footer-link-help"')
  })

  it('preserves the scroll-friendly min-h-screen wrapper', () => {
    expect(src).toMatch(/\bmin-h-screen\b/)
  })

  it('uses truthful language — no forbidden marketing claims', () => {
    const haystack = src.toLowerCase()
    for (const phrase of [
      'guaranteed revenue',
      'guaranteed seo',
      'guaranteed ranking',
      'guaranteed success',
      'no bugs ever',
      'deployment always works',
    ]) {
      expect(haystack, `forbidden claim present: ${phrase}`).not.toContain(phrase)
    }
  })

  it('every landing CTA points at a real route (no dead links)', () => {
    // Console CTA routes are validated in workforce-console.test.ts; here ensure
    // the static hrefs on the page resolve to known real routes/anchors.
    const hrefs = Array.from(src.matchAll(/href="(\/[^"]*|#[a-z-]+)"/g)).map((m) => m[1])
    const realPrefixes = ['/signup', '/login', '/marketplace', '/pricing', '/flight-deck', '/help', '/app', '/', '#']
    for (const h of hrefs) {
      expect(realPrefixes.some((p) => h === p || h.startsWith(p)), `suspect href ${h}`).toBe(true)
    }
  })
})
