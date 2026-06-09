/**
 * Phases 1–3 — workforce auto-generation, Agent Factory sync, Replay model.
 * Pure generator + (in-memory sqlite) store behavior; idempotency proven.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { orgPlanFromTemplate, GENERATABLE_SLUGS } from '@/lib/org-chart/from-template'

describe('Phase 1 — workforce → org auto-generation (pure)', () => {
  it('generates an org plan for every supported slug', () => {
    for (const slug of GENERATABLE_SLUGS) {
      const plan = orgPlanFromTemplate(slug)
      expect(plan.length, `no plan for ${slug}`).toBeGreaterThan(0)
      expect(plan.filter((e) => e.isLead).length, `${slug} needs exactly one lead`).toBe(1)
      for (const e of plan) {
        expect(e.input.category).toBe(`template:${slug}`) // idempotency key
        expect(e.input.name.length).toBeGreaterThan(0)
        expect(Array.isArray(e.input.skills)).toBe(true)
        expect(e.input.memoryAccess).toContain('workspace')
        expect((e.input.runtime ?? '').length).toBeGreaterThan(0)
      }
    }
  })

  it('covers all 11 verticals + the 4 ops directives (15 total)', () => {
    expect(GENERATABLE_SLUGS.length).toBe(15)
    for (const ops of ['visionops', 'voiceops', 'propcontrol', 'market-swarm']) {
      expect(orgPlanFromTemplate(ops).length).toBeGreaterThan(0)
    }
  })

  it('lead is in Leadership & Orchestration; reports get the vertical department', () => {
    const plan = orgPlanFromTemplate('property-management')
    expect(plan[0].input.department).toBe('Leadership & Orchestration')
    expect(plan.slice(1).every((e) => (e.input.department ?? '').length > 0)).toBe(true)
  })

  it('unknown slug yields an empty plan (no fabrication)', () => {
    expect(orgPlanFromTemplate('not-a-real-slug')).toEqual([])
  })
})

describe('Phase 1/2 — store generation + factory sync (idempotent, workspace-scoped)', () => {
  let store: typeof import('@/lib/org-chart/store')
  beforeEach(async () => {
    // Fresh in-memory DB per test via the test harness DB.
    store = await import('@/lib/org-chart/store')
  })

  it('generateOrgFromTemplate is idempotent (reinstall creates no duplicates)', () => {
    const ws = 9001
    // clean slate for this workspace
    for (const a of store.listOrgAgents(ws, true)) store.deleteOrgAgent(ws, a.id)
    const first = store.generateOrgFromTemplate(ws, 'cpa', Date.now())
    expect(first.created).toBeGreaterThan(0)
    const second = store.generateOrgFromTemplate(ws, 'cpa', Date.now())
    expect(second.created).toBe(0) // all skipped on reinstall
    expect(second.skipped).toBe(first.created)
    // reports wired to the lead
    const agents = store.listOrgAgents(ws, true).filter((a) => a.category === 'template:cpa')
    const lead = agents.find((a) => !a.managerId)
    expect(lead).toBeTruthy()
    expect(agents.filter((a) => a.managerId === lead!.id).length).toBeGreaterThan(0)
  })

  it('Agent Factory sync upserts then archives without orphan/dupe', () => {
    const ws = 9002
    for (const a of store.listOrgAgents(ws, true)) store.deleteOrgAgent(ws, a.id)
    const a1 = store.syncFactoryAgent(ws, { name: 'Recon Bot', role: 'Researcher', runtime: 'claude-code' }, Date.now())
    expect(a1.created).toBe(true)
    const a2 = store.syncFactoryAgent(ws, { name: 'Recon Bot', role: 'Lead Researcher' }, Date.now())
    expect(a2.created).toBe(false) // same agent updated, not duplicated
    expect(a2.id).toBe(a1.id)
    expect(store.listOrgAgents(ws, false).filter((a) => a.name === 'Recon Bot').length).toBe(1)
    expect(store.removeFactoryAgent(ws, 'Recon Bot', Date.now())).toBe(true)
    expect(store.listOrgAgents(ws, false).some((a) => a.name === 'Recon Bot')).toBe(false) // archived → not active
  })
})

describe('Phase 3 — Workforce Replay data model', () => {
  it('captures trigger → events → outputs → completion', async () => {
    const replay = await import('@/lib/replay/store')
    const ws = 9003
    const r = replay.startReplay(ws, 'Tenant maintenance request', 'PropControl work order', Date.now())
    expect(r.events[0].kind).toBe('trigger')
    replay.recordReplayEvent(ws, r.id, { ts: Date.now(), kind: 'agent_start', agent: 'Work Order Manager', label: 'started' })
    replay.recordReplayEvent(ws, r.id, { ts: Date.now(), kind: 'tool_call', agent: 'Vendor Matcher', label: 'vendor:lookup' })
    replay.recordReplayEvent(ws, r.id, { ts: Date.now(), kind: 'approval', label: 'owner approval requested' })
    replay.recordReplayEvent(ws, r.id, { ts: Date.now(), kind: 'output', label: 'work-order.pdf' })
    const done = replay.endReplay(ws, r.id, 'completed', Date.now())!
    expect(done.status).toBe('completed')
    expect(done.agents).toEqual(expect.arrayContaining(['Work Order Manager', 'Vendor Matcher']))
    expect(done.outputs).toContain('work-order.pdf')
    expect(done.events.some((e) => e.kind === 'approval')).toBe(true)
    expect(done.events[done.events.length - 1].kind).toBe('complete')
  })
})
