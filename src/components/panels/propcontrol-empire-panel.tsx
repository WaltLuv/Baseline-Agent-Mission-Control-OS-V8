'use client'

import { useEffect, useState } from 'react'

/**
 * PropControl Empire — the gamified real-estate strategy simulator (replaces
 * the old Office page). It teaches users how to build and operate a property
 * portfolio by playing; it is NOT an operations app. Embedded via iframe when a
 * URL is configured; otherwise a polished launch card. No fake execution.
 */
interface EcoApp {
  id: string
  name: string
  description: string
  note: string | null
  iframeUrl: string | null
  status: string
  setupNeeded: string[]
  resolvedExecutionMode: string
}

export function PropControlEmpirePanel() {
  const [app, setApp] = useState<EcoApp | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [iframeBlocked, setIframeBlocked] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch('/api/ecosystem')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (cancelled) return
        const a = (j?.apps ?? []).find((x: EcoApp) => x.id === 'propcontrol-empire') ?? null
        setApp(a)
        setLoaded(true)
      })
      .catch(() => setLoaded(true))
    return () => { cancelled = true }
  }, [])

  const url = app?.iframeUrl ?? null

  return (
    <div className="p-4 space-y-4" data-testid="propcontrol-empire-panel">
      <header className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-lg font-bold">PropControl Empire</h1>
            <p className="mt-1 text-sm text-white/60">
              Play the real estate strategy game that teaches you how to build and operate a property portfolio —
              acquisitions, financing, deal analysis, maintenance risk, cash flow, leverage, and portfolio growth.
            </p>
            <p className="mt-2 text-[11px] text-white/40">
              Learning &amp; simulation layer of the Baseline Automations ecosystem — not an operations app.
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <span
              data-testid="pce-status"
              className="rounded-full border border-white/15 px-2.5 py-1 text-[11px] text-white/70"
            >
              {loaded ? (url ? `Mode: ${app?.resolvedExecutionMode ?? 'visible_only'}` : 'Setup needed') : 'Checking…'}
            </span>
            {url && (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                data-testid="pce-open-new-tab"
                className="rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-black hover:bg-white/90"
              >
                Open in new tab ↗
              </a>
            )}
          </div>
        </div>
      </header>

      {loaded && !url && (
        <div data-testid="pce-setup-needed" className="rounded-xl border border-amber-500/30 bg-amber-500/[0.06] p-5 text-sm text-amber-100">
          <div className="font-semibold">Setup needed — connect PropControl Empire.</div>
          <p className="mt-1 text-amber-100/80">
            Set <code className="text-amber-200">PROPCONTROL_EMPIRE_IFRAME_URL</code> to embed the game. Until then it can’t be launched here.
          </p>
        </div>
      )}

      {url && !iframeBlocked && (
        <div className="overflow-hidden rounded-xl border border-white/10" style={{ height: '70vh' }}>
          <iframe
            src={url}
            title="PropControl Empire"
            data-testid="pce-iframe"
            className="h-full w-full"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            onError={() => setIframeBlocked(true)}
          />
        </div>
      )}

      {url && iframeBlocked && (
        <div data-testid="pce-iframe-blocked" className="rounded-xl border border-white/10 bg-white/[0.02] p-5 text-sm text-white/70">
          This app refused to embed (X-Frame-Options/CSP). Open it in a controlled browser runtime or a new tab.
          <div className="mt-3">
            <a href={url} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-black">Open in new tab ↗</a>
          </div>
        </div>
      )}

      <p className="text-[11px] text-white/40">
        Agent automation here is <strong>Visible Only / Browser mode</strong> (future work). Game decisions can later
        replay into your learning history and recommend Mission Control workflows.
      </p>
    </div>
  )
}
