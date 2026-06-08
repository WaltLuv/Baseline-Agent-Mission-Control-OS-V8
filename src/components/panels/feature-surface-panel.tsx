'use client'

/**
 * FeatureSurfacePanel — honest Mission Control surface for a Baseline OS feature
 * that isn't a fully-live MC panel yet. Renders a real route with an honest
 * state (Connect runtime / Connect Baseline OS / Setup needed) and a clear
 * enable path — never a 404, never a blank shell, never a fake-ready state.
 */
import Link from 'next/link'
import { getSurface, PARITY_STATUS_LABEL } from '@/lib/parity/surfaces'

const STATUS_STYLE: Record<string, { bg: string; bd: string; fg: string }> = {
  cloud_pairing: { bg: 'rgba(59,130,246,0.10)', bd: 'rgba(59,130,246,0.4)', fg: '#60a5fa' },
  connect_baseline: { bg: 'rgba(167,139,250,0.10)', bd: 'rgba(167,139,250,0.4)', fg: '#a78bfa' },
  setup_needed: { bg: 'rgba(245,158,11,0.10)', bd: 'rgba(245,158,11,0.4)', fg: '#fbbf24' },
  live: { bg: 'rgba(16,185,129,0.10)', bd: 'rgba(16,185,129,0.4)', fg: '#34d399' },
}

export function FeatureSurfacePanel({ slug }: { slug: string }) {
  const s = getSurface(slug)
  if (!s) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground" data-testid="feature-surface-unknown">
        Unknown surface. <Link href="/app" className="underline">Back to dashboard</Link>
      </div>
    )
  }
  const st = STATUS_STYLE[s.status] ?? STATUS_STYLE.setup_needed
  return (
    <div className="p-6 max-w-3xl" data-testid={`feature-surface-${s.slug}`} data-status={s.status}>
      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.category}</div>
            <h1 className="text-2xl font-semibold mt-1">{s.label}</h1>
            <p className="text-sm text-muted-foreground mt-2 max-w-xl">{s.description}</p>
          </div>
          <span className="text-[10px] uppercase tracking-wider font-semibold rounded-full border px-2 py-0.5 shrink-0"
            style={{ background: st.bg, borderColor: st.bd, color: st.fg }} data-testid="feature-surface-status">
            {PARITY_STATUS_LABEL[s.status]}
          </span>
        </div>

        <div className="mt-5 rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground" data-testid="feature-surface-state">
          {s.status === 'connect_baseline' && (
            <p>This is a <strong>local-first</strong> Baseline OS feature. Connect Baseline OS (Flight Deck) to operate it from Mission Control. Nothing here is faked — the surface activates once a local runtime is paired.</p>
          )}
          {s.status === 'cloud_pairing' && (
            <p>This runtime works in Mission Control once you <strong>pair it</strong> from the Runtimes page. Until a runtime connects, this surface stays in setup — no fake connected state.</p>
          )}
          {s.status === 'setup_needed' && (
            <p>This surface needs configuration before it goes live (credentials or backend). It is a real route with an honest setup state — not a placeholder shell.</p>
          )}
          {s.enableHint && <p className="mt-2 text-foreground/80">{s.enableHint}</p>}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {s.enableHref && (
            <Link href={s.enableHref} data-testid="feature-surface-enable" className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-secondary">
              {s.status === 'connect_baseline' ? 'Connect Baseline OS' : s.status === 'cloud_pairing' ? 'Pair a runtime' : 'Configure'}
            </Link>
          )}
          <Link href="/app/credentials" className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-secondary">Credentials</Link>
          <Link href="/flight-deck" className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-secondary">Flight Deck</Link>
        </div>

        <p className="mt-4 text-[11px] text-muted-foreground/70">
          Baseline OS route: <code>{s.baselineRoute}</code> · Mission Control parity surface. Full cloud implementation tracked in the parity matrix.
        </p>
      </div>
    </div>
  )
}
