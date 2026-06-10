/**
 * Workforce Replay store + UI wiring (Baseline OS, bun test).
 */
import { test, expect, describe, beforeEach } from "bun:test";
import { readFileSync } from "node:fs";

function installStorage() {
  const store = new Map<string, string>();
  (globalThis as unknown as { window: unknown }).window = {
    localStorage: {
      getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
      setItem: (k: string, v: string) => void store.set(k, String(v)),
      removeItem: (k: string) => void store.delete(k),
    },
    dispatchEvent: () => true,
  };
  (globalThis as unknown as { StorageEvent: unknown }).StorageEvent = class {
    constructor(_t: string, _i: unknown) {}
  };
}

beforeEach(() => installStorage());

async function load() {
  return await import("./replay-store");
}

describe("Replay store", () => {
  test("records a mission (trigger → events → completion) and lists it", async () => {
    const { recordMission, listReplays, getReplay } = await load();
    const r = recordMission("Gemini Flow: launch", "launch a campaign", [
      { ts: 1, kind: "tool_call", agent: "PI Agent", label: "Graphify query" },
      { ts: 2, kind: "agent_start", agent: "Planner", label: "Plan" },
      { ts: 3, kind: "output", label: "artifact: plan" },
    ]);
    expect(r.events[0].kind).toBe("trigger");
    expect(r.events[r.events.length - 1].kind).toBe("complete");
    expect(r.status).toBe("completed");
    const list = listReplays();
    expect(list.length).toBe(1);
    expect(getReplay(r.id)?.agents).toEqual(expect.arrayContaining(["PI Agent", "Planner"]));
  });

  test("missions are listed newest-first", async () => {
    const { recordMission, listReplays } = await load();
    recordMission("first", "m1", []);
    await new Promise((r) => setTimeout(r, 2));
    recordMission("second", "m2", []);
    expect(listReplays()[0].trigger).toBe("second");
  });
});

describe("Replay UI + emitters wired", () => {
  test("/replay route renders list + timeline with all event kinds", () => {
    const route = readFileSync("src/routes/replay.tsx", "utf8");
    expect(route).toContain('createFileRoute("/replay")');
    expect(route).toContain('data-testid="replay-list"');
    expect(route).toContain('data-testid="replay-timeline"');
    expect(route).toContain("playhead"); // screen-recording-style playback
  });

  test("nav + emitters: Gemini Flow + Org Chart record replays", () => {
    expect(readFileSync("src/components/app-sidebar.tsx", "utf8")).toContain('to: "/replay"');
    expect(readFileSync("src/routes/agents.gemini.tsx", "utf8")).toContain("recordMission(");
    expect(readFileSync("src/routes/org-chart.tsx", "utf8")).toContain("recordMission(");
  });
});
