'use client'

/**
 * Graphify (Mission Control) — the Structural Brain Layer. Parity with Baseline
 * OS: dashboard · query · explorer · dependency viewer · repo import. Reads the
 * shared codebase knowledge graph via /api/graphify (auth-gated). Not a JSON
 * dump — interactive + searchable.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { queryGraph, getDependencies, godNodes, type KnowledgeGraph, type GraphNode } from '@/lib/graphify/graph'

export function GraphifyPanel() {
  const [graph, setGraph] = useState<KnowledgeGraph | null>(null)
  const [health, setHealth] = useState<{ nodes: number; edges: number; generatedAt: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [building, setBuilding] = useState(false)
  const [q, setQ] = useState('')
  const [results, setResults] = useState<GraphNode[]>([])
  const [selected, setSelected] = useState<GraphNode | null>(null)
  const [kindFilter, setKindFilter] = useState('all')

  const load = useCallback(async (refresh = false) => {
    setLoading(true)
    try {
      const r = await fetch(`/api/graphify${refresh ? '?refresh=1' : ''}`, { cache: 'no-store' })
      const j = await r.json()
      setGraph(j.graph ?? null); setHealth(j.health ?? null)
    } catch { setGraph(null) }
    setLoading(false)
  }, [])
  useEffect(() => { void load() }, [load])

  const runQuery = useCallback(() => { if (graph && q.trim()) setResults(queryGraph(graph, q)) }, [graph, q])
  const kinds = useMemo(() => (graph ? ['all', ...Array.from(new Set(graph.nodes.map((n) => n.kind)))] : []), [graph])
  const explorer = useMemo(() => (graph ? graph.nodes.filter((n) => kindFilter === 'all' || n.kind === kindFilter).slice(0, 200) : []), [graph, kindFilter])
  const deps = useMemo(() => (graph && selected ? getDependencies(graph, selected.id) : null), [graph, selected])
  const gods = useMemo(() => (graph ? godNodes(graph, 8) : []), [graph])

  return (
    <div className="m-4 space-y-4" data-testid="graphify-panel">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold">Graphify · Structural Brain</h1>
          <p className="text-xs text-muted-foreground">Brain layer #5 — the codebase knowledge graph agents query before scanning the repo. Workspace-safe (shared architecture map, no customer data).</p>
        </div>
        <button onClick={() => { setBuilding(true); void load(true).finally(() => setBuilding(false)) }} disabled={building}
          className="rounded-md border border-border px-3 py-2 text-sm hover:bg-secondary" data-testid="graphify-refresh">
          {building ? 'Rebuilding…' : 'Regenerate graph'}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" data-testid="graphify-dashboard">
        {[
          { label: 'Nodes', value: health?.nodes ?? '—' },
          { label: 'Edges', value: health?.edges ?? '—' },
          { label: 'God nodes', value: gods.length },
          { label: 'Last generated', value: health?.generatedAt ? new Date(health.generatedAt).toLocaleTimeString() : '—' },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-3">
            <div className="text-2xl font-bold text-primary">{s.value}</div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </div>

      {loading ? <p className="text-sm text-muted-foreground">Building graph…</p> : (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-card p-3" data-testid="graphify-query">
              <div className="mb-2 text-[11px] uppercase tracking-widest text-muted-foreground">Query graph</div>
              <div className="flex gap-2">
                <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && runQuery()} placeholder="where is billing? routes for org chart?" className="flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-xs" />
                <button onClick={runQuery} className="rounded-md bg-primary px-3 text-xs font-semibold text-primary-foreground">Ask</button>
              </div>
              <ul className="mt-2 space-y-0.5 text-[11px]">
                {results.map((n) => <li key={n.id}><button onClick={() => setSelected(n)} className="text-left text-primary hover:underline">{n.path}</button> <span className="text-muted-foreground/60">· {n.kind}</span></li>)}
                {q && results.length === 0 && <li className="text-muted-foreground/60">No matches.</li>}
              </ul>
            </div>
            <div className="rounded-xl border border-border bg-card p-3" data-testid="graphify-import">
              <div className="mb-2 text-[11px] uppercase tracking-widest text-muted-foreground">Repo import</div>
              <input placeholder="https://github.com/owner/repo" className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs" data-testid="graphify-import-url" />
              <p className="mt-1 text-[10px] text-muted-foreground/70">Maps this app now (Regenerate ↑). Per-workspace remote import clones to a sandboxed temp dir, https-only, secrets excluded — enabled when the clone runner is configured.</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-3" data-testid="graphify-godnodes">
              <div className="mb-2 text-[11px] uppercase tracking-widest text-muted-foreground">Core modules (god nodes)</div>
              <ul className="space-y-0.5 text-[11px]">
                {gods.map((g) => <li key={g.node.id} className="flex justify-between"><span className="truncate text-foreground/80">{g.node.path}</span><span className="text-muted-foreground">{g.inDegree}↘</span></li>)}
                {gods.length === 0 && <li className="text-muted-foreground/60">No dependencies mapped yet.</li>}
              </ul>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-3" data-testid="graphify-explorer">
            <div className="mb-2 text-[11px] uppercase tracking-widest text-muted-foreground">Explorer</div>
            <div className="mb-2 flex flex-wrap gap-1">
              {kinds.map((k) => <button key={k} onClick={() => setKindFilter(k)} className={`rounded px-1.5 py-0.5 text-[10px] ${kindFilter === k ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>{k}</button>)}
            </div>
            <ul className="max-h-[60vh] space-y-0.5 overflow-y-auto text-[11px]">
              {explorer.map((n) => <li key={n.id}><button onClick={() => setSelected(n)} className={`w-full truncate text-left hover:text-primary ${selected?.id === n.id ? 'text-primary' : 'text-foreground/75'}`}>{n.path}</button></li>)}
            </ul>
          </div>

          <div className="rounded-xl border border-border bg-card p-3" data-testid="graphify-deps">
            <div className="mb-2 text-[11px] uppercase tracking-widest text-muted-foreground">Dependencies</div>
            {!selected ? <p className="text-[11px] text-muted-foreground/60">Select a node to see what it imports + what depends on it.</p> : (
              <div className="space-y-3 text-[11px]">
                <div className="font-semibold text-primary">{selected.path}</div>
                <div><div className="text-muted-foreground">Imports ({deps?.imports.length ?? 0})</div><ul className="mt-0.5 space-y-0.5">{(deps?.imports ?? []).slice(0, 20).map((d) => <li key={d} className="truncate text-foreground/65">→ {d}</li>)}</ul></div>
                <div><div className="text-muted-foreground">Imported by ({deps?.importedBy.length ?? 0})</div><ul className="mt-0.5 space-y-0.5">{(deps?.importedBy ?? []).slice(0, 20).map((d) => <li key={d} className="truncate text-foreground/65">← {d}</li>)}</ul></div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default GraphifyPanel
