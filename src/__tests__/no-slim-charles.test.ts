/**
 * Boundary guard — Slim Charles is Walt's PRIVATE personal assistant and must
 * NEVER exist in customer-facing Baseline Mission Control. It lives in Baseline
 * OS only.
 *
 * This test fails the build if any Slim branding, the private voice id, or
 * personal-assistant wiring re-enters mc-v8. The generic Agent Factory is
 * allowed (de-Slimmed, customer-safe).
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync, existsSync } from 'fs'
import { join, extname } from 'path'

const SKIP = new Set(['node_modules', '.git', '.next', '.data', 'dist', 'coverage'])
const TEXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.json', '.md'])
// The private voice id and personal-assistant branding that must not appear.
const FORBIDDEN = /\bslim charles\b|\bslim voice\b|\bslim agent\b|rWyjfFeMZ6PxkHqD3wGC|walt'?s (personal )?(voice )?assistant|oracle control system/i

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    if (SKIP.has(e) || e === '__tests__') continue // tests reference the name to assert its absence
    const p = join(dir, e)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (TEXT.has(extname(p)) && !p.includes('.test.')) out.push(p)
  }
  return out
}

describe('no Slim Charles in Mission Control', () => {
  it('has zero Slim branding / private voice id / personal-assistant copy in shipped code', () => {
    const hits = walk('src').filter((f) => FORBIDDEN.test(readFileSync(f, 'utf8')))
    expect(hits, `Slim Charles must not appear in Mission Control: ${hits.join(', ')}`).toEqual([])
  })

  it('exposes no customer-facing Slim route, panel, or api', () => {
    for (const p of [
      'src/components/panels/slim-charles-panel.tsx',
      'src/components/voice',
      'src/lib/voice',
      'src/app/api/voice',
    ]) {
      expect(existsSync(p), `${p} must not exist in Mission Control`).toBe(false)
    }
  })

  it('has no Slim nav item or parity surface', () => {
    const nav = readFileSync('src/components/layout/nav-rail.tsx', 'utf8')
    const surfaces = readFileSync('src/lib/parity/surfaces.ts', 'utf8')
    expect(nav).not.toMatch(/slim/i)
    expect(surfaces).not.toMatch(/slim/i)
  })

  it('keeps a GENERIC, de-Slimmed Agent Factory', () => {
    const panel = readFileSync('src/components/agent-factory/agent-factory-panel.tsx', 'utf8')
    expect(panel).toContain('agent-factory-panel')
    expect(panel).not.toMatch(/slim/i)
    expect(panel).not.toContain('rWyjfFeMZ6PxkHqD3wGC')
  })
})
