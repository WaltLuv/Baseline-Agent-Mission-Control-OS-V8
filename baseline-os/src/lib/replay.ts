/**
 * Workforce Replay — data model (Baseline OS parity, Phase 3).
 *
 * Pure, local-first model that records enough per-mission metadata to replay a
 * mission like a screen recording: trigger, participating agents, tool calls,
 * skills, approvals, files touched, outputs, and proof events. The replay UI is
 * built later; these pure builders are the canonical data layer (persist via
 * the durable state-integrity layer or the local store when wired).
 */
export type ReplayEventKind =
  | "trigger"
  | "agent_start"
  | "tool_call"
  | "skill_run"
  | "approval"
  | "file_touched"
  | "output"
  | "proof"
  | "error"
  | "complete";

export interface ReplayEvent {
  ts: number;
  kind: ReplayEventKind;
  agent?: string;
  label: string;
  detail?: string;
}

export interface MissionReplay {
  id: string;
  trigger: string;
  mission: string;
  status: "running" | "completed" | "failed";
  agents: string[];
  events: ReplayEvent[];
  outputs: string[];
  startedAt: number;
  endedAt: number | null;
}

export function startReplay(
  id: string,
  trigger: string,
  mission: string,
  now: number,
): MissionReplay {
  return {
    id,
    trigger,
    mission,
    status: "running",
    agents: [],
    outputs: [],
    events: [{ ts: now, kind: "trigger", label: trigger }],
    startedAt: now,
    endedAt: null,
  };
}

/** Append an event, deriving participating agents + outputs. Returns a new replay. */
export function recordReplayEvent(replay: MissionReplay, event: ReplayEvent): MissionReplay {
  const agents =
    event.agent && !replay.agents.includes(event.agent)
      ? [...replay.agents, event.agent]
      : replay.agents;
  const outputs = event.kind === "output" ? [...replay.outputs, event.label] : replay.outputs;
  return { ...replay, events: [...replay.events, event], agents, outputs };
}

export function endReplay(
  replay: MissionReplay,
  status: "completed" | "failed",
  now: number,
): MissionReplay {
  return {
    ...replay,
    status,
    endedAt: now,
    events: [...replay.events, { ts: now, kind: "complete", label: status }],
  };
}
