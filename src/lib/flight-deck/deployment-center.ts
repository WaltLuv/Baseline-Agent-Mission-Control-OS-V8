/**
 * Flight Deck — Deployment Control Tower model.
 *
 * Flight Deck is the infrastructure/deployment control center: install, pair,
 * runtimes, infrastructure, updates, health, proof, and done-for-you setup.
 * Truth-first: no fake download links, no fake heartbeats, no fake proof. Every
 * state is derived from real signals or shown as pending/setup-needed.
 */

// ── Pair ────────────────────────────────────────────────────────────
export interface PairTarget {
  id: string
  label: string
  method: 'pairing-token' | 'runtime-key' | 'cli' | 'vps-key'
  instructions: string
}

export const PAIR_TARGETS: PairTarget[] = [
  { id: 'mission-control', label: 'Mission Control', method: 'pairing-token', instructions: 'Generate a pairing token in Mission Control and paste it into Flight Deck.' },
  { id: 'baseline-os', label: 'Baseline OS', method: 'pairing-token', instructions: 'Pair the local Baseline OS instance with this workspace.' },
  { id: 'claude-code', label: 'Claude Code', method: 'runtime-key', instructions: 'Mint a runtime key and configure the Claude Code MCP server.' },
  { id: 'codex', label: 'Codex', method: 'runtime-key', instructions: 'Mint a runtime key and connect the Codex runtime.' },
  { id: 'openclaw', label: 'OpenClaw', method: 'runtime-key', instructions: 'Mint a runtime key and connect the OpenClaw runtime.' },
  { id: 'hermes', label: 'Hermes', method: 'runtime-key', instructions: 'Mint a runtime key and connect the Hermes runtime.' },
  { id: 'hermes-vps', label: 'Hermes VPS', method: 'vps-key', instructions: 'Pair the production VPS controller via the runtime-key flow (no SSH stored in-app).' },
  { id: 'oh-my-pi', label: 'Oh My Pi', method: 'runtime-key', instructions: 'Mint a runtime key and connect the OMP runtime.' },
  { id: 'browser-use', label: 'Browser Use', method: 'cli', instructions: 'Connect a local Browser Use runtime via Flight Deck CLI.' },
]

// ── Runtimes — honest freshness ─────────────────────────────────────
export type RuntimeFreshness = 'connected' | 'stale' | 'disconnected'

export function deriveRuntimeFreshness(lastSeenMs: number | null, nowMs: number): RuntimeFreshness {
  if (!lastSeenMs) return 'disconnected'
  const age = nowMs - lastSeenMs
  if (age < 2 * 60_000) return 'connected'
  if (age < 30 * 60_000) return 'stale'
  return 'disconnected'
}

export function freshnessLabel(f: RuntimeFreshness): string {
  return f === 'connected' ? 'Connected' : f === 'stale' ? 'Stale' : 'Disconnected'
}

export function lastSeenLabel(lastSeenMs: number | null, nowMs: number): string {
  if (!lastSeenMs) return 'never'
  const s = Math.max(0, Math.round((nowMs - lastSeenMs) / 1000))
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.round(s / 60)}m ago`
  if (s < 86400) return `${Math.round(s / 3600)}h ago`
  return `${Math.round(s / 86400)}d ago`
}

// ── Infrastructure ──────────────────────────────────────────────────
export const INFRA_TARGETS = [
  { id: 'local', label: 'Local machine', kind: 'host' },
  { id: 'vps', label: 'VPS', kind: 'host' },
  { id: 'cloud-mc', label: 'Cloud Mission Control', kind: 'cloud' },
  { id: 'docker', label: 'Docker containers', kind: 'container' },
] as const

export const FIREWALL_CHECKLIST = [
  'Loopback-only sidecar endpoints (no public bind)',
  'HTTPS / TLS on public surfaces',
  'Runtime keys scoped + rotatable',
  'No SSH credentials in code/logs/env examples',
  'Secrets in a credentials manager (encrypted at rest)',
  'Firewall: only required ports exposed',
]

// ── Updates ─────────────────────────────────────────────────────────
export interface UpdateComponent {
  id: string
  label: string
  updateCommand: string
  rollback: string
}

export const UPDATE_COMPONENTS: UpdateComponent[] = [
  { id: 'baseline-os', label: 'Baseline OS', updateCommand: 'git pull && bun install && bun run build', rollback: 'git checkout <previous-tag>' },
  { id: 'mission-control', label: 'Mission Control', updateCommand: 'git pull && pnpm install && pnpm build', rollback: 'git checkout <previous-tag> && pnpm build' },
  { id: 'hermes', label: 'Hermes', updateCommand: 'isolated update — verify safe before applying', rollback: 'redeploy previous Hermes binary' },
  { id: 'runtimes', label: 'Runtime adapters', updateCommand: 'pull latest runtime adapter + restart', rollback: 'pin previous adapter version' },
]

// ── Health ──────────────────────────────────────────────────────────
export type HealthState = 'ok' | 'degraded' | 'down' | 'unknown'

export const HEALTH_CHECKS = [
  { id: 'api', label: 'API health' },
  { id: 'runtime-registry', label: 'Runtime registry' },
  { id: 'credentials', label: 'Credential health' },
  { id: 'billing', label: 'Billing health' },
  { id: 'marketplace', label: 'Marketplace health' },
  { id: 'orchestration', label: 'Orchestration health' },
  { id: 'mirror-sync', label: 'Mirror sync health' },
  { id: 'daily-brief', label: 'Daily Brief / ROI job' },
] as const

// ── Proof ───────────────────────────────────────────────────────────
export const PROOF_TYPES = [
  'install', 'pairing', 'runtime-heartbeat', 'version', 'sync', 'deployment',
] as const

// ── Done-For-You checklist ──────────────────────────────────────────
export interface DfyStep {
  id: string
  label: string
}

export const DFY_CHECKLIST: DfyStep[] = [
  { id: 'workspace', label: 'Workspace created' },
  { id: 'email-verified', label: 'Email verified' },
  { id: 'workforce-selected', label: 'Workforce selected' },
  { id: 'baseline-installed', label: 'Baseline OS installed' },
  { id: 'credentials-added', label: 'Credentials added' },
  { id: 'runtime-keys', label: 'Runtime keys generated' },
  { id: 'runtimes-paired', label: 'Runtimes paired' },
  { id: 'vps-hardened', label: 'VPS hardened' },
  { id: 'hermes-vps-paired', label: 'Hermes VPS paired' },
  { id: 'workflows-installed', label: 'Workflows installed' },
  { id: 'first-task', label: 'First task queued' },
  { id: 'daily-brief', label: 'Daily Brief enabled' },
  { id: 'roi', label: 'ROI enabled' },
  { id: 'handoff', label: 'Customer handoff report generated' },
]

export interface DfySignals {
  workspace?: boolean
  emailVerified?: boolean
  workforceSelected?: boolean
  baselineInstalled?: boolean
  credentialsAdded?: boolean
  runtimeKeys?: boolean
  runtimesPaired?: boolean
  vpsHardened?: boolean
  hermesVpsPaired?: boolean
  workflowsInstalled?: boolean
  firstTask?: boolean
  dailyBrief?: boolean
  roi?: boolean
  handoff?: boolean
}

const DFY_SIGNAL_KEY: Record<string, keyof DfySignals> = {
  workspace: 'workspace', 'email-verified': 'emailVerified', 'workforce-selected': 'workforceSelected',
  'baseline-installed': 'baselineInstalled', 'credentials-added': 'credentialsAdded', 'runtime-keys': 'runtimeKeys',
  'runtimes-paired': 'runtimesPaired', 'vps-hardened': 'vpsHardened', 'hermes-vps-paired': 'hermesVpsPaired',
  'workflows-installed': 'workflowsInstalled', 'first-task': 'firstTask', 'daily-brief': 'dailyBrief',
  roi: 'roi', handoff: 'handoff',
}

export function dfyProgress(signals: DfySignals): { done: number; total: number; steps: { step: DfyStep; done: boolean }[] } {
  const steps = DFY_CHECKLIST.map((step) => ({ step, done: !!signals[DFY_SIGNAL_KEY[step.id]] }))
  return { done: steps.filter((s) => s.done).length, total: steps.length, steps }
}

// ── Customer handoff report ─────────────────────────────────────────
export interface HandoffReport {
  workspace: string
  installedWorkforces: string[]
  connectedRuntimes: string[]
  connectedCredentials: string[]
  creditBalance: number
  enabledIntegrations: string[]
  versions: Record<string, string>
  health: Record<string, HealthState>
  nextSteps: string[]
  supportNotes: string
  generatedAt: number
}

export function buildHandoffReport(input: Partial<HandoffReport> & { workspace: string; generatedAt: number }): HandoffReport {
  return {
    workspace: input.workspace,
    installedWorkforces: input.installedWorkforces ?? [],
    connectedRuntimes: input.connectedRuntimes ?? [],
    connectedCredentials: input.connectedCredentials ?? [],
    creditBalance: input.creditBalance ?? 0,
    enabledIntegrations: input.enabledIntegrations ?? [],
    versions: input.versions ?? {},
    health: input.health ?? {},
    nextSteps: input.nextSteps ?? [],
    supportNotes: input.supportNotes ?? '',
    generatedAt: input.generatedAt,
  }
}
