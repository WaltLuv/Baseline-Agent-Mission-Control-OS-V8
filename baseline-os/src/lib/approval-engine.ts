/**
 * Approval Engine — Baseline OS Phase 4.
 *
 * Replaces the Phase 3 "any ≥ 8-char token is valid" stub with a real
 * approval workflow:
 *
 *   1. Phase 3 executor calls `requestApproval(...)` whenever risk ≥ HIGH
 *      (or per the explicit policy rules below).
 *   2. The engine creates an ApprovalRequest, persists it to the queue, and
 *      returns a deterministic id (`appr_…`). The executor refuses execution
 *      and surfaces the id so the caller can poll / wait.
 *   3. An operator (CLI / UI / MC) approves or denies the request with a
 *      free-text reason.
 *   4. On approve, the engine generates a single-use token bound to:
 *        · the exact tool_id + verb
 *        · the SHA-256 fingerprint of the request args
 *        · an expiry (default 30 min, overridable per policy)
 *      No bearer-style "good for anything" tokens.
 *   5. The caller re-runs the tool with `approval_token = <issued token>`.
 *      The executor calls `verifyAndConsume(...)`; the engine checks the
 *      token, the fingerprint, expiry, and burns the token after one use.
 *   6. Every transition (requested → approved/denied → consumed/expired)
 *      lands in the audit ledger AND fans out to MC as a task comment so
 *      the supervision layer always sees what was decided.
 *
 * Policy rules (per Phase 4 directive):
 *
 *   LOW       AUTO                  no engine involvement
 *   MEDIUM    AUTO with audit       runs; engine logs but does not gate
 *   HIGH      REQUIRED APPROVAL     engine gates; single-use token required
 *   BLOCKED   NEVER EXECUTE         engine refuses; cannot be unblocked
 *
 * Persistence is two files:
 *   ~/.claude-os/approval-queue.json   pending + recent state (truncated to 200)
 *   ~/.claude-os/approval-history.jsonl  append-only audit
 *
 * Phase 4 forbids: another framework, another orchestrator, another
 * dashboard, another memory system. This is policy + queue + token. ~550 lines.
 */

import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "BLOCKED";
export type ApprovalStatus = "pending" | "approved" | "denied" | "expired" | "consumed";

export interface ApprovalRequest {
  id: string;                          // "appr_..."
  status: ApprovalStatus;
  tool_id: string;
  verb: string;
  /** Snapshot of args at request time. Surfaced to operator so they see the
   *  exact payload they're approving — never tampered with later. */
  args: Record<string, string>;
  /** SHA-256(canonical-stringify(args)). Bound to the issued token. */
  args_fingerprint: string;
  risk_level: RiskLevel;
  reason: string;                      // why the engine requested approval
  requested_by: string;
  requested_at: string;                // ISO
  workspace_id: string;
  // Decision
  decided_by: string | null;
  decided_at: string | null;
  decision_reason: string | null;
  // Token + consumption (only present after approval)
  approval_token: string | null;
  expires_at: string;                  // ISO; default +30min
  consumed_at: string | null;
  consumed_audit_id: string | null;
  // Optional linkage to MC / Phase 2 / Phase 3 surfaces
  task_id: string | number | null;
  decision_id: string | null;
  audit_id_on_refusal: string | null;  // id of the executor's refusal audit
}

export interface ApprovalQueueShape {
  version: 1;
  generated_at: string;
  /** Most recent N requests across all statuses. Older entries roll off into
   *  approval-history.jsonl, which is append-only. */
  requests: ApprovalRequest[];
}

export interface RequestApprovalInput {
  tool_id: string;
  verb: string;
  args: Record<string, string>;
  risk_level: RiskLevel;
  reason: string;
  workspace_id: string;
  task_id?: string | number | null;
  decision_id?: string | null;
  requested_by?: string;
  /** override default expiry; minutes */
  expires_in_minutes?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Persistence
// ─────────────────────────────────────────────────────────────────────────────

const REGISTRY_DIR = join(homedir(), ".claude-os");
const QUEUE_PATH = join(REGISTRY_DIR, "approval-queue.json");
const HISTORY_PATH = join(REGISTRY_DIR, "approval-history.jsonl");

const QUEUE_RETENTION = 200;            // most recent entries kept in queue file
const DEFAULT_EXPIRY_MIN = 30;

function ensureDir(): void {
  if (!existsSync(REGISTRY_DIR)) mkdirSync(REGISTRY_DIR, { recursive: true });
}

function emptyQueue(): ApprovalQueueShape {
  return { version: 1, generated_at: new Date().toISOString(), requests: [] };
}

function readQueue(): ApprovalQueueShape {
  if (!existsSync(QUEUE_PATH)) return emptyQueue();
  try {
    const parsed = JSON.parse(readFileSync(QUEUE_PATH, "utf8")) as ApprovalQueueShape;
    if (parsed.version !== 1 || !Array.isArray(parsed.requests)) return emptyQueue();
    return parsed;
  } catch { return emptyQueue(); }
}

function writeQueue(q: ApprovalQueueShape): void {
  ensureDir();
  // Truncate stale entries to keep the file small.
  q.requests = q.requests.slice(-QUEUE_RETENTION);
  const tmp = `${QUEUE_PATH}.tmp.${process.pid}`;
  writeFileSync(tmp, JSON.stringify({ ...q, generated_at: new Date().toISOString() }, null, 2), "utf8");
  renameSync(tmp, QUEUE_PATH);
}

function appendHistory(r: ApprovalRequest, event: "requested" | "approved" | "denied" | "expired" | "consumed", actor: string): void {
  try {
    ensureDir();
    appendFileSync(HISTORY_PATH, JSON.stringify({
      ts: new Date().toISOString(),
      event, actor,
      // Don't log the issued token in history — the queue file holds it for
      // active requests; once consumed the queue clears it.
      request: { ...r, approval_token: r.approval_token ? "[ISSUED]" : null },
    }) + "\n", "utf8");
  } catch { /* never block on audit */ }
}

export function readHistoryTail(limit = 80): unknown[] {
  if (!existsSync(HISTORY_PATH)) return [];
  try {
    const lines = readFileSync(HISTORY_PATH, "utf8").trim().split("\n").filter(Boolean);
    return lines.slice(-limit).map((l) => JSON.parse(l));
  } catch { return []; }
}

// ─────────────────────────────────────────────────────────────────────────────
// Args fingerprint — canonical string of sorted keys → JSON → sha256
// ─────────────────────────────────────────────────────────────────────────────

export function fingerprintArgs(tool_id: string, verb: string, args: Record<string, string>): string {
  const canonical: Record<string, string> = {};
  for (const k of Object.keys(args).sort()) canonical[k] = args[k];
  const blob = JSON.stringify({ tool_id, verb, args: canonical });
  return createHash("sha256").update(blob).digest("hex");
}

// ─────────────────────────────────────────────────────────────────────────────
// Policy — Phase 4 ground truth, matches directive verbatim
// ─────────────────────────────────────────────────────────────────────────────

export interface PolicyDecision {
  effective_risk: RiskLevel;
  /** Engine demands an operator approval before this can run. */
  requires_approval: boolean;
  /**
   * Engine allows execution without approval but acknowledges the caller may
   * opt-in to approval (e.g. an operator who wants a second pair of eyes on
   * MEDIUM-tier operations like "create draft"). Set on MEDIUM only.
   */
  optional_approval: boolean;
  auto_run: boolean;
  blocked: boolean;
  reason: string;
  matched_patterns: string[];          // human-readable list of which verb patterns fired
}

/**
 * Verb patterns that PROMOTE a risk level. Per the Phase 4 directive's
 * matrix verbatim:
 *
 *   LOW      read / search / status / list                         → AUTO
 *   MEDIUM   create draft / prepare report / generate output       → OPTIONAL APPROVAL
 *   HIGH     send email / SMS / update customer / publish / modify
 *            business data                                         → REQUIRED APPROVAL
 *   BLOCKED  destructive cmds / delete customer / expose secrets /
 *            filesystem outside scope / financial transfers        → NEVER EXECUTE
 *
 * The Tool Registry entry's risk_level is the floor; verb patterns can only
 * raise it. Operators cannot lower risk via verb patterns — they edit the
 * registry entry instead, which is itself auditable.
 */
const MEDIUM_PROMOTE: Array<[string, RegExp]> = [
  ["create-draft",      /\bcreate[-_ ]?draft|draft[-_ ]?create\b/i],
  ["prepare-report",    /\bprepare[-_ ]?(?:a )?report|report[-_ ]?prepare\b/i],
  ["generate-output",   /\bgenerate[-_ ]?(?:output|content|copy|response|summary)\b/i],
];
const HIGH_PROMOTE: Array<[string, RegExp]> = [
  ["send-message",      /\b(send|deliver)[-_ ]?(email|sms|push|notification|message)\b/i],
  ["update-customer",   /\bupdate[-_ ]?(customer|account|user|profile)\b/i],
  ["publish-content",   /\b(publish|release|deploy|merge|rebase to (?:main|master)|push (?:to )?(?:main|master))\b/i],
  ["modify-business",   /\b(modify|change|alter|update)[-_ ]?(?:business[-_ ]?(?:data|record|object|entity|state))\b/i],
  ["issue-create",      /\bissue[-_ ]?create\b/i],
  ["financial-low",     /\b(charge|capture|refund|invoice)\b/i],
];
/**
 * BLOCKED — never execute. Each pattern includes a stable id used in the
 * `matched_patterns` array on the policy decision so MC + the audit ledger
 * can show *why* something was refused without re-running the regex.
 *
 * "filesystem outside scope" is best-effort: any absolute path that walks
 * into a sensitive system or credential directory.
 */
const BLOCKED_PROMOTE: Array<[string, RegExp]> = [
  ["destructive-cmd",   /\b(rm -rf|drop (?:table|database)|wipe|format (?:disk|drive)|truncate|chmod 777 \/)\b/i],
  ["delete-customer",   /\bdelete[-_ ]?(customer|user|account|all)\b/i],
  ["expose-secret",     /\b(expose|leak|print|cat|dump|exfiltrate)[-_ ]?(?:a )?secret\b/i],
  ["financial-transfer",/\b(transfer|wire|withdraw|move) (?:money|funds|usd|btc|eth|cash)\b/i],
  ["fs-outside-scope",  /(?:^|[\s"'=])(?:\/etc(?:\/|\b)|\/usr(?:\/|\b)|\/var\/(?:log|lib|spool)|\/private\/etc|\/Library\/Keychains|\/System\/|\/boot\/|~\/?\.ssh\b|~\/?\.aws\b|~\/?\.gnupg\b)/i],
];

export function classify(
  entryRisk: RiskLevel,
  action: { verb: string; risk_level?: RiskLevel },
  args: Record<string, string>,
): PolicyDecision {
  // Pick the higher of entry risk + action-level risk
  const order: RiskLevel[] = ["LOW", "MEDIUM", "HIGH", "BLOCKED"];
  let effective: RiskLevel = entryRisk;
  if (action.risk_level && order.indexOf(action.risk_level) > order.indexOf(effective)) {
    effective = action.risk_level;
  }

  // Promote via verb patterns. Evaluate over both the verb itself and the
  // arg values so e.g. `gh issue-comment --body "send email to customer"`
  // still promotes.
  const verbAndArgs = `${action.verb} ${Object.values(args).join(" ")}`;
  const matched_patterns: string[] = [];

  for (const [id, re] of BLOCKED_PROMOTE) if (re.test(verbAndArgs)) { effective = "BLOCKED"; matched_patterns.push(id); }
  if (effective !== "BLOCKED") {
    for (const [id, re] of HIGH_PROMOTE) if (re.test(verbAndArgs)) {
      if (order.indexOf("HIGH") > order.indexOf(effective)) effective = "HIGH";
      matched_patterns.push(id);
    }
  }
  if (effective !== "BLOCKED" && effective !== "HIGH") {
    for (const [id, re] of MEDIUM_PROMOTE) if (re.test(verbAndArgs)) {
      if (order.indexOf("MEDIUM") > order.indexOf(effective)) effective = "MEDIUM";
      matched_patterns.push(id);
    }
  }

  if (effective === "BLOCKED") {
    return { effective_risk: "BLOCKED", requires_approval: false, optional_approval: false, auto_run: false, blocked: true, reason: `policy: BLOCKED — ${matched_patterns.length ? `matched ${matched_patterns.join(", ")}` : "configured tier"}; refuses execution regardless of approval`, matched_patterns };
  }
  if (effective === "HIGH") {
    return { effective_risk: "HIGH", requires_approval: true, optional_approval: false, auto_run: false, blocked: false, reason: `policy: HIGH — operator approval required${matched_patterns.length ? ` (${matched_patterns.join(", ")})` : ""}`, matched_patterns };
  }
  if (effective === "MEDIUM") {
    return { effective_risk: "MEDIUM", requires_approval: false, optional_approval: true, auto_run: true, blocked: false, reason: `policy: MEDIUM — auto-run with audit; operator MAY request approval${matched_patterns.length ? ` (${matched_patterns.join(", ")})` : ""}`, matched_patterns };
  }
  return { effective_risk: "LOW", requires_approval: false, optional_approval: false, auto_run: true, blocked: false, reason: "policy: LOW — auto-run", matched_patterns };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tokens
// ─────────────────────────────────────────────────────────────────────────────

function newRequestId(): string {
  return `appr_${Date.now()}_${randomBytes(4).toString("hex")}`;
}
function newToken(): string {
  // 32 bytes → 64 hex chars. Plenty of entropy; trivial to revoke (queue burn).
  return `at_${randomBytes(32).toString("hex")}`;
}

function safeEqualToken(a: string | null, b: string | null): boolean {
  if (!a || !b) return false;
  const A = Buffer.from(a);
  const B = Buffer.from(b);
  if (A.length !== B.length) {
    timingSafeEqual(A, Buffer.alloc(A.length));  // dummy compare to keep timing flat
    return false;
  }
  return timingSafeEqual(A, B);
}

// ─────────────────────────────────────────────────────────────────────────────
// Expiry sweep — lazy: invoked on every read, marks stale requests "expired"
// ─────────────────────────────────────────────────────────────────────────────

function sweepExpired(): void {
  const q = readQueue();
  let dirty = false;
  const now = Date.now();
  for (const r of q.requests) {
    if (r.status === "pending" && r.expires_at && new Date(r.expires_at).getTime() < now) {
      r.status = "expired";
      r.decided_at = new Date().toISOString();
      r.decision_reason = "auto-expired";
      r.approval_token = null;
      appendHistory(r, "expired", "system");
      dirty = true;
    }
    // Drop tokens from any non-pending requests so the queue file never
    // sits on a live token longer than necessary.
    if (r.status !== "pending" && r.status !== "approved" && r.approval_token) {
      r.approval_token = null;
      dirty = true;
    }
  }
  if (dirty) writeQueue(q);
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Open a new approval request. Idempotent on (tool_id, verb, args_fingerprint,
 * workspace_id, task_id) within the last 60s — repeated Phase 3 calls do not
 * pile up duplicate pending requests in the queue.
 */
export function requestApproval(input: RequestApprovalInput): ApprovalRequest {
  sweepExpired();
  const q = readQueue();
  const fingerprint = fingerprintArgs(input.tool_id, input.verb, input.args);
  const now = Date.now();
  const recentMatch = q.requests.find((r) =>
    r.tool_id === input.tool_id &&
    r.verb === input.verb &&
    r.args_fingerprint === fingerprint &&
    r.workspace_id === input.workspace_id &&
    (r.task_id ?? null) === (input.task_id ?? null) &&
    r.status === "pending" &&
    new Date(r.requested_at).getTime() > now - 60_000,
  );
  if (recentMatch) return recentMatch;

  const expMin = Math.max(1, Math.min(60 * 8, input.expires_in_minutes ?? DEFAULT_EXPIRY_MIN));
  const r: ApprovalRequest = {
    id: newRequestId(),
    status: "pending",
    tool_id: input.tool_id,
    verb: input.verb,
    args: input.args,
    args_fingerprint: fingerprint,
    risk_level: input.risk_level,
    reason: input.reason,
    requested_by: input.requested_by ?? "baseline-os-executor",
    requested_at: new Date().toISOString(),
    workspace_id: input.workspace_id,
    decided_by: null,
    decided_at: null,
    decision_reason: null,
    approval_token: null,
    expires_at: new Date(now + expMin * 60_000).toISOString(),
    consumed_at: null,
    consumed_audit_id: null,
    task_id: input.task_id ?? null,
    decision_id: input.decision_id ?? null,
    audit_id_on_refusal: null,
  };
  q.requests.push(r);
  writeQueue(q);
  appendHistory(r, "requested", input.requested_by ?? "baseline-os-executor");
  return r;
}

export function listRequests(opts?: { workspace_id?: string; status?: ApprovalStatus }): ApprovalRequest[] {
  sweepExpired();
  return readQueue().requests
    .filter((r) => !opts?.workspace_id || r.workspace_id === opts.workspace_id)
    .filter((r) => !opts?.status || r.status === opts.status)
    .map((r) => ({ ...r, approval_token: r.approval_token ? "[ISSUED]" : null }))
    .reverse();  // newest first
}

export function getRequest(id: string, redactToken = true): ApprovalRequest | null {
  sweepExpired();
  const r = readQueue().requests.find((x) => x.id === id);
  if (!r) return null;
  if (redactToken && r.approval_token) return { ...r, approval_token: "[ISSUED]" };
  return r;
}

/**
 * Approve a pending request. Issues a single-use token bound to the request's
 * args_fingerprint. Returns the full request (with the actual token), so the
 * caller / UI can hand it to the executor on the retry call.
 */
export function approveRequest(id: string, opts: { decided_by: string; reason: string }): ApprovalRequest | { error: string } {
  sweepExpired();
  const q = readQueue();
  const idx = q.requests.findIndex((r) => r.id === id);
  if (idx === -1) return { error: `request "${id}" not found` };
  const r = q.requests[idx];
  if (r.status !== "pending") return { error: `request "${id}" status=${r.status} (cannot approve)` };

  r.status = "approved";
  r.decided_by = opts.decided_by;
  r.decided_at = new Date().toISOString();
  r.decision_reason = opts.reason || "(no reason given)";
  r.approval_token = newToken();
  q.requests[idx] = r;
  writeQueue(q);
  appendHistory(r, "approved", opts.decided_by);
  return r;
}

export function denyRequest(id: string, opts: { decided_by: string; reason: string }): ApprovalRequest | { error: string } {
  sweepExpired();
  const q = readQueue();
  const idx = q.requests.findIndex((r) => r.id === id);
  if (idx === -1) return { error: `request "${id}" not found` };
  const r = q.requests[idx];
  if (r.status !== "pending") return { error: `request "${id}" status=${r.status} (cannot deny)` };

  r.status = "denied";
  r.decided_by = opts.decided_by;
  r.decided_at = new Date().toISOString();
  r.decision_reason = opts.reason || "(no reason given)";
  r.approval_token = null;
  q.requests[idx] = r;
  writeQueue(q);
  appendHistory(r, "denied", opts.decided_by);
  return { ...r, approval_token: null };
}

/**
 * Verify an approval token against an in-flight execution and consume it on
 * success. The token must:
 *   · belong to a request whose status is "approved"
 *   · target the same tool_id + verb
 *   · match the args_fingerprint we computed from the live args
 *   · not be expired
 * On success the engine marks the request "consumed" and burns the token.
 */
export interface VerifyResult {
  ok: boolean;
  request_id?: string;
  reason: string;
}

export function verifyAndConsume(input: {
  tool_id: string;
  verb: string;
  args: Record<string, string>;
  approval_token: string;
  consumed_audit_id: string;
}): VerifyResult {
  sweepExpired();
  if (!input.approval_token || !input.approval_token.startsWith("at_")) {
    return { ok: false, reason: "approval_token missing or malformed (expected at_<hex>)" };
  }
  const q = readQueue();
  const idx = q.requests.findIndex((r) => safeEqualToken(r.approval_token ?? null, input.approval_token));
  if (idx === -1) return { ok: false, reason: "approval_token not recognized — either unissued, already consumed, or queue-rotated" };
  const r = q.requests[idx];

  if (r.status !== "approved") return { ok: false, request_id: r.id, reason: `request status is "${r.status}" (need "approved")` };
  if (new Date(r.expires_at).getTime() < Date.now()) {
    r.status = "expired";
    writeQueue(q);
    return { ok: false, request_id: r.id, reason: "approval expired before consumption" };
  }
  if (r.tool_id !== input.tool_id || r.verb !== input.verb) {
    return { ok: false, request_id: r.id, reason: `token bound to ${r.tool_id}.${r.verb}, not ${input.tool_id}.${input.verb}` };
  }
  const liveFp = fingerprintArgs(input.tool_id, input.verb, input.args);
  if (liveFp !== r.args_fingerprint) {
    return { ok: false, request_id: r.id, reason: "args fingerprint mismatch — args differ from what was approved" };
  }

  r.status = "consumed";
  r.consumed_at = new Date().toISOString();
  r.consumed_audit_id = input.consumed_audit_id;
  r.approval_token = null;          // burn
  q.requests[idx] = r;
  writeQueue(q);
  appendHistory(r, "consumed", r.decided_by ?? "system");
  return { ok: true, request_id: r.id, reason: "approved + consumed" };
}

// ─────────────────────────────────────────────────────────────────────────────
// Stats
// ─────────────────────────────────────────────────────────────────────────────

export interface ApprovalStats {
  total: number;
  pending: number;
  approved: number;
  denied: number;
  expired: number;
  consumed: number;
  blocked_refusals_24h: number;
}

export function getStats(): ApprovalStats {
  const q = readQueue();
  const stats: ApprovalStats = {
    total: q.requests.length, pending: 0, approved: 0, denied: 0, expired: 0, consumed: 0,
    blocked_refusals_24h: 0,
  };
  for (const r of q.requests) {
    stats[r.status]++;
  }
  // Count BLOCKED refusals from history in the last 24h
  try {
    const history = readHistoryTail(500);
    const cutoff = Date.now() - 24 * 60 * 60_000;
    for (const e of history as any[]) {
      if (e?.event === "requested" && e?.request?.risk_level === "BLOCKED" && new Date(e.ts).getTime() > cutoff) {
        stats.blocked_refusals_24h++;
      }
    }
  } catch { /* skip */ }
  return stats;
}
