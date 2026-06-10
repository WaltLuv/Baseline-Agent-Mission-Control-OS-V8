/**
 * Slim Charles (Baseline OS only) — safety boundary, private voice id, tool
 * surface, and page/route presence (bun test). Truth-first: destructive actions
 * require Walt; tool access is honest; the private voice id lives only here.
 */
import { test, expect, describe } from "bun:test";
import { readFileSync } from "node:fs";
import {
  SLIM_CHARLES,
  classifyAction,
  canSlimAutoApprove,
  AUTO_APPROVE_ACTIONS,
  REQUIRES_WALT_ACTIONS,
  TOOL_SOURCES,
} from "./slim-charles";

describe("Slim Charles safety boundary", () => {
  test("auto-approves safe generative work", () => {
    for (const a of AUTO_APPROVE_ACTIONS) expect(classifyAction(a)).toBe("auto");
    expect(canSlimAutoApprove("research")).toBe(true);
  });
  test("requires Walt for every destructive/financial/secret action", () => {
    for (const a of REQUIRES_WALT_ACTIONS) expect(classifyAction(a)).toBe("requires-walt");
    expect(classifyAction("delete the vault")).toBe("requires-walt");
    expect(classifyAction("rm -rf /")).toBe("requires-walt");
    expect(classifyAction("deploy to prod")).toBe("requires-walt");
    expect(canSlimAutoApprove("billing changes")).toBe(false);
  });
  test("default-denies unknown actions", () => {
    expect(classifyAction("something-weird")).toBe("requires-walt");
  });
});

describe("Slim Charles identity + tools", () => {
  test("carries the private voice id (Baseline OS only)", () => {
    expect(SLIM_CHARLES.voiceId).toBe("rWyjfFeMZ6PxkHqD3wGC");
  });
  test("exposes the full tool surface", () => {
    const ids = TOOL_SOURCES.map((s) => s.id);
    for (const id of [
      "skills",
      "skills-library",
      "skills-marketplace",
      "mcp",
      "browser-use",
      "hermes",
      "computer-use",
      "maestro",
    ]) {
      expect(ids).toContain(id);
    }
  });
});

describe("Slim Charles page + private org chart routes exist", () => {
  const slim = readFileSync("src/routes/agents.slim-charles.tsx", "utf8");
  const org = readFileSync("src/routes/org-chart.tsx", "utf8");
  test("Slim page renders with all 9 tabs (incl. Phone)", () => {
    expect(slim).toContain('createFileRoute("/agents/slim-charles")');
    expect(slim).toContain("slim-charles-page");
    expect(slim).toContain("slim-tab-${t.id}"); // tab buttons rendered from TABS
    for (const tab of ["chat", "voice", "phone", "build", "tools", "skills", "memory", "computer", "wall"]) {
      expect(slim).toContain(`id: "${tab}"`);
    }
  });
  test("Voice tab is honest (setup-needed, no fake connected, Hermes-backed)", () => {
    expect(slim).toContain("voice-setup-needed");
    expect(slim).toContain("__hermes_chat");
    expect(slim).toContain("useHermesBackend");
  });
  test("Voice tab has the Oracle neural-brain visual + state HUD + tools/history", () => {
    expect(slim).toContain("oracle-brain");
    expect(slim).toContain("voice-states");
    expect(slim).toContain("voice-active-tools");
    expect(slim).toContain("voice-command-history");
    expect(slim).toContain("orbit-node");
    // "show me" / "build me" intent support
    expect(slim).toContain('"show me"');
    expect(slim).toContain('"build me"');
  });
  test("Phone tab is Walt-only + secure + honest setup-needed (provider keys listed)", () => {
    expect(slim).toContain("slim-phone-tab");
    expect(slim).toContain("phone-walt-only");
    expect(slim).toContain("phone-setup-needed");
    expect(slim).toContain("phone-security");
    expect(slim).toContain("__slim_phone_status");
    expect(slim).toContain("phone-provider-${p.id}"); // testid rendered per provider
    // provider-ready architecture: Twilio / ElevenLabs / Retell / VAPI
    for (const p of ["twilio", "elevenlabs", "retell", "vapi"]) {
      expect(slim).toContain(`id: "${p}"`);
    }
  });
  test("private org chart route supports CRUD and can include Slim Charles", () => {
    expect(org).toContain('createFileRoute("/org-chart")');
    expect(org).toContain("org-save");
    expect(org).toContain("org-new");
    expect(org).toContain("window.confirm"); // delete confirmation
    expect(org).toContain("managerId"); // manager relationship
    expect(org).toContain("Slim Charles"); // private chart can include Slim
  });
});
