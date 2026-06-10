/**
 * Flight Deck command bridge — pure routing logic.
 *
 * Classifies a typed operational command and routes it to an EXISTING system
 * (Graphify, Hermes, Runtime Registry, Mission Control, Customer Zero, Proof/
 * Replay). It never executes here — it produces a plan the UI dispatches to the
 * real surface. Destructive/deploy/billing/external-message intents are flagged
 * for approval; nothing is faked.
 */

export type CommandSystem =
  | "graphify"
  | "hermes"
  | "runtime-registry"
  | "mission-control"
  | "customer-zero"
  | "proof-replay"
  | "unknown";

export interface CommandRoute {
  command: string;
  system: CommandSystem;
  runtimeLabel: string;
  /** read = safe inline data · agent = Hermes · execute = runs something · destructive = gated */
  kind: "read" | "agent" | "execute" | "destructive";
  needsApproval: boolean;
  usesGraphify: boolean;
  emitsProof: boolean;
  /** existing in-app route to open to continue, if any */
  route: string | null;
  /** the Graphify query to run, when usesGraphify */
  graphifyQuery: string | null;
  /** runtime id this depends on (for setup-needed checks), if any */
  requiresRuntime: string | null;
  rationale: string;
}

// Destructive / external-effect verbs that always require human approval.
const DESTRUCTIVE =
  /\b(deploy|delete|remove|drop|charge|bill|billing|payment|invoice|refund|send|email|sms|text|message|publish|prod|production|destroy|wipe|reset|migrate)\b/i;

export function isDestructive(text: string): boolean {
  return DESTRUCTIVE.test(text);
}

export function routeCommand(raw: string): CommandRoute {
  const command = (raw ?? "").trim();
  const t = command.toLowerCase();
  const destructive = DESTRUCTIVE.test(t);
  const base = {
    command,
    needsApproval: false,
    usesGraphify: false,
    emitsProof: false,
    route: null as string | null,
    graphifyQuery: null as string | null,
    requiresRuntime: null as string | null,
  };

  if (/\b(graphify|locate|find|where is|which file|structural|codebase|brain)\b/.test(t)) {
    const q =
      command.replace(/^.*?\b(open graphify and|locate|find|where is|graphify)\b/i, "").trim() ||
      command;
    return {
      ...base,
      system: "graphify",
      runtimeLabel: "Graphify · structural brain",
      kind: "read",
      usesGraphify: true,
      graphifyQuery: q,
      route: "/graphify",
      needsApproval: destructive,
      rationale: "Codebase / file lookup → query the structural graph (read-only).",
    };
  }
  if (/\b(runtime|runtimes|connected|registry)\b/.test(t)) {
    return {
      ...base,
      system: "runtime-registry",
      runtimeLabel: "Runtime Registry",
      kind: "read",
      route: "/runtime-registry",
      needsApproval: destructive,
      rationale: "Runtime status → Runtime Registry probe (read-only).",
    };
  }
  if (/\b(customer zero|smoke|acceptance)\b/.test(t)) {
    return {
      ...base,
      system: "customer-zero",
      runtimeLabel: "Customer Zero smoke",
      kind: "execute",
      needsApproval: true,
      emitsProof: true,
      rationale: "Acceptance / smoke run → execution; gated + emits a proof trail.",
    };
  }
  if (/\b(mission control|mc health|property management|pm demo)\b/.test(t)) {
    return {
      ...base,
      system: "mission-control",
      runtimeLabel: "Mission Control (separate app)",
      kind: destructive ? "destructive" : "execute",
      needsApproval: true,
      rationale:
        "Mission Control runs as a separate app — dispatch needs confirmation and MC running.",
    };
  }
  if (/\b(proof|replay|package)\b/.test(t)) {
    return {
      ...base,
      system: "proof-replay",
      runtimeLabel: "Proof / Replay",
      kind: "execute",
      emitsProof: true,
      needsApproval: true,
      route: "/replay",
      rationale: "Creates a proof / replay artifact → gated.",
    };
  }
  if (/\b(hermes|ask|review|summari|operator|dispatch|work order)\b/.test(t)) {
    return {
      ...base,
      system: "hermes",
      runtimeLabel: "Hermes · execution operator",
      kind: "agent",
      emitsProof: true,
      route: "/agents/hermes",
      requiresRuntime: "hermes",
      needsApproval: destructive,
      rationale: "Operator task → Hermes agent (activity + proof logged).",
    };
  }
  return {
    ...base,
    system: "unknown",
    runtimeLabel: "—",
    kind: "read",
    needsApproval: destructive,
    rationale: "No matching system — refine the command (try Graphify, Hermes, runtimes, proof).",
  };
}
