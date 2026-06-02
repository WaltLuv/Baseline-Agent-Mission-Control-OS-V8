'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import type { DailyBriefPayload, DailyBriefWindow } from '@/lib/daily-brief/types'

/**
 * <DailyBriefPanel /> — Mission Control's "newspaper of the morning".
 *
 * Renders the daily brief from `GET /api/daily-brief?window=...`.
 * Strictly customer-facing: NO decision-making, NO aggregation. The
 * payload comes from the API which either proxies Baseline OS or runs
 * the Mission Control fallback aggregator. The panel must work either
 * way without code changes.
 *
 * Mount above <ExecutiveBriefing /> on /app/overview.
 */

export function DailyBriefPanel() {
  const [windowChoice, setWindowChoice] = useState<DailyBriefWindow>('since-yesterday')
  const [payload, setPayload] = useState<DailyBriefPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (w: DailyBriefWindow) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/daily-brief?window=${w}`, { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as DailyBriefPayload
      setPayload(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed to load daily brief')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(windowChoice)
  }, [load, windowChoice])

  if (loading && !payload) {
    return (
      <section
        data-testid="daily-brief-panel"
        data-state="loading"
        className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 mb-6"
      >
        <p className="text-xs uppercase tracking-wider text-white/45 font-mono">Daily Brief</p>
        <p className="mt-2 text-white/55 text-sm">Loading your morning brief…</p>
      </section>
    )
  }

  if (error && !payload) {
    return (
      <section
        data-testid="daily-brief-panel"
        data-state="error"
        className="rounded-2xl border border-red-500/30 bg-red-500/[0.04] p-6 mb-6"
      >
        <p className="text-xs uppercase tracking-wider text-red-300/80 font-mono">Daily Brief</p>
        <p className="mt-2 text-white/65 text-sm">Could not load the brief: {error}</p>
        <button
          type="button"
          className="mt-3 h-9 px-3 rounded-md bg-white/[0.08] text-white/85 text-sm border border-white/[0.08] hover:bg-white/[0.12]"
          onClick={() => load(windowChoice)}
        >
          Retry
        </button>
      </section>
    )
  }

  if (!payload) return null

  if (payload.empty_state) {
    return (
      <section
        data-testid="daily-brief-panel"
        data-state="empty"
        data-source={payload.source}
        className="rounded-2xl border border-white/[0.08] bg-gradient-to-br from-white/[0.03] to-violet-500/[0.02] p-6 mb-6"
      >
        <header className="flex items-center justify-between gap-3 mb-2">
          <p className="text-xs uppercase tracking-wider text-violet-300/80 font-mono">
            Daily Brief · {payload.date_range.label}
          </p>
          <WindowToggle value={windowChoice} onChange={setWindowChoice} />
        </header>
        <h2 className="text-xl font-semibold text-white">{payload.empty_state.headline}</h2>
        <p className="mt-2 text-white/65 leading-relaxed">{payload.empty_state.detail}</p>
        <Link
          href={payload.empty_state.cta_url}
          data-testid="daily-brief-empty-cta"
          className="inline-flex items-center gap-2 mt-4 h-10 px-4 rounded-lg bg-white text-[#09090b] text-sm font-semibold hover:bg-white/90"
        >
          {payload.empty_state.cta_label}
        </Link>
      </section>
    )
  }

  return (
    <section
      data-testid="daily-brief-panel"
      data-state="ready"
      data-source={payload.source}
      data-workforce-slug={payload.workforce_slug ?? ''}
      className="rounded-2xl border border-white/[0.08] bg-gradient-to-br from-white/[0.03] to-violet-500/[0.02] p-6 mb-6"
    >
      <header className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-wider text-violet-300/80 font-mono">
            Daily Brief · {payload.date_range.label}
          </p>
          <p className="mt-0.5 text-[11px] text-white/35 font-mono flex items-center gap-1.5">
            <span>Source: {payload.source === 'baseline-os' ? 'Baseline OS' : 'Mission Control'} · generated {formatTime(payload.generated_at)}</span>
            {payload.source === 'baseline-os' && (
              <span
                data-testid="trust-pill"
                title="These numbers come from the same engine that ran the work — single source of truth across Daily Brief and Value page."
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-emerald-400/30 bg-emerald-500/[0.08] text-emerald-200 text-[10px] uppercase tracking-wider font-mono"
              >
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Verified by Baseline OS
              </span>
            )}
          </p>
        </div>
        <WindowToggle value={windowChoice} onChange={setWindowChoice} />
      </header>

      {payload.critical_banner && (
        <div
          data-testid="daily-brief-critical-banner"
          className="rounded-xl border border-rose-500/40 bg-rose-500/[0.08] p-4 mb-4 flex items-start gap-3"
        >
          <span className="mt-0.5 inline-block w-2.5 h-2.5 rounded-full bg-rose-400 animate-pulse" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-rose-100">{payload.critical_banner.headline}</p>
            <p className="text-xs text-rose-200/80 mt-0.5 leading-relaxed">{payload.critical_banner.detail}</p>
          </div>
          <Link
            href={payload.critical_banner.action_url}
            data-testid="daily-brief-critical-cta"
            className="shrink-0 h-9 px-3 inline-flex items-center rounded-md bg-rose-500/20 text-rose-100 text-xs font-semibold border border-rose-400/40 hover:bg-rose-500/30"
          >
            {payload.critical_banner.action_label}
          </Link>
        </div>
      )}

      <h2 className="text-2xl font-semibold tracking-tight text-white leading-tight" data-testid="daily-brief-headline">
        {payload.headline}
      </h2>
      <p className="mt-2 text-white/65 leading-relaxed" data-testid="daily-brief-narrative">
        {payload.narrative}
      </p>

      <section className="mt-5 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2" data-testid="daily-brief-numbers">
        <NumberTile label="Tasks handled" value={payload.by_the_numbers.tasks_handled} testid="num-tasks-handled" />
        <NumberTile label="Approvals requested" value={payload.by_the_numbers.approvals_requested} testid="num-approvals-requested" />
        <NumberTile label="Approvals granted" value={payload.by_the_numbers.approvals_granted} testid="num-approvals-granted" />
        <NumberTile label="Tool executions" value={payload.by_the_numbers.tool_executions} testid="num-tool-executions" />
        <NumberTile label="Proofs delivered" value={payload.by_the_numbers.proofs_delivered} testid="num-proofs-delivered" />
        <NumberTile
          label="Failed executions"
          value={payload.by_the_numbers.failed_executions}
          tone={payload.by_the_numbers.failed_executions > 0 ? 'warn' : 'neutral'}
          testid="num-failed-executions"
        />
        <NumberTile
          label="Hours saved (est.)"
          value={payload.by_the_numbers.estimated_hours_saved}
          tone="positive"
          testid="num-hours-saved"
        />
      </section>

      {payload.attention.length > 0 && (
        <section className="mt-5" data-testid="daily-brief-attention">
          <p className="text-xs uppercase tracking-wider text-amber-300/80 font-mono mb-2">Attention</p>
          <ul className="space-y-1.5">
            {payload.attention.map((item, i) => (
              <li key={`${item.kind}-${i}`} data-testid={`daily-brief-attention-${item.kind}`} className="flex items-start gap-2.5 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                <AttentionPill kind={item.kind} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-white truncate">{item.title}</p>
                  {item.detail && <p className="text-xs text-white/55 mt-0.5">{item.detail}</p>}
                </div>
                <Link
                  href={item.url}
                  className="shrink-0 text-xs text-violet-300 hover:text-violet-200 underline-offset-2 hover:underline whitespace-nowrap"
                >
                  Open →
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {payload.persona_breakdown.length > 0 && (
        <section className="mt-5" data-testid="daily-brief-personas">
          <p className="text-xs uppercase tracking-wider text-white/45 font-mono mb-2">Personas at work</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {payload.persona_breakdown.map((p) => (
              <Link
                key={p.agent_id}
                href={`/app/agents?focus=${encodeURIComponent(p.name)}`}
                data-testid={`daily-brief-persona-${p.agent_id}`}
                className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 hover:border-white/[0.16]"
              >
                <p className="text-sm font-semibold text-white truncate">{p.name}</p>
                <p className="text-[11px] text-violet-300/80 font-mono truncate">{p.role}</p>
                <p className="text-[11px] text-white/55 mt-1 font-mono">
                  {p.completed} done · {p.in_progress} in-progress{p.blocked > 0 ? ` · ${p.blocked} blocked` : ''}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {payload.proof_links.length > 0 && (
        <section className="mt-5" data-testid="daily-brief-proofs">
          <p className="text-xs uppercase tracking-wider text-emerald-300/80 font-mono mb-2">Proofs delivered</p>
          <ul className="space-y-1.5">
            {payload.proof_links.map((p) => (
              <li key={`${p.task_id}-${p.delivered_at_iso}`} className="flex items-center gap-2 text-sm">
                <span className="text-emerald-300/80">✓</span>
                <Link
                  href={`/app/tasks/kanban#task-${p.task_id}`}
                  className="text-white/85 hover:text-white truncate flex-1"
                >
                  {p.title}
                </Link>
                {p.proof_url && (
                  <a
                    href={p.proof_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-violet-300 hover:text-violet-200 whitespace-nowrap"
                  >
                    proof →
                  </a>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer className="mt-5 pt-4 border-t border-white/[0.06] flex items-center justify-between gap-2 flex-wrap">
        <p
          className={`text-sm font-medium ${
            payload.attention.length === 0 ? 'text-emerald-300/90' : 'text-amber-200/90'
          }`}
          data-testid="daily-brief-status-line"
        >
          {payload.status_line}
        </p>
        <div className="flex items-center gap-2">
          <EmailPreviewButton windowChoice={windowChoice} />
          <button
            type="button"
            onClick={() => load(windowChoice)}
            data-testid="daily-brief-refresh"
            className="h-8 px-3 rounded-md bg-white/[0.04] text-white/65 text-xs border border-white/[0.06] hover:bg-white/[0.08] hover:text-white/85"
          >
            Refresh
          </button>
        </div>
      </footer>
    </section>
  )
}

function NumberTile({
  label,
  value,
  testid,
  tone = 'neutral',
}: {
  label: string
  value: number
  testid: string
  tone?: 'neutral' | 'positive' | 'warn'
}) {
  const toneClass =
    tone === 'positive'
      ? 'text-emerald-200'
      : tone === 'warn'
      ? 'text-rose-200'
      : 'text-white'
  return (
    <div
      className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5"
      data-testid={testid}
    >
      <p className={`text-xl font-semibold tabular-nums ${toneClass}`}>{value}</p>
      <p className="text-[11px] text-white/45 mt-0.5 leading-snug">{label}</p>
    </div>
  )
}

function EmailPreviewButton({ windowChoice }: { windowChoice: DailyBriefWindow }) {
  const [open, setOpen] = useState(false)
  const [data, setData] = useState<{ subject: string; preheader: string; html: string; text: string } | null>(null)
  const [tab, setTab] = useState<'html' | 'text'>('html')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  async function openPreview() {
    setOpen(true)
    setLoading(true)
    try {
      const res = await fetch(`/api/daily-brief/email?window=${windowChoice}&format=json`, { cache: 'no-store' })
      if (res.ok) setData(await res.json())
    } finally {
      setLoading(false)
    }
  }

  async function copy(s: string) {
    try {
      await navigator.clipboard.writeText(s)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* ignore */
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openPreview}
        data-testid="daily-brief-email-preview-button"
        className="h-8 px-3 rounded-md bg-white/[0.04] text-white/65 text-xs border border-white/[0.06] hover:bg-white/[0.08] hover:text-white/85"
      >
        Preview email
      </button>
      {open && (
        <div
          data-testid="daily-brief-email-preview-modal"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-3xl max-h-[85vh] rounded-xl border border-white/[0.08] bg-[#0f0f17] overflow-hidden flex flex-col"
          >
            <header className="flex items-center justify-between gap-2 px-5 py-3 border-b border-white/[0.06]">
              <div className="min-w-0 flex-1">
                <p className="text-xs uppercase tracking-wider text-violet-300/80 font-mono">Email preview · not sent</p>
                <p className="text-sm text-white/85 truncate" data-testid="daily-brief-email-subject">
                  {data?.subject ?? 'Loading…'}
                </p>
                {data?.preheader && (
                  <p className="text-[11px] text-white/45 truncate">{data.preheader}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="h-8 w-8 rounded-md bg-white/[0.04] text-white/65 hover:bg-white/[0.08] hover:text-white"
              >
                ×
              </button>
            </header>
            <div className="px-5 py-2 border-b border-white/[0.06] flex items-center gap-2">
              <button
                type="button"
                onClick={() => setTab('html')}
                data-testid="daily-brief-email-tab-html"
                className={`h-7 px-3 rounded-full text-xs font-medium ${tab === 'html' ? 'bg-white text-[#09090b]' : 'bg-white/[0.04] text-white/65'}`}
              >
                HTML
              </button>
              <button
                type="button"
                onClick={() => setTab('text')}
                data-testid="daily-brief-email-tab-text"
                className={`h-7 px-3 rounded-full text-xs font-medium ${tab === 'text' ? 'bg-white text-[#09090b]' : 'bg-white/[0.04] text-white/65'}`}
              >
                Plain text
              </button>
              <span className="flex-1" />
              {data && (
                <button
                  type="button"
                  onClick={() => copy(tab === 'html' ? data.html : data.text)}
                  data-testid="daily-brief-email-copy"
                  className="h-7 px-3 rounded-md bg-white/[0.04] text-white/65 text-xs border border-white/[0.06] hover:bg-white/[0.08]"
                >
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              )}
              {data && (
                <a
                  href={`/api/daily-brief/email?window=${windowChoice}&format=${tab}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-7 px-3 inline-flex items-center rounded-md bg-white/[0.04] text-white/65 text-xs border border-white/[0.06] hover:bg-white/[0.08]"
                >
                  Open raw →
                </a>
              )}
            </div>
            <div className="flex-1 overflow-auto bg-[#0b0b12]">
              {loading && <p className="p-5 text-white/55 text-sm">Rendering email…</p>}
              {!loading && data && tab === 'html' && (
                <iframe
                  data-testid="daily-brief-email-iframe"
                  srcDoc={data.html}
                  title="Daily Brief email preview"
                  className="w-full h-[60vh] bg-white"
                />
              )}
              {!loading && data && tab === 'text' && (
                <pre data-testid="daily-brief-email-text" className="p-5 text-xs text-white/80 whitespace-pre-wrap font-mono">
                  {data.text}
                </pre>
              )}
            </div>
            <footer className="px-5 py-3 border-t border-white/[0.06] text-[11px] text-white/45">
              Scheduled delivery is not wired yet. Copy this for now; we&apos;ll add Resend in the next pass.
            </footer>
          </div>
        </div>
      )}
    </>
  )
}

function WindowToggle({
  value,
  onChange,
}: {
  value: DailyBriefWindow
  onChange: (w: DailyBriefWindow) => void
}) {
  const options = useMemo<{ id: DailyBriefWindow; label: string }[]>(
    () => [
      { id: 'since-yesterday', label: 'Since yesterday' },
      { id: 'since-last-login', label: 'Since last visit' },
    ],
    [],
  )
  return (
    <div
      className="inline-flex rounded-full border border-white/[0.08] bg-white/[0.02] p-0.5 text-xs"
      data-testid="daily-brief-window-toggle"
      role="tablist"
    >
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="tab"
          aria-selected={value === o.id}
          onClick={() => onChange(o.id)}
          data-testid={`daily-brief-window-${o.id}`}
          className={`h-7 px-3 rounded-full font-medium transition-colors ${
            value === o.id ? 'bg-white text-[#09090b]' : 'text-white/65 hover:text-white'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function AttentionPill({ kind }: { kind: string }) {
  const tone =
    kind === 'approval_pending'
      ? 'bg-amber-500/15 border-amber-400/30 text-amber-200'
      : kind === 'failed_execution'
      ? 'bg-rose-500/15 border-rose-400/30 text-rose-200'
      : kind === 'critical_workflow'
      ? 'bg-rose-500/15 border-rose-400/30 text-rose-200'
      : 'bg-white/[0.06] border-white/[0.08] text-white/70'
  const label =
    kind === 'approval_pending'
      ? 'Approval'
      : kind === 'failed_execution'
      ? 'Failed'
      : kind === 'critical_workflow'
      ? 'Critical'
      : kind === 'stale_task'
      ? 'Stale'
      : 'Blocked'
  return (
    <span
      className={`shrink-0 mt-0.5 text-[10px] uppercase tracking-wider font-mono px-1.5 py-0.5 rounded border ${tone}`}
    >
      {label}
    </span>
  )
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}
