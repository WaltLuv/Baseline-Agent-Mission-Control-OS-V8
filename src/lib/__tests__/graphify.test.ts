/**
 * Graphify (Mission Control) — engine parity + wiring + graph-first rule.
 */
import { readFileSync } from 'fs'
import { describe, it, expect } from 'vitest'
import { buildGraph, queryGraph, godNodes, isExcluded, type FileInput } from '@/lib/graphify/graph'
import { getSurface } from '@/lib/parity/surfaces'

const files: FileInput[] = [
  { path: 'src/lib/auth.ts', imports: [] },
  { path: 'src/app/login/page.tsx', imports: ['src/lib/auth.ts'] },
  { path: 'src/app/api/users/route.ts', imports: ['src/lib/auth.ts'] },
]

describe('Graphify engine (MC parity)', () => {
  it('builds + queries + finds god nodes', () => {
    const g = buildGraph(files, 1, 'h')
    expect(g.edges.length).toBe(2)
    expect(queryGraph(g, 'auth').some((n) => n.path === 'src/lib/auth.ts')).toBe(true)
    expect(godNodes(g)[0].node.path).toBe('src/lib/auth.ts')
  })
  it('excludes secrets from ingestion', () => {
    expect(isExcluded('src/.env.local')).toBe(true)
    expect(isExcluded('src/lib/auth.ts')).toBe(false)
  })
})

describe('Graphify MC wiring + parity', () => {
  const panel = readFileSync('src/components/panels/graphify-panel.tsx', 'utf8')
  const api = readFileSync('src/app/api/graphify/route.ts', 'utf8')
  const router = readFileSync('src/app/app/[[...panel]]/page.tsx', 'utf8')
  const nav = readFileSync('src/components/layout/nav-rail.tsx', 'utf8')
  const claudemd = readFileSync('CLAUDE.md', 'utf8')

  it('panel has dashboard/query/explorer/deps/import', () => {
    for (const t of ['graphify-panel', 'graphify-dashboard', 'graphify-query', 'graphify-explorer', 'graphify-deps', 'graphify-import']) {
      expect(panel, `missing ${t}`).toContain(`data-testid="${t}"`)
    }
  })
  it('API is auth-gated, cacheable, secret-excluding', () => {
    expect(api).toContain("requireRole(request, 'viewer')")
    expect(api).toContain('graphify-out')
    expect(api).toContain('isExcluded')
  })
  it('routed + nav-visible + parity surface + graph-first CLAUDE.md rule', () => {
    expect(router).toContain("case 'graphify'")
    expect(nav).toContain("id: 'graphify'")
    expect(getSurface('graphify')?.mcRoute).toBe('/app/graphify')
    expect(claudemd).toContain('Graph-first rule')
    expect(claudemd).toContain('/api/graphify?q=')
  })
})
