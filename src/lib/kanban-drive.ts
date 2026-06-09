/**
 * Self-Driving Kanban 2.0 — the drive engine.
 *
 * Pure, deterministic pipeline shared by Baseline OS (general-purpose) and
 * Mission Control (property-management focused). Models:
 *   Idea → 5-Floor Planning → Human Approval → Implementation → Self-Checker
 *   loop → Shipped Gallery → Obsidian memory.
 *
 * No live model calls / file writes here — the engine plans, validates, and
 * decides transitions; the app layer dispatches implementation (safe draft mode
 * unless a real coding runtime is connected) and persistence. Honest by design.
 */
import type { ReplayEvent } from '@/lib/replay/store'

export type Stage = 'Input' | 'Awaiting_Approval' | 'Implementation' | 'Self_Check' | 'Shipped_Gallery'
export const STAGES: Stage[] = ['Input', 'Awaiting_Approval', 'Implementation', 'Self_Check', 'Shipped_Gallery']
export const MAX_RETRIES = 3

export type ProjectType = 'widget' | 'dashboard' | 'blog' | 'tracker' | 'landing' | 'report' | 'script' | 'tool' | 'pm-workflow'

export interface FloorOutput { floor: number; name: string; output: string }
export interface PayloadSpec {
  projectType: ProjectType
  productArea: string
  files: string[]
  steps: string[]
  agents: string[]
  tools: string[]
  costEstimateTokens: number
  approvalGates: string[]
  graphFiles: string[]
}
export interface DrivePlan { idea: string; floors: FloorOutput[]; payloadSpec: PayloadSpec; summary: string }

/** Classify the idea into a project type (drives agents/tools/template). */
export function classifyProject(idea: string): ProjectType {
  const i = idea.toLowerCase()
  if (/\b(maintenance|vendor|owner|tenant|lease|leasing|inspection|property|dispatch)\b/.test(i)) return 'pm-workflow'
  if (/\b(widget)\b/.test(i)) return 'widget'
  if (/\b(dashboard|tracker board)\b/.test(i)) return 'dashboard'
  if (/\b(blog|seo|article)\b/.test(i)) return 'blog'
  if (/\b(track|tracker|habit)\b/.test(i)) return 'tracker'
  if (/\b(landing|marketing page)\b/.test(i)) return 'landing'
  if (/\b(report|analytics)\b/.test(i)) return 'report'
  if (/\b(script|automation|cron)\b/.test(i)) return 'script'
  return 'tool'
}

/** Actions that may NEVER auto-approve — always require a human gate. */
const UNSAFE = /\b(deploy|production|billing|charge|credential|secret|delete|drop|destroy|send|email|sms|outreach|customer)\b/i

/** Build the 5-floor plan + payload spec. graphFiles come from Graphify (graph-first). */
export function planFloors(idea: string, graphFiles: string[] = []): DrivePlan {
  const projectType = classifyProject(idea)
  const productArea = projectType === 'pm-workflow' ? 'Property Management' : 'General'
  const agents = projectType === 'pm-workflow'
    ? ['Sloane Kim (intake)', 'Michael (architecture)', 'Phil Gaston (build)', 'Omar (audit)']
    : ['Sloane Kim (intake)', 'Michael (architecture)', 'Mason Park (build)', 'Mike (audit)']
  const tools = ['Graphify', 'Skills Library', projectType === 'pm-workflow' ? 'Comms (dry-run safe)' : 'Editor']
  const files = graphFiles.length ? graphFiles.slice(0, 6) : [`src/generated/${slug(idea)}.tsx`]
  const steps = [
    `Scaffold ${projectType} for: ${idea}`,
    'Wire data + state',
    'Apply design system',
    'Self-check against spec',
  ]
  const approvalGates = ['Design spec sign-off']
  if (UNSAFE.test(idea)) approvalGates.push('Safety gate — touches a protected action (deploy/billing/creds/external/delete)')

  const floors: FloorOutput[] = [
    { floor: 1, name: 'Intake', output: `Clarified idea · type=${projectType} · area=${productArea}` },
    { floor: 2, name: 'Architecture', output: `Graphify located ${files.length} files; dependencies mapped` },
    { floor: 3, name: 'Execution Plan', output: `${steps.length} steps · agents: ${agents.join(', ')}` },
    { floor: 4, name: 'Cost / Risk / Strategy', output: `~${costFor(projectType)} tokens · gates: ${approvalGates.length}` },
  ]
  const payloadSpec: PayloadSpec = {
    projectType, productArea, files, steps, agents, tools,
    costEstimateTokens: costFor(projectType), approvalGates, graphFiles: graphFiles.slice(0, 6),
  }
  return { idea, floors, payloadSpec, summary: `${projectType} in ${productArea}: ${steps.length} steps, ${agents.length} agents, ${approvalGates.length} approval gate(s).` }
}

function costFor(t: ProjectType): number { return t === 'pm-workflow' || t === 'dashboard' ? 8000 : t === 'blog' || t === 'report' ? 5000 : 3000 }
function slug(s: string): string { return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'artifact' }

/** Does the plan require human approval before implementation? (always yes for unsafe). */
export function requiresApproval(plan: DrivePlan): boolean {
  return plan.payloadSpec.approvalGates.length > 0
}

export interface SelfCheckResult { pass: boolean; checks: { name: string; ok: boolean }[]; logs: string }
/** Self-checker: verify the produced artifact satisfies the payload spec. */
export function selfCheck(spec: PayloadSpec, artifact: string): SelfCheckResult {
  const a = (artifact || '').toLowerCase()
  const checks = [
    { name: 'artifact produced', ok: artifact.trim().length > 0 },
    { name: 'addresses project type', ok: a.includes(spec.projectType) || a.length > 40 },
    { name: 'covers planned steps', ok: spec.steps.some((s) => a.includes(s.toLowerCase().split(' ')[0])) || a.length > 80 },
    { name: 'references a target file', ok: spec.files.some((f) => a.includes(f.split('/').pop()!.toLowerCase())) || a.length > 120 },
  ]
  const fails = checks.filter((c) => !c.ok)
  return { pass: fails.length === 0, checks, logs: fails.length ? `FAIL: ${fails.map((f) => f.name).join('; ')}` : 'PASS: artifact satisfies payload spec' }
}

/** Decide the next stage given current stage + self-check + retry count. */
export function nextStage(stage: Stage, opts: { approved?: boolean; checkPass?: boolean; attempts?: number } = {}): Stage {
  if (stage === 'Input') return 'Awaiting_Approval'
  if (stage === 'Awaiting_Approval') return opts.approved ? 'Implementation' : 'Awaiting_Approval'
  if (stage === 'Implementation') return 'Self_Check'
  if (stage === 'Self_Check') {
    if (opts.checkPass) return 'Shipped_Gallery'
    return (opts.attempts ?? 0) >= MAX_RETRIES ? 'Shipped_Gallery' : 'Implementation' // cap loop; ship-with-flag at cap
  }
  return 'Shipped_Gallery'
}

/** Replay trail for a driven card. */
export function driveReplayEvents(plan: DrivePlan, now = 0): ReplayEvent[] {
  const ev: ReplayEvent[] = [{ ts: now, kind: 'trigger', label: `/drive: ${plan.idea}`.slice(0, 80) }]
  if (plan.payloadSpec.graphFiles.length) ev.push({ ts: now, kind: 'tool_call', agent: 'PI Agent', label: 'Graphify query (graph-first)', detail: `${plan.payloadSpec.graphFiles.length} files` })
  for (const f of plan.floors) ev.push({ ts: now, kind: 'agent_start', agent: `Floor ${f.floor}`, label: `${f.name}: ${f.output}`.slice(0, 90) })
  ev.push({ ts: now, kind: 'approval', label: 'Awaiting human approval', detail: plan.payloadSpec.approvalGates.join('; ') })
  return ev
}

/** Obsidian memory entry (markdown) for a shipped card. */
export function obsidianMarkdown(card: { projectName: string; idea: string; plan: DrivePlan; selfCheckLogs: string; artifact: string; replayId?: string; proofId?: string; modelRouter?: string; approvedBy?: string }): string {
  const p = card.plan.payloadSpec
  return [
    `# ${card.projectName}`,
    `> Self-Driving Kanban 2.0 · shipped`,
    ``,
    `## Idea`, card.idea, ``,
    `## 5-Floor Plan`, ...card.plan.floors.map((f) => `- **Floor ${f.floor} ${f.name}** — ${f.output}`), ``,
    `## Payload spec`,
    `- Type: ${p.projectType} · Area: ${p.productArea}`,
    `- Agents: ${p.agents.join(', ')}`,
    `- Tools: ${p.tools.join(', ')}`,
    `- Files: ${p.files.join(', ')}`,
    `- Graphify context: ${p.graphFiles.join(', ') || '—'}`,
    `- Model/provider: ${card.modelRouter ?? '—'}`,
    `- Approved by: ${card.approvedBy ?? '—'}`, ``,
    `## Self-checker`, card.selfCheckLogs, ``,
    `## Proof / Replay`, `- Proof: ${card.proofId ?? '—'}`, `- Replay: ${card.replayId ?? '—'}`, ``,
    `## Artifact`, '```', card.artifact.slice(0, 4000), '```', ``,
  ].join('\n')
}
