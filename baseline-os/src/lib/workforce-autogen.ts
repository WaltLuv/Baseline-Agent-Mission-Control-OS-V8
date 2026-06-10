/**
 * Workforce auto-generation + Agent Factory sync (Baseline OS parity, Phases 1–2).
 *
 * Pure, local-first transforms over the private org-chart roster. Phase 1 maps a
 * console directive (the 13 workforce directives, each with an agentMap) into
 * org agents with a lead → report hierarchy. Phase 2 keeps the Agent Factory in
 * sync with the org chart (idempotent upsert / archive, no orphan/dupe nodes).
 *
 * Idempotent: generated agents carry category "template:<id>"; factory agents
 * carry category "agent-factory". The UI/store assigns ids + persists.
 */
import { CONSOLE_DIRECTIVES } from "@/lib/workforce-console";

export interface GenAgent {
  name: string;
  role: string;
  department: string;
  category: string;
  skills: string[];
  memoryAccess: string[];
  runtime: string;
  approval: "auto" | "walt-approval" | "walt-only";
  isLead: boolean;
}

/** Phase 1 — plan org agents for a workforce directive (idempotent by name+category). */
export function orgPlanFromDirective(directiveId: string): GenAgent[] {
  const d = CONSOLE_DIRECTIVES.find((x) => x.directiveId === directiveId);
  if (!d) return [];
  const dept =
    d.group === "ops" ? "Operations" : d.verticalId ? "Operations" : "Leadership & Orchestration";
  // Approval: anything with a human gate is at least walt-approval.
  const approval: GenAgent["approval"] = d.humanGates.length ? "walt-approval" : "auto";
  return d.agentMap.map((name, i) => ({
    name,
    role: name,
    department: i === 0 ? "Leadership & Orchestration" : dept,
    category: `template:${directiveId}`,
    skills: [],
    memoryAccess: ["local"],
    runtime: "hermes",
    approval,
    isLead: i === 0,
  }));
}

/** Every directive that can generate an org (the 13 console directives). */
export const GENERATABLE_DIRECTIVES = CONSOLE_DIRECTIVES.map((d) => d.directiveId);

export interface RosterAgent {
  id: string;
  name: string;
  category: string;
  managerId: string | null;
  archived?: boolean;
  [k: string]: unknown;
}

/**
 * Idempotently merge a generated plan into an existing roster. Returns the
 * agents to ADD (with managerId wired to the lead). Skips any (name, category)
 * already present so reinstall never duplicates.
 */
export function planAdditions(
  existing: RosterAgent[],
  plan: GenAgent[],
  newId: () => string,
): RosterAgent[] {
  if (plan.length === 0) return [];
  const has = (g: GenAgent) => existing.some((a) => a.name === g.name && a.category === g.category);
  const additions: RosterAgent[] = [];
  let leadId =
    existing.find((a) =>
      plan.some((g) => g.isLead && g.name === a.name && g.category === a.category),
    )?.id ?? null;
  const lead = plan.find((g) => g.isLead);
  if (lead && !has(lead)) {
    const id = newId();
    leadId = id;
    additions.push({ ...lead, id, managerId: null });
  }
  for (const g of plan) {
    if (g.isLead || has(g)) continue;
    additions.push({ ...g, id: newId(), managerId: leadId });
  }
  return additions;
}

/** Phase 2 — upsert a factory-created agent into the roster (idempotent). */
export function applyFactoryUpsert(
  existing: RosterAgent[],
  ref: { name: string; role?: string; runtime?: string; skills?: string[] },
  newId: () => string,
): { roster: RosterAgent[]; created: boolean } {
  const idx = existing.findIndex((a) => a.name === ref.name && a.category === "agent-factory");
  if (idx >= 0) {
    const next = existing.slice();
    next[idx] = {
      ...next[idx],
      role: ref.role ?? next[idx].role,
      runtime: ref.runtime ?? next[idx].runtime,
    };
    return { roster: next, created: false };
  }
  const node: RosterAgent = {
    id: newId(),
    name: ref.name,
    role: ref.role ?? "",
    department: "Engineering",
    category: "agent-factory",
    managerId: null,
    skills: ref.skills ?? [],
    memoryAccess: ["local"],
    runtime: ref.runtime ?? "claude-code",
    permissions: [],
    approval: "auto",
    status: "active",
    archived: false,
  };
  return { roster: [...existing, node], created: true };
}

/** Phase 2 — archive a factory agent (no orphan reports; reports re-parent to null). */
export function applyFactoryArchive(existing: RosterAgent[], name: string): RosterAgent[] {
  const target = existing.find((a) => a.name === name && a.category === "agent-factory");
  if (!target) return existing;
  return existing.map((a) =>
    a.id === target.id
      ? { ...a, archived: true }
      : a.managerId === target.id
        ? { ...a, managerId: null }
        : a,
  );
}
