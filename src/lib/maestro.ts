/**
 * Maestro — the orchestration HQ ("air traffic control for AI workforces").
 *
 * Pure, deterministic routing engine shared by Baseline OS + Mission Control.
 * Given a mission it routes across five dimensions:
 *   - Mission   → a lane (engineering / growth / ops / creative / research)
 *   - Workforce → which team/agents handle it
 *   - Provider  → which runtime/provider executes (+ why)
 *   - Approval  → whether a human gate is required (+ reason)
 *   - Cost      → an estimated cost tier
 *
 * Graph-first: callers pass located files so routing context is graph-seeded.
 * Emits replay events so every routed mission is watchable. No live dispatch
 * here — Maestro decides; the runtime layer executes.
 */
import type { ReplayEvent } from "@/lib/replay/store";

export type Lane = "engineering" | "growth" | "ops" | "creative" | "research";

export interface RoutingInput {
  mission: string;
  urgency?: "low" | "normal" | "high";
  graphFiles?: string[];
}

export interface RoutingDecision {
  mission: string;
  lane: Lane;
  workforce: string[];
  provider: { chosen: string; reason: string; fallbacks: string[] };
  approval: { required: boolean; reason: string };
  cost: { tier: "low" | "medium" | "high"; note: string };
  graphFirst: boolean;
}

const LANE_RULES: { lane: Lane; re: RegExp; workforce: string[]; provider: string }[] = [
  {
    lane: "engineering",
    re: /\b(code|build|deploy|bug|refactor|api|migrat|test)\b/i,
    workforce: ["Engineering Lead", "Builder", "Reviewer"],
    provider: "claude-code",
  },
  {
    lane: "creative",
    re: /\b(video|image|ad|thumbnail|storyboard|render|creative|brand)\b/i,
    workforce: ["Creative Director", "Editor", "Voice"],
    provider: "higgsfield",
  },
  {
    lane: "growth",
    re: /\b(lead|outreach|sales|campaign|seo|market|email)\b/i,
    workforce: ["Growth Lead", "Copywriter", "Analyst"],
    provider: "gemini",
  },
  {
    lane: "ops",
    re: /\b(inspect|dispatch|call|property|inventory|field|swarm|ops)\b/i,
    workforce: ["Ops Coordinator", "Analyst", "Approver"],
    provider: "hermes",
  },
  {
    lane: "research",
    re: /\b(research|analyze|audit|summari|investigat|report)\b/i,
    workforce: ["Research Lead", "Synthesizer"],
    provider: "gemini",
  },
];

const APPROVAL_TRIGGERS =
  /\b(send|deploy|publish|outreach|charge|delete|spend|client|owner|production|launch)\b/i;

/** Route a mission across all five dimensions (deterministic). */
export function routeMission(input: RoutingInput): RoutingDecision {
  const m = input.mission;
  const rule = LANE_RULES.find((r) => r.re.test(m)) ?? LANE_RULES[4]; // default: research
  const required = APPROVAL_TRIGGERS.test(m);
  const high = input.urgency === "high";
  const tier: "low" | "medium" | "high" =
    rule.lane === "creative" || rule.lane === "engineering" ? "high" : high ? "medium" : "low";
  return {
    mission: m,
    lane: rule.lane,
    workforce: rule.workforce,
    provider: {
      chosen: rule.provider,
      reason: `best fit for ${rule.lane} work`,
      fallbacks: rule.provider === "claude-code" ? ["ollama"] : ["openai"],
    },
    approval: {
      required,
      reason: required
        ? "mission has an outward-facing / spending / production action"
        : "internal/non-destructive — auto-approved",
    },
    cost: {
      tier,
      note:
        tier === "high"
          ? "render/compute-heavy lane"
          : tier === "medium"
            ? "expedited (high urgency)"
            : "standard internal task",
    },
    graphFirst: (input.graphFiles?.length ?? 0) > 0,
  };
}

/** Replay trail for a routed mission (trigger → graph → route → approval gate). */
export function maestroReplayEvents(decision: RoutingDecision, now = 0): ReplayEvent[] {
  const events: ReplayEvent[] = [
    { ts: now, kind: "trigger", label: `Maestro routed: ${decision.mission}`.slice(0, 80) },
  ];
  if (decision.graphFirst) {
    events.push({
      ts: now,
      kind: "tool_call",
      agent: "PI Agent",
      label: "Graphify query (graph-first routing context)",
    });
  }
  events.push({
    ts: now,
    kind: "tool_call",
    agent: "Maestro",
    label: `routed → ${decision.lane} lane · provider ${decision.provider.chosen}`,
  });
  for (const w of decision.workforce)
    events.push({ ts: now, kind: "agent_start", agent: w, label: `assigned · ${decision.lane}` });
  if (decision.approval.required)
    events.push({
      ts: now,
      kind: "approval",
      label: "human gate",
      detail: decision.approval.reason,
    });
  events.push({
    ts: now,
    kind: "output",
    label: `cost tier ${decision.cost.tier} · ${decision.cost.note}`,
  });
  return events;
}

/** The five routing dimensions Maestro orchestrates (for the HQ header/matrix). */
export const MAESTRO_DIMENSIONS = ["Mission", "Workforce", "Provider", "Approval", "Cost"] as const;
