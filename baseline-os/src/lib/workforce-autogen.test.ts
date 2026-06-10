/**
 * Baseline OS parity — workforce auto-gen + factory sync + replay (bun test).
 */
import { test, expect, describe } from "bun:test";
import {
  orgPlanFromDirective,
  GENERATABLE_DIRECTIVES,
  planAdditions,
  applyFactoryUpsert,
  applyFactoryArchive,
  type RosterAgent,
} from "./workforce-autogen";
import { startReplay, recordReplayEvent, endReplay } from "./replay";

let n = 0;
const newId = () => `id_${n++}`;

describe("Phase 1 — workforce → org auto-generation (OS)", () => {
  test("plans an org for every console directive with exactly one lead", () => {
    expect(GENERATABLE_DIRECTIVES.length).toBe(13);
    for (const id of GENERATABLE_DIRECTIVES) {
      const plan = orgPlanFromDirective(id);
      expect(plan.length, `no plan for ${id}`).toBeGreaterThan(0);
      expect(plan.filter((g) => g.isLead).length).toBe(1);
      expect(plan.every((g) => g.category === `template:${id}`)).toBe(true);
    }
  });

  test("idempotent: reinstall adds nothing new, reports wired to lead", () => {
    const plan = orgPlanFromDirective("pm-maintenance");
    const first = planAdditions([], plan, newId);
    expect(first.length).toBe(plan.length);
    const lead = first.find((a) => a.managerId === null)!;
    expect(first.filter((a) => a.managerId === lead.id).length).toBe(plan.length - 1);
    const second = planAdditions(first as RosterAgent[], plan, newId);
    expect(second.length).toBe(0); // nothing duplicated
  });

  test("unknown directive → empty plan (no fabrication)", () => {
    expect(orgPlanFromDirective("nope")).toEqual([]);
  });
});

describe("Phase 2 — Agent Factory sync (OS)", () => {
  test("upsert is idempotent; archive leaves no orphan reports", () => {
    let roster: RosterAgent[] = [];
    const a = applyFactoryUpsert(roster, { name: "Recon Bot", role: "Researcher" }, newId);
    expect(a.created).toBe(true);
    roster = a.roster;
    const b = applyFactoryUpsert(roster, { name: "Recon Bot", role: "Lead" }, newId);
    expect(b.created).toBe(false);
    expect(b.roster.filter((x) => x.name === "Recon Bot").length).toBe(1);
    const archived = applyFactoryArchive(b.roster, "Recon Bot");
    expect(archived.find((x) => x.name === "Recon Bot")!.archived).toBe(true);
  });
});

describe("Phase 3 — Replay data model (OS)", () => {
  test("captures trigger → events → outputs → completion", () => {
    let r = startReplay("r1", "Inbound call", "VoiceOps intake", 1000);
    expect(r.events[0].kind).toBe("trigger");
    r = recordReplayEvent(r, {
      ts: 1001,
      kind: "agent_start",
      agent: "Intent Detector",
      label: "started",
    });
    r = recordReplayEvent(r, {
      ts: 1002,
      kind: "tool_call",
      agent: "Dispatcher",
      label: "task:create",
    });
    r = recordReplayEvent(r, { ts: 1003, kind: "approval", label: "human gate" });
    r = recordReplayEvent(r, { ts: 1004, kind: "output", label: "ticket.json" });
    r = endReplay(r, "completed", 1005);
    expect(r.agents).toEqual(["Intent Detector", "Dispatcher"]);
    expect(r.outputs).toContain("ticket.json");
    expect(r.status).toBe("completed");
    expect(r.events.some((e) => e.kind === "approval")).toBe(true);
    expect(r.events[r.events.length - 1].kind).toBe("complete");
  });
});
