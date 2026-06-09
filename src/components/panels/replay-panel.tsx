'use client'

/**
 * Workforce Replay (Mission Control) — watch any mission like a screen recording.
 * Reads /api/replay (workspace-scoped): missions emitted by Workforce Install,
 * Agent Factory, Gemini Flow, Creative OS, etc. Parity with Baseline OS.
 */
import { useEffect, useMemo, useState } from 'react'

interface ReplayEvent { ts: number; kind: string; agent?: string; label: string; detail?: string }
interface MissionReplay { id: string; trigger: string; mission: string; status: string; agents: string[]; events: ReplayEvent[]; startedAt: number }

const KIND_COLOR: Record<string, string> = {
  trigger: 'text-violet-400', agent_start: 'text-sky-400', tool_call: 'text-amber-400',
  skill_run: 'text-cyan-400', approval: 'text-yellow-400', file_touched: 'text-slate-400',
  output: 'text-emerald-400', proof: 'text-emerald-400', error: 'text-red-400', complete: 'text-emerald-400',
}

export function ReplayPanel() {
  const [missions, setMissions] = useState<MissionReplay[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [playhead, setPlayhead] = useState(0)

  useEffect(() => {
    fetch('/api/replay', { cache: 'no-store' }).then((r) => r.json()).then((j) => setMissions(j.replays ?? [])).catch(() => setMissions([]))
  }, [])

  const selected = useMemo(() => (selectedId ? missions.find((m) => m.id === selectedId) : missions[0]) ?? null, [selectedId, missions])
  useEffect(() => {
    if (!selected) return
    setPlayhead(0)
    const t = setInterval(() => setPlayhead((p) => (p >= selected.events.length ? p : p + 1)), 600)
    return () => clearInterval(t)
  }, [selected])

  return (
    <div className="m-4" data-testid="replay-panel">
      <div className="mb-3">
        <h1 className="text-base font-semibold">Workforce Replay</h1>
        <p className="text-xs text-muted-foreground">Watch any mission like a screen recording — trigger → planning → agents → tools → files → approvals → outputs → completion. Workspace-scoped.</p>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-3" data-testid="replay-list">
          <div className="mb-2 text-[10px] uppercase tracking-widest text-muted-foreground">Missions · {missions.length}</div>
          {missions.length === 0 ? (
            <p className="text-[11px] text-muted-foreground/60">No missions yet. Installing a workforce, building in Agent Factory, or running a Gemini Flow records a replay here.</p>
          ) : (
            <ul className="space-y-1">
              {missions.map((m) => (
                <li key={m.id}>
                  <button onClick={() => setSelectedId(m.id)} className={`w-full rounded-md px-2 py-1.5 text-left text-[11px] ${selected?.id === m.id ? 'bg-primary/15 text-primary' : 'bg-muted/40 text-foreground/70'}`} data-testid={`replay-item-${m.id}`}>
                    <div className="truncate font-medium">{m.trigger}</div>
                    <div className="text-[10px] text-muted-foreground/60">{m.events.length} events · {m.status}</div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-xl border border-border bg-card p-3 lg:col-span-2" data-testid="replay-timeline">
          {!selected ? <p className="text-[11px] text-muted-foreground/60">Select a mission to replay it.</p> : (
            <>
              <div className="mb-2 flex items-center justify-between">
                <div className="text-sm font-semibold">{selected.mission || selected.trigger}</div>
                <span className="text-[10px] text-muted-foreground">{playhead}/{selected.events.length}</span>
              </div>
              <ol className="space-y-1.5">
                {selected.events.map((e, i) => (
                  <li key={i} className="flex items-start gap-2 text-[11px]" style={{ opacity: i < playhead ? 1 : 0.35 }} data-testid={`replay-event-${e.kind}`}>
                    <span className={`text-[9px] uppercase tracking-wider ${KIND_COLOR[e.kind] ?? 'text-muted-foreground'}`}>{e.kind}</span>
                    {e.agent && <span className="text-muted-foreground/60">{e.agent}</span>}
                    <span className="text-foreground/80">{e.label}</span>
                  </li>
                ))}
              </ol>
              {selected.agents.length > 0 && (
                <div className="mt-3 flex flex-wrap items-center gap-1 border-t border-border pt-2 text-[10px] text-muted-foreground">
                  Participants:{selected.agents.map((a) => <span key={a} className="rounded bg-muted px-1.5 py-0.5">{a}</span>)}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default ReplayPanel
