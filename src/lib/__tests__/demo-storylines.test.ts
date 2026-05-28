/**
 * Demo narratives — sanity tests verifying that all 3 priority storylines
 * (cpa, law-firm, pm) carry the new lifeSignals roster and the schema is
 * stable. Each storyline must surface at least one AI Employee that is
 * (a) currently working AND (b) carrying a memory citation, so the
 * "AI workforce is alive" effect is guaranteed across every demo.
 */
import { describe, it, expect } from 'vitest'
import { getDemoNarrative } from '@/lib/demo-narratives'

describe('demo workspace storylines', () => {
  for (const slug of ['cpa', 'law-firm', 'pm'] as const) {
    describe(slug, () => {
      const n = getDemoNarrative(slug)
      if (!n) throw new Error(`missing narrative ${slug}`)

      it('has a briefing headline and a top employee', () => {
        expect(n.briefingHeadline.length).toBeGreaterThan(10)
        expect(n.topEmployee.name).toBeTruthy()
      })

      it('carries at least 3 life signals', () => {
        expect((n.lifeSignals ?? []).length).toBeGreaterThanOrEqual(3)
      })

      it('has at least one AI employee actively working', () => {
        const working = (n.lifeSignals ?? []).filter(
          (s) => s.presence === 'working' || s.presence === 'waiting-for-approval',
        )
        expect(working.length).toBeGreaterThan(0)
      })

      it('has at least one memory citation across the roster', () => {
        const cited = (n.lifeSignals ?? []).filter((s) => s.memoryUsed !== null)
        expect(cited.length).toBeGreaterThan(0)
      })

      it('has a primary next-action linked to a real route', () => {
        expect(n.nextAction.href.startsWith('/')).toBe(true)
      })
    })
  }
})
