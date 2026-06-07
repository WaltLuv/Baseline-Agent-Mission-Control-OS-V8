'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  HERMES_VPS_CAPABILITIES,
  HERMES_VPS_DOCS,
  HERMES_VPS_HARDENING_DOCS,
  HERMES_VPS_KIND,
  HERMES_VPS_NAME,
  HERMES_VPS_ROLE,
  HERMES_VPS_STATE_LABEL,
  HERMES_VPS_WORKSPACE_HINT,
  deriveHermesVpsState,
  hermesVpsDot,
  type HermesVpsState,
} from '@/lib/baseline-os/hermes-vps-state'

/**
 * <HermesVpsCard /> — the Hermes VPS pairing panel on /app/runtimes.
 *
 * Pairs the VPS securely WITHOUT SSH credentials: mint a one-time runtime key,
 * the operator runs the curl command on the VPS, the VPS registers itself, and
 * Mission Control confirms via heartbeat. The card NEVER shows "connected"
 * without a real heartbeat (deriveHermesVpsState is the single source of truth)
 * and NEVER asks for a root password.
 */

interface Projection {
  runtime_id: string
  runtime_type: string
  name: string
  status: 'healthy' | 'warning' | 'critical' | 'offline'
  heartbeat_age: number | null
  last_seen: number
  workspace_id: number
  capabilities: string[]
  internal_id: number
}

interface MintResult {
  api_key_hint: string
  curl_command: string
  docs_url: string
  workspace_id: number
}

function StatusDot({ state }: { state: HermesVpsState }) {
  const bucket = hermesVpsDot(state)
  const cls =
    bucket === 'connected' ? 'bg-emerald-400 shadow-emerald-400/50'
    : bucket === 'stale' ? 'bg-amber-400 shadow-amber-400/50'
    : bucket === 'disconnected' ? 'bg-rose-400 shadow-rose-400/50'
    : 'bg-zinc-500'
  return <span className={`inline-block h-2.5 w-2.5 rounded-full ${cls} shadow-[0_0_6px]`} />
}

function ageLabel(seconds: number | null): string {
  if (seconds === null || seconds === undefined) return 'never'
  if (seconds < 60) return `${seconds}s ago`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  return `${Math.floor(seconds / 3600)}h ago`
}

export function HermesVpsCard() {
  const [projection, setProjection] = useState<Projection | null>(null)
  const [minted, setMinted] = useState<MintResult | null>(null)
  const [polling, setPolling] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/runtimes', { cache: 'no-store' })
      if (!res.ok) return
      const data = (await res.json()) as { runtimes: Projection[] }
      const row = (data.runtimes || []).find((r) => r.runtime_id === HERMES_VPS_KIND) || null
      setProjection(row)
    } catch {
      /* leave prior state; surfaced via card status, never faked */
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  // Poll for the first heartbeat while we have a freshly minted key but no
  // registry row yet (the VPS hasn't called home). Stops once connected.
  useEffect(() => {
    if (!minted || projection) return
    setPolling(true)
    const t = setInterval(refresh, 5000)
    return () => clearInterval(t)
  }, [minted, projection, refresh])

  const state = deriveHermesVpsState({ projection, minted: !!minted, polling })

  async function mint() {
    setBusy(true); setError(null)
    try {
      const res = await fetch('/api/onboarding/runtime-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runtime: HERMES_VPS_KIND, label: HERMES_VPS_NAME }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setMinted((await res.json()) as MintResult)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed to mint pairing key')
    } finally {
      setBusy(false)
    }
  }

  async function revoke() {
    if (!projection) return
    setBusy(true); setError(null)
    try {
      const res = await fetch(`/api/runtimes/${projection.internal_id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setProjection(null); setMinted(null); setPolling(false)
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed to revoke runtime')
    } finally {
      setBusy(false)
    }
  }

  const linkedWorkspace = projection?.workspace_id ?? minted?.workspace_id ?? null

  return (
    <section className="mb-12" data-testid="hermes-vps-section">
      <h2 className="text-lg font-semibold mb-4">Hermes VPS · Production Controller</h2>
      <div
        className="rounded-xl border border-violet-500/25 bg-violet-500/[0.04] p-5"
        data-testid="hermes-vps-card"
        data-state={state}
      >
        {/* Header */}
        <div className="flex items-center gap-2.5 mb-3">
          <StatusDot state={state} />
          <h3 className="text-base font-semibold text-white">{HERMES_VPS_NAME}</h3>
          <span
            className="ml-auto text-[10px] font-mono uppercase tracking-wider rounded border border-white/10 bg-white/[0.04] px-2 py-0.5 text-white/70"
            data-testid="hermes-vps-status"
          >
            {HERMES_VPS_STATE_LABEL[state]}
          </span>
        </div>

        {/* Identity grid */}
        <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs mb-4">
          <div className="flex justify-between gap-2"><dt className="text-white/45">runtime_id</dt><dd className="font-mono text-white/80">{HERMES_VPS_KIND}</dd></div>
          <div className="flex justify-between gap-2"><dt className="text-white/45">role</dt><dd className="text-white/80">{HERMES_VPS_ROLE}</dd></div>
          <div className="flex justify-between gap-2"><dt className="text-white/45">workspace path</dt><dd className="font-mono text-white/80" data-testid="hermes-vps-workspace-hint">{HERMES_VPS_WORKSPACE_HINT}</dd></div>
          <div className="flex justify-between gap-2"><dt className="text-white/45">linked workspace</dt><dd className="text-white/80">{linkedWorkspace !== null ? `#${linkedWorkspace}` : '—'}</dd></div>
          <div className="flex justify-between gap-2"><dt className="text-white/45">last seen</dt><dd className="text-white/80" data-testid="hermes-vps-last-seen">{projection ? ageLabel(projection.heartbeat_age) : 'never'}</dd></div>
          <div className="flex justify-between gap-2"><dt className="text-white/45">heartbeat</dt><dd className="text-white/80" data-testid="hermes-vps-heartbeat">{state === 'connected' ? 'live' : projection ? 'overdue' : 'none yet'}</dd></div>
        </dl>

        {/* Capabilities */}
        <div className="flex flex-wrap gap-1.5 mb-4" data-testid="hermes-vps-capabilities">
          {HERMES_VPS_CAPABILITIES.map((c) => (
            <span key={c} className="text-[10px] font-mono rounded border border-violet-500/20 bg-violet-500/10 px-1.5 py-0.5 text-violet-200">{c}</span>
          ))}
        </div>

        {/* Pairing copy */}
        <p className="text-xs text-white/60 leading-relaxed mb-3">
          Pair Hermes VPS securely without storing SSH credentials. Generate a one-time
          runtime key, run the curl command on the VPS, and Mission Control will verify
          heartbeat.
        </p>

        {/* Security warning */}
        <div
          className="rounded-lg border border-amber-500/30 bg-amber-500/[0.06] px-3 py-2 text-[11px] text-amber-100/90 mb-4"
          data-testid="hermes-vps-hardening-warning"
        >
          <strong className="text-amber-200">Do not paste root passwords into Mission Control.</strong>{' '}
          Use SSH keys on your VPS and disable password login.{' '}
          <a href={HERMES_VPS_HARDENING_DOCS} className="underline hover:text-amber-100" data-testid="hermes-vps-hardening-link">Hardening guide →</a>
        </div>

        {error && (
          <div className="rounded-lg border border-rose-500/30 bg-rose-500/[0.06] px-3 py-2 text-xs text-rose-200 mb-3" data-testid="hermes-vps-error">{error}</div>
        )}

        {/* One-time pairing command (shown only right after minting) */}
        {minted && state !== 'connected' && (
          <div className="mb-4" data-testid="hermes-vps-command-block">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] uppercase tracking-wider text-white/45 font-mono">Run this on the VPS (one-time)</span>
              <span className="text-[10px] font-mono text-white/40">key {minted.api_key_hint}</span>
            </div>
            <div className="relative group">
              <pre className="text-xs leading-relaxed bg-black/40 border border-white/[0.06] rounded-lg px-3 py-2 overflow-x-auto text-white/85 whitespace-pre-wrap" data-testid="hermes-vps-command">{minted.curl_command}</pre>
              <button
                type="button"
                data-testid="hermes-vps-copy"
                onClick={async () => { try { await navigator.clipboard.writeText(minted.curl_command); setCopied(true); setTimeout(() => setCopied(false), 1200) } catch { /* noop */ } }}
                className="absolute top-1.5 right-1.5 text-[10px] uppercase tracking-wider text-white/40 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded px-1.5 py-0.5"
              >{copied ? 'Copied' : 'Copy'}</button>
            </div>
            <p className="mt-1.5 text-[11px] text-white/40">The key is shown once. We&apos;ll flip this card to <strong>Connected</strong> on the first heartbeat.</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {state === 'not_paired' && (
            <button type="button" data-testid="hermes-vps-generate" disabled={busy} onClick={mint}
              className="h-9 px-4 rounded-lg bg-white text-[#09090b] text-sm font-semibold hover:bg-white/90 disabled:opacity-50">
              {busy ? 'Generating…' : 'Generate pairing key'}
            </button>
          )}
          {state !== 'not_paired' && (
            <button type="button" data-testid="hermes-vps-regenerate" disabled={busy} onClick={mint}
              className="h-9 px-3 rounded-lg bg-white/[0.06] text-white/85 text-sm font-medium border border-white/[0.08] hover:bg-white/[0.1] disabled:opacity-50">
              {busy ? 'Working…' : 'Regenerate key'}
            </button>
          )}
          {projection && (
            <button type="button" data-testid="hermes-vps-revoke" disabled={busy} onClick={revoke}
              className="h-9 px-3 rounded-lg bg-rose-500/10 text-rose-200 text-sm font-medium border border-rose-500/25 hover:bg-rose-500/20 disabled:opacity-50">
              Revoke runtime
            </button>
          )}
          <a href={HERMES_VPS_DOCS} data-testid="hermes-vps-docs" className="ml-auto text-xs text-violet-300 hover:underline">Pairing docs →</a>
        </div>
      </div>
    </section>
  )
}
