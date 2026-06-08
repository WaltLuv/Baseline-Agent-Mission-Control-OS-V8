'use client'

/**
 * Knowledge OS dashboard — the PI Agent's four-brain command center: layer
 * status, memory health, analytics, import centers, and shared agent memory.
 * Honest states throughout (no fake sync, no fake counts).
 */
import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { BRAIN_LAYERS, deriveLayerState, SYNC_STATE_LABEL, type BrainLayerId, type SyncState } from '@/lib/knowledge/brain-layers'
import { PI_AGENT, memoryHealth, EMPTY_METRICS } from '@/lib/knowledge/pi-agent'
import { IMPORT_SOURCES } from '@/lib/knowledge/import-sources'
import { MEMORY_AGENTS } from '@/lib/knowledge/agent-memory'

const STATE_FG: Record<SyncState, string> = {
  connected: '#34d399', manual_import: '#60a5fa', setup_needed: '#fbbf24',
  unsupported_by_api: '#a78bfa', error: '#f87171',
}

export function KnowledgeOsPanel() {
  const [creds, setCreds] = useState<Set<string>>(new Set())
  useEffect(() => {
    fetch('/api/credentials/catalog', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return
        const s = new Set<string>()
        for (const p of (d.providers ?? []) as Array<{ id: string; saved?: { status?: string } | null }>) {
          if (p.saved && p.saved.status !== 'error') s.add(p.id)
        }
        setCreds(s)
      }).catch(() => {})
  }, [])

  const layerStates = useMemo(() => {
    const signals = {
      obsidianVaultPath: false,
      notionCredential: creds.has('notion'),
      pineconeCredential: creds.has('pinecone'),
      notebooklmConnected: false,
    }
    const out = {} as Record<BrainLayerId, SyncState>
    for (const b of BRAIN_LAYERS) out[b.id] = deriveLayerState(b.id, signals)
    return out
  }, [creds])

  const health = useMemo(() => memoryHealth(layerStates, EMPTY_METRICS), [layerStates])
  const m = EMPTY_METRICS

  return (
    <div className="p-6 space-y-6" data-testid="knowledge-os-panel">
      <header className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Knowledge OS · {PI_AGENT.name} ({PI_AGENT.title})</div>
          <h1 className="text-2xl font-semibold mt-1">Knowledge OS</h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-2xl">Four-brain memory architecture owned by {PI_AGENT.name}. NotebookLM is Brain Layer 4. Every provider output is indexed into the Universal Asset Library and mapped across the layers. Distinct from <code>oh-my-pi</code>.</p>
        </div>
        <span className="text-[10px] uppercase tracking-wider font-semibold rounded-full border px-2 py-0.5" data-testid="memory-health"
          style={{ color: health.status === 'healthy' ? '#34d399' : health.status === 'degraded' ? '#fbbf24' : '#f87171', borderColor: 'var(--border)' }}>
          Memory {health.status} · {health.score}
        </span>
      </header>

      {/* Four brain layers */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" data-testid="brain-layers">
        {BRAIN_LAYERS.map((b) => {
          const st = layerStates[b.id]
          return (
            <div key={b.id} className="rounded-xl border border-border bg-card p-4" data-testid={`brain-layer-${b.id}`}>
              <div className="flex items-center justify-between">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Brain Layer {b.layer}</div>
                <span className="text-[10px] font-semibold" style={{ color: STATE_FG[st] }}>{SYNC_STATE_LABEL[st]}</span>
              </div>
              <div className="text-base font-semibold mt-1">{b.label}</div>
              <p className="text-[11px] text-muted-foreground mt-1">{b.role}</p>
            </div>
          )
        })}
      </section>

      {/* Analytics */}
      <section className="grid grid-cols-2 sm:grid-cols-4 gap-3" data-testid="knowledge-analytics">
        {[
          ['Documents', m.totalDocuments], ['Vectors', m.totalVectors], ['Notebooks', m.totalNotebooks],
          ['Notion pages', m.totalNotionPages], ['Obsidian notes', m.totalObsidianNotes], ['Duplicates de-duped', m.duplicatesDetected],
          ['Failed imports', m.failedImports], ['Queue depth', m.queueDepth],
        ].map(([label, val]) => (
          <div key={label as string} className="rounded-lg border border-border bg-card p-3">
            <div className="text-2xl font-bold">{val as number}</div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-0.5">{label as string}</div>
          </div>
        ))}
      </section>
      <p className="text-[11px] text-muted-foreground/70">Counts are zero until a source is connected and the migration runs — honest empty state, not fabricated totals.</p>

      {/* Import centers */}
      <section data-testid="import-centers">
        <h2 className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-3">Knowledge Migration — Import Centers</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {IMPORT_SOURCES.map((s) => (
            <div key={s.id} className="rounded-xl border border-border bg-card p-4" data-testid={`import-${s.id}`}>
              <div className="text-sm font-semibold">{s.label}</div>
              <p className="text-[11px] text-muted-foreground mt-1">{s.description}</p>
              <div className="text-[10px] text-muted-foreground/70 mt-2">Modes: {s.modes.join(', ')}</div>
              <div className="text-[10px] text-muted-foreground/70">Mirrors → {s.mirrorsTo.join(', ')}</div>
              {s.id === 'notebooklm'
                ? <Link href="/app/notebooklm" className="text-[11px] text-primary hover:underline mt-2 inline-block">Open NotebookLM Import →</Link>
                : <Link href="/app/credentials" className="text-[11px] text-primary hover:underline mt-2 inline-block">Connect →</Link>}
            </div>
          ))}
        </div>
      </section>

      {/* Shared agent memory */}
      <section data-testid="shared-agent-memory">
        <h2 className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-3">Shared agent memory (by scope)</h2>
        <div className="rounded-xl border border-border bg-card p-4 grid gap-1.5 sm:grid-cols-2">
          {MEMORY_AGENTS.map((a) => (
            <div key={a.id} className="flex items-center justify-between text-[12px]">
              <span>{a.label}</span>
              <span className="text-muted-foreground">{a.scopes.join(' · ')}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
