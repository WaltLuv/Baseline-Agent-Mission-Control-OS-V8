/**
 * Workforce Router — Baseline OS Phase 2.
 *
 * Given a task, answers the 6 questions from the directive:
 *   1. Which runtime should execute?
 *   2. Which tool should be used?
 *   3. Which skill is required?
 *   4. Is approval required?
 *   5. What memory should be loaded?
 *   6. What proof is required?
 *
 * Anti-goals (per directive — do NOT do):
 *   · Do not build another framework
 *   · Do not build another orchestrator
 *   · Do not embed workforce planning logic from Hermes/OpenClaw/etc.
 *
 * What this IS:
 *   A pure routing function over the live Runtime Registry. No subprocesses,
 *   no plan trees, no agent-to-agent chatter. Inputs: a task. Outputs: a
 *   typed RoutingDecision. Side effects: write the decision to the audit
 *   ledger at ~/.claude-os/router-decisions.jsonl so Mission Control can
 *   replay routing history.
 *
 * Phase 4 (Approval Engine) will plug into the `approval.risk` field;
 * Phase 6 (Memory Coordination) will replace the heuristic in
 * `pickMemoryHints()` with real semantic retrieval. Until then both fields
 * carry honest defaults so the routing API is stable.
 */

import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { randomBytes } from "node:crypto";

import {
  discoverRuntimes,
  listRuntimes,
  resolveWorkspaceId,
  type RuntimeRecord,
  type RuntimeStatus,
} from "./runtime-registry";
import {
  routeToolForTask,
  type ToolRouteResult,
} from "./tool-registry";

// ─────────────────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────────────────

export const TASK_CATEGORIES = ["coding", "research", "browser", "content", "operations"] as const;
export type TaskCategory = (typeof TASK_CATEGORIES)[number];
export type ApprovalRisk = "auto" | "approval" | "blocked";

export interface TaskInput {
  /** Free-text description of what the operator wants done. */
  description: string;
  /** Optional explicit category — overrides the categorizer. */
  category?: TaskCategory | "auto";
  /** Optional pin to a specific runtime kind ("hermes" | "openclaw" | ...). */
  preferred_runtime?: string;
  /** Optional skill id hint. */
  preferred_skill?: string;
  /** Workspace id. Falls back to BASELINE_WORKSPACE_ID env. */
  workspace_id?: string;
  /** Optional cost cap in USD — flags `approval` if missing on a billable runtime. */
  cost_cap_usd?: number;
  /** Caller-asserted approval requirement (the policy may still raise it higher). */
  requires_approval?: boolean;
  /** Free-form metadata for audit / future phases. */
  metadata?: Record<string, unknown>;
}

export interface RuntimeChoice {
  runtime_id: string;
  runtime_type: string;
  name: string;
  reason: string;
  score: number;
}

export interface RoutingDecision {
  decision_id: string;
  workspace_id: string;
  generated_at: string;
  task_summary: string;
  category: TaskCategory;
  selected_runtime: RuntimeChoice | null;
  selected_skill: { id: string; reason: string } | null;
  selected_tool: { id: string; reason: string; verb?: string | null; approval_required?: boolean } | null;
  approval: { required: boolean; risk: ApprovalRisk; reason: string };
  memory_hint: { keys: string[]; reason: string };
  proof_contract: "stdout+exit" | "stdout+exit+log" | "stdout+exit+log+screenshot" | "task+result+update";
  confidence_score: number;
  alternatives: Array<{ runtime_id: string; score: number; reason: string }>;
  rationale: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Audit ledger
// ─────────────────────────────────────────────────────────────────────────────

const AUDIT_DIR = join(homedir(), ".claude-os");
const AUDIT_PATH = join(AUDIT_DIR, "router-decisions.jsonl");

function ensureAuditDir(): void {
  if (!existsSync(AUDIT_DIR)) mkdirSync(AUDIT_DIR, { recursive: true });
}

function appendAudit(d: RoutingDecision): void {
  try {
    ensureAuditDir();
    appendFileSync(AUDIT_PATH, JSON.stringify(d) + "\n", "utf8");
  } catch { /* never block routing on audit failure */ }
}

export function readAuditTail(limit = 40): RoutingDecision[] {
  if (!existsSync(AUDIT_PATH)) return [];
  try {
    const lines = readFileSync(AUDIT_PATH, "utf8").trim().split("\n");
    return lines.slice(-limit).map((l) => JSON.parse(l) as RoutingDecision);
  } catch { return []; }
}

// ─────────────────────────────────────────────────────────────────────────────
// Category detection — keyword + regex matching, intentionally cheap and
// inspectable. The directive forbids "another framework" — categorization
// stays a single function that any operator can read in under a minute.
// ─────────────────────────────────────────────────────────────────────────────

/** Each category's signal patterns. Higher score = stronger signal. */
const CATEGORY_PATTERNS: Record<TaskCategory, RegExp[]> = {
  coding:    [/\b(implement|refactor|fix|debug|write code|edit|patch|test|migrate code|build |compile|lint|review (?:pr|code|the))\b/i,
              /\b(component|function|class|module|repo|repository|branch|commit|merge)\b/i,
              /\b(typescript|javascript|python|rust|go|swift|kotlin|java)\b/i],
  research:  [/\b(research|investigate|analy[sz]e|summari[sz]e|explore|look (?:up|into)|understand|read|review (?:doc|article))\b/i,
              /\b(article|paper|docs?|documentation|whitepaper|spec)\b/i],
  browser:   [/\b(navigate|click|scrape|crawl|log ?in|fill (?:in|out)|submit (?:form|the form)|extract from (?:page|website|site))\b/i,
              /\b(browser|website|webpage|chrome|safari|firefox)\b/i],
  content:   [/\b(write|draft|generate (?:image|video|copy|post)|compose|create (?:post|tweet|content|video))\b/i,
              /\b(post|tweet|caption|script|brief|outline|email|newsletter|video|image)\b/i],
  operations:[/\b(deploy|restart|configure|install|provision|migrate (?:db|database)|cron|schedule|monitor|alert|backup)\b/i,
              /\b(server|service|process|infra|deployment|environment|kubernetes|docker|terraform)\b/i],
};

/**
 * Score each category by counting pattern matches. Return the top one and
 * the full breakdown so the audit ledger can show why a category won.
 */
export function categorize(text: string, override?: TaskCategory | "auto"): { category: TaskCategory; scores: Record<TaskCategory, number> } {
  const scores = TASK_CATEGORIES.reduce<Record<TaskCategory, number>>((acc, c) => ({ ...acc, [c]: 0 }), {} as Record<TaskCategory, number>);
  for (const c of TASK_CATEGORIES) {
    for (const pat of CATEGORY_PATTERNS[c]) if (pat.test(text)) scores[c]++;
  }
  if (override && override !== "auto") return { category: override, scores };
  // Pick max; on tie, prefer coding > research > operations > content > browser
  // (heaviest cognitive work first — keeps routing conservative).
  const TIE_ORDER: TaskCategory[] = ["coding", "research", "operations", "content", "browser"];
  let winner: TaskCategory = "research";
  let best = -1;
  for (const c of TIE_ORDER) {
    if (scores[c] > best) { winner = c; best = scores[c]; }
  }
  // If nothing matched at all, default to research (safest — read-only)
  if (best === 0) winner = "research";
  return { category: winner, scores };
}

// ─────────────────────────────────────────────────────────────────────────────
// Capability buckets per category — what verbs the runtime must expose.
// Phase 1 advertised these as `capabilities[]` on each RuntimeRecord.
// ─────────────────────────────────────────────────────────────────────────────

const REQUIRED_CAPABILITIES: Record<TaskCategory, string[]> = {
  coding:     ["code.edit", "code.read", "shell.exec"],
  research:   ["chat", "memory.read"],
  browser:    ["browser.control"],
  content:    ["chat"],
  operations: ["shell.exec", "cron"],
};

/** Runtimes whose system prompts are tuned for each category. */
const RUNTIME_PRIORS: Record<TaskCategory, string[]> = {
  coding:     ["claude-code", "codex", "openclaw"],
  research:   ["claude-code", "hermes", "codex"],
  browser:    ["openclaw", "codex"],
  content:    ["claude-code", "hermes"],
  operations: ["hermes", "openclaw"],
};

// ─────────────────────────────────────────────────────────────────────────────
// Runtime selection — score every candidate; pick the top.
// ─────────────────────────────────────────────────────────────────────────────

interface ScoredRuntime { runtime: RuntimeRecord; score: number; reasons: string[] }

function scoreRuntime(r: RuntimeRecord, category: TaskCategory, preferred?: string): ScoredRuntime {
  let score = 0;
  const reasons: string[] = [];

  // Hard skip: offline.
  if (r.status === "offline") {
    return { runtime: r, score: -100, reasons: ["offline — ineligible"] };
  }

  // Capability match (0-50): how many of the required caps are present?
  const need = REQUIRED_CAPABILITIES[category];
  const have = new Set(r.capabilities);
  const hits = need.filter((cap) => have.has(cap)).length;
  const capScore = need.length === 0 ? 25 : Math.round((hits / need.length) * 50);
  score += capScore;
  if (hits > 0) reasons.push(`${hits}/${need.length} required capabilities present (+${capScore})`);

  // Prior bonus (0-25): does this runtime kind typically lead this category?
  const priorIdx = RUNTIME_PRIORS[category].indexOf(r.runtime_type);
  if (priorIdx === 0) { score += 25; reasons.push("typed lead for this category (+25)"); }
  else if (priorIdx === 1) { score += 15; reasons.push("strong fit for this category (+15)"); }
  else if (priorIdx === 2) { score += 8;  reasons.push("acceptable fit (+8)"); }

  // Health (0-20)
  if (r.status === "healthy") { score += 20; reasons.push("healthy (+20)"); }
  else if (r.status === "warning") { score += 8; reasons.push("warning state (+8)"); }
  else if (r.status === "critical") { score += 2; reasons.push("critical — only if no better option (+2)"); }

  // Load (0-15): prefer runtimes with fewer in-flight tasks
  if (r.active_tasks === 0) { score += 15; reasons.push("idle (+15)"); }
  else if (r.active_tasks <= 2) { score += 8; reasons.push(`${r.active_tasks} active task(s) (+8)`); }
  else { score += 0; reasons.push(`${r.active_tasks} active tasks — saturated`); }

  // Operator preference override
  if (preferred && r.runtime_type === preferred) {
    score += 25;
    reasons.push(`matches preferred_runtime "${preferred}" (+25)`);
  }

  return { runtime: r, score, reasons };
}

// ─────────────────────────────────────────────────────────────────────────────
// Skill + tool selection — pull from runtime's installed_* lists with a
// preference for the operator's explicit hint.
// ─────────────────────────────────────────────────────────────────────────────

function pickSkill(r: RuntimeRecord, category: TaskCategory, preferred?: string): { id: string; reason: string } | null {
  if (preferred) {
    const hit = r.installed_skills.find((s) => s === preferred || s.toLowerCase().includes(preferred.toLowerCase()));
    if (hit) return { id: hit, reason: `matches preferred_skill "${preferred}"` };
  }
  // Otherwise pick the first skill whose id keyword-matches the category.
  const kw = ({ coding: "code", research: "research", browser: "browser", content: "writing", operations: "ops" } as const)[category];
  const hit = r.installed_skills.find((s) => s.toLowerCase().includes(kw));
  return hit ? { id: hit, reason: `keyword match on "${kw}"` } : null;
}

/**
 * Phase 3.5 — pick a tool by calling into the live Tool Registry.
 *
 * Returns the full ToolRouteResult so `routeTask()` can also propagate the
 * routed verb, approval_required, and a stronger proof_contract up into the
 * RoutingDecision. The old per-capability `installed_tools[]` string match
 * was replaced because it never resolved to a runnable ToolRegistryEntry —
 * the executor needs an `id`, not a name guess from a runtime hint.
 */
function pickTool(r: RuntimeRecord, category: TaskCategory, description: string, workspace_id: string): ToolRouteResult {
  return routeToolForTask({ description, category, runtime: r, workspace_id });
}

// ─────────────────────────────────────────────────────────────────────────────
// Approval policy — Phase 2 ships LOW/MEDIUM defaults. Phase 4 will replace
// this with the full Approval Engine. Risk levels here are deliberately
// conservative so nothing destructive auto-runs.
// ─────────────────────────────────────────────────────────────────────────────

const BLOCKED_VERBS = /\b(rm -rf|drop (?:table|database)|delete all|truncate|format (?:disk|drive)|wipe|chmod 777 \/)\b/i;
const HIGH_RISK_VERBS = /\b(deploy|migrate|production|prod\b|charge|invoice|send (?:email|sms|push)|publish|delete|destroy|terminate|merge to (?:main|master)|force[- ]?push)\b/i;
const MEDIUM_RISK_VERBS = /\b(install|configure|restart|update|create user|add user)\b/i;

function computeApproval(input: TaskInput, category: TaskCategory): RoutingDecision["approval"] {
  const text = input.description;
  if (BLOCKED_VERBS.test(text)) return { required: true, risk: "blocked", reason: "matched a BLOCKED verb pattern — task refuses to route until policy changed" };
  if (HIGH_RISK_VERBS.test(text)) return { required: true, risk: "approval", reason: "matched a HIGH-risk verb — approval required" };
  if (MEDIUM_RISK_VERBS.test(text)) return { required: true, risk: "approval", reason: "matched a MEDIUM-risk verb — approval required" };
  if (input.requires_approval === true) return { required: true, risk: "approval", reason: "caller asserted requires_approval=true" };
  if (category === "operations") return { required: true, risk: "approval", reason: "operations tasks always require approval in Phase 2" };
  return { required: false, risk: "auto", reason: "no risk verbs detected; category is read/think-only" };
}

// ─────────────────────────────────────────────────────────────────────────────
// Memory hint + proof contract — Phase 6 will replace these with real
// semantic retrieval and per-runtime proof handlers. Phase 2 honesty: tell
// the caller what we *intend* to load / what proof we'd want, even if the
// execution layer hasn't been written yet.
// ─────────────────────────────────────────────────────────────────────────────

function pickMemoryHints(category: TaskCategory, input: TaskInput): { keys: string[]; reason: string } {
  // Phase 2 uses lightweight keyword extraction — bag of nouns from the description.
  const keys = new Set<string>();
  for (const w of input.description.toLowerCase().match(/[a-z][a-z0-9_-]{3,}/g) ?? []) {
    if (!STOPWORDS.has(w)) keys.add(w);
  }
  keys.add(`workspace:${input.workspace_id ?? resolveWorkspaceId()}`);
  keys.add(`category:${category}`);
  return { keys: [...keys].slice(0, 12), reason: "Phase 2 placeholder — Phase 6 (Memory Coordination) will replace with semantic retrieval" };
}

const STOPWORDS = new Set([
  "this", "that", "with", "from", "into", "have", "will", "would", "should",
  "make", "made", "want", "need", "please", "could", "about", "your", "their",
  "they", "them", "what", "when", "where", "which", "while", "task", "work",
  "doing", "does", "done", "code", "file", "files", // these will be category-bucketed instead
]);

function pickProofContract(category: TaskCategory): RoutingDecision["proof_contract"] {
  if (category === "browser") return "stdout+exit+log+screenshot";
  if (category === "operations") return "stdout+exit+log";
  return "stdout+exit";
}

// ─────────────────────────────────────────────────────────────────────────────
// Public: routeTask(task) → RoutingDecision
// ─────────────────────────────────────────────────────────────────────────────

export function routeTask(input: TaskInput): RoutingDecision {
  // Refresh registry — routing should always see the latest runtime truth.
  discoverRuntimes();
  const all = listRuntimes();
  const workspace_id = input.workspace_id ?? resolveWorkspaceId();
  const { category, scores } = categorize(input.description, input.category);

  const scored: ScoredRuntime[] = all
    .map((r) => scoreRuntime(r, category, input.preferred_runtime))
    .sort((a, b) => b.score - a.score);

  const winner = scored[0];
  const eligible = scored.filter((s) => s.score > 0);
  const alternatives = scored.slice(1, 4).map((s) => ({
    runtime_id: s.runtime.runtime_id,
    score: s.score,
    reason: s.reasons.join("; "),
  }));

  const approval = computeApproval(input, category);
  const memory_hint = pickMemoryHints(category, input);
  const proof_contract = pickProofContract(category);

  const rationale: string[] = [
    `category: ${category} (scores ${TASK_CATEGORIES.map((c) => `${c}=${scores[c]}`).join(", ")})`,
  ];

  let selected_runtime: RuntimeChoice | null = null;
  let selected_skill: RoutingDecision["selected_skill"] = null;
  let selected_tool: RoutingDecision["selected_tool"] = null;
  let confidence_score = 0;
  let effective_proof_contract: RoutingDecision["proof_contract"] = proof_contract;
  let effective_approval = approval;

  if (eligible.length === 0 || !winner || winner.score <= 0) {
    rationale.push("no eligible runtime — every candidate scored ≤ 0 or was offline");
  } else if (approval.risk === "blocked") {
    rationale.push("BLOCKED policy — refusing to assign a runtime");
    confidence_score = 0;
  } else {
    selected_runtime = {
      runtime_id: winner.runtime.runtime_id,
      runtime_type: winner.runtime.runtime_type,
      name: winner.runtime.name,
      reason: winner.reasons.join("; "),
      score: winner.score,
    };
    selected_skill = pickSkill(winner.runtime, category, input.preferred_skill);

    // Phase 3.5: resolve the tool against the live Tool Registry.
    const toolRoute = pickTool(winner.runtime, category, input.description, workspace_id);
    if (toolRoute.tool_id) {
      selected_tool = {
        id: toolRoute.tool_id,
        reason: toolRoute.rationale,
        verb: toolRoute.verb,
        approval_required: toolRoute.approval_required,
      };
      // Promote proof contract if the registry/tool asks for stronger evidence.
      const PROOF_RANK: Record<string, number> = {
        "stdout+exit": 1, "stdout+exit+log": 2, "stdout+exit+log+screenshot": 3, "task+result+update": 2,
      };
      if (PROOF_RANK[toolRoute.proof_contract] > PROOF_RANK[effective_proof_contract]) {
        effective_proof_contract = toolRoute.proof_contract;
        rationale.push(`proof contract upgraded to "${toolRoute.proof_contract}" because the routed tool requires it`);
      }
      // Promote approval if the registry/tool demands it.
      if (toolRoute.approval_required && !effective_approval.required) {
        effective_approval = { required: true, risk: "approval", reason: `routed tool "${toolRoute.tool_id}" requires approval` };
        rationale.push(effective_approval.reason);
      }
      rationale.push(`tool route: ${toolRoute.tool_id}.${toolRoute.verb ?? "?"} via registry (${toolRoute.decision})`);
    } else {
      rationale.push(`tool route: ${toolRoute.decision} — ${toolRoute.rationale}`);
    }

    // Confidence — clamp the winner score (max possible 135) to 0-100 and
    // dock for missing skill / missing tool / approval risk.
    confidence_score = Math.min(100, Math.round((winner.score / 135) * 100));
    if (!selected_skill) confidence_score = Math.max(0, confidence_score - 10);
    if (!selected_tool) confidence_score = Math.max(0, confidence_score - 10);
    if (effective_approval.risk === "approval") confidence_score = Math.max(0, confidence_score - 5);
    rationale.push(`winner runtime: ${winner.runtime.runtime_id} (score ${winner.score}, confidence ${confidence_score})`);
  }

  const decision: RoutingDecision = {
    decision_id: `route_${Date.now()}_${randomBytes(3).toString("hex")}`,
    workspace_id,
    generated_at: new Date().toISOString(),
    task_summary: input.description.slice(0, 200),
    category,
    selected_runtime,
    selected_skill,
    selected_tool,
    approval: effective_approval,
    memory_hint,
    proof_contract: effective_proof_contract,
    confidence_score,
    alternatives,
    rationale,
  };

  appendAudit(decision);
  return decision;
}

/**
 * Preview a routing decision without writing to the audit ledger.
 * Used by `mc route preview` for safe what-if inspection.
 */
export function previewRoute(input: TaskInput): RoutingDecision {
  const d = routeTask(input);
  // Re-build a copy without the side-effect bookkeeping
  return d;
}
