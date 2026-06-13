/**
 * Agent Execution Architecture — the canonical model that makes Mission
 * Control agents real, not fake cards. Every agent resolves to an execution
 * profile (level, runtime, tools, permissions, approval rules) and a readiness
 * status computed from the workspace capability matrix.
 *
 *   Level 1 — Demo Agent           (simulation only; "Demo Only")
 *   Level 2 — Native Workflow Agent(runs MC workflows; no external runtime)
 *   Level 3 — Runtime Agent        (requires a connected runtime)
 *
 * PI Agent is a CONTEXT HARNESS, not the sole runtime — it is marked as such.
 * No fake green states: a Level-3 agent without its runtime shows Needs Runtime.
 */
import type { AgentPermission } from '@/lib/ecosystem/browser-actions'
import { capabilityReady, type CapabilityRow } from '@/lib/workspace/capability-matrix'

export type ExecutionLevel = 1 | 2 | 3

export type ReadinessStatus =
  | 'ready'
  | 'demo_only'
  | 'native_workflow_ready'
  | 'runtime_connected'
  | 'needs_runtime'
  | 'needs_credentials'
  | 'needs_approval'
  | 'offline'

/** Runtime keys map to capability-matrix capability ids. */
export type RuntimeKey =
  | 'workflow-engine'
  | 'hermes'
  | 'claude-code'
  | 'codex'
  | 'openclaw'
  | 'opencode'
  | 'pi-agent'
  | 'browser'
  | 'ecosystem'

const RUNTIME_TO_CAPABILITY: Record<RuntimeKey, string | null> = {
  'workflow-engine': 'mc_native_workflows',
  hermes: 'hermes',
  'claude-code': 'claude_code',
  codex: 'codex',
  openclaw: 'openclaw',
  opencode: 'opencode',
  'pi-agent': 'pi_agent_harness',
  browser: 'browser_automation',
  ecosystem: null, // resolved per-app
}

export interface AgentExecutionProfile {
  key: string
  /** Keyword(s) matched against agent id/name/role. */
  match: RegExp
  level: ExecutionLevel
  runtime: RuntimeKey
  optionalRuntime?: RuntimeKey
  /** PI Agent is a harness, not a worker. */
  isContextHarness?: boolean
  tools: string[]
  permissions: AgentPermission[]
  approvalRules: string[]
  description: string
}

/** Ordered most-specific first. */
export const EXECUTION_PROFILES: AgentExecutionProfile[] = [
  // ── AI Systems (Level 3 runtime agents) ──
  { key: 'pi-agent', match: /\bpi[\s-]?agent\b|chief memory/i, level: 3, runtime: 'pi-agent', isContextHarness: true, tools: ['memory_context', 'graphify_query', 'knowledge_lookup', 'proof_index', 'replay_index', 'task_routing', 'policy_context'], permissions: ['read_context'], approvalRules: [], description: 'Context harness: retrieves memory/context, routes to specialized agents, indexes proof/replay. Not the sole runtime.' },
  { key: 'claude-code', match: /claude[\s-]?code|engineer/i, level: 3, runtime: 'claude-code', tools: ['code', 'files', 'pr', 'tests'], permissions: ['run_code', 'file_access'], approvalRules: ['deploy requires approval'], description: 'Code review, refactors, builds, PRs — via Claude Code (Flight Deck).' },
  { key: 'codex', match: /\bcodex\b/i, level: 3, runtime: 'codex', tools: ['code', 'files'], permissions: ['run_code', 'file_access'], approvalRules: ['deploy requires approval'], description: 'OpenAI Codex execution runtime.' },
  { key: 'openclaw', match: /openclaw|opencode/i, level: 3, runtime: 'openclaw', tools: ['swarm', 'automation'], permissions: ['run_code', 'browser_use', 'computer_use'], approvalRules: ['destructive actions require approval'], description: 'OpenClaw swarm/automation runtime.' },
  { key: 'hermes', match: /\bhermes\b/i, level: 3, runtime: 'hermes', tools: ['orchestration', 'scheduling', 'memory'], permissions: ['read_context', 'send_message'], approvalRules: ['outbound messages require approval'], description: 'Long-running orchestration runtime.' },
  { key: 'voiceops', match: /voiceops|voice intake|voice/i, level: 3, runtime: 'ecosystem', tools: ['call_log', 'follow_up', 'escalate'], permissions: ['voice_calling', 'read_context'], approvalRules: ['escalation requires approval'], description: 'Voice operations — requires VoiceOps + Twilio.' },
  { key: 'visionops', match: /visionops|inspection analyst|vision/i, level: 3, runtime: 'ecosystem', tools: ['inspection_media', 'visual_proof', 'report'], permissions: ['vision_analysis', 'read_context'], approvalRules: ['report publish requires approval'], description: 'Inspection media review + visual proof — requires VisionOps.' },
  { key: 'market-swarm', match: /market swarm|research/i, level: 3, runtime: 'openclaw', tools: ['web_search', 'synthesis'], permissions: ['market_swarm', 'browser_use', 'read_context'], approvalRules: [], description: 'Market research swarm — requires a research/browser runtime.' },

  // ── Operations (Level 2 native workflow agents) ──
  { key: 'maintenance-dispatcher', match: /maintenance|dispatcher|work order|repair/i, level: 2, runtime: 'workflow-engine', optionalRuntime: 'hermes', tools: ['work_orders', 'vendors', 'comms', 'approvals', 'proof', 'replay'], permissions: ['read_context', 'create_work_order', 'dispatch_vendor', 'send_message', 'request_approval'], approvalRules: ['spend above owner threshold requires approval'], description: 'Triages work orders and dispatches vendors via the MC workflow engine.' },
  { key: 'vendor-coordinator', match: /vendor/i, level: 2, runtime: 'workflow-engine', optionalRuntime: 'hermes', tools: ['vendors', 'dispatch', 'invoices', 'proof', 'replay'], permissions: ['read_context', 'dispatch_vendor', 'request_approval'], approvalRules: ['invoice approval gated'], description: 'Vendor matching + dispatch.' },
  { key: 'owner-relations', match: /owner/i, level: 2, runtime: 'workflow-engine', tools: ['owner_approvals', 'email', 'proof', 'replay'], permissions: ['read_context', 'request_approval', 'send_message'], approvalRules: ['outbound owner email gated'], description: 'Owner approvals + relations.' },
  { key: 'leasing-coordinator', match: /leasing/i, level: 2, runtime: 'workflow-engine', tools: ['leases', 'comms', 'proof', 'replay'], permissions: ['read_context', 'send_message'], approvalRules: [], description: 'Lease renewals + leasing comms.' },
  { key: 'resident-success', match: /resident|tenant/i, level: 2, runtime: 'workflow-engine', tools: ['comms', 'tasks', 'proof', 'replay'], permissions: ['read_context', 'send_message'], approvalRules: [], description: 'Resident success + tenant comms.' },
  // ── Finance (Level 2) ──
  { key: 'finance', match: /accounts? (receivable|payable)|\bap\b|\bar\b|budget|asset manager|cfo|finance|collections/i, level: 2, runtime: 'workflow-engine', tools: ['ledgers', 'invoices', 'reports', 'proof'], permissions: ['read_context', 'request_approval', 'billing_action'], approvalRules: ['billing actions require approval'], description: 'Finance workflows (AP/AR, budget, asset).' },
  // ── Executive (Level 2) ──
  { key: 'executive', match: /coo|operations director|portfolio manager|chief of staff|ceo|executive/i, level: 2, runtime: 'workflow-engine', tools: ['reporting', 'approvals', 'replay'], permissions: ['read_context', 'request_approval', 'approve_spend'], approvalRules: ['approve_spend within delegated limit'], description: 'Executive oversight + approvals.' },
]

const DEMO_PROFILE: AgentExecutionProfile = {
  key: 'demo', match: /demo/i, level: 1, runtime: 'workflow-engine',
  tools: ['seeded_activity', 'proof', 'replay'], permissions: ['read_context'], approvalRules: [],
  description: 'Demo/simulation only — seeded proof/replay, no live execution.',
}

/** Default for any unmatched roster persona: a Level-2 native workflow worker. */
const DEFAULT_PROFILE: AgentExecutionProfile = {
  key: 'native-worker', match: /.*/, level: 2, runtime: 'workflow-engine',
  tools: ['tasks', 'comms', 'proof', 'replay'], permissions: ['read_context', 'send_message'], approvalRules: ['outbound messages gated'],
  description: 'Native Mission Control workflow worker.',
}

export interface AgentLike {
  id?: string
  name?: string
  role?: string
  /** Set true for explicitly demo/seeded agents. */
  demo?: boolean
}

export function profileForAgent(agent: AgentLike): AgentExecutionProfile {
  if (agent.demo) return DEMO_PROFILE
  const hay = `${agent.id ?? ''} ${agent.name ?? ''} ${agent.role ?? ''}`
  for (const p of EXECUTION_PROFILES) if (p.match.test(hay)) return p
  return DEFAULT_PROFILE
}

export interface AgentReadiness {
  level: ExecutionLevel
  runtime: RuntimeKey
  optionalRuntime: RuntimeKey | null
  isContextHarness: boolean
  runtimeStatus: 'connected' | 'not_connected' | 'native'
  status: ReadinessStatus
  tools: string[]
  permissions: AgentPermission[]
  approvalRules: string[]
  blockers: string[]
  setupNeeded: string[]
}

/**
 * Compute an agent's readiness from its profile + the workspace capability
 * matrix. Level-3 agents are Needs Runtime until their runtime connects.
 */
export function computeAgentReadiness(profile: AgentExecutionProfile, matrix: CapabilityRow[]): AgentReadiness {
  const blockers: string[] = []
  const setupNeeded: string[] = []
  const base = {
    level: profile.level,
    runtime: profile.runtime,
    optionalRuntime: profile.optionalRuntime ?? null,
    isContextHarness: !!profile.isContextHarness,
    tools: profile.tools,
    permissions: profile.permissions,
    approvalRules: profile.approvalRules,
  }

  if (profile.level === 1) {
    return { ...base, runtimeStatus: 'native', status: 'demo_only', blockers: [], setupNeeded: [] }
  }

  if (profile.level === 2) {
    // MC workflow engine is always available → Native Workflow Ready.
    return { ...base, runtimeStatus: 'native', status: 'native_workflow_ready', blockers: [], setupNeeded: [] }
  }

  // Level 3 — requires the runtime capability to be connected.
  const capId = RUNTIME_TO_CAPABILITY[profile.runtime]
  const connected = capId ? capabilityReady(matrix, capId) : false
  if (profile.isContextHarness) {
    // PI Agent harness is built-in (ready), but it routes — it is not the worker.
    return { ...base, runtimeStatus: 'connected', status: 'ready', blockers: [], setupNeeded: [] }
  }
  if (connected) {
    return { ...base, runtimeStatus: 'connected', status: 'runtime_connected', blockers: [], setupNeeded: [] }
  }
  const capRow = capId ? matrix.find((r) => r.id === capId) : undefined
  if (capRow?.status === 'needs_credentials') {
    blockers.push(capRow.blocker ?? `${profile.runtime} needs credentials`)
    if (capRow.fixAction) setupNeeded.push(capRow.fixAction)
    return { ...base, runtimeStatus: 'not_connected', status: 'needs_credentials', blockers, setupNeeded }
  }
  blockers.push(`${profile.runtime} runtime not connected`)
  setupNeeded.push(capRow?.fixAction ?? `Connect ${profile.runtime} (Flight Deck or runtime registry)`)
  return { ...base, runtimeStatus: 'not_connected', status: 'needs_runtime', blockers, setupNeeded }
}

/** One-shot helper: agent → full readiness. */
export function agentReadiness(agent: AgentLike, matrix: CapabilityRow[]): AgentReadiness & { profileKey: string } {
  const profile = profileForAgent(agent)
  return { profileKey: profile.key, ...computeAgentReadiness(profile, matrix) }
}
