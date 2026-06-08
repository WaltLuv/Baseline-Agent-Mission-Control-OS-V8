'use client'

/**
 * Flight Deck Deployment Control Tower — Pair / Runtimes / Infrastructure /
 * Updates / Health / Proof / Done-For-You + customer handoff report. Reads real
 * endpoints; honest states only (no fake heartbeat, no fake health, no fake proof).
 */
import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  PAIR_TARGETS, deriveRuntimeFreshness, freshnessLabel, lastSeenLabel,
  INFRA_TARGETS, FIREWALL_CHECKLIST, UPDATE_COMPONENTS, HEALTH_CHECKS, PROOF_TYPES,
  dfyProgress, buildHandoffReport, type HealthState, type DfySignals, type RuntimeFreshness,
} from '@/lib/flight-deck/deployment-center'

type Runtime = { name: string; version?: string; last_seen?: number | null; status?: string }

const FRESH_FG: Record<RuntimeFreshness, string> = { connected: '#34d399', stale: '#fbbf24', disconnected: '#f87171' }
const HEALTH_FG: Record<HealthState, string> = { ok: '#34d399', degraded: '#fbbf24', down: '#f87171', unknown: '#9ca3af' }

export function FlightDeckDeploymentCenter() {
  const [runtimes, setRuntimes] = useState<Runtime[]>([])
  const [health, setHealth] = useState<Record<string, HealthState>>({})
  const [dfy, setDfy] = useState<DfySignals>({})
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15_000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const j = async (u: string) => fetch(u, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).catch(() => null)
      const [healthRes, rt, me, tmpl, creds] = await Promise.all([
        j('/api/health'), j('/api/runtimes'), j('/api/auth/me'), j('/api/workforce/templates'), j('/api/credentials/catalog'),
      ])
      if (cancelled) return
      // honest health: measured checks get a state, unmeasured stay 'unknown'
      const h: Record<string, HealthState> = {}
      for (const c of HEALTH_CHECKS) h[c.id] = 'unknown'
      h.api = healthRes ? 'ok' : 'down'
      h['runtime-registry'] = rt ? 'ok' : 'unknown'
      h.credentials = creds ? 'ok' : 'unknown'
      setHealth(h)

      const list: Runtime[] = (rt?.runtimes ?? rt?.items ?? []) as Runtime[]
      setRuntimes(Array.isArray(list) ? list : [])

      const installed = (tmpl?.templates ?? []).some((t: { install_state?: { installed?: boolean } }) => t.install_state?.installed)
      const credCount = (creds?.providers ?? []).filter((p: { saved?: unknown }) => p.saved).length
      setDfy({
        workspace: !!me?.user?.workspace_id,
        emailVerified: me?.user ? me.user.email_verified !== false : false,
        workforceSelected: installed,
        workflowsInstalled: installed,
        credentialsAdded: credCount > 0,
        runtimesPaired: Array.isArray(list) && list.length > 0,
      })
    })()
    return () => { cancelled = true }
  }, [])

  const progress = dfyProgress(dfy)

  function exportHandoff() {
    const report = buildHandoffReport({
      workspace: 'current-workspace',
      generatedAt: Date.now(),
      connectedRuntimes: runtimes.filter((r) => deriveRuntimeFreshness(r.last_seen ?? null, now) === 'connected').map((r) => r.name),
      health,
      nextSteps: progress.steps.filter((s) => !s.done).map((s) => s.step.label),
      supportNotes: 'Generated from live Flight Deck state.',
    })
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'customer-handoff-report.json'; a.click()
    URL.revokeObjectURL(url)
  }

  const Section = ({ id, title, children }: { id: string; title: string; children: React.ReactNode }) => (
    <section className="rounded-xl border border-border bg-card p-5" data-testid={`flightdeck-${id}`}>
      <h2 className="text-sm font-semibold mb-3">{title}</h2>
      {children}
    </section>
  )

  return (
    <div className="space-y-5 mt-8" data-testid="flightdeck-deployment-center">
      <Section id="pair" title="Pair">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {PAIR_TARGETS.map((t) => (
            <div key={t.id} className="rounded-lg border border-border bg-background/40 p-3" data-testid={`pair-${t.id}`}>
              <div className="flex items-center justify-between"><span className="text-[13px] font-semibold">{t.label}</span><span className="text-[9px] uppercase tracking-wider text-muted-foreground">{t.method}</span></div>
              <p className="text-[11px] text-muted-foreground mt-1">{t.instructions}</p>
            </div>
          ))}
        </div>
        <Link href="/app/runtimes" className="text-[11px] text-primary hover:underline mt-3 inline-block">Mint a runtime key →</Link>
      </Section>

      <Section id="runtimes" title="Runtimes">
        {runtimes.length === 0 ? (
          <p className="text-[12px] text-muted-foreground" data-testid="runtimes-empty">No runtimes connected yet. Pair one above — heartbeats appear here once a runtime checks in (no fake heartbeats).</p>
        ) : (
          <div className="space-y-1.5">
            {runtimes.map((r) => {
              const f = deriveRuntimeFreshness(r.last_seen ?? null, now)
              return (
                <div key={r.name} className="flex items-center justify-between text-[12px]" data-testid={`runtime-${r.name}`}>
                  <span>{r.name} <span className="text-muted-foreground/60">{r.version ?? ''}</span></span>
                  <span><span style={{ color: FRESH_FG[f] }}>{freshnessLabel(f)}</span> <span className="text-muted-foreground">· {lastSeenLabel(r.last_seen ?? null, now)}</span></span>
                </div>
              )
            })}
          </div>
        )}
      </Section>

      <Section id="infrastructure" title="Infrastructure">
        <div className="grid gap-2 sm:grid-cols-4 mb-3">
          {INFRA_TARGETS.map((i) => (
            <div key={i.id} className="rounded-lg border border-border bg-background/40 p-3 text-center" data-testid={`infra-${i.id}`}>
              <div className="text-[13px] font-semibold">{i.label}</div>
              <div className="text-[10px] text-muted-foreground">{i.kind}</div>
            </div>
          ))}
        </div>
        <div className="text-[11px] text-muted-foreground" data-testid="firewall-checklist">
          <div className="uppercase tracking-wider font-semibold mb-1">Security checklist</div>
          <ul className="list-disc pl-4 space-y-0.5">{FIREWALL_CHECKLIST.map((c) => <li key={c}>{c}</li>)}</ul>
        </div>
      </Section>

      <Section id="updates" title="Updates">
        <div className="space-y-2">
          {UPDATE_COMPONENTS.map((u) => (
            <div key={u.id} className="rounded-lg border border-border bg-background/40 p-3" data-testid={`update-${u.id}`}>
              <div className="text-[13px] font-semibold">{u.label}</div>
              <code className="text-[10px] text-muted-foreground block mt-1">update: {u.updateCommand}</code>
              <code className="text-[10px] text-muted-foreground/70 block">rollback: {u.rollback}</code>
            </div>
          ))}
        </div>
      </Section>

      <Section id="health" title="Health">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4" data-testid="health-checks">
          {HEALTH_CHECKS.map((c) => {
            const st = health[c.id] ?? 'unknown'
            return (
              <div key={c.id} className="flex items-center justify-between rounded-lg border border-border bg-background/40 px-3 py-2" data-testid={`health-${c.id}`}>
                <span className="text-[12px]">{c.label}</span>
                <span className="text-[10px] uppercase font-semibold" style={{ color: HEALTH_FG[st] }}>{st}</span>
              </div>
            )
          })}
        </div>
      </Section>

      <Section id="proof" title="Proof">
        <div className="flex flex-wrap gap-2">
          {PROOF_TYPES.map((p) => (
            <span key={p} className="text-[11px] rounded-full border border-border px-2.5 py-1 text-muted-foreground" data-testid={`proof-${p}`}>{p}</span>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground/70 mt-2">Proof records are written by real events (install, pairing, heartbeat, version, sync, deployment) — never synthesized.</p>
      </Section>

      <Section id="dfy" title="Done-For-You Setup">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[12px] text-muted-foreground" data-testid="dfy-progress">{progress.done} of {progress.total} complete</span>
          <button onClick={exportHandoff} data-testid="export-handoff" className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-secondary">Export handoff report</button>
        </div>
        <div className="grid gap-1.5 sm:grid-cols-2" data-testid="dfy-checklist">
          {progress.steps.map(({ step, done }) => (
            <div key={step.id} className="flex items-center gap-2 text-[12px]" data-testid={`dfy-${step.id}`}>
              <span style={{ color: done ? '#34d399' : '#6b7280' }}>{done ? '✓' : '○'}</span>
              <span className={done ? '' : 'text-muted-foreground'}>{step.label}</span>
            </div>
          ))}
        </div>
      </Section>
    </div>
  )
}
