/**
 * Hermes VPS pairing — state machine guarantees (task #105).
 *
 * The card's single source of truth. The hard rule Walt set: NEVER show
 * "connected" without a real heartbeat (a runtime_registry projection with
 * status 'healthy'). These tests pin every lifecycle state.
 */
import { describe, it, expect } from 'vitest'
import {
  deriveHermesVpsState,
  hermesVpsDot,
  HERMES_VPS_CAPABILITIES,
  HERMES_VPS_KIND,
  HERMES_VPS_ROLE,
} from '../hermes-vps-state'

const proj = (status: 'healthy' | 'warning' | 'critical' | 'offline') => ({ status })

describe('deriveHermesVpsState', () => {
  it('not paired: no projection, nothing minted', () => {
    expect(deriveHermesVpsState({ projection: null, minted: false })).toBe('not_paired')
  })

  it('token minted: key generated, not yet polling, no registry row', () => {
    expect(deriveHermesVpsState({ projection: null, minted: true, polling: false })).toBe('token_minted')
  })

  it('awaiting heartbeat: minted + polling, still no registry row', () => {
    expect(deriveHermesVpsState({ projection: null, minted: true, polling: true })).toBe('awaiting_heartbeat')
  })

  it('connected ONLY with a healthy heartbeat projection', () => {
    expect(deriveHermesVpsState({ projection: proj('healthy'), minted: true, polling: true })).toBe('connected')
  })

  it('stale on warning/offline projection', () => {
    expect(deriveHermesVpsState({ projection: proj('warning'), minted: false })).toBe('stale')
    expect(deriveHermesVpsState({ projection: proj('offline'), minted: false })).toBe('stale')
  })

  it('error on critical projection', () => {
    expect(deriveHermesVpsState({ projection: proj('critical'), minted: false })).toBe('error')
  })

  it('never reports connected without a projection, even when minted+polling', () => {
    const s = deriveHermesVpsState({ projection: null, minted: true, polling: true })
    expect(s).not.toBe('connected')
  })

  it('a registry projection wins over local minted state', () => {
    // Even right after minting, if the VPS is actually healthy, show connected.
    expect(deriveHermesVpsState({ projection: proj('healthy'), minted: false })).toBe('connected')
  })
})

describe('hermesVpsDot', () => {
  it('maps states to dot buckets', () => {
    expect(hermesVpsDot('connected')).toBe('connected')
    expect(hermesVpsDot('stale')).toBe('stale')
    expect(hermesVpsDot('awaiting_heartbeat')).toBe('stale')
    expect(hermesVpsDot('token_minted')).toBe('stale')
    expect(hermesVpsDot('error')).toBe('disconnected')
    expect(hermesVpsDot('not_paired')).toBe('not-configured')
  })
})

describe('Hermes VPS constants (Walt directive)', () => {
  it('identity matches the directive', () => {
    expect(HERMES_VPS_KIND).toBe('hermes-vps')
    expect(HERMES_VPS_ROLE).toBe('Primary Production Controller')
  })
  it('advertises the four required capabilities', () => {
    expect(HERMES_VPS_CAPABILITIES).toEqual([
      'production-controller',
      'pipelines',
      'agent-orchestration',
      'maintenance-pipelines',
    ])
  })
})
