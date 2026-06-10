/**
 * Claude Code Studio — domain model tests (bun test).
 * Covers Walt's required checks at the data/logic layer; the route render +
 * matrix render are verified live against the dev server.
 */
import { test, expect, describe } from "bun:test";
import {
  VIDEO_TEAM,
  STUDIO_WORKFLOWS,
  CREATIVE_PROVIDERS,
  STUDIO_APPROVAL_POLICY,
  deriveProviderState,
  canGenerate,
  evaluateApproval,
  initialJobStatus,
  buildProofManifest,
  type CreativeProvider,
  type RenderJob,
  type ProviderState,
} from "./claude-code-studio";

function provider(id: string): CreativeProvider {
  const p = CREATIVE_PROVIDERS.find((x) => x.id === id);
  if (!p) throw new Error(`no provider ${id}`);
  return p;
}

describe("Video Editing Team", () => {
  test("exactly 8 specialized video personas exist", () => {
    expect(VIDEO_TEAM.length).toBe(8);
    const roles = VIDEO_TEAM.map((p) => p.role);
    expect(roles).toContain("Creative Director");
    expect(roles).toContain("HyperFrames Specialist");
    expect(roles).toContain("Remotion Engineer");
    expect(roles).toContain("HeyGen / Avatar Producer");
    expect(roles).toContain("Distribution + SEO Producer");
  });
  test("every persona has a unique slug + tools", () => {
    const slugs = new Set(VIDEO_TEAM.map((p) => p.slug));
    expect(slugs.size).toBe(VIDEO_TEAM.length);
    for (const p of VIDEO_TEAM) expect(p.tools.length).toBeGreaterThan(0);
  });
});

describe("Workflows", () => {
  test("15 production workflows, each owned by a real persona", () => {
    expect(STUDIO_WORKFLOWS.length).toBe(15);
    const personaSlugs = new Set(VIDEO_TEAM.map((p) => p.slug));
    for (const wf of STUDIO_WORKFLOWS) {
      expect(personaSlugs.has(wf.owner), `${wf.slug} owner ${wf.owner} not a persona`).toBe(true);
      expect(["low", "medium", "high", "blocked"]).toContain(wf.approval);
      expect(wf.proof.length).toBeGreaterThan(0);
    }
  });
});

describe("Creative provider matrix", () => {
  test("MiniMax remains as a provider (not the whole studio)", () => {
    const mm = CREATIVE_PROVIDERS.find((p) => p.id === "minimax");
    expect(mm).toBeDefined();
    expect(mm!.label).toBe("MiniMax");
  });
  test("Remotion, HyperFrames, Higgsfield, HeyGen, ElevenLabs, Pika, Runway, OpenAI, Gemini all present", () => {
    const ids = CREATIVE_PROVIDERS.map((p) => p.id);
    for (const id of [
      "remotion",
      "hyperframes",
      "higgsfield",
      "heygen",
      "elevenlabs",
      "pika",
      "runway",
      "openai-image",
      "gemini-image",
      "minimax",
    ]) {
      expect(ids, `missing provider ${id}`).toContain(id);
    }
  });
});

describe("Honest provider state — never fake ready", () => {
  test("HyperFrames with no credential → setup_required (not ready)", () => {
    const s = deriveProviderState(provider("hyperframes"), {});
    expect(s).toBe("setup_required");
    expect(canGenerate(s)).toBe(false);
  });
  test("missing credentials never yields ready/connected", () => {
    for (const p of CREATIVE_PROVIDERS) {
      const s = deriveProviderState(p, {
        credentialPresent: false,
        envPresent: false,
        cliFound: !!p.cliBin,
      });
      expect(["ready", "connected"]).not.toContain(s);
    }
  });
  test("CLI-required provider with credential but missing CLI → cli_missing", () => {
    // minimax has cliBin 'minimax'
    const s = deriveProviderState(provider("minimax"), {
      credentialPresent: true,
      cliFound: false,
    });
    expect(s).toBe("cli_missing");
    expect(canGenerate(s)).toBe(false);
  });
  test("credential present + wired generate → ready; present + not wired → connected", () => {
    // higgsfield: no cliBin, generateWired true
    expect(deriveProviderState(provider("higgsfield"), { credentialPresent: true })).toBe("ready");
    // openai-image: no cliBin, generateWired false
    expect(deriveProviderState(provider("openai-image"), { credentialPresent: true })).toBe(
      "connected",
    );
  });
  test("probe error → error", () => {
    expect(deriveProviderState(provider("higgsfield"), { error: true })).toBe("error");
  });
});

describe("Approval policy", () => {
  test("policy defines all four tiers with entries", () => {
    for (const tier of ["low", "medium", "high", "blocked"] as const) {
      expect(STUDIO_APPROVAL_POLICY[tier].length).toBeGreaterThan(0);
    }
    expect(STUDIO_APPROVAL_POLICY.blocked.some((x) => /deepfake|consent|likeness/i.test(x))).toBe(
      true,
    );
  });
  test("low auto-ok, blocked hard-blocked, high needs approval", () => {
    expect(evaluateApproval("low").autoOk).toBe(true);
    expect(evaluateApproval("blocked").blocked).toBe(true);
    expect(evaluateApproval("high").autoOk).toBe(false);
    expect(evaluateApproval("high", { approved: true }).reason).toMatch(/approved/i);
  });
});

describe("Render queue — no fake render success", () => {
  test("a job never initializes as completed", () => {
    const states: ProviderState[] = [
      "ready",
      "connected",
      "missing_credentials",
      "cli_missing",
      "setup_required",
      "error",
    ];
    for (const ps of states) {
      for (const risk of ["low", "medium", "high", "blocked"] as const) {
        const status = initialJobStatus(ps, evaluateApproval(risk));
        expect(status).not.toBe("completed");
      }
    }
  });
  test("not-ready provider → blocked_setup", () => {
    expect(initialJobStatus("setup_required", evaluateApproval("low"))).toBe("blocked_setup");
    expect(initialJobStatus("cli_missing", evaluateApproval("low"))).toBe("blocked_setup");
  });
  test("ready + low → queued; ready + high(unapproved) → awaiting_approval; blocked → failed", () => {
    expect(initialJobStatus("ready", evaluateApproval("low"))).toBe("queued");
    expect(initialJobStatus("ready", evaluateApproval("high"))).toBe("awaiting_approval");
    expect(initialJobStatus("ready", evaluateApproval("high", { approved: true }))).toBe("queued");
    expect(initialJobStatus("ready", evaluateApproval("blocked"))).toBe("failed");
  });
});

describe("Proof / export manifest", () => {
  test("manifest has an entry per workflow + provider states + approval summary", () => {
    const jobs: RenderJob[] = [
      {
        id: "j1",
        workflowSlug: "script-to-storyboard",
        providerId: "higgsfield",
        status: "completed",
        createdAt: 1,
        outputUri: "file://storyboard.json",
      },
    ];
    const providerStates: Record<string, ProviderState> = { higgsfield: "ready" };
    const m = buildProofManifest(
      { id: "p1", title: "Demo", createdAt: 1 },
      jobs,
      providerStates,
      1000,
    );
    expect(m.version).toBe(1);
    expect(m.entries.length).toBe(STUDIO_WORKFLOWS.length);
    const done = m.entries.find((e) => e.workflowSlug === "script-to-storyboard")!;
    expect(done.status).toBe("completed");
    expect(done.outputUri).toBe("file://storyboard.json");
    // workflows with no job are honestly "not_started"
    const notStarted = m.entries.find((e) => e.workflowSlug === "avatar-video")!;
    expect(notStarted.status).toBe("not_started");
    expect(m.providers.length).toBe(CREATIVE_PROVIDERS.length);
    expect(m.approvalSummary.blocked.length).toBeGreaterThan(0);
  });
});
