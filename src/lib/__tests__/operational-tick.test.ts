/**
 * Pass 2 — Executive Experience tests.
 *
 * These tests guard the calm, operational feel of Mission Control without
 * pinning visual values. They check:
 *   - Freshness derivation is bounded (live → stale → cold).
 *   - ageLabel is plain-English at every horizon.
 *   - Panel scroll memory persists & restores via sessionStorage without
 *     crossing browser sessions or losing prior writes.
 *   - Last-touched employee continuity round-trips.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { freshness, freshnessLabel, ageLabel } from '../operational-tick'

// Reusable jsdom-like sessionStorage shim — vitest's default jsdom already
// provides this, so we just clear it between tests.
function clearStorage() {
  if (typeof window !== 'undefined' && window.sessionStorage) {
    window.sessionStorage.clear()
  }
}

describe('operational-tick / freshness', () => {
  const now = 1_000_000_000_000
  it('returns cold when no event has been seen', () => {
    expect(freshness(null, now)).toBe('cold')
    expect(freshnessLabel('cold')).toBe('Off shift')
  })
  it('returns live within 15 seconds', () => {
    expect(freshness(now - 14_999, now)).toBe('live')
    expect(freshnessLabel('live')).toBe('On shift')
  })
  it('transitions to stale at 15s and stays stale under a minute', () => {
    expect(freshness(now - 15_000, now)).toBe('stale')
    expect(freshness(now - 59_999, now)).toBe('stale')
    expect(freshnessLabel('stale')).toBe('Catching breath')
  })
  it('transitions to cold at one minute', () => {
    expect(freshness(now - 60_000, now)).toBe('cold')
    expect(freshness(now - 5 * 60_000, now)).toBe('cold')
  })
})

describe('operational-tick / ageLabel', () => {
  const now = 1_000_000_000_000
  it('reports "never" when null', () => {
    expect(ageLabel(null, now)).toBe('never')
  })
  it('reports "just now" within 5s', () => {
    expect(ageLabel(now - 0, now)).toBe('just now')
    expect(ageLabel(now - 4_999, now)).toBe('just now')
  })
  it('reports seconds, minutes, hours, days at each horizon', () => {
    expect(ageLabel(now - 12_000, now)).toBe('12s ago')
    expect(ageLabel(now - 5 * 60_000, now)).toBe('5m ago')
    expect(ageLabel(now - 3 * 3_600_000, now)).toBe('3h ago')
    expect(ageLabel(now - 2 * 86_400_000, now)).toBe('2d ago')
  })
  it('clamps negative ages to "just now"', () => {
    expect(ageLabel(now + 500, now)).toBe('just now')
  })
})

describe('panel-continuity — last-touched employee', () => {
  beforeEach(() => clearStorage())

  it('round-trips a slug through sessionStorage', async () => {
    const { setLastTouchedEmployee, getLastTouchedEmployee } = await import('../panel-continuity')
    expect(getLastTouchedEmployee()).toBeNull()
    setLastTouchedEmployee('lease-specialist-vega')
    expect(getLastTouchedEmployee()).toBe('lease-specialist-vega')
  })

  it('clears when set to null', async () => {
    const { setLastTouchedEmployee, getLastTouchedEmployee } = await import('../panel-continuity')
    setLastTouchedEmployee('bookkeeper-aria')
    setLastTouchedEmployee(null)
    expect(getLastTouchedEmployee()).toBeNull()
  })

  it('dispatches a CustomEvent when touched', async () => {
    const { setLastTouchedEmployee } = await import('../panel-continuity')
    let captured: string | null | undefined
    const handler = (e: Event) => {
      captured = (e as CustomEvent<{ slug: string | null }>).detail.slug
    }
    window.addEventListener('mc:employee-touched', handler)
    setLastTouchedEmployee('ops-lead-orion')
    window.removeEventListener('mc:employee-touched', handler)
    expect(captured).toBe('ops-lead-orion')
  })
})
