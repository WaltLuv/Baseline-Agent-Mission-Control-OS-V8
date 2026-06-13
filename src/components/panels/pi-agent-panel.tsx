'use client'

import { useEffect, useState } from 'react'

/**
 * PI Agent page — surfaces the context-harness backend. PI Agent is the
 * context/memory/routing layer, NOT the sole runtime. Honest states: the
 * harness is built-in (ready), but the PI CLI/SDK runtime is setup-needed
 * until connected. Shows the workspace capability matrix, recent context
 * packages, routing + memory events, and proof/replay indexes.
 */
interface PkgRow { id: string; request: string; routedAgent: string | null; policy_decision: string; status: string; replayId: string | null; proofRef: string | null; created_at: number }
interface PkgDetail { routing: { chosen: string; candidates: string[]; reason: string | null } | null; memoryEvents: Array<{ kind: string; summary: string; ref: string | null }>; graph: { available: boolean; nodes: string[] }; memory: { hits: unknown[] }; workspaceKnowledge: Record<string, number> }
interface Capability { id: string; label: string; group: string; status: string; blocker: string | null; fixAction: string | null; link: string | null }

const READY = new Set(['ready', 'connected', 'workflow_ready', 'api_connected', 'browser_automation_ready'])
function dot(status: string) {
  if (READY.has(status)) return '#34d399'
  if (['needs_credentials', 'needs_runtime', 'setup_needed', 'visible_only'].includes(status)) return '#fbbf24'
  return '#6b7280'
}

export function PiAgentPanel() {
  const [packages, setPackages] = useState<PkgRow[]>([])
  const [caps, setCaps] = useState<Capability[]>([])
  const [detail, setDetail] = useState<(PkgDetail & { id: string }) | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let off = false
    Promise.all([
      fetch('/api/pi/packages').then((r) => (r.ok ? r.json() : { packages: [] })).catch(() => ({ packages: [] })),
      fetch('/api/workspace/capabilities').then((r) => (r.ok ? r.json() : { capabilities: [] })).catch(() => ({ capabilities: [] })),
    ]).then(([p, c]) => {
      if (off) return
      setPackages(p.packages ?? [])
      setCaps(c.capabilities ?? [])
      setLoaded(true)
    })
    return () => { off = true }
  }, [])

  function openPackage(id: string) {
    fetch(`/api/pi/packages?id=${encodeURIComponent(id)}`).then((r) => (r.ok ? r.json() : null)).then((j) => j?.package && setDetail({ id, ...j.package })).catch(() => {})
  }

  const harnessReady = caps.find((c) => c.id === 'pi_agent_harness')?.status === 'ready'

  return (
    <div className="p-4 space-y-4" data-testid="pi-agent-panel">
      <header className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
        <h1 className="text-lg font-bold">PI Agent</h1>
        <p className="mt-1 text-sm text-white/60">
          The context/memory <strong>harness</strong> for Mission Control — it retrieves context, enforces policy,
          routes to specialized agents, indexes proof/replay, and writes post-task memory. It does <strong>not</strong> replace
          Hermes, Claude Code, Codex, or OpenClaw — it wraps them.
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-[12px]">
          <span data-testid="pi-harness-status" className="rounded-full border border-white/15 px-2.5 py-1">
            <span className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle" style={{ background: harnessReady ? '#34d399' : '#6b7280' }} />
            Harness: {harnessReady ? 'Ready' : 'Loading…'}
          </span>
          <span data-testid="pi-cli-status" className="rounded-full border border-amber-500/30 bg-amber-500/[0.06] px-2.5 py-1 text-amber-100">
            <span className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle" style={{ background: '#fbbf24' }} />
            PI CLI/SDK runtime: Setup needed — connect PI Agent runtime
          </span>
        </div>
      </header>

      {/* Workspace Capability Matrix */}
      <section className="rounded-xl border border-white/10 bg-white/[0.02] p-4" data-testid="capability-matrix">
        <h2 className="mb-2 text-sm font-semibold">Workspace Capability Matrix</h2>
        <p className="mb-3 text-[11px] text-white/40">Source of truth for what can/cannot execute — and what fixes it.</p>
        <div className="grid gap-1.5 sm:grid-cols-2">
          {caps.map((c) => (
            <div key={c.id} data-testid={`cap-${c.id}`} className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-black/20 px-3 py-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-[13px]">
                  <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: dot(c.status) }} />
                  <span className="truncate">{c.label}</span>
                </div>
                {c.blocker && <div className="truncate text-[10px] text-white/40">{c.blocker}{c.fixAction ? ` · ${c.fixAction}` : ''}</div>}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-[10px] uppercase tracking-wide text-white/50">{c.status.replace(/_/g, ' ')}</span>
                {c.link && !READY.has(c.status) && <a href={c.link} className="text-[10px] text-violet-300 hover:underline">fix →</a>}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Context packages + routing + memory */}
      <section className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
        <h2 className="mb-2 text-sm font-semibold">Recent context packages</h2>
        {!loaded ? (
          <p className="text-[12px] text-white/40">Loading…</p>
        ) : packages.length === 0 ? (
          <p className="text-[12px] text-white/40" data-testid="pi-no-packages">No context packages yet. Routed workflows will appear here with their proof/replay index.</p>
        ) : (
          <div className="grid gap-2 lg:grid-cols-2">
            <div className="space-y-1.5">
              {packages.map((p) => (
                <button key={p.id} onClick={() => openPackage(p.id)} data-testid={`pi-pkg-${p.id}`} className="w-full rounded-lg border border-white/[0.06] bg-black/20 px-3 py-2 text-left hover:border-white/20">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-[12px]">{p.request}</span>
                    <span className="shrink-0 text-[10px] uppercase tracking-wide" style={{ color: dot(p.status === 'completed' ? 'ready' : p.status) }}>{p.status}</span>
                  </div>
                  <div className="text-[10px] text-white/40">→ {p.routedAgent ?? '—'} {p.replayId ? `· replay ${p.replayId}` : ''} {p.proofRef ? `· proof ${p.proofRef}` : ''}</div>
                </button>
              ))}
            </div>
            <div className="rounded-lg border border-white/[0.06] bg-black/20 p-3" data-testid="pi-pkg-detail">
              {detail ? (
                <div className="space-y-2 text-[12px]">
                  <div><span className="text-white/40">Routed to:</span> {detail.routing?.chosen} <span className="text-white/40">({detail.routing?.reason})</span></div>
                  <div><span className="text-white/40">Context:</span> graph {detail.graph?.available ? `${detail.graph.nodes.length} nodes` : 'n/a'} · memory {detail.memory?.hits?.length ?? 0} hits · agents {detail.workspaceKnowledge?.agents ?? 0}</div>
                  <div>
                    <span className="text-white/40">Memory events:</span>
                    <ul className="mt-1 space-y-0.5">
                      {detail.memoryEvents?.map((e, i) => (<li key={i} className="text-white/70">· <strong>{e.kind}</strong> — {e.summary}</li>))}
                    </ul>
                  </div>
                </div>
              ) : (
                <p className="text-[11px] text-white/40">Select a package to see its routing, injected context, and memory events.</p>
              )}
            </div>
          </div>
        )}
      </section>

      <p className="text-[11px] text-white/40">
        Command input is hidden until a PI CLI/SDK runtime is connected — Mission Control never fakes a runtime connection.
      </p>
    </div>
  )
}
