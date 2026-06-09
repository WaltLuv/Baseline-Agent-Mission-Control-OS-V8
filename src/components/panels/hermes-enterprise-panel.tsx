'use client'

/**
 * Hermes MCP Enterprise (Mission Control) — the operational backbone. Visible
 * enterprise operator (not a chatbot): tool/skill/provider/runtime registries,
 * MCP status, execution + approval logs, embedded Agent Activity (Graphify /
 * Replay / Proof). Workspace-scoped. Parity with Baseline OS.
 *
 * Honest: tools/providers stay setup_needed until a real connection (external
 * credential / paired runtime) is confirmed — never faked.
 */
import { useEffect, useState } from 'react'
import { AgentActivity } from '@/components/agent-activity'
import { buildOperatorView, defaultRegistries, type OperatorView, type HermesRuntime } from '@/lib/hermes-enterprise'

function Reg({ title, items, testid }: { title: string; items: { name: string; state: string; meta?: string }[]; testid: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3" data-testid={testid}>
      <div className="mb-2 text-[10px] uppercase tracking-widest text-muted-foreground">{title}</div>
      <ul className="space-y-1 text-[11px]">
        {items.length === 0 ? <li className="text-muted-foreground/50">none</li> : items.map((it) => (
          <li key={it.name} className="flex items-center justify-between">
            <span className="text-foreground/80">{it.name}{it.meta ? <span className="text-muted-foreground/50"> · {it.meta}</span> : null}</span>
            <span className={`rounded px-1.5 py-0.5 text-[9px] uppercase ${it.state === 'connected' || it.state === 'healthy' ? 'bg-emerald-500/20 text-emerald-400' : it.state === 'available' ? 'bg-sky-500/20 text-sky-400' : 'bg-amber-500/20 text-amber-400'}`}>{it.state}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function HermesEnterprisePanel() {
  const [view, setView] = useState<OperatorView>(() => buildOperatorView({ ...defaultRegistries(), graphFirst: true }))
  const [online, setOnline] = useState(false)

  useEffect(() => {
    let cancel = false
    // Live runtime probe — connected only when a runtime heartbeat is present.
    fetch('/api/agent-runtimes', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j: { runtimes?: { id: string; name?: string; connected?: boolean; health?: string }[] }) => {
        if (cancel) return
        const live = j.runtimes ?? []
        const up = live.some((r) => r.connected)
        setOnline(up)
        const runtimes: HermesRuntime[] = live.length
          ? live.map((r) => ({ id: r.id, name: r.name ?? r.id, state: r.connected ? 'connected' : 'setup_needed', health: r.connected ? 'healthy' : 'unknown', permissions: ['fs', 'net'], cost: 'metered' }))
          : [{ id: 'hermes', name: 'Hermes', state: 'setup_needed', health: 'unknown', permissions: ['fs', 'net'] }]
        setView(buildOperatorView({ ...defaultRegistries(), mcpOnline: up, servers: [{ name: 'hermes-runtime', state: up ? 'connected' : 'setup_needed' }], runtimes, graphFirst: true }))
      })
      .catch(() => setOnline(false))
    return () => { cancel = true }
  }, [])

  return (
    <div className="m-4" data-testid="hermes-enterprise-panel">
      <div className="mb-3">
        <h1 className="text-base font-semibold">Hermes · MCP Enterprise Operator</h1>
        <p className="text-xs text-muted-foreground">
          Operational backbone — MCP {online ? 'online' : 'pairing'} · {view.counts.connectedTools}/{view.counts.tools} tools · {view.counts.healthyRuntimes}/{view.counts.runtimes} runtimes healthy · {view.counts.pendingApprovals} pending approvals · graph-first {view.graphFirst ? '✓' : '✗'}. Workspace-scoped.
        </p>
      </div>
      <div className="grid gap-3 lg:grid-cols-3">
        <Reg title="MCP · Servers" testid="hermes-mcp-status" items={view.mcp.servers.map((s) => ({ name: s.name, state: s.state }))} />
        <Reg title="Tool Registry" testid="hermes-tools" items={view.tools.map((t) => ({ name: t.name, state: t.state, meta: t.via }))} />
        <Reg title="Skill Registry" testid="hermes-skills" items={view.skills.map((s) => ({ name: s.name, state: s.state, meta: s.category }))} />
        <Reg title="Provider Registry" testid="hermes-providers" items={view.providers.map((p) => ({ name: p.name, state: p.state, meta: p.kind }))} />
        <Reg title="Runtime Registry" testid="hermes-runtimes" items={view.runtimes.map((r) => ({ name: r.name, state: r.health, meta: `${r.permissions.length} perms · ${r.cost ?? '—'}` }))} />
        <div className="rounded-xl border border-border bg-card p-3" data-testid="hermes-approvals">
          <div className="mb-2 text-[10px] uppercase tracking-widest text-muted-foreground">Approval log</div>
          {view.approvals.length === 0 ? <p className="text-[11px] text-muted-foreground/50">No approvals yet. Gated actions appear here for approve/deny.</p> : (
            <ul className="space-y-1 text-[11px]">{view.approvals.map((a, i) => <li key={i} className="text-foreground/75">{a.action} · {a.decision}</li>)}</ul>
          )}
        </div>
        <div className="rounded-xl border border-border bg-card p-3 lg:col-span-2" data-testid="hermes-execlog">
          <div className="mb-2 text-[10px] uppercase tracking-widest text-muted-foreground">Execution log</div>
          {view.executions.length === 0 ? <p className="text-[11px] text-muted-foreground/50">No executions yet. Graph-first dispatches (POST /api/hermes/tasks) log here and emit replay events.</p> : (
            <ul className="space-y-1 text-[11px]">{view.executions.map((e, i) => <li key={i} className="text-foreground/75">{e.tool} · {e.status} {e.detail}</li>)}</ul>
          )}
        </div>
        <div className="lg:col-span-3">
          <AgentActivity agentId="hermes" runtime="Hermes" provider="MCP" />
        </div>
      </div>
    </div>
  )
}

export default HermesEnterprisePanel
