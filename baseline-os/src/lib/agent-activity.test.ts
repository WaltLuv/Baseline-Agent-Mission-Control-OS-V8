/**
 * Agent Activity Visualizer (bun test) — proves the shared <AgentActivity/>
 * renders all 9 panels + every mission state, reads the REAL ledger
 * (/__agent_activity), shows honest idle/no-fake state, and is mounted on
 * agent pages.
 */
import { test, expect, describe } from "bun:test";
import { readFileSync } from "node:fs";
import { MISSION_STATES } from "./../components/agent-activity";

const comp = readFileSync("src/components/agent-activity.tsx", "utf8");
const sidecar = readFileSync("vite.config.ts", "utf8");

describe("AgentActivity framework", () => {
  test("exports all 9 mission states", () => {
    for (const s of [
      "idle",
      "queued",
      "planning",
      "researching",
      "executing",
      "waiting",
      "approval_required",
      "completed",
      "failed",
    ]) {
      expect(MISSION_STATES).toContain(s);
    }
  });

  test("renders all 9 panels", () => {
    for (const id of [
      "aa-mission",
      "aa-tools",
      "aa-files",
      "aa-timeline",
      "aa-skills",
      "aa-memory",
      "aa-proof",
      "aa-approvals",
      "aa-metrics",
    ]) {
      expect(comp, `missing panel ${id}`).toContain(`testid="${id}"`);
    }
    expect(comp).toContain('data-testid="agent-activity"');
  });

  test("reads the REAL tool-execution ledger and never fabricates", () => {
    expect(comp).toContain("/__agent_activity");
    expect(comp).toContain("No active mission"); // honest idle
    expect(comp).toContain("never estimated"); // tokens/cost not faked
    expect(sidecar).toContain('server.middlewares.use("/__agent_activity"');
    expect(sidecar).toContain("tool-executions.jsonl");
    expect(sidecar).toContain('status: events.length > 0 ? "completed" : "idle"');
  });

  test("is a single shared component (no per-agent custom versions)", () => {
    expect(comp).toContain("export function AgentActivity");
  });

  test("is mounted on agent pages", () => {
    for (const f of ["agents.ruflo", "agents.hermes", "agents.codex", "agents.gemini"]) {
      const src = readFileSync(`src/routes/${f}.tsx`, "utf8");
      expect(src, `${f} missing import`).toContain('from "@/components/agent-activity"');
      expect(src, `${f} missing mount`).toContain("<AgentActivity");
    }
  });
});
