/**
 * Console-directive integration (Baseline OS) — VisionOps/VoiceOps/PropControl/
 * Market Swarm participate in Replay + Proof + Agent Activity + Graphify + Knowledge OS.
 */
import { test, expect, describe } from "bun:test";
import { readFileSync } from "node:fs";
import { directiveToReplayEvents, directiveIntegrations } from "./console-directive-run";
import { getDirective, directivesByGroup } from "./workforce-console";

describe("Console-directive 5-system integration", () => {
  test("the four ops directives exist", () => {
    for (const id of ["visionops", "voiceops"]) expect(getDirective(id)).toBeTruthy();
    expect(directivesByGroup("ops").length).toBeGreaterThanOrEqual(4);
  });

  test("a directive run produces the full replay trail (trigger→graph→agents→steps→approvals→proof)", () => {
    const d = getDirective("visionops")!;
    const ev = directiveToReplayEvents(d, ["src/lib/foo.ts"], 1);
    expect(ev[0].kind).toBe("trigger");
    expect(ev.some((e) => e.kind === "tool_call" && /Graphify/.test(e.label))).toBe(true);
    expect(ev.filter((e) => e.kind === "agent_start").length).toBe(d.agentMap.length);
    expect(ev.some((e) => e.kind === "approval")).toBe(true);
    expect(ev.some((e) => e.kind === "proof")).toBe(true);
    expect(ev.some((e) => e.kind === "output")).toBe(true);
  });

  test("no graph files → still a valid mission, just not graph-seeded", () => {
    const d = getDirective("voiceops")!;
    const ev = directiveToReplayEvents(d, [], 1);
    expect(ev.some((e) => /Graphify/.test(e.label))).toBe(false);
    expect(ev.some((e) => e.kind === "proof")).toBe(true);
  });

  test("integration flags report participation in all five systems", () => {
    const i = directiveIntegrations(getDirective("visionops")!);
    expect(i).toEqual({
      graphify: true,
      agentActivity: true,
      replay: true,
      proof: true,
      knowledgeOs: true,
    });
  });
});

describe("Workforce OS console records a replay on run (graph-first)", () => {
  const src = readFileSync("src/routes/workforce-os.tsx", "utf8");
  test("startSimulation queries Graphify + records the directive mission", () => {
    expect(src).toContain("directiveToReplayEvents");
    expect(src).toContain("recordMission(");
    expect(src).toContain("/__graphify?q=");
  });
});
