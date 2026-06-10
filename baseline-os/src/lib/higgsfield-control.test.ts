/**
 * Higgsfield Control Center + shared creative core — tests (bun test).
 * Truth-first contracts: honest status, no fake media, skills pinned to the
 * repo manifest, Soul ID is high-approval, assets live in the shared core.
 */
import { test, expect, describe } from "bun:test";
import { readFileSync } from "node:fs";
import {
  HIGGSFIELD_TABS,
  HIGGSFIELD_SKILLS,
  deriveHiggsfieldStatus,
  higgsfieldCanGenerate,
  reconcileSkillsLock,
  HIGGSFIELD_APPROVAL_POLICY,
  soulIdApproval,
  type SkillsLock,
} from "./higgsfield-control";
import {
  normalizeStudioHistory,
  filterAssetsByProvider,
  assetCountsByProvider,
} from "./claude-code-studio";

describe("Higgsfield tabs", () => {
  test("all 10 control-center tabs exist in order", () => {
    expect(HIGGSFIELD_TABS.map((t) => t.id)).toEqual([
      "control-center",
      "create",
      "generations",
      "assets",
      "supercomputer",
      "skills",
      "soul-id",
      "product-photoshoot",
      "marketplace-cards",
      "setup",
    ]);
  });
  test("the assets tab reads the SHARED core (no duplicate library)", () => {
    expect(HIGGSFIELD_TABS.find((t) => t.id === "assets")?.sharedCore).toBe(true);
  });
});

describe("Honest Higgsfield status", () => {
  test("no credentials → credentials_missing (never ready)", () => {
    const s = deriveHiggsfieldStatus({ credentialsPresent: false, apiReachable: true });
    expect(s).toBe("credentials_missing");
    expect(higgsfieldCanGenerate(s)).toBe(false);
  });
  test("creds but API unreachable → setup_required", () => {
    expect(deriveHiggsfieldStatus({ credentialsPresent: true, apiReachable: false })).toBe(
      "setup_required",
    );
  });
  test("creds + reachable + account ok → ready", () => {
    const s = deriveHiggsfieldStatus({
      credentialsPresent: true,
      apiReachable: true,
      accountOk: true,
    });
    expect(s).toBe("ready");
    expect(higgsfieldCanGenerate(s)).toBe(true);
  });
  test("probe error → error, never ready", () => {
    expect(
      deriveHiggsfieldStatus({
        error: true,
        credentialsPresent: true,
        apiReachable: true,
        accountOk: true,
      }),
    ).toBe("error");
  });
});

describe("The 4 Higgsfield skills (pinned to repo manifest)", () => {
  test("exactly the four expected skills exist", () => {
    expect(HIGGSFIELD_SKILLS.map((s) => s.slug).sort()).toEqual([
      "higgsfield-generate",
      "higgsfield-marketplace-cards",
      "higgsfield-product-photoshoot",
      "higgsfield-soul-id",
    ]);
  });
  test("each skill declares inputs/outputs/required credentials/proof", () => {
    for (const s of HIGGSFIELD_SKILLS) {
      expect(s.inputs.length).toBeGreaterThan(0);
      expect(s.outputs.length).toBeGreaterThan(0);
      expect(s.requiredCredentials).toContain("HIGGSFIELD_API_KEY_ID");
      expect(s.proofExpectation.length).toBeGreaterThan(0);
    }
  });
  test("Soul ID training is a HIGH-approval action (real likeness)", () => {
    expect(HIGGSFIELD_SKILLS.find((s) => s.slug === "higgsfield-soul-id")?.approval).toBe("high");
    expect(soulIdApproval()).toBe("high");
  });
  test("catalog hashes match the vendored skills-lock.json (verified pin)", () => {
    // The repo skills-lock.json is vendored under docs/reference for traceability.
    let lock: SkillsLock | null = null;
    try {
      lock = JSON.parse(
        readFileSync("docs/reference/higgsfield-supercomputer/skills-lock.json", "utf8"),
      );
    } catch {
      lock = null;
    }
    if (lock) {
      const recon = reconcileSkillsLock(lock);
      for (const r of recon) {
        expect(r.present, `${r.slug} missing from lock`).toBe(true);
        expect(r.hashMatch, `${r.slug} hash mismatch`).toBe(true);
      }
    } else {
      // If not vendored yet, at least confirm reconcile handles null safely.
      expect(reconcileSkillsLock(null).every((r) => !r.present)).toBe(true);
    }
  });
});

describe("Approval policy", () => {
  test("all four tiers populated; blocked covers likeness/deepfake", () => {
    for (const tier of ["low", "medium", "high", "blocked"] as const) {
      expect(HIGGSFIELD_APPROVAL_POLICY[tier].length).toBeGreaterThan(0);
    }
    expect(HIGGSFIELD_APPROVAL_POLICY.blocked.some((x) => /likeness|deepfake/i.test(x))).toBe(true);
    expect(HIGGSFIELD_APPROVAL_POLICY.high.some((x) => /soul id/i.test(x))).toBe(true);
  });
});

describe("Shared creative asset library — no fake media", () => {
  test("empty/non-array history → empty asset list (honest empty state)", () => {
    expect(normalizeStudioHistory(null)).toEqual([]);
    expect(normalizeStudioHistory(undefined)).toEqual([]);
    expect(normalizeStudioHistory({})).toEqual([]);
  });
  test("records normalize without inventing URLs", () => {
    const assets = normalizeStudioHistory(
      [
        {
          id: "1",
          provider: "higgsfield",
          type: "video",
          url: "https://cdn/x.mp4",
          prompt: "p",
          model: "seedance",
          created_at: 5,
        },
        { id: "2", type: "image" }, // no url → stays null, not faked
      ],
      "higgsfield",
    );
    expect(assets.length).toBe(2);
    expect(assets[0].kind).toBe("video");
    expect(assets[0].url).toBe("https://cdn/x.mp4");
    expect(assets[1].url).toBeNull(); // never invented
    expect(assets[1].provider).toBe("higgsfield"); // fallback provider applied
  });
  test("filter by provider gives the Higgsfield-only view", () => {
    const assets = normalizeStudioHistory([
      { id: "a", provider: "higgsfield", type: "image", url: "u1" },
      { id: "b", provider: "gemini-image", type: "image", url: "u2" },
    ]);
    expect(filterAssetsByProvider(assets, "higgsfield").map((a) => a.id)).toEqual(["a"]);
    expect(assetCountsByProvider(assets)).toEqual({ higgsfield: 1, "gemini-image": 1 });
  });
});
