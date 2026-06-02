'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'

/**
 * Router Decision → Execution breadcrumb.
 *
 * Display-only. Mission Control SUPERVISES. The Workforce Router
 * (Baseline OS Phase 2) writes the decision via POST /api/tasks/:id/routing.
 * Tool Executions (Baseline OS Phase 3) write lifecycle via
 * POST/PATCH /api/tool-executions. We just read both and render the
 * five-stage status chain the directive mandates:
 *
 *   Task Created → Router Decision → Runtime Assigned → Execution → Complete
 *
 * Empty render returns `null`. The component never blocks the Task Detail
 * pane; it only appears once the Router has touched the task.
 */

interface RouterDecision {
  assigned_runtime: string | null
  selected_tool: string | null
  selected_skill: string | null
  routing_reason: string | null
  routing_confidence: number | null
  router_approval_required: 0 | 1
  router_decided_at: number | null
}

type ExecutionStatus =
  | 'pending'
  | 'awaiting_approval'
  | 'approved'
  | 'rejected'
  | 'blocked'
  | 'running'
  | 'completed'
  | 'failed'
type Risk = 'low' | 'medium' | 'high' | 'blocked'

interface ToolExecution {
  id: number
  cli_tool_id: string
  command_name: string
  command_args_redacted: string | null
  status: ExecutionStatus
  risk: Risk
  approval_required: 0 | 1
  exit_code: number | null
  proof_url: string | null
  cost_estimate: number | null
  started_at: number | null
  completed_at: number | null
  audit_event_id: number | null
  // Phase 4 approval supervision fields.
  approval_requested_by: string | null
  approval_requested_at: number | null
  approval_reason: string | null
  approval_audit_id: number | null
  approved_by: string | null
  approved_at: number | null
  rejected_by: string | null
  rejected_at: number | null
  rejection_reason: string | null
}

interface Props {
  taskId: number
  /** Optional initial decision so we render synchronously when the parent
   * already has the task. We still refetch in the background. */
  initialDecision?: RouterDecision
}

const STATUS_BADGE: Record<ExecutionStatus, string> = {
  pending: 'bg-white/[0.04] text-white/60 border-white/[0.1]',
  awaiting_approval: 'bg-amber-500/15 text-amber-200 border-amber-500/30',
  approved: 'bg-violet-500/15 text-violet-200 border-violet-500/30',
  rejected: 'bg-rose-500/15 text-rose-200 border-rose-500/30',
  blocked: 'bg-red-700/30 text-red-200 border-red-500/40',
  running: 'bg-sky-500/15 text-sky-200 border-sky-500/30',
  completed: 'bg-emerald-500/15 text-emerald-200 border-emerald-500/30',
  failed: 'bg-red-500/20 text-red-200 border-red-500/40',
}

export function TaskRouterDecision({ taskId, initialDecision }: Props) {
  const [decision, setDecision] = useState<RouterDecision | null>(initialDecision ?? null)
  const [executions, setExecutions] = useState<ToolExecution[]>([])
  const [loaded, setLoaded] = useState(false)

  const load = useCallback(async () => {
    try {
      const [taskRes, execRes] = await Promise.all([
        fetch(`/api/tasks/${taskId}`, { cache: 'no-store' }),
        fetch(`/api/tool-executions?task_id=${taskId}&limit=50`, { cache: 'no-store' }),
      ])
      if (taskRes.ok) {
        const d = (await taskRes.json()) as { task?: Partial<RouterDecision> }
        if (d.task) {
          setDecision({
            assigned_runtime: d.task.assigned_runtime ?? null,
            selected_tool: d.task.selected_tool ?? null,
            selected_skill: d.task.selected_skill ?? null,
            routing_reason: d.task.routing_reason ?? null,
            routing_confidence: d.task.routing_confidence ?? null,
            router_approval_required: (d.task.router_approval_required ?? 0) as 0 | 1,
            router_decided_at: d.task.router_decided_at ?? null,
          })
        }
      }
      if (execRes.ok) {
        const data = (await execRes.json()) as { items: ToolExecution[] }
        setExecutions(data.items ?? [])
      }
    } finally {
      setLoaded(true)
    }
  }, [taskId])

  useEffect(() => {
    load()
    const t = setInterval(load, 15_000)
    return () => clearInterval(t)
  }, [load])

  // Nothing to display until the Router has touched this task and there's
  // also no execution chain. If only one of them has data, render that.
  const hasDecision = decision?.router_decided_at != null
  const hasExec = executions.length > 0
  if (!loaded) return null
  if (!hasDecision && !hasExec) return null

  return (
    <section
      data-testid={`task-router-decision-${taskId}`}
      className="rounded-lg border border-violet-500/15 bg-violet-500/[0.03] p-4"
    >
      <header className="flex items-center justify-between mb-3">
        <p className="text-[10px] uppercase tracking-wider text-violet-300/80 font-mono">
          Workforce Router · supervised by Mission Control
        </p>
        {decision?.router_decided_at && (
          <span className="text-[10px] text-white/45 font-mono">
            decided {timeAgo(decision.router_decided_at)}
          </span>
        )}
      </header>

      {/* Five-stage breadcrumb */}
      {hasDecision && decision && (
        <ol className="flex items-stretch gap-1.5 mb-3 overflow-x-auto" data-testid="router-breadcrumb">
          <BreadcrumbStep label="Task" state="done" />
          <BreadcrumbStep label="Router" state="done" detail={confidenceLabel(decision.routing_confidence)} />
          <BreadcrumbStep
            label={decision.assigned_runtime ?? 'Runtime'}
            state="done"
            mono
          />
          {(() => {
            const latest = executions[0]
            if (!latest) {
              return (
                <BreadcrumbStep
                  label={decision.selected_tool ?? 'Tool'}
                  state={decision.router_approval_required ? 'waiting' : 'queued'}
                  mono
                />
              )
            }
            return (
              <>
                <BreadcrumbStep label={latest.cli_tool_id} state={execStepState(latest)} mono />
                <BreadcrumbStep
                  label={execTerminalLabel(latest)}
                  state={execTerminalState(latest)}
                />
              </>
            )
          })()}
        </ol>
      )}

      {/* Decision summary */}
      {hasDecision && decision && (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs mb-3">
          {decision.selected_skill && (
            <>
              <dt className="text-white/45 uppercase tracking-wider text-[10px] font-mono">Skill</dt>
              <dd className="text-white/80 font-mono">{decision.selected_skill}</dd>
            </>
          )}
          {decision.routing_confidence != null && (
            <>
              <dt className="text-white/45 uppercase tracking-wider text-[10px] font-mono">Confidence</dt>
              <dd className="text-white/80 font-mono">{Math.round(decision.routing_confidence * 100)}%</dd>
            </>
          )}
          {decision.router_approval_required === 1 && (
            <>
              <dt className="text-white/45 uppercase tracking-wider text-[10px] font-mono">Approval</dt>
              <dd className="text-amber-200 font-mono">required</dd>
            </>
          )}
        </dl>
      )}
      {hasDecision && decision?.routing_reason && (
        <p className="text-xs text-white/70 italic leading-relaxed mb-3 px-2.5 py-2 rounded-md bg-white/[0.02] border-l-2 border-violet-400/40">
          &ldquo;{decision.routing_reason}&rdquo;
        </p>
      )}

      {/* Execution ledger entries linked to this task */}
      {hasExec && (
        <div className="space-y-1.5" data-testid={`task-executions-${taskId}`}>
          <p className="text-[10px] uppercase tracking-wider text-white/45 font-mono">
            Tool Executions ({executions.length})
          </p>
          {executions.slice(0, 5).map((e) => (
            <div
              key={e.id}
              data-testid={`task-execution-${e.id}`}
              className="rounded-md bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.16] text-xs transition-colors"
            >
              <Link
                href={`/app/tool-executions`}
                className="flex items-center gap-2 px-2.5 py-1.5"
              >
                <span
                  className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded border font-mono ${STATUS_BADGE[e.status]}`}
                >
                  {e.status.replace('_', ' ')}
                </span>
                <span className="font-mono text-white/80 truncate flex-1">
                  {e.cli_tool_id} · {e.command_name}
                </span>
                {e.exit_code != null && (
                  <span className={e.exit_code === 0 ? 'text-emerald-300/80 font-mono' : 'text-rose-300/80 font-mono'}>
                    exit {e.exit_code}
                  </span>
                )}
                {e.cost_estimate != null && (
                  <span className="text-white/45 font-mono">~${e.cost_estimate.toFixed(3)}</span>
                )}
                {e.proof_url && (
                  <a
                    href={e.proof_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-violet-300/80 hover:text-violet-200 font-mono"
                    onClick={(ev) => ev.stopPropagation()}
                  >
                    proof ↗
                  </a>
                )}
              </Link>
              {/* Phase 4: Approval supervision footer. Only renders when an
                  approval was actually required + decided. */}
              {(e.approved_by || e.rejected_by) && (
                <div
                  data-testid={`task-execution-${e.id}-approval`}
                  className="px-2.5 py-1.5 border-t border-white/[0.04] text-[11px] flex flex-wrap items-center gap-x-2 gap-y-0.5"
                >
                  {e.approved_by && (
                    <span className="text-emerald-300/85 font-mono">
                      ✓ approved by {e.approved_by}
                      {e.approved_at != null && <span className="text-white/45"> · {timeAgo(e.approved_at)}</span>}
                    </span>
                  )}
                  {e.rejected_by && (
                    <span className="text-rose-300/85 font-mono">
                      ✕ rejected by {e.rejected_by}
                      {e.rejected_at != null && <span className="text-white/45"> · {timeAgo(e.rejected_at)}</span>}
                    </span>
                  )}
                  {e.approval_audit_id != null && (
                    <span className="text-white/35 font-mono">audit #{e.approval_audit_id}</span>
                  )}
                  {(e.approval_reason || e.rejection_reason) && (
                    <span className="text-white/65 italic w-full mt-0.5">
                      &ldquo;{(e.approval_reason ?? e.rejection_reason)!.slice(0, 160)}&rdquo;
                    </span>
                  )}
                </div>
              )}
              {/* Awaiting approval — show the request metadata so operators
                  know who/when is being blocked. */}
              {e.status === 'awaiting_approval' && (
                <div
                  data-testid={`task-execution-${e.id}-awaiting`}
                  className="px-2.5 py-1.5 border-t border-amber-500/[0.15] text-[11px] flex items-center gap-2 text-amber-200/85"
                >
                  <span>⏳ awaiting approval</span>
                  {e.approval_requested_by && (
                    <span className="font-mono text-amber-300/75">
                      requested by {e.approval_requested_by}
                    </span>
                  )}
                  {e.approval_requested_at != null && (
                    <span className="text-white/45 font-mono">· {timeAgo(e.approval_requested_at)}</span>
                  )}
                </div>
              )}
            </div>
          ))}
          {executions.length > 5 && (
            <Link
              href={`/app/tool-executions`}
              className="text-xs text-white/55 hover:text-white"
            >
              View all {executions.length} executions →
            </Link>
          )}
        </div>
      )}
    </section>
  )
}

function BreadcrumbStep({
  label,
  state,
  detail,
  mono,
}: {
  label: string
  state: 'done' | 'queued' | 'running' | 'waiting' | 'failed'
  detail?: string
  mono?: boolean
}) {
  const tone: Record<typeof state, string> = {
    done: 'bg-emerald-500/15 text-emerald-200 border-emerald-500/30',
    queued: 'bg-white/[0.04] text-white/60 border-white/[0.1]',
    running: 'bg-sky-500/15 text-sky-200 border-sky-500/30',
    waiting: 'bg-amber-500/15 text-amber-200 border-amber-500/30',
    failed: 'bg-rose-500/15 text-rose-200 border-rose-500/30',
  } as const
  return (
    <li
      className={`flex flex-col items-center min-w-[80px] px-2.5 py-1.5 rounded-md border text-[11px] ${tone[state]}`}
    >
      <span className={`${mono ? 'font-mono' : ''} truncate max-w-[140px]`}>{label}</span>
      {detail && <span className="text-[9px] opacity-70 mt-0.5">{detail}</span>}
    </li>
  )
}

function confidenceLabel(c: number | null): string | undefined {
  if (c == null) return undefined
  return `${Math.round(c * 100)}%`
}

function execStepState(e: ToolExecution): 'done' | 'running' | 'waiting' | 'failed' | 'queued' {
  if (e.status === 'running') return 'running'
  if (e.status === 'awaiting_approval') return 'waiting'
  if (e.status === 'failed' || e.status === 'rejected' || e.status === 'blocked') return 'failed'
  if (e.status === 'completed') return 'done'
  return 'queued'
}

function execTerminalState(e: ToolExecution): 'done' | 'running' | 'waiting' | 'failed' | 'queued' {
  if (e.status === 'completed') return 'done'
  if (e.status === 'failed' || e.status === 'rejected' || e.status === 'blocked') return 'failed'
  if (e.status === 'running' || e.status === 'approved') return 'running'
  if (e.status === 'awaiting_approval') return 'waiting'
  return 'queued'
}

function execTerminalLabel(e: ToolExecution): string {
  switch (e.status) {
    case 'completed':
      return e.exit_code === 0 ? 'Complete' : 'Complete · non-zero'
    case 'failed':
      return 'Failed'
    case 'rejected':
      return 'Rejected'
    case 'blocked':
      return 'Blocked'
    case 'running':
      return 'Running'
    case 'awaiting_approval':
      return 'Waiting on approval'
    case 'approved':
      return 'Approved · queued'
    default:
      return 'Pending'
  }
}

function timeAgo(ts: number): string {
  const s = Math.max(0, Math.floor(Date.now() / 1000) - ts)
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}
