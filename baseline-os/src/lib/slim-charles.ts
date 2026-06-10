/**
 * Slim Charles — Walt's PRIVATE personal assistant. Baseline OS ONLY.
 *
 * This is the Jarvis-style "Oracle Control System" concept; the product name is
 * Slim Charles. It is Hermes-backed and must NEVER appear in Baseline Mission
 * Control (the customer product). The private voice id lives here and only here.
 */

export const SLIM_CHARLES = {
  name: "Slim Charles",
  /** Private ElevenLabs voice id — Baseline OS only, never in Mission Control. */
  voiceId: "rWyjfFeMZ6PxkHqD3wGC",
  bootGreeting: "Slim Charles online. Baseline OS is live — what are we building, Walt?",
  persona:
    "You are Slim Charles, Walt's private operator assistant, backed by the real " +
    "Hermes agent. Calm, direct, fast. You research, draft, plan, build, and " +
    "dispatch work using Walt's real tools and skills. You never claim to have " +
    "done something you did not do.",
} as const;

export type VoiceState = "idle" | "booting" | "listening" | "processing" | "speaking" | "error";

export const VOICE_STATE_LABEL: Record<VoiceState, string> = {
  idle: "Idle",
  booting: "Booting",
  listening: "Listening",
  processing: "Processing",
  speaking: "Speaking",
  error: "Error",
};

// ── Safety boundary ─────────────────────────────────────────────────
export const AUTO_APPROVE_ACTIONS = [
  "research",
  "drafting",
  "planning",
  "file creation",
  "file editing",
  "app scaffolding",
  "workflow creation",
  "agent dispatch",
  "browser-use research",
  "non-destructive computer tasks",
] as const;

export const REQUIRES_WALT_ACTIONS = [
  "deleting anything",
  "destructive filesystem actions",
  "production deploys",
  "billing changes",
  "credential changes",
  "sending external messages",
  "exposing secrets",
  "spending above threshold",
] as const;

const AUTO = new Set<string>(AUTO_APPROVE_ACTIONS);
const WALT = new Set<string>(REQUIRES_WALT_ACTIONS);
const DESTRUCTIVE_RX =
  /\b(delete|remove|rm\s|drop\s|destroy|wipe|purge|truncate|deploy\s+(to\s+)?prod|production\s+deploy|charge|refund|payout|wire|transfer\s+funds|rotate\s+key|reveal\s+secret|export\s+secret|sudo\s+rm)\b/i;

export type ApprovalDecision = "auto" | "requires-walt";

/** Default-deny: only explicitly-safe actions auto-approve; everything else → Walt. */
export function classifyAction(action: string): ApprovalDecision {
  const a = action.trim().toLowerCase();
  if (WALT.has(a)) return "requires-walt";
  if (DESTRUCTIVE_RX.test(a)) return "requires-walt";
  if (AUTO.has(a)) return "auto";
  return "requires-walt";
}

export function canSlimAutoApprove(action: string): boolean {
  return classifyAction(action) === "auto";
}

// ── Tool / skill access surface (honest ready vs setup-needed) ──────
export type ToolAccessState = "ready" | "setup-needed";

export interface ToolSource {
  id: string;
  label: string;
  /** Endpoint Baseline OS probes to know if the source is live, if any. */
  statusEndpoint?: string;
  setupHint: string;
}

export const TOOL_SOURCES: ToolSource[] = [
  { id: "skills", label: "Installed Skills", setupHint: "Install skills from the Skills page." },
  { id: "skills-library", label: "Skills Library", setupHint: "Add skills from the Library." },
  {
    id: "skills-marketplace",
    label: "Skills Marketplace",
    setupHint: "Install/configure marketplace tools.",
  },
  { id: "mcp", label: "MCP tools", setupHint: "Register MCP servers with Claude Code." },
  { id: "browser-use", label: "Browser Use", setupHint: "Connect a Browser Use runtime." },
  {
    id: "hermes",
    label: "Hermes tools",
    statusEndpoint: "/__hermes_status",
    setupHint: "Install + start Hermes.",
  },
  { id: "openclaw", label: "OpenClaw tools", setupHint: "Configure OpenClaw." },
  { id: "claude-code", label: "Claude Code tools", setupHint: "Sign in to Claude Code." },
  { id: "codex", label: "Codex tools", setupHint: "Connect Codex." },
  { id: "maestro", label: "Maestro tools", setupHint: "Connect Maestro." },
  { id: "computer-use", label: "Computer Use", setupHint: "Enable computer-use runtime." },
];
