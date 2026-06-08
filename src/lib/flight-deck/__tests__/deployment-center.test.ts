/**
 * Flight Deck deployment center — pairing, honest runtime freshness, updates,
 * health, DFY checklist, handoff report.
 */
import { describe, it, expect } from 'vitest'
import {
  PAIR_TARGETS, deriveRuntimeFreshness, lastSeenLabel, freshnessLabel,
  UPDATE_COMPONENTS, HEALTH_CHECKS, PROOF_TYPES, DFY_CHECKLIST, dfyProgress,
  buildHandoffReport, FIREWALL_CHECKLIST, INFRA_TARGETS,
} from '@/lib/flight-deck/deployment-center'

describe('Flight Deck — Pair', () => {
  it('covers every pairing target', () => {
    const ids = PAIR_TARGETS.map((t) => t.id)
    for (const id of ['mission-control', 'baseline-os', 'claude-code', 'codex', 'openclaw', 'hermes', 'hermes-vps', 'oh-my-pi', 'browser-use']) {
      expect(ids, `pair target missing: ${id}`).toContain(id)
    }
    expect(PAIR_TARGETS.find((t) => t.id === 'hermes-vps')?.method).toBe('vps-key')
  })
})

describe('Flight Deck — runtime freshness (no fake heartbeat)', () => {
  const now = 1_000_000_000
  it('connected when seen recently', () => {
    expect(deriveRuntimeFreshness(now - 30_000, now)).toBe('connected')
  })
  it('stale when older than 2 min', () => {
    expect(deriveRuntimeFreshness(now - 5 * 60_000, now)).toBe('stale')
  })
  it('disconnected when never seen or very old', () => {
    expect(deriveRuntimeFreshness(null, now)).toBe('disconnected')
    expect(deriveRuntimeFreshness(now - 60 * 60_000, now)).toBe('disconnected')
  })
  it('honest last-seen labels', () => {
    expect(lastSeenLabel(null, now)).toBe('never')
    expect(lastSeenLabel(now - 45_000, now)).toBe('45s ago')
    expect(freshnessLabel('stale')).toBe('Stale')
  })
})

describe('Flight Deck — Updates / Infra / Health / Proof', () => {
  it('update components carry update + rollback commands', () => {
    expect(UPDATE_COMPONENTS.map((u) => u.id)).toContain('mission-control')
    for (const u of UPDATE_COMPONENTS) {
      expect(u.updateCommand.length).toBeGreaterThan(0)
      expect(u.rollback.length).toBeGreaterThan(0)
    }
  })
  it('infra targets + firewall checklist + health checks + proof types exist', () => {
    expect(INFRA_TARGETS.map((i) => i.id)).toEqual(['local', 'vps', 'cloud-mc', 'docker'])
    expect(FIREWALL_CHECKLIST.some((c) => /SSH/.test(c))).toBe(true)
    expect(HEALTH_CHECKS.map((h) => h.id)).toContain('orchestration')
    expect(HEALTH_CHECKS.map((h) => h.id)).toContain('mirror-sync')
    expect(PROOF_TYPES).toContain('runtime-heartbeat')
    expect(PROOF_TYPES).toContain('deployment')
  })
})

describe('Flight Deck — Done-For-You checklist', () => {
  it('has all 14 setup steps', () => {
    expect(DFY_CHECKLIST.length).toBe(14)
    for (const id of ['workspace', 'email-verified', 'workforce-selected', 'baseline-installed', 'runtimes-paired', 'hermes-vps-paired', 'first-task', 'daily-brief', 'roi', 'handoff']) {
      expect(DFY_CHECKLIST.map((s) => s.id)).toContain(id)
    }
  })
  it('computes honest progress from real signals', () => {
    const p = dfyProgress({ workspace: true, emailVerified: true, workforceSelected: true })
    expect(p.total).toBe(14)
    expect(p.done).toBe(3)
    expect(p.steps.find((s) => s.step.id === 'workspace')?.done).toBe(true)
    expect(p.steps.find((s) => s.step.id === 'roi')?.done).toBe(false)
  })
})

describe('Flight Deck — customer handoff report', () => {
  it('builds a structured exportable report', () => {
    const r = buildHandoffReport({
      workspace: 'Acme', generatedAt: 123,
      installedWorkforces: ['property-management'], connectedRuntimes: ['claude-code'],
      connectedCredentials: ['openai'], creditBalance: 5000,
      versions: { 'mission-control': 'v1' }, health: { api: 'ok' },
      nextSteps: ['Queue first task'], supportNotes: 'n/a',
    })
    expect(r.workspace).toBe('Acme')
    expect(r.installedWorkforces).toEqual(['property-management'])
    expect(r.creditBalance).toBe(5000)
    expect(r.versions['mission-control']).toBe('v1')
    expect(r.health.api).toBe('ok')
    expect(r.generatedAt).toBe(123)
  })
  it('defaults missing fields to honest empties', () => {
    const r = buildHandoffReport({ workspace: 'X', generatedAt: 1 })
    expect(r.installedWorkforces).toEqual([])
    expect(r.creditBalance).toBe(0)
  })
})
