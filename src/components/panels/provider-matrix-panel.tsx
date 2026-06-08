'use client'

/**
 * Creative Provider Matrix (P2) — canonical, provider-sovereign view of every
 * rendering engine MC can drive, with honest status + cost estimate + proof
 * expectation. Includes the HyperFrames HTML→MP4 pipeline stages. No fake
 * connected state, no invented prices.
 */
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  CREATIVE_PROVIDERS, deriveProviderStatus, estimateCost, PROVIDER_STATUS_LABEL,
  type ProviderStatus,
} from '@/lib/creative/provider-matrix'
import { HYPERFRAMES_STAGES } from '@/lib/creative/hyperframes-pipeline'

const STATUS_FG: Record<ProviderStatus, string> = {
  ready: '#34d399',
  credentials_missing: '#fbbf24',
  runtime_required: '#60a5fa',
  setup_needed: '#fbbf24',
}

export function ProviderMatrixPanel() {
  const [savedProviders, setSavedProviders] = useState<Set<string>>(new Set())

  useEffect(() => {
    let cancelled = false
    fetch('/api/credentials/catalog', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d) return
        const saved = new Set<string>()
        for (const p of (d.providers ?? []) as Array<{ id: string; saved?: { status?: string } | null }>) {
          if (p.saved && p.saved.status !== 'error') saved.add(p.id)
        }
        setSavedProviders(saved)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  const rows = useMemo(
    () =>
      CREATIVE_PROVIDERS.map((p) => {
        const credentialPresent = p.requiredCredentials.length === 0 || savedProviders.has(p.id)
        const status = deriveProviderStatus(p, { credentialPresent, runtimePaired: false })
        return { p, status, est: estimateCost(p, 1) }
      }),
    [savedProviders],
  )

  return (
    <div className="p-6 space-y-6" data-testid="provider-matrix-panel">
      <header>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Creative · provider matrix</div>
        <h1 className="text-2xl font-semibold mt-1">Creative Provider Matrix</h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
          Every rendering engine Mission Control can drive — with honest status, a cost estimate, and the proof each one
          must produce. Providers are compute layers; assets &amp; proofs are owned by Mission Control / Baseline OS, not
          the provider. Prices are published unit-rate estimates.
        </p>
      </header>

      <div className="overflow-x-auto rounded-xl border border-border" data-testid="provider-matrix-table">
        <table className="w-full text-sm">
          <thead className="bg-secondary/40 text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="text-left px-3 py-2">Provider</th>
              <th className="text-left px-3 py-2">Modalities</th>
              <th className="text-left px-3 py-2">Est. cost</th>
              <th className="text-left px-3 py-2">Approval</th>
              <th className="text-left px-3 py-2">Status</th>
              <th className="text-left px-3 py-2">Proof produced</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ p, status, est }) => (
              <tr key={p.id} className="border-t border-border/60" data-testid={`provider-row-${p.id}`}>
                <td className="px-3 py-2 font-medium">{p.label}</td>
                <td className="px-3 py-2 text-muted-foreground">{p.modalities.join(', ')}</td>
                <td className="px-3 py-2 text-muted-foreground" data-testid={`provider-cost-${p.id}`}>{est.credits.toLocaleString()} cr <span className="text-muted-foreground/60">(${p.cost.usdPerUnit}/{p.cost.unit.replace(/_/g, ' ')})</span></td>
                <td className="px-3 py-2"><span className="text-[10px] uppercase tracking-wider">{p.approval}</span></td>
                <td className="px-3 py-2"><span className="text-[11px] font-semibold" style={{ color: STATUS_FG[status] }} data-testid={`provider-status-${p.id}`}>{PROVIDER_STATUS_LABEL[status]}</span></td>
                <td className="px-3 py-2 text-[12px] text-muted-foreground">{p.proofExpectation}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-muted-foreground/70">Connect credentials in <Link href="/app/credentials" className="underline">Credentials</Link> or pair a render runtime in <Link href="/app/runtimes" className="underline">Runtimes</Link> to move a provider to Ready.</p>

      {/* HyperFrames pipeline */}
      <section className="rounded-xl border border-border bg-card p-5" data-testid="hyperframes-pipeline">
        <h2 className="text-lg font-semibold">HyperFrames pipeline — HTML → MP4</h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Render data-driven HTML scenes to captioned MP4. Cloud Mission Control orchestrates; the render stages run on a
          paired render runtime (Flight Deck / local Baseline OS, or HeyGen cloud). Render stages stay blocked until a
          runtime pairs — never a faked render.
        </p>
        <ol className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {HYPERFRAMES_STAGES.map((s, i) => (
            <li key={s.id} className="rounded-lg border border-border bg-background/40 p-3" data-testid={`pipeline-stage-${s.id}`}>
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-semibold">{i + 1}. {s.label}</span>
                {s.needsRuntime && <span className="text-[9px] uppercase tracking-wider rounded-full border border-blue-500/40 text-blue-300 px-1.5 py-0.5">runtime</span>}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">{s.description}</p>
            </li>
          ))}
        </ol>
        <div className="mt-3 flex gap-2">
          <Link href="/flight-deck" className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-secondary">Pair a render runtime</Link>
          <Link href="/app/creative" className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-secondary">Open Claude Code Studio</Link>
        </div>
      </section>
    </div>
  )
}
