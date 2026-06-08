'use client'

/**
 * AI Org Chart — unify and categorize every AI agent/persona in one place with
 * a fully customizable hierarchy. Create / edit / update / archive / delete
 * (with confirmation) / reorder; assign department, manager, skills, memory
 * access, runtime, permissions, and category.
 */
import { useCallback, useEffect, useState } from 'react'
import type { OrgAgent } from '@/lib/org-chart/types'
import { ORG_DEPARTMENTS } from '@/lib/org-chart/types'

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

      {/* Roster */}
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : agents.length === 0 ? (
        <p className="text-sm text-muted-foreground" data-testid="org-empty">No agents yet. Create one above to start your org chart.</p>
      ) : (
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
    </div>
  )
}
