/**
 * Daily Brief — handoff contract.
 *
 * Source-of-truth ownership:
 *   • Baseline OS (Claude Code) owns the *production* aggregator and may
 *     return this exact shape with `source: 'baseline-os'`.
 *   • Mission Control (this file) defines the consumer contract and ships
 *     a thin local fallback (`source: 'mission-control-fallback'`) that
 *     reads ONLY from Mission Control's own tables so the UI is never
 *     blocked on Baseline OS availability.
 *
 * Whenever Baseline OS surfaces a brief endpoint / file / CLI output that
 * matches this type, the consumer route swaps without UI changes.
 */

export type DailyBriefWindow = 'since-yesterday' | 'since-last-login'

export interface DailyBriefDateRange {
  from_iso: string
  to_iso: string
  window: DailyBriefWindow
  /** Human-friendly description: "Since yesterday at 6:00 AM" */
  label: string
}

export interface DailyBriefByTheNumbers {
  tasks_handled: number
  approvals_requested: number
  approvals_granted: number
  tool_executions: number
  proofs_delivered: number
  failed_executions: number
  estimated_hours_saved: number
}

export type AttentionKind =
  | 'approval_pending'
  | 'failed_execution'
  | 'critical_workflow'
  | 'stale_task'
  | 'blocked_task'

export interface DailyBriefAttention {
  kind: AttentionKind
  title: string
  detail?: string
  task_id?: number
  agent_id?: number
  since_iso?: string
  url: string
}

export interface DailyBriefPersona {
  agent_id: number
  name: string
  role: string
  completed: number
  in_progress: number
  blocked: number
}

export interface DailyBriefProofLink {
  task_id: number
  title: string
  proof_url?: string
  delivered_at_iso: string
  agent_name?: string
}

export interface DailyBriefCriticalBanner {
  headline: string
  detail: string
  action_url: string
  action_label: string
}

export interface DailyBriefPayload {
  workspace_id: number
  /** Slug of the workforce template this brief is scoped to, or null when no template installed. */
  workforce_slug: string | null
  /** Customer-facing vertical label ("Property Management") or null. */
  workforce_vertical: string | null
  date_range: DailyBriefDateRange
  headline: string
  narrative: string
  by_the_numbers: DailyBriefByTheNumbers
  attention: DailyBriefAttention[]
  persona_breakdown: DailyBriefPersona[]
  proof_links: DailyBriefProofLink[]
  /** "Status: clean." or "Status: 2 items need your eye." */
  status_line: string
  /** Top-of-brief red banner shown when at least one truly critical issue exists. */
  critical_banner: DailyBriefCriticalBanner | null
  /** Set when the brief is empty (no workforce installed, no activity). */
  empty_state: {
    headline: string
    detail: string
    cta_label: string
    cta_url: string
  } | null
  generated_at: string
  source: 'baseline-os' | 'mission-control-fallback'
}
