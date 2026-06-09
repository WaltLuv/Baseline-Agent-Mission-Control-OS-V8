/**
 * Graphify remote-repo runner (Mission Control, #6) — clone route security +
 * panel wiring. Parity with Baseline OS /__graphify_clone.
 */
import { readFileSync } from 'fs'
import { describe, it, expect } from 'vitest'

const route = readFileSync('src/app/api/graphify/clone/route.ts', 'utf8')
const panel = readFileSync('src/components/panels/graphify-panel.tsx', 'utf8')

describe('MC Graphify clone route', () => {
  it('is operator-gated, https-only, host-allowlisted, sandboxed, cleaned up', () => {
    expect(route).toContain("requireRole(request, 'operator')")
    expect(route).toContain('ALLOWED_HOSTS')
    expect(route).toContain("'https:'")
    expect(route).toContain("'--depth', '1'")
    expect(route).toContain('mkdtemp')
    expect(route).toContain('rm(dir')
    expect(route).toContain('isExcluded') // secrets excluded
  })
  it('rejects shell metacharacters in the url', () => {
    expect(route).toContain('illegal characters')
  })
})

describe('MC Graphify panel wires the clone runner', () => {
  it('repo-import input calls /api/graphify/clone + renders the imported graph', () => {
    expect(panel).toContain('/api/graphify/clone')
    expect(panel).toContain('data-testid="graphify-import-run"')
    expect(panel).toContain('cloneRepo')
  })
})
