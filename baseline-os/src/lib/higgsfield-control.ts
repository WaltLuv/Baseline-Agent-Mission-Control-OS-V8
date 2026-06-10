/**
 * Higgsfield Control Center — provider-specific model.
 *
 * Architecture (Walt): Claude Code Studio owns the canonical creative core
 * (assets/render-queue/proof). Higgsfield is a first-class PROVIDER inside that
 * core. This module holds ONLY Higgsfield-provider-specific things: account/CLI
 * status derivation, the 10 control-center tabs, the 4 Higgsfield skills (real,
 * from WaltLuv/higgsfield-supercomputer skills-lock.json), Soul ID, and the
 * approval policy. Assets/jobs/proof live in the shared Studio core
 * (claude-code-studio.ts) — never duplicated here.
 *
 * TRUTH-FIRST: the model catalog + generations come from the live
 * /__higgsfield_* endpoints, not hardcoded guesses. Capability the CLI/API
 * doesn't expose is reported as unsupported_by_cli / setup_required /
 * credentials_missing / not_available — never faked.
 */
import type { Risk } from "./claude-code-studio";

export const HIGGSFIELD_PROVIDER_ID = "higgsfield" as const;
export const HIGGSFIELD_DASHBOARD_URL = "https://higgsfield.ai";
export const HIGGSFIELD_DOCS_URL = "https://higgsfield.ai";

// ── The 10 control-center tabs ──────────────────────────────────────
export type HiggsfieldTabId =
  | "control-center"
  | "create"
  | "generations"
  | "assets"
  | "supercomputer"
  | "skills"
  | "soul-id"
  | "product-photoshoot"
  | "marketplace-cards"
  | "setup";

export interface HiggsfieldTab {
  id: HiggsfieldTabId;
  label: string;
  /** True when this tab reads the SHARED Studio core (not a private store). */
  sharedCore?: boolean;
}

export const HIGGSFIELD_TABS: HiggsfieldTab[] = [
  { id: "control-center", label: "Control Center" },
  { id: "create", label: "Create / Generate" },
  { id: "generations", label: "Generations" },
  { id: "assets", label: "Assets Gallery", sharedCore: true },
  { id: "supercomputer", label: "Supercomputer" },
  { id: "skills", label: "Skills" },
  { id: "soul-id", label: "Soul ID" },
  { id: "product-photoshoot", label: "Product Photoshoot" },
  { id: "marketplace-cards", label: "Marketplace Cards" },
  { id: "setup", label: "Setup / CLI" },
];

// ── Honest provider status ──────────────────────────────────────────
export type HiggsfieldStatus =
  | "ready"
  | "credentials_missing"
  | "setup_required"
  | "unsupported_by_cli"
  | "not_available"
  | "error";

export interface HiggsfieldStatusSignals {
  /** /__higgsfield_status reported the MCP/API reachable. */
  apiReachable?: boolean;
  /** HIGGSFIELD_API_KEY_ID + HIGGSFIELD_API_KEY_SECRET present. */
  credentialsPresent?: boolean;
  /** an account lookup succeeded. */
  accountOk?: boolean;
  error?: boolean;
}

export function deriveHiggsfieldStatus(s: HiggsfieldStatusSignals): HiggsfieldStatus {
  if (s.error) return "error";
  if (!s.credentialsPresent) return "credentials_missing";
  if (!s.apiReachable) return "setup_required";
  if (!s.accountOk) return "setup_required";
  return "ready";
}

export const HIGGSFIELD_STATUS_LABEL: Record<HiggsfieldStatus, string> = {
  ready: "Ready",
  credentials_missing: "Credentials missing",
  setup_required: "Setup required",
  unsupported_by_cli: "Not available via current CLI/API",
  not_available: "Not available",
  error: "Error",
};

export function higgsfieldCanGenerate(status: HiggsfieldStatus): boolean {
  return status === "ready";
}

// ── The 4 Higgsfield skills (real — from skills-lock.json) ──────────
export interface HiggsfieldSkill {
  slug: string;
  name: string;
  description: string;
  inputs: string[];
  outputs: string[];
  requiredCredentials: string[];
  approval: Risk;
  proofExpectation: string;
  /** SHA-256 from the repo skills-lock.json (pinned manifest). */
  sourceHash: string;
  /** GitHub source the skill is pinned to. */
  source: string;
}

export const HIGGSFIELD_REQUIRED_CREDS = ["HIGGSFIELD_API_KEY_ID", "HIGGSFIELD_API_KEY_SECRET"];

export const HIGGSFIELD_SKILLS: HiggsfieldSkill[] = [
  {
    slug: "higgsfield-generate",
    name: "Higgsfield Generate",
    description:
      "Generate images/videos via Higgsfield AI (GPT Image 2, Seedance 2.0, Nano Banana 2/Pro, Soul V2/Cinema, Kling 3.0, Marketing Studio).",
    inputs: ["prompt", "model", "aspect_ratio", "reference_images?", "soul_id?"],
    outputs: ["image asset", "video asset"],
    requiredCredentials: HIGGSFIELD_REQUIRED_CREDS,
    approval: "medium",
    proofExpectation: "generated asset URI + model + prompt stored in the shared asset library",
    sourceHash: "99240f108f2e9de599a39e2ac1f69ba4914c89c17a827594c5e50f4d598689c3",
    source: "higgsfield-ai/skills",
  },
  {
    slug: "higgsfield-soul-id",
    name: "Higgsfield Soul ID",
    description:
      "Train a Soul Character — a personalized identity model on a person's face — for identity-faithful image/video generation. Returns a reference_id.",
    inputs: ["face_photos (consented)", "name"],
    outputs: ["soul reference_id"],
    requiredCredentials: HIGGSFIELD_REQUIRED_CREDS,
    approval: "high", // training a likeness is a HIGH-approval action
    proofExpectation: "soul reference_id + consent record",
    sourceHash: "7cfc9540f5890dac0035f430c820a7db13c14796b2a8d42edb75f373e9e418c1",
    source: "higgsfield-ai/skills",
  },
  {
    slug: "higgsfield-marketplace-cards",
    name: "Higgsfield Marketplace Cards",
    description:
      "Generate marketplace product image cards: compliant main image, secondary product images, and A+ style content modules.",
    inputs: ["product_info", "listing_context", "reference_images?"],
    outputs: ["marketplace card image set"],
    requiredCredentials: HIGGSFIELD_REQUIRED_CREDS,
    approval: "medium",
    proofExpectation: "card asset URIs stored in the shared asset library",
    sourceHash: "dadfdc8d1ab18c68edc1266b699100edf6628eeb494a8a6db62972a4bac5b5be",
    source: "higgsfield-ai/skills",
  },
  {
    slug: "higgsfield-product-photoshoot",
    name: "Higgsfield Product Photoshoot",
    description:
      "Generate brand-quality product images via product-photoshoot prompt enhancement on GPT Image 2 (studio, lifestyle, hero, ad creative).",
    inputs: ["product_image", "style", "scene"],
    outputs: ["product image set"],
    requiredCredentials: HIGGSFIELD_REQUIRED_CREDS,
    approval: "medium",
    proofExpectation: "product image URIs stored in the shared asset library",
    sourceHash: "128d1926c2a70ad1c08e7de17e4b7485a2ada9a02ce3e7cad80053311d619ce7",
    source: "higgsfield-ai/skills",
  },
];

export interface SkillsLock {
  version: number;
  skills: Record<
    string,
    { source: string; sourceType: string; skillPath: string; computedHash: string }
  >;
}

/**
 * Validate the catalog against the repo's skills-lock.json: every catalog skill
 * must be present in the lock with a matching hash. Returns the install/verify
 * status per skill (truth: a skill is "verified" only if its hash matches the
 * pinned manifest).
 */
export function reconcileSkillsLock(
  lock: SkillsLock | null,
): Array<{ slug: string; present: boolean; hashMatch: boolean }> {
  return HIGGSFIELD_SKILLS.map((s) => {
    const entry = lock?.skills?.[s.slug];
    return {
      slug: s.slug,
      present: !!entry,
      hashMatch: !!entry && entry.computedHash === s.sourceHash,
    };
  });
}

// ── Approval policy (Higgsfield-specific, aligns with Studio policy) ─
export const HIGGSFIELD_APPROVAL_POLICY: Record<Risk, string[]> = {
  low: [
    "prompt drafts",
    "gallery browsing",
    "capability list",
    "media metadata",
    "dry-run validation",
  ],
  medium: [
    "draft images",
    "draft videos",
    "product photoshoot drafts",
    "marketplace card drafts",
    "test renders",
  ],
  high: [
    "paid generation above threshold",
    "Soul ID training",
    "client-facing export",
    "real person likeness",
    "final publishing",
  ],
  blocked: [
    "unauthorized likeness/deepfake",
    "copyrighted misuse",
    "exposing private assets",
    "over-budget render",
    "publishing without approval",
  ],
};

// ── Soul ID model ───────────────────────────────────────────────────
export interface SoulId {
  referenceId: string;
  name: string;
  createdAt: number;
  /** consent must be recorded before a likeness model is trained/used. */
  consentRecorded: boolean;
}

/** Training/using a Soul ID is always a HIGH-approval action (real likeness). */
export function soulIdApproval(): Risk {
  return "high";
}
