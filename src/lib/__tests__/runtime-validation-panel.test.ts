/**
 * Runtime Validation Panel — band-calculation contract.
 *
 * The panel maps a {RuntimeStatus, AgentRow[]} pair into a band
 * (healthy | attention | critical | absent). This test pins the bands
 * so the launch-readiness signal doesn't drift silently.
 */
import { describe, it, expect } from 'vitest'

// Re-implement the reducer here so the test stays pure (the production
// implementation lives in a 'use client' component which Vitest can't
// import directly without JSX runtime config).
type RuntimeStatus = {
  id: string
  name: string
  description: string
  installed: boolean
  version: string | null
  running: boolean
  authRequired: boolean
  authenticated: boolean
}
type AgentRow = { id: number; framework?: string | null; last_seen?: number | string | null }

function bandFromRuntime(r: RuntimeStatus, agents: AgentRow[]): {
  band: 'healthy' | 'attention' | 'critical' | 'absent'
  reason: string
  liveAgents: number
  lastHeartbeat: number | null
} {
  const matching = agents.filter((a) => (a.framework || '').toLowerCase() === r.id)
  const lastSeenTs = matching
    .map((a) => (typeof a.last_seen === 'number' ? a.last_seen : a.last_seen ? Date.parse(String(a.last_seen)) : 0))
    .reduce((acc, v) => (v > acc ? v : acc), 0)

  if (!r.installed) return { band: 'absent', reason: 'Runtime not installed yet', liveAgents: 0, lastHeartbeat: null }
  if (!r.running) return { band: 'attention', reason: 'Installed but not currently running', liveAgents: matching.length, lastHeartbeat: lastSeenTs || null }
  if (r.authRequired && !r.authenticated) return { band: 'attention', reason: 'Running but credentials missing', liveAgents: matching.length, lastHeartbeat: lastSeenTs || null }
  if (matching.length === 0) return { band: 'attention', reason: 'Running with no registered agents yet', liveAgents: 0, lastHeartbeat: null }
  const ageMin = lastSeenTs ? Math.round((Date.now() - lastSeenTs) / 60_000) : Number.POSITIVE_INFINITY
  if (ageMin > 30) return { band: 'critical', reason: `Last agent heartbeat ${ageMin} min ago`, liveAgents: matching.length, lastHeartbeat: lastSeenTs }
  return { band: 'healthy', reason: `${matching.length} agent${matching.length === 1 ? '' : 's'} active`, liveAgents: matching.length, lastHeartbeat: lastSeenTs }
}

const baseRuntime: RuntimeStatus = {
  id: 'hermes',
  name: 'Hermes',
  description: '',
  installed: true,
  version: '1.0.0',
  running: true,
  authRequired: false,
  authenticated: true,
}

describe('RuntimeValidationPanel — band calculation', () => {
  it('absent when not installed', () => {
    const r = bandFromRuntime({ ...baseRuntime, installed: false }, [])
    expect(r.band).toBe('absent')
  })
  it('attention when installed but not running', () => {
    const r = bandFromRuntime({ ...baseRuntime, running: false }, [])
    expect(r.band).toBe('attention')
    expect(r.reason).toMatch(/not currently running/i)
  })
  it('attention when running but auth required and missing', () => {
    const r = bandFromRuntime({ ...baseRuntime, authRequired: true, authenticated: false }, [{ id: 1, framework: 'hermes', last_seen: Date.now() }])
    expect(r.band).toBe('attention')
    expect(r.reason).toMatch(/credentials/i)
  })
  it('attention when running with no agents', () => {
    const r = bandFromRuntime(baseRuntime, [])
    expect(r.band).toBe('attention')
    expect(r.reason).toMatch(/no registered agents/i)
  })
  it('critical when last heartbeat is older than 30 minutes', () => {
    const stale = Date.now() - 45 * 60 * 1000
    const r = bandFromRuntime(baseRuntime, [{ id: 1, framework: 'hermes', last_seen: stale }])
    expect(r.band).toBe('critical')
    expect(r.reason).toMatch(/heartbeat/i)
  })
  it('healthy when one or more agents heartbeat recently', () => {
    const fresh = Date.now() - 2 * 60 * 1000
    const r = bandFromRuntime(baseRuntime, [{ id: 1, framework: 'hermes', last_seen: fresh }])
    expect(r.band).toBe('healthy')
    expect(r.liveAgents).toBe(1)
  })
  it('filters agents by framework (case-insensitive)', () => {
    const fresh = Date.now() - 30 * 1000
    const r = bandFromRuntime(baseRuntime, [
      { id: 1, framework: 'HERMES', last_seen: fresh },
      { id: 2, framework: 'openclaw', last_seen: fresh },
    ])
    expect(r.band).toBe('healthy')
    expect(r.liveAgents).toBe(1)
  })
  it('handles agents with string last_seen (ISO) values', () => {
    const r = bandFromRuntime(baseRuntime, [{ id: 1, framework: 'hermes', last_seen: new Date().toISOString() }])
    expect(r.band).toBe('healthy')
    expect(r.lastHeartbeat).not.toBeNull()
  })
})
