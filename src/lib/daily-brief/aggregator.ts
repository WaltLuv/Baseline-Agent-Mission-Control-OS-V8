/**
 * Mission Control fallback Daily Brief aggregator.
 *
 * Strict scope: reads ONLY from Mission Control's own tables
 * (tasks, activities, tool_executions, audit_log, agents, users,
 * settings). It does NOT make decisions, classify risk, route work, or
 * generate proof — those belong to Baseline OS. When Claude's Baseline
 * OS exposes a brief endpoint, the consumer route will prefer it and
 * skip this aggregator entirely.
 */

import { getDatabase } from '@/lib/db'
import type {
  DailyBriefAttention,
  DailyBriefByTheNumbers,
  DailyBriefPayload,
  DailyBriefPersona,
  DailyBriefProofLink,
  DailyBriefWindow,
} from './types'

interface AggregateArgs {
  workspaceId: number
  userId: number
  window: DailyBriefWindow
}

/** Average minutes saved per completed unit of work. Matches the
 *  5-min/credit assumption documented in the existing briefing. */
const MINUTES_PER_COMPLETED_TASK = 25
const MINUTES_PER_TOOL_EXECUTION = 5
const STALE_TASK_THRESHOLD_HOURS = 48

export function aggregateDailyBrief(args: AggregateArgs): DailyBriefPayload {
  const { workspaceId, userId, window } = args
  const db = getDatabase()
  const nowSec = Math.floor(Date.now() / 1000)

  // ── Date range ─────────────────────────────────────────────────
  let fromSec: number
  let label: string
  if (window === 'since-last-login') {
    const u = db
      .prepare(`SELECT last_login_at FROM users WHERE id = ?`)
      .get(userId) as { last_login_at: number | null } | undefined
    // Fall back to 24h if we don't have a prior login on file.
    fromSec = u?.last_login_at && u.last_login_at < nowSec - 60 ? u.last_login_at : nowSec - 86400
    label = u?.last_login_at
      ? `Since your last visit · ${formatRelative(u.last_login_at, nowSec)}`
      : `Since yesterday`
  } else {
    fromSec = nowSec - 86400
    label = 'Since yesterday'
  }

  // ── Detect installed workforce template (Property Management today) ──
  const installedRow = db
    .prepare(
      `SELECT key, value FROM settings
       WHERE key LIKE ?
       ORDER BY updated_at DESC
       LIMIT 1`,
    )
    .get(`ws.${workspaceId}.workforce.installed.%`) as { key: string; value: string } | undefined

  const workforceSlug = installedRow
    ? installedRow.key.replace(`ws.${workspaceId}.workforce.installed.`, '')
    : null
  const workforceVertical = workforceSlug ? prettifyVertical(workforceSlug) : null

  // ── Empty state: no workforce installed → render onboarding ──────
  if (!workforceSlug) {
    return emptyBrief({
      workspaceId,
      window,
      fromSec,
      toSec: nowSec,
      label,
      reason: 'no-workforce',
    })
  }

  // ── Numbers ──────────────────────────────────────────────────────
  const tasksHandled = (db
    .prepare(
      `SELECT COUNT(*) AS c FROM tasks
       WHERE workspace_id = ?
         AND ((completed_at IS NOT NULL AND completed_at >= ?)
              OR (status IN ('done','completed','closed') AND updated_at >= ?))`,
    )
    .get(workspaceId, fromSec, fromSec) as { c: number }).c

  const approvalsRequested = (db
    .prepare(
      `SELECT COUNT(*) AS c FROM tool_executions
       WHERE workspace_id = ? AND approval_required = 1
         AND COALESCE(approval_requested_at, created_at) >= ?`,
    )
    .get(workspaceId, fromSec) as { c: number }).c

  const approvalsGranted = (db
    .prepare(
      `SELECT COUNT(*) AS c FROM tool_executions
       WHERE workspace_id = ? AND approved_at IS NOT NULL AND approved_at >= ?`,
    )
    .get(workspaceId, fromSec) as { c: number }).c

  const toolExecutions = (db
    .prepare(
      `SELECT COUNT(*) AS c FROM tool_executions
       WHERE workspace_id = ? AND created_at >= ?`,
    )
    .get(workspaceId, fromSec) as { c: number }).c

  const proofsDelivered = (db
    .prepare(
      `SELECT COUNT(*) AS c FROM tool_executions
       WHERE workspace_id = ? AND proof_url IS NOT NULL AND proof_url != ''
         AND COALESCE(completed_at, created_at) >= ?`,
    )
    .get(workspaceId, fromSec) as { c: number }).c

  const failedExecutions = (db
    .prepare(
      `SELECT COUNT(*) AS c FROM tool_executions
       WHERE workspace_id = ?
         AND (status = 'failed' OR exit_code NOT IN (0))
         AND COALESCE(completed_at, created_at) >= ?`,
    )
    .get(workspaceId, fromSec) as { c: number }).c

  const estimatedHoursSaved =
    Math.round(
      ((tasksHandled * MINUTES_PER_COMPLETED_TASK +
        toolExecutions * MINUTES_PER_TOOL_EXECUTION) /
        60) *
        10,
    ) / 10

  const numbers: DailyBriefByTheNumbers = {
    tasks_handled: tasksHandled,
    approvals_requested: approvalsRequested,
    approvals_granted: approvalsGranted,
    tool_executions: toolExecutions,
    proofs_delivered: proofsDelivered,
    failed_executions: failedExecutions,
    estimated_hours_saved: estimatedHoursSaved,
  }

  // ── Attention items ──────────────────────────────────────────────
  const attention: DailyBriefAttention[] = []

  const pendingApprovals = db
    .prepare(
      `SELECT te.id, te.task_id, te.cli_tool_id, te.created_at, t.title
       FROM tool_executions te
       LEFT JOIN tasks t ON t.id = te.task_id
       WHERE te.workspace_id = ?
         AND te.approval_required = 1
         AND te.approved_at IS NULL
         AND te.rejected_at IS NULL
       ORDER BY te.created_at ASC
       LIMIT 5`,
    )
    .all(workspaceId) as Array<{
      id: number
      task_id: number | null
      cli_tool_id: string
      created_at: number
      title: string | null
    }>
  for (const p of pendingApprovals) {
    attention.push({
      kind: 'approval_pending',
      title: p.title ? p.title : `${p.cli_tool_id} action`,
      detail: 'Needs your approval before the workforce can move forward.',
      task_id: p.task_id ?? undefined,
      since_iso: new Date(p.created_at * 1000).toISOString(),
      url: '/app/tool-executions?status=pending_approval',
    })
  }

  const failedRows = db
    .prepare(
      `SELECT te.id, te.task_id, te.cli_tool_id, te.stderr_summary, te.completed_at, te.created_at, t.title, a.name as agent_name
       FROM tool_executions te
       LEFT JOIN tasks t ON t.id = te.task_id
       LEFT JOIN agents a ON a.id = te.agent_id
       WHERE te.workspace_id = ?
         AND (te.status = 'failed' OR te.exit_code NOT IN (0))
         AND COALESCE(te.completed_at, te.created_at) >= ?
       ORDER BY te.created_at DESC
       LIMIT 5`,
    )
    .all(workspaceId, fromSec) as Array<{
      id: number
      task_id: number | null
      cli_tool_id: string
      stderr_summary: string | null
      completed_at: number | null
      created_at: number
      title: string | null
      agent_name: string | null
    }>
  for (const f of failedRows) {
    attention.push({
      kind: 'failed_execution',
      title: `${f.agent_name ? f.agent_name + ' · ' : ''}${f.cli_tool_id}${f.title ? ' — ' + f.title : ''}`,
      detail: f.stderr_summary ?? 'Execution failed. Review the tool log.',
      task_id: f.task_id ?? undefined,
      since_iso: new Date((f.completed_at ?? f.created_at) * 1000).toISOString(),
      url: '/app/tool-executions',
    })
  }

  const criticalTasks = db
    .prepare(
      `SELECT id, title, priority, updated_at FROM tasks
       WHERE workspace_id = ? AND priority = 'critical'
         AND status NOT IN ('done','completed','closed','cancelled')
       ORDER BY updated_at DESC LIMIT 3`,
    )
    .all(workspaceId) as Array<{ id: number; title: string; priority: string; updated_at: number }>
  for (const c of criticalTasks) {
    attention.push({
      kind: 'critical_workflow',
      title: c.title,
      detail: 'Critical-priority workflow waiting on action.',
      task_id: c.id,
      since_iso: new Date(c.updated_at * 1000).toISOString(),
      url: `/app/tasks/kanban#task-${c.id}`,
    })
  }

  const staleCutoff = nowSec - STALE_TASK_THRESHOLD_HOURS * 3600
  const staleTasks = db
    .prepare(
      `SELECT id, title, updated_at FROM tasks
       WHERE workspace_id = ?
         AND status IN ('inbox','in_progress','blocked','review')
         AND updated_at < ?
       ORDER BY updated_at ASC
       LIMIT 3`,
    )
    .all(workspaceId, staleCutoff) as Array<{ id: number; title: string; updated_at: number }>
  for (const s of staleTasks) {
    attention.push({
      kind: 'stale_task',
      title: s.title,
      detail: `Hasn't moved in ${Math.round((nowSec - s.updated_at) / 3600)} hours.`,
      task_id: s.id,
      since_iso: new Date(s.updated_at * 1000).toISOString(),
      url: `/app/tasks/kanban#task-${s.id}`,
    })
  }

  // ── Persona breakdown (only the workforce-template agents) ───────
  const personas = db
    .prepare(
      `SELECT id, name, role FROM agents
       WHERE workspace_id = ? AND source = ?
       ORDER BY id`,
    )
    .all(workspaceId, `workforce-template:${workforceSlug}`) as Array<{ id: number; name: string; role: string }>

  const personaBreakdown: DailyBriefPersona[] = personas.map((p) => {
    const completed = (db
      .prepare(
        `SELECT COUNT(*) AS c FROM tasks
         WHERE workspace_id = ? AND assigned_to = ?
           AND ((completed_at IS NOT NULL AND completed_at >= ?)
                OR (status IN ('done','completed','closed') AND updated_at >= ?))`,
      )
      .get(workspaceId, p.name, fromSec, fromSec) as { c: number }).c
    const inProgress = (db
      .prepare(
        `SELECT COUNT(*) AS c FROM tasks
         WHERE workspace_id = ? AND assigned_to = ? AND status = 'in_progress'`,
      )
      .get(workspaceId, p.name) as { c: number }).c
    const blocked = (db
      .prepare(
        `SELECT COUNT(*) AS c FROM tasks
         WHERE workspace_id = ? AND assigned_to = ? AND status IN ('blocked','review')`,
      )
      .get(workspaceId, p.name) as { c: number }).c
    return { agent_id: p.id, name: p.name, role: p.role, completed, in_progress: inProgress, blocked }
  })

  // ── Proof links (at most 6) ──────────────────────────────────────
  const proofRows = db
    .prepare(
      `SELECT te.task_id, te.proof_url, te.completed_at, te.created_at, t.title, a.name as agent_name
       FROM tool_executions te
       LEFT JOIN tasks t ON t.id = te.task_id
       LEFT JOIN agents a ON a.id = te.agent_id
       WHERE te.workspace_id = ? AND te.proof_url IS NOT NULL AND te.proof_url != ''
         AND COALESCE(te.completed_at, te.created_at) >= ?
       ORDER BY te.created_at DESC
       LIMIT 6`,
    )
    .all(workspaceId, fromSec) as Array<{
      task_id: number | null
      proof_url: string
      completed_at: number | null
      created_at: number
      title: string | null
      agent_name: string | null
    }>
  const proofLinks: DailyBriefProofLink[] = proofRows
    .filter((r) => r.task_id !== null)
    .map((r) => ({
      task_id: r.task_id!,
      title: r.title ?? 'Workforce task',
      proof_url: r.proof_url,
      delivered_at_iso: new Date((r.completed_at ?? r.created_at) * 1000).toISOString(),
      agent_name: r.agent_name ?? undefined,
    }))

  // ── Narrative + status line ──────────────────────────────────────
  const totalItems =
    tasksHandled + approvalsRequested + proofsDelivered + failedExecutions
  const attentionCount = attention.length
  const headline = totalItems
    ? `Your ${workforceVertical} workforce handled ${tasksHandled} ${tasksHandled === 1 ? 'task' : 'tasks'} ${window === 'since-last-login' ? 'since you were last here' : 'since yesterday'}.`
    : `Quiet ${window === 'since-last-login' ? 'stretch' : 'morning'}. Your ${workforceVertical} workforce is standing by.`

  const narrative = buildNarrative({
    vertical: workforceVertical ?? 'AI',
    numbers,
    attentionCount,
    personaBreakdown,
  })

  const statusLine = attentionCount === 0
    ? 'Status: clean.'
    : `Status: ${attentionCount} ${attentionCount === 1 ? 'item needs' : 'items need'} your eye.`

  // ── Critical banner (only the truly severe issues) ───────────────
  const criticalCount =
    failedExecutions +
    attention.filter((a) => a.kind === 'critical_workflow').length
  const criticalBanner =
    criticalCount > 0
      ? {
          headline:
            criticalCount === 1
              ? `1 critical item needs you now.`
              : `${criticalCount} critical items need you now.`,
          detail:
            failedExecutions > 0
              ? 'A failed execution may be blocking downstream work.'
              : 'A critical-priority workflow is waiting on action.',
          action_url: failedExecutions > 0 ? '/app/tool-executions' : '/app/tasks/kanban',
          action_label: failedExecutions > 0 ? 'Review failed runs →' : 'Open critical task →',
        }
      : null

  return {
    workspace_id: workspaceId,
    workforce_slug: workforceSlug,
    workforce_vertical: workforceVertical,
    date_range: {
      from_iso: new Date(fromSec * 1000).toISOString(),
      to_iso: new Date(nowSec * 1000).toISOString(),
      window,
      label,
    },
    headline,
    narrative,
    by_the_numbers: numbers,
    attention,
    persona_breakdown: personaBreakdown,
    proof_links: proofLinks,
    status_line: statusLine,
    critical_banner: criticalBanner,
    empty_state: null,
    generated_at: new Date(nowSec * 1000).toISOString(),
    source: 'mission-control-fallback',
  }
}

// ─────────────────────────────────────────────────────────────────
function buildNarrative(args: {
  vertical: string
  numbers: DailyBriefByTheNumbers
  attentionCount: number
  personaBreakdown: DailyBriefPersona[]
}): string {
  const { numbers, attentionCount, personaBreakdown } = args
  const verbs: string[] = []
  if (numbers.tasks_handled > 0) verbs.push(`closed ${numbers.tasks_handled} ${numbers.tasks_handled === 1 ? 'task' : 'tasks'}`)
  if (numbers.tool_executions > 0)
    verbs.push(`ran ${numbers.tool_executions} ${numbers.tool_executions === 1 ? 'tool execution' : 'tool executions'}`)
  if (numbers.proofs_delivered > 0)
    verbs.push(`delivered ${numbers.proofs_delivered} ${numbers.proofs_delivered === 1 ? 'proof' : 'proofs'}`)
  if (numbers.approvals_granted > 0) verbs.push(`completed ${numbers.approvals_granted} approved ${numbers.approvals_granted === 1 ? 'action' : 'actions'}`)
  if (numbers.failed_executions > 0)
    verbs.push(`logged ${numbers.failed_executions} ${numbers.failed_executions === 1 ? 'failure' : 'failures'}`)

  const lead = personaBreakdown
    .filter((p) => p.completed > 0)
    .sort((a, b) => b.completed - a.completed)[0]

  const personaSentence = lead
    ? `${lead.name.split(' ')[0]} carried the load with ${lead.completed} ${lead.completed === 1 ? 'item' : 'items'} closed.`
    : ''

  if (verbs.length === 0) {
    return `While you were focused elsewhere, your workforce held position — no closed work yet, but the queue is staged and ready.${
      personaSentence ? ' ' + personaSentence : ''
    }`
  }

  const verbList = formatList(verbs)
  const attentionSentence =
    attentionCount === 0
      ? ''
      : ` ${attentionCount} ${attentionCount === 1 ? 'item' : 'items'} ${
          attentionCount === 1 ? 'needs' : 'need'
        } your review before they move forward.`

  return `While you were focused elsewhere, your workforce ${verbList}.${
    personaSentence ? ' ' + personaSentence : ''
  }${attentionSentence}`
}

function formatList(items: string[]): string {
  if (items.length === 0) return ''
  if (items.length === 1) return items[0]
  if (items.length === 2) return `${items[0]} and ${items[1]}`
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`
}

function formatRelative(then: number, now: number): string {
  const deltaSec = Math.max(0, now - then)
  const hours = Math.round(deltaSec / 3600)
  if (hours < 1) return 'a few minutes ago'
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  return `${days}d ago`
}

function prettifyVertical(slug: string): string {
  return slug
    .split('-')
    .map((w) => (w === 'cpa' ? 'CPA' : w[0].toUpperCase() + w.slice(1)))
    .join(' ')
}

function emptyBrief(args: {
  workspaceId: number
  window: DailyBriefWindow
  fromSec: number
  toSec: number
  label: string
  reason: 'no-workforce'
}): DailyBriefPayload {
  return {
    workspace_id: args.workspaceId,
    workforce_slug: null,
    workforce_vertical: null,
    date_range: {
      from_iso: new Date(args.fromSec * 1000).toISOString(),
      to_iso: new Date(args.toSec * 1000).toISOString(),
      window: args.window,
      label: args.label,
    },
    headline: 'No workforce yet.',
    narrative:
      'Install your first workforce template to start receiving daily briefs. Property Management is ready today; other verticals are rolling out soon.',
    by_the_numbers: {
      tasks_handled: 0,
      approvals_requested: 0,
      approvals_granted: 0,
      tool_executions: 0,
      proofs_delivered: 0,
      failed_executions: 0,
      estimated_hours_saved: 0,
    },
    attention: [],
    persona_breakdown: [],
    proof_links: [],
    status_line: 'Status: workforce not yet installed.',
    critical_banner: null,
    empty_state: {
      headline: 'Install your first workforce to start receiving daily briefs.',
      detail:
        'The Daily Brief summarises what your AI workforce did since yesterday. Install a workforce template to begin.',
      cta_label: 'Install a workforce →',
      cta_url: '/app/activate',
    },
    generated_at: new Date(args.toSec * 1000).toISOString(),
    source: 'mission-control-fallback',
  }
}
