/**
 * Gemini Flow — Google-Flow-style workflow engine (Gemini stops being a chat box).
 *
 * Turns a goal into a task graph + execution plan that is GRAPHIFY-FIRST: the
 * planner seeds the graph with located files (structural context) before any
 * task node, then lays out Plan → Research → Draft → Review → Export with agent
 * + provider assignment and artifact outputs. Every action emits replay events.
 *
 * Pure + deterministic (testable); shared by Baseline OS + Mission Control.
 * No live model calls here — execution is dispatched by the runtime layer.
 */
import type { ReplayEvent } from "@/lib/replay";

export type FlowNodeKind = "context" | "task" | "agent" | "provider" | "artifact";

export interface FlowNode {
  id: string;
  kind: FlowNodeKind;
  label: string;
  deps: string[];
  status: "pending" | "running" | "done" | "blocked";
}

export interface FlowWorkflow {
  id: string;
  name: string;
  goal: string;
  nodes: FlowNode[];
  createdAt: number;
  graphFirst: boolean;
}

export const ARTIFACT_KINDS = [
  "document",
  "plan",
  "code",
  "research",
  "presentation",
  "export",
] as const;
export const FLOW_NODE_KINDS: FlowNodeKind[] = ["context", "task", "agent", "provider", "artifact"];

const DEFAULT_TASKS = ["Plan", "Research", "Draft", "Review", "Export"];

/**
 * Build a graph-first execution plan from a goal. `graphFiles` are the files
 * Graphify located for the goal (PI-Agent step) — they become `context` nodes
 * the task graph depends on, so planning consults the graph before the repo.
 */
export function planFromGoal(
  goal: string,
  graphFiles: string[] = [],
  opts: { now?: number; agent?: string; provider?: string; id?: string } = {},
): FlowWorkflow {
  const now = opts.now ?? 0;
  const id = opts.id ?? `flow_${now.toString(36)}`;
  const nodes: FlowNode[] = [];

  // 1. Graphify context nodes first (graph-first).
  const contextIds: string[] = [];
  graphFiles.slice(0, 6).forEach((f, i) => {
    const cid = `${id}-ctx-${i}`;
    contextIds.push(cid);
    nodes.push({ id: cid, kind: "context", label: f, deps: [], status: "done" });
  });

  // 2. Agent + provider assignment.
  const agentId = `${id}-agent`;
  nodes.push({
    id: agentId,
    kind: "agent",
    label: opts.agent ?? "Gemini Flow Planner",
    deps: contextIds,
    status: "pending",
  });
  const providerId = `${id}-provider`;
  nodes.push({
    id: providerId,
    kind: "provider",
    label: opts.provider ?? "gemini",
    deps: [agentId],
    status: "pending",
  });

  // 3. Task chain (each depends on the previous; first depends on agent+context).
  let prev = providerId;
  const taskIds: string[] = [];
  for (const t of DEFAULT_TASKS) {
    const tid = `${id}-task-${t.toLowerCase()}`;
    taskIds.push(tid);
    nodes.push({ id: tid, kind: "task", label: t, deps: [prev], status: "pending" });
    prev = tid;
  }

  // 4. Artifact outputs hang off the relevant task.
  nodes.push({
    id: `${id}-art-plan`,
    kind: "artifact",
    label: "plan",
    deps: [`${id}-task-plan`],
    status: "pending",
  });
  nodes.push({
    id: `${id}-art-export`,
    kind: "artifact",
    label: "export",
    deps: [`${id}-task-export`],
    status: "pending",
  });

  return {
    id,
    name: goal.slice(0, 60) || "Untitled flow",
    goal,
    nodes,
    createdAt: now,
    graphFirst: graphFiles.length > 0,
  };
}

/** Replay events for a planned workflow (graph query → planning → tasks). */
export function flowReplayEvents(wf: FlowWorkflow, now = 0): ReplayEvent[] {
  const events: ReplayEvent[] = [{ ts: now, kind: "trigger", label: `Gemini Flow: ${wf.name}` }];
  if (wf.graphFirst) {
    const ctx = wf.nodes.filter((n) => n.kind === "context");
    events.push({
      ts: now,
      kind: "tool_call",
      agent: "PI Agent",
      label: "Graphify query (graph-first planning)",
      detail: `${ctx.length} context files`,
    });
  }
  for (const t of wf.nodes.filter((n) => n.kind === "task")) {
    events.push({ ts: now, kind: "agent_start", agent: "Gemini Flow Planner", label: t.label });
  }
  for (const a of wf.nodes.filter((n) => n.kind === "artifact")) {
    events.push({ ts: now, kind: "output", label: `artifact: ${a.label}` });
  }
  return events;
}

/** Counts for the workspace header. */
export function flowStats(wf: FlowWorkflow) {
  return {
    tasks: wf.nodes.filter((n) => n.kind === "task").length,
    artifacts: wf.nodes.filter((n) => n.kind === "artifact").length,
    contextFiles: wf.nodes.filter((n) => n.kind === "context").length,
    graphFirst: wf.graphFirst,
  };
}
