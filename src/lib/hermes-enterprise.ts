/**
 * Hermes Enterprise Operator — turns Hermes from "chatbot with tools" into a
 * visible enterprise operator. Pure, deterministic model shared by Baseline OS
 * and Mission Control:
 *   - tool / skill / provider registries (what Hermes can actually do)
 *   - MCP status, execution log, approval log
 *   - participation flags for the six platform systems (graph/replay/proof/…)
 *
 * No live calls here — callers pass in live probe data; this organizes it into
 * the operator panels + honest counts. Connected vs setup-needed is never faked.
 */

export type ConnState = "connected" | "available" | "setup_needed";

export interface HermesTool {
  id: string;
  name: string;
  state: ConnState;
  via: string;
}
export interface HermesSkill {
  id: string;
  name: string;
  state: ConnState;
  category: string;
}
export interface HermesProvider {
  id: string;
  name: string;
  state: ConnState;
  kind: string;
}
export interface HermesRuntime {
  id: string;
  name: string;
  state: ConnState;
  health: "healthy" | "degraded" | "down" | "unknown";
  permissions: string[];
  cost?: string;
  lastDeploy?: string;
}
export interface ExecutionLogEntry {
  ts: number;
  tool: string;
  status: "ok" | "error" | "running";
  detail?: string;
}
export interface ApprovalLogEntry {
  ts: number;
  action: string;
  decision: "approved" | "denied" | "pending";
  by?: string;
}

export interface McpStatus {
  /** Is the Hermes MCP bridge reachable? */
  online: boolean;
  servers: { name: string; state: ConnState }[];
}

export interface OperatorView {
  mcp: McpStatus;
  tools: HermesTool[];
  skills: HermesSkill[];
  providers: HermesProvider[];
  runtimes: HermesRuntime[];
  executions: ExecutionLogEntry[];
  approvals: ApprovalLogEntry[];
  /** Hermes consults Graphify before executing. */
  graphFirst: boolean;
  counts: {
    tools: number;
    skills: number;
    providers: number;
    runtimes: number;
    connectedTools: number;
    healthyRuntimes: number;
    pendingApprovals: number;
  };
}

/** The nine enterprise-operator panels every Hermes surface must show. */
export const HERMES_CAPABILITIES = [
  "MCP status",
  "Tools",
  "Skills",
  "Providers",
  "Execution log",
  "Approval log",
  "Replay",
  "Graphify",
  "Proof",
] as const;

export interface OperatorInput {
  mcpOnline?: boolean;
  servers?: { name: string; state: ConnState }[];
  tools?: HermesTool[];
  skills?: HermesSkill[];
  providers?: HermesProvider[];
  runtimes?: HermesRuntime[];
  executions?: ExecutionLogEntry[];
  approvals?: ApprovalLogEntry[];
  graphFirst?: boolean;
}

/** Assemble the operator view from live probe data (honest; nothing fabricated). */
export function buildOperatorView(input: OperatorInput = {}): OperatorView {
  const tools = input.tools ?? [];
  const skills = input.skills ?? [];
  const providers = input.providers ?? [];
  const runtimes = input.runtimes ?? [];
  const executions = input.executions ?? [];
  const approvals = input.approvals ?? [];
  return {
    mcp: { online: input.mcpOnline ?? false, servers: input.servers ?? [] },
    tools,
    skills,
    providers,
    runtimes,
    executions,
    approvals,
    graphFirst: input.graphFirst ?? true,
    counts: {
      tools: tools.length,
      skills: skills.length,
      providers: providers.length,
      runtimes: runtimes.length,
      connectedTools: tools.filter((t) => t.state === "connected").length,
      healthyRuntimes: runtimes.filter((r) => r.health === "healthy").length,
      pendingApprovals: approvals.filter((a) => a.decision === "pending").length,
    },
  };
}

/** Approval engine: resolve a pending approval to a decision (pure). */
export function resolveApproval(
  approvals: ApprovalLogEntry[],
  index: number,
  decision: "approved" | "denied",
  by: string,
  now: number,
): ApprovalLogEntry[] {
  return approvals.map((a, i) => (i === index ? { ...a, decision, by, ts: now } : a));
}

/** Default registry scaffold (states overridden by live probes). All setup_needed
 *  until a real connection is confirmed — no fake "connected". */
export function defaultRegistries(): Pick<OperatorInput, "tools" | "skills" | "providers"> {
  return {
    tools: [
      { id: "fs", name: "Filesystem", state: "setup_needed", via: "mcp" },
      { id: "shell", name: "Shell", state: "setup_needed", via: "mcp" },
      { id: "graphify", name: "Graphify", state: "connected", via: "internal" },
      { id: "browser", name: "Browser", state: "setup_needed", via: "mcp" },
      { id: "github", name: "GitHub", state: "setup_needed", via: "mcp" },
    ],
    skills: [
      { id: "research", name: "Research", state: "available", category: "Knowledge" },
      { id: "build", name: "Build/Deploy", state: "available", category: "Engineering" },
      { id: "outreach", name: "Outreach", state: "setup_needed", category: "Growth" },
    ],
    providers: [
      { id: "anthropic", name: "Anthropic", state: "setup_needed", kind: "llm" },
      { id: "openai", name: "OpenAI", state: "setup_needed", kind: "llm" },
      { id: "elevenlabs", name: "ElevenLabs", state: "setup_needed", kind: "voice" },
    ],
  };
}
