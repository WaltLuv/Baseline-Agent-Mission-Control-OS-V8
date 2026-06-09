/**
 * Mission Control launch homepage — cinematic hero + PM-focused reorg.
 */
import { readFileSync, existsSync } from 'fs'
import { describe, it, expect } from 'vitest'

const page = readFileSync('src/app/page.tsx', 'utf8')
const hero = readFileSync('src/components/marketing/mission-control-hero.tsx', 'utf8')

describe('Cinematic hero', () => {
  it('renders a video hero with autoplay/muted/loop/playsInline + poster', () => {
    expect(hero).toContain('<video')
    expect(hero).toContain('autoPlay')
    expect(hero).toContain('muted')
    expect(hero).toContain('loop')
    expect(hero).toContain('playsInline')
    expect(hero).toContain('poster=')
  })
  it('is a multi-act cinematic sequence (boot→operations→swarm→control tower), not a static field', () => {
    expect(hero).toContain('data-testid="hero-animation"')
    expect(hero).toContain('data-testid="hero-opening"')
    expect(hero).toContain('data-testid="hero-act-caption"')
    expect(hero).toContain('hero-act-${act2.key}') // dynamic act testids
    for (const k of ['boot', 'portfolio', 'swarm', 'tower']) expect(hero, `missing act ${k}`).toContain(`key: '${k}'`)
    expect(hero).toContain('100 agents scanning the market')
    expect(hero).toContain('Flight Deck · Graphify · Replay')
    expect(hero).toContain('Owner Approval')
  })
  it('poster + opening-frame assets exist', () => {
    expect(existsSync('public/marketing/mission-control-hero-poster.svg')).toBe(true)
    expect(existsSync('public/marketing/mission-control-hero-opening.jpg')).toBe(true)
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
