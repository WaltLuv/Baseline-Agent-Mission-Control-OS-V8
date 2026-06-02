/**
 * Baseline OS → Mission Control adapter.
 *
 * Translates Claude Code's v1 Baseline OS Daily Brief payload into the
 * Mission Control consumer shape (DailyBriefPayload). Pure mapping —
 * NO recomputation, NO new fields, NO formulas. This is the lane line:
 * Baseline OS calculates, Mission Control adapts for display.
 *
 * Detection: if the incoming payload has a `counters` object, it's
 * Claude's v1 contract. Otherwise it's already in the consumer shape
 * (typically Mission Control's own fallback aggregator) and is
 * returned unchanged.
 */

import type {
  AttentionKind,
  DailyBriefAttention,
  DailyBriefPayload,
  DailyBriefWindow,
} from './types'

/** Loose shape of Claude's v1 payload — defensive, optional everywhere. */
interface BaselineOsBriefV1 {
  workspace_id?: number
  workforce_slug?: string | null
  workforce_vertical?: string | null
  vertical?: string | null
  date_range?: {
    from_iso?: string
    to_iso?: string
    window?: string
    label?: string
    mode?: string
  }
  headline?: string
  narrative?: string
  summary?: string
  status_line?: string
  status?: string
  critical_banner?: DailyBriefPayload['critical_banner']
  counters?: {
    tasks_completed?: number
    tasks_in_flight?: number
    approvals_requested?: number
    approvals_granted?: number
    approvals_denied?: number
    approvals_pending?: number
    tool_executions?: number
    proofs_delivered?: number
    failures?: number
    blocked_refusals?: number
  }
  hours_saved?: number
  estimated_hours_saved?: number
  attention?: Array<{
    kind?: string
    title?: string
    detail?: string
    task_id?: number
    agent_id?: number
    since?: string
    since_iso?: string
    url?: string
    href?: string
  }>
  attention_items?: BaselineOsBriefV1['attention']
  personas?: Array<{
    agent_id?: number
    id?: number
    name?: string
    role?: string
    completed?: number
    in_progress?: number
    blocked?: number
  }>
  persona_breakdown?: BaselineOsBriefV1['personas']
  proofs?: Array<{
    task_id?: number
    title?: string
    proof_url?: string
    url?: string
    delivered_at?: string
    delivered_at_iso?: string
    agent?: string
    agent_name?: string
  }>
  proof_links?: BaselineOsBriefV1['proofs']
  empty_state?: DailyBriefPayload['empty_state']
  generated_at?: string
  source?: string
}

export function isClaudeBaselineOsBrief(p: unknown): p is BaselineOsBriefV1 {
  return (
    !!p &&
    typeof p === 'object' &&
    ('counters' in p ||
      ('hours_saved' in p && !('by_the_numbers' in p)))
  )
}

const VALID_ATTENTION_KINDS: ReadonlySet<AttentionKind> = new Set<AttentionKind>([
  'approval_pending',
  'failed_execution',
  'critical_workflow',
  'stale_task',
  'blocked_task',
])

function normalizeAttentionKind(kind: string | undefined): AttentionKind {
  if (!kind) return 'stale_task'
  const k = kind.toLowerCase().replace(/[-\s]/g, '_')
  if (VALID_ATTENTION_KINDS.has(k as AttentionKind)) return k as AttentionKind
  if (k.includes('approval')) return 'approval_pending'
  if (k.includes('fail')) return 'failed_execution'
  if (k.includes('critical')) return 'critical_workflow'
  if (k.includes('block') || k.includes('refus')) return 'blocked_task'
  return 'stale_task'
}

export function adaptBaselineOsBriefToConsumer(
  raw: BaselineOsBriefV1,
  fallback: { workspaceId: number; window: DailyBriefWindow },
): DailyBriefPayload {
  const counters = raw.counters ?? {}
  const tasksHandled = counters.tasks_completed ?? 0
  const failedExecutions = counters.failures ?? 0
  const approvalsRequested = counters.approvals_requested ?? 0
  const approvalsGranted = counters.approvals_granted ?? 0
  const toolExecutions = counters.tool_executions ?? 0
  const proofsDelivered = counters.proofs_delivered ?? 0
  const hoursSaved =
    raw.hours_saved ?? raw.estimated_hours_saved ?? 0

  const rawAttention = raw.attention ?? raw.attention_items ?? []
  const attention: DailyBriefAttention[] = rawAttention.map((a) => ({
    kind: normalizeAttentionKind(a.kind),
    title: a.title ?? 'Attention',
    detail: a.detail,
    task_id: a.task_id,
    agent_id: a.agent_id,
    since_iso: a.since_iso ?? a.since,
    url: a.url ?? a.href ?? '/app/tasks/kanban',
  }))

  // Surface Claude's `approvals_denied` and `blocked_refusals` as extra
  // attention pills so the operator sees them even when Claude hasn't
  // included them in his attention[] list. Skip if the producer already
  // emitted a matching item (avoid double pills).
  const hasDenied = attention.some((a) =>
    /denied|denial/i.test(a.title) || /denied/i.test(String(a.kind)),
  )
  const hasBlocked = attention.some((a) =>
    /blocked|refus/i.test(a.title) || /blocked|refus/i.test(String(a.kind)),
  )
  if (!hasDenied && (counters.approvals_denied ?? 0) > 0) {
    attention.push({
      kind: 'blocked_task',
      title: `${counters.approvals_denied} approval${counters.approvals_denied === 1 ? '' : 's'} denied`,
      detail: 'Review denials and decide on follow-up.',
      url: '/app/tool-executions',
    })
  }
  if (!hasBlocked && (counters.blocked_refusals ?? 0) > 0) {
    attention.push({
      kind: 'blocked_task',
      title: `${counters.blocked_refusals} BLOCKED refusal${counters.blocked_refusals === 1 ? '' : 's'} this window`,
      detail: 'The workforce refused these actions per the approval matrix.',
      url: '/app/tool-executions',
    })
  }

  const rawPersonas = raw.personas ?? raw.persona_breakdown ?? []
  const personaBreakdown = rawPersonas
    .filter((p) => p.name)
    .map((p) => ({
      agent_id: p.agent_id ?? p.id ?? 0,
      name: p.name as string,
      role: p.role ?? '',
      completed: p.completed ?? 0,
      in_progress: p.in_progress ?? 0,
      blocked: p.blocked ?? 0,
    }))

  const rawProofs = raw.proofs ?? raw.proof_links ?? []
  const proofLinks = rawProofs
    .filter((p) => p.task_id !== undefined)
    .map((p) => ({
      task_id: p.task_id as number,
      title: p.title ?? 'Workforce task',
      proof_url: p.proof_url ?? p.url,
      delivered_at_iso:
        p.delivered_at_iso ?? p.delivered_at ?? new Date().toISOString(),
      agent_name: p.agent_name ?? p.agent,
    }))

  const statusLine =
    raw.status_line ??
    raw.status ??
    (attention.length === 0
      ? 'Status: clean.'
      : `Status: ${attention.length} ${attention.length === 1 ? 'item needs' : 'items need'} your eye.`)

  const nowIso = new Date().toISOString()
  const window: DailyBriefWindow =
    raw.date_range?.window === 'since-last-login'
      ? 'since-last-login'
      : fallback.window

  return {
    workspace_id: raw.workspace_id ?? fallback.workspaceId,
    workforce_slug: raw.workforce_slug ?? null,
    workforce_vertical: raw.workforce_vertical ?? raw.vertical ?? null,
    date_range: {
      from_iso: raw.date_range?.from_iso ?? nowIso,
      to_iso: raw.date_range?.to_iso ?? nowIso,
      window,
      label: raw.date_range?.label ?? (window === 'since-last-login' ? 'Since your last visit' : 'Since yesterday'),
    },
    headline: raw.headline ?? 'Daily Brief',
    narrative: raw.narrative ?? raw.summary ?? '',
    by_the_numbers: {
      tasks_handled: tasksHandled,
      approvals_requested: approvalsRequested,
      approvals_granted: approvalsGranted,
      tool_executions: toolExecutions,
      proofs_delivered: proofsDelivered,
      failed_executions: failedExecutions,
      estimated_hours_saved: Math.round(hoursSaved * 10) / 10,
    },
    attention,
    persona_breakdown: personaBreakdown,
    proof_links: proofLinks,
    status_line: statusLine,
    critical_banner: raw.critical_banner ?? null,
    empty_state: raw.empty_state ?? null,
    generated_at: raw.generated_at ?? nowIso,
    source: 'baseline-os',
  }
}
