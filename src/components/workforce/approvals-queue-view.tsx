'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

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
 * Empty-honest: renders the calm "Nothing waiting" copy when there are
 * no held items.
 */
export function ApprovalsQueueView() {
  const [items, setItems] = useState<ApprovalItem[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<number | null>(null)

  const load = () => {
    fetch('/api/approvals/queue', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d) => setItems(d.items ?? []))
      .catch((e) => setError(String(e).slice(0, 200)))
  }

  useEffect(() => {
    load()
  }, [])

  const act = async (taskId: number, action: 'approve' | 'reject' | 'request-changes') => {
    setBusy(taskId)
    try {
      await fetch('/api/approvals/action', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId, action }),
      })
      // optimistic: drop the item
      setItems((prev) => (prev ? prev.filter((x) => x.taskId !== taskId) : prev))
    } finally {
      setBusy(null)
    }
  }

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
      className="rounded-2xl border border-border/40 bg-card/30 p-5"
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
        </p>
      </header>

      <ol className="space-y-3">
        {items.map((item) => (
          <li
            key={item.taskId}
            data-testid={`approval-row-${item.taskId}`}
            className={`rounded-xl border p-4 ${
              item.severity === 'high'
                ? 'border-red-500/30 bg-red-500/5'
                : item.severity === 'medium'
                  ? 'border-amber-500/30 bg-amber-500/5'
                  : 'border-border/40 bg-card/40'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground">{item.title}</p>
                {item.assignedTo && (
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    Escalated by{' '}
                    {item.assignedSlug ? (
                      <Link
                        href={`/app/agents/${encodeURIComponent(item.assignedSlug)}/trace`}
                        className="text-foreground hover:underline"
                        data-testid={`approval-trace-link-${item.taskId}`}
                      >
                        {item.assignedTo}
                      </Link>
                    ) : (
                      item.assignedTo
                    )}
                    {' · '}
                    {item.ageHours < 1
                      ? 'just now'
                      : item.ageHours < 24
                        ? `${Math.round(item.ageHours)}h ago`
                        : `${Math.round(item.ageHours / 24)}d ago`}
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
            {item.reason && (
              <p
                data-testid={`approval-reason-${item.taskId}`}
                className="mt-3 rounded-md border border-border/30 bg-background/40 p-2 text-[11px] text-muted-foreground"
              >
                {item.reasonSource && (
                  <span className="mr-1 font-semibold text-foreground/80">
                    {item.reasonSource}:
                  </span>
                )}
                {item.reason}
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={() => act(item.taskId, 'approve')}
                disabled={busy === item.taskId}
                data-testid={`approval-approve-${item.taskId}`}
                className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-[11px] font-medium text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-50"
              >
                Approve work
              </button>
              <button
                onClick={() => act(item.taskId, 'request-changes')}
                disabled={busy === item.taskId}
                data-testid={`approval-changes-${item.taskId}`}
                className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-[11px] font-medium text-amber-200 hover:bg-amber-500/20 disabled:opacity-50"
              >
                Request changes
              </button>
              <button
                onClick={() => act(item.taskId, 'reject')}
                disabled={busy === item.taskId}
                data-testid={`approval-reject-${item.taskId}`}
                className="rounded-md border border-red-500/40 bg-red-500/10 px-3 py-1 text-[11px] font-medium text-red-300 hover:bg-red-500/20 disabled:opacity-50"
              >
                Reject output
              </button>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}
