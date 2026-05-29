/**
 * Dynamic Workflow Demo — pin the mission templates and stage contract.
 *
 * The visible demo is fed by deterministic data. These tests guard the
 * shape and the five-stage order so the simulated panel keeps matching
 * the architecture documented in docs/architecture/DYNAMIC_WORKFLOWS.md.
 */
import { describe, it, expect } from 'vitest'
import { MISSION_TEMPLATES, STAGE_ORDER, STAGE_LABELS } from '../../components/workforce/dynamic-workflow-demo'

describe('dynamic-workflow-demo data', () => {
  it('walks Command → Plan → Swarm → Verify → Keep, in order', () => {
    expect(STAGE_ORDER).toEqual(['command', 'plan', 'swarm', 'verify', 'keep'])
  })

  it('labels every stage with a non-empty display name', () => {
    for (const stage of STAGE_ORDER) {
      expect(STAGE_LABELS[stage], `label for ${stage}`).toBeTruthy()
    }
  })

  it('ships the three mandated mission templates', () => {
    const ids = MISSION_TEMPLATES.map((t) => t.id)
    expect(ids).toEqual(expect.arrayContaining(['sales-followup', 'audit-repo', 'cigar-retail']))
  })

  it('each template has at least 5 specialist participants', () => {
    for (const t of MISSION_TEMPLATES) {
      expect(t.agents.length, `${t.id} agents`).toBeGreaterThanOrEqual(5)
    }
  })

  it('every participant maps to a Baseline OS-coordinated runtime or to Mission Control', () => {
    const valid = new Set(['hermes', 'openclaw', 'claude', 'mission-control'])
    for (const t of MISSION_TEMPLATES) {
      for (const a of t.agents) {
        expect(valid.has(a.lane), `${t.id}/${a.id} → unknown lane ${a.lane}`).toBe(true)
      }
    }
  })

  it('every template names Hermes, OpenClaw/OpenCode, and Claude Code as first-class participants', () => {
    for (const t of MISSION_TEMPLATES) {
      const lanes = new Set(t.agents.map((a) => a.lane))
      expect(lanes.has('hermes'), `${t.id} missing Hermes`).toBe(true)
      expect(lanes.has('openclaw'), `${t.id} missing OpenClaw/OpenCode`).toBe(true)
      expect(lanes.has('claude'), `${t.id} missing Claude Code`).toBe(true)
    }
  })

  it('every template names a Mission Control verification judge', () => {
    for (const t of MISSION_TEMPLATES) {
      const hasJudge = t.agents.some((a) => a.lane === 'mission-control' && /judge|verification/i.test(a.name + ' ' + a.role))
      expect(hasJudge, `${t.id} missing a Mission Control verification judge`).toBe(true)
    }
  })

  it('each template has acceptance-criteria verification entries', () => {
    for (const t of MISSION_TEMPLATES) {
      expect(t.verification.length).toBeGreaterThanOrEqual(3)
      for (const v of t.verification) {
        expect(['pass', 'attention']).toContain(v.verdict)
      }
    }
  })

  it('each template lists concrete deliverables', () => {
    for (const t of MISSION_TEMPLATES) {
      expect(t.deliverables.length).toBeGreaterThan(0)
    }
  })
})
