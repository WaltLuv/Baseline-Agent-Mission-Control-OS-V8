'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useOperatorShortcuts } from '@/components/operator/operator-shortcuts'

interface ApprovalItem {
  taskId: number
  title: string
  status: string
  assignedTo: string | null
  assignedSlug: string | null
  ageHours: number
  severity: 'low' | 'medium' | 'high'
  reason: string | null
  reasonSource: 'Obsidian' | 'Notion' | 'Pinecone' | 'Internal' | null
}

/**
 * Read-only approvals queue. Lists every open approval across the
 * workspace with the matched memory rationale (so the operator sees
 * *why* an item is held) and a deep-link into the requesting AI
 * Employee's trace view.
 *
 * Day-2 polish:
 *   • Stale banner ("Waiting 24h+ / Escalating 48h+") per row.
 *   • Mobile-first: min-h-11 touch targets on action buttons, no
 *     desktop-only layout, action row wraps cleanly on phone.
 *   • Selection state + J/K hotkeys + A/R global hotkeys
 *     (wired through OperatorShortcutsProvider).
 *
 * Empty-honest: renders the calm "Nothing waiting" copy when there are
 * no held items.
 */
export function ApprovalsQueueView() {
  const [items, setItems] = useState<ApprovalItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<number | null>(null)
  const [selectedIdx, setSelectedIdx] = useState(0)
  const rowRefs = useRef<Map<number, HTMLLIElement>>(new Map())
  const { registerApprovalContext } = useOperatorShortcuts()

  const load = useCallback(() => {
    fetch('/api/approvals/queue', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d) => setItems(d.items ?? []))
      .catch((e) => setError(String(e).slice(0, 200)))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const act = useCallback(async (taskId: number, action: 'approve' | 'reject' | 'request-changes') => {
    setBusy(taskId)
    try {
      await fetch('/api/approvals/action', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId, action }),
      })
      setItems((prev) => (prev ? prev.filter((x) => x.taskId !== taskId) : prev))
    } finally {
      setBusy(null)
    }
  }, [])

  // Register hotkey handlers while this view is mounted.
  useEffect(() => {
    if (!items) return
    const handlers = {
      approveFocused: () => {
        const item = items[selectedIdx]
        if (item) act(item.taskId, 'approve')
      },
      rejectFocused: () => {
        const item = items[selectedIdx]
        if (item) act(item.taskId, 'reject')
      },
      moveSelection: (dir: 1 | -1) => {
        setSelectedIdx((idx) => {
          const next = Math.max(0, Math.min(items.length - 1, idx + dir))
          const el = rowRefs.current.get(items[next]?.taskId)
          el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
          return next
        })
      },
    }
    registerApprovalContext(handlers)
    return () => registerApprovalContext(null)
  }, [items, selectedIdx, act, registerApprovalContext])

  const summary = useMemo(() => {
    if (!items) return null
    const stale = items.filter((i) => i.ageHours >= 24).length
    const escalating = items.filter((i) => i.ageHours >= 48).length
    return { stale, escalating }
  }, [items])

  if (error) {
    return (
      <p className="rounded-md border border-border/40 bg-card/30 p-4 text-sm text-muted-foreground">
        Couldn&apos;t load approvals — {error}
      </p>
    )
  }

  if (!items) {
    return <p className="text-sm text-muted-foreground">Loading approvals…</p>
  }

  if (items.length === 0) {
    return (
      <div
        data-testid="approvals-empty"
        className="rounded-2xl border border-border/40 bg-card/30 p-8 text-center"
      >
        <p className="text-sm font-medium text-foreground">Nothing waiting for you</p>
        <p className="mt-1 text-xs text-muted-foreground">
          When an AI Employee escalates a decision, it will appear here with the rationale.
        </p>
      </div>
    )
  }

  return (
    <section
      data-testid="approvals-queue"
      className="rounded-2xl border border-border/40 bg-card/30 p-4 sm:p-5"
    >
      <header className="mb-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-primary">
          Approval queue · Workspace
        </p>
        <h2 className="mt-1 text-base font-bold text-foreground">
          {items.length} {items.length === 1 ? 'item' : 'items'} waiting for you
        </h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Each item shows the AI Employee that escalated it and the memory rationale that produced the hold.
          {' '}
          <span className="hidden sm:inline">Press <kbd className="px-1 py-0.5 rounded bg-muted/40 text-foreground/80 text-[10px] font-mono">A</kbd> to approve, <kbd className="px-1 py-0.5 rounded bg-muted/40 text-foreground/80 text-[10px] font-mono">R</kbd> to reject, <kbd className="px-1 py-0.5 rounded bg-muted/40 text-foreground/80 text-[10px] font-mono">J</kbd>/<kbd className="px-1 py-0.5 rounded bg-muted/40 text-foreground/80 text-[10px] font-mono">K</kbd> to move.</span>
        </p>
        {summary && (summary.stale > 0 || summary.escalating > 0) && (
          <p
            data-testid="stale-banner"
            className="mt-2 inline-flex items-center gap-2 text-[11px] font-mono px-2 py-1 rounded border border-amber-500/30 bg-amber-500/[0.06] text-amber-200"
          >
            {summary.escalating > 0 && (
              <span>
                <strong>{summary.escalating}</strong> escalating (48h+)
              </span>
            )}
            {summary.escalating > 0 && summary.stale - summary.escalating > 0 && <span>·</span>}
            {summary.stale - summary.escalating > 0 && (
              <span>
                <strong>{summary.stale - summary.escalating}</strong> waiting 24h+
              </span>
            )}
          </p>
        )}
      </header>

      <ol className="space-y-3">
        {items.map((item, idx) => {
          const isSelected = idx === selectedIdx
          const isStale = item.ageHours >= 24
          const isEscalating = item.ageHours >= 48
          return (
            <li
              key={item.taskId}
              ref={(el) => {
                if (el) rowRefs.current.set(item.taskId, el)
                else rowRefs.current.delete(item.taskId)
              }}
              data-testid={`approval-row-${item.taskId}`}
              data-selected={isSelected}
              onClick={() => setSelectedIdx(idx)}
              className={`rounded-xl border p-4 cursor-pointer transition-colors ${
                isSelected ? 'ring-2 ring-primary/60 ring-offset-1 ring-offset-background' : ''
              } ${
                isEscalating
                  ? 'border-red-500/40 bg-red-500/[0.06]'
                  : item.severity === 'high'
                    ? 'border-red-500/30 bg-red-500/5'
                    : isStale
                      ? 'border-amber-500/40 bg-amber-500/[0.06]'
                      : item.severity === 'medium'
                        ? 'border-amber-500/30 bg-amber-500/5'
                        : 'border-border/40 bg-card/40'
              }`}
            >
              <div className="flex items-start justify-between gap-3 flex-wrap sm:flex-nowrap">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">{item.title}</p>
                  {item.assignedTo && (
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      Escalated by{' '}
                      {item.assignedSlug ? (
                        <Link
                          href={`/app/agents/${encodeURIComponent(item.assignedSlug)}/trace`}
                          className="text-foreground hover:underline"
                          data-testid={`approval-trace-link-${item.taskId}`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {item.assignedTo}
                        </Link>
                      ) : (
                        item.assignedTo
                      )}
                      {' · '}
                      <span
                        data-testid={`approval-age-${item.taskId}`}
                        className={isEscalating ? 'text-red-300 font-semibold' : isStale ? 'text-amber-300 font-semibold' : ''}
                      >
                        {item.ageHours < 1
                          ? 'just now'
                          : item.ageHours < 24
                            ? `${Math.round(item.ageHours)}h ago`
                            : `waiting ${Math.round(item.ageHours)}h`}
                      </span>
                    </p>
                  )}
                </div>
                <span
                  className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider ${
                    item.severity === 'high'
                      ? 'border-red-500/40 bg-red-500/10 text-red-300'
                      : item.severity === 'medium'
                        ? 'border-amber-500/40 bg-amber-500/10 text-amber-200'
                        : 'border-border/40 bg-muted/30 text-muted-foreground'
                  }`}
                >
                  {item.severity}
                </span>
              </div>
              {isEscalating && (
                <p
                  data-testid={`approval-reminder-${item.taskId}`}
                  className="mt-2 rounded-md border border-red-500/40 bg-red-500/[0.08] px-2 py-1.5 text-[11px] text-red-200"
                >
                  ⏰ Reminder: escalating. This item has been waiting more than 48 hours.
                </p>
              )}
              {!isEscalating && isStale && (
                <p
                  data-testid={`approval-reminder-${item.taskId}`}
                  className="mt-2 rounded-md border border-amber-500/40 bg-amber-500/[0.06] px-2 py-1.5 text-[11px] text-amber-200"
                >
                  ⏰ Waiting more than 24 hours. Review soon.
                </p>
              )}
              {item.reason && (
                <p
                  data-testid={`approval-reason-${item.taskId}`}
                  className="mt-3 rounded-md border border-border/30 bg-background/40 p-2 text-[11px] text-muted-foreground"
                >
                  {item.reasonSource && (
                    <span className="mr-1 font-semibold text-foreground/80">{item.reasonSource}:</span>
                  )}
                  {item.reason}
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-2" data-testid={`approval-actions-${item.taskId}`}>
                <button
                  onClick={(e) => { e.stopPropagation(); act(item.taskId, 'approve') }}
                  disabled={busy === item.taskId}
                  data-testid={`approve-btn-${item.taskId}`}
                  className="min-h-11 sm:min-h-9 flex-1 sm:flex-none rounded-md border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm sm:text-[11px] font-medium text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-50 active:scale-[0.98]"
                >
                  Approve
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); act(item.taskId, 'request-changes') }}
                  disabled={busy === item.taskId}
                  data-testid={`changes-btn-${item.taskId}`}
                  className="min-h-11 sm:min-h-9 flex-1 sm:flex-none rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm sm:text-[11px] font-medium text-amber-200 hover:bg-amber-500/20 disabled:opacity-50 active:scale-[0.98]"
                >
                  Request changes
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); act(item.taskId, 'reject') }}
                  disabled={busy === item.taskId}
                  data-testid={`reject-btn-${item.taskId}`}
                  className="min-h-11 sm:min-h-9 flex-1 sm:flex-none rounded-md border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm sm:text-[11px] font-medium text-red-300 hover:bg-red-500/20 disabled:opacity-50 active:scale-[0.98]"
                >
                  Reject
                </button>
              </div>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
