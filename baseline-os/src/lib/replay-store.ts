/**
 * Replay store (Baseline OS) — local persistence for the Workforce Replay system.
 *
 * The pure model lives in replay.ts; this persists missions to localStorage so
 * the Replay UI can list + reconstruct them. Every surface (Org Chart gen,
 * Gemini Flow, Agent Factory, Creative OS, …) records a mission here so the user
 * can replay it like a screen recording. Local-first / private.
 */
import {
  startReplay,
  recordReplayEvent,
  endReplay,
  type MissionReplay,
  type ReplayEvent,
} from "@/lib/replay";

const KEY = "baseline-os.replays.v1";
const MAX = 100;

function read(): MissionReplay[] {
  if (typeof window === "undefined") return [];
  try {
    const j = JSON.parse(window.localStorage.getItem(KEY) || "[]");
    return Array.isArray(j) ? j : [];
  } catch {
    return [];
  }
}
function write(list: MissionReplay[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
    window.dispatchEvent(new StorageEvent("storage", { key: KEY }));
  } catch {
    /* quota */
  }
}

let seq = 0;
function newId(now: number): string {
  seq = (seq + 1) % 1e6;
  return `replay_${now.toString(36)}${seq.toString(36)}`;
}

export function listReplays(): MissionReplay[] {
  return read().sort((a, b) => b.startedAt - a.startedAt);
}

export function getReplay(id: string): MissionReplay | null {
  return read().find((r) => r.id === id) ?? null;
}

/**
 * Record a full mission in one call: trigger → events → completion. Returns the
 * persisted replay. This is what surfaces call after an action completes.
 */
export function recordMission(
  trigger: string,
  mission: string,
  events: ReplayEvent[],
  status: "completed" | "failed" = "completed",
): MissionReplay {
  const now = Date.now();
  let r = startReplay(newId(now), trigger, mission, now);
  for (const e of events) r = recordReplayEvent(r, e);
  r = endReplay(r, status, Date.now());
  write([r, ...read()]);
  return r;
}

export function clearReplays(): void {
  write([]);
}
