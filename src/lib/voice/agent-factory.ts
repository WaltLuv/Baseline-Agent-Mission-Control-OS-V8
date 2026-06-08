/**
 * Agent Factory — voice-driven building.
 *
 * When Slim hears "build me a game / landing page / workflow / agent /
 * dashboard", it runs a real build pipeline: capture intent → write a project
 * brief → select an agent/team → generate a plan → request approval if needed →
 * dispatch the build → create files/app/workflow → show progress → produce a
 * proof package. No fabricated proof: a build is only `shipped` once a real
 * dispatch returns artifacts.
 */
import { classifyAction } from '@/lib/voice/permissions'

export type BuildKind = 'game' | 'landing-page' | 'workflow' | 'agent' | 'dashboard' | 'app'

export interface BuildIntent {
  kind: BuildKind
  /** Raw phrasing Slim heard, e.g. "build me a snake game". */
  utterance: string
  title: string
}

export const BUILD_STAGES = [
  'capture-intent',
  'project-brief',
  'select-team',
  'generate-plan',
  'approval',
  'dispatch',
  'create-artifacts',
  'progress',
  'proof',
] as const

export type BuildStage = (typeof BUILD_STAGES)[number]

const KIND_RX: { rx: RegExp; kind: BuildKind }[] = [
  { rx: /\bgame\b/i, kind: 'game' },
  { rx: /\b(landing|marketing)\s*page\b/i, kind: 'landing-page' },
  { rx: /\bworkflow\b/i, kind: 'workflow' },
  { rx: /\bagent\b/i, kind: 'agent' },
  { rx: /\bdashboard\b/i, kind: 'dashboard' },
]

/** Parse a "build me…" utterance into a typed intent, or null if not a build. */
export function parseBuildIntent(utterance: string): BuildIntent | null {
  if (!/\bbuild me\b|\bmake me\b|\bcreate (me )?a\b/i.test(utterance)) return null
  const match = KIND_RX.find((k) => k.rx.test(utterance))
  const kind: BuildKind = match?.kind ?? 'app'
  const title = utterance.replace(/.*\b(build|make|create)( me)?( a| an)?\b/i, '').trim() || kind
  return { kind, utterance, title }
}

/** Default team selection per build kind (maps to real agent roles). */
export function selectTeam(kind: BuildKind): string[] {
  switch (kind) {
    case 'game':
      return ['Maestro', 'Claude Code', 'QA']
    case 'landing-page':
      return ['Claude Code', 'Creative Studio', 'QA']
    case 'workflow':
      return ['Maestro', 'Orchestrator']
    case 'agent':
      return ['Orchestrator', 'Claude Code']
    case 'dashboard':
      return ['Claude Code', 'QA']
    default:
      return ['Claude Code']
  }
}

export interface ProjectBrief {
  intent: BuildIntent
  team: string[]
  plan: string[]
  /** Whether the build needs Walt's approval before dispatch. */
  requiresApproval: boolean
}

/**
 * A build dispatch is only auto-approved if every step is non-destructive. The
 * factory itself only ever scaffolds/creates (file-creation, app-scaffolding) —
 * those are auto-approvable — but if a plan step is destructive it escalates.
 */
export function buildBrief(intent: BuildIntent): ProjectBrief {
  const team = selectTeam(intent.kind)
  const plan = [
    `Define scope for ${intent.kind}: ${intent.title}`,
    'Scaffold project files',
    'Implement core functionality',
    'Self-test',
    'Produce proof package (files + run output)',
  ]
  // Scaffolding/creation is auto-approvable; nothing here deletes or deploys.
  const requiresApproval = classifyAction('app-scaffolding') !== 'auto'
  return { intent, team, plan, requiresApproval }
}

export interface BuildProof {
  brief: ProjectBrief
  artifacts: string[]
  /** shipped only once real artifacts exist — never fabricated. */
  shipped: boolean
  proofPackageId?: string
}

export function summarizeBuild(proof: BuildProof): string {
  return proof.shipped
    ? `Built ${proof.brief.intent.kind} "${proof.brief.intent.title}" — ${proof.artifacts.length} artifact(s).`
    : `Build "${proof.brief.intent.title}" planned — awaiting dispatch/artifacts.`
}
