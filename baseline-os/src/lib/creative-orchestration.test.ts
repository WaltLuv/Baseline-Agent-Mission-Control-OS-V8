/**
 * Creative Agent Orchestration — tests (bun test).
 * Honest agent states, and orchestration writes into the SHARED Studio core
 * (no isolated queue), tagged provider=higgsfield.
 */
import { test, expect, describe } from "bun:test";
import {
  ORCHESTRATION_AGENTS,
  ORCHESTRATION_WORKFLOWS,
  deriveAgentConnState,
  agentIsReady,
  HIGGSFIELD_ORCHESTRATION_SOURCE,
  type OrchestrationAgent,
} from "./creative-orchestration";
import { createOrchestrationJob } from "./claude-code-studio";

function agent(id: string): OrchestrationAgent {
  const a = ORCHESTRATION_AGENTS.find((x) => x.id === id);
  if (!a) throw new Error(`no agent ${id}`);
  return a;
}

describe("Orchestration agents", () => {
  test("includes Gemini (can lead), OpenClaw, Hermes + the full creative roster", () => {
    const ids = ORCHESTRATION_AGENTS.map((a) => a.id);
    for (const id of [
      "gemini",
      "openclaw",
      "hermes",
      "claude-code",
      "codex",
      "oh-my-pi",
      "browser-use",
      "higgsfield",
      "hyperframes",
      "remotion",
      "minimax",
      "heygen",
      "elevenlabs",
    ]) {
      expect(ids, `missing agent ${id}`).toContain(id);
    }
    expect(agent("gemini").canLead).toBe(true);
  });

  test("supporting roster includes OpenClaw and Hermes", () => {
    expect(ORCHESTRATION_AGENTS.some((a) => a.id === "openclaw")).toBe(true);
    expect(ORCHESTRATION_AGENTS.some((a) => a.id === "hermes")).toBe(true);
  });
});

describe("Honest agent connection state — no fake ready", () => {
  test("status-endpoint agent: reachable → connected; probed+down → disconnected; unprobed → unavailable", () => {
    expect(deriveAgentConnState(agent("hermes"), { statusOk: true })).toBe("connected");
    expect(deriveAgentConnState(agent("hermes"), { statusOk: false, probed: true })).toBe(
      "disconnected",
    );
    expect(deriveAgentConnState(agent("hermes"), {})).toBe("unavailable");
  });
  test("cli agent: found → connected; probed+absent → setup_required", () => {
    expect(deriveAgentConnState(agent("claude-code"), { cliFound: true })).toBe("connected");
    expect(deriveAgentConnState(agent("codex"), { cliFound: false, probed: true })).toBe(
      "setup_required",
    );
  });
  test("credential-gated provider with no credential → missing_credentials (never connected)", () => {
    const s = deriveAgentConnState(agent("elevenlabs"), { credentialPresent: false });
    expect(s).toBe("missing_credentials");
    expect(agentIsReady(s)).toBe(false);
  });
  test("nothing confirms readiness → never reports connected", () => {
    for (const a of ORCHESTRATION_AGENTS) {
      const s = deriveAgentConnState(a, {});
      expect(agentIsReady(s)).toBe(false);
    }
  });
});

describe("Orchestration workflows", () => {
  test("includes the named creative sequences", () => {
    const ids = ORCHESTRATION_WORKFLOWS.map((w) => w.id);
    for (const id of [
      "4-shot-product-reveal",
      "soul-id-character-sequence",
      "product-photoshoot",
      "marketplace-card-set",
      "cinematic-broll-pack",
      "social-ad-sequence",
      "thumbnail-exploration",
      "storyboard-to-video-pack",
    ]) {
      expect(ids).toContain(id);
    }
  });
  test("Soul ID sequence is high-approval", () => {
    expect(
      ORCHESTRATION_WORKFLOWS.find((w) => w.id === "soul-id-character-sequence")?.approval,
    ).toBe("high");
  });
});

describe("Orchestrate shoot → shared creative job", () => {
  const base = {
    projectId: "proj-1",
    provider: "higgsfield",
    orchestrationSource: HIGGSFIELD_ORCHESTRATION_SOURCE,
    leadAgent: "gemini",
    supportingAgents: ["openclaw", "hermes"],
    workflow: "4-shot-product-reveal",
    prompt: "A 4-shot product reveal for the new bottle.",
    approval: "medium" as const,
  };

  test("creates a job tagged provider=higgsfield + orchestration source, with assigned agents", () => {
    const job = createOrchestrationJob({ ...base, leadReady: true, approved: true }, 1000);
    expect(job.provider).toBe("higgsfield");
    expect(job.orchestrationSource).toBe("higgsfield_agent_orchestration");
    expect(job.leadAgent).toBe("gemini");
    expect(job.supportingAgents).toEqual(["openclaw", "hermes"]);
    expect(job.workflow).toBe("4-shot-product-reveal");
  });

  test("never starts completed; lead not ready → blocked_setup", () => {
    const blocked = createOrchestrationJob({ ...base, leadReady: false }, 1000);
    expect(blocked.status).toBe("blocked_setup");
    const job = createOrchestrationJob({ ...base, leadReady: true, approved: true }, 1000);
    expect(job.status).not.toBe("completed");
  });

  test("medium/high workflow without approval → awaiting_approval; approved → queued", () => {
    expect(createOrchestrationJob({ ...base, leadReady: true, approved: false }, 1).status).toBe(
      "awaiting_approval",
    );
    expect(createOrchestrationJob({ ...base, leadReady: true, approved: true }, 1).status).toBe(
      "queued",
    );
  });

  test("the job is a standard shared-queue job (visible in Claude Code Studio)", () => {
    // Same RenderJobStatus union as every other creative job → one queue.
    const job = createOrchestrationJob({ ...base, leadReady: true, approved: true }, 1);
    const validStatuses = [
      "queued",
      "running",
      "completed",
      "failed",
      "blocked_setup",
      "awaiting_approval",
    ];
    expect(validStatuses).toContain(job.status);
    expect(job.proofId).toBeNull(); // proof attaches via the shared proof system, not a private one
  });
});
