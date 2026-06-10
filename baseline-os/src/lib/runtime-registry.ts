/**
 * Runtime Registry — Baseline OS Phase 1 data layer.
 *
 * The single source of truth for "what runtimes exist on this operator's
 * machine, are they alive, what can they do." Everything else in Baseline OS
 * (router, approvals, tool registry, memory coordination) depends on this
 * surface — workforce awareness is the foundation.
 *
 * Persistence: `~/.claude-os/runtime-registry.json` (atomic write via tmp+rename).
 *
 * Discovery: idempotent. `discoverRuntimes()` probes well-known install paths
 * for Hermes, OpenClaw, Claude Code, Codex, VoiceOps, VisionOps, refreshes
 * `version`, `host`, `capabilities`, `last_seen`. Safe to call on every page
 * load; ~50ms when nothing has changed.
 *
 * Health is **not** binary. `inferStatus()` derives one of
 *   `healthy | warning | critical | offline`
 * from heartbeat age + recent failure counts. The persisted `status` field
 * is the operator's view; raw heartbeat data is preserved so we can recompute.
 *
 * Phase 2+ may migrate the JSON store to SQLite without changing this module's
 * exported interface. Treat the on-disk schema as private.
 */

import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { homedir, hostname } from "node:os";
import { join } from "node:path";
import { execSync, spawnSync } from "node:child_process";

// ─────────────────────────────────────────────────────────────────────────────
// Constants + paths
// ─────────────────────────────────────────────────────────────────────────────

export const RUNTIME_TYPES = [
  "hermes",
  "openclaw",
  "claude-code",
  "codex",
  "voiceops",
  "visionops",
] as const;
export type RuntimeType = (typeof RUNTIME_TYPES)[number];

export type RuntimeStatus = "healthy" | "warning" | "critical" | "offline";

const REGISTRY_DIR = join(homedir(), ".claude-os");
const REGISTRY_PATH = join(REGISTRY_DIR, "runtime-registry.json");

// Heartbeat thresholds (seconds since last_seen).
//   < 60s  → healthy
//   60–300 → warning
//   300–900 → critical
//   > 900 or never → offline
const T_WARNING = 60;
const T_CRITICAL = 300;
const T_OFFLINE = 900;

/**
 * Resolve the active workspace id for this Baseline OS instance.
 *
 *   BASELINE_WORKSPACE_ID  — primary; the operator's canonical workspace
 *   MC_WORKSPACE_ID        — mirrors what Mission Control assigns to this API key
 *   (else)                 — "local" for dev / single-machine operators
 *
 * Phase 2 (Workforce Router) will expect a real workspace id in non-dev
 * environments. Until then the dev fallback keeps the loop honest.
 */
export function resolveWorkspaceId(): string {
  const env = process.env.BASELINE_WORKSPACE_ID || process.env.MC_WORKSPACE_ID;
  return env && env.trim() ? env.trim() : "local";
}

// ─────────────────────────────────────────────────────────────────────────────
// Data model — every field from the directive's spec.
// ─────────────────────────────────────────────────────────────────────────────

export interface RuntimeRecord {
  runtime_id: string;
  runtime_type: RuntimeType;
  workspace_id: string;            // "local" until multi-workspace lands
  name: string;
  status: RuntimeStatus;
  last_seen: string | null;        // ISO timestamp; null = never seen
  version: string | null;
  host: string;
  environment: "local" | "remote" | "cloud";
  capabilities: string[];          // verb-level capabilities
  installed_tools: string[];       // tool ids registered for this runtime
  installed_skills: string[];      // skill ids visible to this runtime
  active_tasks: number;
  heartbeat_interval_sec: number;  // expected heartbeat cadence
  health_score: number;            // 0-100
  cost_today_usd: number;
  cost_month_usd: number;
  failure_count_24h: number;
  consecutive_failures: number;
  metadata: Record<string, unknown>;
}

export interface RuntimeRegistryShape {
  version: 1;
  generated_at: string;
  runtimes: RuntimeRecord[];
}

// ─────────────────────────────────────────────────────────────────────────────
// On-disk persistence
// ─────────────────────────────────────────────────────────────────────────────

function ensureDir(): void {
  if (!existsSync(REGISTRY_DIR)) mkdirSync(REGISTRY_DIR, { recursive: true });
}

function emptyShape(): RuntimeRegistryShape {
  return { version: 1, generated_at: new Date().toISOString(), runtimes: [] };
}

export function readRegistry(): RuntimeRegistryShape {
  if (!existsSync(REGISTRY_PATH)) return emptyShape();
  try {
    const raw = readFileSync(REGISTRY_PATH, "utf8");
    const parsed = JSON.parse(raw) as RuntimeRegistryShape;
    if (parsed.version !== 1 || !Array.isArray(parsed.runtimes)) return emptyShape();
    return parsed;
  } catch {
    return emptyShape();
  }
}

export function writeRegistry(reg: RuntimeRegistryShape): void {
  ensureDir();
  const tmp = `${REGISTRY_PATH}.tmp.${process.pid}`;
  writeFileSync(tmp, JSON.stringify({ ...reg, generated_at: new Date().toISOString() }, null, 2), "utf8");
  renameSync(tmp, REGISTRY_PATH);
}

// ─────────────────────────────────────────────────────────────────────────────
// Status inference
// ─────────────────────────────────────────────────────────────────────────────

export function inferStatus(r: Pick<RuntimeRecord, "last_seen" | "consecutive_failures">): RuntimeStatus {
  if (!r.last_seen) return "offline";
  const ageSec = (Date.now() - new Date(r.last_seen).getTime()) / 1000;
  if (ageSec > T_OFFLINE) return "offline";
  if (r.consecutive_failures >= 3 || ageSec > T_CRITICAL) return "critical";
  if (r.consecutive_failures >= 1 || ageSec > T_WARNING) return "warning";
  return "healthy";
}

export function healthScoreFor(r: Pick<RuntimeRecord, "last_seen" | "consecutive_failures" | "failure_count_24h">): number {
  if (!r.last_seen) return 0;
  const ageSec = (Date.now() - new Date(r.last_seen).getTime()) / 1000;
  let score = 100;
  if (ageSec > T_WARNING) score -= Math.min(40, Math.round((ageSec - T_WARNING) / 10));
  score -= Math.min(40, r.failure_count_24h * 4);
  score -= Math.min(30, r.consecutive_failures * 10);
  return Math.max(0, Math.min(100, score));
}

// ─────────────────────────────────────────────────────────────────────────────
// Discovery probes — one per runtime type.
// Probes are read-only and short-lived (subprocess timeouts <2s) so a full
// discovery pass on a slow machine completes in well under a second.
// ─────────────────────────────────────────────────────────────────────────────

function safeExec(cmd: string, timeoutMs = 1500): string | null {
  try {
    return execSync(cmd, { encoding: "utf8", timeout: timeoutMs, stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return null;
  }
}

function pidAlive(pid: number): boolean {
  try { process.kill(pid, 0); return true; } catch { return false; }
}

function nowIso(): string { return new Date().toISOString(); }

function probeHermes(): Partial<RuntimeRecord> | null {
  const home = homedir();
  const hermesDir = join(home, ".hermes");
  if (!existsSync(hermesDir)) return null;
  const version = safeExec("hermes --version 2>/dev/null | head -1") ?? "unknown";
  // Gateway PID file — present if Hermes gateway is running.
  let alive = false;
  let pid: number | null = null;
  const pidPath = join(hermesDir, "gateway.pid");
  if (existsSync(pidPath)) {
    try {
      const raw = readFileSync(pidPath, "utf8");
      const parsed = JSON.parse(raw) as { pid?: number };
      if (parsed.pid && pidAlive(parsed.pid)) { alive = true; pid = parsed.pid; }
    } catch { /* skip */ }
  }
  // Capabilities — inferred from installed skills + pantheon personas.
  const capabilities: string[] = ["chat", "memory.read", "memory.write", "kanban", "cron"];
  const skillsDir = join(hermesDir, "skills");
  const installed_skills: string[] = [];
  if (existsSync(skillsDir)) {
    try {
      for (const top of readdirSync(skillsDir).slice(0, 200)) installed_skills.push(top);
    } catch { /* skip */ }
  }
  return {
    runtime_type: "hermes",
    name: "Hermes Agent",
    version,
    last_seen: alive ? nowIso() : null,
    capabilities,
    installed_skills,
    installed_tools: ["browser", "file", "kanban", "memory", "shell", "terminal", "web"],
    metadata: { pid, hermesDir, gatewayLive: alive },
  };
}

function probeOpenClaw(): Partial<RuntimeRecord> | null {
  const home = homedir();
  const cfg = join(home, ".openclaw", "openclaw.json");
  if (!existsSync(cfg)) return null;
  // OpenClaw gateway lives on :18789 by default.
  const reachable = !!safeExec("curl -sf -o /dev/null -w '%{http_code}' --max-time 1 http://127.0.0.1:18789/__openclaw/control-ui-config.json");
  let workspaces: string[] = [];
  try {
    const raw = readFileSync(cfg, "utf8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed?.workspaces)) workspaces = parsed.workspaces.map((w: any) => w?.id ?? w?.name).filter(Boolean);
  } catch { /* skip */ }
  return {
    runtime_type: "openclaw",
    name: "OpenClaw Swarm",
    version: safeExec("openclaw --version 2>/dev/null") ?? "unknown",
    last_seen: reachable ? nowIso() : null,
    capabilities: ["spawn.subagent", "code.edit", "browser.control", "shell.exec"],
    installed_tools: ["browser", "file", "shell", "git"],
    installed_skills: [],
    metadata: { gatewayPort: 18789, gatewayLive: reachable, workspaces },
  };
}

function probeClaudeCode(): Partial<RuntimeRecord> | null {
  const home = homedir();
  const claudeDir = join(home, ".claude");
  if (!existsSync(claudeDir)) return null;
  const version = safeExec("claude --version 2>/dev/null") ?? safeExec("which claude") ?? "unknown";
  // Recent activity = any session file modified in last hour
  const projects = join(claudeDir, "projects");
  let activeCount = 0;
  let mostRecent: number | null = null;
  if (existsSync(projects)) {
    try {
      for (const proj of readdirSync(projects)) {
        const projDir = join(projects, proj);
        try {
          for (const f of readdirSync(projDir)) {
            const s = statSync(join(projDir, f));
            if (s.mtimeMs > Date.now() - 3600_000) activeCount++;
            if (mostRecent == null || s.mtimeMs > mostRecent) mostRecent = s.mtimeMs;
          }
        } catch { /* skip */ }
      }
    } catch { /* skip */ }
  }
  return {
    runtime_type: "claude-code",
    name: "Claude Code",
    version,
    last_seen: mostRecent ? new Date(mostRecent).toISOString() : null,
    capabilities: ["code.read", "code.edit", "code.review", "shell.exec", "tools.read", "tools.edit", "subagent.spawn", "chat", "memory.read"],
    installed_tools: ["Read", "Write", "Edit", "Bash", "Glob", "Grep", "Task", "WebFetch", "WebSearch"],
    installed_skills: [],
    active_tasks: activeCount,
    metadata: { projectsDir: projects },
  };
}

function probeCodex(): Partial<RuntimeRecord> | null {
  const codex = safeExec("which codex") ?? null;
  if (!codex) return null;
  const version = safeExec("codex --version 2>/dev/null") ?? "unknown";
  return {
    runtime_type: "codex",
    name: "OpenAI Codex CLI",
    version,
    last_seen: null,           // No PID file or activity log; tracked by heartbeats only.
    capabilities: ["code.read", "code.edit", "browser.control", "shell.exec", "chat"],
    installed_tools: ["browser-use", "file", "shell"],
    installed_skills: [],
    metadata: { path: codex },
  };
}

function probeVoiceOps(): Partial<RuntimeRecord> | null {
  // VoiceOps is the operator's call-routing + transcription runtime.
  // Detection: presence of `voiceops` binary OR `~/.voiceops/` directory.
  const home = homedir();
  const dir = join(home, ".voiceops");
  const bin = safeExec("which voiceops");
  if (!existsSync(dir) && !bin) return null;
  return {
    runtime_type: "voiceops",
    name: "VoiceOps",
    version: safeExec("voiceops --version 2>/dev/null") ?? "unknown",
    last_seen: null,
    capabilities: ["call.transcribe", "call.summarize", "call.route"],
    installed_tools: ["twilio", "elevenlabs", "deepgram"],
    installed_skills: [],
    metadata: { path: bin, dir: existsSync(dir) ? dir : null },
  };
}

function probeVisionOps(): Partial<RuntimeRecord> | null {
  const home = homedir();
  const dir = join(home, ".visionops");
  const bin = safeExec("which visionops");
  if (!existsSync(dir) && !bin) return null;
  return {
    runtime_type: "visionops",
    name: "VisionOps",
    version: safeExec("visionops --version 2>/dev/null") ?? "unknown",
    last_seen: null,
    capabilities: ["image.inspect", "video.inspect", "property.condition_score"],
    installed_tools: ["fal", "higgsfield", "openai-vision"],
    installed_skills: [],
    metadata: { path: bin, dir: existsSync(dir) ? dir : null },
  };
}

const PROBES: Array<() => Partial<RuntimeRecord> | null> = [
  probeHermes,
  probeOpenClaw,
  probeClaudeCode,
  probeCodex,
  probeVoiceOps,
  probeVisionOps,
];

// ─────────────────────────────────────────────────────────────────────────────
// Public API — discover, upsert, list, get, heartbeat
// ─────────────────────────────────────────────────────────────────────────────

function buildDefault(type: RuntimeType, partial: Partial<RuntimeRecord>): RuntimeRecord {
  const id = `${type}@${hostname()}`;
  return {
    runtime_id: id,
    runtime_type: type,
    workspace_id: resolveWorkspaceId(),
    name: partial.name ?? type,
    status: "offline",
    last_seen: null,
    version: null,
    host: hostname(),
    environment: "local",
    capabilities: [],
    installed_tools: [],
    installed_skills: [],
    active_tasks: 0,
    heartbeat_interval_sec: 30,
    health_score: 0,
    cost_today_usd: 0,
    cost_month_usd: 0,
    failure_count_24h: 0,
    consecutive_failures: 0,
    metadata: {},
    ...partial,
  };
}

function withDerivedHealth(r: RuntimeRecord): RuntimeRecord {
  const status = inferStatus(r);
  const health_score = healthScoreFor(r);
  return { ...r, status, health_score };
}

/**
 * Run every probe, merge into the persisted registry, write back.
 * Probes are append/update only — they never delete a runtime that was once
 * registered (operators expect to see history).
 */
export function discoverRuntimes(): RuntimeRegistryShape {
  const reg = readRegistry();
  const byId = new Map<string, RuntimeRecord>();
  for (const r of reg.runtimes) byId.set(r.runtime_id, r);

  for (const probe of PROBES) {
    let partial: Partial<RuntimeRecord> | null = null;
    try { partial = probe(); } catch { partial = null; }
    if (!partial || !partial.runtime_type) continue;
    const type = partial.runtime_type;
    const id = `${type}@${hostname()}`;
    const existing = byId.get(id) ?? buildDefault(type, partial);
    const next: RuntimeRecord = {
      ...existing,
      ...partial,
      runtime_id: id,
      runtime_type: type,
      host: hostname(),
      // last_seen: probe wins if it found life; else keep prior value
      last_seen: partial.last_seen ?? existing.last_seen,
    };
    byId.set(id, withDerivedHealth(next));
  }

  const merged: RuntimeRegistryShape = {
    version: 1,
    generated_at: nowIso(),
    runtimes: [...byId.values()].map(withDerivedHealth).sort((a, b) => a.runtime_id.localeCompare(b.runtime_id)),
  };
  writeRegistry(merged);
  return merged;
}

export function listRuntimes(): RuntimeRecord[] {
  return readRegistry().runtimes.map(withDerivedHealth);
}

export function getRuntime(id: string): RuntimeRecord | null {
  const found = readRegistry().runtimes.find((r) => r.runtime_id === id);
  return found ? withDerivedHealth(found) : null;
}

/**
 * Mark a heartbeat. Bumps `last_seen` to now, optionally updates active_tasks
 * + cost. Failure tracking: if `failed: true`, increments both counters; on a
 * successful beat, resets `consecutive_failures` to 0.
 */
export function heartbeat(
  id: string,
  patch?: { active_tasks?: number; cost_today_usd?: number; failed?: boolean },
): RuntimeRecord | null {
  const reg = readRegistry();
  const idx = reg.runtimes.findIndex((r) => r.runtime_id === id);
  if (idx === -1) return null;
  const r = reg.runtimes[idx];
  const next: RuntimeRecord = {
    ...r,
    last_seen: nowIso(),
    active_tasks: patch?.active_tasks ?? r.active_tasks,
    cost_today_usd: patch?.cost_today_usd ?? r.cost_today_usd,
    failure_count_24h: patch?.failed ? r.failure_count_24h + 1 : r.failure_count_24h,
    consecutive_failures: patch?.failed ? r.consecutive_failures + 1 : 0,
  };
  reg.runtimes[idx] = withDerivedHealth(next);
  writeRegistry(reg);
  return reg.runtimes[idx];
}

/**
 * Doctor — runs deeper probes and writes a per-runtime report. Each entry
 * describes whether the runtime is responding to its primary control channel
 * (gateway, PID, recent file activity, etc.) and any actionable hint.
 */
export interface DoctorEntry {
  runtime_id: string;
  status: RuntimeStatus;
  checks: { name: string; ok: boolean; detail: string }[];
}

export function doctorAll(): DoctorEntry[] {
  const all = listRuntimes();
  return all.map((r) => doctor(r));
}

export function doctor(r: RuntimeRecord): DoctorEntry {
  const checks: DoctorEntry["checks"] = [];
  // 1. Heartbeat age
  if (r.last_seen) {
    const ageSec = Math.round((Date.now() - new Date(r.last_seen).getTime()) / 1000);
    checks.push({ name: "heartbeat_age", ok: ageSec <= T_CRITICAL, detail: `${ageSec}s since last_seen` });
  } else {
    checks.push({ name: "heartbeat_age", ok: false, detail: "never seen — call mc runtime heartbeat to register one" });
  }
  // 2. Type-specific liveness re-probe
  let probe: Partial<RuntimeRecord> | null = null;
  try {
    const fn = PROBES.find((p) => {
      const result = p();
      return result?.runtime_type === r.runtime_type;
    });
    probe = fn ? fn() : null;
  } catch { probe = null; }
  checks.push({ name: "liveness_probe", ok: !!probe?.last_seen, detail: probe?.last_seen ? "responding" : "not responding" });
  // 3. Failure rate
  checks.push({
    name: "failure_rate",
    ok: r.consecutive_failures < 3,
    detail: `${r.failure_count_24h} failures/24h · ${r.consecutive_failures} consecutive`,
  });
  return { runtime_id: r.runtime_id, status: r.status, checks };
}

// Re-export to keep CLI imports tidy.
export { spawnSync as _spawnSync };
