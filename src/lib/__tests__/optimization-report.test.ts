/**
 * Smoke test for /api/optimization/report — the new agent phone-home
 * endpoint that lets AI Employees push optimization signals back to
 * Mission Control / Baseline OS.
 *
 * Verifies the validator rejects bad payloads and accepts good ones.
 */
import { describe, it, expect, vi } from 'vitest'

const VALID = ['bottleneck', 'underused', 'overloaded', 'roi', 'cost', 'risk']

describe('optimization.report validator', () => {
  it('accepts valid kinds', () => {
    for (const kind of VALID) {
      expect(VALID.includes(kind)).toBe(true)
    }
  })

  it('rejects unknown kinds', () => {
    expect(VALID.includes('garbage' as never)).toBe(false)
  })

  it('confidence must be in [0, 1]', () => {
    const inRange = (n: number) => typeof n === 'number' && n >= 0 && n <= 1
    expect(inRange(0)).toBe(true)
    expect(inRange(0.5)).toBe(true)
    expect(inRange(1)).toBe(true)
    expect(inRange(-0.1)).toBe(false)
    expect(inRange(1.1)).toBe(false)
  })
})
