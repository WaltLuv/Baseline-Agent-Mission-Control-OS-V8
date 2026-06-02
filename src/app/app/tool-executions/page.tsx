'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'

// Tool Executions — Mission Control's supervisor view for the
// CLI Anything / Connected Tools execution layer.
//
// This page is intentionally NOT a new dashboard. It is a single,
// task-focused surface for:
//   - approving / rejecting HIGH-risk commands
//   - inspecting recent executions + their proof
//
// Mission Control supervises. Baseline OS routes. The runtime
// (Hermes / OpenClaw / Claude Code / Codex) actually executes.

type Risk = 'low' | 'medium' | 'high' | 'blocked'
type Status =
  | 'pending'
  | 'awaiting_approval'
  | 'approved'
  | 'rejected'
  | 'blocked'
  | 'running'
  | 'completed'
  | 'failed'

interface ToolExecution {
  id: number
  workspace_id: number
  task_id: number | null
  agent_id: number | null
  runtime_id: number | null
  cli_tool_id: string
  command_name: string
  command_args_redacted: string | null
  risk: Risk
  status: Status
  approval_required: 0 | 1
  approved_by: string | null
  approved_at: number | null
  rejected_by: string | null
  rejected_at: number | null
  rejection_reason: string | null
  requested_by: string
  // Phase 4 approval supervision fields.
  approval_requested_by: string | null
  approval_requested_at: number | null
  approval_reason: string | null
  approval_audit_id: number | null
  started_at: number | null
  completed_at: number | null
  exit_code: number | null
  stdout_summary: string | null
  stderr_summary: string | null
  proof_url: string | null
  proof_payload: Record<string, unknown> | null
  cost_estimate: number | null
  audit_event_id: number | null
  created_at: number
  updated_at: number
}

const FILTERS: Array<{ id: 'pending_approval' | 'all' | Status; label: string }> = [
  { id: 'pending_approval', label: 'Needs approval' },
  { id: 'all', label: 'All' },
  { id: 'running', label: 'Running' },
  { id: 'completed', label: 'Completed' },
  { id: 'failed', label: 'Failed' },
  { id: 'rejected', label: 'Rejected' },
]

const RISK_BADGE: Record<Risk, string> = {
  low: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  medium: 'bg-amber-500/15 text-amber-200 border-amber-500/30',
  high: 'bg-rose-500/15 text-rose-200 border-rose-500/30',
  blocked: 'bg-red-700/30 text-red-200 border-red-500/40',
}
const STATUS_BADGE: Record<Status, string> = {
  pending: 'bg-white/[0.04] text-white/60 border-white/[0.1]',
  awaiting_approval: 'bg-amber-500/15 text-amber-200 border-amber-500/30',
  approved: 'bg-violet-500/15 text-violet-200 border-violet-500/30',
  rejected: 'bg-rose-500/15 text-rose-200 border-rose-500/30',
  blocked: 'bg-red-700/30 text-red-200 border-red-500/40',
  running: 'bg-sky-500/15 text-sky-200 border-sky-500/30',
  completed: 'bg-emerald-500/15 text-emerald-200 border-emerald-500/30',
  failed: 'bg-red-500/20 text-red-200 border-red-500/40',
}

function fmtAge(now: number, ts: number | null): string {
  if (!ts) return '—'
  const s = Math.max(0, now - ts)
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

export default function ToolExecutionsPage() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['id']>('pending_approval')
  const [items, setItems] = useState<ToolExecution[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyIds, setBusyIds] = useState<Set<number>>(new Set())
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000))
  const [selected, setSelected] = useState<ToolExecution | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const q = filter === 'all' ? '' : `?status=${filter}`
      const res = await fetch(`/api/tool-executions${q}`, { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as { items: ToolExecution[] }
      setItems(data.items)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed to load')
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    load()
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 10_000)
    return () => clearInterval(t)
  }, [load])

  async function act(id: number, kind: 'approve' | 'reject', reason?: string) {
    setBusyIds((prev) => new Set(prev).add(id))
    try {
      const res = await fetch(`/api/tool-executions/${id}/${kind}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: kind === 'reject' && reason ? JSON.stringify({ reason }) : '{}',
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : `${kind} failed`)
    } finally {
      setBusyIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }

  const counts = useMemo(() => {
    const m: Partial<Record<Status, number>> = {}
    for (const it of items) m[it.status] = (m[it.status] ?? 0) + 1
    return m
  }, [items])

  return (
    <div className="min-h-screen bg-[#09090b] text-[#fafafa] antialiased" data-testid="tool-executions-page">
      <header className="border-b border-white/[0.06] backdrop-blur-xl bg-[#09090b]/70">
        <div className="mx-auto max-w-screen-xl px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/app" className="text-sm font-semibold tracking-tight" data-testid="te-home-link">
              Baseline Mission Control
            </Link>
            <span className="text-white/30">·</span>
            <span className="text-sm text-white/70">Tool Executions</span>
          </div>
          <Link href="/help#runtime-setup" className="text-sm text-white/55 hover:text-white">
            What is this?
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-screen-xl px-6 py-8">
        <section className="mb-6">
          <p className="text-xs uppercase tracking-wider text-violet-300/80 font-mono mb-2">Connected Tools</p>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Execution supervisor</h1>
          <p className="mt-2 text-sm text-white/55 max-w-2xl leading-relaxed">
            Mission Control supervises every CLI call your AI workforce makes. Low- and medium-risk commands run automatically. High-risk commands wait here until you approve them. Every execution leaves an audit trail and proof.
          </p>
        </section>

        {/* Filter bar */}
        <section className="mb-4 flex flex-wrap gap-2" data-testid="te-filter-bar">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              data-testid={`te-filter-${f.id}`}
              onClick={() => setFilter(f.id)}
              className={`h-8 px-3 rounded-full text-xs font-medium border transition-colors ${
                filter === f.id
                  ? 'bg-violet-500/20 text-violet-100 border-violet-400/40'
                  : 'bg-white/[0.03] text-white/70 border-white/[0.08] hover:border-white/[0.16]'
              }`}
            >
              {f.label}
            </button>
          ))}
          {filter === 'all' && Object.keys(counts).length > 0 && (
            <span className="text-xs text-white/45 self-center ml-2">
              {Object.entries(counts).map(([s, n]) => `${s}: ${n}`).join(' · ')}
            </span>
          )}
        </section>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-200" data-testid="te-error">
            {error}
          </div>
        )}

        {/* List */}
        <section className="space-y-2" data-testid="te-list">
          {loading && <div className="text-sm text-white/45">Loading…</div>}
          {!loading && items.length === 0 && (
            <div
              className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 text-sm text-white/55"
              data-testid="te-empty"
            >
              {filter === 'pending_approval'
                ? "No commands waiting on you. Your workforce is autonomous within the safe-risk envelope you've set."
                : 'No executions match this filter yet.'}
            </div>
          )}
          {items.map((it) => (
            <article
              key={it.id}
              data-testid={`te-row-${it.id}`}
              data-status={it.status}
              data-risk={it.risk}
              className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 flex items-start gap-4 hover:border-white/[0.12] transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border font-mono ${RISK_BADGE[it.risk]}`}>
                    {it.risk}
                  </span>
                  <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border font-mono ${STATUS_BADGE[it.status]}`}>
                    {it.status.replace('_', ' ')}
                  </span>
                  <span className="text-xs text-white/55 font-mono truncate">
                    {it.cli_tool_id} · {it.command_name}
                  </span>
                  {it.task_id && (
                    <Link
                      href={`/app/tasks/${it.task_id}`}
                      className="text-xs text-violet-300/80 hover:text-violet-200 font-mono"
                      data-testid={`te-task-link-${it.id}`}
                    >
                      task #{it.task_id}
                    </Link>
                  )}
                </div>
                {it.command_args_redacted && (
                  <pre className="mt-2 text-xs text-white/75 font-mono whitespace-pre-wrap break-all">
                    {it.command_args_redacted}
                  </pre>
                )}
                <div className="mt-2 text-xs text-white/45 flex items-center gap-3 flex-wrap">
                  <span>requested by {it.requested_by}</span>
                  <span>· {fmtAge(now, it.created_at)}</span>
                  {it.exit_code !== null && (
                    <span className={it.exit_code === 0 ? 'text-emerald-300/80' : 'text-rose-300/80'}>
                      · exit {it.exit_code}
                    </span>
                  )}
                  {it.cost_estimate !== null && it.cost_estimate !== undefined && (
                    <span>· ~${(it.cost_estimate as number).toFixed(3)}</span>
                  )}
                  {it.proof_url && (
                    <a
                      href={it.proof_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      data-testid={`te-proof-${it.id}`}
                      className="text-violet-300/80 hover:text-violet-200"
                    >
                      · proof ↗
                    </a>
                  )}
                  {it.audit_event_id && (
                    <span className="text-white/35">· audit #{it.audit_event_id}</span>
                  )}
                </div>
              </div>

              <div className="shrink-0 flex flex-col items-end gap-2">
                {it.status === 'awaiting_approval' && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      data-testid={`te-approve-${it.id}`}
                      disabled={busyIds.has(it.id)}
                      onClick={() => act(it.id, 'approve')}
                      className="h-8 px-3 rounded-md bg-emerald-500/20 text-emerald-100 text-xs font-semibold border border-emerald-400/30 hover:bg-emerald-500/30 disabled:opacity-50"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      data-testid={`te-reject-${it.id}`}
                      disabled={busyIds.has(it.id)}
                      onClick={() => {
                        const reason = window.prompt('Reason for rejection (optional):') || ''
                        act(it.id, 'reject', reason || undefined)
                      }}
                      className="h-8 px-3 rounded-md bg-rose-500/15 text-rose-100 text-xs font-semibold border border-rose-400/30 hover:bg-rose-500/25 disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                )}
                <button
                  type="button"
                  data-testid={`te-detail-${it.id}`}
                  onClick={() => setSelected(it)}
                  className="text-xs text-white/55 hover:text-white underline-offset-2 hover:underline"
                >
                  Details
                </button>
              </div>
            </article>
          ))}
        </section>
      </main>

      {/* Slide-over detail */}
      {selected && (
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 flex justify-end"
          onClick={() => setSelected(null)}
          data-testid="te-detail-overlay"
        >
          <aside
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl h-full bg-[#0c0c0e] border-l border-white/[0.08] overflow-auto p-6"
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-xs uppercase tracking-wider text-white/45 font-mono">Execution #{selected.id}</p>
                <h2 className="text-xl font-semibold tracking-tight mt-0.5">
                  {selected.cli_tool_id} · <span className="font-mono text-violet-300">{selected.command_name}</span>
                </h2>
              </div>
              <button
                type="button"
                data-testid="te-close-detail"
                onClick={() => setSelected(null)}
                className="text-white/55 hover:text-white text-xl leading-none"
              >
                ×
              </button>
            </div>

            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <dt className="text-white/45 text-xs uppercase tracking-wider font-mono">Status</dt>
              <dd className="text-white/85">{selected.status}</dd>
              <dt className="text-white/45 text-xs uppercase tracking-wider font-mono">Risk</dt>
              <dd className="text-white/85">{selected.risk}</dd>
              <dt className="text-white/45 text-xs uppercase tracking-wider font-mono">Requested by</dt>
              <dd className="text-white/85">{selected.requested_by}</dd>
              {selected.approved_by && (
                <>
                  <dt className="text-white/45 text-xs uppercase tracking-wider font-mono">Approved by</dt>
                  <dd className="text-white/85">
                    {selected.approved_by}
                    {selected.approved_at != null && (
                      <span className="text-white/45 ml-1.5">· {fmtAge(now, selected.approved_at)}</span>
                    )}
                  </dd>
                </>
              )}
              {selected.rejected_by && (
                <>
                  <dt className="text-white/45 text-xs uppercase tracking-wider font-mono">Rejected by</dt>
                  <dd className="text-white/85">{selected.rejected_by} — {selected.rejection_reason ?? '(no reason)'}</dd>
                </>
              )}
              {selected.approval_requested_by && (
                <>
                  <dt className="text-white/45 text-xs uppercase tracking-wider font-mono">Approval requested by</dt>
                  <dd className="text-white/85 font-mono">
                    {selected.approval_requested_by}
                    {selected.approval_requested_at != null && (
                      <span className="text-white/45 ml-1.5">· {fmtAge(now, selected.approval_requested_at)}</span>
                    )}
                  </dd>
                </>
              )}
              {selected.approval_audit_id != null && (
                <>
                  <dt className="text-white/45 text-xs uppercase tracking-wider font-mono">Approval audit</dt>
                  <dd className="text-white/85 font-mono">#{selected.approval_audit_id}</dd>
                </>
              )}
              <dt className="text-white/45 text-xs uppercase tracking-wider font-mono">Audit</dt>
              <dd className="text-white/85 font-mono">{selected.audit_event_id ?? '—'}</dd>
              {selected.runtime_id && (
                <>
                  <dt className="text-white/45 text-xs uppercase tracking-wider font-mono">Runtime</dt>
                  <dd className="text-white/85 font-mono">#{selected.runtime_id}</dd>
                </>
              )}
            </dl>

            {selected.approval_reason && (
              <section className="mt-5" data-testid="te-approval-reason">
                <h3 className="text-xs uppercase tracking-wider text-emerald-300/80 font-mono mb-1.5">Approval reason</h3>
                <p className="rounded-md bg-emerald-500/[0.06] border border-emerald-500/20 px-3 py-2 text-xs text-emerald-100 italic">
                  &ldquo;{selected.approval_reason}&rdquo;
                </p>
              </section>
            )}
            {selected.command_args_redacted && (
              <section className="mt-5">
                <h3 className="text-xs uppercase tracking-wider text-white/45 font-mono mb-1.5">Command</h3>
                <pre className="rounded-md bg-black/40 border border-white/[0.06] p-3 text-xs text-white/80 font-mono whitespace-pre-wrap break-all">
                  {selected.command_args_redacted}
                </pre>
              </section>
            )}
            {selected.stdout_summary && (
              <section className="mt-5">
                <h3 className="text-xs uppercase tracking-wider text-white/45 font-mono mb-1.5">stdout</h3>
                <pre className="rounded-md bg-black/40 border border-white/[0.06] p-3 text-xs text-white/80 font-mono whitespace-pre-wrap break-all">
                  {selected.stdout_summary}
                </pre>
              </section>
            )}
            {selected.stderr_summary && (
              <section className="mt-5">
                <h3 className="text-xs uppercase tracking-wider text-rose-300/80 font-mono mb-1.5">stderr</h3>
                <pre className="rounded-md bg-rose-500/[0.06] border border-rose-500/20 p-3 text-xs text-rose-100 font-mono whitespace-pre-wrap break-all">
                  {selected.stderr_summary}
                </pre>
              </section>
            )}
            {selected.proof_payload && (
              <section className="mt-5">
                <h3 className="text-xs uppercase tracking-wider text-white/45 font-mono mb-1.5">Proof payload</h3>
                <pre className="rounded-md bg-black/40 border border-white/[0.06] p-3 text-xs text-white/80 font-mono whitespace-pre-wrap break-all">
                  {JSON.stringify(selected.proof_payload, null, 2)}
                </pre>
              </section>
            )}
          </aside>
        </div>
      )}
    </div>
  )
}
