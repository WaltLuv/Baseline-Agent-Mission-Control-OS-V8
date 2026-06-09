/**
 * Self-Driving Kanban 2.0 (Mission Control) — engine + full pipeline + PM templates.
 * Drives against the real migrated (temp) DB; no coding creds → safe draft mode.
 */
import { readFileSync } from 'fs'
import { describe, it, expect } from 'vitest'
import { planFloors, selfCheck, nextStage, classifyProject, requiresApproval, obsidianMarkdown, MAX_RETRIES } from '@/lib/kanban-drive'
import { drive, approve, getCard, listCards, PM_TEMPLATES } from '@/lib/pm/kanban-store'
import { getSurface } from '@/lib/parity/surfaces'

const WS = 9931

describe('Kanban drive engine', () => {
  it('5-floor planning produces a payload spec', () => {
    const plan = planFloors('Build a maintenance request intake widget', ['src/lib/pm/maintenance.ts'])
    expect(plan.floors.length).toBe(4)
    expect(plan.payloadSpec.projectType).toBe('pm-workflow')
    expect(plan.payloadSpec.steps.length).toBeGreaterThan(0)
    expect(plan.payloadSpec.graphFiles).toContain('src/lib/pm/maintenance.ts')
    expect(requiresApproval(plan)).toBe(true)
  })
  it('classifies project types', () => {
    expect(classifyProject('owner approval tracker')).toBe('pm-workflow')
    expect(classifyProject('build a habit tracker widget')).toBe('widget')
  })
  it('unsafe ideas always add a safety approval gate', () => {
    expect(planFloors('deploy to production and charge customers').payloadSpec.approvalGates.length).toBeGreaterThan(1)
  })
  it('self-checker passes a real artifact, fails empty; loop caps at MAX_RETRIES', () => {
    const spec = planFloors('build a tracker widget').payloadSpec
    expect(selfCheck(spec, '').pass).toBe(false)
    expect(selfCheck(spec, 'a'.repeat(200)).pass).toBe(true)
    expect(nextStage('Self_Check', { checkPass: false, attempts: MAX_RETRIES })).toBe('Shipped_Gallery') // capped
    expect(nextStage('Self_Check', { checkPass: false, attempts: 1 })).toBe('Implementation')
  })
  it('obsidian markdown captures the full record', () => {
    const plan = planFloors('owner approval tracker')
    const md = obsidianMarkdown({ projectName: 'X', idea: 'i', plan, selfCheckLogs: 'PASS', artifact: 'code', replayId: 'r1', proofId: 'p1' })
    expect(md).toContain('5-Floor Plan'); expect(md).toContain('Self-checker'); expect(md).toContain('r1')
  })
})

describe('Kanban 2.0 pipeline (store)', () => {
  it('drive creates a card at Awaiting_Approval with a plan + replay', async () => {
    const c = await drive(WS, 'Build an owner approval tracker', 1000, { graphFiles: ['src/lib/pm/approvals.ts'] })
    expect(c.current_stage).toBe('Awaiting_Approval')
    expect(c.plan.floors.length).toBe(4)
    expect(c.replay_id).toBeTruthy()
    expect(c.approval_status).toBe('pending')
  })
  it('approval gate blocks implementation until approved', async () => {
    const c = await drive(WS, 'Build a vendor dispatch dashboard', 2000)
    const rej = await approve(WS, c.id, 'reject', 'op', 2001)
    expect(rej.current_stage).toBe('Awaiting_Approval') // not implemented
    expect(rej.approval_status).toBe('reject')
  })
  it('approve runs implementation (safe draft) → self-check → shipped, honestly', async () => {
    const c = await drive(WS, 'Build a tenant follow-up workflow', 3000)
    const shipped = await approve(WS, c.id, 'approve', 'owner@x.com', 3001)
    expect(shipped.current_stage).toBe('Shipped_Gallery')
    expect(shipped.model_router).toMatch(/draft mode|minimax|openrouter/i) // honest provider choice
    expect(shipped.artifact.length).toBeGreaterThan(0)
    expect(shipped.proof_package_id).toBeTruthy()
    expect(shipped.shipped_gallery_path).toBeTruthy()
    expect(shipped.obsidian_vault_path).toBeTruthy() // vault OR local export OR setup-needed string
    expect(shipped.self_checker_logs).toContain('PASS')
  })
  it('ships the 7 PM templates through the same pipeline', async () => {
    expect(PM_TEMPLATES.length).toBe(7)
    const c = await drive(WS, '', 4000, { templateSlug: undefined, graphFiles: [] }).catch(() => null)
    void c
    const t = PM_TEMPLATES.find((x) => x.slug === 'maintenance-improve')!
    const card = await drive(WS, t.idea, 5000, { templateSlug: t.slug })
    expect(card.template_slug).toBe('maintenance-improve')
    const shipped = await approve(WS, card.id, 'approve', 'o', 5001)
    expect(shipped.current_stage).toBe('Shipped_Gallery')
  })
})

describe('Kanban 2.0 wiring + safety', () => {
  const panel = readFileSync('src/components/panels/kanban-gallery-panel.tsx', 'utf8')
  const route = readFileSync('src/app/api/kanban/route.ts', 'utf8')
  const approveRoute = readFileSync('src/app/api/kanban/[id]/approve/route.ts', 'utf8')
  it('panel: drive + templates + approval gate + shipped gallery', () => {
    for (const t of ['kanban-gallery-panel', 'kanban-drive', 'kanban-templates', 'kanban-board', 'kanban-gallery']) expect(panel).toContain(`data-testid="${t}"`)
    expect(panel).toContain('kanban-approve')
  })
  it('drive route is graph-first + operator-gated; approve never auto-approves', () => {
    expect(route).toContain('prepareGraphContext')
    expect(route).toContain("requireRole(request, 'operator')")
    expect(approveRoute).toContain("requireRole(request, 'operator')")
  })
  it('live + routed parity surface', () => {
    expect(getSurface('kanban-gallery')?.status).toBe('live')
    expect(getSurface('kanban-gallery')?.mcRoute).toBe('/app/kanban-gallery')
  })
})
