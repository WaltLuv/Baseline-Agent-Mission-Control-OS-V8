'use client'

/**
 * Mission Control — Higgsfield / Creative surface.
 *
 * Mirrors the Baseline OS Higgsfield architecture in the cloud: a provider card
 * with honest status, the 4 Higgsfield skills, subsystem status (Soul ID /
 * Product Photoshoot / Marketplace Cards), a provider-filtered cloud gallery,
 * and a Claude Code Studio link. Provider sovereignty: assets/proofs belong to
 * the shared creative core, not the provider. No fake connected state, no fake
 * media — when cloud asset storage isn't wired, the empty state says so.
 */
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  HIGGSFIELD_SKILLS,
  HIGGSFIELD_SUBSYSTEMS,
  deriveHiggsfieldCloudStatus,
  higgsfieldCloudConnected,
  projectCloudAssets,
  HIGGSFIELD_CLOUD_STATUS_LABEL,
  HIGGSFIELD_DASHBOARD_URL,
  CLAUDE_CODE_STUDIO_PATH,
  type UniversalAssetResult,
} from '@/lib/creative/higgsfield'

export function HiggsfieldPanel() {
  const [credentialPresent, setCredentialPresent] = useState(false)
  const [linked, setLinked] = useState(false)
  const [assetsResult, setAssetsResult] = useState<UniversalAssetResult>({ assets: [], state: 'storage_not_configured', reason: 'Loading…' })
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const cat = await fetch('/api/credentials/catalog', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).catch(() => null)
        const providers: Array<{ id: string; saved?: { status?: string } | null }> = cat?.providers ?? []
        const hf = providers.find((p) => p.id === 'higgsfield')
        if (!cancelled) {
          setCredentialPresent(!!(hf?.saved && hf.saved.status !== 'error'))
          setLinked(false) // no cloud Higgsfield runtime link yet — honest
        }
        // No universal cloud asset store wired yet → honest storage_not_configured.
        if (!cancelled) setAssetsResult(projectCloudAssets(null))
      } catch {
        if (!cancelled) setError(true)
      }
    })()
    return () => { cancelled = true }
  }, [])

  const status = useMemo(
    () => deriveHiggsfieldCloudStatus({ credentialPresent, linked, error }),
    [credentialPresent, linked, error],
  )
  const connected = higgsfieldCloudConnected(status)

  return (
    <div className="p-4 space-y-4" data-testid="higgsfield-panel">
      {/* Provider card */}
      <section className="rounded-xl border border-border bg-card p-4" data-testid="higgsfield-provider-card">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Creative provider · compute layer</div>
            <h2 className="text-lg font-semibold mt-0.5">Higgsfield</h2>
            <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
              Image/video generation, Soul ID, product photoshoot, and marketplace cards. Higgsfield is a provider —
              assets, proofs, and jobs are owned by Mission Control&apos;s shared creative core, not the provider.
            </p>
          </div>
          <span
            data-testid="higgsfield-status"
            className="text-[10px] uppercase tracking-wider font-semibold rounded-full border px-2 py-0.5 shrink-0"
            style={
              connected
                ? { background: 'rgba(16,185,129,0.1)', borderColor: 'rgba(16,185,129,0.4)', color: '#34d399' }
                : { background: 'rgba(245,158,11,0.1)', borderColor: 'rgba(245,158,11,0.4)', color: '#fbbf24' }
            }
          >
            {HIGGSFIELD_CLOUD_STATUS_LABEL[status]}
          </span>
        </div>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <Link href={CLAUDE_CODE_STUDIO_PATH} data-testid="higgsfield-studio-link" className="rounded-md border border-border px-2.5 py-1 hover:bg-secondary">Open in Claude Code Studio</Link>
          <Link href="/app/credentials" data-testid="higgsfield-credentials-link" className="rounded-md border border-border px-2.5 py-1 hover:bg-secondary">Credentials</Link>
          <a href={HIGGSFIELD_DASHBOARD_URL} target="_blank" rel="noopener noreferrer" className="rounded-md border border-border px-2.5 py-1 hover:bg-secondary">External dashboard ↗</a>
        </div>
        {!connected && (
          <p className="mt-2 text-[12px] text-amber-400/80" data-testid="higgsfield-setup-needed">
            {status === 'credentials_missing'
              ? 'Save HIGGSFIELD_API_KEY_ID + HIGGSFIELD_API_KEY_SECRET in Credentials to connect.'
              : 'Higgsfield is not linked to this workspace yet — setup required.'}
          </p>
        )}
      </section>

      {/* Subsystems status */}
      <section className="grid gap-3 sm:grid-cols-3" data-testid="higgsfield-subsystems">
        {HIGGSFIELD_SUBSYSTEMS.map((sub) => (
          <div key={sub.id} className="rounded-lg border border-border bg-card p-3" data-testid={`higgsfield-subsystem-${sub.id}`}>
            <div className="text-sm font-medium">{sub.label}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">{sub.approval} approval · {connected ? 'ready' : 'setup required'}</div>
          </div>
        ))}
      </section>

      {/* Skills status */}
      <section className="rounded-xl border border-border bg-card p-4" data-testid="higgsfield-skills">
        <h3 className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-3">Higgsfield skills</h3>
        <div className="grid gap-2 sm:grid-cols-2">
          {HIGGSFIELD_SKILLS.map((s) => (
            <div key={s.slug} className="rounded-lg border border-border bg-background/40 p-3" data-testid={`higgsfield-skill-${s.slug}`}>
              <div className="flex items-center justify-between">
                <div className="text-[13px] font-semibold">{s.name}</div>
                <span className="text-[9px] uppercase tracking-wider rounded-full border border-border px-1.5 py-0.5 text-muted-foreground">{s.pricing} · {s.approval}</span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">{s.description}</p>
              <div className="text-[10px] text-muted-foreground/70 mt-1">in: {s.inputs.join(', ')}</div>
              <Link href="/marketplace" className="text-[10px] text-primary hover:underline mt-1 inline-block">View in marketplace →</Link>
            </div>
          ))}
        </div>
      </section>

      {/* Cloud gallery — honest empty / storage-not-configured */}
      <section className="rounded-xl border border-border bg-card p-4" data-testid="higgsfield-cloud-gallery">
        <h3 className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-3">Cloud assets (Higgsfield-filtered)</h3>
        {assetsResult.state === 'ok' ? (
          <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
            {assetsResult.assets.map((a) => (
              <div key={a.id} className="rounded-lg border border-border bg-background/40 p-2 text-[10px] text-muted-foreground">{a.prompt ?? a.id}</div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border p-6 text-center text-[12px] text-muted-foreground" data-testid="higgsfield-empty-gallery">
            {assetsResult.state === 'storage_not_configured'
              ? 'Universal cloud asset storage isn’t configured yet. Higgsfield assets generated in Baseline OS are stored in the shared creative core; cloud mirroring is a setup-required contract — not faked.'
              : 'No Higgsfield assets in the cloud yet. Generated assets will appear here once produced.'}
          </div>
        )}
      </section>
    </div>
  )
}
