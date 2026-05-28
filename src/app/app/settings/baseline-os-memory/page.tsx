'use client'

import { useEffect, useState } from 'react'

/**
 * Baseline OS — Memory Connectors Settings (`/app/settings/baseline-os-memory`).
 *
 * Operator-facing surface for the 3-layer brain/memory system:
 *   Layer 1 — Operator Memory       (Obsidian)
 *   Layer 2 — Knowledge Intelligence (Pinecone)
 *   Layer 3 — Business Knowledge Base (Notion)
 *
 * For each source we show: connected/disconnected, last sync, document
 * count, permission scope, visibility, and a Connect / Resync / Disconnect
 * control. Credentials live server-side — never typed here.
 */
interface Source {
  id: number
  sourceType: 'obsidian' | 'pinecone' | 'notion' | 'internal'
  displayName: string
  status: string
  lastSyncAt: number | null
  documentCount: number
  embeddingCount: number
  permissionScope: string
  visibility: string
}

const COPY: Record<Source['sourceType'], { layer: string; layerLabel: string; description: string; useCases: string[] }> = {
  obsidian: {
    layer: 'Layer 1',
    layerLabel: 'Operator Memory',
    description: 'Founder/operator notes, doctrines, SOPs — fast local working memory only the operator sees.',
    useCases: ['Strategy docs', 'Meeting notes', 'Agent doctrines', 'Daily reflections'],
  },
  pinecone: {
    layer: 'Layer 2',
    layerLabel: 'Knowledge Intelligence',
    description: 'Semantic vector recall — similar tasks, customer context, business knowledge retrieval.',
    useCases: ['Embeddings', 'Semantic search', 'Similar-task retrieval', 'Reasoning context'],
  },
  notion: {
    layer: 'Layer 3',
    layerLabel: 'Business Knowledge Base',
    description: 'Structured business operating knowledge — playbooks, SOPs, CRM notes, content calendars.',
    useCases: ['SOPs', 'Customer playbooks', 'Business plans', 'Team docs'],
  },
  internal: {
    layer: 'Layer 0',
    layerLabel: 'Internal Workforce Memory',
    description: 'Built-in: every hire, install, decision, and rationale your AI workforce records here.',
    useCases: ['Hires', 'Skill installs', 'Decisions', 'Recommendations'],
  },
}

function formatRelative(ts: number | null) {
  if (!ts) return 'Never'
  const sec = Math.max(0, Math.floor(Date.now() / 1000) - ts)
  if (sec < 60) return `${sec}s ago`
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`
  return `${Math.floor(sec / 86400)}d ago`
}

export default function BaselineOSMemorySettings() {
  const [sources, setSources] = useState<Source[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const load = async () => {
    try {
      const r = await fetch('/api/baseline-os/memory-sources', { credentials: 'include' })
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const data = await r.json()
      setSources(data.sources ?? [])
    } catch (e) {
      setError(String(e).slice(0, 150))
    }
  }
  useEffect(() => { load() }, [])

  const updateSource = async (sourceType: Source['sourceType'], action: 'connect' | 'disconnect' | 'resync') => {
    setBusy(sourceType)
    try {
      await fetch('/api/baseline-os/memory-sources', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceType, action, metadata: action === 'connect' ? { connectedAt: Date.now() } : undefined }),
      })
      await load()
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="p-6">
      <div data-testid="panel-story-baseline-os-memory" className="mb-4 rounded-lg border border-border/60 bg-card/20 p-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-primary">Baseline OS</p>
        <h2 className="mt-1 text-base font-semibold text-foreground">Workforce Brain / Memory Connectors</h2>
        <p className="mt-1 text-xs text-muted-foreground max-w-2xl">
          Baseline OS is the reasoning layer that powers Mission Control. Connect the memory
          sources your AI workforce should draw context from. We never store raw credentials in
          this table — only safe metadata. Sync runs server-side, redacting secrets before any
          indexing.
        </p>
      </div>

      {error && (
        <div className="mb-3 rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2" data-testid="memory-sources-grid">
        {sources?.map((s) => {
          const copy = COPY[s.sourceType]
          const isConnected = s.status === 'connected'
          return (
            <article
              key={s.id}
              data-testid={`memory-source-${s.sourceType}`}
              className={`rounded-2xl border p-5 transition-colors ${
                isConnected ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-border/40 bg-card/30'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-primary">
                    {copy.layer} · {copy.layerLabel}
                  </p>
                  <h3 className="mt-1 text-base font-semibold text-foreground">{s.displayName}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">{copy.description}</p>
                </div>
                <span
                  className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                    isConnected
                      ? 'text-emerald-300 border-emerald-500/40 bg-emerald-500/10'
                      : 'text-muted-foreground border-border/40 bg-card/40'
                  }`}
                  data-testid={`memory-source-status-${s.sourceType}`}
                >
                  {isConnected ? 'Connected' : 'Disconnected'}
                </span>
              </div>

              <div className="mt-3 flex flex-wrap gap-1">
                {copy.useCases.map((u) => (
                  <span key={u} className="rounded border border-border/40 bg-muted/20 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    {u}
                  </span>
                ))}
              </div>

              <dl className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
                <Stat label="Documents" value={s.documentCount.toLocaleString()} />
                <Stat label="Embeddings" value={s.embeddingCount.toLocaleString()} />
                <Stat label="Last sync" value={formatRelative(s.lastSyncAt)} />
              </dl>

              <p className="mt-3 text-[10px] text-muted-foreground">
                Permission: <span className="text-foreground">{s.permissionScope}</span> ·
                Visibility: <span className="text-foreground">{s.visibility}</span>
              </p>

              {s.sourceType !== 'internal' && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {isConnected ? (
                    <>
                      <button
                        type="button"
                        disabled={busy === s.sourceType}
                        onClick={() => updateSource(s.sourceType, 'resync')}
                        data-testid={`memory-source-resync-${s.sourceType}`}
                        className="rounded-md border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary disabled:opacity-50"
                      >
                        {busy === s.sourceType ? 'Syncing…' : 'Resync'}
                      </button>
                      <button
                        type="button"
                        disabled={busy === s.sourceType}
                        onClick={() => updateSource(s.sourceType, 'disconnect')}
                        data-testid={`memory-source-disconnect-${s.sourceType}`}
                        className="rounded-md border border-border/40 px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted/20 disabled:opacity-50"
                      >
                        Disconnect
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      disabled={busy === s.sourceType}
                      onClick={() => updateSource(s.sourceType, 'connect')}
                      data-testid={`memory-source-connect-${s.sourceType}`}
                      className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground disabled:opacity-50"
                    >
                      {busy === s.sourceType ? 'Connecting…' : `Connect ${copy.layerLabel}`}
                    </button>
                  )}
                  <a
                    href={`/docs/integrations/${s.sourceType}`}
                    className="rounded-md border border-border/40 px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted/20"
                  >
                    Setup guide →
                  </a>
                </div>
              )}
            </article>
          )
        })}
      </div>

      <p className="mt-6 text-[11px] text-muted-foreground">
        Privacy: workspace-scoped. Memory never crosses workspaces. Operator-only sources are
        not visible to customer workspaces. Secrets are redacted before indexing.{' '}
        <a href="/docs/security/MEMORY_PRIVACY_MODEL" className="underline">Read the privacy model →</a>
      </p>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-border/40 bg-muted/20 p-2 text-center">
      <div className="text-xs font-bold text-foreground">{value}</div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  )
}
