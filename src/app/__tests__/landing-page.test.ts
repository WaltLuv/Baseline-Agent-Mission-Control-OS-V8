/**
 * Landing page (/) — Mission Control home is an exact clone of the Baseline OS
 * Workforce OS landing (/workforce-os), with the Interactive Workforce OS
 * Console carrying 9 directives (3 general builder + 6 industry workforce).
 */
import { readFileSync } from 'fs'
import { describe, it, expect } from 'vitest'
import { directivesByGroup, CONSOLE_DIRECTIVES, INDUSTRIES } from '@/lib/workforce-console'

const src = readFileSync('src/app/page.tsx', 'utf8')

describe('Landing page — Workforce OS clone + 9-directive console', () => {
  it('hero badge is the AI Workforce OS rename + Workforce OS + install line', () => {
    expect(src).toContain('data-testid="hero-badge"')
    expect(src).toContain('Introducing Baseline Automations AI Workforce OS')
    expect(src).toMatch(/The Operating System for Your/)
    expect(src).toContain('data-testid="hero-workforce-os"')
    expect(src).toContain('Workforce OS')
    expect(src).toContain('Install a complete AI workforce in minutes')
  })

  it('hero shows 11 installable industries → /app/activate?template=slug', () => {
    expect(src).toContain('data-testid="industries"')
    expect(src).toMatch(/What workforce do you want to install\?/)
    expect(src).toContain('industry-${ind.slug}')
    expect(src).toContain('/app/activate?template=${ind.slug}')
    expect(INDUSTRIES.length).toBe(11)
    for (const slug of ['property-management', 'insurance', 'ai-product-launch', 'real-estate', 'mortgage', 'cpa', 'law-firm', 'general-contractor', 'home-services', 'marketing-agency', 'ai-agency']) {
      expect(INDUSTRIES.map((i) => i.slug)).toContain(slug)
    }
  })

  it('renders the five product layers', () => {
    expect(src).toContain('data-testid="layers"')
    expect(src).toContain('data-testid={`layer-')
    for (const title of ['"Build"', '"Operate"', '"Scale"', '"Knowledge Layer"', '"Creative Layer"']) {
      expect(src, `missing layer ${title}`).toContain(`title: ${title}`)
    }
  })

  it('top nav includes Marketplace / VisionOps / PropControl / Mission Control + auth', () => {
    for (const t of ['nav-marketplace', 'nav-visionops', 'nav-propcontrol', 'nav-mission-control', 'header-sign-in', 'header-start-free']) {
      expect(src, `missing ${t}`).toContain(`data-testid="${t}"`)
    }
  })

  it('embeds the Interactive Workforce OS Console (labeled demo)', () => {
    expect(src).toContain('data-testid="workforce-console"')
    expect(src).toContain('data-testid="console-demo-label"')
    expect(src).toContain('data-testid="console-run"')
    expect(src).toContain('data-testid="console-agent-map"')
    expect(src).toContain('Interactive Workforce OS Console')
  })

  it('console has 9 directives — 3 general builder + 6 industry', () => {
    // 3 general are literal keys in BASE_SIMULATIONS.
    for (const k of ['dev:', 'marketing:', 'intelligence:']) {
      expect(src, `missing base directive ${k}`).toContain(k)
    }
    // 6 industry come from the directive model, merged at build.
    expect(src).toContain('...BASE_SIMULATIONS')
    expect(src).toContain('...INDUSTRY_SIMULATIONS')
    expect(src).toMatch(/directivesByGroup\("industry"\)/)
    expect(directivesByGroup('industry').length).toBe(6)
    expect(CONSOLE_DIRECTIVES.length).toBe(9) // 3 general + 6 industry
  })

  it('renders a directive tab + agent node per simulation', () => {
    expect(src).toContain('data-testid={`directive-${key}`}')
    expect(src).toContain('data-testid="agent-node"')
  })

  it('post-run CTA links to a real route from the directive model', () => {
    expect(src).toContain('data-testid="console-cta"')
    expect(src).toContain('activeSim.ctaRoute')
    // every industry directive CTA installs a real template
    for (const d of directivesByGroup('industry')) {
      expect(d.ctaRoute).toMatch(/^\/app\/activate\?template=/)
    }
  })

  it('footer surfaces the real routes', () => {
    expect(src).toContain('data-testid="footer-link-marketplace"')
    expect(src).toContain('data-testid="footer-link-pricing"')
    expect(src).toContain('data-testid="footer-link-flight-deck"')
    expect(src).toContain('data-testid="footer-link-help"')
  })

  it('scroll-friendly min-h-screen wrapper', () => {
    expect(src).toMatch(/\bmin-h-screen\b/)
  })

  it('no forbidden marketing claims', () => {
    const haystack = src.toLowerCase()
    for (const phrase of ['guaranteed revenue', 'guaranteed seo', 'guaranteed ranking', 'guaranteed success', 'no bugs ever']) {
      expect(haystack, `forbidden claim: ${phrase}`).not.toContain(phrase)
    }
  })

  it('static auth CTAs point at real routes (Sign In / Get Started)', () => {
    expect(src).toContain('href="/login"')
    expect(src).toContain('href="/signup"')
  })
})
