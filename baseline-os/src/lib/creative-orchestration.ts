/**
 * Creative Agent Orchestration — the Higgsfield "Agent Orchestration" panel model.
 *
 * Higgsfield-specific UI, but it writes into the SHARED Studio core
 * (createOrchestrationJob in claude-code-studio.ts) — same render queue + proof,
 * tagged provider='higgsfield', orchestration_source='higgsfield_agent_orchestration'.
 *
 * TRUTH-FIRST: an agent is only "connected" when its runtime/credential probe
 * confirms it. Otherwise: setup_required / disconnected / missing_credentials /
 * unavailable. No fake ready states.
 */

export const HIGGSFIELD_ORCHESTRATION_SOURCE = "higgsfield_agent_orchestration";

export type AgentKind = "orchestrator" | "runtime" | "provider" | "browser";

export interface OrchestrationAgent {
  id: string;
  label: string;
  kind: AgentKind;
  /** Sidecar status endpoint that reports connectivity, if any. */
  statusEndpoint?: string;
  /** Credential id (Credentials Manager) gating this agent, if any. */
  credentialId?: string;
  /** Env var that also satisfies the credential. */
  envVar?: string;
  /** CLI binary probed via /__runtime_cli_status, if any. */
  cliBin?: string;
  /** Can act as the lead orchestrator. */
  canLead: boolean;
}

export const ORCHESTRATION_AGENTS: OrchestrationAgent[] = [
  {
    id: "gemini",
    label: "Gemini",
    kind: "orchestrator",
    credentialId: "google",
    envVar: "GEMINI_API_KEY",
    canLead: true,
  },
  {
    id: "openclaw",
    label: "OpenClaw",
    kind: "runtime",
    statusEndpoint: "/__openclaw_status",
    canLead: true,
  },
  {
    id: "hermes",
    label: "Hermes",
    kind: "runtime",
    statusEndpoint: "/__hermes_status",
    canLead: true,
  },
  {
    id: "claude-code",
    label: "Claude Code",
    kind: "runtime",
    cliBin: "claude",
    credentialId: "anthropic",
    canLead: true,
  },
  { id: "codex", label: "Codex", kind: "runtime", cliBin: "codex", canLead: true },
  {
    id: "oh-my-pi",
    label: "Oh My Pi",
    kind: "runtime",
    cliBin: "omp",
    statusEndpoint: "/__omp_status",
    canLead: false,
  },
  { id: "browser-use", label: "Browser Use", kind: "browser", canLead: false },
  {
    id: "higgsfield",
    label: "Higgsfield",
    kind: "provider",
    statusEndpoint: "/__higgsfield_status",
    envVar: "HIGGSFIELD_API_KEY_ID",
    canLead: false,
  },
  {
    id: "hyperframes",
    label: "HyperFrames",
    kind: "provider",
    statusEndpoint: "/__hyperframes_projects",
    credentialId: "heygen",
    canLead: false,
  },
  { id: "remotion", label: "Remotion", kind: "provider", cliBin: "remotion", canLead: false },
  {
    id: "minimax",
    label: "MiniMax",
    kind: "provider",
    cliBin: "minimax",
    credentialId: "minimax",
    canLead: false,
  },
  {
    id: "heygen",
    label: "HeyGen",
    kind: "provider",
    statusEndpoint: "/__heygen_avatars",
    credentialId: "heygen",
    envVar: "HEYGEN_API_KEY",
    canLead: false,
  },
  {
    id: "elevenlabs",
    label: "ElevenLabs",
    kind: "provider",
    credentialId: "elevenlabs",
    envVar: "ELEVENLABS_API_KEY",
    canLead: false,
  },
];

export type AgentConnState =
  | "connected"
  | "setup_required"
  | "disconnected"
  | "missing_credentials"
  | "unavailable";

export interface AgentSignals {
  /** status endpoint reported reachable/installed. */
  statusOk?: boolean;
  /** credential present (saved or env). */
  credentialPresent?: boolean;
  /** CLI binary found (only when agent.cliBin set). */
  cliFound?: boolean;
  /** probe was attempted (vs. no probe available). */
  probed?: boolean;
}

/**
 * Honest agent connection state. Only "connected" when the relevant signal
 * actually confirms it. An agent with no probe surface at all is "unavailable"
 * (we can't confirm it), never "connected".
 */
export function deriveAgentConnState(agent: OrchestrationAgent, s: AgentSignals): AgentConnState {
  // Credential-gated agents: no credential → missing_credentials.
  if (
    (agent.credentialId || agent.envVar) &&
    s.credentialPresent === false &&
    !s.statusOk &&
    !s.cliFound
  ) {
    return "missing_credentials";
  }
  if (agent.cliBin) {
    if (s.cliFound) return "connected";
    if (s.probed) return "setup_required";
    return "unavailable";
  }
  if (agent.statusEndpoint) {
    if (s.statusOk) return "connected";
    if (s.probed) return "disconnected";
    return "unavailable";
  }
  if (agent.credentialId || agent.envVar) {
    return s.credentialPresent ? "connected" : "missing_credentials";
  }
  // No probe surface → cannot confirm.
  return "unavailable";
}

export const AGENT_CONN_LABEL: Record<AgentConnState, string> = {
  connected: "Connected",
  setup_required: "Setup required",
  disconnected: "Disconnected",
  missing_credentials: "Missing credentials",
  unavailable: "Unavailable",
};

export function agentIsReady(state: AgentConnState): boolean {
  return state === "connected";
}

// ── Orchestration workflows (the creative sequences Walt named) ──────
export interface OrchestrationWorkflow {
  id: string;
  label: string;
  description: string;
  /** Default approval tier for the produced job. */
  approval: "low" | "medium" | "high" | "blocked";
}

export const ORCHESTRATION_WORKFLOWS: OrchestrationWorkflow[] = [
  {
    id: "4-shot-product-reveal",
    label: "4-shot product reveal",
    description: "A four-shot product reveal sequence.",
    approval: "medium",
  },
  {
    id: "soul-id-character-sequence",
    label: "Soul ID character sequence",
    description: "An identity-faithful character sequence using a Soul ID.",
    approval: "high",
  },
  {
    id: "product-photoshoot",
    label: "Product photoshoot",
    description: "A brand-quality product photoshoot set.",
    approval: "medium",
  },
  {
    id: "marketplace-card-set",
    label: "Marketplace card set",
    description: "A compliant marketplace listing image set.",
    approval: "medium",
  },
  {
    id: "cinematic-broll-pack",
    label: "Cinematic B-roll pack",
    description: "A pack of cinematic B-roll clips.",
    approval: "medium",
  },
  {
    id: "social-ad-sequence",
    label: "Social ad sequence",
    description: "A social ad creative sequence.",
    approval: "high",
  },
  {
    id: "thumbnail-exploration",
    label: "Thumbnail exploration",
    description: "Thumbnail concept exploration.",
    approval: "low",
  },
  {
    id: "storyboard-to-video-pack",
    label: "Storyboard-to-video pack",
    description: "A storyboard rendered into a video pack.",
    approval: "high",
  },
];
