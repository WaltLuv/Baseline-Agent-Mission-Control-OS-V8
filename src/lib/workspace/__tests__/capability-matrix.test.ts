/**
 * Workspace Capability Matrix — source of truth for execution readiness.
 * Workspace-scoped, real credential reads, honest runtime defaults, blockers +
 * fix actions on everything that isn't ready.
 */
import { describe, it, expect } from 'vitest'
import { computeCapabilityMatrix, capabilityReady } from '../capability-matrix'

const WS = 8200

describe('capability matrix', () => {
  const rows = computeCapabilityMatrix(WS, { now: 1000 })

  it('renders all capability groups', () => {
    const groups = new Set(rows.map((r) => r.group))
    expect(groups).toEqual(new Set(['core', 'runtimes', 'ecosystem', 'integrations']))
  })

  it('core MC capabilities are ready/workflow_ready', () => {
    expect(rows.find((r) => r.id === 'mc_native_workflows')!.status).toBe('workflow_ready')
    expect(rows.find((r) => r.id === 'pi_agent_harness')!.status).toBe('ready')
  })

  it('runtimes default to needs_runtime (NO fake connected state)', () => {
    for (const id of ['hermes', 'claude_code', 'codex', 'openclaw', 'opencode', 'browser_automation', 'computer_use']) {
      expect(rows.find((r) => r.id === id)!.status, id).toBe('needs_runtime')
    }
  })

  it('Flight Deck shows setup_needed without a paired online device, connected with one', () => {
    expect(computeCapabilityMatrix(WS, { now: 1 }).find((r) => r.id === 'flight_deck')!.status).toBe('setup_needed')
    expect(computeCapabilityMatrix(WS, { now: 1, flightDeckOnline: true }).find((r) => r.id === 'flight_deck')!.status).toBe('connected')
  })

  it('credential-backed integrations show needs_credentials when not connected', () => {
    // Fresh isolated workspace has no saved credentials.
    expect(rows.find((r) => r.id === 'stripe')!.status).toBe('needs_credentials')
    expect(rows.find((r) => r.id === 'twilio')!.status).toBe('needs_credentials')
  })

  it('every non-ready row carries a blocker + fix action + link', () => {
    for (const r of rows) {
      const ready = capabilityReady(rows, r.id)
      if (!ready) {
        expect(r.blocker, `${r.id} blocker`).toBeTruthy()
        // ecosystem/credential/runtime rows all expose a fix path
        expect(r.fixAction || r.link, `${r.id} fix`).toBeTruthy()
      }
    }
  })

  it('rows are workspace-scoped', () => {
    expect(rows.every((r) => r.workspaceId === WS)).toBe(true)
  })

  it('VoiceOps (no URL) is setup_needed in the ecosystem group', () => {
    expect(rows.find((r) => r.id === 'eco_voiceops')!.status).toBe('setup_needed')
  })
})
