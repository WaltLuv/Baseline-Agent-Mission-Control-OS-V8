/**
 * Runtime Telemetry Adapter
 * =========================
 *
 * The default execution telemetry layer. Hermes, OpenClaw, Claude Code,
 * and any future runtime (CrewAI, LangGraph, AutoGen adapters) import
 * this module and call its helpers whenever an AI Employee acts. The
 * helpers translate those events into HTTP calls against Mission
 * Control's API surface so the Workforce remains:
 *
 *   • observable   — operators can see what every employee is doing
 *   • measurable   — every action has cost, value, and outcome
 *   • explainable  — every decision is linked back to memory
 *   • improvable   — operators can spot and fix drift
 *
 * Design rules
 * ------------
 *   1. **Best-effort, never throwing.** A failed telemetry call must not
 *      bring down the runtime. All helpers return `{ ok, status, error? }`.
 *   2. **Typed, slug-keyed.** No magic strings — every parameter has a
 *      TypeScript shape.
 *   3. **No vector jargon at the boundary.** Helper names use business
 *      vocabulary (`reportMemoryUse`, `reportEscalation`) — the API layer
 *      decides where to store it.
 *   4. **Workspace credentials come from the runtime caller.** Either a
 *      session cookie OR an `x-api-key` header — never embedded in this
 *      module. The fetcher accepts a configurable `Authorization` /
 *      cookie injector via `TelemetryConfig`.
 */

export interface TelemetryConfig {
  /** Mission Control base URL. e.g. `https://mission-control.example.com` */
  baseUrl: string
  /** Optional bearer token / api key — sent as `x-api-key`. */
  apiKey?: string
  /** Optional cookie value (session-based). */
  cookie?: string
  /** Override fetch (for tests / non-Node runtimes). */
  fetchImpl?: typeof fetch
  /** Network timeout in ms. */
  timeoutMs?: number
}

export interface TelemetryResult<T = unknown> {
  ok: boolean
  status: number
  data?: T
  error?: string
}

export interface SkillEventInput {
  skillSlug: string
  agentSlug?: string
  agentId?: number
  valueImpactCents?: number
  durationMinutes?: number
  success?: boolean
  taskId?: number
  note?: string
}

export interface EscalationInput {
  agentSlug?: string
  agentId?: number
  taskId?: number
  reason: string
  /** Optional Obsidian / Notion / Pinecone / Internal source label. */
  source?: 'Obsidian' | 'Notion' | 'Pinecone' | 'Internal'
  severity?: 'low' | 'medium' | 'high'
}

export interface MemoryUseInput {
  agentSlug?: string
  agentId?: number
  source: 'Obsidian' | 'Notion' | 'Pinecone' | 'Internal'
  title: string
  excerpt?: string
  rationale?: string
  taskId?: number
}

export interface CollaborationInput {
  fromAgentSlug: string
  toAgentSlug: string
  taskId?: number
  reason?: string
}

export interface OutcomeInput {
  agentSlug?: string
  agentId?: number
  taskId?: number
  status: 'done' | 'failed' | 'partial'
  valueImpactCents?: number
  durationMinutes?: number
  summary?: string
}

export interface TokenUsageInput {
  model: string
  inputTokens: number
  outputTokens: number
  sessionId?: string
  agentId?: number
  taskId?: number
  provider?: string
  duration?: number
  operation?: string
  idempotencyKey?: string
}

const DEFAULT_TIMEOUT_MS = 5_000

function buildHeaders(config: TelemetryConfig): HeadersInit {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (config.apiKey) headers['x-api-key'] = config.apiKey
  if (config.cookie) headers['Cookie'] = config.cookie
  return headers
}

async function post<T = unknown>(
  config: TelemetryConfig,
  path: string,
  body: unknown,
): Promise<TelemetryResult<T>> {
  const url = `${config.baseUrl.replace(/\/$/, '')}${path}`
  const fetcher = config.fetchImpl ?? fetch
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs ?? DEFAULT_TIMEOUT_MS)
  try {
    const res = await fetcher(url, {
      method: 'POST',
      headers: buildHeaders(config),
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    const data = (await res.json().catch(() => null)) as T | null
    return { ok: res.ok, status: res.status, data: data ?? undefined }
  } catch (e) {
    return { ok: false, status: 0, error: (e as Error).message }
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * Report a skill activation. Drives the Skills-Active Inventory,
 * Employee Trace skills card, and the Briefing ROI leaderboard.
 */
export function reportSkillEvent(config: TelemetryConfig, event: SkillEventInput) {
  return post(config, '/api/skills/event', event)
}

/**
 * Report a task that was escalated for human approval. Surfaces on the
 * Approval Queue and on the AI Employee Life Roster as
 * `presence='waiting-for-approval'`. The optional memory `source` +
 * `reason` become the "Why this was escalated" copy on the approval card.
 */
export function reportEscalation(config: TelemetryConfig, event: EscalationInput) {
  return post(config, '/api/agents/escalation', event)
}

/**
 * Report memory the AI Employee actually used. Surfaces in the trace
 * "Memory used" card with the friendly source label (Obsidian / Notion
 * / Pinecone / Internal).
 */
export function reportMemoryUse(config: TelemetryConfig, event: MemoryUseInput) {
  return post(config, '/api/agents/memory-use', event)
}

/**
 * Report a hand-off between two AI Employees. Adds an edge to the
 * Collaborator Graph and surfaces on both employees' trace pages.
 */
export function reportCollaboration(config: TelemetryConfig, event: CollaborationInput) {
  return post(config, '/api/agents/collaboration', event)
}

/**
 * Report a task outcome (done / failed / partial). The status drives
 * the trust trajectory + life-signal confidence band.
 */
export function reportOutcome(config: TelemetryConfig, event: OutcomeInput) {
  return post(config, '/api/agents/outcome', event)
}

/**
 * Report LLM token usage. Drives credit ledger + cost-this-month on the
 * trace and billing panel. Maps directly to the existing `/api/tokens`
 * route used by Hermes today.
 */
export function reportTokenUsage(config: TelemetryConfig, event: TokenUsageInput) {
  return post(config, '/api/tokens', event)
}

/**
 * Convenience: emit a complete skill execution in one call — token
 * usage + skill event + outcome. Returns the merged result map.
 *
 * Use this from a runtime that just finished a skill invocation so all
 * downstream surfaces (briefing, trace, billing, inventory) update
 * coherently.
 */
export async function reportSkillExecution(
  config: TelemetryConfig,
  args: {
    skill: SkillEventInput
    tokens?: TokenUsageInput
    outcome?: OutcomeInput
    memory?: MemoryUseInput
  },
) {
  const out: Record<string, TelemetryResult<unknown>> = {}
  // Token usage first so the credit ledger reflects the cost.
  if (args.tokens) out.tokens = await reportTokenUsage(config, args.tokens)
  out.skill = await reportSkillEvent(config, args.skill)
  if (args.memory) out.memory = await reportMemoryUse(config, args.memory)
  if (args.outcome) out.outcome = await reportOutcome(config, args.outcome)
  return out
}
