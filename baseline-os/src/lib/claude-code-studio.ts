/**
 * Claude Code Studio — unified creative operating system domain model.
 *
 * Walt: "Claude Code Studio, NOT MiniMax Studio. MiniMax becomes one provider.
 * Claude Code Studio becomes the unified creative operating system."
 *
 * This is the pure, framework-free core (testable with `bun test`). The route
 * (agents.claude-code.studio.tsx) renders it; the sidecar provides honest
 * runtime/credential probes. TRUTH-FIRST: a provider is never reported "ready"
 * unless its credential + (where applicable) CLI are actually present. Renders
 * never report success unless a real provider call succeeded — unwired
 * providers surface `blocked_setup`, never a fake completed job.
 */

export type Risk = "low" | "medium" | "high" | "blocked";

// ───────────────────────────────────────────────────────────────────
// Video Editing Team — 8 specialized agents
// ───────────────────────────────────────────────────────────────────
export interface StudioPersona {
  slug: string;
  name: string;
  role: string;
  description: string;
  /** Primary providers/tools this persona drives. */
  tools: string[];
}

export const VIDEO_TEAM: StudioPersona[] = [
  {
    slug: "ava-director",
    name: "Ava Director",
    role: "Creative Director",
    description: "Owns concept, visual style, story arc, and final creative judgment.",
    tools: ["script", "storyboard", "brand-kit"],
  },
  {
    slug: "miles-cutter",
    name: "Miles Cutter",
    role: "Video Editor",
    description: "Handles cuts, pacing, transitions, captions, overlays, and timeline assembly.",
    tools: ["remotion", "hyperedit", "captions"],
  },
  {
    slug: "nia-frames",
    name: "Nia Frames",
    role: "HyperFrames Specialist",
    description: "HyperFrames workflows, image-to-video, frame consistency, cinematic motion.",
    tools: ["hyperframes"],
  },
  {
    slug: "theo-motion",
    name: "Theo Motion",
    role: "Remotion Engineer",
    description: "Programmatic video, templates, animated graphics, and render pipelines.",
    tools: ["remotion"],
  },
  {
    slug: "zara-avatar",
    name: "Zara Avatar",
    role: "HeyGen / Avatar Producer",
    description: "Avatar scripts, voice/avatar workflows, presenter and talking-head assets.",
    tools: ["heygen"],
  },
  {
    slug: "leo-sound",
    name: "Leo Sound",
    role: "Voice / Audio Producer",
    description: "Voiceover, ElevenLabs, music beds, SFX, cleanup, and mix notes.",
    tools: ["elevenlabs", "tts"],
  },
  {
    slug: "iris-visuals",
    name: "Iris Visuals",
    role: "Image + B-roll Producer",
    description:
      "Higgsfield, image generation, visual prompts, B-roll lists, thumbnails, references.",
    tools: ["higgsfield", "openai-image", "gemini-image", "fal"],
  },
  {
    slug: "quinn-publish",
    name: "Quinn Publish",
    role: "Distribution + SEO Producer",
    description:
      "YouTube metadata, Shorts cuts, captions, upload checklist, repurposing, publishing.",
    tools: ["youtube", "publish"],
  },
];

// ───────────────────────────────────────────────────────────────────
// Production workflows (the 15 Walt specified)
// ───────────────────────────────────────────────────────────────────
export interface StudioWorkflow {
  slug: string;
  title: string;
  description: string;
  /** Persona slug that owns this workflow. */
  owner: string;
  approval: Risk;
  /** Honest: does the studio have a wired path for this yet? */
  wired: boolean;
  proof: string;
}

export const STUDIO_WORKFLOWS: StudioWorkflow[] = [
  {
    slug: "script-to-storyboard",
    title: "Script → storyboard",
    description: "Turn an approved script into a scene-by-scene storyboard.",
    owner: "ava-director",
    approval: "low",
    wired: true,
    proof: "storyboard.json",
  },
  {
    slug: "storyboard-to-shotlist",
    title: "Storyboard → shot list",
    description: "Break the storyboard into a numbered shot list with framing notes.",
    owner: "ava-director",
    approval: "low",
    wired: true,
    proof: "shotlist.json",
  },
  {
    slug: "shotlist-to-prompts",
    title: "Shot list → visual prompts",
    description: "Generate per-shot image/video prompts (a prompt pack).",
    owner: "iris-visuals",
    approval: "low",
    wired: true,
    proof: "prompt-pack.json",
  },
  {
    slug: "prompts-to-images",
    title: "Visual prompts → generated images",
    description: "Render still frames from the prompt pack via an image provider.",
    owner: "iris-visuals",
    approval: "medium",
    wired: false,
    proof: "image asset URIs",
  },
  {
    slug: "images-to-clips",
    title: "Images → video clips",
    description: "Animate stills into clips (image-to-video) via HyperFrames/Higgsfield/Runway.",
    owner: "nia-frames",
    approval: "medium",
    wired: false,
    proof: "clip asset URIs",
  },
  {
    slug: "clips-to-sequence",
    title: "Raw clips → edited sequence",
    description: "Assemble clips into an edited timeline with pacing + transitions.",
    owner: "miles-cutter",
    approval: "medium",
    wired: false,
    proof: "sequence project file",
  },
  {
    slug: "voiceover-timing",
    title: "Voiceover → timing map",
    description: "Produce a word-level timing map from the voiceover for sync.",
    owner: "leo-sound",
    approval: "low",
    wired: false,
    proof: "timing.json (word timestamps)",
  },
  {
    slug: "captions",
    title: "Captions / subtitles",
    description: "Generate burned-in or sidecar captions from the transcript.",
    owner: "miles-cutter",
    approval: "low",
    wired: false,
    proof: "captions.srt/vtt",
  },
  {
    slug: "thumbnails",
    title: "Thumbnail concepts",
    description: "Generate thumbnail concept options for the video.",
    owner: "iris-visuals",
    approval: "medium",
    wired: false,
    proof: "thumbnail options",
  },
  {
    slug: "shorts-cutdown",
    title: "Shorts cutdown list",
    description: "Identify the best vertical Shorts cutdowns with timecodes.",
    owner: "quinn-publish",
    approval: "low",
    wired: true,
    proof: "shorts-cutdown.json",
  },
  {
    slug: "youtube-metadata",
    title: "YouTube title / description / tags",
    description: "Draft SEO-optimized title, description, and tags.",
    owner: "quinn-publish",
    approval: "medium",
    wired: true,
    proof: "metadata.json",
  },
  {
    slug: "publish-checklist",
    title: "Publish checklist",
    description: "Assemble the pre-publish checklist; publishing itself requires approval.",
    owner: "quinn-publish",
    approval: "high",
    wired: true,
    proof: "publish-checklist.json",
  },
  {
    slug: "remotion-render",
    title: "Remotion template render",
    description: "Render a programmatic Remotion template to MP4.",
    owner: "theo-motion",
    approval: "medium",
    wired: false,
    proof: "rendered MP4 URI",
  },
  {
    slug: "avatar-video",
    title: "Avatar video generation",
    description: "Generate a presenter/avatar video from a script (HeyGen).",
    owner: "zara-avatar",
    approval: "high",
    wired: false,
    proof: "avatar video URI",
  },
  {
    slug: "proof-package",
    title: "Proof package / export manifest",
    description: "Assemble the full proof/export manifest for the project.",
    owner: "ava-director",
    approval: "low",
    wired: true,
    proof: "export-manifest.json",
  },
];

// ───────────────────────────────────────────────────────────────────
// Creative provider matrix
// ───────────────────────────────────────────────────────────────────
export type ProviderKind = "video" | "image" | "audio" | "avatar" | "render" | "publish";

export interface CreativeProvider {
  id: string;
  label: string;
  kind: ProviderKind;
  /** CLI binary to probe via /__runtime_cli_status, if the provider has one. */
  cliBin?: string;
  /** Credential provider id (in the Credentials Manager) gating this provider. */
  credentialId?: string;
  /** Env var that also satisfies the credential (checked via /__env_status). */
  envVar?: string;
  /** Provider-specific status sidecar endpoint, if one exists. */
  statusEndpoint?: string;
  capabilities: string[];
  docsUrl: string;
  /** Whether the studio has a wired generate path for this provider yet. */
  generateWired: boolean;
}

export const CREATIVE_PROVIDERS: CreativeProvider[] = [
  {
    id: "hyperframes",
    label: "HyperFrames",
    kind: "video",
    credentialId: "heygen",
    envVar: "HEYGEN_API_KEY",
    statusEndpoint: "/__hyperframes_projects",
    capabilities: ["image-to-video", "frame-consistency", "cinematic-motion"],
    docsUrl: "https://github.com/heygen-com/hyperframes",
    generateWired: true,
  },
  {
    id: "higgsfield",
    label: "Higgsfield",
    kind: "image",
    envVar: "HIGGSFIELD_API_KEY_ID",
    statusEndpoint: "/__higgsfield_status",
    capabilities: ["image-gen", "cinematic-broll", "style-frames"],
    docsUrl: "https://higgsfield.ai",
    generateWired: true,
  },
  {
    id: "remotion",
    label: "Remotion",
    kind: "render",
    cliBin: "remotion",
    capabilities: ["programmatic-video", "templates", "mp4-render"],
    docsUrl: "https://www.remotion.dev",
    generateWired: false,
  },
  {
    id: "heygen",
    label: "HeyGen",
    kind: "avatar",
    credentialId: "heygen",
    envVar: "HEYGEN_API_KEY",
    statusEndpoint: "/__heygen_avatars",
    capabilities: ["avatar-video", "presenter", "voice-avatar"],
    docsUrl: "https://heygen.com",
    generateWired: true,
  },
  {
    id: "minimax",
    label: "MiniMax",
    kind: "video",
    cliBin: "minimax",
    credentialId: "minimax",
    envVar: "MINIMAX_API_KEY",
    capabilities: ["chat", "tts", "video-gen"],
    docsUrl: "https://www.minimax.io",
    generateWired: false,
  },
  {
    id: "elevenlabs",
    label: "ElevenLabs",
    kind: "audio",
    credentialId: "elevenlabs",
    envVar: "ELEVENLABS_API_KEY",
    statusEndpoint: "/__voice_voices",
    capabilities: ["voiceover", "tts", "voice-cloning"],
    docsUrl: "https://elevenlabs.io",
    generateWired: true,
  },
  {
    id: "openai-image",
    label: "OpenAI (images)",
    kind: "image",
    credentialId: "openai",
    envVar: "OPENAI_API_KEY",
    capabilities: ["image-gen", "gpt-image"],
    docsUrl: "https://platform.openai.com",
    generateWired: false,
  },
  {
    id: "gemini-image",
    label: "Gemini (image/video)",
    kind: "image",
    credentialId: "google",
    envVar: "GEMINI_API_KEY",
    capabilities: ["image-gen", "video-gen"],
    docsUrl: "https://ai.google.dev",
    generateWired: false,
  },
  {
    id: "pika",
    label: "Pika",
    kind: "video",
    envVar: "PIKA_API_KEY",
    capabilities: ["text-to-video", "image-to-video"],
    docsUrl: "https://pika.art",
    generateWired: false,
  },
  {
    id: "runway",
    label: "Runway",
    kind: "video",
    envVar: "RUNWAY_API_KEY",
    capabilities: ["text-to-video", "image-to-video", "gen-3"],
    docsUrl: "https://runwayml.com",
    generateWired: false,
  },
];

// ───────────────────────────────────────────────────────────────────
// Honest provider state machine
// ───────────────────────────────────────────────────────────────────
export type ProviderState =
  | "ready" // credential present (+ CLI if required) and generate path wired
  | "connected" // credential present but generate path not wired in-studio yet
  | "missing_credentials"
  | "cli_missing"
  | "setup_required"
  | "error"
  | "unsupported"; // capability not available through the current CLI/API

export interface ProviderSignals {
  /** Credential saved in the Credentials Manager. */
  credentialPresent?: boolean;
  /** Env var present (alternative to a saved credential). */
  envPresent?: boolean;
  /** CLI binary found on PATH (only relevant when provider.cliBin set). */
  cliFound?: boolean;
  /** Probe errored. */
  error?: boolean;
}

/**
 * Derive an honest provider state. Never returns "ready"/"connected" without a
 * real credential signal. A provider that requires a CLI but whose CLI is
 * missing is "cli_missing" even if the credential exists.
 */
export function deriveProviderState(provider: CreativeProvider, s: ProviderSignals): ProviderState {
  if (s.error) return "error";
  const hasCred = !!(s.credentialPresent || s.envPresent);
  if (provider.cliBin) {
    if (!s.cliFound) return "cli_missing";
  }
  if (!hasCred) return provider.cliBin && s.cliFound ? "missing_credentials" : "setup_required";
  // Credential (and CLI if needed) present.
  return provider.generateWired ? "ready" : "connected";
}

export const PROVIDER_STATE_LABEL: Record<ProviderState, string> = {
  ready: "Ready",
  connected: "Connected (generate not wired)",
  missing_credentials: "Missing credentials",
  cli_missing: "CLI missing",
  setup_required: "Setup required",
  error: "Error",
  unsupported: "Not available via current CLI/API",
};

/** A state is actionable for generation only when truly ready. */
export function canGenerate(state: ProviderState): boolean {
  return state === "ready";
}

// ───────────────────────────────────────────────────────────────────
// Approval policy
// ───────────────────────────────────────────────────────────────────
export const STUDIO_APPROVAL_POLICY: Record<Risk, string[]> = {
  low: [
    "script drafts",
    "storyboard drafts",
    "prompt packs",
    "shot lists",
    "B-roll keywords",
    "metadata drafts",
    "timing maps",
  ],
  medium: [
    "generated still images",
    "draft B-roll",
    "test renders",
    "thumbnail concepts",
    "edited draft sequence",
    "voiceover draft",
  ],
  high: [
    "publishing to YouTube",
    "sending to client",
    "paid render over budget",
    "using a real person's likeness/avatar",
    "final export marked approved",
    "ads / paid distribution",
  ],
  blocked: [
    "deepfake without consent",
    "copyrighted material misuse",
    "impersonation",
    "exposing private client assets",
    "publishing without approval",
    "spending credits over the configured limit",
    "using someone's likeness without authorization",
  ],
};

export interface ApprovalDecision {
  risk: Risk;
  /** True when the action may proceed without human approval. */
  autoOk: boolean;
  /** True when the action is hard-blocked regardless of approval. */
  blocked: boolean;
  reason: string;
}

export function evaluateApproval(risk: Risk, opts?: { approved?: boolean }): ApprovalDecision {
  if (risk === "blocked")
    return {
      risk,
      autoOk: false,
      blocked: true,
      reason: "Action is policy-blocked and cannot run.",
    };
  if (risk === "low")
    return {
      risk,
      autoOk: true,
      blocked: false,
      reason: "Low-risk action — proceeds automatically.",
    };
  // medium / high require approval
  return {
    risk,
    autoOk: false,
    blocked: false,
    reason: opts?.approved ? "Approved by operator." : `Requires operator approval (${risk}).`,
  };
}

// ───────────────────────────────────────────────────────────────────
// Render queue (honest — no fake completion)
// ───────────────────────────────────────────────────────────────────
export type RenderJobStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "blocked_setup"
  | "awaiting_approval";

export interface RenderJob {
  id: string;
  workflowSlug: string;
  providerId: string;
  status: RenderJobStatus;
  createdAt: number;
  /** Set only when a real provider call returns an artifact. */
  outputUri?: string | null;
  error?: string | null;
}

/**
 * Decide the initial status for a queued job given provider state + approval.
 * A job NEVER starts "completed". If the provider isn't ready it is
 * `blocked_setup`; if the workflow needs approval it is `awaiting_approval`.
 */
export function initialJobStatus(
  providerState: ProviderState,
  approval: ApprovalDecision,
): RenderJobStatus {
  if (approval.blocked) return "failed";
  if (!canGenerate(providerState)) return "blocked_setup";
  if (!approval.autoOk && !(/* approved */ approval.reason.startsWith("Approved")))
    return "awaiting_approval";
  return "queued";
}

// ───────────────────────────────────────────────────────────────────
// Proof / export manifest
// ───────────────────────────────────────────────────────────────────
export interface StudioProject {
  id: string;
  title: string;
  brief?: string;
  script?: string;
  createdAt: number;
}

export interface ProofManifestEntry {
  workflowSlug: string;
  owner: string;
  approval: Risk;
  status: RenderJobStatus | "not_started";
  proof: string;
  outputUri?: string | null;
}

export interface ProofManifest {
  version: 1;
  project: { id: string; title: string };
  generatedAt: number;
  entries: ProofManifestEntry[];
  providers: Array<{ id: string; state: ProviderState }>;
  approvalSummary: Record<Risk, string[]>;
}

/**
 * Build the proof/export manifest for a project from its jobs + provider states.
 * This is the deterministic structure exported as export-manifest.json.
 */
export function buildProofManifest(
  project: StudioProject,
  jobs: RenderJob[],
  providerStates: Record<string, ProviderState>,
  now: number,
): ProofManifest {
  const jobByWorkflow = new Map<string, RenderJob>();
  for (const j of jobs) jobByWorkflow.set(j.workflowSlug, j);
  const entries: ProofManifestEntry[] = STUDIO_WORKFLOWS.map((wf) => {
    const job = jobByWorkflow.get(wf.slug);
    return {
      workflowSlug: wf.slug,
      owner: wf.owner,
      approval: wf.approval,
      status: job?.status ?? "not_started",
      proof: wf.proof,
      outputUri: job?.outputUri ?? null,
    };
  });
  return {
    version: 1,
    project: { id: project.id, title: project.title },
    generatedAt: now,
    entries,
    providers: CREATIVE_PROVIDERS.map((p) => ({
      id: p.id,
      state: providerStates[p.id] ?? "setup_required",
    })),
    approvalSummary: STUDIO_APPROVAL_POLICY,
  };
}

// ───────────────────────────────────────────────────────────────────
// Shared creative asset library (CANONICAL — owned by Claude Code Studio).
//
// Walt's architecture: Studio owns ONE provider-agnostic asset library, render
// queue, and proof system. Higgsfield (and every other provider) reads/writes
// this same core — no duplicate libraries. Assets are sourced from the local
// studio history (~/.claude-os/studio/<provider>-*) via the /__studio_history
// sidecar; this module normalizes them into a single shape and filters by
// provider for the Higgsfield-only view.
// ───────────────────────────────────────────────────────────────────
export type AssetKind = "image" | "video" | "audio";

export interface CreativeAsset {
  id: string;
  provider: string; // provider id (e.g. 'higgsfield', 'gemini-image')
  kind: AssetKind;
  url: string | null;
  thumbUrl: string | null;
  prompt: string | null;
  model: string | null;
  createdAt: number;
  proofHash: string | null;
  projectId: string | null;
}

interface RawStudioRecord {
  id?: string | number;
  provider?: string;
  kind?: string;
  type?: string;
  url?: string;
  output_url?: string;
  outputUri?: string;
  thumb?: string;
  thumbnail?: string;
  prompt?: string;
  model?: string;
  created_at?: number;
  createdAt?: number;
  ts?: number;
  proof_hash?: string;
  hash?: string;
  project_id?: string;
}

function coerceKind(v: unknown): AssetKind {
  const s = String(v ?? "").toLowerCase();
  if (s.includes("video") || s.includes("mp4") || s.includes("mov")) return "video";
  if (s.includes("audio") || s.includes("mp3") || s.includes("wav") || s.includes("tts"))
    return "audio";
  return "image";
}

/**
 * Normalize raw studio-history records (any provider) into the shared
 * CreativeAsset shape. Never fabricates: a record with no usable URL is still
 * surfaced (so the gallery can show an honest "no preview" state) but the URL
 * stays null rather than being invented.
 */
export function normalizeStudioHistory(raw: unknown, fallbackProvider?: string): CreativeAsset[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((r0, i): CreativeAsset => {
    const r = (r0 ?? {}) as RawStudioRecord;
    const url = r.url ?? r.output_url ?? r.outputUri ?? null;
    return {
      id: String(r.id ?? `asset-${i}`),
      provider: r.provider ?? fallbackProvider ?? "unknown",
      kind: coerceKind(r.kind ?? r.type ?? url ?? ""),
      url,
      thumbUrl: r.thumb ?? r.thumbnail ?? null,
      prompt: r.prompt ?? null,
      model: r.model ?? null,
      createdAt: Number(r.created_at ?? r.createdAt ?? r.ts ?? 0),
      proofHash: r.proof_hash ?? r.hash ?? null,
      projectId: r.project_id ?? null,
    };
  });
}

/** Filter the shared library down to one provider (the Higgsfield-only view). */
export function filterAssetsByProvider(assets: CreativeAsset[], provider: string): CreativeAsset[] {
  return assets.filter((a) => a.provider === provider);
}

/** Provider-agnostic counts for the Studio gallery header. */
export function assetCountsByProvider(assets: CreativeAsset[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const a of assets) out[a.provider] = (out[a.provider] ?? 0) + 1;
  return out;
}

// ───────────────────────────────────────────────────────────────────
// Orchestration jobs (SHARED — owned by the canonical Studio core).
//
// The Higgsfield "Agent Orchestration" panel creates these. They live in the
// SAME render queue/proof system as every other creative job — there is no
// separate Higgsfield queue. Each job is tagged with its provider and its
// orchestration source so both the Higgsfield control center and Claude Code
// Studio can show/filter it.
// ───────────────────────────────────────────────────────────────────
export interface CreativeJob {
  id: string;
  projectId: string;
  provider: string; // e.g. 'higgsfield'
  orchestrationSource: string | null; // e.g. 'higgsfield_agent_orchestration'
  leadAgent: string;
  supportingAgents: string[];
  workflow: string; // e.g. '4-shot-product-reveal'
  prompt: string;
  approval: Risk;
  status: RenderJobStatus;
  createdAt: number;
  proofId: string | null;
}

export interface OrchestrationInput {
  projectId: string;
  provider: string;
  orchestrationSource: string;
  leadAgent: string;
  supportingAgents: string[];
  workflow: string;
  prompt: string;
  approval: Risk;
  /** Whether the lead agent's runtime/credential is actually connected. */
  leadReady: boolean;
  approved?: boolean;
}

/**
 * Create a shared orchestration job. Honest status: a job NEVER starts
 * "completed"; if the lead agent isn't connected it's `blocked_setup`; a
 * medium/high workflow without approval is `awaiting_approval`; a blocked
 * policy is `failed`. The returned job is meant to be appended to the shared
 * render queue so it is visible in both Higgsfield and Claude Code Studio.
 */
export function createOrchestrationJob(input: OrchestrationInput, now: number): CreativeJob {
  const decision = evaluateApproval(input.approval, { approved: input.approved });
  let status: RenderJobStatus;
  if (decision.blocked) status = "failed";
  else if (!input.leadReady) status = "blocked_setup";
  else if (!decision.autoOk && !input.approved) status = "awaiting_approval";
  else status = "queued";
  return {
    id: `orch-${input.workflow}-${now}`,
    projectId: input.projectId,
    provider: input.provider,
    orchestrationSource: input.orchestrationSource,
    leadAgent: input.leadAgent,
    supportingAgents: [...input.supportingAgents],
    workflow: input.workflow,
    prompt: input.prompt,
    approval: input.approval,
    status,
    createdAt: now,
    proofId: null,
  };
}
