/**
 * Tool Registry — Baseline OS Phase 3.
 *
 * The Execution Tool Registry. Phase 2 generates routing *decisions*; Phase 3
 * is how Baseline OS actually *executes* them — via approved CLI/API/browser
 * tools with workspace scope, role gates, audit, approval policy, and
 * secret redaction.
 *
 * NON-NEGOTIABLE security rules (per directive):
 *   · spawn() only — argv assembled from typed inputs, never shell-interpolated
 *   · approved tools only — no arbitrary binary execution
 *   · risk_level gates execution path:
 *       LOW       → auto-run
 *       MEDIUM    → approval required
 *       HIGH      → approval required + extra logging
 *       BLOCKED   → refuses execution
 *   · secrets are referenced by env-var NAME only; never logged, never in argv
 *   · workspace_id scopes which tools an operator can see + run
 *   · every execution is appended to ~/.claude-os/tool-executions.jsonl
 *     (audit ledger) and pushed to MC if connected
 *
 * The registry on disk:
 *   ~/.claude-os/tool-registry.json     persisted entries (seed at boot)
 *   ~/.claude-os/tool-executions.jsonl  append-only execution audit
 *
 * The directive forbids "another framework / dashboard / orchestrator /
 * marketplace / memory system". This module is none of those — it is a
 * typed *catalog* plus a *spawn wrapper* with policy. ~600 lines total.
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
import { spawn } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";

import { listRuntimes, type RuntimeRecord } from "./runtime-registry";
import { publishApprovalEvent, publishToolExecution } from "./mission-control-sync";
import {
  classify as classifyRisk,
  fingerprintArgs,
  requestApproval,
  verifyAndConsume,
  type PolicyDecision,
  type RiskLevel as EngineRiskLevel,
} from "./approval-engine";

function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "BLOCKED";
export type ApprovalPolicy = "auto" | "approval-required" | "blocked";
export type InstalledStatus = "available" | "installed" | "broken";
export type EnabledStatus = "enabled" | "disabled";

export interface ToolAction {
  /** Verb the operator + router refer to it by. Letters / dashes only. */
  verb: string;
  description: string;
  /**
   * argv template. Tokens of the form `${name}` are filled from the call's
   * `args` map after they pass the input_schema validator. Tokens never
   * carry shell metacharacters — they go straight to spawn() as separate
   * argv entries.
   */
  argv: string[];
  /** Per-action input schema (key → required + simple type). */
  input_schema: Record<string, { type: "string" | "number" | "boolean"; required?: boolean; pattern?: string; max_length?: number }>;
  /** Documented output shape. Informational; we don't validate the output. */
  output_schema: Record<string, unknown>;
  /** Per-action override of the entry's risk_level. Optional. */
  risk_level?: RiskLevel;
  /** Exit-code matcher for success. Default: 0 only. */
  success_exit_codes?: number[];
  /** Soft timeout for the spawned process. */
  timeout_ms?: number;
}

export interface ToolExample {
  description: string;
  verb: string;
  args: Record<string, string>;
  expected_exit_code: number;
}

export interface ToolRegistryEntry {
  id: string;                          // stable id, e.g. "mc", "gh", "notion-q"
  cli_name: string;                    // executable on PATH or absolute path
  category: string;                    // "knowledge", "infra", "ops", "comms", ...
  description: string;
  workspace_id: string;                // "*" = tenant-wide; else specific id
  installed_status: InstalledStatus;
  enabled_status: EnabledStatus;
  allowed_runtimes: string[];          // Phase 1 runtime_type set (or ["*"])
  allowed_agents: string[];            // ["*"] in Phase 3
  required_secrets: string[];          // env var names ONLY — never values
  risk_level: RiskLevel;               // entry-level default; actions may override
  approval_policy: ApprovalPolicy;
  supported_actions: ToolAction[];
  examples: ToolExample[];
  audit_required: boolean;
  // Telemetry — updated on each execution
  last_used_at: string | null;
  success_count: number;
  failure_count: number;
  average_runtime_ms: number;
  logs_enabled: boolean;
}

export interface ToolRegistryShape {
  version: 1;
  generated_at: string;
  entries: ToolRegistryEntry[];
}

export interface ExecutionRequest {
  tool_id: string;
  verb: string;
  args: Record<string, string>;
  workspace_id?: string;
  task_id?: string | number | null;
  decision_id?: string | null;
  approval_token?: string | null;      // operator-issued; Phase 4 binds to real engine
  /**
   * Phase 4 opt-in: a caller (operator UI / supervisor) can force the engine
   * to queue an approval even when the policy says auto_run is fine. Honored
   * for MEDIUM tier (the "OPTIONAL APPROVAL" tier from the directive). No-op
   * on LOW (already auto), HIGH (already gated), BLOCKED (never executes).
   */
  request_approval?: boolean;
}

/**
 * Proof — a tamper-evident receipt of what happened during a single tool
 * call. Phase 4 makes this an explicit deliverable on every ExecutionResult
 * so MC + the operator UI never have to reconstruct it from logs.
 *
 * The two SHA-256 hashes let MC verify that the stdout/stderr surfaced in
 * a comment matches what the executor saw, even if the comment was edited
 * later.
 */
export interface ExecutionProof {
  audit_id: string;
  tool_id: string;
  verb: string;
  effective_risk: "LOW" | "MEDIUM" | "HIGH" | "BLOCKED";
  started_at: string;
  finished_at: string;
  duration_ms: number;
  exit_code: number | null;
  approved: boolean;
  approval_request_id: string | null;   // set when an approval was consumed
  args_fingerprint: string;             // SHA-256 over the canonical-sorted args
  stdout_sha256: string;                // SHA-256 over the captured stdout
  stderr_sha256: string;                // SHA-256 over the captured stderr
  matched_policy_patterns: string[];    // ids of any verb/arg patterns that fired
}

export interface ExecutionResult {
  ok: boolean;
  audit_id: string;
  tool_id: string;
  verb: string;
  argv_redacted: string[];             // argv with secret tokens redacted (Phase 3 → no secrets in argv at all)
  exit_code: number | null;
  signal: string | null;
  stdout: string;
  stderr: string;
  duration_ms: number;
  started_at: string;
  finished_at: string;
  approved: boolean;
  refused_reason: string | null;
  task_id: string | number | null;
  decision_id: string | null;
  workspace_id: string;
  /** Phase 4 deliverable — explicit proof receipt for this execution. */
  proof: ExecutionProof;
}

// ─────────────────────────────────────────────────────────────────────────────
// On-disk persistence
// ─────────────────────────────────────────────────────────────────────────────

const REGISTRY_DIR = join(homedir(), ".claude-os");
const REGISTRY_PATH = join(REGISTRY_DIR, "tool-registry.json");
const AUDIT_PATH = join(REGISTRY_DIR, "tool-executions.jsonl");

function ensureDir(): void {
  if (!existsSync(REGISTRY_DIR)) mkdirSync(REGISTRY_DIR, { recursive: true });
}

function readRegistry(): ToolRegistryShape {
  if (!existsSync(REGISTRY_PATH)) return { version: 1, generated_at: new Date().toISOString(), entries: [] };
  try {
    const parsed = JSON.parse(readFileSync(REGISTRY_PATH, "utf8")) as ToolRegistryShape;
    if (parsed.version !== 1 || !Array.isArray(parsed.entries)) return { version: 1, generated_at: new Date().toISOString(), entries: [] };
    return parsed;
  } catch { return { version: 1, generated_at: new Date().toISOString(), entries: [] }; }
}

function writeRegistry(reg: ToolRegistryShape): void {
  ensureDir();
  const tmp = `${REGISTRY_PATH}.tmp.${process.pid}`;
  writeFileSync(tmp, JSON.stringify({ ...reg, generated_at: new Date().toISOString() }, null, 2), "utf8");
  renameSync(tmp, REGISTRY_PATH);
}

function appendAudit(rec: ExecutionResult): void {
  try {
    ensureDir();
    appendFileSync(AUDIT_PATH, JSON.stringify(rec) + "\n", "utf8");
  } catch { /* never block execution on audit append failure */ }
}

export function readAuditTail(limit = 50, toolFilter?: string): ExecutionResult[] {
  if (!existsSync(AUDIT_PATH)) return [];
  try {
    const lines = readFileSync(AUDIT_PATH, "utf8").trim().split("\n").filter(Boolean);
    const rows = lines.map((l) => JSON.parse(l) as ExecutionResult);
    const filtered = toolFilter ? rows.filter((r) => r.tool_id === toolFilter) : rows;
    return filtered.slice(-limit);
  } catch { return []; }
}

// ─────────────────────────────────────────────────────────────────────────────
// Installed-status probing — `which <cli_name>` (no shell)
// ─────────────────────────────────────────────────────────────────────────────

function probeBinary(cli_name: string): InstalledStatus {
  if (!cli_name) return "broken";
  // Allow absolute paths
  if (cli_name.startsWith("/") || cli_name.startsWith("~")) {
    const p = cli_name.replace(/^~/, homedir());
    return existsSync(p) ? "installed" : "available";
  }
  // Look up on PATH via spawn (no shell, no env injection beyond what we control)
  return new Promise<InstalledStatus>(() => undefined) as any;   // unused — replaced by sync probe below
}

function probeBinarySync(cli_name: string): InstalledStatus {
  if (!cli_name) return "broken";
  if (cli_name.startsWith("/") || cli_name.startsWith("~")) {
    const p = cli_name.replace(/^~/, homedir());
    return existsSync(p) ? "installed" : "available";
  }
  // Walk PATH for the executable. Avoids running any shell.
  const PATH = (process.env.PATH ?? "").split(":");
  for (const dir of PATH) {
    if (!dir) continue;
    const full = join(dir, cli_name);
    if (existsSync(full)) return "installed";
  }
  return "available";
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API: list / get / upsert / enable / disable / probe-all
// ─────────────────────────────────────────────────────────────────────────────

export function listEntries(workspaceId?: string): ToolRegistryEntry[] {
  return readRegistry().entries
    .filter((e) => !workspaceId || e.workspace_id === "*" || e.workspace_id === workspaceId)
    .map((e) => ({ ...e, installed_status: probeBinarySync(e.cli_name) }));
}

export function getEntry(id: string): ToolRegistryEntry | null {
  const e = readRegistry().entries.find((x) => x.id === id);
  return e ? { ...e, installed_status: probeBinarySync(e.cli_name) } : null;
}

export function upsertEntry(entry: ToolRegistryEntry): ToolRegistryEntry {
  const reg = readRegistry();
  const idx = reg.entries.findIndex((e) => e.id === entry.id);
  const updated: ToolRegistryEntry = { ...entry, installed_status: probeBinarySync(entry.cli_name) };
  if (idx === -1) reg.entries.push(updated); else reg.entries[idx] = updated;
  writeRegistry(reg);
  return updated;
}

export function setEnabled(id: string, enabled: boolean): ToolRegistryEntry | null {
  const reg = readRegistry();
  const idx = reg.entries.findIndex((e) => e.id === id);
  if (idx === -1) return null;
  reg.entries[idx].enabled_status = enabled ? "enabled" : "disabled";
  writeRegistry(reg);
  return reg.entries[idx];
}

export function probeAll(): ToolRegistryEntry[] {
  const reg = readRegistry();
  for (const e of reg.entries) e.installed_status = probeBinarySync(e.cli_name);
  writeRegistry(reg);
  return reg.entries;
}

// ─────────────────────────────────────────────────────────────────────────────
// Schema validation (Phase 3 — small, strict, no JSON-Schema dependency)
// ─────────────────────────────────────────────────────────────────────────────

export interface ValidationResult { ok: boolean; errors: string[]; coerced: Record<string, string> }

export function validateArgs(action: ToolAction, args: Record<string, string>): ValidationResult {
  const errors: string[] = [];
  const coerced: Record<string, string> = {};
  for (const [name, spec] of Object.entries(action.input_schema)) {
    const raw = args[name];
    if (raw == null || raw === "") {
      if (spec.required) errors.push(`missing required arg "${name}"`);
      continue;
    }
    if (spec.type === "string") {
      if (spec.pattern && !new RegExp(spec.pattern).test(raw)) errors.push(`"${name}" failed pattern /${spec.pattern}/`);
      if (spec.max_length && raw.length > spec.max_length) errors.push(`"${name}" exceeds max_length ${spec.max_length}`);
      coerced[name] = raw;
    } else if (spec.type === "number") {
      if (!/^-?\d+(\.\d+)?$/.test(raw)) errors.push(`"${name}" is not a number`);
      coerced[name] = raw;
    } else if (spec.type === "boolean") {
      if (!/^(true|false)$/i.test(raw)) errors.push(`"${name}" is not a boolean`);
      coerced[name] = raw.toLowerCase();
    }
  }
  // Reject unknown args — strict by default
  for (const k of Object.keys(args)) if (!(k in action.input_schema)) errors.push(`unexpected arg "${k}"`);
  return { ok: errors.length === 0, errors, coerced };
}

// ─────────────────────────────────────────────────────────────────────────────
// Approval gate
// ─────────────────────────────────────────────────────────────────────────────

function effectiveRisk(entry: ToolRegistryEntry, action: ToolAction): RiskLevel {
  return action.risk_level ?? entry.risk_level;
}

// ─────────────────────────────────────────────────────────────────────────────
// argv expansion — tokens of form ${name} → args[name]. NEVER shell-eval.
// ─────────────────────────────────────────────────────────────────────────────

function expandArgv(template: string[], args: Record<string, string>): string[] {
  return template.map((t) => {
    return t.replace(/\$\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g, (_, n) => args[n] ?? "");
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// runtime-allowed check
// ─────────────────────────────────────────────────────────────────────────────

export function runtimeAllowed(entry: ToolRegistryEntry, runtimeType: string): boolean {
  if (entry.allowed_runtimes.includes("*")) return true;
  return entry.allowed_runtimes.includes(runtimeType);
}

// ─────────────────────────────────────────────────────────────────────────────
// Execute — the only side-effecting operation in this module
// ─────────────────────────────────────────────────────────────────────────────

export async function executeTool(req: ExecutionRequest): Promise<ExecutionResult> {
  const audit_id = `tx_${Date.now()}_${randomBytes(4).toString("hex")}`;
  const started_at = new Date().toISOString();
  const workspace_id = req.workspace_id ?? "local";

  // Helper: build a proof block for any result. Closes over audit_id, req, etc.
  // so individual return sites only pass the fields that change.
  function makeProof(overrides: Partial<ExecutionProof> = {}): ExecutionProof {
    return {
      audit_id,
      tool_id: req.tool_id,
      verb: req.verb,
      effective_risk: "LOW",
      started_at,
      finished_at: new Date().toISOString(),
      duration_ms: 0,
      exit_code: null,
      approved: false,
      approval_request_id: null,
      args_fingerprint: fingerprintArgs(req.tool_id, req.verb, req.args ?? {}),
      stdout_sha256: sha256(""),
      stderr_sha256: sha256(""),
      matched_policy_patterns: [],
      ...overrides,
    };
  }

  const baseResult: ExecutionResult = {
    ok: false,
    audit_id,
    tool_id: req.tool_id,
    verb: req.verb,
    argv_redacted: [],
    exit_code: null,
    signal: null,
    stdout: "",
    stderr: "",
    duration_ms: 0,
    started_at,
    finished_at: started_at,
    approved: false,
    refused_reason: null,
    task_id: req.task_id ?? null,
    decision_id: req.decision_id ?? null,
    workspace_id,
    proof: makeProof(),
  };

  // Helper: package + audit a refusal. Single call site for every early exit.
  // Also fans out to MC when the refusal is linked to a task so the supervisor
  // sees the refusal landed (not just the routing decision).
  function refuse(reason: string, extras: Partial<ExecutionResult> = {}, proof: Partial<ExecutionProof> = {}): ExecutionResult {
    const r: ExecutionResult = {
      ...baseResult,
      refused_reason: reason,
      ...extras,
      proof: makeProof(proof),
    };
    appendAudit(r);
    if (r.task_id != null) {
      void publishToolExecution({
        task_id: r.task_id,
        tool_id: r.tool_id,
        verb: r.verb,
        audit_id: r.audit_id,
        ok: false,
        exit_code: null,
        duration_ms: 0,
        approved: r.approved,
        argv: [],
        stdout_head: "",
        stderr_head: "",
        refused_reason: r.refused_reason,
        decision_id: r.decision_id,
      }).catch(() => null);
    }
    return r;
  }

  const entry = getEntry(req.tool_id);
  if (!entry) return refuse(`unknown tool "${req.tool_id}"`);
  const action = entry.supported_actions.find((a) => a.verb === req.verb);
  if (!action) return refuse(`unknown verb "${req.verb}" for tool "${entry.id}"`, {}, { effective_risk: entry.risk_level });
  if (entry.installed_status !== "installed") return refuse(`tool not installed on this machine (status=${entry.installed_status})`, {}, { effective_risk: entry.risk_level });

  // Workspace scope
  if (entry.workspace_id !== "*" && entry.workspace_id !== workspace_id) {
    return refuse(`tool registered for workspace "${entry.workspace_id}", request was for "${workspace_id}"`, {}, { effective_risk: entry.risk_level });
  }

  // Validate args
  const v = validateArgs(action, req.args);
  if (!v.ok) return refuse(`validation failed: ${v.errors.join("; ")}`, {}, { effective_risk: entry.risk_level });

  // Phase 4 — Approval Engine
  //
  // Policy classification respects the Tool Registry risk_level, the action
  // override, and verb-pattern promotion (LOW/MEDIUM/HIGH/BLOCKED matrix).
  if (entry.enabled_status === "disabled") return refuse("tool disabled for this workspace", {}, { effective_risk: entry.risk_level });
  if (entry.approval_policy === "blocked") return refuse("tool approval_policy=blocked", {}, { effective_risk: "BLOCKED" });

  const policy: PolicyDecision = classifyRisk(entry.risk_level, { verb: action.verb, risk_level: action.risk_level }, v.coerced);
  if (policy.blocked) {
    return refuse(policy.reason, {}, { effective_risk: "BLOCKED", matched_policy_patterns: policy.matched_patterns });
  }

  // Phase 4 directive: MEDIUM is "OPTIONAL APPROVAL". An operator can force
  // approval on it by setting request_approval=true on the request. HIGH is
  // always required; LOW is always auto.
  const need_approval = policy.requires_approval || (policy.optional_approval && req.request_approval === true);

  if (need_approval) {
    if (req.approval_token) {
      const check = verifyAndConsume({
        tool_id: req.tool_id,
        verb: req.verb,
        args: v.coerced,
        approval_token: req.approval_token,
        consumed_audit_id: audit_id,
      });
      if (!check.ok) {
        return refuse(`approval rejected: ${check.reason}`, {}, {
          effective_risk: policy.effective_risk,
          approval_request_id: check.request_id ?? null,
          matched_policy_patterns: policy.matched_patterns,
        });
      }
      // Token verified + consumed — continue to spawn. Stash the request id on
      // baseResult so the final proof keeps the linkage.
      (baseResult as any).__approval_request_id = check.request_id ?? null;
    } else {
      const open = requestApproval({
        tool_id: req.tool_id,
        verb: req.verb,
        args: v.coerced,
        risk_level: policy.effective_risk,
        reason: policy.reason,
        workspace_id,
        task_id: req.task_id ?? null,
        decision_id: req.decision_id ?? null,
      });
      // Fanout the queue-open event to MC so the supervisor sees the request
      // land on the linked task (not just when an operator decides it).
      if (req.task_id != null) {
        void publishApprovalEvent({
          task_id: req.task_id,
          request_id: open.id,
          event: "requested",
          tool_id: req.tool_id,
          verb: req.verb,
          risk_level: policy.effective_risk,
          decision_reason: policy.reason,
          args: v.coerced,
          decision_id: req.decision_id ?? null,
        }).catch(() => null);
      }
      return refuse(
        `approval pending — operator must approve "${open.id}" (expires ${open.expires_at})`,
        { approval_request_id: open.id, approval_expires_at: open.expires_at } as any,
        {
          effective_risk: policy.effective_risk,
          approval_request_id: open.id,
          matched_policy_patterns: policy.matched_patterns,
        },
      );
    }
  }
  // LOW auto-runs. MEDIUM auto-runs with audit (unless caller opted in above).

  // Resolve required secrets into the spawn env — never logged, never in argv
  const env: Record<string, string> = { PATH: process.env.PATH ?? "" };
  for (const secret of entry.required_secrets) {
    const val = process.env[secret];
    if (!val) {
      return refuse(`required secret "${secret}" missing from env`, { approved: true }, {
        effective_risk: policy.effective_risk,
        matched_policy_patterns: policy.matched_patterns,
        approved: true,
      });
    }
    env[secret] = val;
  }
  // Forward HOME so tools that read config from $HOME (like gh) work
  if (process.env.HOME) env.HOME = process.env.HOME;

  // Expand argv
  const argv = expandArgv(action.argv, v.coerced);

  // Spawn
  const timeout = action.timeout_ms ?? 30_000;
  const startMs = Date.now();
  const result = await new Promise<{ exit: number | null; signal: string | null; stdout: string; stderr: string }>((resolve) => {
    let stdout = "";
    let stderr = "";
    let settled = false;
    const child = spawn(entry.cli_name, argv, { env, stdio: ["ignore", "pipe", "pipe"], shell: false });
    const killTimer = setTimeout(() => {
      if (!settled) { try { child.kill("SIGKILL"); } catch { /* ignore */ } stderr += `\n[tool-registry] killed after ${timeout}ms timeout`; }
    }, timeout);
    child.stdout.on("data", (b: Buffer) => { stdout += b.toString(); if (stdout.length > 65536) stdout = stdout.slice(-65536); });
    child.stderr.on("data", (b: Buffer) => { stderr += b.toString(); if (stderr.length > 65536) stderr = stderr.slice(-65536); });
    child.on("error", (e) => { if (!settled) { settled = true; clearTimeout(killTimer); resolve({ exit: null, signal: null, stdout, stderr: stderr + `\n[tool-registry] spawn error: ${e.message}` }); } });
    child.on("close", (code, sig) => { if (!settled) { settled = true; clearTimeout(killTimer); resolve({ exit: code, signal: sig, stdout, stderr }); } });
  });

  const duration_ms = Date.now() - startMs;
  const successCodes = action.success_exit_codes ?? [0];
  const okExit = result.exit != null && successCodes.includes(result.exit);
  const finished_at = new Date().toISOString();
  const approval_request_id = (baseResult as any).__approval_request_id ?? null;

  const final: ExecutionResult = {
    ...baseResult,
    ok: okExit,
    approved: true,
    argv_redacted: argv,        // Phase 3 secrets never enter argv → no redaction needed
    exit_code: result.exit,
    signal: result.signal,
    stdout: result.stdout,
    stderr: result.stderr,
    duration_ms,
    finished_at,
    proof: makeProof({
      effective_risk: policy.effective_risk,
      finished_at,
      duration_ms,
      exit_code: result.exit,
      approved: true,
      approval_request_id,
      stdout_sha256: sha256(result.stdout),
      stderr_sha256: sha256(result.stderr),
      matched_policy_patterns: policy.matched_patterns,
    }),
  };

  // Update entry telemetry (best-effort)
  try {
    const reg = readRegistry();
    const i = reg.entries.findIndex((e) => e.id === entry.id);
    if (i !== -1) {
      reg.entries[i].last_used_at = final.finished_at;
      if (okExit) reg.entries[i].success_count++; else reg.entries[i].failure_count++;
      const total = reg.entries[i].success_count + reg.entries[i].failure_count;
      reg.entries[i].average_runtime_ms = Math.round(
        (reg.entries[i].average_runtime_ms * (total - 1) + duration_ms) / Math.max(1, total),
      );
      writeRegistry(reg);
    }
  } catch { /* never block on telemetry */ }

  appendAudit(final);

  // Fire-and-log: if the request linked a task_id, push the execution result
  // to Mission Control as a comment. Failures (auth / unreachable / etc) are
  // surfaced via the audit ledger but never block the caller.
  if (final.task_id != null) {
    try {
      const tele = await publishToolExecution({
        task_id: final.task_id,
        tool_id: final.tool_id,
        verb: final.verb,
        audit_id: final.audit_id,
        ok: final.ok,
        exit_code: final.exit_code,
        duration_ms: final.duration_ms,
        approved: final.approved,
        argv: final.argv_redacted,
        stdout_head: final.stdout.slice(0, 600),
        stderr_head: final.stderr.slice(0, 600),
        refused_reason: final.refused_reason,
        decision_id: final.decision_id,
      });
      if (!tele.ok) {
        // Append a sentinel marker to the audit so operators can grep telemetry failures.
        appendAudit({ ...final, audit_id: final.audit_id + "_tele_fail", refused_reason: `MC telemetry failed: HTTP ${tele.status}: ${tele.error ?? "unknown"}` });
      }
    } catch (e: any) {
      appendAudit({ ...final, audit_id: final.audit_id + "_tele_fail", refused_reason: `MC telemetry threw: ${e?.message ?? String(e)}` });
    }
  }

  return final;
}

// ─────────────────────────────────────────────────────────────────────────────
// Seed registry — the canonical opening 3 entries. Idempotent: only inserts
// when the id is missing so operator edits aren't clobbered on boot.
// ─────────────────────────────────────────────────────────────────────────────

const SEED_ENTRIES: ToolRegistryEntry[] = [
  {
    id: "mc",
    cli_name: "/Users/walt/code/claude-os/bin/mc",
    category: "ops",
    description: "Baseline OS operator control surface — runtime + sync + route inspection.",
    workspace_id: "*",
    installed_status: "installed",
    enabled_status: "enabled",
    allowed_runtimes: ["*"],
    allowed_agents: ["*"],
    required_secrets: [],
    risk_level: "LOW",
    approval_policy: "auto",
    audit_required: true,
    logs_enabled: true,
    last_used_at: null,
    success_count: 0,
    failure_count: 0,
    average_runtime_ms: 0,
    supported_actions: [
      {
        verb: "runtime-list",
        description: "List every registered runtime + status + capabilities.",
        argv: ["runtime", "list", "--json"],
        input_schema: {},
        output_schema: { ok: "boolean", runtimes: "Array<RuntimeRecord>" },
        success_exit_codes: [0],
        timeout_ms: 5000,
      },
      {
        verb: "sync-status",
        description: "Show Mission Control sync config + queue + counters.",
        argv: ["sync", "status", "--json"],
        input_schema: {},
        output_schema: { ok: "boolean", state: "SyncState" },
        success_exit_codes: [0],
        timeout_ms: 5000,
      },
      {
        verb: "route-preview",
        description: "Dry-run the workforce router for a task description.",
        argv: ["route", "preview", "--json", "${description}"],
        input_schema: { description: { type: "string", required: true, max_length: 1000 } },
        output_schema: { ok: "boolean", decision: "RoutingDecision" },
        success_exit_codes: [0],
        timeout_ms: 8000,
      },
    ],
    examples: [
      { description: "Show all runtimes", verb: "runtime-list", args: {}, expected_exit_code: 0 },
      { description: "Inspect sync state", verb: "sync-status", args: {}, expected_exit_code: 0 },
      { description: "Route a coding task", verb: "route-preview", args: { description: "fix bug in auth.ts" }, expected_exit_code: 0 },
    ],
  },
  {
    id: "gh",
    cli_name: "gh",
    category: "knowledge",
    description: "GitHub CLI — repos, issues, PRs, releases. Authenticated via GH keyring.",
    workspace_id: "*",
    installed_status: "installed",
    enabled_status: "enabled",
    allowed_runtimes: ["claude-code", "codex", "openclaw", "*"],
    allowed_agents: ["*"],
    required_secrets: [],     // gh stores its token in the OS keychain, not env
    risk_level: "LOW",
    approval_policy: "auto",
    audit_required: true,
    logs_enabled: true,
    last_used_at: null,
    success_count: 0,
    failure_count: 0,
    average_runtime_ms: 0,
    supported_actions: [
      {
        verb: "auth-status",
        description: "Verify gh auth + token scopes.",
        argv: ["auth", "status"],
        input_schema: {},
        output_schema: { stdout: "human-readable status" },
        risk_level: "LOW",
        success_exit_codes: [0],
        timeout_ms: 5000,
      },
      {
        verb: "repo-view",
        description: "Show a repository's metadata (no writes).",
        argv: ["repo", "view", "${repo}", "--json", "name,description,stargazerCount,isPrivate"],
        input_schema: { repo: { type: "string", required: true, pattern: "^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$", max_length: 100 } },
        output_schema: { name: "string", description: "string", stargazerCount: "number", isPrivate: "boolean" },
        risk_level: "LOW",
        success_exit_codes: [0],
        timeout_ms: 8000,
      },
      {
        verb: "issue-list",
        description: "List open issues for a repository (read-only).",
        argv: ["issue", "list", "--repo", "${repo}", "--state", "open", "--limit", "10", "--json", "number,title,state,labels"],
        input_schema: { repo: { type: "string", required: true, pattern: "^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$", max_length: 100 } },
        output_schema: { issues: "Array<{number,title,state,labels}>" },
        risk_level: "LOW",
        success_exit_codes: [0],
        timeout_ms: 8000,
      },
      {
        verb: "issue-create",
        description: "Open a new issue. HIGH risk per directive (modify business data → required approval).",
        argv: ["issue", "create", "--repo", "${repo}", "--title", "${title}", "--body", "${body}"],
        input_schema: {
          repo:  { type: "string", required: true, pattern: "^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$", max_length: 100 },
          title: { type: "string", required: true, max_length: 200 },
          body:  { type: "string", required: true, max_length: 4000 },
        },
        output_schema: { stdout: "issue URL" },
        risk_level: "HIGH",
        success_exit_codes: [0],
        timeout_ms: 15000,
      },
    ],
    examples: [
      { description: "Check gh auth", verb: "auth-status", args: {}, expected_exit_code: 0 },
      { description: "View this repo", verb: "repo-view", args: { repo: "WaltLuv/baseline-agent-os" }, expected_exit_code: 0 },
    ],
  },
  {
    id: "notion-q",
    cli_name: "/Users/walt/code/claude-os/bin/notion-q",
    category: "knowledge",
    description: "Token-safe Notion API shim — whoami, search, page-get. NOTION_TOKEN read from env only, never argv.",
    workspace_id: "*",
    installed_status: "installed",
    enabled_status: "enabled",
    allowed_runtimes: ["hermes", "claude-code", "*"],
    allowed_agents: ["*"],
    required_secrets: ["NOTION_TOKEN"],
    risk_level: "LOW",
    approval_policy: "auto",
    audit_required: true,
    logs_enabled: true,
    last_used_at: null,
    success_count: 0,
    failure_count: 0,
    average_runtime_ms: 0,
    supported_actions: [
      {
        verb: "whoami",
        description: "Identify the bot user the NOTION_TOKEN belongs to.",
        argv: ["whoami"],
        input_schema: {},
        output_schema: { object: "user", id: "string", name: "string", bot: "object" },
        risk_level: "LOW",
        success_exit_codes: [0],
        timeout_ms: 8000,
      },
      {
        verb: "search",
        description: "Search Notion pages + databases by free-text query.",
        argv: ["search", "${query}"],
        input_schema: { query: { type: "string", required: true, max_length: 200 } },
        output_schema: { results: "Array<{id,object,title?,url?}>" },
        risk_level: "LOW",
        success_exit_codes: [0],
        timeout_ms: 8000,
      },
      {
        verb: "page-get",
        description: "Retrieve a Notion page by its id.",
        argv: ["page-get", "${page_id}"],
        input_schema: { page_id: { type: "string", required: true, max_length: 64, pattern: "^[a-zA-Z0-9-]+$" } },
        output_schema: { object: "page", id: "string", properties: "object" },
        risk_level: "LOW",
        success_exit_codes: [0],
        timeout_ms: 8000,
      },
      {
        verb: "page-delete",
        description: "Permanently delete a Notion page. BLOCKED — never executes regardless of approval (irreversible destructive action on business data).",
        argv: ["page-delete", "${page_id}"],
        input_schema: { page_id: { type: "string", required: true, max_length: 64, pattern: "^[a-zA-Z0-9-]+$" } },
        output_schema: {},
        risk_level: "BLOCKED",
        success_exit_codes: [0],
        timeout_ms: 8000,
      },
    ],
    examples: [
      { description: "Verify token", verb: "whoami", args: {}, expected_exit_code: 0 },
      { description: "Find a doc", verb: "search", args: { query: "Baseline OS" }, expected_exit_code: 0 },
    ],
  },
];

export function seedRegistry(force = false): { inserted: string[]; existing: string[] } {
  const reg = readRegistry();
  const have = new Set(reg.entries.map((e) => e.id));
  const inserted: string[] = [];
  const existing: string[] = [];
  for (const seed of SEED_ENTRIES) {
    if (have.has(seed.id) && !force) { existing.push(seed.id); continue; }
    const fresh: ToolRegistryEntry = { ...seed, installed_status: probeBinarySync(seed.cli_name) };
    const idx = reg.entries.findIndex((e) => e.id === seed.id);
    if (idx === -1) reg.entries.push(fresh); else reg.entries[idx] = fresh;
    inserted.push(seed.id);
  }
  writeRegistry(reg);
  return { inserted, existing };
}

// ─────────────────────────────────────────────────────────────────────────────
// Convenience: query allowed tools for a runtime kind (used by Phase 2 router
// to refine selected_tool against the registry rather than just the runtime's
// installed_tools[] hint).
// ─────────────────────────────────────────────────────────────────────────────

export function toolsForRuntime(runtime: RuntimeRecord, workspaceId?: string): ToolRegistryEntry[] {
  return listEntries(workspaceId).filter((e) =>
    e.enabled_status === "enabled" &&
    e.installed_status === "installed" &&
    runtimeAllowed(e, runtime.runtime_type),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// routeToolForTask — Phase 3↔Phase 2 seam (the audit's load-bearing piece).
//
// Phase 2 (workforce-router) picks the runtime. This function takes that
// runtime + the task's category/description and picks the best matching
// registered tool + verb. It deliberately stays a pure function over the
// live registry — no spawning, no MC writes — so the router can call it
// inside `routeTask()` without changing the existing side-effect surface.
//
// Output shape matches the directive's spec exactly:
//   { decision, tool_id, verb, runtime_id, approval_required,
//     proof_contract, rationale, alternatives }
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Map workforce-router TaskCategory → ToolRegistry `category` strings to
 * accept. Kept tight on purpose; the registry's category field is the source
 * of truth for cross-cutting buckets, not the runtime's hints.
 */
const TASK_TO_TOOL_CATEGORIES: Record<string, string[]> = {
  coding:     ["coding", "knowledge", "infra", "ops"],
  research:   ["knowledge", "research"],
  browser:    ["browser"],
  content:    ["comms", "content"],
  operations: ["ops", "infra"],
};

/** Verb-keyword signals — scored per-action so the best verb wins. */
const VERB_KEYWORDS: Array<[RegExp, string[]]> = [
  [/\bissue(?:s|-create|-list)?\b/i,       ["issue-create", "issue-list", "issue"]],
  [/\bpull[- ]?request|pr\b/i,              ["pr-create", "pr-list", "pr"]],
  [/\brepo(?:sitory)?\b/i,                  ["repo-view", "repo"]],
  [/\b(create|add|new) (?:a )?page\b/i,     ["page-create", "page"]],
  [/\b(search|find|look ?up)\b/i,           ["search"]],
  [/\b(delete|remove|archive)\b/i,          ["page-delete", "delete"]],
  [/\bauth(?:enticate|orization)?\b/i,      ["auth-status", "auth"]],
  [/\bcomment\b/i,                          ["issue-comment", "comment"]],
  [/\b(deploy|ship|release)\b/i,            ["deploy", "release"]],
  [/\b(install|configure)\b/i,              ["install", "configure"]],
];

export type ToolRouteDecisionKind = "cli" | "api" | "browser" | "manual";

export interface ToolRouteResult {
  decision: ToolRouteDecisionKind;
  tool_id: string | null;
  verb: string | null;
  runtime_id: string;
  workspace_id: string;
  approval_required: boolean;
  proof_contract: "stdout+exit" | "stdout+exit+log" | "stdout+exit+log+screenshot";
  rationale: string;
  alternatives: Array<{ tool_id: string; score: number; reason: string }>;
}

export interface ToolRouteInput {
  description: string;
  /** Task category from workforce-router; loosely typed to dodge a circular import. */
  category: string;
  runtime: RuntimeRecord;
  workspace_id?: string;
}

interface ScoredTool { entry: ToolRegistryEntry; score: number; reasons: string[]; best_verb: string | null; verb_score: number }

function scoreTool(entry: ToolRegistryEntry, input: ToolRouteInput): ScoredTool {
  const reasons: string[] = [];
  let score = 0;

  // (1) Category match — registry category in the task's allowed bucket.
  const allowed = TASK_TO_TOOL_CATEGORIES[input.category] ?? [];
  if (allowed.includes(entry.category)) { score += 30; reasons.push(`category "${entry.category}" matches task bucket (+30)`); }

  // (2) Runtime allow-list specificity — explicit listing beats "*".
  if (entry.allowed_runtimes.includes(input.runtime.runtime_type)) { score += 15; reasons.push(`explicitly allowed for runtime "${input.runtime.runtime_type}" (+15)`); }
  else if (entry.allowed_runtimes.includes("*")) { score += 5; reasons.push("wildcard runtime allow (+5)"); }

  // (3) BLOCKED / disabled → hard skip.
  if (entry.approval_policy === "blocked") { return { entry, score: -1, reasons: ["approval_policy=blocked"], best_verb: null, verb_score: 0 }; }
  if (entry.enabled_status !== "enabled" || entry.installed_status !== "installed") {
    return { entry, score: -1, reasons: [`status=${entry.installed_status}/${entry.enabled_status}`], best_verb: null, verb_score: 0 };
  }

  // (4) Verb match — strongest signal. Pick the best-matching action.
  let best_verb: string | null = null;
  let best_verb_score = 0;
  for (const action of entry.supported_actions) {
    let vScore = 0;
    for (const [pattern, verbs] of VERB_KEYWORDS) {
      if (pattern.test(input.description) && verbs.includes(action.verb)) { vScore += 50; break; }
    }
    if (vScore === 0) {
      // weaker fallback: the verb token itself appears in the description
      const tokens = action.verb.split(/[-_]/);
      for (const t of tokens) if (t.length >= 4 && new RegExp(`\\b${t}\\b`, "i").test(input.description)) { vScore += 12; }
    }
    if (vScore > best_verb_score) { best_verb_score = vScore; best_verb = action.verb; }
  }
  if (best_verb_score > 0 && best_verb) { score += best_verb_score; reasons.push(`verb "${best_verb}" matches description (+${best_verb_score})`); }

  // (5) Telemetry tiebreaker — favor tools that have actually worked here before.
  const calls = entry.success_count + entry.failure_count;
  if (calls > 0) {
    const rate = entry.success_count / calls;
    if (rate >= 0.9 && calls >= 3) { score += 8; reasons.push(`historical success ${(rate * 100).toFixed(0)}% over ${calls} runs (+8)`); }
    else if (rate < 0.5 && calls >= 3) { score = Math.max(0, score - 10); reasons.push(`historical success ${(rate * 100).toFixed(0)}% — dock 10`); }
  }

  return { entry, score, reasons, best_verb, verb_score: best_verb_score };
}

function pickProofContract(entry: ToolRegistryEntry | null, category: string): ToolRouteResult["proof_contract"] {
  if (category === "browser") return "stdout+exit+log+screenshot";
  if (entry && entry.logs_enabled) return "stdout+exit+log";
  if (category === "operations") return "stdout+exit+log";
  return "stdout+exit";
}

export function routeToolForTask(input: ToolRouteInput): ToolRouteResult {
  ensureSeeded();
  const workspace_id = input.workspace_id ?? "local";

  // Pool: every tool runtime-allowed for this runtime, then scored.
  const pool = toolsForRuntime(input.runtime, workspace_id);
  const scored = pool.map((e) => scoreTool(e, input)).sort((a, b) => b.score - a.score);
  const winner = scored[0] && scored[0].score > 0 ? scored[0] : null;
  const alternatives = scored.slice(1, 4).filter((s) => s.score > 0).map((s) => ({
    tool_id: s.entry.id, score: s.score, reason: s.reasons.join("; "),
  }));

  if (!winner) {
    return {
      decision: input.category === "browser" ? "browser" : "manual",
      tool_id: null,
      verb: null,
      runtime_id: input.runtime.runtime_id,
      workspace_id,
      approval_required: false,
      proof_contract: pickProofContract(null, input.category),
      rationale: pool.length === 0
        ? `no installed+enabled tool is allowed for runtime "${input.runtime.runtime_type}" in workspace "${workspace_id}"`
        : `no registered tool scored above zero for this task — operator must pick manually`,
      alternatives: [],
    };
  }

  // approval_required = anything stricter than LOW+auto on the chosen tool/verb.
  const action = winner.best_verb
    ? winner.entry.supported_actions.find((a) => a.verb === winner.best_verb)
    : winner.entry.supported_actions[0];
  const effective_risk = action?.risk_level ?? winner.entry.risk_level;
  const approval_required =
    winner.entry.approval_policy === "approval-required" ||
    effective_risk === "MEDIUM" || effective_risk === "HIGH" || effective_risk === "BLOCKED";

  return {
    decision: "cli",
    tool_id: winner.entry.id,
    verb: winner.best_verb ?? winner.entry.supported_actions[0]?.verb ?? null,
    runtime_id: input.runtime.runtime_id,
    workspace_id,
    approval_required,
    proof_contract: pickProofContract(winner.entry, input.category),
    rationale: `tool "${winner.entry.id}" — ${winner.reasons.join("; ")}`,
    alternatives,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-tool status snapshot (used by /api/tools/:id/status).
// Surfaces the entry's stored telemetry + a rolling window from the audit
// ledger so an operator can see "is this thing healthy" at a glance.
// ─────────────────────────────────────────────────────────────────────────────

export interface ToolStatusSnapshot {
  id: string;
  installed_status: InstalledStatus;
  enabled_status: EnabledStatus;
  risk_level: RiskLevel;
  approval_policy: ApprovalPolicy;
  last_used_at: string | null;
  success_count: number;
  failure_count: number;
  success_rate: number;            // 0..1; NaN-safe → 0 when no calls
  average_runtime_ms: number;
  recent: {
    window: number;                // sample size used for the rolling stats
    successes: number;
    failures: number;
    refusals: number;
    last_audit_id: string | null;
    last_started_at: string | null;
    last_exit_code: number | null;
  };
}

export function statusForEntry(id: string, recent_window = 20): ToolStatusSnapshot | null {
  const entry = getEntry(id);
  if (!entry) return null;
  const tail = readAuditTail(recent_window, id);
  const successes = tail.filter((r) => r.ok).length;
  const failures = tail.filter((r) => !r.ok && r.approved).length;
  const refusals = tail.filter((r) => !r.approved).length;
  const last = tail[tail.length - 1] ?? null;
  const total = entry.success_count + entry.failure_count;
  return {
    id: entry.id,
    installed_status: entry.installed_status,
    enabled_status: entry.enabled_status,
    risk_level: entry.risk_level,
    approval_policy: entry.approval_policy,
    last_used_at: entry.last_used_at,
    success_count: entry.success_count,
    failure_count: entry.failure_count,
    success_rate: total === 0 ? 0 : entry.success_count / total,
    average_runtime_ms: entry.average_runtime_ms,
    recent: {
      window: tail.length,
      successes,
      failures,
      refusals,
      last_audit_id: last?.audit_id ?? null,
      last_started_at: last?.started_at ?? null,
      last_exit_code: last?.exit_code ?? null,
    },
  };
}

/**
 * Lazy boot: ensure the seed entries exist on first read. Called by the
 * /api/tools dispatcher and by `mc tool *` so an operator doesn't have to
 * run a separate `seed` command before anything works.
 */
export function ensureSeeded(): void {
  const reg = readRegistry();
  if (reg.entries.length === 0) seedRegistry();
}
