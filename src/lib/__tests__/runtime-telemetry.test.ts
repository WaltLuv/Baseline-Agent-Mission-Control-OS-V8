/**
 * Runtime telemetry adapter tests.
 *
 * The adapter is the default execution telemetry layer that every
 * runtime (Hermes, OpenClaw, Claude Code) imports. These tests pin:
 *   - it never throws (best-effort semantics)
 *   - it always returns `{ ok, status }`
 *   - it sends correct paths + headers + body shape
 *   - the `reportSkillExecution` convenience routes through the right endpoints
 */
import { describe, it, expect, vi } from 'vitest'
import {
  reportSkillEvent,
  reportEscalation,
  reportMemoryUse,
  reportCollaboration,
  reportOutcome,
  reportTokenUsage,
  reportSkillExecution,
  type TelemetryConfig,
} from '@/lib/runtime-telemetry'

function captureFetch() {
  const calls: Array<{ url: string; init: RequestInit }> = []
  const impl: typeof fetch = async (url, init) => {
    calls.push({ url: String(url), init: init as RequestInit })
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } })
  }
  return { impl, calls }
}

const baseConfig = (impl: typeof fetch): TelemetryConfig => ({
  baseUrl: 'https://mc.test',
  apiKey: 'k-1',
  fetchImpl: impl,
  timeoutMs: 1_000,
})

describe('runtime-telemetry adapter', () => {
  it('reportSkillEvent → POST /api/skills/event with x-api-key header', async () => {
    const { impl, calls } = captureFetch()
    const r = await reportSkillEvent(baseConfig(impl), {
      skillSlug: 'pdf-generation',
      agentSlug: 'phil',
      valueImpactCents: 7500,
      success: true,
    })
    expect(r.ok).toBe(true)
    expect(calls[0].url).toBe('https://mc.test/api/skills/event')
    expect(calls[0].init.method).toBe('POST')
    const headers = calls[0].init.headers as Record<string, string>
    expect(headers['x-api-key']).toBe('k-1')
    const body = JSON.parse(calls[0].init.body as string)
    expect(body.skillSlug).toBe('pdf-generation')
    expect(body.valueImpactCents).toBe(7500)
  })

  it('reportEscalation, reportMemoryUse, reportCollaboration, reportOutcome target the correct endpoints', async () => {
    const { impl, calls } = captureFetch()
    const cfg = baseConfig(impl)
    await reportEscalation(cfg, { agentSlug: 'phil', taskId: 12, reason: 'partner sign-off', severity: 'high', source: 'Obsidian' })
    await reportMemoryUse(cfg, { agentSlug: 'phil', source: 'Notion', title: 'SOP', excerpt: 'cadence …' })
    await reportCollaboration(cfg, { fromAgentSlug: 'phil', toAgentSlug: 'lena', reason: 'reconciliation handoff' })
    await reportOutcome(cfg, { agentSlug: 'phil', status: 'done', valueImpactCents: 4400, summary: 'Q1 closed' })
    expect(calls.map((c) => c.url)).toEqual([
      'https://mc.test/api/agents/escalation',
      'https://mc.test/api/agents/memory-use',
      'https://mc.test/api/agents/collaboration',
      'https://mc.test/api/agents/outcome',
    ])
  })

  it('reportTokenUsage hits the existing /api/tokens endpoint', async () => {
    const { impl, calls } = captureFetch()
    await reportTokenUsage(baseConfig(impl), { model: 'claude-3-5-sonnet', inputTokens: 1200, outputTokens: 400 })
    expect(calls[0].url).toBe('https://mc.test/api/tokens')
    const body = JSON.parse(calls[0].init.body as string)
    expect(body.model).toBe('claude-3-5-sonnet')
  })

  it('reportSkillExecution routes all sub-calls in order', async () => {
    const { impl, calls } = captureFetch()
    const out = await reportSkillExecution(baseConfig(impl), {
      skill: { skillSlug: 'pdf-generation', agentSlug: 'phil', success: true, valueImpactCents: 7500 },
      tokens: { model: 'claude-3-5-sonnet', inputTokens: 500, outputTokens: 200 },
      memory: { source: 'Obsidian', title: 'Q1 doctrine', agentSlug: 'phil' },
      outcome: { status: 'done', agentSlug: 'phil', valueImpactCents: 7500 },
    })
    expect(out.tokens?.ok).toBe(true)
    expect(out.skill?.ok).toBe(true)
    expect(out.memory?.ok).toBe(true)
    expect(out.outcome?.ok).toBe(true)
    expect(calls.map((c) => c.url)).toEqual([
      'https://mc.test/api/tokens',
      'https://mc.test/api/skills/event',
      'https://mc.test/api/agents/memory-use',
      'https://mc.test/api/agents/outcome',
    ])
  })

  it('never throws on a network failure — returns ok=false', async () => {
    const cfg: TelemetryConfig = {
      baseUrl: 'https://mc.test',
      fetchImpl: async () => {
        throw new Error('connection refused')
      },
    }
    const r = await reportSkillEvent(cfg, { skillSlug: 'x' })
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/refused/)
  })

  it('omits cookie + apiKey headers when none are configured', async () => {
    const { impl, calls } = captureFetch()
    await reportSkillEvent({ baseUrl: 'https://mc.test', fetchImpl: impl }, { skillSlug: 'x' })
    const headers = calls[0].init.headers as Record<string, string>
    expect(headers['x-api-key']).toBeUndefined()
    expect(headers['Cookie']).toBeUndefined()
  })

  it('aborts on timeout', async () => {
    vi.useFakeTimers()
    const cfg: TelemetryConfig = {
      baseUrl: 'https://mc.test',
      timeoutMs: 10,
      fetchImpl: ((_url, init) =>
        new Promise((_, reject) => {
          ;(init as RequestInit).signal?.addEventListener('abort', () => reject(new Error('aborted')))
        })) as typeof fetch,
    }
    const pending = reportSkillEvent(cfg, { skillSlug: 'x' })
    vi.advanceTimersByTime(20)
    const r = await pending
    expect(r.ok).toBe(false)
    vi.useRealTimers()
  })
})
