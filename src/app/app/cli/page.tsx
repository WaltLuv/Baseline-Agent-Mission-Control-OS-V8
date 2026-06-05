'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'

// ─────────────────────────────────────────────────────────────────────
// /app/cli — Mission Control CLI catalogue.
//
// This is documentation, not a remote shell. We never execute commands
// from the browser; the page just describes the `mc` CLI surface so
// operators can copy invocations into a real terminal.
// ─────────────────────────────────────────────────────────────────────

type Status = 'working' | 'stubbed' | 'planned'

interface Namespace {
  group: string
  description: string
  actions: string
  status: Status
  notes?: string
}

interface Payload {
  namespaces: Namespace[]
  legacy: Namespace[]
  shortcuts: Array<{ shortcut: string; expands_to: string }>
  common_flags: Array<{ flag: string; description: string }>
  install_hint: { pnpm: string; npm: string; direct: string }
  note: string
}

function StatusBadge({ status }: { status: Status }) {
  const cls =
    status === 'working' ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
    : status === 'stubbed' ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
    : 'bg-white/[0.04] text-white/55 border-white/[0.08]'
  return (
    <span className={`text-[10px] uppercase tracking-wider font-semibold rounded-full px-2 py-0.5 border ${cls}`}>
      {status}
    </span>
  )
}

function CopyableLine({ children }: { children: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="relative group">
      <pre className="text-xs leading-relaxed bg-black/40 border border-white/[0.06] rounded-lg px-3 py-2 overflow-x-auto text-white/85 whitespace-pre-wrap">
        {children}
      </pre>
      <button
        type="button"
        onClick={async () => {
          try { await navigator.clipboard.writeText(children); setCopied(true); setTimeout(() => setCopied(false), 1200) } catch { /* noop */ }
        }}
        className="absolute top-1.5 right-1.5 text-[10px] uppercase tracking-wider text-white/40 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded px-1.5 py-0.5 transition-colors opacity-0 group-hover:opacity-100"
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  )
}

export default function CliPage() {
  const [payload, setPayload] = useState<Payload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const fetchPayload = useCallback(async () => {
    try {
      setError(null)
      const res = await fetch('/api/cli', { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setPayload((await res.json()) as Payload)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'failed to load cli inventory')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchPayload() }, [fetchPayload])

  const filteredNamespaces = useMemo(() => {
    if (!payload) return []
    const q = search.trim().toLowerCase()
    if (!q) return payload.namespaces
    return payload.namespaces.filter(
      (n) =>
        n.group.toLowerCase().includes(q) ||
        n.description.toLowerCase().includes(q) ||
        n.actions.toLowerCase().includes(q) ||
        (n.notes ?? '').toLowerCase().includes(q),
    )
  }, [payload, search])

  return (
    <div className="h-full overflow-y-auto bg-[#09090b] text-[#fafafa]" data-testid="cli-page">
      <div className="mx-auto max-w-screen-lg px-6 py-10">
        <header className="mb-6">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-cyan-500/20 bg-cyan-500/5 px-3 py-1 text-[11px] font-medium text-cyan-300 uppercase tracking-wider mb-3">
            Mission Control · CLI
          </div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">Mission Control CLI</h1>
          <p className="text-sm text-white/55 leading-relaxed max-w-2xl">
            The <code className="bg-white/10 px-1 py-0.5 rounded text-xs font-mono">mc</code> CLI is the operator control plane for runtimes, agents,
            tasks, billing, and Flight Deck. This page is a catalogue — copy any
            command into your terminal. It is <strong className="text-white/85">not</strong> a remote shell.
          </p>
        </header>

        {/* Install hint */}
        {payload && (
          <section className="mb-8 rounded-xl border border-white/[0.06] bg-white/[0.02] p-5" data-testid="cli-install">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-white/55 mb-3">Run from the repo</h2>
            <CopyableLine>{payload.install_hint.pnpm}</CopyableLine>
            <div className="mt-3">
              <CopyableLine>{payload.install_hint.direct}</CopyableLine>
            </div>
          </section>
        )}

        {/* Search */}
        <div className="mb-4">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search commands by group, action, or topic…"
            className="w-full bg-white/[0.02] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white/85 outline-none focus:border-white/20 placeholder-white/35"
            data-testid="cli-search"
          />
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-rose-500/30 bg-rose-500/[0.05] px-4 py-3 text-sm text-rose-200" data-testid="cli-error">
            {error}
          </div>
        )}

        {loading ? (
          <p className="text-sm text-white/40">Loading…</p>
        ) : !payload ? null : (
          <>
            {/* Top-level shortcuts */}
            <section className="mb-8" data-testid="cli-shortcuts">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-white/55 mb-3">
                Shortcuts
              </h2>
              <ul className="grid gap-2 md:grid-cols-2">
                {payload.shortcuts.map((s) => (
                  <li
                    key={s.shortcut}
                    className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 text-xs"
                  >
                    <code className="text-white font-mono">mc {s.shortcut}</code>
                    <span className="text-white/45"> → {s.expands_to}</span>
                  </li>
                ))}
              </ul>
            </section>

            {/* Operator groups */}
            <section className="mb-8" data-testid="cli-namespaces">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-white/55 mb-3">
                Operator groups · {filteredNamespaces.length}
              </h2>
              {filteredNamespaces.length === 0 ? (
                <p className="text-xs text-white/40 italic">No matches.</p>
              ) : (
                <ul className="grid gap-3 md:grid-cols-2">
                  {filteredNamespaces.map((n) => (
                    <li
                      key={n.group}
                      data-testid={`cli-namespace-${n.group}`}
                      className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"
                    >
                      <div className="flex items-baseline gap-2 mb-1">
                        <code className="text-sm font-mono font-semibold text-white">mc {n.group}</code>
                        <StatusBadge status={n.status} />
                      </div>
                      <p className="text-xs text-white/65 leading-relaxed mb-2">{n.description}</p>
                      <p className="text-[11px] text-white/45 font-mono leading-relaxed">{n.actions}</p>
                      {n.notes && (
                        <p className="mt-2 text-[11px] text-white/45 italic">{n.notes}</p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Legacy groups */}
            <section className="mb-8" data-testid="cli-legacy">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-white/55 mb-3">
                Legacy groups · {payload.legacy.length}
              </h2>
              <ul className="grid gap-2 md:grid-cols-2">
                {payload.legacy.map((n) => (
                  <li
                    key={n.group}
                    data-testid={`cli-legacy-${n.group}`}
                    className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2"
                  >
                    <div className="flex items-baseline gap-2">
                      <code className="text-xs font-mono font-semibold text-white">mc {n.group}</code>
                      <StatusBadge status={n.status} />
                    </div>
                    <p className="text-[11px] text-white/45 mt-1">{n.description}</p>
                  </li>
                ))}
              </ul>
            </section>

            {/* Common flags */}
            <section className="mb-8" data-testid="cli-flags">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-white/55 mb-3">
                Common flags
              </h2>
              <ul className="space-y-1.5">
                {payload.common_flags.map((f) => (
                  <li key={f.flag} className="flex items-baseline gap-3 text-xs text-white/65">
                    <code className="text-white font-mono w-44 shrink-0">{f.flag}</code>
                    <span>{f.description}</span>
                  </li>
                ))}
              </ul>
            </section>

            <p className="text-xs text-white/45 italic" data-testid="cli-note">{payload.note}</p>
          </>
        )}

        <footer className="mt-10 pt-6 border-t border-white/[0.06] text-xs text-white/40 flex items-center justify-between flex-wrap gap-3">
          <span>{payload ? `${payload.namespaces.length} primary groups · ${payload.legacy.length} legacy` : ''}</span>
          <Link href="/app" className="hover:text-white/80">← Back to dashboard</Link>
        </footer>
      </div>
    </div>
  )
}
