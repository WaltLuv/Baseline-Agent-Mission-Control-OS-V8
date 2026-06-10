/**
 * Maestro orchestration HQ (Baseline OS) — routing engine + panel wiring.
 */
import { test, expect, describe } from "bun:test";
import { readFileSync } from "node:fs";
import { routeMission, maestroReplayEvents, MAESTRO_DIMENSIONS } from "./maestro";

describe("Maestro routing engine", () => {
  test("routes engineering missions to claude-code + high cost", () => {
    const d = routeMission({ mission: "refactor the auth API and add tests" });
    expect(d.lane).toBe("engineering");
    expect(d.provider.chosen).toBe("claude-code");
    expect(d.cost.tier).toBe("high");
  });

  test("routes creative missions to higgsfield", () => {
    expect(routeMission({ mission: "make a product video with a thumbnail" }).lane).toBe(
      "creative",
    );
  });

  test("flags approval for outward-facing / spending / production actions", () => {
    expect(
      routeMission({ mission: "send the outreach campaign to clients" }).approval.required,
    ).toBe(true);
    expect(
      routeMission({ mission: "summarize the internal research notes" }).approval.required,
    ).toBe(false);
  });

  test("graph-first when files are provided; replay trail covers all dimensions", () => {
    const d = routeMission({ mission: "deploy to production", graphFiles: ["src/lib/x.ts"] });
    expect(d.graphFirst).toBe(true);
    const ev = maestroReplayEvents(d, 1);
    expect(ev[0].kind).toBe("trigger");
    expect(ev.some((e) => /Graphify/.test(e.label))).toBe(true);
    expect(ev.some((e) => /routed →/.test(e.label))).toBe(true);
    expect(ev.some((e) => e.kind === "approval")).toBe(true); // 'deploy' + 'production'
    expect(ev.some((e) => e.kind === "agent_start")).toBe(true);
  });

  test("orchestrates the five routing dimensions", () => {
    expect(MAESTRO_DIMENSIONS).toEqual(["Mission", "Workforce", "Provider", "Approval", "Cost"]);
  });
});

describe("Maestro Routing HQ wired into the panel", () => {
  const src = readFileSync("src/components/maestro-panel.tsx", "utf8");
  test("panel routes a mission graph-first + records a replay + shows Agent Activity", () => {
    expect(src).toContain('data-testid="maestro-routing-hq"');
    expect(src).toContain('data-testid="maestro-mission-input"');
    expect(src).toContain("routeMission(");
    expect(src).toContain("recordMission(");
    expect(src).toContain("/__graphify?q=");
    expect(src).toContain('agentId="maestro"');
  });
});
