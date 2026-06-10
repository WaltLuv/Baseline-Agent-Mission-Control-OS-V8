/**
 * Console-directive runtime integration — makes the ops directives (VisionOps,
 * VoiceOps, PropControl, Market Swarm, …) first-class platform missions that
 * participate in all the cross-cutting systems:
 *
 *   Graphify  — graph-first: located files seed the run as context
 *   Agent Activity — agentMap → agent_start events
 *   Replay    — the full trigger→graph→agents→steps→approvals→proof timeline
 *   Proof     — proofSummary → output/proof events
 *   Knowledge OS — proof package is a knowledge artifact (kbRef)
 *
 * Pure + deterministic; shared by Baseline OS and Mission Control. No live
 * execution here — this builds the replayable mission trail a runner records.
 */
import type { ConsoleDirective } from "@/lib/workforce-console";
import type { ReplayEvent } from "@/lib/replay";

/** Build the full 5-system replay trail for a directive run. */
export function directiveToReplayEvents(
  directive: ConsoleDirective,
  graphFiles: string[] = [],
  now = 0,
): ReplayEvent[] {
  const events: ReplayEvent[] = [{ ts: now, kind: "trigger", label: directive.label }];

  // Graphify (graph-first): located files become context for the mission.
  if (graphFiles.length) {
    events.push({
      ts: now,
      kind: "tool_call",
      agent: "PI Agent",
      label: "Graphify query (graph-first)",
      detail: `${graphFiles.length} context files: ${graphFiles.slice(0, 4).join(", ")}`,
    });
  }

  // Agent Activity: each agent in the directive's map starts.
  for (const agent of directive.agentMap) {
    events.push({
      ts: now,
      kind: "agent_start",
      agent,
      label: `assigned · ${directive.directiveId}`,
    });
  }

  // Steps → tool calls.
  for (const step of directive.steps) {
    events.push({
      ts: now,
      kind: "tool_call",
      agent: directive.agentMap[0] ?? "agent",
      label: step,
    });
  }

  // Human gates → approval events (pending until a human acts; recorded as gate).
  for (const gate of directive.humanGates) {
    events.push({ ts: now, kind: "approval", label: gate, detail: "human gate" });
  }

  // Proof: the proof package is the output + a proof event.
  events.push({ ts: now, kind: "output", label: directive.proofSummary });
  events.push({
    ts: now,
    kind: "proof",
    label: `proof package · ${directive.directiveId}`,
    detail: directive.proofSummary,
  });

  return events;
}

/** Which platform systems a directive run participates in (for the matrix/UI). */
export function directiveIntegrations(directive: ConsoleDirective): {
  graphify: boolean;
  agentActivity: boolean;
  replay: boolean;
  proof: boolean;
  knowledgeOs: boolean;
} {
  return {
    graphify: true,
    agentActivity: directive.agentMap.length > 0,
    replay: true,
    proof: Boolean(directive.proofSummary),
    knowledgeOs: Boolean(directive.proofSummary), // proof package → knowledge artifact
  };
}
