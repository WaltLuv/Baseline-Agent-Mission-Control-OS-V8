/**
 * Regression: the root layout MUST NOT trap scroll for marketing/auth pages.
 *
 * The original bug: `/app/src/app/layout.tsx` wrapped every page in
 * `<div className="h-screen overflow-hidden">`, which made the long
 * marketing homepage non-scrollable (body height clipped to 100vh, mouse
 * wheel did nothing).
 *
 * The fix: keep the root layout neutral, and apply `h-screen overflow-hidden`
 * only to the authenticated dashboard via `/app/src/app/app/layout.tsx`.
 *
 * This test guards the fix by statically inspecting the layout files. It is
 * intentionally cheap so it runs as part of the standard vitest suite — no
 * browser, no headless server.
 */
import { readFileSync } from 'fs'
import { describe, it, expect } from 'vitest'

describe('Homepage scroll regression — layout wrapper shape', () => {
  it('root layout does NOT lock viewport height (would break /, /login, /signup, /pricing, /marketplace, etc.)', () => {
    const root = readFileSync('src/app/layout.tsx', 'utf8')
    // The inner content wrapper inside <body> must not carry `h-screen`
    // or `overflow-hidden`. Both classes together cause the bug.
    const wrapperLine = root.split('\n').find((l) => l.includes('bg-background text-foreground'))
    expect(wrapperLine, 'root layout content wrapper not found').toBeDefined()
    expect(wrapperLine!).not.toMatch(/\bh-screen\b/)
    expect(wrapperLine!).not.toMatch(/\boverflow-hidden\b/)
  })

  it('authenticated /app dashboard DOES preserve viewport lock (panels manage their own scroll)', () => {
    const appLayout = readFileSync('src/app/app/layout.tsx', 'utf8')
    expect(appLayout).toMatch(/\bh-screen\b/)
    expect(appLayout).toMatch(/\boverflow-hidden\b/)
  })

  it('public marketing pages still declare `min-h-screen` (sanity check — they expect to scroll)', () => {
    const home = readFileSync('src/app/page.tsx', 'utf8')
    expect(home).toMatch(/\bmin-h-screen\b/)
    const signup = readFileSync('src/app/signup/page.tsx', 'utf8')
    expect(signup).toMatch(/\bmin-h-screen\b/)
  })
})
