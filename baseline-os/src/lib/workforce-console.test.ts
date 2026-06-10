/**
 * Interactive Workforce OS Console — directive model tests (Baseline OS, bun test).
 * Verifies 13 directives (3 general + 6 industry + 4 ops), the 4 ops directives,
 * Market Swarm language, human gates, and that the console renders all 13.
 */
import { test, expect, describe } from "bun:test";
import { readFileSync } from "node:fs";
import { CONSOLE_DIRECTIVES, directivesByGroup, getDirective } from "./workforce-console";

describe("Baseline OS Workforce OS console directives", () => {
  test("has 13 total directives (3 general + 6 industry + 4 ops)", () => {
    expect(CONSOLE_DIRECTIVES.length).toBe(13);
    expect(directivesByGroup("general").length).toBe(3);
    expect(directivesByGroup("industry").length).toBe(6);
    expect(directivesByGroup("ops").length).toBe(4);
  });

  test("keeps the original three general directives", () => {
    const general = directivesByGroup("general").map((d) => d.directiveId);
    for (const id of ["software-release", "saas-launch", "market-intel"]) {
      expect(general).toContain(id);
    }
  });

  test("adds the six industry directives", () => {
    const v = directivesByGroup("industry").map((d) => d.verticalId);
    for (const id of [
      "property-management",
      "real-estate",
      "cpa",
      "marketing-agency",
      "home-services",
      "general-contractor",
    ]) {
      expect(v).toContain(id);
    }
  });

  test("adds the four ops directives: VisionOps, VoiceOps, PropControl, Market Swarm", () => {
    const ops = directivesByGroup("ops").map((d) => d.directiveId);
    for (const id of ["visionops", "voiceops", "propcontrol", "market-swarm"]) {
      expect(ops).toContain(id);
    }
  });

  test("every directive has an agent map, sim log, human gate, and a proof step", () => {
    for (const d of CONSOLE_DIRECTIVES) {
      expect(d.agentMap.length).toBeGreaterThan(0);
      expect(d.steps.length).toBeGreaterThan(2);
      expect(d.humanGates.length).toBeGreaterThan(0);
      expect(d.steps.some((s) => /proof package/i.test(s))).toBe(true);
    }
  });

  test("Market Swarm mentions 100 Kimi 2.5 agents, distressed/motivated/off-market, dedupe, scoring, and gates outreach", () => {
    const sw = getDirective("market-swarm")!;
    const blob = (sw.description + " " + sw.steps.join(" ")).toLowerCase();
    expect(blob).toMatch(/100/);
    expect(blob).toMatch(/kimi 2\.5/);
    expect(blob).toMatch(/distressed/);
    expect(blob).toMatch(/motivated seller/);
    expect(blob).toMatch(/off-market/);
    expect(blob).toMatch(/dedup/);
    expect(blob).toMatch(/scor/);
    expect(sw.humanGates.join(" ").toLowerCase()).toMatch(/outreach|export|spend|owner/);
  });

  test("the console renders all 13 directives (generated industry + ops merged)", () => {
    const src = readFileSync("src/routes/workforce-os.tsx", "utf8");
    expect(src).toContain("ALL_SIMULATIONS");
    expect(src).toContain('directivesByGroup("industry")');
    expect(src).toContain('directivesByGroup("ops")');
    expect(src).toContain("Object.keys(ALL_SIMULATIONS)");
  });
});
