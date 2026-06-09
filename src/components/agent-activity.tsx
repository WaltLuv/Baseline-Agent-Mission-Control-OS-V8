'use client'

/**
 * <AgentActivity /> — Mission Control parity of the Baseline OS agent activity
 * visualizer. Workspace-scoped: shows what a workspace agent is doing across
 * nine panels. Customer-safe — no Walt-private data, no personal assistant.
 *
 * TRUTH-FIRST: renders honest idle/setup-needed by default and only shows
 * activity from real workspace events passed in (no live workspace activity
 * feed exists yet, so it never fabricates tasks, tools, files, or numbers).
 * Customer-safe: no Walt-private identities or personal-assistant data.
 */
import { useEffect, useMemo, useState } from 'react'

export type MissionStatus =
  | 'idle' | 'queued' | 'planning' | 'researching' | 'executing'
  | 'waiting' | 'approval_required' | 'completed' | 'failed'

export const MISSION_STATES: MissionStatus[] = [
  'idle', 'queued', 'planning', 'researching', 'executing',
  'waiting', 'approval_required', 'completed', 'failed',
]

const STATUS_LABEL: Record<MissionStatus, { label: string; cls: string }> = {
  idle: { label: 'Idle', cls: 'text-muted-foreground' },
  queued: { label: 'Queued', cls: 'text-violet-400' },
  planning: { label: 'Planning', cls: 'text-sky-400' },
  researching: { label: 'Researching', cls: 'text-cyan-400' },
  executing: { label: 'Executing', cls: 'text-amber-400' },
  waiting: { label: 'Waiting', cls: 'text-yellow-400' },
  approval_required: { label: 'Approval required', cls: 'text-red-400' },
  completed: { label: 'Completed', cls: 'text-emerald-400' },
  failed: { label: 'Failed', cls: 'text-red-400' },
}

const TIMELINE = ['Research', 'Analysis', 'Planning', 'Tool Execution', 'Output', 'Approval', 'Delivery']

export interface ActivityEvent {
  tool: string; verb?: string; ok?: boolean | null; approved?: boolean | null
  refused?: string | null; proof?: string | null; durationMs?: number | null; startedAt?: string | null
  files?: string[]
}

function Panel({ title, children, testid }: { title: string; children: React.ReactNode; testid: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3" data-testid={testid}>
      <div className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">{title}</div>
      {children}
    </div>
  )
}

export function AgentActivity({
  agentId,
  runtime,
  provider,
  status = 'idle',
  events = [],
}: {
  agentId: string
  runtime?: string
  provider?: string
  status?: MissionStatus
  events?: ActivityEvent[]
}) {
  const ss = STATUS_LABEL[status]
  // Structural awareness — the Graphify brain the agent consults before scanning.
  const [graph, setGraph] = useState<{ nodes: number; edges: number; godNodes: { id: string }[] } | null>(null)
  useEffect(() => {
    let cancel = false
    fetch('/api/graphify')
      .then((r) => r.json())
      .then((j: { health?: { nodes: number; edges: number; godNodes: { id: string }[] } }) => { if (!cancel && j.health) setGraph(j.health) })
      .catch(() => {})
    return () => { cancel = true }
  }, [])
  const files = useMemo(() => events.flatMap((e) => e.files ?? []).slice(0, 8), [events])
  const skills = useMemo(() => Array.from(new Set(events.filter((e) => /skill|generate|import|swarm|vision|voice/i.test(e.tool + (e.verb ?? ''))).map((e) => e.tool))).slice(0, 6), [events])
  const memoryHits = useMemo(() => Array.from(new Set(events.filter((e) => /pinecone|notion|notebook|obsidian|graphify|memory/i.test(e.tool)).map((e) => e.tool))), [events])
  const approvals = events.filter((e) => e.approved != null || e.refused)
  const proofs = events.filter((e) => e.proof || e.ok != null)

  return (
    <div className="grid gap-2 lg:grid-cols-2" data-testid="agent-activity" data-agent={agentId}>
      <Panel title="Current mission" testid="aa-mission">
        <span className={`text-sm font-semibold ${ss.cls}`} data-testid="aa-status">{ss.label}</span>
        <p className="mt-1 text-[11px] text-muted-foreground">
          {status === 'idle' ? 'No active mission. Dispatch a task or run a workflow — live activity appears here.' : `Agent is ${ss.label.toLowerCase()}.`}
        </p>
      </Panel>

      <Panel title="Live metrics" testid="aa-metrics">
        <div className="grid grid-cols-2 gap-1 text-[11px] text-foreground/80">
          <div>Runtime: {runtime ?? '—'}</div>
          <div>Provider: {provider ?? '—'}</div>
          <div>Events: {events.length}</div>
          <div>Last run: {events[0]?.durationMs != null ? `${events[0].durationMs}ms` : '—'}</div>
          <div className="col-span-2 text-muted-foreground/60">Tokens / cost: shown only when the runtime reports them (never estimated).</div>
        </div>
      </Panel>

      <Panel title="Agent timeline" testid="aa-timeline">
        <div className="flex flex-wrap items-center gap-1">
          {TIMELINE.map((t) => (
            <span key={t} className="rounded-full bg-muted px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">{t}</span>
          ))}
        </div>
      </Panel>

      <Panel title="Tool activity" testid="aa-tools">
        {events.length === 0 ? <p className="text-[11px] text-muted-foreground/60">No tool calls yet.</p> : (
          <ul className="space-y-0.5 text-[11px] text-foreground/80">{events.slice(0, 6).map((e, i) => <li key={i}>{e.tool} {e.verb}</li>)}</ul>
        )}
      </Panel>

      <Panel title="Files touched" testid="aa-files">
        {files.length === 0 ? <p className="text-[11px] text-muted-foreground/60">No files touched yet.</p> : (
          <ul className="space-y-0.5 text-[11px] font-mono text-foreground/80">{files.map((f, i) => <li key={i} className="truncate">{f}</li>)}</ul>
        )}
      </Panel>

      <Panel title="Skill usage" testid="aa-skills">
        {skills.length === 0 ? <p className="text-[11px] text-muted-foreground/60">No skills invoked yet.</p> : (
          <div className="flex flex-wrap gap-1">{skills.map((s, i) => <span key={i} className="rounded bg-muted px-1.5 py-0.5 text-[10px]">{s}</span>)}</div>
        )}
      </Panel>

      <Panel title="Memory activity" testid="aa-memory">
        {memoryHits.length === 0 ? <p className="text-[11px] text-muted-foreground/60">No memory-layer queries yet (Graphify · Pinecone · Notion · NotebookLM · Obsidian).</p> : (
          <div className="flex flex-wrap gap-1">{memoryHits.map((m, i) => <span key={i} className="rounded bg-muted px-1.5 py-0.5 text-[10px]">{m}</span>)}</div>
        )}
      </Panel>

      <Panel title="Proof events" testid="aa-proof">
        {proofs.length === 0 ? <p className="text-[11px] text-muted-foreground/60">No proof events yet.</p> : (
          <ul className="space-y-0.5 text-[11px] text-foreground/80">{proofs.slice(0, 5).map((e, i) => <li key={i}>{e.proof ?? `${e.tool} ${e.ok === false ? 'failed' : 'ok'}`}</li>)}</ul>
        )}
      </Panel>

      <Panel title="Structural awareness (Graphify)" testid="aa-structural">
        {!graph ? (
          <p className="text-[11px] text-muted-foreground/60">Graphify brain not generated yet — agents fall back to repo scan.</p>
        ) : (
          <div className="text-[11px] text-foreground/80">
            <div>Graph brain connected · {graph.nodes} nodes / {graph.edges} edges</div>
            <div className="mt-0.5 text-muted-foreground">Queries the graph to locate exact files before coding (graph-first). Core modules:</div>
            <div className="mt-1 flex flex-wrap gap-1">
              {graph.godNodes.slice(0, 4).map((g) => <span key={g.id} className="rounded bg-muted px-1.5 py-0.5 text-[9px]">{g.id.split('/').pop()}</span>)}
            </div>
          </div>
        )}
      </Panel>

      <Panel title="Approval gates" testid="aa-approvals">
        {approvals.length === 0 ? <p className="text-[11px] text-muted-foreground/60">No approval decisions yet.</p> : (
          <ul className="space-y-0.5 text-[11px] text-foreground/80">{approvals.slice(0, 5).map((e, i) => <li key={i}>{e.refused ? `rejected — ${e.refused}` : 'auto-approved'}</li>)}</ul>
        )}
      </Panel>
    </div>
  )
}

export default AgentActivity
