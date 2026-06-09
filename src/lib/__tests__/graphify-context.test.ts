/**
 * Graphify runtime brain (MC parity, Phase 4.5) — PI-Agent context injection +
 * Structural Awareness panel.
 */
import { readFileSync } from 'fs'
import { describe, it, expect } from 'vitest'
import { buildGraph, type FileInput } from '@/lib/graphify/graph'
import { buildGraphContext } from '@/lib/graphify/context'

const files: FileInput[] = [
  { path: 'src/lib/auth.ts', imports: [] },
  { path: 'src/app/login/page.tsx', imports: ['src/lib/auth.ts'] },
]
const graph = buildGraph(files, 1, 'h')

describe('MC — PI Agent → Graphify context injection', () => {
  it('locates files + confidence + prompt block for a task', () => {
    const ctx = buildGraphContext(graph, 'fix auth login')
    expect(ctx.files).toContain('src/lib/auth.ts')
    expect(ctx.confidence).toBeGreaterThan(0)
    expect(ctx.promptBlock).toContain('Graphify')
  })
  it('emits PI Agent replay events; empty task → no injection', () => {
    expect(buildGraphContext(graph, 'auth', 1).replayEvents[0].agent).toBe('PI Agent')
    expect(buildGraphContext(graph, '').promptBlock).toBe('')
  })
})

describe('MC — Structural Awareness panel', () => {
  const activity = readFileSync('src/components/agent-activity.tsx', 'utf8')
  it('AgentActivity has aa-structural and queries /api/graphify', () => {
    expect(activity).toContain('testid="aa-structural"')
    expect(activity).toContain('/api/graphify')
    expect(activity).toContain('Graph brain connected')
  })
})
