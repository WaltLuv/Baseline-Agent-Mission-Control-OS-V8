/**
 * Hermes hook template — Iteration 17 extension.
 *
 * Verifies the embedded `HANDLER_PY` template now implements:
 *   - the operational telemetry events the runtime-hook-integration doc
 *     promises (task:complete, skill:used, skill:escalated, memory:cited,
 *     agent:handoff)
 *   - never-raise contract — every POST goes through `_post()` which
 *     swallows exceptions
 *   - all new endpoints from iteration 15/16 are referenced (`/api/skills/event`,
 *     `/api/agents/escalation`, `/api/agents/memory-use`, `/api/agents/collaboration`,
 *     `/api/agents/outcome`)
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const source = readFileSync(resolve(process.cwd(), 'src/app/api/hermes/route.ts'), 'utf8')

describe('Hermes hook template — operational telemetry extension', () => {
  it('declares the new event names in HOOK.yaml', () => {
    for (const evt of ['task:complete', 'skill:used', 'skill:escalated', 'memory:cited', 'agent:handoff']) {
      expect(source).toContain(evt)
    }
  })

  it('routes each new event to a dedicated reporter', () => {
    expect(source).toContain('_report_task_outcome')
    expect(source).toContain('_report_skill_used')
    expect(source).toContain('_report_escalation')
    expect(source).toContain('_report_memory_use')
    expect(source).toContain('_report_collaboration')
  })

  it('targets the iteration-15/16 endpoints exactly', () => {
    for (const path of [
      '/api/skills/event',
      '/api/agents/outcome',
      '/api/agents/escalation',
      '/api/agents/memory-use',
      '/api/agents/collaboration',
    ]) {
      expect(source).toContain(path)
    }
  })

  it('funnels all POSTs through a never-raise helper', () => {
    expect(source).toContain('async def _post(')
    expect(source).toContain('Never raises')
  })

  it('uses workforce-friendly memory source labels (no vector jargon)', () => {
    expect(source).toContain('"Obsidian"')
    expect(source).toContain('"Notion"')
    expect(source).toContain('"Pinecone"')
    expect(source).not.toContain('vector_namespace')
    expect(source).not.toContain('embedding_index')
  })
})
