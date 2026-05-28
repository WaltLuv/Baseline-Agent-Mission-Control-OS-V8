/**
 * Briefing motion — sanity tests for the count-up easing math used by
 * `CountUp`. The visual rendering is verified by screenshots of
 * `/app/overview` — this guards the easing function so we never ship a
 * counter that overshoots or undershoots the target value.
 */
import { describe, it, expect } from 'vitest'

// Mirror of the easeOutCubic used inside CountUp.
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3)

describe('CountUp easing', () => {
  it('starts at 0', () => {
    expect(easeOutCubic(0)).toBe(0)
  })

  it('ends at 1', () => {
    expect(easeOutCubic(1)).toBe(1)
  })

  it('is monotonically increasing', () => {
    let prev = -Infinity
    for (let i = 0; i <= 10; i++) {
      const v = easeOutCubic(i / 10)
      expect(v).toBeGreaterThanOrEqual(prev)
      prev = v
    }
  })

  it('never exceeds the target', () => {
    for (let i = 0; i <= 20; i++) {
      const t = i / 20
      expect(easeOutCubic(t)).toBeLessThanOrEqual(1)
    }
  })

  it('interpolates a target value monotonically', () => {
    const from = 0
    const to = 1234
    let prev = -Infinity
    for (let i = 0; i <= 10; i++) {
      const v = from + (to - from) * easeOutCubic(i / 10)
      expect(v).toBeGreaterThanOrEqual(prev)
      expect(v).toBeLessThanOrEqual(to)
      prev = v
    }
  })
})
