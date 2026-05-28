/**
 * AI Employee Life Signals — derived, real-time presence + behavior
 * model that makes the workforce feel alive without faking activity.
 *
 * Signals are derived from existing data sources:
 *   - presence:        agent.status (busy / idle / error / offline) + heartbeat age
 *   - currentlyWorkingOn: agent.last_activity OR open task title
 *   - confidence:      derived from approval rate + quality gate pass rate
 *   - workloadPressure: open task count vs. team median
 *   - responseSpeed:   minutes between status updates (median)
 *   - collaboration:   agents the employee co-worked tasks with this week
 *   - escalation:      open `needs-review` items requiring operator action
 *   - memoryUsed:      most recent memory rationale citation
 *   - skillsActive:    skills installed and used in last 24h
 *   - activeWorkflow:  the current workflow run if any
 *   - recentWin:       most recent closed task in last 24h
 *   - currentBlocker:  oldest blocked task
 *
 * In **demo mode**, signals come from `demo-narratives.ts` so the
 * workspace feels mid-operation the moment a prospect lands on it.
 *
 * In **live mode**, signals are computed from the SQLite store. If
 * nothing is happening, we surface honest copy ("Available · standing
 * by") rather than fabricated activity.
 */

export type PresenceState =
  | 'online'
  | 'working'
  | 'waiting-for-approval'
  | 'blocked'
  | 'idle'
  | 'needs-attention'

export type ConfidenceBand = 'high' | 'medium' | 'low'

export interface AIEmployeeLifeSignal {
  agentSlug: string
  agentName: string
  presence: PresenceState
  currentlyWorkingOn: string | null
  confidence: ConfidenceBand
  workloadPressure: 'light' | 'balanced' | 'heavy'
  /** Median minutes between this employee's status updates this week. */
  responseSpeedMin: number | null
  /** Names of AI employees this one has collaborated with this week. */
  collaborators: string[]
  escalation: { title: string; severity: 'low' | 'medium' | 'high' } | null
  memoryUsed: { source: string; snippet: string } | null
  skillsActive: string[]
  activeWorkflow: string | null
  recentWin: string | null
  currentBlocker: string | null
}

const PRESENCE_COPY: Record<PresenceState, string> = {
  online: 'Online',
  working: 'Working',
  'waiting-for-approval': 'Waiting for approval',
  blocked: 'Blocked',
  idle: 'Idle',
  'needs-attention': 'Needs attention',
}

export function presenceLabel(p: PresenceState): string {
  return PRESENCE_COPY[p]
}

const PRESENCE_TONE: Record<PresenceState, string> = {
  online: 'text-emerald-300 border-emerald-500/40 bg-emerald-500/10',
  working: 'text-emerald-300 border-emerald-500/40 bg-emerald-500/10',
  'waiting-for-approval': 'text-amber-300 border-amber-500/40 bg-amber-500/10',
  blocked: 'text-red-300 border-red-500/40 bg-red-500/10',
  idle: 'text-sky-300 border-sky-500/40 bg-sky-500/10',
  'needs-attention': 'text-red-300 border-red-500/40 bg-red-500/10',
}

export function presenceTone(p: PresenceState): string {
  return PRESENCE_TONE[p]
}

const CONFIDENCE_TONE: Record<ConfidenceBand, string> = {
  high: 'text-emerald-400',
  medium: 'text-amber-400',
  low: 'text-red-400',
}
export function confidenceTone(b: ConfidenceBand): string {
  return CONFIDENCE_TONE[b]
}
