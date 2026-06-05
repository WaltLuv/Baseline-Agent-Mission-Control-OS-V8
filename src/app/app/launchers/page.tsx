'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'

// ─────────────────────────────────────────────────────────────────────
// /app/launchers — Embedded-launcher hub.
//
// Mission Control links out to third-party tools rather than iframing
// them. Each card shows real configuration state: when the env-driven
// URL is missing we render a setup-needed state with the exact var
// names. We never fake "connected."
// ─────────────────────────────────────────────────────────────────────

interface Launcher {
  id: string
  name: string
  description: string
  category: 'media' | 'editor' | 'ide' | 'automation'
  url_env: string
  auth_env?: string
  launch_notes?: string
  setup_doc?: string
  configured: boolean
  url: string | null
  auth_present: boolean
}

interface Payload {
  launchers: Launcher[]
  totals: { catalogue: number; configured: number }
}

const CATEGORY_LABEL: Record<Launcher['category'], string> = {
  media: 'Media',
  editor: 'Editor',
  ide: 'IDE',
  automation: 'Automation',
}

export default function LaunchersPage() {
  const [payload, setPayload] = useState<Payload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchPayload = useCallback(async () => {
    try {
      setError(null)
      const res = await fetch('/api/launchers', { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setPayload((await res.json()) as Payload)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'failed to load launchers')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchPayload() }, [fetchPayload])

  return (
    <div className="h-full overflow-y-auto bg-[#09090b] text-[#fafafa]" data-testid="launchers-page">
      <div className="mx-auto max-w-screen-lg px-6 py-10">
        <header className="mb-6">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-violet-500/20 bg-violet-500/5 px-3 py-1 text-[11px] font-medium text-violet-300 uppercase tracking-wider mb-3">
            Mission Control · Launchers
          </div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">Embedded launchers</h1>
          <p className="text-sm text-white/55 leading-relaxed max-w-2xl">
            Third-party tools Mission Control hands off to. Each card opens in a new tab
            rather than embedding, so you can see what runs where. Missing configuration is
            shown honestly — no fake &ldquo;connected&rdquo; states.
          </p>
        </header>

        {payload && (
          <section className="mb-6 grid grid-cols-2 gap-3" data-testid="launchers-totals">
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <div className="text-[11px] uppercase tracking-wider text-white/40">Configured</div>
              <div className="text-2xl font-bold font-mono mt-1">{payload.totals.configured}</div>
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <div className="text-[11px] uppercase tracking-wider text-white/40">In catalogue</div>
              <div className="text-2xl font-bold font-mono mt-1">{payload.totals.catalogue}</div>
            </div>
          </section>
        )}

        {error && (
          <div className="mb-4 rounded-lg border border-rose-500/30 bg-rose-500/[0.05] px-4 py-3 text-sm text-rose-200" data-testid="launchers-error">
            {error}
          </div>
        )}

        {loading ? (
          <p className="text-sm text-white/40">Loading…</p>
        ) : !payload ? null : (
          <section data-testid="launchers-grid" className="grid gap-4 md:grid-cols-2">
            {payload.launchers.map((l) => (
              <article
                key={l.id}
                data-testid={`launcher-${l.id}`}
                className={`rounded-xl border p-5 ${l.configured ? 'border-emerald-500/20 bg-emerald-500/[0.03]' : 'border-white/[0.06] bg-white/[0.02]'}`}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <span className={`inline-block h-2 w-2 rounded-full ${l.configured ? 'bg-emerald-400 shadow-emerald-400/50' : 'bg-zinc-500'} shadow-[0_0_6px]`} />
                  <h3 className="text-base font-semibold text-white">{l.name}</h3>
                  <span className="text-[10px] uppercase tracking-wider text-white/40 ml-auto bg-white/[0.04] border border-white/[0.08] rounded-full px-2 py-0.5">
                    {CATEGORY_LABEL[l.category]}
                  </span>
                </div>
                <p className="text-xs text-white/65 leading-relaxed mb-3">{l.description}</p>

                {l.configured ? (
                  <div className="space-y-2">
                    <p className="text-[11px] text-white/45">
                      URL configured via <code className="font-mono bg-white/[0.06] px-1 py-0.5 rounded text-[10px]">{l.url_env}</code>
                      {l.auth_env && (
                        <>
                          {' · '}
                          {l.auth_present ? (
                            <span className="text-emerald-300">{l.auth_env} present</span>
                          ) : (
                            <span className="text-amber-300">{l.auth_env} missing</span>
                          )}
                        </>
                      )}
                    </p>
                    {l.launch_notes && (
                      <p className="text-[11px] text-white/55 leading-relaxed italic">{l.launch_notes}</p>
                    )}
                    <a
                      href={l.url ?? '#'}
                      target="_blank"
                      rel="noreferrer"
                      data-testid={`launcher-${l.id}-launch`}
                      className="inline-flex items-center gap-1.5 text-sm font-semibold rounded-lg bg-white text-[#09090b] px-4 py-2 hover:bg-white/90 transition-colors"
                    >
                      Launch in new tab →
                    </a>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-[11px] uppercase tracking-wider text-amber-300 font-semibold">
                      Setup needed
                    </p>
                    <p className="text-[11px] text-white/55 leading-relaxed">
                      Set <code className="font-mono bg-white/[0.06] px-1 py-0.5 rounded text-[10px]">{l.url_env}</code>
                      {l.auth_env && (
                        <>
                          {' '}and{' '}
                          <code className="font-mono bg-white/[0.06] px-1 py-0.5 rounded text-[10px]">{l.auth_env}</code>
                        </>
                      )}
                      {' '}in your Mission Control environment to enable the launcher.
                    </p>
                    {l.setup_doc && (
                      <a
                        href={l.setup_doc}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] text-violet-300 hover:text-violet-200"
                      >
                        Setup docs →
                      </a>
                    )}
                  </div>
                )}
              </article>
            ))}
          </section>
        )}

        <footer className="mt-10 pt-6 border-t border-white/[0.06] text-xs text-white/40 flex items-center justify-between flex-wrap gap-3">
          <span>{payload ? `${payload.totals.configured} of ${payload.totals.catalogue} configured` : ''}</span>
          <Link href="/app" className="hover:text-white/80">← Back to dashboard</Link>
        </footer>
      </div>
    </div>
  )
}
