'use client'

/**
 * AI Org Chart — unify and categorize every AI agent/persona in one place with
 * a fully customizable hierarchy. Create / edit / update / archive / delete
 * (with confirmation) / reorder; assign department, manager, skills, memory
 * access, runtime, permissions, and category.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { OrgAgent, OrgNode } from '@/lib/org-chart/types'
import { ORG_DEPARTMENTS, buildHierarchy } from '@/lib/org-chart/types'
import { AgentActivity } from '@/components/agent-activity'

type Draft = {
  name: string; role: string; department: string; category: string
  managerId: string; runtime: string; skills: string; memoryAccess: string; permissions: string
}

const EMPTY: Draft = { name: '', role: '', department: '', category: '', managerId: '', runtime: '', skills: '', memoryAccess: '', permissions: '' }

export function OrgChartPanel() {
  const [agents, setAgents] = useState<OrgAgent[]>([])
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState<Draft>(EMPTY)
  const [editing, setEditing] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const r = await fetch('/api/org-chart', { cache: 'no-store' }).then((x) => x.json()).catch(() => null)
    setAgents(r?.agents ?? [])
    setLoading(false)
  }, [])
  useEffect(() => { load() }, [load])

  const csv = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean)

  async function save() {
    if (!draft.name.trim()) return
    const payload = {
      name: draft.name, role: draft.role, department: draft.department, category: draft.category,
      managerId: draft.managerId || null, runtime: draft.runtime,
      skills: csv(draft.skills), memoryAccess: csv(draft.memoryAccess), permissions: csv(draft.permissions),
    }
    if (editing) {
      await fetch(`/api/org-chart?id=${editing}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    } else {
      await fetch('/api/org-chart', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
    }
    setDraft(EMPTY); setEditing(null); load()
  }

  function edit(a: OrgAgent) {
    setEditing(a.id)
    setDraft({
      name: a.name, role: a.role, department: a.department, category: a.category,
      managerId: a.managerId ?? '', runtime: a.runtime,
      skills: a.skills.join(', '), memoryAccess: a.memoryAccess.join(', '), permissions: a.permissions.join(', '),
    })
  }

  async function remove(a: OrgAgent) {
    // Destructive: confirm before deleting (only Walt should be doing this).
    if (!window.confirm(`Delete "${a.name}"? This permanently removes the agent from the org chart.`)) return
    await fetch(`/api/org-chart?id=${a.id}&hard=1`, { method: 'DELETE' })
    load()
  }

  const nameOf = (id: string | null) => agents.find((a) => a.id === id)?.name ?? '—'

  const [view, setView] = useState<'tree' | 'map' | 'execution' | 'table'>('tree')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = agents.find((a) => a.id === selectedId) ?? null
  const hierarchy = useMemo(() => buildHierarchy(agents), [agents])
  const analytics = useMemo(() => ({
    total: agents.length,
    withManager: agents.filter((a) => a.managerId).length,
    leads: agents.filter((a) => !a.managerId).length,
    departments: new Set(agents.map((a) => a.department || 'Unassigned')).size,
  }), [agents])
  const VIEWS = [
    { id: 'tree' as const, label: 'Organization' },
    { id: 'map' as const, label: 'Workforce Map' },
    { id: 'execution' as const, label: 'Execution' },
    { id: 'table' as const, label: 'Table (CRUD)' },
  ]

  return (
    <div className="m-4 space-y-4" data-testid="org-chart-panel">
      <div className="rounded-lg border border-border/60 bg-card/20 p-3">
        <h1 className="text-base font-semibold">AI Org Chart</h1>
        <p className="text-xs text-muted-foreground mt-0.5 max-w-2xl">
          One place for every AI agent and persona. Define the hierarchy, assign departments, managers, skills, memory access, runtimes, and permissions.
        </p>
      </div>

      {/* Create / edit form */}
      <div className="rounded-lg border border-border bg-card p-4 grid gap-2 sm:grid-cols-3" data-testid="org-form">
        <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Name *" className="rounded-md border border-border bg-background px-3 py-2 text-sm" data-testid="org-name" />
        <input value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value })} placeholder="Role" className="rounded-md border border-border bg-background px-3 py-2 text-sm" />
        <select value={draft.department} onChange={(e) => setDraft({ ...draft, department: e.target.value })} className="rounded-md border border-border bg-background px-3 py-2 text-sm">
          <option value="">Department…</option>
          {ORG_DEPARTMENTS.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <select value={draft.managerId} onChange={(e) => setDraft({ ...draft, managerId: e.target.value })} className="rounded-md border border-border bg-background px-3 py-2 text-sm">
          <option value="">Manager…</option>
          {agents.filter((a) => a.id !== editing).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <input value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} placeholder="Category" className="rounded-md border border-border bg-background px-3 py-2 text-sm" />
        <input value={draft.runtime} onChange={(e) => setDraft({ ...draft, runtime: e.target.value })} placeholder="Runtime (e.g. claude-code)" className="rounded-md border border-border bg-background px-3 py-2 text-sm" />
        <input value={draft.skills} onChange={(e) => setDraft({ ...draft, skills: e.target.value })} placeholder="Skills (comma-separated)" className="rounded-md border border-border bg-background px-3 py-2 text-sm" />
        <input value={draft.memoryAccess} onChange={(e) => setDraft({ ...draft, memoryAccess: e.target.value })} placeholder="Memory access (scopes)" className="rounded-md border border-border bg-background px-3 py-2 text-sm" />
        <input value={draft.permissions} onChange={(e) => setDraft({ ...draft, permissions: e.target.value })} placeholder="Permissions" className="rounded-md border border-border bg-background px-3 py-2 text-sm" />
        <div className="sm:col-span-3 flex gap-2">
          <button onClick={save} data-testid="org-save" className="rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-semibold">{editing ? 'Update agent' : 'Create agent'}</button>
          {editing && <button onClick={() => { setEditing(null); setDraft(EMPTY) }} className="rounded-md border border-border px-4 py-2 text-sm">Cancel</button>}
        </div>
      </div>

      {/* Workforce analytics — real, workspace-scoped counts */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" data-testid="org-analytics">
        {[
          { label: 'Agents', value: analytics.total },
          { label: 'Leads', value: analytics.leads },
          { label: 'With manager', value: analytics.withManager },
          { label: 'Departments', value: analytics.departments },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-3">
            <div className="text-2xl font-bold text-primary">{s.value}</div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </div>

      {/* View switcher */}
      <div className="flex flex-wrap gap-1" data-testid="org-view-switcher">
        {VIEWS.map((v) => (
          <button key={v.id} onClick={() => setView(v.id)} data-testid={`org-view-${v.id}`}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold ${view === v.id ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>
            {v.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : agents.length === 0 ? (
        <p className="text-sm text-muted-foreground" data-testid="org-empty">No agents yet — this workspace starts with a blank canvas. Create one above (or install a workforce template) to build your org chart.</p>
      ) : (
        <div className="flex gap-4">
          <div className="min-w-0 flex-1">
            {view === 'table' && (
              <div className="space-y-2" data-testid="org-roster">
                {agents.map((a) => (
                  <div key={a.id} className="rounded-lg border border-border bg-card p-3 flex items-start justify-between" data-testid={`org-agent-${a.id}`}>
                    <div>
                      <div className="text-sm font-semibold">{a.name} <span className="text-xs text-muted-foreground">· {a.role || 'no role'}</span></div>
                      <div className="text-[11px] text-muted-foreground">{a.department || 'Unassigned'} · reports to {nameOf(a.managerId)} · runtime {a.runtime || '—'}</div>
                      <div className="text-[11px] text-muted-foreground/80 mt-0.5">skills: {a.skills.join(', ') || '—'} · memory: {a.memoryAccess.join(', ') || '—'} · perms: {a.permissions.join(', ') || '—'}</div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => edit(a)} className="rounded-md border border-border px-2.5 py-1 text-xs hover:bg-secondary">Edit</button>
                      <button onClick={() => remove(a)} data-testid={`org-delete-${a.id}`} className="rounded-md border border-red-500/40 text-red-400 px-2.5 py-1 text-xs hover:bg-red-500/10">Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {view === 'tree' && <OrgTree nodes={hierarchy} selectedId={selectedId} onSelect={setSelectedId} />}
            {view === 'map' && <WorkforceMap agents={agents} selectedId={selectedId} onSelect={setSelectedId} />}
            {view === 'execution' && <ExecutionView nodes={hierarchy} />}
          </div>
          {selected && (
            <AgentSidePanel agent={selected} managerName={nameOf(selected.managerId)} onClose={() => setSelectedId(null)} onEdit={edit} />
          )}
        </div>
      )}
    </div>
  )
}

// ── V2 command views (workspace-scoped; customer-safe) ───────────────
function MemoryBadges({ layers }: { layers: string[] }) {
  if (!layers.length) return null
  return (
    <span className="inline-flex flex-wrap gap-1" data-testid="org-memory-badges">
      {layers.slice(0, 5).map((m) => <span key={m} className="rounded bg-muted px-1 py-0.5 text-[9px] text-muted-foreground">{m}</span>)}
    </span>
  )
}

function OrgTree({ nodes, selectedId, onSelect }: { nodes: OrgNode[]; selectedId: string | null; onSelect: (id: string) => void }) {
  return <div className="space-y-1.5" data-testid="org-tree">{nodes.map((n) => <OrgTreeNode key={n.id} node={n} depth={0} selectedId={selectedId} onSelect={onSelect} />)}</div>
}

function OrgTreeNode({ node, depth, selectedId, onSelect }: { node: OrgNode; depth: number; selectedId: string | null; onSelect: (id: string) => void }) {
  const [open, setOpen] = useState(true)
  const active = selectedId === node.id
  return (
    <div>
      <div className="flex items-center gap-2" style={{ marginLeft: depth * 22 }}>
        {node.reports.length > 0 ? (
          <button onClick={() => setOpen((v) => !v)} className="text-muted-foreground" aria-label="toggle">{open ? '▾' : '▸'}</button>
        ) : <span className="w-3" />}
        <button onClick={() => onSelect(node.id)} data-testid={`org-tree-node-${node.id}`}
          className={`flex-1 rounded-lg border px-3 py-2 text-left ${active ? 'border-primary bg-primary/10' : 'border-border bg-card'}`}>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <span className="truncate">{node.name}</span>
            <span className="text-[11px] text-muted-foreground">{node.role || 'no role'}</span>
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
            <span>{node.department || 'Unassigned'}</span><span>· {node.runtime || '—'}</span>
            <MemoryBadges layers={node.memoryAccess} />
          </div>
        </button>
        {node.reports.length > 0 && <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] text-muted-foreground">{node.reports.length} report{node.reports.length > 1 ? 's' : ''}</span>}
      </div>
      {open && node.reports.map((r) => <OrgTreeNode key={r.id} node={r} depth={depth + 1} selectedId={selectedId} onSelect={onSelect} />)}
    </div>
  )
}

function WorkforceMap({ agents, selectedId, onSelect }: { agents: OrgAgent[]; selectedId: string | null; onSelect: (id: string) => void }) {
  const W = 760, rowH = 92
  const byDept = useMemo(() => {
    const m = new Map<string, OrgAgent[]>()
    for (const a of agents) { const d = a.department || 'Unassigned'; if (!m.has(d)) m.set(d, []); m.get(d)!.push(a) }
    return [...m.entries()]
  }, [agents])
  const pos = new Map<string, { x: number; y: number }>()
  byDept.forEach(([, list], row) => list.forEach((a, i) => pos.set(a.id, { x: 70 + (i * (W - 120)) / Math.max(1, list.length), y: 50 + row * rowH })))
  const H = Math.max(220, byDept.length * rowH + 40)
  return (
    <div className="overflow-auto rounded-xl border border-border bg-card p-2" data-testid="org-map">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minHeight: 240 }}>
        {agents.map((a) => {
          const p = pos.get(a.id); const mp = a.managerId ? pos.get(a.managerId) : null
          if (!p || !mp) return null
          return <line key={`e-${a.id}`} x1={p.x} y1={p.y} x2={mp.x} y2={mp.y} stroke="rgba(120,120,160,0.35)" strokeWidth={1.5} />
        })}
        {byDept.map(([dept], row) => <text key={dept} x={8} y={50 + row * rowH - 22} fill="rgba(150,150,170,0.6)" fontSize={10}>{dept}</text>)}
        {agents.map((a) => {
          const p = pos.get(a.id); if (!p) return null
          const active = selectedId === a.id
          return (
            <g key={a.id} transform={`translate(${p.x},${p.y})`} style={{ cursor: 'pointer' }} onClick={() => onSelect(a.id)} data-testid={`org-map-node-${a.id}`}>
              <circle r={active ? 13 : 10} fill={active ? 'hsl(var(--primary))' : '#1e1e2a'} stroke="hsl(var(--primary))" strokeWidth={1.5} />
              <text y={28} textAnchor="middle" fill="rgba(200,200,210,0.85)" fontSize={9}>{a.name.split(' ')[0]}</text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

function ExecutionView({ nodes }: { nodes: OrgNode[] }) {
  const lead = nodes[0]
  const chain = lead ? [lead.name, ...lead.reports.slice(0, 2).map((r) => r.name)] : []
  return (
    <div className="rounded-xl border border-border bg-card p-5" data-testid="org-execution">
      <div className="mb-3 text-[11px] uppercase tracking-widest text-muted-foreground">Active execution flow</div>
      {chain.length === 0 ? (
        <p className="text-[12px] text-muted-foreground/70">No active missions. When workspace agents run, the live flow (lead → research → analysis → approval → delivery) appears here — from real activity, never faked.</p>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {[...chain, 'Approval Gate', 'Delivery'].map((step, i, arr) => (
            <div key={i} className="flex items-center gap-2">
              <div className="rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-[12px]">{step}</div>
              {i < arr.length - 1 && <span className="text-primary">↓</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function AgentSidePanel({ agent, managerName, onClose, onEdit }: { agent: OrgAgent; managerName: string; onClose: () => void; onEdit: (a: OrgAgent) => void }) {
  const rows: [string, string][] = [
    ['Role', agent.role || '—'], ['Department', agent.department || '—'], ['Manager', managerName],
    ['Runtime', agent.runtime || '—'], ['Skills', agent.skills.join(', ') || '—'],
    ['Memory access', agent.memoryAccess.join(', ') || '—'], ['Permissions', agent.permissions.join(', ') || '—'],
  ]
  return (
    <aside className="w-80 shrink-0 rounded-xl border border-border bg-card p-4" data-testid="org-agent-panel">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-sm font-bold">{agent.name}</div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">✕</button>
      </div>
      <dl className="mb-3 space-y-1 text-[11px]">
        {rows.map(([k, v]) => <div key={k} className="flex gap-2"><dt className="w-24 shrink-0 text-muted-foreground">{k}</dt><dd className="text-foreground/85">{v}</dd></div>)}
      </dl>
      <button onClick={() => onEdit(agent)} className="mb-3 w-full rounded-md border border-border py-1.5 text-[12px] hover:bg-secondary">Edit agent</button>
      <div className="mb-1 text-[10px] uppercase tracking-widest text-muted-foreground">Live activity</div>
      <AgentActivity agentId={agent.id} runtime={agent.runtime} provider={agent.runtime} />
    </aside>
  )
}
