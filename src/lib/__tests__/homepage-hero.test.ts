/**
 * Mission Control launch homepage — cinematic hero + PM-focused reorg.
 */
import { readFileSync, existsSync } from 'fs'
import { describe, it, expect } from 'vitest'

const page = readFileSync('src/app/page.tsx', 'utf8')
const hero = readFileSync('src/components/marketing/mission-control-hero.tsx', 'utf8')

describe('Hero — sales-presentation film player', () => {
  it('is the real film with a Play-with-sound button + poster (no muted autoplay)', () => {
    expect(hero).toContain('<video')
    expect(hero).toContain('poster=')
    expect(hero).toContain('playsInline')
    expect(hero).toContain('data-testid="hero-play"') // explicit Play Film button
    expect(hero).toContain('v.muted = false') // narration audio on click
    expect(hero).toContain('mission-control-hero.mp4')
    expect(hero).not.toMatch(/autoPlay/) // no muted-autoplay-loop
  })
  it('renders narration-synced chapters derived from the actual transcript', () => {
    expect(hero).toContain('data-testid="hero-chapter"')
    expect(hero).toContain('data-testid="hero-chapter-rail"')
    expect(hero).toContain('onTimeUpdate')
    for (const beat of ['PROPCONTROL', 'THE FACTORY', 'THE AI AGENT', 'INSTALL THE WORKFORCE']) {
      expect(hero, `missing chapter ${beat}`).toContain(beat)
    }
    expect(hero).toContain('vendor dispatch') // real PropControl narration
  })
  it('the real film + demo + operator poster assets exist', () => {
    expect(existsSync('public/marketing/mission-control-hero.mp4'), 'full edited film').toBe(true)
    expect(existsSync('public/marketing/mission-control-demo.mp4'), 'full narrated demo').toBe(true)
    expect(existsSync('public/marketing/mission-control-hero-poster.jpg'), 'graded poster').toBe(true)
    expect(existsSync('public/marketing/mission-control-hero-opening.jpg'), 'operator opening frame/thumbnail').toBe(true)
  })
  it('homepage uses the hero component', () => {
    expect(page).toContain('<MissionControlHero />')
  })
})

describe('Homepage PM focus + removed sections', () => {
  it('removed the fake metric stats', () => {
    for (const s of ['1.2M+', '99.8%', 'Avg. Task Resolution', '$45K+', 'Tasks Completed']) {
      expect(page, `still shows ${s}`).not.toContain(s)
    }
  })
  it('removed the broad vertical workforce install grid', () => {
    expect(page).not.toContain('What workforce do you want to install?')
    expect(page).not.toContain('industry-${ind.slug}')
  })
  it('PM CTAs + copy present', () => {
    expect(page).toContain('data-testid="cta-install-pm"')
    expect(page).toContain('data-testid="cta-watch-demo"')
    expect(page).toContain('Real Estate Execution Platform for')
    expect(page).toContain('Property Operations')
  })
  it('PM workflow + Flight Deck preview sections present', () => {
    expect(page).toContain('data-testid="pm-workflow"')
    expect(page).toContain('pm-step-${i}') // dynamic testid (renders pm-step-0..6)
    expect(page).toContain('data-testid="flight-deck-preview"')
  })
  it('KEEPS the core differentiators (console / ROI / architecture / FAQ / layers)', () => {
    expect(page).toContain('data-testid="workforce-console"')
    expect(page).toContain('id="roi"')
    expect(page).toContain('id="architecture"')
    expect(page).toContain('id="faq"')
    expect(page).toContain('data-testid="layers"')
  })
})
