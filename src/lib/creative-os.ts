/**
 * Creative OS — the engine that turns Video Studio + HyperEdit into one unified
 * creative operating system (Google Flow + Higgsfield + HeyGen + HyperFrames +
 * NotebookLM + Claude Code Studio).
 *
 * Pure, deterministic data + helpers shared by Baseline OS and Mission Control:
 *   - SOURCE_ACTIONS      — NotebookLM-style "do this with my sources"
 *   - CREATIVE_PIPELINES  — Higgsfield-style reusable pipelines (pre-built stages,
 *                           storyboard structure, provider chain, proof reqs)
 *   - PROVIDER_ORCHESTRATION — intent → provider + handoff + proof chain
 *
 * Additive only. No live generation here — providers stay honest setup-needed
 * until their credential is connected.
 */

// ── NotebookLM-style source actions ─────────────────────────────────
export interface SourceAction {
  id: string;
  label: string;
  /** Prompt template; `{src}` is replaced with the source/selection name. */
  prompt: string;
  stage: string;
}

export const SOURCE_ACTIONS: SourceAction[] = [
  {
    id: "chat",
    label: "Chat with sources",
    prompt: "Answer questions using only {src} as grounding.",
    stage: "Analysis",
  },
  {
    id: "summarize",
    label: "Summarize",
    prompt: "Summarize {src} into key points usable for a video script.",
    stage: "Analysis",
  },
  {
    id: "storyboard",
    label: "Storyboard",
    prompt: "Build a numbered storyboard (visual + on-screen text + duration) from {src}.",
    stage: "Storyboard",
  },
  {
    id: "scene-plan",
    label: "Scene plan",
    prompt: "Generate a scene plan (shot descriptions + transitions) from {src}.",
    stage: "Scenes",
  },
  {
    id: "voiceover",
    label: "Voiceover",
    prompt: "Write a timed, conversational voiceover script from {src}.",
    stage: "Scenes",
  },
  {
    id: "shot-list",
    label: "Shot list",
    prompt: "Produce a shot list (angle, duration, asset) from {src}.",
    stage: "Scenes",
  },
];

// ── Higgsfield-style reusable pipelines ─────────────────────────────
export interface CreativePipeline {
  id: string;
  name: string;
  description: string;
  /** Pre-built ordered stages. */
  stages: string[];
  /** Provider chain the orchestrator hands off across. */
  providerChain: string[];
  /** Storyboard scaffold (beat names) the pipeline pre-fills. */
  storyboard: string[];
  /** What a finished run must produce as proof. */
  proofRequirements: string[];
}

export const CREATIVE_PIPELINES: CreativePipeline[] = [
  {
    id: "product-commercial",
    name: "Product Commercial",
    description: "30–60s product hero spot.",
    stages: ["Brief", "Storyboard", "Scenes", "Render", "Music", "Proof", "Export"],
    providerChain: ["gemini", "higgsfield", "elevenlabs", "hyperframes"],
    storyboard: ["Hook", "Problem", "Product reveal", "Benefits", "CTA"],
    proofRequirements: ["storyboard", "rendered cuts", "final mp4", "captions"],
  },
  {
    id: "youtube-documentary",
    name: "YouTube Documentary",
    description: "Long-form narrated documentary.",
    stages: ["Research", "Outline", "Script", "Storyboard", "Scenes", "VO", "Render", "Proof"],
    providerChain: ["gemini", "elevenlabs", "higgsfield", "hyperframes"],
    storyboard: ["Cold open", "Context", "Act 1", "Act 2", "Act 3", "Resolution"],
    proofRequirements: ["research sources", "script", "voiceover", "final cut"],
  },
  {
    id: "youtube-shorts",
    name: "YouTube Shorts",
    description: "Vertical <60s hook-driven short.",
    stages: ["Hook", "Storyboard", "Render", "Captions", "Export"],
    providerChain: ["gemini", "higgsfield", "hyperframes"],
    storyboard: ["Hook (0-3s)", "Payoff", "Loop/CTA"],
    proofRequirements: ["vertical mp4", "captions", "thumbnail"],
  },
  {
    id: "talking-head",
    name: "Talking Head",
    description: "Avatar presenter video.",
    stages: ["Script", "Avatar", "Voice", "Render", "Proof"],
    providerChain: ["gemini", "heygen", "elevenlabs"],
    storyboard: ["Intro", "Main points", "Outro"],
    proofRequirements: ["script", "avatar render", "final mp4"],
  },
  {
    id: "ai-influencer",
    name: "AI Influencer",
    description: "Consistent AI persona content.",
    stages: ["Persona", "Storyboard", "Generate", "Render", "Proof"],
    providerChain: ["higgsfield", "heygen", "elevenlabs"],
    storyboard: ["Persona beat", "Scene", "CTA"],
    proofRequirements: ["persona id", "scene renders", "final cut"],
  },
  {
    id: "ugc-ad",
    name: "UGC Ad",
    description: "Authentic user-style ad.",
    stages: ["Brief", "Script", "Avatar", "Render", "Proof"],
    providerChain: ["gemini", "heygen", "hyperframes"],
    storyboard: ["Hook", "Demo", "Social proof", "CTA"],
    proofRequirements: ["script", "ugc render", "captions"],
  },
  {
    id: "testimonial",
    name: "Testimonial",
    description: "Customer testimonial spot.",
    stages: ["Intake", "Script", "Avatar", "Render", "Proof"],
    providerChain: ["gemini", "heygen", "elevenlabs"],
    storyboard: ["Problem", "Solution", "Result", "Recommendation"],
    proofRequirements: ["transcript", "render", "final mp4"],
  },
  {
    id: "listing-video",
    name: "Listing Video",
    description: "Property listing highlight.",
    stages: ["Assets", "Storyboard", "Render", "VO", "Proof"],
    providerChain: ["higgsfield", "elevenlabs", "hyperframes"],
    storyboard: ["Exterior", "Interior", "Features", "Call to action"],
    proofRequirements: ["asset list", "render", "voiceover"],
  },
  {
    id: "real-estate-walkthrough",
    name: "Real Estate Walkthrough",
    description: "Guided property walkthrough.",
    stages: ["Footage", "Map", "VO", "Render", "Proof"],
    providerChain: ["higgsfield", "elevenlabs", "hyperframes"],
    storyboard: ["Approach", "Room-by-room", "Highlights", "Close"],
    proofRequirements: ["walkthrough cut", "voiceover", "captions"],
  },
  {
    id: "social-campaign",
    name: "Social Media Campaign",
    description: "Multi-cut campaign set.",
    stages: ["Brief", "Calendar", "Storyboard", "Render", "Proof", "Export"],
    providerChain: ["gemini", "higgsfield", "hyperframes"],
    storyboard: ["Teaser", "Reveal", "Engage", "CTA"],
    proofRequirements: ["content calendar", "cuts per channel", "captions"],
  },
];

export function getPipeline(id: string): CreativePipeline | undefined {
  return CREATIVE_PIPELINES.find((p) => p.id === id);
}

// ── Provider orchestration layer ────────────────────────────────────
export type CreativeIntent = "script" | "image" | "video" | "avatar" | "voice" | "music" | "render";

export interface ProviderRoute {
  intent: CreativeIntent;
  /** Preferred provider for this intent. */
  provider: string;
  /** Fallbacks in order. */
  fallbacks: string[];
  /** What gets handed to the next stage. */
  handoff: string;
}

export const PROVIDER_ORCHESTRATION: ProviderRoute[] = [
  { intent: "script", provider: "gemini", fallbacks: ["openai"], handoff: "script → storyboard" },
  {
    intent: "image",
    provider: "higgsfield",
    fallbacks: ["gemini", "openai"],
    handoff: "images → scene assets",
  },
  {
    intent: "video",
    provider: "higgsfield",
    fallbacks: ["runway", "pika"],
    handoff: "clips → timeline",
  },
  { intent: "avatar", provider: "heygen", fallbacks: [], handoff: "avatar take → timeline" },
  {
    intent: "voice",
    provider: "elevenlabs",
    fallbacks: ["minimax", "openai"],
    handoff: "voiceover → timeline",
  },
  { intent: "music", provider: "minimax", fallbacks: ["elevenlabs"], handoff: "track → mix" },
  { intent: "render", provider: "hyperframes", fallbacks: [], handoff: "composition → final mp4" },
];

/** Resolve the provider chain for a pipeline as intent→provider routes. */
export function orchestrationFor(pipelineId: string): ProviderRoute[] {
  const p = getPipeline(pipelineId);
  if (!p) return [];
  return PROVIDER_ORCHESTRATION.filter((r) => p.providerChain.includes(r.provider));
}

/** Creative OS command-center sections (premium, not admin). */
export const CREATIVE_OS_SECTIONS = [
  "Workspace",
  "Sources",
  "Storyboard",
  "Timeline",
  "Agents",
  "Providers",
  "Replay",
  "Proofs",
] as const;
