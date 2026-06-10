import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * P0 regression guard: the `/app/activate` page MUST be scrollable.
 *
 * Root cause of the original break: `src/app/app/layout.tsx` wrapped every
 * `/app/*` route in a hardcoded `h-screen overflow-hidden` div, bypassing
 * `AppShellFrame` — which traps the tall activation page and hides workforce
 * options below the fold. These assertions lock the fix in the fast suite so a
 * full browser run isn't required to catch a regression.
 */
const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')

describe('Activation page is scrollable (P0)', () => {
  const layout = read('src/app/app/layout.tsx')
  const frame = read('src/components/layout/app-shell-frame.tsx')
  const hub = read('src/components/activation/activation-hub.tsx')

  it('app layout uses AppShellFrame (not a hardcoded scroll trap)', () => {
    expect(layout).toContain('<AppShellFrame>')
    expect(layout).toContain("from '@/components/layout/app-shell-frame'")
    // The exact regression: a hardcoded clip wrapper must NOT be the layout.
    expect(layout).not.toMatch(/<div className="h-screen overflow-hidden">\{children\}<\/div>/)
  })

  it('AppShellFrame puts /app/activate in document scroll mode', () => {
    expect(frame).toContain("pathname === '/app/activate'")
    expect(frame).toContain("data-scroll-mode={isActivationFlow ? 'document' : 'locked'}")
    // activation flow = min-h-screen (grows + document-scrolls), not viewport-locked.
    expect(frame).toContain("isActivationFlow ? 'min-h-screen'")
  })

  it('the dashboard (locked) mode keeps its viewport lock — no dashboard regression', () => {
    expect(frame).toContain("'h-screen overflow-hidden'")
  })

  it('ActivationHub root grows (min-h-screen), not a clipped fixed height', () => {
    expect(hub).toContain('min-h-screen')
    expect(hub).not.toContain('h-screen overflow-y-auto') // band-aid removed; frame handles scroll
  })
})

describe('Property Management is the obvious primary path', () => {
  const installer = read('src/components/activation/workforce-installer.tsx')

  it('sorts Property Management first', () => {
    expect(installer).toContain("a.slug === 'property-management' ? -1")
  })

  it('auto-selects Property Management on load', () => {
    expect(installer).toContain("t.slug === 'property-management'")
    expect(installer).toContain('setSelected(flag.slug)')
  })

  it('exposes a clear PM install button + collapses secondary verticals', () => {
    expect(installer).toContain('workforce-install-') // Install {vertical} Workforce →
    expect(installer).toContain('Install {tmpl.vertical} Workforce')
    expect(installer).toContain('workforce-more-templates') // secondary verticals collapsed
  })
})
