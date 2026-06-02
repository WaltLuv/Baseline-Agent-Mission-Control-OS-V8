/**
 * Value Reporting aggregator — "Show your boss" lifetime numbers.
 *
 * Mirror of `daily-brief/aggregator.ts` but lifetime-scoped instead of
 * windowed. Reads ONLY from Mission Control's own tables. NO decisioning,
 * no risk classification, no routing logic — Baseline OS owns those.
 *
 * When Baseline OS exposes a "lifetime value" endpoint later, the
 * consumer route swaps with no UI change (same pattern as daily-brief).
 */

import { getDatabase } from '@/lib/db'

const MINUTES_PER_COMPLETED_TASK = 25
const MINUTES_PER_TOOL_EXECUTION = 5
/** Mid-market US operator labor cost — placeholder. Future: tenant-config. */
const DEFAULT_LABOR_VALUE_PER_HOUR_USD = 65

export interface ValueReport {
  workspace_id: number
  workforce_slug: string | null
  workforce_vertical: string | null
  workforce_installed_at_iso: string | null
  /** "Lifetime since the workforce installed" or "Lifetime in this workspace". */
  date_range: { from_iso: string; to_iso: string; label: string }
  lifetime: {
    tasks_completed: number
    tasks_open: number
    approvals_handled: number
    tool_executions: number
    proofs_delivered: number
    failed_executions: number
    estimated_hours_saved: number
    estimated_labor_value_usd: number
    workforce_cost_usd: number
    net_value_usd: number | null
    roi_multiple: number | null
  }
  by_persona: Array<{
    agent_id: number
    name: string
    role: string
    completed: number
    hours_saved: number
    labor_value_usd: number
  }>
  /** Weekly rollup for the last 8 weeks (oldest → newest). */
  weekly_trend: Array<{
    week_start_iso: string
    tasks_completed: number
    hours_saved: number
  }>
  cost_basis: {
    labor_rate_usd_per_hour: number
    formula: string
    notes: string
  }
  empty_state: {
    headline: string
    detail: string
    cta_label: string
    cta_url: string
  } | null
  generated_at: string
  source: 'mission-control-fallback' | 'baseline-os'
}

export function aggregateValueReport(workspaceId: number): ValueReport {
  const db = getDatabase()
  const nowSec = Math.floor(Date.now() / 1000)

  // Detect installed workforce template.
  const installedRow = db
    .prepare(
      `SELECT key, value, updated_at FROM settings
       WHERE key LIKE ?
       ORDER BY updated_at ASC
       LIMIT 1`,
    )
    .get(`ws.${workspaceId}.workforce.installed.%`) as
    | { key: string; value: string; updated_at: number }
    | undefined

  const workforceSlug = installedRow
    ? installedRow.key.replace(`ws.${workspaceId}.workforce.installed.`, '')
    : null
  const workforceVertical = workforceSlug ? prettify(workforceSlug) : null
  const installedAtSec = installedRow?.updated_at ?? null

  if (!workforceSlug) {
    return {
      workspace_id: workspaceId,
      workforce_slug: null,
      workforce_vertical: null,
      workforce_installed_at_iso: null,
      date_range: { from_iso: '', to_iso: new Date(nowSec * 1000).toISOString(), label: '—' },
      lifetime: zeroLifetime(),
      by_persona: [],
      weekly_trend: [],
      cost_basis: {
        labor_rate_usd_per_hour: DEFAULT_LABOR_VALUE_PER_HOUR_USD,
        formula: '(tasks × 25min + tool_executions × 5min) ÷ 60 × labor_rate',
        notes: 'Default labor rate $65/hour pending tenant configuration.',
      },
      empty_state: {
        headline: 'No workforce installed yet.',
        detail:
          'Install a workforce template to start tracking value. Property Management is ready today.',
        cta_label: 'Install a workforce →',
        cta_url: '/app/activate',
      },
      generated_at: new Date(nowSec * 1000).toISOString(),
      source: 'mission-control-fallback',
    } as ValueReport
  }

  const fromSec = installedAtSec ?? nowSec - 30 * 86400

  // Lifetime numbers (since install).
  const tasksCompleted = (db
    .prepare(
      `SELECT COUNT(*) AS c FROM tasks
       WHERE workspace_id = ?
         AND ((completed_at IS NOT NULL AND completed_at >= ?)
              OR (status IN ('done','completed','closed') AND updated_at >= ?))`,
    )
    .get(workspaceId, fromSec, fromSec) as { c: number }).c

  const tasksOpen = (db
    .prepare(
      `SELECT COUNT(*) AS c FROM tasks
       WHERE workspace_id = ?
         AND status IN ('inbox','in_progress','blocked','review')`,
    )
    .get(workspaceId) as { c: number }).c

  const approvalsHandled = (db
    .prepare(
      `SELECT COUNT(*) AS c FROM tool_executions
       WHERE workspace_id = ? AND approval_required = 1
         AND (approved_at IS NOT NULL OR rejected_at IS NOT NULL)`,
    )
    .get(workspaceId) as { c: number }).c

  const toolExecutions = (db
    .prepare(
      `SELECT COUNT(*) AS c FROM tool_executions WHERE workspace_id = ? AND created_at >= ?`,
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

  const hoursSaved =
    Math.round(
      ((tasksCompleted * MINUTES_PER_COMPLETED_TASK +
        toolExecutions * MINUTES_PER_TOOL_EXECUTION) /
        60) *
        10,
    ) / 10

  const laborValueUsd = Math.round(hoursSaved * DEFAULT_LABOR_VALUE_PER_HOUR_USD)

  // Best-effort workforce cost (from existing usage_events / tokens
  // ledgers if available). Mission Control already aggregates a credit
  // spend per workspace — we read the latest value from `settings` if
  // present; otherwise 0.
  let workforceCostUsd = 0
  try {
    const usageRow = db
      .prepare(
        `SELECT SUM(cost_estimate) AS s FROM tool_executions WHERE workspace_id = ? AND cost_estimate IS NOT NULL`,
      )
      .get(workspaceId) as { s: number | null } | undefined
    if (usageRow?.s) workforceCostUsd = Math.round(Number(usageRow.s))
  } catch {
    /* tool_executions.cost_estimate is optional */
  }

  const netValueUsd = workforceCostUsd > 0 ? laborValueUsd - workforceCostUsd : null
  const roiMultiple =
    workforceCostUsd > 0 ? Math.round((laborValueUsd / workforceCostUsd) * 10) / 10 : null

  // Per-persona breakdown.
  const personas = db
    .prepare(
      `SELECT id, name, role FROM agents
       WHERE workspace_id = ? AND source = ?
       ORDER BY id`,
    )
    .all(workspaceId, `workforce-template:${workforceSlug}`) as Array<{
      id: number
      name: string
      role: string
    }>

  const byPersona = personas.map((p) => {
    const completed = (db
      .prepare(
        `SELECT COUNT(*) AS c FROM tasks
         WHERE workspace_id = ? AND assigned_to = ?
           AND ((completed_at IS NOT NULL AND completed_at >= ?)
                OR (status IN ('done','completed','closed') AND updated_at >= ?))`,
      )
      .get(workspaceId, p.name, fromSec, fromSec) as { c: number }).c
    const hours =
      Math.round(((completed * MINUTES_PER_COMPLETED_TASK) / 60) * 10) / 10
    const value = Math.round(hours * DEFAULT_LABOR_VALUE_PER_HOUR_USD)
    return {
      agent_id: p.id,
      name: p.name,
      role: p.role,
      completed,
      hours_saved: hours,
      labor_value_usd: value,
    }
  })

  // Weekly trend — last 8 weeks.
  const weeklyTrend: Array<{ week_start_iso: string; tasks_completed: number; hours_saved: number }> = []
  for (let i = 7; i >= 0; i--) {
    const weekEnd = nowSec - i * 7 * 86400
    const weekStart = weekEnd - 7 * 86400
    const wt = (db
      .prepare(
        `SELECT COUNT(*) AS c FROM tasks
         WHERE workspace_id = ?
           AND ((completed_at IS NOT NULL AND completed_at >= ? AND completed_at < ?)
                OR (status IN ('done','completed','closed') AND updated_at >= ? AND updated_at < ?))`,
      )
      .get(workspaceId, weekStart, weekEnd, weekStart, weekEnd) as { c: number }).c
    const we = (db
      .prepare(
        `SELECT COUNT(*) AS c FROM tool_executions
         WHERE workspace_id = ? AND created_at >= ? AND created_at < ?`,
      )
      .get(workspaceId, weekStart, weekEnd) as { c: number }).c
    const wh =
      Math.round(
        ((wt * MINUTES_PER_COMPLETED_TASK + we * MINUTES_PER_TOOL_EXECUTION) / 60) * 10,
      ) / 10
    weeklyTrend.push({
      week_start_iso: new Date(weekStart * 1000).toISOString(),
      tasks_completed: wt,
      hours_saved: wh,
    })
  }

  return {
    workspace_id: workspaceId,
    workforce_slug: workforceSlug,
    workforce_vertical: workforceVertical,
    workforce_installed_at_iso: installedAtSec
      ? new Date(installedAtSec * 1000).toISOString()
      : null,
    date_range: {
      from_iso: new Date(fromSec * 1000).toISOString(),
      to_iso: new Date(nowSec * 1000).toISOString(),
      label: installedAtSec
        ? `Since installed · ${formatDate(installedAtSec)}`
        : 'Lifetime in this workspace',
    },
    lifetime: {
      tasks_completed: tasksCompleted,
      tasks_open: tasksOpen,
      approvals_handled: approvalsHandled,
      tool_executions: toolExecutions,
      proofs_delivered: proofsDelivered,
      failed_executions: failedExecutions,
      estimated_hours_saved: hoursSaved,
      estimated_labor_value_usd: laborValueUsd,
      workforce_cost_usd: workforceCostUsd,
      net_value_usd: netValueUsd,
      roi_multiple: roiMultiple,
    },
    by_persona: byPersona,
    weekly_trend: weeklyTrend,
    cost_basis: {
      labor_rate_usd_per_hour: DEFAULT_LABOR_VALUE_PER_HOUR_USD,
      formula: '(tasks × 25min + tool_executions × 5min) ÷ 60 × labor_rate',
      notes:
        'Default labor rate $65/hour pending tenant configuration. Baseline OS will refine with task-type-aware estimates.',
    },
    empty_state: null,
    generated_at: new Date(nowSec * 1000).toISOString(),
    source: 'mission-control-fallback',
  }
}

function zeroLifetime() {
  return {
    tasks_completed: 0,
    tasks_open: 0,
    approvals_handled: 0,
    tool_executions: 0,
    proofs_delivered: 0,
    failed_executions: 0,
    estimated_hours_saved: 0,
    estimated_labor_value_usd: 0,
    workforce_cost_usd: 0,
    net_value_usd: null,
    roi_multiple: null,
  }
}

function prettify(slug: string): string {
  return slug
    .split('-')
    .map((w) => (w === 'cpa' ? 'CPA' : w[0].toUpperCase() + w.slice(1)))
    .join(' ')
}

function formatDate(sec: number): string {
  const d = new Date(sec * 1000)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}
