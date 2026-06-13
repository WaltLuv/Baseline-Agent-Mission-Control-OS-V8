'use client'

import { useEffect, useState } from 'react'

/**
 * Agent readiness badges + detail panel — backed by computeAgentReadiness /
 * the workspace capability matrix (GET /api/agents/readiness). No hardcoded
 * fake states: a Level-3 agent without its runtime shows Needs Runtime.
 */
export const READINESS_META: Record<string, { label: string; color: string }> = {
  ready: { label: 'Ready', color: '#34d399' },
  native_workflow_ready: { label: 'Native Workflow Ready', color: '#34d399' },
  runtime_connected: { label: 'Runtime Connected', color: '#34d399' },
  api_connected: { label: 'API Connected', color: '#34d399' },
  browser_automation_ready: { label: 'Browser Automation Ready', color: '#22d3ee' },
  demo_only: { label: 'Demo Only', color: '#a78bfa' },
  needs_runtime: { label: 'Needs Runtime', color: '#fbbf24' },
  needs_credentials: { label: 'Needs Credentials', color: '#fbbf24' },
  needs_approval: { label: 'Needs Approval', color: '#fbbf24' },
  visible_only: { label: 'Visible Only', color: '#9ca3af' },
  offline: { label: 'Offline', color: '#6b7280' },
}

interface Readiness {
  level: number
  runtime: string
  runtimeStatus: string
  isContextHarness: boolean
  status: string
  tools: string[]
  permissions: string[]
  approvalRules: string[]
  blockers: string[]
  setupNeeded: string[]
}
interface RosterEntry { name: string; role: string; readiness: Readiness }

// Module-level cache so many badges share one fetch.
let cache: { byName: Map<string, RosterEntry>; loaded: boolean } | null = null
const subscribers = new Set<() => void>()

function useReadinessRoster() {
  const [, force] = useState(0)
  useEffect(() => {
    const rerender = () => force((n) => n + 1)
    subscribers.add(rerender)
    if (!cache) {
      cache = { byName: new Map(), loaded: false }
      fetch('/api/agents/readiness')
        .then((r) => (r.ok ? r.json() : { roster: [], reference: [] }))
        .then((j) => {
          const map = new Map<string, RosterEntry>()
          for (const e of [...(j.roster ?? []), ...(j.reference ?? [])] as RosterEntry[]) {
            if (e.name) map.set(e.name.toLowerCase(), e)
          }
          cache = { byName: map, loaded: true }
          subscribers.forEach((s) => s())
        })
        .catch(() => { cache = { byName: new Map(), loaded: true }; subscribers.forEach((s) => s()) })
    }
    return () => { subscribers.delete(rerender) }
  }, [])
  return cache ?? { byName: new Map(), loaded: false }
}

function lookup(roster: { byName: Map<string, RosterEntry> }, name?: string, role?: string): Readiness | null {
  if (name && roster.byName.has(name.toLowerCase())) return roster.byName.get(name.toLowerCase())!.readiness
  if (role) {
    for (const e of roster.byName.values()) if (e.role && e.role.toLowerCase() === role.toLowerCase()) return e.readiness
  }
  return null
}

export function AgentReadinessBadge({ name, role }: { name?: string; role?: string }) {
  const roster = useReadinessRoster()
  if (!roster.loaded) return <span data-testid="readiness-badge" className="text-[10px] text-muted-foreground">checking…</span>
  const r = lookup(roster, name, role)
  if (!r) return null
  const label = r.isContextHarness ? 'Context Harness' : (READINESS_META[r.status]?.label ?? r.status)
  const color = r.isContextHarness ? '#22d3ee' : (READINESS_META[r.status]?.color ?? '#6b7280')
  return (
    <span data-testid="readiness-badge" title={r.blockers.join('; ') || label}
      className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium"
      style={{ borderColor: `${color}66`, color }}>
      <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: color }} /> L{r.level} · {label}
    </span>
  )
}

export function AgentReadinessPanel({ name, role }: { name?: string; role?: string }) {
  const roster = useReadinessRoster()
  const r = lookup(roster, name, role)
  if (!roster.loaded) return <div data-testid="agent-readiness-panel" className="text-xs text-muted-foreground">Loading readiness…</div>
  if (!r) return <div data-testid="agent-readiness-panel" className="text-xs text-muted-foreground">No readiness profile.</div>
  const meta = r.isContextHarness ? { label: 'Context Harness', color: '#22d3ee' } : (READINESS_META[r.status] ?? { label: r.status, color: '#6b7280' })
  const Row = ({ k, v }: { k: string; v: string }) => (
    <div className="grid grid-cols-[120px_1fr] gap-2 text-[12px]"><span className="text-muted-foreground">{k}</span><span>{v}</span></div>
  )
  return (
    <div data-testid="agent-readiness-panel" className="space-y-1.5 rounded-lg border border-border bg-card/40 p-3">
      <div className="mb-1 flex items-center gap-2">
        <span className="text-sm font-semibold">Execution readiness</span>
        <AgentReadinessBadge name={name} role={role} />
      </div>
      <Row k="Execution level" v={`Level ${r.level}${r.isContextHarness ? ' (context harness — not the worker)' : ''}`} />
      <Row k="Assigned runtime" v={r.runtime} />
      <Row k="Runtime status" v={r.runtimeStatus} />
      <Row k="PI context" v="Enabled (PI Agent harness)" />
      <Row k="Tools" v={r.tools.join(', ') || '—'} />
      <Row k="Permissions" v={r.permissions.join(', ') || '—'} />
      <Row k="Approval rules" v={r.approvalRules.join('; ') || 'none'} />
      <Row k="Status" v={meta.label} />
      {r.setupNeeded.length > 0 && (
        <div className="mt-1 rounded border border-amber-500/30 bg-amber-500/[0.06] px-2 py-1 text-[11px] text-amber-200" data-testid="readiness-setup-needed">
          Setup needed: {r.setupNeeded.join(' · ')}
        </div>
      )}
    </div>
  )
}
