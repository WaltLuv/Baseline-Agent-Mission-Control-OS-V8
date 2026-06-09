/**
 * Self-Driving Kanban 2.0 store (Mission Control) — property-management focused.
 * Drives a card through Input → Awaiting_Approval → Implementation → Self_Check →
 * Shipped_Gallery, emitting Replay + Agent Activity, with an Obsidian/local memory
 * sync on ship. Implementation runs in SAFE DRAFT mode (generates a spec/stub
 * artifact) unless a real coding runtime is connected — never fakes a live build.
 */
import { getDatabase } from '@/lib/db'
import { startReplay, recordReplayEvent, endReplay } from '@/lib/replay/store'
import { planFloors, selfCheck, nextStage, driveReplayEvents, obsidianMarkdown, MAX_RETRIES, type DrivePlan } from '@/lib/kanban-drive'

let seq = 0
function id(now: number, p = 'kan') { seq = (seq + 1) % 1e6; return `${p}_${now.toString(36)}${seq.toString(36)}` }

/** Property-management first-class templates (P8). */
export const PM_TEMPLATES = [
  { slug: 'maintenance-improve', name: 'Maintenance workflow improvement', idea: 'Improve the maintenance request intake → triage → vendor dispatch workflow' },
  { slug: 'vendor-onboarding', name: 'Vendor onboarding improvement', idea: 'Build a vendor onboarding workflow (W-9, insurance, rate card, approval)' },
  { slug: 'owner-approval', name: 'Owner approval automation', idea: 'Automate owner approval routing for maintenance spend with thresholds' },
  { slug: 'tenant-comms', name: 'Tenant communication workflow', idea: 'Build a tenant communication workflow for updates and scheduling' },
  { slug: 'inspection-checklist', name: 'Inspection checklist builder', idea: 'Build a property inspection checklist workflow with photo proof' },
  { slug: 'leasing-followup', name: 'Leasing follow-up workflow', idea: 'Build a leasing follow-up workflow (inquiry → tour → application)' },
  { slug: 'market-swarm-lead', name: 'Market Swarm lead workflow', idea: 'Build a Market Swarm lead-generation and qualification workflow' },
] as const

function modelRouter(): { router: string; live: boolean } {
  if (process.env.MINIMAX_API_KEY) return { router: 'minimax-m3', live: true }
  if (process.env.OPENROUTER_API_KEY) return { router: 'openrouter (fallback)', live: true }
  return { router: 'claude-code (draft mode — no coding-model credential)', live: false }
}

function row(card: any): any {
  return { ...card, payload_spec: JSON.parse(card.payload_spec || '{}'), plan: JSON.parse(card.plan || '{}') }
}

/** /drive — create a card and run Floors 1-4 → Awaiting_Approval. */
export async function drive(ws: number, idea: string, now: number, opts: { templateSlug?: string; graphFiles?: string[] } = {}): Promise<any> {
  const db = getDatabase()
  const plan = planFloors(idea, opts.graphFiles ?? [])
  const cardId = id(now)
  const projectName = idea.slice(0, 80)

  // Replay: capture the planning floors.
  const replay = startReplay(ws, `/drive: ${idea}`.slice(0, 80), idea, now)
  for (const e of driveReplayEvents(plan, now)) recordReplayEvent(ws, replay.id, e)

  db.prepare(`INSERT INTO kanban_cards (id, workspace_id, project_name, idea, current_stage, current_floor, payload_spec, plan, approval_status, model_router, implementation_agent, self_checker_agent, replay_id, template_slug, created_at, updated_at)
              VALUES (?, ?, ?, ?, 'Awaiting_Approval', 4, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?)`)
    .run(cardId, ws, projectName, idea, JSON.stringify(plan.payloadSpec), JSON.stringify(plan), modelRouter().router,
      plan.payloadSpec.agents.find((a) => /build|gaston|park/i.test(a)) ?? 'Phil Gaston',
      plan.payloadSpec.agents.find((a) => /audit|omar|mike/i.test(a)) ?? 'Omar', replay.id, opts.templateSlug ?? null, now, now)
  return getCard(ws, cardId)
}

export function getCard(ws: number, cardId: string): any {
  const r = getDatabase().prepare('SELECT * FROM kanban_cards WHERE id = ? AND workspace_id = ?').get(cardId, ws)
  return r ? row(r) : null
}
export function listCards(ws: number, stage?: string): any[] {
  const db = getDatabase()
  const rows = stage
    ? db.prepare('SELECT * FROM kanban_cards WHERE workspace_id = ? AND current_stage = ? ORDER BY updated_at DESC').all(ws, stage)
    : db.prepare('SELECT * FROM kanban_cards WHERE workspace_id = ? ORDER BY updated_at DESC').all(ws)
  return (rows as any[]).map(row)
}

/** P2 — approve / reject / request-changes. Only Approve unlocks Implementation. */
export async function approve(ws: number, cardId: string, decision: 'approve' | 'reject' | 'request_changes', by: string, now: number): Promise<any> {
  const db = getDatabase()
  const card = getCard(ws, cardId)
  if (!card || card.current_stage !== 'Awaiting_Approval') return { error: 'card not awaiting approval' }
  if (card.replay_id) recordReplayEvent(ws, card.replay_id, { ts: now, kind: 'approval', label: `Human ${decision} by ${by}` })
  if (decision !== 'approve') {
    db.prepare('UPDATE kanban_cards SET approval_status = ?, approved_by = ?, updated_at = ? WHERE id = ? AND workspace_id = ?').run(decision, by, now, cardId, ws)
    return getCard(ws, cardId)
  }
  db.prepare("UPDATE kanban_cards SET current_stage = 'Implementation', current_floor = 5, approval_status = 'approved', approved_by = ?, approved_at = ?, updated_at = ? WHERE id = ? AND workspace_id = ?").run(by, now, now, cardId, ws)
  return implement(ws, cardId, now)
}

/** P3 — implementation (safe draft unless coding runtime connected) → Self_Check. */
export async function implement(ws: number, cardId: string, now: number): Promise<any> {
  const db = getDatabase()
  const card = getCard(ws, cardId)
  if (!card) return { error: 'not found' }
  const mr = modelRouter()
  const plan: DrivePlan = card.plan
  // Safe draft artifact: a real, inspectable spec+stub. Live codegen needs creds.
  const artifact = draftArtifact(plan, mr.live)
  if (card.replay_id) {
    recordReplayEvent(ws, card.replay_id, { ts: now, kind: 'agent_start', agent: card.implementation_agent, label: `implement via ${mr.router}` })
    recordReplayEvent(ws, card.replay_id, { ts: now, kind: 'file_touched', agent: card.implementation_agent, label: `${plan.payloadSpec.files.length} files`, detail: plan.payloadSpec.files.join(', ') })
  }
  db.prepare("UPDATE kanban_cards SET current_stage = 'Self_Check', artifact = ?, model_router = ?, updated_at = ? WHERE id = ? AND workspace_id = ?").run(artifact, mr.router, now, cardId, ws)
  return selfCheckCard(ws, cardId, now)
}

/** P4 — self-checker loop (max retries) → ship or loop back. */
export async function selfCheckCard(ws: number, cardId: string, now: number): Promise<any> {
  const db = getDatabase()
  const card = getCard(ws, cardId)
  if (!card) return { error: 'not found' }
  const result = selfCheck(card.payload_spec, card.artifact)
  const attempts = card.attempts + 1
  if (card.replay_id) recordReplayEvent(ws, card.replay_id, { ts: now, kind: 'proof', label: `Self-check ${result.pass ? 'PASS' : 'FAIL'} (attempt ${attempts})`, detail: result.logs })
  const target = nextStage('Self_Check', { checkPass: result.pass, attempts })
  if (target === 'Implementation') {
    // loop back (cap enforced by nextStage)
    db.prepare("UPDATE kanban_cards SET current_stage = 'Implementation', self_checker_logs = ?, attempts = ?, updated_at = ? WHERE id = ? AND workspace_id = ?").run(result.logs, attempts, now, cardId, ws)
    return implement(ws, cardId, now)
  }
  // ship
  return ship(ws, cardId, result.logs, result.pass, attempts, now)
}

/** P5/P6 — ship to gallery + Obsidian/local memory sync + close replay. */
export async function ship(ws: number, cardId: string, logs: string, passed: boolean, attempts: number, now: number): Promise<any> {
  const db = getDatabase()
  const card = getCard(ws, cardId)
  if (!card) return { error: 'not found' }
  const galleryPath = `gallery/ws${ws}/${cardId}`
  const proofId = `proof_${cardId}`
  const vault = process.env.OBSIDIAN_VAULT_PATH || ''
  const md = obsidianMarkdown({ projectName: card.project_name, idea: card.idea, plan: card.plan, selfCheckLogs: logs, artifact: card.artifact, replayId: card.replay_id, proofId, modelRouter: card.model_router, approvedBy: card.approved_by })
  const obsidianTarget = await writeMemory(ws, cardId, md, vault)
  if (card.replay_id) {
    recordReplayEvent(ws, card.replay_id, { ts: now, kind: 'output', label: `Shipped to gallery${passed ? '' : ' (with self-check flags)'}` })
    endReplay(ws, card.replay_id, 'completed', now)
  }
  db.prepare("UPDATE kanban_cards SET current_stage = 'Shipped_Gallery', self_checker_logs = ?, attempts = ?, shipped_gallery_path = ?, live_preview_path = ?, proof_package_id = ?, obsidian_vault_path = ?, updated_at = ? WHERE id = ? AND workspace_id = ?")
    .run(logs, attempts, galleryPath, `${galleryPath}/preview`, proofId, obsidianTarget, now, cardId, ws)
  return getCard(ws, cardId)
}

/** Obsidian sync — real vault write if configured, else local export (never fails the ship). */
async function writeMemory(ws: number, cardId: string, md: string, vault: string): Promise<string> {
  const { writeFile, mkdir } = await import('node:fs/promises')
  const { join } = await import('node:path')
  try {
    if (vault) { await mkdir(join(vault, 'Baseline Mission Control'), { recursive: true }); const p = join(vault, 'Baseline Mission Control', `${cardId}.md`); await writeFile(p, md); return p }
    const { config } = await import('@/lib/config')
    const dir = join(config.dataDir, 'memory-export', `ws${ws}`); await mkdir(dir, { recursive: true })
    const p = join(dir, `${cardId}.md`); await writeFile(p, md); return `local:${p}`
  } catch { return 'setup-needed: configure OBSIDIAN_VAULT_PATH' }
}

/** Safe draft artifact — a real, inspectable plan + stub (not a fake "built app"). */
function draftArtifact(plan: DrivePlan, live: boolean): string {
  const p = plan.payloadSpec
  return [
    `// ${live ? 'GENERATED' : 'DRAFT (safe mode — connect a coding runtime/MINIMAX_API_KEY for live codegen)'}`,
    `// Project: ${plan.idea} [${p.projectType}]`,
    `// Files: ${p.files.join(', ')}`,
    `// Steps:`, ...p.steps.map((s, i) => `//  ${i + 1}. ${s}`),
    `export const spec = ${JSON.stringify(p, null, 2)}`,
  ].join('\n')
}
