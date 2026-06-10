/**
 * Gemini Flow (Baseline OS) — graph-first workflow engine + workspace wiring.
 */
import { test, expect, describe } from "bun:test";
import { readFileSync } from "node:fs";
import { planFromGoal, flowReplayEvents, flowStats, ARTIFACT_KINDS } from "./gemini-flow";

describe("Gemini Flow engine (graph-first)", () => {
  test("plans a task graph with agent + provider + tasks + artifacts", () => {
    const wf = planFromGoal("ship a product commercial", ["src/lib/auth.ts"], {
      now: 1,
      provider: "gemini",
    });
    expect(wf.nodes.some((n) => n.kind === "agent")).toBe(true);
    expect(wf.nodes.some((n) => n.kind === "provider" && n.label === "gemini")).toBe(true);
    expect(wf.nodes.filter((n) => n.kind === "task").length).toBeGreaterThanOrEqual(5);
    expect(wf.nodes.some((n) => n.kind === "artifact")).toBe(true);
  });

  test("is graph-first: located files become context nodes the plan depends on", () => {
    const wf = planFromGoal("fix auth", ["src/lib/auth.ts", "src/routes/login.tsx"], { now: 1 });
    expect(wf.graphFirst).toBe(true);
    const ctx = wf.nodes.filter((n) => n.kind === "context");
    expect(ctx.length).toBe(2);
    const agent = wf.nodes.find((n) => n.kind === "agent")!;
    expect(agent.deps).toEqual(expect.arrayContaining(ctx.map((c) => c.id)));
    expect(flowStats(wf).graphFirst).toBe(true);
  });

  test("no graph files → still plans, marked not-graph-first (honest)", () => {
    const wf = planFromGoal("do a thing", [], { now: 1 });
    expect(wf.graphFirst).toBe(false);
    expect(wf.nodes.filter((n) => n.kind === "context").length).toBe(0);
  });

  test("emits replay events (trigger → graph query → tasks → artifacts)", () => {
    const wf = planFromGoal("research topic", ["a.ts"], { now: 5 });
    const ev = flowReplayEvents(wf, 5);
    expect(ev[0].kind).toBe("trigger");
    expect(ev.some((e) => e.kind === "tool_call" && /Graphify/.test(e.label))).toBe(true);
    expect(ev.some((e) => e.kind === "agent_start")).toBe(true);
    expect(ev.some((e) => e.kind === "output")).toBe(true);
  });

  test("artifact kinds cover docs/plan/code/research/presentation/export", () => {
    for (const k of ["document", "plan", "code", "research", "presentation", "export"]) {
      expect(ARTIFACT_KINDS).toContain(k as (typeof ARTIFACT_KINDS)[number]);
    }
  });
});

describe("Gemini Flow wired into the Gemini page (not a chatbot)", () => {
  const src = readFileSync("src/routes/agents.gemini.tsx", "utf8");
  test("Flow tab queries Graphify first + renders canvas/artifacts/agents + Agent Activity", () => {
    expect(src).toContain('data-testid="gemini-flow-tab"');
    expect(src).toContain('data-testid="flow-canvas"');
    expect(src).toContain('data-testid="flow-artifacts"');
    expect(src).toContain("/__graphify?q=");
    expect(src).toContain("planFromGoal");
    expect(src).toContain('agentId="gemini-flow"');
  });
});
