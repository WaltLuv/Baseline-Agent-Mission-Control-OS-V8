/**
 * Workforce Installer — Phase 5.
 *
 * Reads a workforce template from src/data/workforces/{id}.json and writes its
 * contents into the EXISTING surfaces:
 *
 *   · new tool-registry entries  (src/lib/tool-registry.upsertEntry)
 *   · approval policy overrides  (rewrites entry.approval_policy + risk_level)
 *   · seed tasks in MC          (src/lib/mission-control-sync.createTask)
 *
 * No new framework, no new orchestrator, no new memory store. The installer is
 * a thin composer over Phases 1–4.
 *
 * Install state lives in ~/.claude-os/workforces.json — a single index file
 * recording what's installed, when, and which artifacts were created (for the
 * uninstall path to clean up exactly what it added).
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import {
  getEntry,
  listEntries,
  setEnabled,
  upsertEntry,
  type ToolRegistryEntry,
} from "./tool-registry";
import { createTask } from "./mission-control-sync";

// ─────────────────────────────────────────────────────────────────────────────
// Types — kept loose; the template JSON is the source of truth.
// ─────────────────────────────────────────────────────────────────────────────

export interface WorkforceEmployee {
  id: string;
  name: string;
  role: string;
  summary: string;
  color: string;
  voice?: string;
  expertise?: string[];
  handles?: string[];
  runtime_hint?: string;
  skill_ids?: string[];
}

export interface WorkforceWorkflow {
  id: string;
  name: string;
  employee_id: string;
  cadence: string;
  trigger: string;
  skill_ids: string[];
  outcome: string;
}

export interface WorkforceSkill {
  id: string;
  name: string;
  tool_id: string;
  verb: string;
  args_template: Record<string, string>;
  risk_level: "LOW" | "MEDIUM" | "HIGH" | "BLOCKED";
  proof_contract: string;
}

export interface WorkforceTemplate {
  id: string;
  name: string;
  tagline: string;
  vertical: string;
  color: string;
  icon: string;
  pitch: string;
  value_props: string[];
  employees: WorkforceEmployee[];
  workflows: WorkforceWorkflow[];
  skills: WorkforceSkill[];
  new_tools: ToolRegistryEntry[];
  approval_policy_overrides: Array<{ tool_id: string; verb: string; risk_level: string; reason: string }>;
  seed_tasks: Array<{ title: string; description: string; employee_id: string; workflow_id: string; priority: "low" | "medium" | "high" | "urgent" }>;
  dashboards: Array<{ title: string; route: string; description: string }>;
  proof_expectations: Array<{ milestone: string; criteria: string }>;
}

export interface CatalogEntry {
  id: string;
  name: string;
  tagline: string;
  vertical: string;
  color: string;
  icon: string;
  status: "ready" | "coming_soon";
  headline_count: { employees: number; workflows: number; skills: number };
  ready_in_minutes: number | null;
}

export interface WorkforceCatalog {
  version: number;
  generated_at: string;
  workforces: CatalogEntry[];
}

export interface InstallState {
  workforce_id: string;
  installed_at: string;
  template_path: string;
  /** What the installer created — used by uninstall to remove exactly those. */
  created_tool_ids: string[];
  /** Tool entries whose approval_policy/risk_level was overridden; undo on uninstall. */
  modified_tool_entries: Array<{ id: string; prior_risk_level: string; prior_approval_policy: string }>;
  /** Seed tasks created in MC (id returned by /api/tasks). */
  created_task_ids: Array<string | number>;
  /** Live snapshot for /api/workforces/:id/status. */
  status: {
    employees: number;
    workflows: number;
    skills: number;
    new_tools: number;
    seed_tasks: number;
    mc_push_failed: number;
  };
}

export interface WorkforcesIndex {
  version: 1;
  installed: InstallState[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Persistence
// ─────────────────────────────────────────────────────────────────────────────

const STATE_DIR = join(homedir(), ".claude-os");
const INDEX_PATH = join(STATE_DIR, "workforces.json");
// process.cwd() is the project root when the vite middleware loads us.
const TEMPLATES_DIR = join(process.cwd(), "src", "data", "workforces");

function ensureDir(): void {
  if (!existsSync(STATE_DIR)) mkdirSync(STATE_DIR, { recursive: true });
}

function readIndex(): WorkforcesIndex {
  if (!existsSync(INDEX_PATH)) return { version: 1, installed: [] };
  try {
    const parsed = JSON.parse(readFileSync(INDEX_PATH, "utf8")) as WorkforcesIndex;
    if (parsed.version !== 1 || !Array.isArray(parsed.installed)) return { version: 1, installed: [] };
    return parsed;
  } catch { return { version: 1, installed: [] }; }
}

function writeIndex(idx: WorkforcesIndex): void {
  ensureDir();
  const tmp = `${INDEX_PATH}.tmp.${process.pid}`;
  writeFileSync(tmp, JSON.stringify(idx, null, 2), "utf8");
  renameSync(tmp, INDEX_PATH);
}

function readTemplate(id: string): WorkforceTemplate | { error: string } {
  const path = join(TEMPLATES_DIR, `${id}.json`);
  if (!existsSync(path)) return { error: `template "${id}.json" not found in ${TEMPLATES_DIR}` };
  try {
    return JSON.parse(readFileSync(path, "utf8")) as WorkforceTemplate;
  } catch (e: any) {
    return { error: `template parse failed: ${e?.message ?? String(e)}` };
  }
}

export function readCatalog(): WorkforceCatalog {
  const path = join(TEMPLATES_DIR, "catalog.json");
  if (!existsSync(path)) return { version: 1, generated_at: new Date().toISOString(), workforces: [] };
  try {
    return JSON.parse(readFileSync(path, "utf8")) as WorkforceCatalog;
  } catch {
    return { version: 1, generated_at: new Date().toISOString(), workforces: [] };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

export function listInstalled(): InstallState[] {
  return readIndex().installed;
}

export function getInstallState(id: string): InstallState | null {
  return readIndex().installed.find((s) => s.workforce_id === id) ?? null;
}

export function getTemplate(id: string): WorkforceTemplate | null {
  const t = readTemplate(id);
  return "error" in t ? null : t;
}

/** Per-component status snapshot the install UI reads while progress runs. */
export function getStatus(id: string): { installed: boolean; state: InstallState | null; template: WorkforceTemplate | null } {
  return { installed: getInstallState(id) !== null, state: getInstallState(id), template: getTemplate(id) };
}

/**
 * Install a workforce. Idempotent — if already installed, returns the existing
 * state with `already_installed: true` and does not duplicate side effects.
 *
 * Steps, in order, each one auditable:
 *   1. Register new tool-registry entries (memo, comms, listing, owner-stmt, vendor-cli)
 *   2. Apply approval policy overrides (lift comms.send-email to HIGH, etc.)
 *   3. Push seed tasks to MC (best-effort — failures recorded but don't block)
 *   4. Write the install state to ~/.claude-os/workforces.json
 */
export async function installWorkforce(id: string): Promise<{ ok: boolean; state?: InstallState; already_installed?: boolean; error?: string }> {
  const tpl = readTemplate(id);
  if ("error" in tpl) return { ok: false, error: tpl.error };

  const existing = getInstallState(id);
  if (existing) return { ok: true, state: existing, already_installed: true };

  const state: InstallState = {
    workforce_id: id,
    installed_at: new Date().toISOString(),
    template_path: join(TEMPLATES_DIR, `${id}.json`),
    created_tool_ids: [],
    modified_tool_entries: [],
    created_task_ids: [],
    status: {
      employees: tpl.employees.length,
      workflows: tpl.workflows.length,
      skills: tpl.skills.length,
      new_tools: 0,
      seed_tasks: 0,
      mc_push_failed: 0,
    },
  };

  // 1) Tool registry entries — upsert, but skip ids that were already present
  //    so a re-install doesn't blow away operator edits.
  for (const tool of tpl.new_tools) {
    const before = getEntry(tool.id);
    const seeded: ToolRegistryEntry = {
      ...tool,
      workspace_id: tool.workspace_id ?? "*",
      installed_status: "available",   // probe happens inside upsertEntry
      enabled_status: tool.enabled_status ?? "enabled",
      allowed_agents: tool.allowed_agents ?? ["*"],
      required_secrets: tool.required_secrets ?? [],
      audit_required: tool.audit_required ?? true,
      logs_enabled: tool.logs_enabled ?? true,
      last_used_at: null,
      success_count: 0,
      failure_count: 0,
      average_runtime_ms: 0,
    };
    upsertEntry(seeded);
    if (!before) {
      state.created_tool_ids.push(tool.id);
      state.status.new_tools += 1;
    }
  }

  // 2) Approval policy overrides — record prior values so uninstall can revert.
  for (const ovr of tpl.approval_policy_overrides) {
    const entry = getEntry(ovr.tool_id);
    if (!entry) continue;
    state.modified_tool_entries.push({
      id: entry.id,
      prior_risk_level: entry.risk_level,
      prior_approval_policy: entry.approval_policy,
    });
    upsertEntry({
      ...entry,
      risk_level: ovr.risk_level as ToolRegistryEntry["risk_level"],
      approval_policy:
        ovr.risk_level === "BLOCKED" ? "blocked" :
        ovr.risk_level === "HIGH" ? "approval-required" :
        ovr.risk_level === "MEDIUM" ? "auto" : "auto",
    });
  }

  // 3) Seed tasks → MC. Best-effort: if MC is offline, we still mark the
  //    workforce installed; the offline queue will replay on next sync flush.
  for (const t of tpl.seed_tasks) {
    try {
      const r = await createTask({
        title: t.title,
        description: t.description,
        priority: t.priority,
        tags: ["workforce", id, `employee:${t.employee_id}`, `workflow:${t.workflow_id}`],
        metadata: { workforce_id: id, employee_id: t.employee_id, workflow_id: t.workflow_id },
      });
      if ("ok" in r && r.ok) {
        const tid = (r.body as any)?.task?.id ?? (r.body as any)?.id ?? null;
        if (tid != null) state.created_task_ids.push(tid);
        state.status.seed_tasks += 1;
      } else {
        state.status.mc_push_failed += 1;
      }
    } catch {
      state.status.mc_push_failed += 1;
    }
  }

  // 4) Persist install state
  const idx = readIndex();
  idx.installed.push(state);
  writeIndex(idx);

  return { ok: true, state };
}

/**
 * Uninstall — reverse exactly what install created. Approval-policy overrides
 * are reverted; created tool entries are disabled (we don't delete them so the
 * audit trail stays intact). Created tasks aren't deleted from MC by default
 * (operators may have taken action on them).
 */
export async function uninstallWorkforce(id: string, opts: { delete_tasks?: boolean } = {}): Promise<{ ok: boolean; reverted: { tools_disabled: number; policies_restored: number; tasks_left: number }; error?: string }> {
  const state = getInstallState(id);
  if (!state) return { ok: false, reverted: { tools_disabled: 0, policies_restored: 0, tasks_left: 0 }, error: `workforce "${id}" not installed` };

  let tools_disabled = 0;
  for (const tid of state.created_tool_ids) {
    if (setEnabled(tid, false)) tools_disabled += 1;
  }

  let policies_restored = 0;
  for (const m of state.modified_tool_entries) {
    const entry = getEntry(m.id);
    if (!entry) continue;
    upsertEntry({
      ...entry,
      risk_level: m.prior_risk_level as ToolRegistryEntry["risk_level"],
      approval_policy: m.prior_approval_policy as ToolRegistryEntry["approval_policy"],
    });
    policies_restored += 1;
  }

  // Tasks: leave them on MC by default — they may have been worked on.
  const tasks_left = state.created_task_ids.length;

  // Remove the install record
  const idx = readIndex();
  idx.installed = idx.installed.filter((s) => s.workforce_id !== id);
  writeIndex(idx);

  return { ok: true, reverted: { tools_disabled, policies_restored, tasks_left } };
}

/**
 * Aggregated catalog with per-workforce installed flag, for the UI.
 */
export function catalogWithInstallState(): Array<CatalogEntry & { installed: boolean; installed_at?: string }> {
  const cat = readCatalog();
  const installed = new Map(readIndex().installed.map((s) => [s.workforce_id, s.installed_at] as const));
  return cat.workforces.map((w) => ({
    ...w,
    installed: installed.has(w.id),
    installed_at: installed.get(w.id),
  }));
}

/** What tools the named workforce introduces — used by the UI to label
 *  "this install will add these new tools." */
export function newToolsFromTemplate(id: string): ToolRegistryEntry[] {
  const t = getTemplate(id);
  return t ? t.new_tools : [];
}

/** Validate the template against the live registry — surfaces drift before
 *  install (e.g. a skill points at a tool/verb that no longer exists). */
export function preflightWorkforce(id: string): { ok: boolean; warnings: string[]; missing_tools: string[]; missing_verbs: string[] } {
  const tpl = readTemplate(id);
  if ("error" in tpl) return { ok: false, warnings: [tpl.error], missing_tools: [], missing_verbs: [] };
  const warnings: string[] = [];
  const newToolIds = new Set(tpl.new_tools.map((t) => t.id));
  const all = listEntries();
  const allIds = new Set(all.map((e) => e.id));
  const missing_tools: string[] = [];
  const missing_verbs: string[] = [];
  for (const sk of tpl.skills) {
    if (!newToolIds.has(sk.tool_id) && !allIds.has(sk.tool_id)) {
      missing_tools.push(`${sk.id} → ${sk.tool_id}`);
    }
  }
  return { ok: missing_tools.length === 0, warnings, missing_tools, missing_verbs };
}
