/**
 * Baseline OS → Mission Control adapter for the ROI / Value Report.
 *
 * Translates Claude Code's v1 ROI payload into the Mission Control
 * `ValueReport` consumer shape. Pure mapping. Lane discipline:
 * Baseline OS calculates labor value / hours / cost; Mission Control
 * adapts for display only.
 *
 * Detection: any payload with `counters`, `roi`, or `lifetime_counters`
 * is treated as Claude's v1 ROI shape. Anything already matching the
 * consumer shape (`lifetime` + `by_persona` keys) is passed through.
 */

import type { ValueReport } from './aggregator'

interface BaselineOsRoiV1 {
  workspace_id?: number
  workforce_slug?: string | null
  workforce_vertical?: string | null
  vertical?: string | null
  workforce_installed_at?: string
  workforce_installed_at_iso?: string
  date_range?: {
    from_iso?: string
    to_iso?: string
    label?: string
    mode?: string
  }
  // Lifetime counters from Claude — same vocabulary as Daily Brief.
  counters?: {
    tasks_completed?: number
    tasks_in_flight?: number
    tasks_open?: number
    approvals_requested?: number
    approvals_granted?: number
    approvals_denied?: number
    approvals_handled?: number
    tool_executions?: number
    proofs_delivered?: number
    failures?: number
    blocked_refusals?: number
  }
  lifetime_counters?: BaselineOsRoiV1['counters']
  // ROI block from Claude — single source of formula truth.
  roi?: {
    hours_saved?: number
    labor_value_usd?: number
    workforce_cost_usd?: number
    net_value_usd?: number | null
    roi_multiple?: number | null
    labor_rate_usd_per_hour?: number
    formula?: string
    notes?: string
  }
  hours_saved?: number
  labor_value_usd?: number
  workforce_cost_usd?: number
  net_value_usd?: number | null
  roi_multiple?: number | null
  cost_basis?: {
    labor_rate_usd_per_hour?: number
    formula?: string
    notes?: string
  }
  personas?: Array<{
    agent_id?: number
    id?: number
    name?: string
    role?: string
    completed?: number
    hours_saved?: number
    labor_value_usd?: number
  }>
  by_persona?: BaselineOsRoiV1['personas']
  weekly_trend?: Array<{
    week_start?: string
    week_start_iso?: string
    tasks_completed?: number
    hours_saved?: number
  }>
  trend?: BaselineOsRoiV1['weekly_trend']
  empty_state?: ValueReport['empty_state']
  generated_at?: string
  source?: string
}

export function isClaudeBaselineOsRoi(p: unknown): p is BaselineOsRoiV1 {
  if (!p || typeof p !== 'object') return false
  return (
    'roi' in p ||
    'counters' in p ||
    'lifetime_counters' in p ||
    ('hours_saved' in p && !('lifetime' in p))
  )
}

export function adaptBaselineOsRoiToConsumer(
  raw: BaselineOsRoiV1,
  fallback: { workspaceId: number },
): ValueReport {
  const counters = raw.counters ?? raw.lifetime_counters ?? {}
  const roi = raw.roi ?? {}
  const nowIso = new Date().toISOString()

  const hoursSaved =
    roi.hours_saved ?? raw.hours_saved ?? 0
  const laborRate = roi.labor_rate_usd_per_hour ?? raw.cost_basis?.labor_rate_usd_per_hour ?? 65
  const laborValue =
    roi.labor_value_usd ?? raw.labor_value_usd ?? Math.round(hoursSaved * laborRate)
  const workforceCost = roi.workforce_cost_usd ?? raw.workforce_cost_usd ?? 0
  const netValue =
    roi.net_value_usd ?? raw.net_value_usd ?? (workforceCost > 0 ? laborValue - workforceCost : null)
  const roiMultiple =
    roi.roi_multiple ??
    raw.roi_multiple ??
    (workforceCost > 0 ? Math.round((laborValue / workforceCost) * 10) / 10 : null)

  const rawPersonas = raw.personas ?? raw.by_persona ?? []
  const byPersona = rawPersonas
    .filter((p) => p.name)
    .map((p) => {
      const hours = p.hours_saved ?? 0
      const value = p.labor_value_usd ?? Math.round(hours * laborRate)
      return {
        agent_id: p.agent_id ?? p.id ?? 0,
        name: p.name as string,
        role: p.role ?? '',
        completed: p.completed ?? 0,
        hours_saved: Math.round(hours * 10) / 10,
        labor_value_usd: value,
      }
    })

  const rawTrend = raw.weekly_trend ?? raw.trend ?? []
  const weeklyTrend = rawTrend.map((w) => ({
    week_start_iso: w.week_start_iso ?? w.week_start ?? nowIso,
    tasks_completed: w.tasks_completed ?? 0,
    hours_saved: Math.round((w.hours_saved ?? 0) * 10) / 10,
  }))

  return {
    workspace_id: raw.workspace_id ?? fallback.workspaceId,
    workforce_slug: raw.workforce_slug ?? null,
    workforce_vertical: raw.workforce_vertical ?? raw.vertical ?? null,
    workforce_installed_at_iso:
      raw.workforce_installed_at_iso ?? raw.workforce_installed_at ?? null,
    date_range: {
      from_iso: raw.date_range?.from_iso ?? nowIso,
      to_iso: raw.date_range?.to_iso ?? nowIso,
      label: raw.date_range?.label ?? 'Lifetime in this workspace',
    },
    lifetime: {
      tasks_completed: counters.tasks_completed ?? 0,
      tasks_open: counters.tasks_open ?? counters.tasks_in_flight ?? 0,
      approvals_handled:
        counters.approvals_handled ??
        (counters.approvals_granted ?? 0) + (counters.approvals_denied ?? 0),
      tool_executions: counters.tool_executions ?? 0,
      proofs_delivered: counters.proofs_delivered ?? 0,
      failed_executions: counters.failures ?? 0,
      estimated_hours_saved: Math.round(hoursSaved * 10) / 10,
      estimated_labor_value_usd: laborValue,
      workforce_cost_usd: workforceCost,
      net_value_usd: netValue,
      roi_multiple: roiMultiple,
    },
    by_persona: byPersona,
    weekly_trend: weeklyTrend,
    cost_basis: {
      labor_rate_usd_per_hour: laborRate,
      formula: roi.formula ?? raw.cost_basis?.formula ?? 'Baseline OS authoritative formula',
      notes:
        roi.notes ??
        raw.cost_basis?.notes ??
        'Hours and labor value sourced from Baseline OS — single formula across Daily Brief and Value Page.',
    },
    empty_state: raw.empty_state ?? null,
    generated_at: raw.generated_at ?? nowIso,
    source: 'baseline-os',
  }
}
