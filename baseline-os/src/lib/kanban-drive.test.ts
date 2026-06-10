/**
 * Self-Driving Kanban 2.0 (Baseline OS) — engine + localStorage pipeline + route.
 */
import { test, expect, describe, beforeEach } from "bun:test";
import { readFileSync } from "node:fs";
import { planFloors, selfCheck, nextStage, MAX_RETRIES } from "./kanban-drive";

function installStorage() {
  const store = new Map<string, string>();
  (globalThis as unknown as { window: unknown }).window = {
    localStorage: {
      getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
      setItem: (k: string, v: string) => void store.set(k, String(v)),
      removeItem: (k: string) => void store.delete(k),
    },
    dispatchEvent: () => true,
    addEventListener: () => {},
    fetch: () => Promise.reject(new Error("no fetch in test")),
  };
  (globalThis as unknown as { StorageEvent: unknown }).StorageEvent = class {
    constructor(_t: string, _i: unknown) {}
  };
  (globalThis as unknown as { fetch: unknown }).fetch = () => Promise.reject(new Error("no fetch"));
}
beforeEach(() => installStorage());
async function store() {
  return await import("./kanban-drive-store");
}

describe("Kanban 2.0 engine (OS)", () => {
  test("5-floor plan + payload spec + retry cap", () => {
    const plan = planFloors("Build a habit tracker widget", ["src/x.tsx"]);
    expect(plan.floors.length).toBe(4);
    expect(plan.payloadSpec.steps.length).toBeGreaterThan(0);
    expect(selfCheck(plan.payloadSpec, "").pass).toBe(false);
    expect(nextStage("Self_Check", { checkPass: false, attempts: MAX_RETRIES })).toBe(
      "Shipped_Gallery",
    );
  });
});

describe("Kanban 2.0 pipeline (OS, localStorage)", () => {
  test("drive → awaiting approval; approve → shipped (safe draft)", async () => {
    const { drive, approve, getCard, OS_TEMPLATES } = await store();
    expect(OS_TEMPLATES.length).toBeGreaterThan(0);
    const c = drive("Build a metrics dashboard", ["src/d.tsx"], 1);
    expect(c.stage).toBe("Awaiting_Approval");
    const shipped = approve(c.id, "approve", "walt", 2);
    expect(shipped?.stage).toBe("Shipped_Gallery");
    expect(shipped?.artifact.length).toBeGreaterThan(0);
    expect(getCard(c.id)?.stage).toBe("Shipped_Gallery");
  });
  test("reject keeps it out of implementation", async () => {
    const { drive, approve } = await store();
    const c = drive("Build a landing page", [], 1);
    const r = approve(c.id, "reject", "walt", 2);
    expect(r?.stage).toBe("Awaiting_Approval");
    expect(r?.approvalStatus).toBe("reject");
  });
});

describe("Kanban 2.0 route wired (OS)", () => {
  const route = readFileSync("src/routes/kanban-gallery.tsx", "utf8");
  const nav = readFileSync("src/components/app-sidebar.tsx", "utf8");
  test("route + drive + board + approval gate + nav", () => {
    expect(route).toContain('createFileRoute("/kanban-gallery")');
    expect(route).toContain('data-testid="kanban-drive"');
    expect(route).toContain('data-testid="kanban-approval-gate"');
    expect(route).toContain("/__graphify?q="); // graph-first
    expect(nav).toContain('to: "/kanban-gallery"');
  });
});
