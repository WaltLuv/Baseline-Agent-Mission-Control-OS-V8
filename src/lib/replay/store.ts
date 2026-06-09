/**
 * Workforce Replay — data model + capture store (Phase 3).
 *
 * Records enough per-mission metadata to later reconstruct a mission like a
 * screen recording: what triggered it, which agents ran, which tools/skills
 * were called, which approvals occurred, which files were touched, and the
 * final outputs + proof events. Workspace-scoped. The replay UI is built later;
 * this is the canonical data layer it will read.
 */
import { getDatabase } from '@/lib/db'

export type ReplayEventKind =
  | 'trigger' | 'agent_start' | 'tool_call' | 'skill_run' | 'approval'
  | 'file_touched' | 'output' | 'proof' | 'error' | 'complete'

export interface ReplayEvent {
  ts: number
  kind: ReplayEventKind
  agent?: string
  label: string
  /** Free-form detail (tool args redacted, file path, approval decision, etc.). */
  detail?: string
}

export interface MissionReplay {
  id: string
  workspaceId: number
  trigger: string
  mission: string
  status: 'running' | 'completed' | 'failed'
  agents: string[]
  events: ReplayEvent[]
  outputs: string[]
  startedAt: number
  endedAt: number | null
}

interface Row {
  id: string; workspace_id: number; trigger: string; mission: string; status: string
  agents: string; events: string; outputs: string; started_at: number; ended_at: number | null
}

function toReplay(r: Row): MissionReplay {
  const arr = (s: string) => { try { return JSON.parse(s) } catch { return [] } }
  return {
    id: r.id, workspaceId: r.workspace_id, trigger: r.trigger, mission: r.mission,
    status: r.status as MissionReplay['status'], agents: arr(r.agents), events: arr(r.events),
    outputs: arr(r.outputs), startedAt: r.started_at, endedAt: r.ended_at,
  }
}

let seq = 0
function newId(now: number): string { seq = (seq + 1) % 1e6; return `replay_${now.toString(36)}${seq.toString(36)}` }

/** Begin a replay record for a mission. */
export function startReplay(workspaceId: number, trigger: string, mission: string, now: number): MissionReplay {
  const id = newId(now)
  const ev: ReplayEvent[] = [{ ts: now, kind: 'trigger', label: trigger }]
  getDatabase().prepare(`
    INSERT INTO mission_replays (id, workspace_id, trigger, mission, status, agents, events, outputs, started_at, ended_at)
    VALUES (?, ?, ?, ?, 'running', '[]', ?, '[]', ?, NULL)
  `).run(id, workspaceId, trigger, mission, JSON.stringify(ev), now)
  return getReplay(workspaceId, id)!
}

export function getReplay(workspaceId: number, id: string): MissionReplay | null {
  const r = getDatabase().prepare('SELECT * FROM mission_replays WHERE id=? AND workspace_id=?').get(id, workspaceId) as Row | undefined
  return r ? toReplay(r) : null
}

export function listReplays(workspaceId: number, limit = 50): MissionReplay[] {
  return (getDatabase().prepare('SELECT * FROM mission_replays WHERE workspace_id=? ORDER BY started_at DESC LIMIT ?').all(workspaceId, limit) as Row[]).map(toReplay)
}

/** Append an event (tool call, approval, file touch, output, proof…) to a replay. */
export function recordReplayEvent(workspaceId: number, id: string, event: ReplayEvent): MissionReplay | null {
  const rep = getReplay(workspaceId, id)
  if (!rep) return null
  const events = [...rep.events, event]
  const agents = event.agent && !rep.agents.includes(event.agent) ? [...rep.agents, event.agent] : rep.agents
  const outputs = event.kind === 'output' ? [...rep.outputs, event.label] : rep.outputs
  getDatabase().prepare('UPDATE mission_replays SET events=?, agents=?, outputs=? WHERE id=? AND workspace_id=?')
    .run(JSON.stringify(events), JSON.stringify(agents), JSON.stringify(outputs), id, workspaceId)
  return getReplay(workspaceId, id)
}

/** Close a replay. */
export function endReplay(workspaceId: number, id: string, status: 'completed' | 'failed', now: number): MissionReplay | null {
  const rep = getReplay(workspaceId, id)
  if (!rep) return null
  const events = [...rep.events, { ts: now, kind: 'complete' as ReplayEventKind, label: status }]
  getDatabase().prepare('UPDATE mission_replays SET status=?, ended_at=?, events=? WHERE id=? AND workspace_id=?')
    .run(status, now, JSON.stringify(events), id, workspaceId)
  return getReplay(workspaceId, id)
}
