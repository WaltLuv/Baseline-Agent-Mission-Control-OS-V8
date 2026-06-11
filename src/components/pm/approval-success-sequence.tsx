'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

/**
 * ApprovalSuccessSequence — the "Mission Control executed real work" moment.
 *
 * Shown immediately after an owner APPROVES a spend approval. Every step is
 * driven by the REAL API response from POST /api/approvals/owner (decision →
 * dispatch → comms/proof → replay) — no fake animation disconnected from
 * state. Honest about dry-run mode and dispatch failures. No confetti:
 * calm, staged, executive.
 */

export interface ApprovalSequenceData {
  request: string
  dispatchStatus: string
  dispatchReason?: string
  commsId?: string
  workOrderId?: string
  replayId?: string | null
}

interface Step {
  key: string
  label: string
  sub: string
  ok: boolean
}

const STEP_INTERVAL_MS = 650

export function ApprovalSuccessSequence({ data, onClose }: { data: ApprovalSequenceData; onClose: () => void }) {
  const [visibleCount, setVisibleCount] = useState(0)

  const dispatched = data.dispatchStatus === 'dispatched' || data.dispatchStatus === 'dry_run_dispatch'
  const steps: Step[] = [
    {
      key: 'approved',
      label: 'Owner approved',
      sub: 'Decision recorded · audit trail updated',
      ok: true,
    },
    {
      key: 'dispatched',
      label: dispatched ? 'Vendor dispatched' : 'Dispatch blocked',
      sub: data.dispatchStatus === 'dispatched'
        ? 'Work order sent to the vendor'
        : data.dispatchStatus === 'dry_run_dispatch'
          ? 'Dry-run — add Twilio/email credentials to send live'
          : data.dispatchReason || 'Dispatch could not complete',
      ok: dispatched,
    },
    {
      key: 'proof',
      label: 'Proof package updated',
      sub: data.commsId ? `Comm-log entry ${data.commsId}` : 'Communication log updated',
      ok: Boolean(data.commsId),
    },
    {
      key: 'replay',
      label: 'Replay ready',
      sub: 'Full mission timeline recorded — intake → triage → approval → dispatch',
      ok: Boolean(data.replayId),
    },
  ]

  useEffect(() => {
    const reduced = typeof window !== 'undefined'
      && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
    if (reduced) {
      setVisibleCount(steps.length)
      return
    }
    if (visibleCount >= steps.length) return
    const t = window.setTimeout(() => setVisibleCount((c) => c + 1), visibleCount === 0 ? 250 : STEP_INTERVAL_MS)
    return () => window.clearTimeout(t)
  }, [visibleCount, steps.length])

  const done = visibleCount >= steps.length

  return (
    <div
      data-testid="approval-success-sequence"
      role="dialog"
      aria-label="Approval executed"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-2xl">
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-primary">
          Mission Control · executed
        </div>
        <div className="mb-4 text-sm font-semibold text-foreground" data-testid="seq-request">
          {data.request}
        </div>

        <div className="space-y-2.5">
          {steps.map((s, i) => {
            const shown = i < visibleCount
            return (
              <div
                key={s.key}
                data-testid={`seq-step-${s.key}`}
                data-state={shown ? (s.ok ? 'ok' : 'warn') : 'pending'}
                className="flex items-start gap-3 transition-opacity duration-300"
                style={{ opacity: shown ? 1 : 0.25 }}
              >
                <span
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold transition-colors duration-300 ${
                    shown
                      ? s.ok
                        ? 'border-emerald-500/60 bg-emerald-500/15 text-emerald-400'
                        : 'border-amber-500/60 bg-amber-500/15 text-amber-400'
                      : 'border-border text-muted-foreground/40'
                  }`}
                  aria-hidden
                >
                  {shown ? (s.ok ? '✓' : '!') : '·'}
                </span>
                <div>
                  <div className="text-sm font-medium leading-5 text-foreground">{s.label}</div>
                  <div className="text-[11px] leading-4 text-muted-foreground">{s.sub}</div>
                </div>
              </div>
            )
          })}
        </div>

        <div
          className="mt-5 flex items-center justify-between border-t border-border pt-4 transition-opacity duration-500"
          style={{ opacity: done ? 1 : 0 }}
        >
          <div className="flex gap-3 text-[11px]">
            <Link href="/app/replay" data-testid="seq-view-replay" className="font-semibold text-primary hover:underline">
              View replay →
            </Link>
            <Link href="/app/proofs" data-testid="seq-view-proof" className="text-muted-foreground hover:text-foreground hover:underline">
              Proof package
            </Link>
            <Link href="/app/maintenance" data-testid="seq-view-work-order" className="text-muted-foreground hover:text-foreground hover:underline">
              Work order
            </Link>
          </div>
          <button
            type="button"
            onClick={onClose}
            data-testid="seq-done"
            className="rounded-md border border-border px-3 py-1 text-[11px] font-semibold text-foreground hover:bg-accent"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
