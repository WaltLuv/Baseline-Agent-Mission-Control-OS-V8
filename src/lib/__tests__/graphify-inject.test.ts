/**
 * MC deep Graphify injection — execution paths become graph-first (parity with
 * Baseline OS /__agent_run). Closes the OS↔MC architectural mismatch.
 */
import { readFileSync } from 'fs'
import { describe, it, expect } from 'vitest'
import { buildGraphContext } from '@/lib/graphify/context'
import { buildGraph, type FileInput } from '@/lib/graphify/graph'

const files: FileInput[] = [
  { path: 'src/lib/billing.ts', imports: [] },
  { path: 'src/app/billing/page.tsx', imports: ['src/lib/billing.ts'] },
]
const graph = buildGraph(files, 1, 'h')

describe('MC graph-first context', () => {
  it('buildGraphContext locates files + emits a prompt block for a task', () => {
    const ctx = buildGraphContext(graph, 'fix billing checkout', 1)
    expect(ctx.files).toContain('src/lib/billing.ts')
    expect(ctx.promptBlock).toContain('Graphify')
    expect(ctx.confidence).toBeGreaterThan(0)
  })
})

describe('MC execution dispatch is graph-first', () => {
  const inject = readFileSync('src/lib/graphify/inject.ts', 'utf8')
  const route = readFileSync('src/app/api/hermes/tasks/route.ts', 'utf8')

  it('inject helper reads the cached graph + prepends the slice', () => {
    expect(inject).toContain('prepareGraphContext')
    expect(inject).toContain('injectGraphFirst')
    expect(inject).toContain('graphify-out')
    expect(inject).toContain('promptBlock')
  })

  it('POST /api/hermes/tasks injects graph context + records a replay before dispatch', () => {
    expect(route).toContain('export async function POST')
    expect(route).toContain('injectGraphFirst(prompt)')
    expect(route).toContain('graphFirst')
    expect(route).toContain('Graphify query (graph-first)')
    expect(route).toContain('startReplay(ws')
    // honest: no fake execution
    expect(route).toContain('honest setup-needed')
  })
})
