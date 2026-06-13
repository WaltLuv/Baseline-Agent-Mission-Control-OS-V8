/**
 * PI Agent harness — the brain/memory layer for Mission Control.
 *
 * PI Agent is NOT the runtime. It WRAPS the specialized execution workers
 * (Hermes, Claude Code, Codex, workflow agents). For every request it:
 *   1. retrieves context (workspace knowledge + memory + Graphify lookup),
 *   2. runs a policy gate,
 *   3. routes to the right sub-agent,
 *   4. injects the context package and hands off to the sub-agent to EXECUTE,
 *   5. indexes proof/replay,
 *   6. writes post-task memory updates.
 *
 * Flow: request → PI context package → route to sub-agent → execute →
 *        proof/replay → PI memory update.
 *
 * The sub-agent is provided as an `executor` callback — PI never replaces it.
 */
import { getDatabase } from '@/lib/db'
import { runMigrations } from '@/lib/migrations'
import { logSecurityEvent } from '@/lib/security-events'
import { startReplay, recordReplayEvent, endReplay } from '@/lib/replay/store'

export type PolicyDecision = 'allow' | 'deny'
export type Role = 'admin' | 'operator' | 'viewer'

export interface PiGraphContext {
  query: string
  available: boolean
  nodes: string[]
  note?: string
}
export interface PiMemoryContext {
  query: string
  hits: Array<{ source: string; snippet: string; ts: number }>
}
export interface PiWorkspaceKnowledge {
  agents: number
  workOrders: number
  openApprovals: number
  replays: number
  topAgents: string[]
}

export interface PiContextPackage {
  id: string
  workspaceId: number
  request: string
  routedAgent: string | null
  policy: { decision: PolicyDecision; reason: string | null }
  graph: PiGraphContext
  memory: PiMemoryContext
  workspaceKnowledge: PiWorkspaceKnowledge
  replayId: string | null
  proofRef: string | null
  status: 'prepared' | 'blocked' | 'executing' | 'completed' | 'failed'
  createdBy: string | null
}

export interface PiRouting {
  chosen: string
  candidates: string[]
  reason: string
}

/** Sub-agent receives the assembled context BEFORE it executes. */
export interface SubAgentInput {
  request: string
  agent: string
  context: {
    graph: PiGraphContext
    memory: PiMemoryContext
    workspaceKnowledge: PiWorkspaceKnowledge
  }
}
export interface SubAgentResult {
  output: unknown
  /** Optional proof reference (work order id, comms id, file, etc.). */
  proofRef?: string
  status?: 'completed' | 'failed'
}
export type SubAgentExecutor = (input: SubAgentInput) => Promise<SubAgentResult>

export interface PiRunResult {
  package: PiContextPackage
  routing: PiRouting
  blocked: boolean
  output: unknown
  replayId: string | null
  memoryEvents: Array<{ kind: string; summary: string; ref: string | null }>
}

const nowSec = () => Math.floor(Date.now() / 1000)
let pkgCounter = 0
function newPackageId(now: number): string {
  pkgCounter = (pkgCounter + 1) % 1_000_000
  return `pi_${now.toString(36)}${pkgCounter.toString(36)}`
}

// ── Context retrieval ────────────────────────────────────────────────────
function workspaceKnowledge(ws: number): PiWorkspaceKnowledge {
  const db = getDatabase()
  const count = (sql: string) => {
    try {
      return (db.prepare(sql).get(ws) as { n: number } | undefined)?.n ?? 0
    } catch {
      return 0
    }
  }
  let topAgents: string[] = []
  try {
    topAgents = (
      db
        .prepare(`SELECT name FROM agents WHERE workspace_id = ? ORDER BY updated_at DESC LIMIT 5`)
        .all(ws) as Array<{ name: string }>
    ).map((r) => r.name)
  } catch {
    /* table optional */
  }
  return {
    agents: count(`SELECT COUNT(*) n FROM agents WHERE workspace_id = ?`),
    workOrders: count(`SELECT COUNT(*) n FROM work_orders WHERE workspace_id = ?`),
    openApprovals: count(`SELECT COUNT(*) n FROM owner_approvals WHERE workspace_id = ? AND status = 'pending'`),
    replays: count(`SELECT COUNT(*) n FROM mission_replays WHERE workspace_id = ?`),
    topAgents,
  }
}

/** Memory injection — recent workspace activity relevant to the request. */
function memoryContext(ws: number, request: string): PiMemoryContext {
  const db = getDatabase()
  const terms = request.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length >= 4).slice(0, 6)
  const hits: PiMemoryContext['hits'] = []
  try {
    const rows = db
      .prepare(
        `SELECT type, description, created_at FROM activities
          WHERE workspace_id = ? ORDER BY created_at DESC LIMIT 40`,
      )
      .all(ws) as Array<{ type: string; description: string; created_at: number }>
    for (const r of rows) {
      const text = `${r.type} ${r.description}`.toLowerCase()
      if (terms.length === 0 || terms.some((t) => text.includes(t))) {
        hits.push({ source: `activity:${r.type}`, snippet: (r.description || '').slice(0, 160), ts: r.created_at })
      }
      if (hits.length >= 8) break
    }
  } catch {
    /* activities table optional */
  }
  return { query: request, hits }
}

/** Graphify lookup — best-effort. Honest about availability; never fabricates. */
function graphContext(request: string, graphProbe?: (q: string) => string[] | null): PiGraphContext {
  try {
    const nodes = graphProbe ? graphProbe(request) : null
    if (nodes && nodes.length) return { query: request, available: true, nodes: nodes.slice(0, 12) }
  } catch {
    /* fall through to unavailable */
  }
  return { query: request, available: false, nodes: [], note: 'Graphify graph not loaded for this workspace; proceeding without structural context.' }
}

// ── Policy gate ──────────────────────────────────────────────────────────
const DESTRUCTIVE = /\b(drop\s+(table|database)|rm\s+-rf|delete\s+all|wipe\s+(the\s+)?(db|database|workspace)|truncate\s+\w+)\b/i

export function evaluatePolicy(request: string, role: Role): { decision: PolicyDecision; reason: string | null } {
  if (DESTRUCTIVE.test(request)) {
    return { decision: 'deny', reason: 'Request matches a destructive/irreversible pattern (policy gate).' }
  }
  if (role === 'viewer') {
    return { decision: 'deny', reason: 'Viewer role cannot trigger agent execution (policy gate).' }
  }
  return { decision: 'allow', reason: null }
}

// ── Routing ──────────────────────────────────────────────────────────────
// PI routes TO specialized sub-agents — it never replaces them.
const ROUTES: Array<[RegExp, string]> = [
  [/owner\s*approval|\bapprove\b|approval/i, 'owner-approvals'],
  [/vendor|dispatch/i, 'vendor-coordinator'],
  [/inspection|inspect/i, 'inspection-analyst'],
  [/maintenance|work\s*order|repair|hvac|plumb|leak|electrical/i, 'maintenance-dispatcher'],
  [/\bcodex\b/i, 'codex'],
  [/\bcode\b|refactor|pull\s*request|\bpr\b|\bbug\b|build|deploy/i, 'claude-code'],
  [/research|market|swarm|analy/i, 'research'],
  [/voice|call|intake|realtime/i, 'voice-intake'],
]

export function routeAgent(request: string, requestedAgent?: string | null): PiRouting {
  const candidates: string[] = []
  for (const [re, agent] of ROUTES) if (re.test(request)) candidates.push(agent)
  if (requestedAgent) {
    return { chosen: requestedAgent, candidates: [requestedAgent, ...candidates], reason: 'Explicit agent requested by caller.' }
  }
  if (candidates.length) {
    return { chosen: candidates[0], candidates, reason: `Matched request to ${candidates[0]} by intent.` }
  }
  // Default to Hermes — the general long-running orchestration runtime.
  return { chosen: 'hermes', candidates: ['hermes'], reason: 'No specialized match; defaulting to Hermes orchestration runtime.' }
}

// ── Persistence ──────────────────────────────────────────────────────────
function persistPackage(pkg: PiContextPackage, now: number): void {
  getDatabase()
    .prepare(
      `INSERT INTO pi_context_packages
         (id, workspace_id, request, routed_agent, policy_decision, policy_reason,
          graph_context_json, memory_context_json, workspace_knowledge_json,
          replay_id, proof_ref, status, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      pkg.id, pkg.workspaceId, pkg.request, pkg.routedAgent, pkg.policy.decision, pkg.policy.reason,
      JSON.stringify(pkg.graph), JSON.stringify(pkg.memory), JSON.stringify(pkg.workspaceKnowledge),
      pkg.replayId, pkg.proofRef, pkg.status, pkg.createdBy, now, now,
    )
}

function updatePackage(id: string, fields: Partial<Pick<PiContextPackage, 'replayId' | 'proofRef' | 'status'>>, now: number): void {
  getDatabase()
    .prepare(
      `UPDATE pi_context_packages
          SET replay_id = COALESCE(?, replay_id),
              proof_ref = COALESCE(?, proof_ref),
              status = COALESCE(?, status),
              updated_at = ?
        WHERE id = ?`,
    )
    .run(fields.replayId ?? null, fields.proofRef ?? null, fields.status ?? null, now, id)
}

function recordRouting(ws: number, packageId: string, routing: PiRouting, now: number): void {
  getDatabase()
    .prepare(
      `INSERT INTO pi_routing_logs (workspace_id, package_id, candidates_json, chosen_agent, reason, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(ws, packageId, JSON.stringify(routing.candidates), routing.chosen, routing.reason, now)
}

function recordMemoryEvent(ws: number, packageId: string, kind: string, summary: string, ref: string | null, now: number): void {
  getDatabase()
    .prepare(
      `INSERT INTO pi_memory_events (workspace_id, package_id, kind, summary, ref, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(ws, packageId, kind, summary, ref, now)
}

// ── Orchestration ────────────────────────────────────────────────────────
export interface PiRunArgs {
  workspaceId: number
  request: string
  role: Role
  actor?: string
  requestedAgent?: string | null
  /** Optional Graphify probe (kept injectable so the harness stays testable). */
  graphProbe?: (q: string) => string[] | null
}

/**
 * Run a request THROUGH PI Agent: assemble context → policy gate → route →
 * inject context + execute the specialized sub-agent → proof/replay → memory
 * update. The sub-agent is `executor`; PI wraps it, never replaces it.
 */
export async function runThroughPiAgent(args: PiRunArgs, executor: SubAgentExecutor): Promise<PiRunResult> {
  getDatabase()
  runMigrations(getDatabase())
  const now = nowSec()
  const ws = args.workspaceId
  const memEvents: PiRunResult['memoryEvents'] = []

  // 1. CONTEXT RETRIEVAL (brain layer)
  const graph = graphContext(args.request, args.graphProbe)
  const memory = memoryContext(ws, args.request)
  const knowledge = workspaceKnowledge(ws)

  // 2. POLICY GATE
  const policy = evaluatePolicy(args.request, args.role)

  // 3. ROUTING
  const routing = routeAgent(args.request, args.requestedAgent)

  const pkg: PiContextPackage = {
    id: newPackageId(now),
    workspaceId: ws,
    request: args.request,
    routedAgent: routing.chosen,
    policy,
    graph,
    memory,
    workspaceKnowledge: knowledge,
    replayId: null,
    proofRef: null,
    status: policy.decision === 'deny' ? 'blocked' : 'prepared',
    createdBy: args.actor ?? null,
  }
  persistPackage(pkg, now)
  recordRouting(ws, pkg.id, routing, now)

  // Policy-blocked → never reaches a sub-agent.
  if (policy.decision === 'deny') {
    logSecurityEvent({
      event_type: 'pi_policy_block',
      severity: 'warning',
      source: 'pi-agent',
      agent_name: args.actor ?? 'unknown',
      workspace_id: ws,
      detail: `request="${args.request.slice(0, 160)}" reason="${policy.reason}"`,
    })
    recordMemoryEvent(ws, pkg.id, 'policy_block', `Blocked: ${policy.reason}`, null, now)
    memEvents.push({ kind: 'policy_block', summary: `Blocked: ${policy.reason}`, ref: null })
    return { package: pkg, routing, blocked: true, output: null, replayId: null, memoryEvents: memEvents }
  }

  // 4. PROOF/REPLAY — record that PI injected context BEFORE the sub-agent runs.
  const replay = startReplay(ws, `PI:${routing.chosen}`, args.request.slice(0, 120), now)
  recordReplayEvent(ws, replay.id, {
    ts: now,
    kind: 'tool_call',
    agent: 'PI Agent',
    label: 'context package injected',
    detail: `graph=${graph.available ? graph.nodes.length : 'n/a'} · memory=${memory.hits.length} · agents=${knowledge.agents} → route ${routing.chosen}`,
  })
  pkg.replayId = replay.id
  pkg.status = 'executing'
  updatePackage(pkg.id, { replayId: replay.id, status: 'executing' }, now)
  recordMemoryEvent(ws, pkg.id, 'context_injected', `Context injected for "${routing.chosen}"`, replay.id, now)
  memEvents.push({ kind: 'context_injected', summary: `Context injected for "${routing.chosen}"`, ref: replay.id })

  // 5. EXECUTE — hand off to the specialized sub-agent (PI wraps it).
  let result: SubAgentResult
  try {
    recordReplayEvent(ws, replay.id, { ts: nowSec(), kind: 'agent_start', agent: routing.chosen, label: 'sub-agent execution' })
    result = await executor({
      request: args.request,
      agent: routing.chosen,
      context: { graph, memory, workspaceKnowledge: knowledge },
    })
  } catch (err) {
    endReplay(ws, replay.id, 'failed', nowSec())
    updatePackage(pkg.id, { status: 'failed' }, nowSec())
    pkg.status = 'failed'
    recordMemoryEvent(ws, pkg.id, 'execution_failed', (err as Error).message.slice(0, 200), replay.id, nowSec())
    memEvents.push({ kind: 'execution_failed', summary: (err as Error).message.slice(0, 200), ref: replay.id })
    return { package: pkg, routing, blocked: false, output: null, replayId: replay.id, memoryEvents: memEvents }
  }

  // 6. PROOF/REPLAY indexing + post-task memory update.
  const end = nowSec()
  const status = result.status ?? 'completed'
  recordReplayEvent(ws, replay.id, { ts: end, kind: 'output', agent: routing.chosen, label: result.proofRef ? `proof: ${result.proofRef}` : 'execution complete' })
  endReplay(ws, replay.id, status === 'failed' ? 'failed' : 'completed', end)
  pkg.proofRef = result.proofRef ?? null
  pkg.status = status
  updatePackage(pkg.id, { proofRef: result.proofRef ?? null, status }, end)
  recordMemoryEvent(ws, pkg.id, 'post_task_update', `Sub-agent ${routing.chosen} completed; replay ${replay.id} indexed${result.proofRef ? `, proof ${result.proofRef}` : ''}.`, result.proofRef ?? replay.id, end)
  memEvents.push({ kind: 'post_task_update', summary: `Sub-agent ${routing.chosen} completed`, ref: result.proofRef ?? replay.id })

  return { package: pkg, routing, blocked: false, output: result.output, replayId: replay.id, memoryEvents: memEvents }
}

// ── Read APIs ────────────────────────────────────────────────────────────
export interface PiPackageRow extends Omit<PiContextPackage, 'graph' | 'memory' | 'workspaceKnowledge' | 'policy'> {
  policy_decision: string
  policy_reason: string | null
  graph: PiGraphContext
  memory: PiMemoryContext
  workspaceKnowledge: PiWorkspaceKnowledge
  created_at: number
  routing: { candidates: string[]; chosen: string; reason: string | null } | null
  memoryEvents: Array<{ kind: string; summary: string; ref: string | null; created_at: number }>
}

export function getContextPackage(ws: number, id: string): PiPackageRow | null {
  const db = getDatabase()
  runMigrations(db)
  const row = db.prepare(`SELECT * FROM pi_context_packages WHERE workspace_id = ? AND id = ?`).get(ws, id) as Record<string, unknown> | undefined
  if (!row) return null
  const routing = db.prepare(`SELECT candidates_json, chosen_agent, reason FROM pi_routing_logs WHERE package_id = ? ORDER BY id DESC LIMIT 1`).get(id) as { candidates_json: string; chosen_agent: string; reason: string | null } | undefined
  const events = db.prepare(`SELECT kind, summary, ref, created_at FROM pi_memory_events WHERE package_id = ? ORDER BY id ASC`).all(id) as Array<{ kind: string; summary: string; ref: string | null; created_at: number }>
  return {
    id: row.id as string,
    workspaceId: row.workspace_id as number,
    request: row.request as string,
    routedAgent: row.routed_agent as string | null,
    policy_decision: row.policy_decision as string,
    policy_reason: row.policy_reason as string | null,
    graph: JSON.parse((row.graph_context_json as string) || '{}'),
    memory: JSON.parse((row.memory_context_json as string) || '{}'),
    workspaceKnowledge: JSON.parse((row.workspace_knowledge_json as string) || '{}'),
    replayId: row.replay_id as string | null,
    proofRef: row.proof_ref as string | null,
    status: row.status as PiContextPackage['status'],
    createdBy: row.created_by as string | null,
    created_at: row.created_at as number,
    routing: routing ? { candidates: JSON.parse(routing.candidates_json || '[]'), chosen: routing.chosen_agent, reason: routing.reason } : null,
    memoryEvents: events,
  }
}

export function listContextPackages(ws: number, limit = 50): Array<Pick<PiPackageRow, 'id' | 'request' | 'routedAgent' | 'policy_decision' | 'status' | 'replayId' | 'proofRef' | 'created_at'>> {
  const db = getDatabase()
  runMigrations(db)
  return db
    .prepare(
      `SELECT id, request, routed_agent as routedAgent, policy_decision, status, replay_id as replayId, proof_ref as proofRef, created_at
         FROM pi_context_packages WHERE workspace_id = ? ORDER BY created_at DESC LIMIT ?`,
    )
    .all(ws, limit) as never
}
