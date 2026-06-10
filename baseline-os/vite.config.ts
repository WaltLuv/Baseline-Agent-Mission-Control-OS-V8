import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { execSync, spawn, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import {
  appendFileSync,
  realpathSync,
  renameSync,
  createReadStream,
  existsSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  statSync,
  lstatSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { createConnection } from "node:net";
import { homedir } from "node:os";
import { join, resolve, sep } from "node:path";
import {
  discoverRuntimes,
  listRuntimes,
  getRuntime,
  heartbeat as runtimeHeartbeat,
  doctorAll,
  doctor as runtimeDoctor,
} from "./src/lib/runtime-registry";
import {
  routeTask,
  previewRoute,
  readAuditTail,
  type RoutingDecision,
  type TaskInput,
} from "./src/lib/workforce-router";
import {
  publishRoutingDecision,
  createTask,
} from "./src/lib/mission-control-sync";
import {
  listEntries,
  getEntry,
  setEnabled,
  upsertEntry,
  validateArgs,
  executeTool,
  readAuditTail as readToolAudit,
  ensureSeeded,
  probeAll,
  seedRegistry,
  statusForEntry,
  type ExecutionRequest,
} from "./src/lib/tool-registry";
import {
  listRequests as listApprovals,
  getRequest as getApproval,
  approveRequest,
  denyRequest,
  readHistoryTail as readApprovalHistory,
  getStats as approvalStats,
} from "./src/lib/approval-engine";

// ────────────────────────────────────────────────────────────────────────────
// Pantheon — the 10 canonical persona recipes. Schema co-designed with
// Hermes (see chat 2026-05-12). Model names follow the provider/name split
// the YAML schema uses; the dashboard renders the matching local logo from
// HERMES_LOCAL_LOGOS in agents.hermes.tsx. Skill ids are real Hermes skill
// folder names (run `hermes skills list` to verify).
//
// Models are tiered so cheap/silly tasks use cheap/fast models and reasoning
// tasks get top-tier models:
//   gpt-5.5            — Hermes default, capable mid-tier
//   claude-opus-4.7    — top reasoning, slow, $$$
//   claude-sonnet-4.5  — top execution, fast, $$
//   gpt-4o-mini        — fast, cheap, "free tier" for silly tasks
//   llama-3.3-70b      — free via OpenRouter, great for cheap orchestration
// ────────────────────────────────────────────────────────────────────────────
// Each seed carries a `default` flag — only `default: true` personas are
// written to disk by the install endpoint. The others are available as
// templates the user can spin up via the Add Persona wizard.
// Defaults: Maggie Walker (research / pipeline), Robert Smith (operational
// autopilot), Rogers & Hobson (long-horizon reasoning), Walter Thornton
// (CRE/AI integrator). Together they cover most early use.
const PANTHEON_SEEDS: Array<{
  id: string;
  name: string;
  job: string;
  description: string;
  avatar: string;
  default: boolean;
  model: { provider: string; name: string };
  behavior: { tone: string; system_prompt: string };
  skills: string[];
  tools: string[];
  summon_phrases: string[];
}> = [
  {
    id: "oracle",
    name: "Oracle",
    job: "Memory & lookup",
    description: "Long-term memory and lookup. Reads SOUL.md and kanban; answers what-do-I-know.",
    avatar: "assets/oracle.png",
    default: false,
    model: { provider: "anthropic", name: "claude-sonnet-4.5" },
    behavior: {
      tone: "calm, precise, source-cited",
      system_prompt:
        "You are the Oracle. Read SOUL.md, the kanban, memory stores, and past sessions before answering. Cite sources. If you don't know, say so — never fabricate.",
    },
    skills: ["memory", "domain", "dogfood"],
    tools: ["file", "memory", "kanban"],
    summon_phrases: ["Oracle", "ask Oracle", "what do I know about"],
  },
  {
    id: "athena",
    name: "Athena",
    job: "Code review & refactors",
    description: "Code review, refactors, PR triage. Reads diffs, runs tests, files clean changes.",
    avatar: "assets/athena.png",
    default: false,
    model: { provider: "anthropic", name: "claude-opus-4.7" },
    behavior: {
      tone: "sharp, skeptical, technical",
      system_prompt:
        "You are Athena. Review code with precision. Identify risks, suggest fixes, prefer evidence from tests, diffs, and repo inspection. Be direct — no flattery, no hedging.",
    },
    skills: ["github", "devops", "autonomous-ai-agents"],
    tools: ["file", "terminal", "github"],
    summon_phrases: ["Athena", "use Athena", "ask Athena to review", "review this PR"],
  },
  {
    id: "scribe",
    name: "Scribe",
    job: "Long-form writing",
    description: "Long-form writing: prose, docs, social posts, scripts. Fraunces-grade output.",
    avatar: "assets/scribe.png",
    default: false,
    model: { provider: "anthropic", name: "claude-opus-4.7" },
    behavior: {
      tone: "literate, considered, voice-matched",
      system_prompt:
        "You are the Scribe. Write with craft. Match the user's voice. Read prior work before drafting. Prefer specificity over generality.",
    },
    skills: ["creative", "domain"],
    tools: ["file", "memory"],
    summon_phrases: ["Scribe", "ask Scribe to write", "draft this"],
  },
  {
    id: "orpheus",
    name: "Orpheus",
    job: "Media generation",
    description: "Media generation — image, video, audio, design. Talks to Kie / Runway / ElevenLabs.",
    avatar: "assets/orpheus.png",
    default: false,
    model: { provider: "anthropic", name: "claude-opus-4.7" },
    behavior: {
      tone: "imaginative, visual-thinking, brief-first",
      system_prompt:
        "You are Orpheus. Generate media. Always confirm the brief — aspect, style, mood, references — before firing a render. Show your prompts before submitting.",
    },
    skills: ["creative", "media", "gifs"],
    tools: ["kie", "runway", "elevenlabs", "file"],
    summon_phrases: ["Orpheus", "generate an image", "make a video"],
  },
  {
    id: "maggie-walker",
    name: "Maggie Walker",
    job: "The Penny Strategy Bank — Savings → Mortgages Pipeline",
    description:
      "The community-wealth architect. Patterned on Maggie L. Walker, the first Black woman to charter a bank in America (St. Luke Penny Savings, 1903). Builds patient capital pipelines: every dollar saved is mapped to a downstream mortgage, business loan, or asset acquisition. Decomposes long-horizon goals into deposit → underwriting → deployment loops and persists progress milestone-by-milestone so the strategy survives interruption.",
    avatar: "assets/maggie-walker.png",
    default: true,
    model: { provider: "openai", name: "gpt-5.5" },
    behavior: {
      tone: "patient, exhaustive, structured",
      system_prompt:
        "You are Maggie Walker — the architect of the Penny Strategy Bank. You handle deep multi-step research, capital-planning, and pipeline-building tasks that need patience. Before answering, decompose the goal into an explicit plan (savings → underwriting → deployment) and confirm it with the user. Execute step by step, persisting progress at each milestone so the work can resume if interrupted. When a step fails, surface the failure clearly and propose two alternatives. Avoid summarising before you have the evidence to summarise. End every response with the next concrete action.",
    },
    skills: ["data-science", "autonomous-ai-agents"],
    tools: ["file", "terminal", "web", "memory"],
    summon_phrases: ["Maggie", "Maggie Walker", "build the pipeline", "run the penny strategy"],
  },
  {
    id: "alchemist",
    name: "Alchemist",
    job: "Integrations & MCP",
    description: "MCP and tool tinkering. Spins up servers, wires integrations, runs experiments.",
    avatar: "assets/alchemist.png",
    default: false,
    model: { provider: "anthropic", name: "claude-sonnet-4.5" },
    behavior: {
      tone: "experimental, curious, hands-on",
      system_prompt:
        "You are the Alchemist. Stand up MCP servers, wire APIs, test integrations. Iterate fast — fail loud and recover. Document what worked, prune what didn't.",
    },
    skills: ["mcp", "devops", "inference-sh"],
    tools: ["file", "terminal", "mcp"],
    summon_phrases: ["Alchemist", "wire this up", "test this integration"],
  },
  {
    id: "rogers-hobson",
    name: "John Rogers & Mellody Hobson",
    job: "Active Patience + Project Black — Institutional Scaling",
    description:
      "The patient-capital partnership. Patterned on John W. Rogers Jr. and Mellody Hobson of Ariel Investments — the firm that took the Aesop tortoise as its mascot and turned 'slow and steady' into a $16B doctrine. Wrestles with ambiguous, long-horizon allocation problems. Surfaces the meta-question behind the question, questions premises, and frames every decision through the Project Black lens of scaling minority-owned institutional capacity. Slower than the others because depth and discipline cost tokens.",
    avatar: "assets/rogers-hobson.png",
    default: true,
    model: { provider: "anthropic", name: "claude-opus-4.7" },
    behavior: {
      tone: "patient, socratic, layered",
      system_prompt:
        "You are Rogers & Hobson — the Active Patience partnership. Treat every question as a starting point, not an instruction. Before answering, surface the meta-question behind the question and confirm which the user actually wants resolved. Pull on threads. Question premises. Frame every recommendation through long-horizon institutional scaling — what survives 30 years, not 30 days. Explain your reasoning step by step so the user can disagree with each step independently. It is better to admit uncertainty than to fabricate confidence.",
    },
    skills: ["domain"],
    tools: ["file", "memory"],
    summon_phrases: ["Rogers", "Hobson", "Rogers and Hobson", "be patient about this", "wrestle with this"],
  },
  {
    id: "mapmaker",
    name: "Mapmaker",
    job: "Diagrams & system docs",
    description: "Charts what is — architecture diagrams, codebase maps, system docs.",
    avatar: "assets/mapmaker.png",
    default: false,
    model: { provider: "openai", name: "gpt-5.5" },
    behavior: {
      tone: "visual, precise, no-jargon",
      system_prompt:
        "You are the Mapmaker. Render the system as a diagram first, prose second. Use Mermaid or Excalidraw for everything structural. Keep one screen = one idea.",
    },
    skills: ["diagramming", "github"],
    tools: ["file", "excalidraw", "mermaid"],
    summon_phrases: ["Mapmaker", "diagram this", "chart the architecture"],
  },
  {
    id: "robert-smith",
    name: "Robert Smith",
    job: "Operational Intelligence — The PE Playbook",
    description:
      "The operations autopilot. Patterned on Robert F. Smith of Vista Equity Partners — the playbook that turned software companies into the most disciplined operating businesses on earth via the Vista Standard Operating Procedure. Runs on a schedule, not on demand. Built for tasks that should happen daily, weekly, or on every event — pipeline reviews, KPI roll-ups, vendor checks, scheduled summaries. Cheap, fast, deterministic on purpose. Logs every action to disk so you can audit what ran while you slept.",
    avatar: "assets/robert-smith.png",
    default: true,
    model: { provider: "openrouter", name: "meta-llama/llama-3.3-70b-instruct:free" },
    behavior: {
      tone: "operational, deterministic, status-led",
      system_prompt:
        "You are Robert Smith — Operational Intelligence. You run the PE playbook: standardised, repeatable, schedule-driven. Your job is to do one task well, log the result, and exit cleanly. Never wait for a human reply mid-run. If something blocks you, write it to the log and surface it through a kanban entry the user can read later. Keep responses terse and structured. Status first, then evidence. Track every action as a line item in the operating book.",
    },
    skills: ["gateway", "autonomous-ai-agents"],
    tools: ["cron", "webhook", "file"],
    summon_phrases: ["Robert", "Robert Smith", "run the playbook", "schedule this"],
  },
  {
    id: "walter-thornton",
    name: "Walter Thornton",
    job: "The Modern CRE/AI Architect — Occupier Services & Tenant Advocacy",
    description:
      "The modern commercial-real-estate and AI architect. The integrator persona — bridges CRE occupier services, tenant advocacy, AI authorship, and the agent stack itself. Designs end-to-end systems that translate a tenant's business needs into a deal, a space, an integration, and a published artifact. Default voice for anything that crosses CRE strategy + AI execution.",
    avatar: "assets/walter-thornton.png",
    default: true,
    model: { provider: "anthropic", name: "claude-sonnet-4.5" },
    behavior: {
      tone: "integrative, plainspoken, builder-first",
      system_prompt:
        "You are Walter Thornton — the modern CRE/AI architect. You handle work that crosses commercial real estate strategy (occupier services, tenant advocacy, lease economics, market intelligence) and AI integration (agent design, automation, authorship, publishing). Always translate the tenant's or operator's underlying business goal into the simplest possible system that delivers it. Surface the trade-offs plainly. Prefer one well-integrated answer over three half-integrated ones. End every response with the next concrete action and who owns it.",
    },
    skills: ["domain", "autonomous-ai-agents", "diagramming"],
    tools: ["file", "memory", "web", "terminal"],
    summon_phrases: ["Walter", "Walter Thornton", "architect this", "CRE this", "integrate this"],
  },
];

// Per-run secret used to gate /__refresh_data. The dev server writes it once
// at boot, the dashboard reads it via /__token, and includes it as a header
// on the refresh POST. A drive-by request from a malicious browser tab or
// extension cannot guess it. Rotated every dev-server start.
const REFRESH_TOKEN = randomBytes(32).toString("hex");
// Write the token to a tmp file so the same-origin browser fetch can read it
// only once at app boot (the file is short-lived, mode 0600).
const TOKEN_DIR = join(homedir(), ".claude-os");
const TOKEN_FILE = join(TOKEN_DIR, "dev-token");
try {
  if (!existsSync(TOKEN_DIR)) mkdirSync(TOKEN_DIR, { recursive: true });
  writeFileSync(TOKEN_FILE, REFRESH_TOKEN, { mode: 0o600 });
} catch {
  /* non-fatal — the endpoint just won't accept refreshes */
}

// Load ~/.claude-os/.env into process.env so live secrets (OpenAI / Pinecone /
// ElevenLabs) live in ONE gitignored, 0600 file OUTSIDE config.json — never as
// plaintext literals in config.json. Existing process.env wins; we never
// overwrite a value already set by the shell. Lines: KEY=VALUE (quotes optional).
try {
  const envPath = join(TOKEN_DIR, ".env");
  if (existsSync(envPath)) {
    for (const line of readFileSync(envPath, "utf8").split("\n")) {
      const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (!m || m[1].startsWith("#")) continue;
      if (process.env[m[1]]) continue;
      let v = m[2];
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      process.env[m[1]] = v;
    }
  }
} catch {
  /* non-fatal — endpoints fall back to honest setup-needed */
}

// Reject any socket whose remote isn't 127.0.0.1 / ::1. Belt-and-braces
// alongside server.host = "127.0.0.1" — even if a future config change
// re-exposes the dev server, the privileged endpoints stay loopback-only.
function isLoopback(req: { socket?: { remoteAddress?: string | null } }): boolean {
  const a = req.socket?.remoteAddress ?? "";
  return a === "127.0.0.1" || a === "::1" || a === "::ffff:127.0.0.1";
}

// Read the OpenClaw gateway token + port live from ~/.openclaw/openclaw.json.
// Gateway boots with `auth.mode === "token"`, so every API call to :18789
// needs `Authorization: Bearer <token>`. Reading from disk (instead of
// hardcoding) means rotating the token via `openclaw doctor --generate-gateway-token`
// is picked up on the next request — no dashboard restart required.
function readOpenClawGateway(): { token: string | null; port: number } {
  // NOTE: Vite 7's ESM runtime does NOT support dynamic require() inside
  // middleware — it crashes the dev server the first time the branch fires.
  // Use the top-level imports already in scope (readFileSync, join, homedir).
  try {
    const cfgPath = join(homedir(), ".openclaw", "openclaw.json");
    if (!existsSync(cfgPath)) return { token: null, port: 18789 };
    const raw = readFileSync(cfgPath, "utf8");
    const cfg = JSON.parse(raw) as { gateway?: { port?: number; auth?: { token?: string } } };
    return { token: cfg.gateway?.auth?.token ?? null, port: cfg.gateway?.port ?? 18789 };
  } catch {
    return { token: null, port: 18789 };
  }
}

// Module-level response cache for slow endpoints. Each endpoint computes
// its result once, serves it from memory until the TTL expires, then
// recomputes. Massively speeds up the dashboard because /__hermes_status
// polls every 4s, /__hermes_connections every 20s, and /__hermes_pantheon_sync
// every 5s after a Copy click — all of which would otherwise re-shell-out
// to git/CLI on every hit.
const responseCache = new Map<string, { expires: number; body: string }>();
function sendCached(key: string, res: any): boolean {
  const cached = responseCache.get(key);
  if (cached && cached.expires > Date.now()) {
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Cache", "HIT");
    res.end(cached.body);
    return true;
  }
  return false;
}
function storeCached(key: string, ttlMs: number, body: string): void {
  responseCache.set(key, { expires: Date.now() + ttlMs, body });
}

// Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
// @cloudflare/vite-plugin builds from this — wrangler.jsonc main alone is insufficient.
//
// Port 8081 is hardcoded in scripts/server.ts CORS allowlist and the README — if a fresh
// user lands on the preset's default 8080, the sidecar refuses CORS and "Activate now" /
// "Run this fix" silently fail. Override here, with strictPort so a port collision fails
// loudly instead of drifting to 8082.
export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    plugins: [
      {
        name: "claude-os-live-data",
        configureServer(server) {
          // ══════════════════════════════════════════════════════════════
          // Baseline OS · Phase 1 — Runtime Registry API
          //
          //   GET  /api/runtimes                       → list all + re-discover
          //   GET  /api/runtimes/:id                   → one record
          //   GET  /api/runtimes/:id/health            → status + score
          //   GET  /api/runtimes/:id/tasks             → active_tasks + breakdown
          //   GET  /api/runtimes/:id/capabilities      → capabilities[]
          //   POST /api/runtimes/discover              → force re-discovery
          //   POST /api/runtimes/:id/heartbeat         → record a heartbeat
          //   GET  /api/runtimes/doctor                → full diagnostic pass
          //   GET  /api/runtimes/:id/doctor            → per-runtime diagnostic
          //   GET  /api/runtimes/:id/logs              → recent log lines
          //
          // All routes are loopback-only and read/write
          // ~/.claude-os/runtime-registry.json atomically. Discovery is
          // idempotent and runs on every list request, so the UI always
          // shows fresh data without a manual refresh.
          // ══════════════════════════════════════════════════════════════
          const sendJson = (res: any, code: number, body: unknown) => {
            res.statusCode = code;
            res.setHeader("Content-Type", "application/json");
            res.setHeader("Cache-Control", "no-store");
            res.end(JSON.stringify(body));
          };

          const readPostBody = (req: any): Promise<unknown> => new Promise((r) => {
            let b = "";
            req.on("data", (c: Buffer) => { b += c.toString(); });
            req.on("end", () => { try { r(b ? JSON.parse(b) : {}); } catch { r({}); } });
          });

          // Generic dispatcher for everything under /api/runtimes.
          server.middlewares.use("/api/runtimes", async (req, res) => {
            if (!isLoopback(req)) { sendJson(res, 403, { error: "loopback only" }); return; }
            const url = new URL(req.url ?? "/", "http://x");
            const segments = url.pathname.split("/").filter(Boolean); // [] or [":id"] or [":id", "health"] …
            const method = (req.method ?? "GET").toUpperCase();

            try {
              // GET /api/runtimes  → list + re-discover
              if (segments.length === 0 && method === "GET") {
                const reg = discoverRuntimes();
                sendJson(res, 200, { ok: true, generated_at: reg.generated_at, runtimes: reg.runtimes });
                return;
              }
              // POST /api/runtimes/discover
              if (segments.length === 1 && segments[0] === "discover" && method === "POST") {
                const reg = discoverRuntimes();
                sendJson(res, 200, { ok: true, generated_at: reg.generated_at, runtimes: reg.runtimes });
                return;
              }
              // GET /api/runtimes/doctor
              if (segments.length === 1 && segments[0] === "doctor" && method === "GET") {
                discoverRuntimes();
                sendJson(res, 200, { ok: true, entries: doctorAll() });
                return;
              }
              // From here on the first segment is the runtime id.
              const id = decodeURIComponent(segments[0] ?? "");
              const r = getRuntime(id);
              if (!r) { sendJson(res, 404, { ok: false, error: `runtime ${id} not registered. Try POST /api/runtimes/discover.` }); return; }

              if (segments.length === 1 && method === "GET") {
                sendJson(res, 200, { ok: true, runtime: r });
                return;
              }
              const sub = segments[1];
              if (sub === "health" && method === "GET") {
                sendJson(res, 200, { ok: true, runtime_id: r.runtime_id, status: r.status, health_score: r.health_score, last_seen: r.last_seen, consecutive_failures: r.consecutive_failures, failure_count_24h: r.failure_count_24h });
                return;
              }
              if (sub === "tasks" && method === "GET") {
                sendJson(res, 200, { ok: true, runtime_id: r.runtime_id, active_tasks: r.active_tasks, breakdown: r.metadata?.task_breakdown ?? [] });
                return;
              }
              if (sub === "capabilities" && method === "GET") {
                sendJson(res, 200, { ok: true, runtime_id: r.runtime_id, capabilities: r.capabilities, installed_tools: r.installed_tools, installed_skills: r.installed_skills });
                return;
              }
              if (sub === "doctor" && method === "GET") {
                sendJson(res, 200, { ok: true, entry: runtimeDoctor(r) });
                return;
              }
              if (sub === "heartbeat" && method === "POST") {
                const body = await readPostBody(req) as { active_tasks?: number; cost_today_usd?: number; failed?: boolean };
                const updated = runtimeHeartbeat(r.runtime_id, body);
                sendJson(res, 200, { ok: true, runtime: updated });
                return;
              }
              if (sub === "logs" && method === "GET") {
                // Best-effort tail. Each runtime keeps logs in different places;
                // for Phase 1 we surface whatever is reachable via well-known
                // log paths so the operator at least sees something.
                const lines: string[] = [];
                const candidatePaths: string[] = [];
                if (r.runtime_type === "hermes") candidatePaths.push(join(homedir(), ".hermes", "logs", "gateway.log"));
                if (r.runtime_type === "openclaw") candidatePaths.push("/tmp/openclaw.log");
                if (r.runtime_type === "claude-code") candidatePaths.push(join(homedir(), ".claude", "logs", "session.log"));
                for (const p of candidatePaths) {
                  if (existsSync(p)) {
                    try {
                      const raw = readFileSync(p, "utf8");
                      const tail = raw.split("\n").slice(-80);
                      lines.push(`# ${p}`, ...tail);
                    } catch { /* skip */ }
                  }
                }
                sendJson(res, 200, { ok: true, runtime_id: r.runtime_id, lines });
                return;
              }
              sendJson(res, 404, { ok: false, error: `unknown sub-route ${sub} for ${method}` });
            } catch (e: any) {
              sendJson(res, 500, { ok: false, error: e?.message ?? String(e) });
            }
          });

          // ══════════════════════════════════════════════════════════════
          // Baseline OS · Phase 2 — Workforce Router API
          //
          //   POST /api/route                  → dry-run: returns RoutingDecision
          //   POST /api/route/execute          → routes + publishes to MC
          //                                       body: { taskId, ...TaskInput }
          //   POST /api/route/proof            → end-to-end loop:
          //                                       create task in MC → route →
          //                                       publish → return full chain
          //   GET  /api/route/audit            → tail of router decisions
          //   GET  /api/route/categories       → category catalog + caps
          //
          // The router consumes the Runtime Registry (Phase 1) and writes to
          // ~/.claude-os/router-decisions.jsonl as an audit ledger. Publishing
          // back to Mission Control uses POST /api/tasks/:id/routing if
          // available, falling back to PUT /api/tasks/:id with metadata.
          // ══════════════════════════════════════════════════════════════
          server.middlewares.use("/api/route", async (req, res) => {
            if (!isLoopback(req)) { sendJson(res, 403, { error: "loopback only" }); return; }
            const url = new URL(req.url ?? "/", "http://x");
            const segments = url.pathname.split("/").filter(Boolean);
            const method = (req.method ?? "GET").toUpperCase();
            try {
              // GET /api/route/audit
              if (segments.length === 1 && segments[0] === "audit" && method === "GET") {
                const limit = parseInt(url.searchParams.get("limit") ?? "40", 10);
                sendJson(res, 200, { ok: true, decisions: readAuditTail(limit) });
                return;
              }
              // GET /api/route/categories
              if (segments.length === 1 && segments[0] === "categories" && method === "GET") {
                sendJson(res, 200, { ok: true, categories: ["coding", "research", "browser", "content", "operations"] });
                return;
              }
              // POST /api/route (dry-run)
              if (segments.length === 0 && method === "POST") {
                const body = await readPostBody(req) as TaskInput;
                if (!body || !body.description) { sendJson(res, 400, { error: "description required" }); return; }
                const decision = previewRoute(body);
                sendJson(res, 200, { ok: true, decision });
                return;
              }
              // POST /api/route/execute  (routes + publishes to MC)
              if (segments.length === 1 && segments[0] === "execute" && method === "POST") {
                const body = await readPostBody(req) as TaskInput & { taskId?: string | number };
                if (!body || !body.description) { sendJson(res, 400, { error: "description required" }); return; }
                if (body.taskId == null) { sendJson(res, 400, { error: "taskId required — call POST /api/route for dry-run without an id" }); return; }
                const decision = routeTask(body);
                const publish = await publishRoutingDecision(body.taskId, decisionToPayload(decision));
                sendJson(res, 200, { ok: true, decision, publish });
                return;
              }
              // POST /api/route/proof  (end-to-end: create + route + publish)
              if (segments.length === 1 && segments[0] === "proof" && method === "POST") {
                const body = await readPostBody(req) as { title: string; description: string; priority?: "low"|"medium"|"high"|"urgent" };
                if (!body || !body.title || !body.description) { sendJson(res, 400, { error: "title + description required" }); return; }
                const created = await createTask({ title: body.title, description: body.description, priority: body.priority ?? "medium" });
                if ("error" in created || !created.ok) { sendJson(res, 502, { ok: false, step: "create", error: ("error" in created ? created.error : created.body) }); return; }
                const taskId = (created.body as any)?.task?.id ?? (created.body as any)?.id;
                if (!taskId) { sendJson(res, 502, { ok: false, step: "create", error: "MC created the task but did not return an id", body: created.body }); return; }
                const decision = routeTask({ description: body.description });
                const publish = await publishRoutingDecision(taskId, decisionToPayload(decision));
                sendJson(res, 200, { ok: publish.ok ?? false, taskId, decision, publish });
                return;
              }
              sendJson(res, 404, { error: `unknown route path ${url.pathname}` });
            } catch (e: any) {
              sendJson(res, 500, { error: e?.message ?? String(e) });
            }
          });

          function decisionToPayload(d: RoutingDecision) {
            return {
              assigned_runtime: d.selected_runtime?.runtime_id ?? "UNASSIGNED",
              selected_tool:    d.selected_tool?.id ?? null,
              selected_skill:   d.selected_skill?.id ?? null,
              routing_reason:   d.rationale.join(" · "),
              routing_confidence: d.confidence_score / 100,
              approval_required:  d.approval.required,
              decision_id: d.decision_id,
              category: d.category,
              alternatives: d.alternatives.map((a) => ({ runtime_id: a.runtime_id, score: a.score })),
            };
          }

          // ══════════════════════════════════════════════════════════════
          // Baseline OS · Phase 3 — Execution Tool Registry API
          //
          //   GET  /api/tools                        cli_tool_list
          //   POST /api/tools/seed                   force-reseed canonical entries
          //   POST /api/tools/probe                  re-probe installed status
          //   GET  /api/tools/audit                  global execution ledger tail
          //   GET  /api/tools/:id                    cli_tool_get
          //   GET  /api/tools/:id/schema             cli_tool_schema (verb-specific via ?verb=)
          //   GET  /api/tools/:id/logs               cli_tool_logs
          //   POST /api/tools/:id/validate           cli_tool_validate { verb, args }
          //   POST /api/tools/:id/run                cli_tool_run     { verb, args, task_id?, decision_id?, approval_token? }
          //   POST /api/tools/:id/enable
          //   POST /api/tools/:id/disable
          //
          // Security per directive:
          //   · loopback-only
          //   · workspace scope honored
          //   · secrets resolved from env at spawn time, NEVER in argv
          //   · risk_level + approval_policy gate every /run call
          //   · audit ledger at ~/.claude-os/tool-executions.jsonl
          // ══════════════════════════════════════════════════════════════
          server.middlewares.use("/api/tools", async (req, res) => {
            if (!isLoopback(req)) { sendJson(res, 403, { error: "loopback only" }); return; }
            ensureSeeded();
            const url = new URL(req.url ?? "/", "http://x");
            const segments = url.pathname.split("/").filter(Boolean);
            const method = (req.method ?? "GET").toUpperCase();
            const workspace_id = url.searchParams.get("workspace_id") ?? undefined;
            try {
              // GET /api/tools
              if (segments.length === 0 && method === "GET") {
                const entries = listEntries(workspace_id);
                sendJson(res, 200, { ok: true, count: entries.length, entries });
                return;
              }
              // POST /api/tools/seed
              if (segments.length === 1 && segments[0] === "seed" && method === "POST") {
                const force = url.searchParams.get("force") === "true";
                const result = seedRegistry(force);
                sendJson(res, 200, { ok: true, ...result });
                return;
              }
              // POST /api/tools/probe
              if (segments.length === 1 && segments[0] === "probe" && method === "POST") {
                const entries = probeAll();
                sendJson(res, 200, { ok: true, count: entries.length, entries });
                return;
              }
              // GET /api/tools/audit
              if (segments.length === 1 && segments[0] === "audit" && method === "GET") {
                const limit = parseInt(url.searchParams.get("limit") ?? "50", 10);
                const tool = url.searchParams.get("tool") ?? undefined;
                sendJson(res, 200, { ok: true, audit: readToolAudit(limit, tool) });
                return;
              }
              // Below this line, segments[0] = tool id
              const id = decodeURIComponent(segments[0] ?? "");
              const entry = getEntry(id);
              if (!entry) { sendJson(res, 404, { ok: false, error: `tool "${id}" not registered` }); return; }
              const sub = segments[1];

              if (sub == null && method === "GET") {
                sendJson(res, 200, { ok: true, entry });
                return;
              }
              if (sub === "schema" && method === "GET") {
                const verb = url.searchParams.get("verb");
                if (verb) {
                  const a = entry.supported_actions.find((x) => x.verb === verb);
                  if (!a) { sendJson(res, 404, { ok: false, error: `verb "${verb}" not on tool "${id}"` }); return; }
                  sendJson(res, 200, { ok: true, verb: a.verb, input_schema: a.input_schema, output_schema: a.output_schema, risk_level: a.risk_level ?? entry.risk_level });
                  return;
                }
                sendJson(res, 200, { ok: true, actions: entry.supported_actions.map((a) => ({ verb: a.verb, description: a.description, input_schema: a.input_schema, output_schema: a.output_schema, risk_level: a.risk_level ?? entry.risk_level })) });
                return;
              }
              if (sub === "logs" && method === "GET") {
                const limit = parseInt(url.searchParams.get("limit") ?? "20", 10);
                sendJson(res, 200, { ok: true, audit: readToolAudit(limit, id) });
                return;
              }
              if (sub === "status" && method === "GET") {
                const window = parseInt(url.searchParams.get("window") ?? "20", 10);
                const snap = statusForEntry(id, window);
                if (!snap) { sendJson(res, 404, { ok: false, error: `tool "${id}" not registered` }); return; }
                sendJson(res, 200, { ok: true, status: snap });
                return;
              }
              if (sub === "validate" && method === "POST") {
                const body = await readPostBody(req) as { verb: string; args?: Record<string, string> };
                const a = entry.supported_actions.find((x) => x.verb === body.verb);
                if (!a) { sendJson(res, 400, { ok: false, error: `unknown verb "${body.verb}"` }); return; }
                sendJson(res, 200, validateArgs(a, body.args ?? {}));
                return;
              }
              if (sub === "run" && method === "POST") {
                const body = await readPostBody(req) as { verb: string; args?: Record<string, string>; task_id?: string|number; decision_id?: string; approval_token?: string; workspace_id?: string; request_approval?: boolean };
                const exec: ExecutionRequest = {
                  tool_id: id,
                  verb: body.verb,
                  args: body.args ?? {},
                  workspace_id: body.workspace_id ?? workspace_id,
                  task_id: body.task_id ?? null,
                  decision_id: body.decision_id ?? null,
                  approval_token: body.approval_token ?? null,
                  request_approval: body.request_approval === true,
                };
                const result = await executeTool(exec);
                sendJson(res, result.ok ? 200 : (result.approved ? 200 : 403), result);
                return;
              }
              if ((sub === "enable" || sub === "disable") && method === "POST") {
                const updated = setEnabled(id, sub === "enable");
                sendJson(res, 200, { ok: true, entry: updated });
                return;
              }
              sendJson(res, 404, { ok: false, error: `unknown sub-route ${sub} on ${method}` });
            } catch (e: any) {
              sendJson(res, 500, { ok: false, error: e?.message ?? String(e) });
            }
          });

          // ══════════════════════════════════════════════════════════════
          // Baseline OS · Phase 4 — Approval Engine API
          //
          //   GET  /api/approvals[?status=pending]   list queue (newest first)
          //   GET  /api/approvals/stats              counters
          //   GET  /api/approvals/history[?limit=N]  audit history
          //   GET  /api/approvals/:id                single request (token redacted)
          //   POST /api/approvals/:id/approve        body { decided_by, reason }
          //   POST /api/approvals/:id/deny           body { decided_by, reason }
          //
          // Approve/deny mutates the queue and emits an MC comment if the
          // request is linked to a task. The approval_token is returned on
          // /approve so the UI / caller can hand it to /api/tools/:id/run.
          // ══════════════════════════════════════════════════════════════
          server.middlewares.use("/api/approvals", async (req, res) => {
            if (!isLoopback(req)) { sendJson(res, 403, { error: "loopback only" }); return; }
            const url = new URL(req.url ?? "/", "http://x");
            const segments = url.pathname.split("/").filter(Boolean);
            const method = (req.method ?? "GET").toUpperCase();
            try {
              if (segments.length === 0 && method === "GET") {
                const status = url.searchParams.get("status") as any;
                const workspace_id = url.searchParams.get("workspace_id") ?? undefined;
                const requests = listApprovals({ workspace_id, status });
                sendJson(res, 200, { ok: true, count: requests.length, requests });
                return;
              }
              if (segments.length === 1 && segments[0] === "stats" && method === "GET") {
                sendJson(res, 200, { ok: true, stats: approvalStats() });
                return;
              }
              if (segments.length === 1 && segments[0] === "history" && method === "GET") {
                const limit = parseInt(url.searchParams.get("limit") ?? "60", 10);
                sendJson(res, 200, { ok: true, history: readApprovalHistory(limit) });
                return;
              }
              const id = decodeURIComponent(segments[0] ?? "");
              const sub = segments[1];

              if (sub == null && method === "GET") {
                const r = getApproval(id, true);
                if (!r) { sendJson(res, 404, { ok: false, error: `request "${id}" not found` }); return; }
                sendJson(res, 200, { ok: true, request: r });
                return;
              }
              if ((sub === "approve" || sub === "deny") && method === "POST") {
                const body = await readPostBody(req) as { decided_by?: string; reason?: string };
                const fn = sub === "approve" ? approveRequest : denyRequest;
                const result = fn(id, { decided_by: (body.decided_by || "operator").slice(0, 60), reason: (body.reason || "").slice(0, 280) });
                if ("error" in result) { sendJson(res, 400, { ok: false, error: result.error }); return; }
                // Fire-and-log: publish a comment to the linked MC task
                if (result.task_id != null) {
                  void publishApprovalEvent(result, sub).catch(() => null);
                }
                sendJson(res, 200, { ok: true, request: result });
                return;
              }
              sendJson(res, 404, { ok: false, error: `unknown sub-route ${sub} for ${method}` });
            } catch (e: any) {
              sendJson(res, 500, { ok: false, error: e?.message ?? String(e) });
            }
          });

          async function publishApprovalEvent(r: any, event: "approve" | "deny"): Promise<void> {
            try {
              const { mcFetch, loadConfig } = await import("./src/lib/mission-control-sync");
              const cfg = loadConfig();
              if ("error" in cfg) return;
              const status = event === "approve" ? "✅ approved" : "❌ denied";
              const lines = [
                `### Approval ${status} · ${r.id}`,
                "",
                `- tool: \`${r.tool_id}.${r.verb}\``,
                `- risk_level: \`${r.risk_level}\``,
                `- decided_by: \`${r.decided_by}\``,
                `- decided_at: \`${r.decided_at}\``,
                `- reason: ${r.decision_reason || "(none given)"}`,
                `- decision_id: \`${r.decision_id ?? "—"}\``,
                `- args:`, "```json", JSON.stringify(r.args, null, 2), "```",
              ].join("\n");
              await mcFetch(cfg, "POST", `/api/tasks/${encodeURIComponent(String(r.task_id))}/comments`, {
                content: lines, author: "baseline-os-approval-engine",
              });
            } catch { /* never block */ }
          }

          // ─── /api/workforces · Phase 5 — Workforce Templates ────────────
          // Catalog of installable workforces + per-id install/uninstall.
          // Loopback only; no schema migration — install state lives in
          // ~/.claude-os/workforces.json.
          server.middlewares.use("/api/workforces", async (req, res) => {
            if (!isLoopback(req)) { sendJson(res, 403, { error: "loopback only" }); return; }
            const url = new URL(req.url ?? "/", "http://x");
            const segments = url.pathname.split("/").filter(Boolean);
            const method = (req.method ?? "GET").toUpperCase();
            try {
              const wf = await import("./src/lib/workforce-installer");

              // GET /api/workforces — catalog (8 entries) with installed flags
              if (segments.length === 0 && method === "GET") {
                sendJson(res, 200, { ok: true, workforces: wf.catalogWithInstallState() });
                return;
              }
              // GET /api/workforces/installed — index of installed workforces
              if (segments.length === 1 && segments[0] === "installed" && method === "GET") {
                sendJson(res, 200, { ok: true, installed: wf.listInstalled() });
                return;
              }

              const id = decodeURIComponent(segments[0] ?? "");
              const sub = segments[1];

              // GET /api/workforces/:id — full template + install state
              if (sub == null && method === "GET") {
                const status = wf.getStatus(id);
                if (!status.template) { sendJson(res, 404, { ok: false, error: `template "${id}" not found` }); return; }
                sendJson(res, 200, { ok: true, ...status });
                return;
              }
              // GET /api/workforces/:id/preflight — drift check
              if (sub === "preflight" && method === "GET") {
                sendJson(res, 200, { ok: true, ...wf.preflightWorkforce(id) });
                return;
              }
              // POST /api/workforces/:id/install
              if (sub === "install" && method === "POST") {
                const result = await wf.installWorkforce(id);
                sendJson(res, result.ok ? 200 : 400, result);
                return;
              }
              // POST /api/workforces/:id/uninstall
              if (sub === "uninstall" && method === "POST") {
                const body = await readPostBody(req).catch(() => ({})) as { delete_tasks?: boolean };
                const result = await wf.uninstallWorkforce(id, { delete_tasks: !!body.delete_tasks });
                sendJson(res, result.ok ? 200 : 400, result);
                return;
              }
              // GET /api/workforces/:id/status — light snapshot for the install UI
              if (sub === "status" && method === "GET") {
                sendJson(res, 200, { ok: true, ...wf.getStatus(id) });
                return;
              }
              sendJson(res, 404, { ok: false, error: `unknown sub-route ${sub} for ${method}` });
            } catch (e: any) {
              sendJson(res, 500, { ok: false, error: e?.message ?? String(e) });
            }
          });

          // ─── /api/roi · Phase 5.6 — Value / ROI contract ────────────────
          // Loopback only. Produces the typed ValueRoiPayload defined in
          // src/lib/roi.ts. Reuses the Daily Brief hours-saved formula so
          // the two Baseline OS surfaces cannot drift.
          server.middlewares.use("/api/roi", async (req, res) => {
            if (!isLoopback(req)) { sendJson(res, 403, { error: "loopback only" }); return; }
            if ((req.method ?? "GET").toUpperCase() !== "GET") {
              sendJson(res, 405, { ok: false, error: "GET only" });
              return;
            }
            try {
              const url = new URL(req.url ?? "/", "http://x");
              const { buildValueRoi } = await import("./src/lib/roi");
              const payload = await buildValueRoi({
                workspace_id: url.searchParams.get("workspace_id") ?? undefined,
                workforce_slug: url.searchParams.get("workforce_slug") ?? undefined,
                since: url.searchParams.get("since") ?? undefined,
                until: url.searchParams.get("until") ?? undefined,
                mode: (url.searchParams.get("mode") as any) ?? undefined,
                hourly_rate_usd: url.searchParams.get("hourly_rate_usd") ? Number(url.searchParams.get("hourly_rate_usd")) : undefined,
                limit: url.searchParams.get("limit") ? parseInt(url.searchParams.get("limit")!, 10) : undefined,
              });
              sendJson(res, 200, payload);
            } catch (e: any) {
              sendJson(res, 500, { ok: false, error: e?.message ?? String(e) });
            }
          });

          // ─── /api/daily-brief · Phase 5.5 — Daily Brief contract ────────
          // Loopback only. Produces the typed DailyBriefPayload defined in
          // src/lib/daily-brief.ts. Mission Control consumes this; we never
          // render it ourselves.
          server.middlewares.use("/api/daily-brief", async (req, res) => {
            if (!isLoopback(req)) { sendJson(res, 403, { error: "loopback only" }); return; }
            if ((req.method ?? "GET").toUpperCase() !== "GET") {
              sendJson(res, 405, { ok: false, error: "GET only" });
              return;
            }
            try {
              const url = new URL(req.url ?? "/", "http://x");
              const { buildDailyBrief } = await import("./src/lib/daily-brief");
              const payload = await buildDailyBrief({
                workspace_id: url.searchParams.get("workspace_id") ?? undefined,
                workforce_slug: url.searchParams.get("workforce_slug") ?? undefined,
                since: url.searchParams.get("since") ?? undefined,
                until: url.searchParams.get("until") ?? undefined,
                mode: (url.searchParams.get("mode") as any) ?? undefined,
                limit: url.searchParams.get("limit") ? parseInt(url.searchParams.get("limit")!, 10) : undefined,
              });
              sendJson(res, 200, payload);
            } catch (e: any) {
              sendJson(res, 500, { ok: false, error: e?.message ?? String(e) });
            }
          });

          // GET /__live-data — serves live-data.json fresh from disk on every
          // request.  This replaces the static `import liveData from "…"`
          // pattern so the browser always gets the latest aggregator output
          // without a server restart.
          server.middlewares.use("/__live-data", (req, res, next) => {
            if (req.method !== "GET") return next();
            try {
              const filePath = resolve(__dirname, "src/data/live-data.json");
              const raw = readFileSync(filePath, "utf-8");
              res.setHeader("Content-Type", "application/json");
              res.setHeader("Cache-Control", "no-store");
              res.end(raw);
            } catch {
              // Fall back to example file on fresh clones
              try {
                const fallback = resolve(__dirname, "src/data/live-data.example.json");
                const raw = readFileSync(fallback, "utf-8");
                res.setHeader("Content-Type", "application/json");
                res.setHeader("Cache-Control", "no-store");
                res.end(raw);
              } catch {
                res.statusCode = 404;
                res.end(JSON.stringify({ error: "No live-data.json found" }));
              }
            }
          });

          // GET /__hermes_status — live filesystem probe for Hermes Agent.
          // Returns whether Hermes is installed (~/.hermes + binary on PATH),
          // its version, and whether config.yaml is present + parseable.
          // Loopback-only because the response leaks the user's binary path
          // and default model id. The Hermes page hits this on mount to
          // decide whether to render Install / Setup / Chat states.
          server.middlewares.use("/__hermes_status", (req, res, next) => {
            if (req.method !== "GET") return next();
            if (!isLoopback(req)) {
              res.statusCode = 403;
              res.end(JSON.stringify({ error: "loopback only" }));
              return;
            }
            // 3s cache — frontend polls this every 4s, so a 3s TTL means
            // every other poll is an instant cache hit instead of re-running
            // `hermes --version` which can take a full second.
            if (sendCached("hermes-status", res)) return;
            const home = homedir();
            const hermesDir = join(home, ".hermes");
            const installedDir = existsSync(hermesDir);
            // Resolve the hermes binary across common install locations.
            const binCandidates = [
              join(home, ".local", "bin", "hermes"),
              "/opt/homebrew/bin/hermes",
              "/usr/local/bin/hermes",
            ];
            const binPath = binCandidates.find((p) => existsSync(p)) ?? null;
            let version: string | null = null;
            if (binPath) {
              try {
                const out = execSync(`"${binPath}" --version`, {
                  stdio: "pipe",
                  // Reduced from 3000ms — hermes --version either responds
                  // quickly or it's hung waiting for a TTY that never comes.
                  // 800ms is plenty for the happy path; if it times out the
                  // version just stays null and the dashboard falls back to
                  // its known-shipping fallback (currently v0.13.0).
                  timeout: 800,
                }).toString();
                version = out.trim().split("\n")[0] || null;
              } catch {
                /* version probe failed, leave null */
              }
            }
            // Parse Hermes' canonical config.yaml. The `model:` block has
            // BOTH `default:` (model name) AND `provider:` (canonical
            // inference provider). Previously we assumed the provider was
            // the prefix on the model name ("anthropic/claude-opus-4.6" →
            // anthropic), but Hermes also stores models bare ("gpt-5.5")
            // with provider declared separately. The `provider:` field is
            // the truth.
            const configPath = join(hermesDir, "config.yaml");
            const configured = existsSync(configPath);
            let defaultModel: string | null = null;
            let provider: string | null = null;
            if (configured) {
              try {
                const yaml = readFileSync(configPath, "utf-8");
                // Only match `default:` and `provider:` INSIDE the top-level
                // model block. Hermes' config.yaml repeats the same key
                // names inside fallback-providers entries, so we slice out
                // the model block by finding the next top-level key
                // (anything starting with non-space at column 0, on its
                // own line). Avoid /m flag — its $ would let the lazy
                // capture stop at the first line inside the block.
                const headerIdx = yaml.indexOf("model:\n");
                if (headerIdx !== -1) {
                  const afterHeader = yaml.slice(headerIdx + "model:\n".length);
                  // End at the next line that starts with a non-space char.
                  const endIdx = afterHeader.search(/\n[^\s]/);
                  const blockText =
                    endIdx === -1 ? afterHeader : afterHeader.slice(0, endIdx);
                  const m1 = blockText.match(/^\s*default:\s*["']?([^"'\n]+)["']?/m);
                  defaultModel = m1?.[1]?.trim() || null;
                  const m2 = blockText.match(/^\s*provider:\s*["']?([^"'\n]+)["']?/m);
                  provider = m2?.[1]?.trim() || null;
                }
              } catch {
                /* ignore */
              }
            }

            // OAuth providers don't store an API key in ~/.hermes/.env —
            // credentials live in Hermes' OAuth token store. For those,
            // having `provider:` set in config.yaml is sufficient to say
            // "Hermes can answer." For API-key providers we still verify
            // the matching env var is present.
            const OAUTH_PROVIDERS = new Set(["openai-codex", "nous"]);
            const PROVIDER_KEY_MAP: Record<string, string> = {
              anthropic: "ANTHROPIC_API_KEY",
              openrouter: "OPENROUTER_API_KEY",
              openai: "OPENAI_API_KEY",
              gemini: "GOOGLE_API_KEY",
              copilot: "GITHUB_TOKEN",
              huggingface: "HF_TOKEN",
              groq: "GROQ_API_KEY",
              "ollama-cloud": "OLLAMA_API_KEY",
              nvidia: "NVIDIA_API_KEY",
              zai: "GLM_API_KEY",
              "kimi-coding": "KIMI_API_KEY",
              minimax: "MINIMAX_API_KEY",
            };
            const providerKeyName = provider ? PROVIDER_KEY_MAP[provider] ?? null : null;
            const envPath = join(hermesDir, ".env");
            let hasProviderKey = false;
            if (provider && OAUTH_PROVIDERS.has(provider)) {
              // OAuth-authed; we don't check env. Hermes' OAuth store is
              // sufficient and `hermes status` will catch a missing token.
              hasProviderKey = true;
            } else if (providerKeyName && existsSync(envPath)) {
              try {
                const envText = readFileSync(envPath, "utf-8");
                const re = new RegExp(`^\\s*${providerKeyName}\\s*=\\s*[^\\s#]`, "m");
                hasProviderKey = re.test(envText);
              } catch {
                /* ignore */
              }
            }
            const installed = installedDir && Boolean(binPath);
            // "needsSetup" only fires when there's a real gap: Hermes is
            // installed but config.yaml has no provider set, OR the
            // declared provider expects a key we can't find. Don't trip
            // for unknown providers — we'd rather show the chat and let
            // it fail with a real error than block a working install.
            const needsSetup =
              installed &&
              (!provider ||
                (!OAUTH_PROVIDERS.has(provider) &&
                  providerKeyName !== null &&
                  !hasProviderKey));
            const body = JSON.stringify({
              installed,
              binPath,
              version,
              configured,
              defaultModel,
              provider,
              providerKeyName,
              hasProviderKey,
              needsSetup,
              envPath,
            });
            storeCached("hermes-status", 3000, body);
            res.setHeader("Content-Type", "application/json");
            res.setHeader("Cache-Control", "no-store");
            res.setHeader("X-Cache", "MISS");
            res.end(body);
          });

          // GET /__omp_status — Oh My Pi (omp) runtime probe.
          //
          // Walt's Phase F directive: surface install status, version, and
          // canonical config paths for the omp coding harness on the local
          // machine. Strictly read-only; loopback-only. Honest — never
          // reports installed:true unless the binary is on PATH and
          // `omp --version` actually returns a banner.
          //
          // This endpoint is the OMP runtime probe. It is NOT the PI Agent
          // (Chief Memory Officer) endpoint — see Knowledge OS surfaces for
          // that. Same word "Pi", different concept.
          server.middlewares.use("/__omp_status", (req, res, next) => {
            if (req.method !== "GET") return next();
            if (!isLoopback(req)) {
              res.statusCode = 403;
              res.end(JSON.stringify({ error: "loopback only" }));
              return;
            }
            if (sendCached("omp-status", res)) return;
            const home = homedir();
            // Walk the standard install locations. Mirrors mc-v8's
            // detectBinary() — bun-global, npm-global, /usr/local/bin,
            // ~/.local/bin, ~/Library/pnpm.
            const binCandidates = [
              join(home, ".bun", "bin", "omp"),
              join(home, ".local", "bin", "omp"),
              "/opt/homebrew/bin/omp",
              "/usr/local/bin/omp",
              join(home, ".npm-global", "bin", "omp"),
              join(home, "Library", "pnpm", "omp"),
            ];
            const binPath = binCandidates.find((p) => existsSync(p)) ?? null;
            let version: string | null = null;
            if (binPath) {
              try {
                const out = execSync(`"${binPath}" --version`, {
                  stdio: "pipe",
                  timeout: 1500,
                }).toString();
                version = out.trim().split("\n")[0] || null;
              } catch {
                // probe failed; leave version null and installed remains true
                // (binary exists, just didn't answer the version flag)
              }
            }
            const installed = !!binPath;

            // Canonical config paths. The route surfaces these as
            // "this is where omp keeps state" — we DO NOT check existence
            // beyond the top dir, so a fresh install honestly reads as
            // "config dir present, no sessions yet" rather than fake
            // populated state.
            const ompDir = join(home, ".omp");
            const ompDirExists = existsSync(ompDir);
            const paths = {
              configRoot: ompDir,
              configRootExists: ompDirExists,
              modelsYml: join(ompDir, "agent", "models.yml"),
              agentsMd: join(ompDir, "agent", "AGENTS.md"),
              systemMd: join(ompDir, "agent", "SYSTEM.md"),
              skills: join(ompDir, "skills"),
              sessions: join(ompDir, "sessions"),
              hindsight: join(ompDir, "hindsight"),
            };

            // Provider connectivity: surface which standard provider env
            // vars are set. This is honest signal, not a credential dump —
            // we report presence/absence only, never the value.
            const providers = {
              openrouter: !!process.env.OPENROUTER_API_KEY,
              openai: !!process.env.OPENAI_API_KEY,
              anthropic: !!process.env.ANTHROPIC_API_KEY,
              google: !!process.env.GOOGLE_API_KEY,
              groq: !!process.env.GROQ_API_KEY,
              mistral: !!process.env.MISTRAL_API_KEY,
              xai: !!process.env.XAI_API_KEY,
              cerebras: !!process.env.CEREBRAS_API_KEY,
            };

            // Supported modes are intrinsic to omp itself (per omp.sh/docs)
            // — interactive TUI, print/JSON, RPC, and SDK. We list them so
            // the route doesn't have to repeat the literal in the markup.
            const supportedModes = ["interactive", "print-json", "rpc", "sdk"];

            const installCommands = {
              bun: "bun install -g @oh-my-pi/pi-coding-agent",
              curl: "curl -fsSL https://omp.sh/install | sh",
              npm: "npm install -g @oh-my-pi/pi-coding-agent",
              powershell: "irm https://omp.sh/install.ps1 | iex",
              mise: "mise use -g github:can1357/oh-my-pi",
            };

            const body = JSON.stringify({
              installed,
              binPath,
              version,
              paths,
              providers,
              supportedModes,
              installCommands,
              // Honest "needs setup" predicate. True when the binary is
              // missing OR is installed but no provider env var is set,
              // since omp can't actually answer a prompt in that state.
              needsSetup:
                !installed ||
                !Object.values(providers).some(Boolean),
            });
            storeCached("omp-status", 3000, body);
            res.setHeader("Content-Type", "application/json");
            res.setHeader("Cache-Control", "no-store");
            res.setHeader("X-Cache", "MISS");
            res.end(body);
          });

          // POST /__hermes_image_upload — accept a raw image body, save it
          // to ~/.hermes/image_cache/<uuid>.<ext>, return the absolute path
          // so the chat can prepend it to the prompt. Hermes' vision-capable
          // models (and the file-read tool) then pick the image up by path.
          // Token-gated, loopback only, 8MB hard cap.
          server.middlewares.use("/__hermes_image_upload", (req, res, next) => {
            if (req.method !== "POST") return next();
            if (!isLoopback(req)) {
              res.statusCode = 403;
              res.end(JSON.stringify({ error: "loopback only" }));
              return;
            }
            const token = req.headers["x-claude-os-token"];
            if (token !== REFRESH_TOKEN) {
              res.statusCode = 403;
              res.end(JSON.stringify({ error: "bad token" }));
              return;
            }
            const contentType = String(req.headers["content-type"] ?? "");
            // Map common image content-types → extensions. Anything else
            // is rejected — we don't want arbitrary file types written
            // into the Hermes image cache.
            const EXT_BY_CT: Record<string, string> = {
              "image/png": "png",
              "image/jpeg": "jpg",
              "image/jpg": "jpg",
              "image/webp": "webp",
              "image/gif": "gif",
            };
            const ext = EXT_BY_CT[contentType.split(";")[0].trim()];
            if (!ext) {
              res.statusCode = 415;
              res.end(JSON.stringify({ error: "unsupported image type" }));
              return;
            }
            const MAX = 8 * 1024 * 1024;
            const chunks: Buffer[] = [];
            let total = 0;
            let aborted = false;
            req.on("data", (c: Buffer) => {
              total += c.length;
              if (total > MAX) {
                aborted = true;
                req.destroy();
                return;
              }
              chunks.push(c);
            });
            req.on("end", () => {
              if (aborted) {
                res.statusCode = 413;
                res.end(JSON.stringify({ error: "too large (8MB max)" }));
                return;
              }
              const buf = Buffer.concat(chunks);
              const cacheDir = join(homedir(), ".hermes", "image_cache");
              try {
                mkdirSync(cacheDir, { recursive: true });
              } catch {
                /* ignore */
              }
              const id = randomBytes(8).toString("hex");
              const filename = `dashboard-${Date.now()}-${id}.${ext}`;
              const path = join(cacheDir, filename);
              try {
                writeFileSync(path, buf);
              } catch (err: any) {
                res.statusCode = 500;
                res.end(JSON.stringify({ error: err?.message ?? "write failed" }));
                return;
              }
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ path, size: buf.length, type: contentType }));
            });
          });

          // POST /__hermes_chat — shells out to `hermes chat -Q -q "<prompt>"`
          // (single-query mode with quiet/programmatic output) and streams
          // the response back to the dashboard as SSE.
          // Loopback + token gated. Body: { prompt: "<user message>" }.
          // The prompt is passed as a single argv string — argv doesn't
          // get shell-interpreted, so a malicious prompt can't smuggle
          // shell commands. Browser disconnect kills the child.
          server.middlewares.use("/__hermes_chat", async (req, res, next) => {
            if (req.method !== "POST") return next();
            if (!isLoopback(req)) {
              res.statusCode = 403;
              res.end(JSON.stringify({ error: "loopback only" }));
              return;
            }
            const provided = req.headers["x-claude-os-token"];
            if (provided !== REFRESH_TOKEN) {
              res.statusCode = 403;
              res.end(JSON.stringify({ error: "invalid token" }));
              return;
            }
            let body = "";
            for await (const chunk of req as any) body += chunk;
            let payload: { prompt?: string; sessionId?: string };
            try {
              payload = JSON.parse(body || "{}");
            } catch {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: "invalid json" }));
              return;
            }
            const prompt = payload.prompt?.trim() ?? "";
            if (!prompt || prompt.length > 12_000) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: "prompt empty or too long" }));
              return;
            }
            // Optional sessionId resumes an existing conversation. Hermes'
            // --resume flag loads the prior turns as context so this reply
            // builds on them. We validate the id to a safe character set
            // (alphanumerics + - and _) so it can't escape to argv.
            const sessionId = payload.sessionId?.trim() ?? "";
            if (sessionId && !/^[A-Za-z0-9_-]{1,128}$/.test(sessionId)) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: "invalid sessionId" }));
              return;
            }

            res.setHeader("Content-Type", "text/event-stream");
            res.setHeader("Cache-Control", "no-store");
            res.setHeader("Connection", "keep-alive");
            // Disable any in-between proxy buffering and flush headers so
            // the browser opens the stream immediately. Without this the
            // first chunk can take multiple seconds to appear even after
            // hermes starts producing output.
            res.setHeader("X-Accel-Buffering", "no");
            (res as any).flushHeaders?.();
            // Heartbeat comment every 15s so connections through proxies
            // don't time out mid-thought on a long hermes reply.
            const heartbeat = setInterval(() => {
              res.write(":keepalive\n\n");
            }, 15_000);

            const sendEvent = (event: string, data: string) => {
              const safe = data.replace(/\r/g, "");
              for (const line of safe.split("\n")) {
                res.write(`event: ${event}\n`);
                res.write(`data: ${line}\n\n`);
              }
            };

            // Resolve Hermes. Prefer the venv's Python + source entrypoint
            // (`python hermes_cli/main.py …`) over the `hermes` shim because
            // some installer revisions ship a broken bash shim at
            // ~/.hermes/hermes-agent/venv/bin/hermes that recursively execs
            // ITSELF — every fresh CLI call hangs forever before reaching
            // the Python entry. Calling Python + main.py directly bypasses
            // the shim entirely. Falls back to the wrapper binaries on
            // installs where the source tree isn't present (e.g. pipx).
            const home = homedir();
            const hermesRoot = join(home, ".hermes", "hermes-agent");
            const hermesPython = join(hermesRoot, "venv", "bin", "python");
            const hermesMain = join(hermesRoot, "hermes_cli", "main.py");
            const useSourceEntrypoint =
              existsSync(hermesPython) && existsSync(hermesMain);
            const binCandidates = [
              join(home, ".local", "bin", "hermes"),
              "/opt/homebrew/bin/hermes",
              "/usr/local/bin/hermes",
            ];
            const binPath = useSourceEntrypoint
              ? hermesPython
              : binCandidates.find((p) => existsSync(p));
            if (!binPath) {
              sendEvent("error", "Hermes binary not found on PATH.");
              res.end();
              return;
            }

            // Run hermes from the user's home directory rather than the
            // dev server's cwd. Otherwise hermes auto-injects this repo's
            // CLAUDE.md / AGENTS.md as system context and replies as if
            // it were Claude OS's setup agent. The home dir is a neutral
            // ground — the user's personal ~/.hermes/SOUL.md and memory
            // still load (those are global, not cwd-relative).
            const cwd = home;
            // Nous Research's Hermes uses an explicit `chat` subcommand with
            // -q/--query for single-shot programmatic use and -Q/--quiet to
            // suppress banner/spinner/tool-preview noise so only the model's
            // final reply lands in the SSE stream. (The old `-z` shortcut
            // from earlier Hermes builds doesn't exist in this version.)
            const args = useSourceEntrypoint
              ? [hermesMain, "chat", "-Q", "-q", prompt]
              : ["chat", "-Q", "-q", prompt];
            if (sessionId) args.push("--resume", sessionId);
            // Strip any inherited PYTHONPATH/PYTHONHOME so the venv's own
            // site-packages resolution wins. Inherited values from a parent
            // shell can shadow Hermes' bundled deps and cause silent imports
            // failures that look identical to a hang.
            const hermesEnv = { ...process.env };
            delete hermesEnv.PYTHONPATH;
            delete hermesEnv.PYTHONHOME;
            const child = spawn(binPath, args, {
              cwd,
              env: {
                ...hermesEnv,
                // Python buffers stdout when it isn't a TTY. Without this
                // every reply came out all at once after hermes exited
                // (looked like a hang). Forces line-buffered output so
                // the SSE stream actually streams.
                PYTHONUNBUFFERED: "1",
                // Force a wide pseudo-tty so Hermes doesn't truncate output
                // when its TTY detection misfires under spawn().
                TERM: "xterm-256color",
                COLUMNS: "180",
                LINES: "60",
              },
            });

            // Two-stage watchdog because Nous Research's Hermes CLI has two
            // distinct failure modes:
            //   1. Slow first-output cold start (sqlite migrations, model
            //      load, skills sync) — can take 30-90s on a fresh boot
            //      after the gateway has just claimed locks. We must NOT
            //      kill during this window even though stdout is silent.
            //   2. Post-completion curses/rich hang in --query mode — after
            //      the answer is on stdout, the process spins forever at
            //      100% CPU. Once we see SOME output, an 8s silence means
            //      it's done and we can SIGTERM cleanly.
            const FIRST_OUTPUT_TIMEOUT_MS = 120_000; // 2 min cold-start grace
            const POST_OUTPUT_IDLE_MS = 8_000; // strict after streaming starts
            let watchdog: NodeJS.Timeout | null = null;
            let receivedAnyOutput = false;
            const setIdle = (ms: number) => {
              if (watchdog) clearTimeout(watchdog);
              watchdog = setTimeout(() => {
                if (child.killed) return;
                // Pre-output: hermes is hung waiting for something it
                // can't get (auth lock, network, etc.) — surface as error.
                // Post-output: assume done, terminate cleanly.
                child.kill("SIGTERM");
                setTimeout(() => {
                  if (!child.killed) child.kill("SIGKILL");
                }, 2_000);
              }, ms);
            };
            setIdle(FIRST_OUTPUT_TIMEOUT_MS);

            child.stdout.on("data", (buf: Buffer) => {
              receivedAnyOutput = true;
              sendEvent("chunk", buf.toString("utf-8"));
              setIdle(POST_OUTPUT_IDLE_MS);
            });
            child.stderr.on("data", (buf: Buffer) => {
              // Hermes pipes status into stderr; keep the user's chat
              // bubble clean by routing stderr to an "info" event the
              // client can choose to display dimly.
              receivedAnyOutput = true;
              sendEvent("info", buf.toString("utf-8"));
              setIdle(POST_OUTPUT_IDLE_MS);
            });
            child.on("error", (err) => {
              if (watchdog) clearTimeout(watchdog);
              sendEvent("error", String(err.message || err));
              res.end();
            });
            child.on("close", (code, signal) => {
              clearInterval(heartbeat);
              if (watchdog) clearTimeout(watchdog);
              // SIGTERM/SIGKILL from our watchdog after Hermes already
              // produced its reply counts as a successful turn — the model
              // gave us output, the hang is just in the curses cleanup.
              // Pre-output kills (cold-start timeout) surface as errors so
              // the user knows something's genuinely wrong.
              if (
                code === 0 ||
                ((signal === "SIGTERM" || signal === "SIGKILL") && receivedAnyOutput)
              ) {
                sendEvent("done", "ok");
              } else if (signal === "SIGTERM" || signal === "SIGKILL") {
                sendEvent(
                  "error",
                  "Hermes didn't respond in 2 minutes. Check ~/.hermes/.env has provider credentials and run `hermes gateway restart`.",
                );
              } else {
                sendEvent("error", `hermes exited with code ${code ?? signal}`);
              }
              res.end();
            });
            req.on("close", () => {
              clearInterval(heartbeat);
              if (watchdog) clearTimeout(watchdog);
              if (!child.killed) child.kill("SIGTERM");
            });
          });

          // GET /__hermes_skills — list installed Hermes skill categories
          // by walking ~/.hermes/skills/. Each top-level directory is a
          // category (apple, devops, research, etc.) with a DESCRIPTION.md
          // and zero-or-more sub-skill subdirectories. Loopback only.
          server.middlewares.use("/__hermes_skills", (req, res, next) => {
            if (req.method !== "GET") return next();
            if (!isLoopback(req)) {
              res.statusCode = 403;
              res.end(JSON.stringify({ error: "loopback only" }));
              return;
            }
            const skillsDir = join(homedir(), ".hermes", "skills");
            const out: Array<{
              id: string;
              description: string;
              subskills: string[];
            }> = [];
            try {
              if (existsSync(skillsDir)) {
                const entries = readdirSync(skillsDir, { withFileTypes: true }).filter(
                  (e) => e.isDirectory() && !e.name.startsWith("."),
                );
                // Helper: pull a description from a markdown file with
                // YAML frontmatter. Prefers an explicit `description:`
                // line in the frontmatter, then falls back to the first
                // 1–2 non-heading body lines. Returns "" on any failure.
                function describeFromMd(path: string): string {
                  try {
                    let raw = readFileSync(path, "utf-8");
                    const fm = raw.match(/^---\n[\s\S]*?\n---\n?/);
                    if (fm) raw = raw.slice(fm[0].length);
                    const explicit = fm
                      ? fm[0].match(/^description:\s*["']?(.+?)["']?\s*$/m)?.[1]
                      : undefined;
                    let description =
                      explicit?.trim() ||
                      raw
                        .split("\n")
                        .filter((l) => l.trim() && !l.startsWith("#"))
                        .slice(0, 2)
                        .join(" ")
                        .trim();
                    return description.slice(0, 240);
                  } catch {
                    return "";
                  }
                }
                for (const e of entries) {
                  const dir = join(skillsDir, e.name);
                  // 1) Prefer a top-level DESCRIPTION.md (Hermes-style).
                  let description = "";
                  const descPath = join(dir, "DESCRIPTION.md");
                  if (existsSync(descPath)) {
                    description = describeFromMd(descPath);
                  }
                  // 2) Fall back to a top-level SKILL.md — bundled Hermes
                  //    skills (dogfood, claude-os, etc.) carry their
                  //    description in the SKILL.md frontmatter instead.
                  if (!description) {
                    const skillPath = join(dir, "SKILL.md");
                    if (existsSync(skillPath)) {
                      description = describeFromMd(skillPath);
                    }
                  }
                  // 3) Some categories have neither at the top level but
                  //    DO have subskill directories with their own
                  //    SKILL.md (e.g. devops/<some-skill>/SKILL.md). For
                  //    those we synthesize a description from the first
                  //    sub-skill's frontmatter — better than empty.
                  if (!description) {
                    try {
                      const subs = readdirSync(dir, { withFileTypes: true })
                        .filter((s) => s.isDirectory() && !s.name.startsWith("."))
                        .map((s) => s.name);
                      for (const sub of subs) {
                        const subSkillPath = join(dir, sub, "SKILL.md");
                        if (existsSync(subSkillPath)) {
                          const subDesc = describeFromMd(subSkillPath);
                          if (subDesc) {
                            description = subDesc;
                            break;
                          }
                        }
                      }
                    } catch {
                      /* ignore */
                    }
                  }
                  let subskills: string[] = [];
                  try {
                    subskills = readdirSync(dir, { withFileTypes: true })
                      .filter((s) => s.isDirectory() && !s.name.startsWith("."))
                      .map((s) => s.name)
                      .slice(0, 12);
                  } catch {
                    /* ignore */
                  }
                  out.push({ id: e.name, description, subskills });
                }
              }
            } catch {
              /* surface empty list rather than 500 */
            }
            res.setHeader("Content-Type", "application/json");
            res.setHeader("Cache-Control", "no-store");
            res.end(JSON.stringify({ skills: out }));
          });

          // GET /__hermes_profiles — list configured Hermes profiles by
          // shelling out to `hermes profile list`. Each row in the output
          // is a profile (◆default → name, model, gateway, alias). The
          // active profile is marked with ◆. Loopback only.
          server.middlewares.use("/__hermes_profiles", (req, res, next) => {
            if (req.method !== "GET") return next();
            if (!isLoopback(req)) {
              res.statusCode = 403;
              res.end(JSON.stringify({ error: "loopback only" }));
              return;
            }
            const out: Array<{
              name: string;
              model: string | null;
              gateway: string | null;
              alias: string | null;
              distribution: string | null;
              active: boolean;
            }> = [];
            try {
              // Use `hermes profile list` with no --json flag — the binary's
              // table output is stable enough for line-parsing. The leading
              // ◆ glyph marks the sticky-default profile. We strip Rich box-
              // drawing chars and split on 2+ spaces between cells.
              const raw = execSync("hermes profile list", {
                encoding: "utf-8",
                stdio: ["ignore", "pipe", "ignore"],
                env: { ...process.env, NO_COLOR: "1" },
                timeout: 5000,
              });
              const lines = raw.split("\n");
              for (const line of lines) {
                // Strip Rich's heavy box-drawing characters so we can split
                // on 2+ spaces cleanly.
                const clean = line.replace(/[┃│┏┓┗┛━─╇┡┩┛┃◇]/g, " ").trim();
                if (!clean) continue;
                // Header / divider rows
                if (
                  /^Profile/i.test(clean) ||
                  /^[\s─━]+$/.test(clean) ||
                  /^Name\s+Model/i.test(clean)
                )
                  continue;
                const cells = clean.split(/\s{2,}/).map((c) => c.trim());
                if (cells.length < 2) continue;
                let name = cells[0];
                const active = name.startsWith("◆") || name.startsWith("*");
                name = name.replace(/^[◆*]\s*/, "").trim();
                if (!name || /^[—-]+$/.test(name)) continue;
                // Skip rows that are just emoji-only or look bogus
                if (!/[a-z0-9_-]/i.test(name)) continue;
                const model = cells[1] && !/^[—-]+$/.test(cells[1]) ? cells[1] : null;
                const gateway = cells[2] && !/^[—-]+$/.test(cells[2]) ? cells[2] : null;
                const alias = cells[3] && !/^[—-]+$/.test(cells[3]) ? cells[3] : null;
                const distribution =
                  cells[4] && !/^[—-]+$/.test(cells[4]) ? cells[4] : null;
                out.push({ name, model, gateway, alias, distribution, active });
              }
            } catch {
              /* hermes binary not found / errored — surface empty list */
            }
            res.setHeader("Content-Type", "application/json");
            res.setHeader("Cache-Control", "no-store");
            res.end(JSON.stringify({ profiles: out }));
          });

          // GET /__hermes_connections — Hermes-specific connectivity. Real
          // signals only: provider auths from auth.json, messaging gateway
          // tokens from ~/.hermes/.env, configured MCP servers. NOT the
          // dashboard's broader machine integrations — those don't
          // necessarily plumb into Hermes. Loopback only.
          //
          // Returns { connections: [{kind, name, slug, status}] }
          //   kind = "provider" | "gateway" | "mcp" | "memory"
          //   slug = brand-icon slug for logo lookup
          //   status = "connected" | "needs_setup"
          server.middlewares.use("/__hermes_connections", (req, res, next) => {
            if (req.method !== "GET") return next();
            if (!isLoopback(req)) {
              res.statusCode = 403;
              res.end(JSON.stringify({ error: "loopback only" }));
              return;
            }
            // 30s cache — connections rarely change inside one user session;
            // running 6 CLI probes on every page focus is wasteful.
            if (sendCached("hermes-connections", res)) return;
            const conns: Array<{
              kind: string;
              name: string;
              slug: string;
              status: string;
            }> = [];

            // 1. Provider auths — read auth.json's providers map.
            try {
              const authPath = join(homedir(), ".hermes", "auth.json");
              if (existsSync(authPath)) {
                const raw = readFileSync(authPath, "utf-8");
                const j = JSON.parse(raw);
                const providers = j?.providers ?? {};
                for (const key of Object.keys(providers)) {
                  conns.push({
                    kind: "provider",
                    name: key,
                    slug: key.toLowerCase().replace(/-codex$/, ""),
                    status: "connected",
                  });
                }
              }
            } catch {
              /* ignore */
            }

            // 2. Messaging gateway tokens — read .env, look for known keys.
            //    Also: GENERIC API-key scan. Any other *_API_KEY / *_TOKEN /
            //    *_SECRET that the user has set (uncommented + non-empty)
            //    surfaces as a "service" connection automatically. This
            //    means dropping APOLLO_API_KEY into ~/.hermes/.env is all
            //    it takes for Apollo to show up in the dashboard strip —
            //    no code changes needed for every new skill/service.
            try {
              const envPath = join(homedir(), ".hermes", ".env");
              if (existsSync(envPath)) {
                const env = readFileSync(envPath, "utf-8");
                const GATEWAY_TOKENS: Record<
                  string,
                  { name: string; slug: string }
                > = {
                  TELEGRAM_BOT_TOKEN: { name: "Telegram", slug: "telegram" },
                  SLACK_BOT_TOKEN: { name: "Slack", slug: "slack" },
                  DISCORD_TOKEN: { name: "Discord", slug: "discord" },
                  WHATSAPP_CLOUD_TOKEN: { name: "WhatsApp", slug: "whatsapp" },
                  TWILIO_AUTH_TOKEN: { name: "SMS", slug: "twilio" },
                  RESEND_API_KEY: { name: "Email", slug: "resend" },
                  SENDGRID_API_KEY: { name: "Email", slug: "sendgrid" },
                };
                const knownTokenKeys = new Set(Object.keys(GATEWAY_TOKENS));
                for (const [token, meta] of Object.entries(GATEWAY_TOKENS)) {
                  const re = new RegExp(`^\\s*${token}\\s*=\\s*[^\\s#]`, "m");
                  if (re.test(env)) {
                    conns.push({
                      kind: "gateway",
                      name: meta.name,
                      slug: meta.slug,
                      status: "connected",
                    });
                  }
                }

                // Generic pass: catch ANY service the user has added via
                // an API key / token / secret env var. Skip anything we've
                // already surfaced above + provider creds (those come from
                // auth.json) + bare-noise tokens (HF_HOME etc. that aren't
                // credentials).
                const PROVIDER_KEYS = new Set([
                  "ANTHROPIC_API_KEY",
                  "OPENAI_API_KEY",
                  "OPENROUTER_API_KEY",
                  "GROQ_API_KEY",
                  "MISTRAL_API_KEY",
                  "GEMINI_API_KEY",
                  "GOOGLE_API_KEY",
                  "GOOGLE_GENERATIVE_AI_API_KEY",
                  "PERPLEXITY_API_KEY",
                  "COHERE_API_KEY",
                ]);
                const NON_CREDENTIAL_NOISE = new Set([
                  "HF_TOKEN", // some setups use this for HuggingFace download cache, still a token though
                ]);
                const seenServices = new Set<string>();
                // Match `NAME_API_KEY=value`, `NAME_TOKEN=value`, etc.
                const pattern = /^\s*([A-Z][A-Z0-9_]*?)_(API_KEY|TOKEN|SECRET|ACCESS_TOKEN|API_TOKEN)\s*=\s*([^\s#].*)$/gm;
                let m: RegExpExecArray | null;
                while ((m = pattern.exec(env)) !== null) {
                  const fullKey = `${m[1]}_${m[2]}`;
                  if (knownTokenKeys.has(fullKey)) continue; // already surfaced as gateway
                  if (PROVIDER_KEYS.has(fullKey)) continue;  // provider, comes from auth.json
                  if (NON_CREDENTIAL_NOISE.has(fullKey)) continue;
                  const root = m[1].toLowerCase();
                  if (seenServices.has(root)) continue;
                  seenServices.add(root);
                  // Derive a human-readable name: APOLLO -> "Apollo",
                  // STRIPE_LIVE -> "Stripe Live", AIRTABLE -> "Airtable".
                  const niceName = root
                    .split("_")
                    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : ""))
                    .join(" ");
                  const slug = root.replace(/_/g, "-");
                  conns.push({
                    kind: "service",
                    name: niceName,
                    slug,
                    status: "connected",
                  });
                }
              }
            } catch {
              /* ignore */
            }

            // 3. MCP servers — Hermes CLI requires a TTY for `mcp list`,
            // which means execSync from a non-TTY context hangs until
            // timeout. The endpoint was eating 3s per request for zero
            // benefit. Skip until Hermes ships a non-interactive flag.

            // 4. CLI-backed services — Hermes' skills use external CLIs
            // (gh, gws, linear-cli, spotify, etc.) for their actual work.
            // We probe each CLI's "am I authenticated?" command. If it
            // returns 0, the user has a working connection. Probes are
            // 500ms timeout + silent so missing/slow CLIs never block.
            // Most fail instantly (command not found) which is sub-ms.
            const cliServices: Array<{
              name: string;
              slug: string;
              probe: string;
            }> = [
              { name: "GitHub", slug: "github", probe: "gh auth status" },
              { name: "Google Workspace", slug: "google", probe: "gws auth status" },
              { name: "Linear", slug: "linear", probe: "linear whoami" },
              { name: "Spotify", slug: "spotify", probe: "spotify auth status" },
              { name: "Notion", slug: "notion", probe: "test -n \"$NOTION_TOKEN\"" },
              { name: "Airtable", slug: "airtable", probe: "test -n \"$AIRTABLE_API_KEY\"" },
            ];
            for (const svc of cliServices) {
              try {
                execSync(svc.probe, {
                  stdio: ["ignore", "ignore", "ignore"],
                  env: { ...process.env, NO_COLOR: "1" },
                  timeout: 500,
                });
                conns.push({
                  kind: "service",
                  name: svc.name,
                  slug: svc.slug,
                  status: "connected",
                });
              } catch {
                /* not authenticated or CLI not installed — skip */
              }
            }

            const body = JSON.stringify({ connections: conns });
            storeCached("hermes-connections", 30000, body);
            res.setHeader("Content-Type", "application/json");
            res.setHeader("Cache-Control", "no-store");
            res.setHeader("X-Cache", "MISS");
            res.end(body);
          });

          // ────────────────────────────────────────────────────────────────
          // Pantheon — persona YAMLs at ~/.hermes/pantheon/personas/*.yaml.
          // Schema (per Hermes' spec, see PROFILE_TEMPLATES.tsx):
          //   id, name, description, avatar?, model:{provider,name},
          //   behavior:{tone,system_prompt}, skills:[], tools:[],
          //   summon_phrases:[]
          //
          // GET  /__hermes_pantheon         → list installed personas
          // POST /__hermes_pantheon/install → write the seed 10 YAMLs
          //                                   (idempotent — skips files
          //                                   that already exist so user
          //                                   edits aren't clobbered).
          //                                   Token-gated.
          // POST /__hermes_pantheon/validate → schema-check a single
          //                                    persona payload
          // ────────────────────────────────────────────────────────────────
          // Lazy-loaded — only the pantheon routes use it, so we keep
          // top-level imports stable.
          const pantheonDir = join(homedir(), ".hermes", "pantheon", "personas");
          const pantheonAssetsDir = join(homedir(), ".hermes", "pantheon", "assets");

          /** Read one persona YAML file → parsed object + path. Returns
           *  null on parse error (we log to stderr but don't 500 the
           *  whole listing for one bad file). */
          async function readPersonaFile(path: string): Promise<any | null> {
            try {
              const yaml = await import("js-yaml");
              const raw = readFileSync(path, "utf-8");
              return yaml.load(raw);
            } catch {
              return null;
            }
          }

          server.middlewares.use("/__hermes_pantheon", async (req, res, next) => {
            // vite strips the mount prefix; inside this handler req.url is
            // "/" for bare GETs and "/install" / "/validate" for sub-paths.
            // We only handle the bare GET here — sub-paths fall through to
            // the install/validate handlers below.
            const url = new URL(req.url ?? "/", "http://x");
            if (url.pathname !== "/") return next();
            if (req.method !== "GET") return next();
            if (!isLoopback(req)) {
              res.statusCode = 403;
              res.end(JSON.stringify({ error: "loopback only" }));
              return;
            }
            const personas: any[] = [];
            try {
              if (existsSync(pantheonDir)) {
                const files = readdirSync(pantheonDir).filter(
                  (f) => f.endsWith(".yaml") || f.endsWith(".yml"),
                );
                for (const f of files) {
                  const obj = await readPersonaFile(join(pantheonDir, f));
                  if (obj && typeof obj === "object" && obj.id) {
                    personas.push({ ...obj, _file: f });
                  }
                }
              }
            } catch {
              /* surface empty list rather than 500 */
            }
            res.setHeader("Content-Type", "application/json");
            res.setHeader("Cache-Control", "no-store");
            res.end(
              JSON.stringify({
                personas,
                installed: existsSync(pantheonDir),
                dir: pantheonDir,
              }),
            );
          });

          // POST /__hermes_pantheon/install — writes the 10 seed YAMLs
          // (curated by the operator + Hermes) to ~/.hermes/pantheon/personas/.
          // Skips any file that already exists, so re-running is safe
          // and doesn't clobber user customisations.
          server.middlewares.use("/__hermes_pantheon/install", async (req, res, next) => {
            if (req.method !== "POST") return next();
            if (!isLoopback(req)) {
              res.statusCode = 403;
              res.end(JSON.stringify({ error: "loopback only" }));
              return;
            }
            const token = req.headers["x-claude-os-token"];
            if (token !== REFRESH_TOKEN) {
              res.statusCode = 403;
              res.end(JSON.stringify({ error: "bad token" }));
              return;
            }
            try {
              mkdirSync(pantheonDir, { recursive: true });
              mkdirSync(pantheonAssetsDir, { recursive: true });
            } catch {
              /* ignore */
            }
            const yaml = await import("js-yaml");
            const written: string[] = [];
            const skipped: string[] = [];
            // Only seed personas flagged as default. The rest are still
            // available as templates via /create but don't get auto-written
            // on install (design call — fewer personas by default is better
            // UX than 10 unfamiliar tiles).
            for (const seed of PANTHEON_SEEDS.filter((s) => s.default)) {
              const dest = join(pantheonDir, `${seed.id}.yaml`);
              if (existsSync(dest)) {
                skipped.push(seed.id);
                continue;
              }
              try {
                const body = yaml.dump(seed, {
                  lineWidth: 100,
                  noRefs: true,
                  sortKeys: false,
                });
                writeFileSync(dest, body, "utf-8");
                written.push(seed.id);
              } catch {
                /* file write fail — leave it out */
              }
            }
            res.setHeader("Content-Type", "application/json");
            res.end(
              JSON.stringify({
                written,
                skipped,
                dir: pantheonDir,
              }),
            );
          });

          // POST /__hermes_pantheon/validate — schema-checks a persona
          // payload (request body = JSON {persona: <obj>}). Returns
          // {errors: [], warnings: []} so the dashboard can light up
          // a card before allowing export.
          server.middlewares.use("/__hermes_pantheon/validate", (req, res, next) => {
            if (req.method !== "POST") return next();
            if (!isLoopback(req)) {
              res.statusCode = 403;
              res.end(JSON.stringify({ error: "loopback only" }));
              return;
            }
            let body = "";
            req.on("data", (c) => (body += c));
            req.on("end", () => {
              let payload: any;
              try {
                payload = JSON.parse(body);
              } catch {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: "invalid json" }));
                return;
              }
              const p = payload?.persona ?? payload;
              const errors: string[] = [];
              const warnings: string[] = [];
              if (!p?.id) errors.push("missing id");
              if (!p?.name) errors.push("missing name");
              if (!p?.model?.name) errors.push("missing model.name");
              if (!p?.model?.provider) warnings.push("missing model.provider");
              if (!p?.behavior?.system_prompt) errors.push("missing behavior.system_prompt");
              if (!Array.isArray(p?.skills) || p.skills.length === 0)
                warnings.push("no skills listed");
              if (!Array.isArray(p?.summon_phrases) || p.summon_phrases.length === 0)
                errors.push("missing summon_phrases (at least 1 required)");
              // Tripwire — common secret patterns that should never appear
              // in a YAML you're about to push to GitHub.
              const flat = JSON.stringify(p ?? {});
              if (/sk-[a-z0-9]{20,}/i.test(flat)) errors.push("looks like an api key in payload");
              if (/(api_?key|secret|password)\s*[:=]/i.test(flat))
                warnings.push("payload mentions 'api_key/secret/password' — double-check");
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ ok: errors.length === 0, errors, warnings }));
            });
          });

          // POST /__hermes_pantheon/create — create a new persona from one
          // of the PANTHEON_SEEDS templates, with the user's model + job
          // overrides applied. Returns 409 if a YAML with that id already
          // exists (the user is expected to pick an unused template).
          server.middlewares.use("/__hermes_pantheon/create", (req, res, next) => {
            if (req.method !== "POST") return next();
            if (!isLoopback(req)) {
              res.statusCode = 403;
              res.end(JSON.stringify({ error: "loopback only" }));
              return;
            }
            const token = req.headers["x-claude-os-token"];
            if (token !== REFRESH_TOKEN) {
              res.statusCode = 403;
              res.end(JSON.stringify({ error: "bad token" }));
              return;
            }
            let body = "";
            req.on("data", (c) => (body += c));
            req.on("end", async () => {
              let payload: any;
              try {
                payload = JSON.parse(body);
              } catch {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: "invalid json" }));
                return;
              }
              const { templateId, model, job, description, prompt } = payload ?? {};
              const seed = PANTHEON_SEEDS.find((s) => s.id === templateId);
              if (!seed) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: "unknown template id" }));
                return;
              }
              const dest = join(pantheonDir, `${seed.id}.yaml`);
              if (existsSync(dest)) {
                res.statusCode = 409;
                res.end(JSON.stringify({ error: "persona already exists" }));
                return;
              }
              try {
                mkdirSync(pantheonDir, { recursive: true });
              } catch {
                /* ignore */
              }
              const merged = {
                ...seed,
                job: typeof job === "string" && job.trim() ? job.trim() : seed.job,
                description:
                  typeof description === "string" && description.trim()
                    ? description.trim()
                    : seed.description,
                model:
                  model && model.provider && model.name
                    ? { provider: model.provider, name: model.name }
                    : seed.model,
                behavior:
                  typeof prompt === "string" && prompt.trim()
                    ? { ...seed.behavior, system_prompt: prompt.trim() }
                    : seed.behavior,
              };
              try {
                const yaml = await import("js-yaml");
                writeFileSync(
                  dest,
                  yaml.dump(merged, { lineWidth: 100, noRefs: true, sortKeys: false }),
                  "utf-8",
                );
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ ok: true, persona: merged }));
              } catch (err: any) {
                res.statusCode = 500;
                res.end(JSON.stringify({ error: err?.message ?? "write failed" }));
              }
            });
          });

          // ══════════════════════════════════════════════════════════════
          // GET /__personas_overview — every non-Greek persona on disk
          // with the fields the /personas sync page needs: id, name,
          // job, description, tone, summon phrases, model, tools, avatar
          // URL, system_prompt length (so we can flag thin ones).
          // ══════════════════════════════════════════════════════════════
          server.middlewares.use("/__personas_overview", (req, res, next) => {
            if (req.method !== "GET") return next();
            if (!isLoopback(req)) return endJson(res, 403, { error: "loopback only" });
            const GREEK = new Set(["messenger","oracle","athena","scribe","orpheus","alchemist","mapmaker"]);
            const dir = join(HOME, ".hermes", "pantheon", "personas");
            const personas: any[] = [];
            try {
              for (const f of readdirSync(dir)) {
                if (!f.endsWith(".yaml")) continue;
                const id = f.replace(/\.yaml$/, "");
                if (GREEK.has(id)) continue;
                try {
                  const raw = readFileSync(join(dir, f), "utf-8");
                  // Tolerant field extraction — no yaml dep
                  const pick = (k: string): string | null => {
                    const m = raw.match(new RegExp(`^${k}:\\s*(.+?)$`, "m"));
                    return m ? m[1].replace(/^['"]|['"]$/g, "").trim() : null;
                  };
                  const name = pick("name") ?? id;
                  const job  = pick("job")  ?? "";
                  const desc = (raw.match(/^description:\s*([\s\S]+?)(?=^[a-z_]+:|$(?![\s\S]))/m) ?? [, ""])[1].trim().replace(/^>-?\s*/, "").slice(0, 600);
                  const tone = (raw.match(/^\s*tone:\s*(.+)$/m) ?? [, ""])[1].replace(/^['"]|['"]$/g, "").trim();
                  const model = (raw.match(/^\s*name:\s*([\w\-./:]+)\s*$/m) ?? [, ""])[1];
                  const sysLen = (raw.match(/system_prompt:[\s\S]{0,8000}/) ?? [""])[0].length;
                  // summon phrases — first 6 from the YAML list
                  const summons: string[] = [];
                  const sm = raw.match(/summon_phrases:\s*([\s\S]+?)(?=\n[a-z_]+:|$)/);
                  if (sm) {
                    for (const line of sm[1].split("\n")) {
                      const m = line.match(/^\s*-\s*['"]?(.+?)['"]?\s*$/);
                      if (m && summons.length < 6) summons.push(m[1]);
                    }
                  }
                  const tools: string[] = [];
                  const tm = raw.match(/^tools:\s*([\s\S]+?)(?=\n[a-z_]+:|$)/m);
                  if (tm) {
                    for (const line of tm[1].split("\n")) {
                      const m = line.match(/^\s*-\s*([\w\-]+)\s*$/);
                      if (m) tools.push(m[1]);
                    }
                  }
                  personas.push({ id, name, job, description: desc, tone, model, tools, summonPhrases: summons, sysLen, avatarUrl: `/__pantheon_avatar?id=${id}` });
                } catch { /* skip */ }
              }
            } catch { /* skip */ }
            personas.sort((a, b) => a.name.localeCompare(b.name));
            endJson(res, 200, { personas, count: personas.length });
          });

          // GET /__hermes_pantheon_templates — surface the seed catalog
          // (id, name, job, default model) so the dashboard's Add Persona
          // wizard can show what's available without duplicating the data.
          server.middlewares.use("/__hermes_pantheon_templates", (req, res, next) => {
            if (req.method !== "GET") return next();
            if (!isLoopback(req)) {
              res.statusCode = 403;
              res.end(JSON.stringify({ error: "loopback only" }));
              return;
            }
            const out = PANTHEON_SEEDS.map((s) => ({
              id: s.id,
              name: s.name,
              job: s.job ?? "",
              description: s.description,
              defaultModel: s.model,
            }));
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ templates: out }));
          });

          // PUT or DELETE /__hermes_pantheon/<id> — edit or remove a
          // persona's YAML on disk. Body for PUT: JSON patch (shallow
          // merged onto the existing YAML). DELETE just unlinks the file.
          // Token-gated, loopback only.
          server.middlewares.use("/__hermes_pantheon/", async (req, res, next) => {
            // Mounted on /__hermes_pantheon/ so we catch /<id> requests
            // (install / validate / create are mounted separately above).
            if (req.method !== "PUT" && req.method !== "POST" && req.method !== "DELETE")
              return next();
            if (!isLoopback(req)) {
              res.statusCode = 403;
              res.end(JSON.stringify({ error: "loopback only" }));
              return;
            }
            const url = new URL(req.url ?? "/", "http://x");
            const id = url.pathname.replace(/^\//, "").split("/")[0];
            // The /install and /validate sub-routes are handled by their own
            // middleware higher up. Anything else falls through to here as
            // an "edit this persona by id" request.
            if (!id || id === "install" || id === "validate") return next();
            if (!/^[a-z0-9_-]+$/i.test(id)) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: "invalid id" }));
              return;
            }
            const token = req.headers["x-claude-os-token"];
            if (token !== REFRESH_TOKEN) {
              res.statusCode = 403;
              res.end(JSON.stringify({ error: "bad token" }));
              return;
            }
            const filePath = join(pantheonDir, `${id}.yaml`);
            if (!existsSync(filePath)) {
              res.statusCode = 404;
              res.end(JSON.stringify({ error: "persona not found" }));
              return;
            }

            // DELETE — unlink the YAML and return ok.
            if (req.method === "DELETE") {
              try {
                unlinkSync(filePath);
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ ok: true, deleted: id }));
              } catch (err: any) {
                res.statusCode = 500;
                res.end(JSON.stringify({ error: err?.message ?? "delete failed" }));
              }
              return;
            }

            // PUT/POST — JSON-patch the YAML on disk.
            let body = "";
            req.on("data", (c) => (body += c));
            req.on("end", async () => {
              let patch: any;
              try {
                patch = JSON.parse(body);
              } catch {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: "invalid json" }));
                return;
              }
              try {
                const yaml = await import("js-yaml");
                const existing = (yaml.load(readFileSync(filePath, "utf-8")) as any) ?? {};
                // Shallow merge for top-level fields; nested merge for
                // model + behavior so partial updates don't clobber other keys.
                const merged = { ...existing, ...patch };
                if (patch.model && existing.model)
                  merged.model = { ...existing.model, ...patch.model };
                if (patch.behavior && existing.behavior)
                  merged.behavior = { ...existing.behavior, ...patch.behavior };
                const out = yaml.dump(merged, {
                  lineWidth: 100,
                  noRefs: true,
                  sortKeys: false,
                });
                writeFileSync(filePath, out, "utf-8");
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ ok: true, persona: merged }));
              } catch (err: any) {
                res.statusCode = 500;
                res.end(JSON.stringify({ error: err?.message ?? "write failed" }));
              }
            });
          });

          // GET /__hermes_models — list the user's available models so the
          // persona-edit dropdown is grounded in reality. Sources:
          //   1. The default in ~/.hermes/config.yaml (highest signal —
          //      this is what the user has actually set up)
          //   2. A curated catalog of widely-supported models grouped by
          //      provider, used as the dropdown's "recommended" section.
          // Loopback only.
          server.middlewares.use("/__hermes_models", (req, res, next) => {
            if (req.method !== "GET") return next();
            if (!isLoopback(req)) {
              res.statusCode = 403;
              res.end(JSON.stringify({ error: "loopback only" }));
              return;
            }
            // Default from config.yaml
            let defaultModel: { provider: string; name: string } | null = null;
            try {
              const cfgPath = join(homedir(), ".hermes", "config.yaml");
              if (existsSync(cfgPath)) {
                const text = readFileSync(cfgPath, "utf-8");
                const m = text.match(/^model:\s*\n((?:[ \t]+.+\n)+)/m);
                if (m) {
                  const block = m[1];
                  const name = block.match(/^\s+default:\s*["']?([^"'\n]+)/m)?.[1]?.trim();
                  const provider = block
                    .match(/^\s+provider:\s*["']?([^"'\n]+)/m)?.[1]
                    ?.trim();
                  if (name) defaultModel = { provider: provider ?? "openai", name };
                }
              }
            } catch {
              /* ignore */
            }
            // Curated catalog. Names match real model ids accepted by their
            // respective providers. Free tier flagged so the dropdown can
            // surface them.
            // Comprehensive catalog reflecting what Hermes can integrate
            // with as of v0.13. Groups by provider (OpenAI / Anthropic /
            // Google / OpenRouter / xAI / Mistral / Ollama / Cohere).
            // Tiers: top (frontier), mid (default), cheap (fast/small),
            // free (no-cost tier).
            const catalog = [
              {
                provider: "openai",
                models: [
                  { name: "gpt-5.5", tier: "top" },
                  { name: "gpt-5", tier: "mid" },
                  { name: "gpt-4.5", tier: "mid" },
                  { name: "gpt-4o", tier: "mid" },
                  { name: "gpt-4o-mini", tier: "cheap" },
                  { name: "o3", tier: "top" },
                  { name: "o3-mini", tier: "mid" },
                  { name: "o1", tier: "top" },
                ],
              },
              {
                provider: "anthropic",
                models: [
                  { name: "claude-opus-4.7", tier: "top" },
                  { name: "claude-sonnet-4.5", tier: "mid" },
                  { name: "claude-sonnet-4", tier: "mid" },
                  { name: "claude-haiku-4", tier: "cheap" },
                ],
              },
              {
                provider: "googlegemini",
                models: [
                  { name: "gemini-2.5-pro", tier: "top" },
                  { name: "gemini-2.5-flash", tier: "mid" },
                  { name: "gemini-2.0-flash", tier: "cheap" },
                  { name: "gemini-1.5-pro", tier: "mid" },
                ],
              },
              {
                provider: "openrouter",
                models: [
                  { name: "meta-llama/llama-3.3-70b-instruct:free", tier: "free" },
                  { name: "google/gemini-2.0-flash-exp:free", tier: "free" },
                  { name: "qwen/qwen-2.5-72b-instruct:free", tier: "free" },
                  { name: "mistralai/mistral-7b-instruct:free", tier: "free" },
                  { name: "deepseek/deepseek-r1:free", tier: "free" },
                ],
              },
              {
                provider: "xai",
                models: [
                  { name: "grok-3", tier: "top" },
                  { name: "grok-2", tier: "mid" },
                ],
              },
              {
                provider: "mistral",
                models: [
                  { name: "mistral-large-2", tier: "top" },
                  { name: "mistral-small-3", tier: "cheap" },
                ],
              },
              {
                provider: "ollama",
                models: [
                  { name: "llama3.3", tier: "free" },
                  { name: "qwen2.5", tier: "free" },
                  { name: "mistral", tier: "free" },
                ],
              },
              {
                provider: "groq",
                models: [
                  { name: "llama-3.3-70b-versatile", tier: "mid" },
                  { name: "mixtral-8x7b-32768", tier: "mid" },
                ],
              },
              {
                provider: "cohere",
                models: [
                  { name: "command-r-plus", tier: "mid" },
                ],
              },
            ];
            res.setHeader("Content-Type", "application/json");
            res.setHeader("Cache-Control", "no-store");
            res.end(JSON.stringify({ default: defaultModel, catalog }));
          });

          // GET /__hermes_pantheon_sync — per-persona git sync status.
          //
          // Architecture: personas live at ~/.hermes/pantheon/personas/
          // (NOT a git repo). The Hermes "Take Hermes anywhere" flow
          // rsyncs ~/.hermes/ into a mirror dir (default ~/code/hermes-mirror/)
          // and pushes THAT to GitHub. So sync status = "does the mirror's
          // pantheon/personas/<id>.yaml byte-match the source AND is the
          // mirror clean + pushed?"
          //
          // Mirror path resolution (in order):
          //   1. $HERMES_MIRROR env var
          //   2. ~/.hermes/.mirror_path marker file (one line, absolute path)
          //   3. ~/code/hermes-mirror/ (the default the install prompt uses)
          //
          // Classification (mapped to the frontend's existing 4 states):
          //   synced    = source matches mirror, mirror clean, at or behind upstream
          //   dirty     = source differs from mirror, OR mirror has uncommitted changes
          //   untracked = persona missing from mirror entirely
          //   no_repo   = no mirror configured
          // Loopback only.
          server.middlewares.use("/__hermes_pantheon_sync", (req, res, next) => {
            if (req.method !== "GET") return next();
            if (!isLoopback(req)) {
              res.statusCode = 403;
              res.end(JSON.stringify({ error: "loopback only" }));
              return;
            }
            // 5s cache — short because GHSyncStepCard's Copy click polls
            // every 5s for 90s expecting badges to flip green. 5s TTL
            // means each poll hits the cache once then recomputes — fast
            // enough to feel live, slow enough to not thrash git on every
            // tick.
            if (sendCached("hermes-pantheon-sync", res)) return;
            const out: Record<string, "synced" | "dirty" | "untracked" | "no_repo"> = {};

            // List source personas first — these are what we're checking sync for.
            let sourceFiles: string[] = [];
            try {
              if (existsSync(pantheonDir)) {
                sourceFiles = readdirSync(pantheonDir).filter((f) => f.endsWith(".yaml"));
              }
            } catch {
              /* ignore */
            }

            // Resolve mirror path.
            let mirrorRoot = process.env.HERMES_MIRROR ?? "";
            if (!mirrorRoot) {
              try {
                const markerPath = join(homedir(), ".hermes", ".mirror_path");
                if (existsSync(markerPath)) {
                  mirrorRoot = readFileSync(markerPath, "utf-8").trim();
                }
              } catch {
                /* ignore */
              }
            }
            if (!mirrorRoot) {
              mirrorRoot = join(homedir(), "code", "hermes-mirror");
            }
            const mirrorGit = join(mirrorRoot, ".git");
            const mirrorPersonas = join(mirrorRoot, "pantheon", "personas");

            // No mirror configured → every persona is no_repo.
            if (!existsSync(mirrorGit)) {
              for (const f of sourceFiles) {
                out[f.replace(/\.yaml$/, "")] = "no_repo";
              }
              const body = JSON.stringify({ statuses: out, hasRepo: false, mirrorRoot });
              storeCached("hermes-pantheon-sync", 5000, body);
              res.setHeader("Content-Type", "application/json");
              res.setHeader("X-Cache", "MISS");
              res.end(body);
              return;
            }

            // Check whether the mirror has uncommitted changes in pantheon/.
            let mirrorDirty = false;
            const dirtyMirrorIds = new Set<string>();
            const untrackedMirrorIds = new Set<string>();
            try {
              const porcelain = execSync("git status --porcelain pantheon/personas/", {
                cwd: mirrorRoot,
                encoding: "utf-8",
                stdio: ["ignore", "pipe", "ignore"],
                timeout: 3000,
              });
              for (const line of porcelain.split("\n")) {
                if (!line) continue;
                const flag = line.slice(0, 2);
                const path = line.slice(3).trim();
                const m = path.match(/pantheon\/personas\/([a-z0-9_-]+)\.yaml/i);
                if (!m) continue;
                const id = m[1];
                if (flag.includes("?")) untrackedMirrorIds.add(id);
                else dirtyMirrorIds.add(id);
                mirrorDirty = true;
              }
            } catch {
              /* leave defaults */
            }

            // Compare each source file byte-for-byte against the mirror copy.
            for (const f of sourceFiles) {
              const id = f.replace(/\.yaml$/, "");
              const srcPath = join(pantheonDir, f);
              const mirrorPath = join(mirrorPersonas, f);
              if (!existsSync(mirrorPath)) {
                out[id] = "untracked";
                continue;
              }
              let same = false;
              try {
                same =
                  readFileSync(srcPath, "utf-8") === readFileSync(mirrorPath, "utf-8");
              } catch {
                /* treat as different */
              }
              if (!same) {
                out[id] = "dirty";
                continue;
              }
              if (dirtyMirrorIds.has(id) || untrackedMirrorIds.has(id)) {
                out[id] = "dirty";
                continue;
              }
              out[id] = "synced";
            }

            const body = JSON.stringify({
              statuses: out,
              hasRepo: true,
              mirrorRoot,
              mirrorDirty,
            });
            storeCached("hermes-pantheon-sync", 5000, body);
            res.setHeader("Content-Type", "application/json");
            res.setHeader("Cache-Control", "no-store");
            res.setHeader("X-Cache", "MISS");
            res.end(body);
          });

          // ────────────────────────────────────────────────────────────────
          // GET /__hermes_memory — universal memory readout for whichever
          // Hermes install is on this box. Respects $HERMES_HOME with a
          // fallback to ~/.hermes (per Hermes' own spec), so the dashboard
          // works for anyone who's installed Hermes in a non-default dir.
          // Returns:
          //   hermesHome             — resolved path
          //   user                   — { content, charCount, charLimit }
          //   memory                 — { content, charCount, charLimit }
          //   soul                   — { content, charCount, isTemplate }
          //                            (SOUL is the personality file, NOT
          //                            memory — surfaced separately so the
          //                            dashboard can render it differently)
          //   provider               — { active, available[] }
          //   profiles               — per-profile { name, hasMemory, hasUser, hasSoul }
          //   sessionCount, skillCount — quick counts so the dashboard can
          //                              render a system-wide overview
          //                              without firing 4 endpoints.
          // Loopback only.
          // ────────────────────────────────────────────────────────────────
          server.middlewares.use("/__hermes_memory", (req, res, next) => {
            if (req.method !== "GET") return next();
            if (!isLoopback(req)) {
              res.statusCode = 403;
              res.end(JSON.stringify({ error: "loopback only" }));
              return;
            }
            const hermesHome = process.env.HERMES_HOME || join(homedir(), ".hermes");

            // Memory files — read MEMORY.md/USER.md and pair with the
            // configured char limit from config.yaml (2200 default).
            function safeRead(p: string): string {
              try {
                return readFileSync(p, "utf-8");
              } catch {
                return "";
              }
            }
            function parseCharLimit(): number {
              try {
                const cfg = readFileSync(join(hermesHome, "config.yaml"), "utf-8");
                const m = cfg.match(/memory_char_limit:\s*(\d+)/);
                if (m) return Number.parseInt(m[1] ?? "2200", 10);
              } catch {
                /* default */
              }
              return 2200;
            }
            const charLimit = parseCharLimit();

            const memoryDir = join(hermesHome, "memories");
            const userContent = safeRead(join(memoryDir, "USER.md"));
            const memoryContent = safeRead(join(memoryDir, "MEMORY.md"));
            const soulContent = safeRead(join(hermesHome, "SOUL.md"));
            // Default SOUL.md ships with only a comment block; detect that
            // so the dashboard can render a "define your voice" CTA rather
            // than rendering boilerplate comments as the persona.
            const stripped = soulContent
              .replace(/<!--[\s\S]*?-->/g, "")
              .replace(/^---[\s\S]*?---/, "")
              .trim();
            const isTemplate = stripped.length === 0;

            // Provider status — shell out to `hermes memory status` for
            // the authoritative list. Best-effort; fall back to empty.
            let providerActive: string | null = null;
            const providerAvailable: Array<{ name: string; needsKey: boolean }> = [];
            try {
              const raw = execSync("hermes memory status", {
                encoding: "utf-8",
                stdio: ["ignore", "pipe", "ignore"],
                env: { ...process.env, NO_COLOR: "1" },
                timeout: 4000,
              });
              const lines = raw.split("\n");
              for (const line of lines) {
                const clean = line.trim();
                if (!clean) continue;
                // Active provider line — "Provider: name" or "(none …)"
                const provMatch = clean.match(
                  /^Provider:\s*([a-z0-9_-]+)/i,
                );
                if (provMatch) providerActive = provMatch[1] ?? null;
                // Available plugin rows — "• name  (requires API key)" etc.
                const pluginMatch = clean.match(
                  /^[•·*]\s+([a-z0-9_-]+)\s*(?:\(([^)]+)\))?/i,
                );
                if (pluginMatch) {
                  const name = pluginMatch[1] ?? "";
                  const meta = (pluginMatch[2] ?? "").toLowerCase();
                  const needsKey = /(requires|needs)\s+api\s*key/.test(meta) ||
                    /api\s+key/.test(meta);
                  if (name) providerAvailable.push({ name, needsKey });
                }
              }
            } catch {
              /* hermes binary missing — leave defaults */
            }

            // Per-profile memory — Hermes profiles live at
            // $HERMES_HOME/profiles/<name>/ and each has its own
            // memories/, SOUL.md, sessions/, etc.
            const profilesDir = join(hermesHome, "profiles");
            const profiles: Array<{
              name: string;
              hasMemory: boolean;
              hasUser: boolean;
              hasSoul: boolean;
            }> = [];
            try {
              if (existsSync(profilesDir)) {
                const entries = readdirSync(profilesDir, { withFileTypes: true }).filter(
                  (e) => e.isDirectory() && !e.name.startsWith("."),
                );
                for (const e of entries) {
                  const dir = join(profilesDir, e.name);
                  profiles.push({
                    name: e.name,
                    hasMemory: existsSync(join(dir, "memories", "MEMORY.md")),
                    hasUser: existsSync(join(dir, "memories", "USER.md")),
                    hasSoul: existsSync(join(dir, "SOUL.md")),
                  });
                }
              }
            } catch {
              /* surface empty */
            }

            // Quick counts for the readout
            let sessionCount = 0;
            try {
              const sd = join(hermesHome, "sessions");
              if (existsSync(sd)) {
                sessionCount = readdirSync(sd).filter((f) => f.endsWith(".json")).length;
              }
            } catch {
              /* ignore */
            }
            let skillCount = 0;
            try {
              const sd = join(hermesHome, "skills");
              if (existsSync(sd)) {
                skillCount = readdirSync(sd, { withFileTypes: true }).filter(
                  (e) => e.isDirectory() && !e.name.startsWith("."),
                ).length;
              }
            } catch {
              /* ignore */
            }

            res.setHeader("Content-Type", "application/json");
            res.setHeader("Cache-Control", "no-store");
            res.end(
              JSON.stringify({
                hermesHome,
                user: {
                  content: userContent,
                  charCount: userContent.length,
                  charLimit,
                  path: join(memoryDir, "USER.md"),
                },
                memory: {
                  content: memoryContent,
                  charCount: memoryContent.length,
                  charLimit,
                  path: join(memoryDir, "MEMORY.md"),
                },
                soul: {
                  content: soulContent,
                  charCount: soulContent.length,
                  isTemplate,
                  path: join(hermesHome, "SOUL.md"),
                },
                provider: { active: providerActive, available: providerAvailable },
                profiles,
                sessionCount,
                skillCount,
              }),
            );
          });

          // GET /__hermes_sessions — summary of recent sessions from
          // ~/.hermes/sessions/*.json. Returns last 20 with model,
          // message count, system prompt preview, start/end timestamps.
          // Loopback only.
          server.middlewares.use("/__hermes_sessions", (req, res, next) => {
            if (req.method !== "GET") return next();
            if (!isLoopback(req)) {
              res.statusCode = 403;
              res.end(JSON.stringify({ error: "loopback only" }));
              return;
            }
            const sessionsDir = join(homedir(), ".hermes", "sessions");
            const out: Array<{
              id: string;
              model: string | null;
              platform: string | null;
              messageCount: number;
              startedAt: string | null;
              lastUpdated: string | null;
              firstUserMessage: string | null;
            }> = [];
            try {
              if (existsSync(sessionsDir)) {
                const files = readdirSync(sessionsDir)
                  // Real Hermes session JSONs are named
                  // `session_<timestamp>_<id>.json`. The directory also
                  // contains `sessions.json` (Hermes' session-index, NOT
                  // a session) — explicitly exclude it or it shows up as
                  // a phantom "sessions" entry with all-null fields.
                  .filter(
                    (f) =>
                      f.endsWith(".json") &&
                      f !== "sessions.json" &&
                      !f.startsWith("."),
                  )
                  .map((name) => ({
                    name,
                    mtime: statSync(join(sessionsDir, name)).mtimeMs,
                  }))
                  .sort((a, b) => b.mtime - a.mtime)
                  .slice(0, 20);
                for (const f of files) {
                  try {
                    const raw = readFileSync(join(sessionsDir, f.name), "utf-8");
                    const j = JSON.parse(raw);
                    const msgs = Array.isArray(j.messages) ? j.messages : [];
                    const firstUser =
                      msgs.find((m: any) => m?.role === "user")?.content ?? null;
                    out.push({
                      id: j.session_id ?? f.name.replace(/\.json$/, ""),
                      model: j.model ?? null,
                      platform: j.platform ?? null,
                      messageCount:
                        typeof j.message_count === "number" ? j.message_count : msgs.length,
                      startedAt: j.session_start ?? null,
                      lastUpdated: j.last_updated ?? null,
                      firstUserMessage:
                        typeof firstUser === "string" ? firstUser.slice(0, 200) : null,
                    });
                  } catch {
                    /* skip unreadable session */
                  }
                }
              }
            } catch {
              /* ignore */
            }
            res.setHeader("Content-Type", "application/json");
            res.setHeader("Cache-Control", "no-store");
            res.end(JSON.stringify({ sessions: out }));
          });

          // GET /__hermes_session?id=<session_id> — full message list for one
          // session, so the dashboard can render a Telegram-style sidebar:
          // click a thread, see its history. Loopback only. Returns the
          // session_id, model, platform, and full messages array.
          server.middlewares.use("/__hermes_session", (req, res, next) => {
            if (req.method !== "GET") return next();
            if (!isLoopback(req)) {
              res.statusCode = 403;
              res.end(JSON.stringify({ error: "loopback only" }));
              return;
            }
            const url = new URL(req.url || "", "http://localhost");
            const id = url.searchParams.get("id");
            if (!id || !/^[A-Za-z0-9_-]+$/.test(id)) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: "invalid id" }));
              return;
            }
            const sessionsDir = join(homedir(), ".hermes", "sessions");
            // Hermes session files include a timestamp prefix, so we search
            // by suffix match. Bounded scan because we only ship 20 recent
            // anyway, and the directory is the user's own.
            let match: string | null = null;
            try {
              const files = readdirSync(sessionsDir).filter((f) => f.endsWith(".json"));
              for (const f of files) {
                if (f.includes(id) || f.startsWith(id) || f.replace(/\.json$/, "") === id) {
                  match = f;
                  break;
                }
              }
            } catch {
              /* ignore */
            }
            if (!match) {
              res.statusCode = 404;
              res.end(JSON.stringify({ error: "not found" }));
              return;
            }
            try {
              const raw = readFileSync(join(sessionsDir, match), "utf-8");
              const j = JSON.parse(raw);
              const msgs = Array.isArray(j.messages) ? j.messages : [];
              // Surface only what the UI needs — drop system prompts and
              // raw tool blobs from the response payload.
              const clean = msgs.map((m: any) => ({
                role: m?.role ?? "unknown",
                content:
                  typeof m?.content === "string"
                    ? m.content
                    : Array.isArray(m?.content)
                      ? m.content
                          .map((c: any) =>
                            typeof c === "string" ? c : c?.text ?? c?.content ?? "",
                          )
                          .join("\n")
                      : "",
                ts: m?.timestamp ?? null,
              }));
              res.setHeader("Content-Type", "application/json");
              res.setHeader("Cache-Control", "no-store");
              res.end(
                JSON.stringify({
                  sessionId: j.session_id ?? id,
                  model: j.model ?? null,
                  platform: j.platform ?? null,
                  startedAt: j.session_start ?? null,
                  lastUpdated: j.last_updated ?? null,
                  messages: clean,
                }),
              );
            } catch (err: any) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: err?.message ?? "read failed" }));
            }
          });

          // GET /__just-installed — true the first time after `bun run setup`,
          // false thereafter. Setup writes ~/.claude-os/show-wizard; this
          // endpoint reads + deletes it so the dashboard force-opens the
          // wizard once even if the browser has stale claude-os-config from
          // a prior install.
          // ─── /__dream · daily Dream brief reader ─────────────────────────
          // GET /__dream?date=YYYY-MM-DD returns ~/.claude-os/dreams/dream-<date>.json
          // (or null if missing). Loopback only.
          server.middlewares.use("/__dream", async (req, res, next) => {
            if (req.method !== "GET") return next();
            if (!isLoopback(req)) { res.statusCode = 403; res.end(JSON.stringify({ error: "loopback only" })); return; }
            try {
              const url = new URL(req.url ?? "/", "http://x");
              const date = url.searchParams.get("date") ?? new Date().toISOString().slice(0, 10);
              const path = join(homedir(), ".claude-os", "dreams", `dream-${date}.json`);
              res.setHeader("Content-Type", "application/json");
              if (!existsSync(path)) { res.end("null"); return; }
              res.end(readFileSync(path, "utf8"));
            } catch (e: any) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: e?.message ?? String(e) }));
            }
          });

          // ─── Hermes Media Studio (MiniMax + Grok) — graceful stubs ─────
          // The pack 6 HermesStudio component drives image/video/voice
          // generation via hermes studio CLI. Until creds are wired we
          // return honest "needs setup" states; once the hermes CLI is
          // installed + authed (hermes auth add minimax-oauth) these
          // become real endpoints.
          server.middlewares.use("/__hermes_studio_list", async (_req, res) => {
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ items: { image: [], video: [], voice: [] }, connected: { minimax: false, grok: false }, note: "Run `hermes studio list` once authed to populate." }));
          });
          server.middlewares.use("/__hermes_studio_generate", async (_req, res) => {
            res.statusCode = 503;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "Studio generation needs a connected provider. Run: hermes auth add minimax-oauth   (or set GROK_API_KEY)" }));
          });
          server.middlewares.use("/__hermes_studio_video_status", async (_req, res) => {
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ status: "unknown", note: "Provider not connected." }));
          });

          // ─── HyperFrames Video Studio endpoints ─────────────────────────
          // The component pings 4 hyperframes endpoints + 4 heygen + 1 workspace.
          // We back them with src/lib/video-projects.ts (lifted from pack 6) +
          // graceful "needs setup" responses for the providers we haven't wired.
          server.middlewares.use("/__hyperframes_projects", async (req, res, next) => {
            if (!isLoopback(req)) { res.statusCode = 403; res.end("forbidden"); return; }
            if (req.method !== "GET") return next();
            try {
              const mod = await import("./src/lib/video-projects");
              const projects = await mod.listProjects();
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ count: projects.length, projects }));
            } catch (e: any) {
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ count: 0, projects: [], error: e?.message ?? String(e) }));
            }
          });
          server.middlewares.use("/__hyperframes_init", async (req, res, next) => {
            if (!isLoopback(req)) { res.statusCode = 403; res.end("forbidden"); return; }
            if (req.method !== "POST") return next();
            let body = "";
            for await (const chunk of req) body += chunk.toString();
            try {
              const mod = await import("./src/lib/video-projects");
              const { prompt, slug } = JSON.parse(body || "{}");
              if (!prompt || typeof prompt !== "string") {
                res.statusCode = 400; res.end(JSON.stringify({ error: "missing prompt" })); return;
              }
              const project = await mod.createProject(String(prompt), slug ? String(slug) : undefined);
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify(project));
            } catch (e: any) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: e?.message ?? String(e) }));
            }
          });
          server.middlewares.use("/__hyperframes_render_status", async (req, res, next) => {
            if (!isLoopback(req)) { res.statusCode = 403; res.end("forbidden"); return; }
            if (req.method !== "GET") return next();
            try {
              const url = new URL(req.url ?? "/", "http://x");
              const id = url.searchParams.get("id");
              const mod = await import("./src/lib/video-projects");
              if (id) {
                const job = await mod.getRenderJob(id);
                if (!job) { res.statusCode = 404; res.end(JSON.stringify({ error: "not found" })); return; }
                const log = await mod.readRenderLog(id);
                let outputUrl: string | undefined;
                if (job.status === "completed" && existsSync(job.outputPath)) {
                  outputUrl = `/__video_preview?slug=${encodeURIComponent(job.projectSlug)}&file=${encodeURIComponent(job.outputPath.split("/").pop()!)}`;
                }
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ job, log, outputUrl }));
                return;
              }
              const jobs = await mod.listRenderJobs();
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ count: jobs.length, jobs }));
            } catch (e: any) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: e?.message ?? String(e) }));
            }
          });
          server.middlewares.use("/__hyperframes_render", async (req, res, next) => {
            if (!isLoopback(req)) { res.statusCode = 403; res.end("forbidden"); return; }
            if (req.method !== "POST") return next();
            let body = "";
            for await (const chunk of req) body += chunk.toString();
            try {
              const { slug } = JSON.parse(body || "{}");
              if (!slug || !/^[A-Za-z0-9_.-]+$/.test(String(slug))) {
                res.statusCode = 400; res.end(JSON.stringify({ error: "invalid slug" })); return;
              }
              const mod = await import("./src/lib/video-projects");
              // Resolve hyperframes binary
              const cp = await import("node:child_process");
              const which = await new Promise<string>((r) => {
                cp.exec("which hyperframes", (err, stdout) => r(err ? "" : stdout.trim()));
              });
              if (!which) {
                res.statusCode = 503;
                res.end(JSON.stringify({ error: "hyperframes CLI not found on PATH. Install: npm i -g hyperframes" }));
                return;
              }
              const cwd = join(homedir(), ".agentic-os", "video-projects", String(slug));
              if (!existsSync(cwd)) {
                res.statusCode = 404; res.end(JSON.stringify({ error: "project not found" })); return;
              }
              const outputPath = mod.nextRenderOutputPath(cwd);
              const job = await mod.createRenderJob(String(slug), cwd, outputPath);
              // Spawn hyperframes render in background, stream log to job.logFile
              try {
                mkdirSync(join(homedir(), ".agentic-os", "video-render-logs"), { recursive: true });
                const out = openSync(job.logFile, "a");
                const child = cp.spawn(which, ["render", "--output", outputPath], {
                  cwd, detached: true,
                  stdio: ["ignore", out, out],
                  env: { ...process.env },
                });
                await mod.updateRenderJob(job.id, { status: "rendering", pid: child.pid, startedAt: Date.now() });
                child.on("exit", async (code) => {
                  await mod.updateRenderJob(job.id, {
                    status: code === 0 ? "completed" : "failed",
                    exitCode: code,
                    finishedAt: Date.now(),
                  });
                });
                child.unref();
              } catch (e: any) {
                await mod.updateRenderJob(job.id, { status: "failed", exitCode: -1, finishedAt: Date.now() });
                res.statusCode = 500;
                res.end(JSON.stringify({ ...job, error: e?.message ?? String(e) }));
                return;
              }
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify(job));
            } catch (e: any) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: e?.message ?? String(e) }));
            }
          });

          // Heygen + workspace stubs — graceful "needs setup" so the UI renders
          // honestly until credentials/integration are wired.
          server.middlewares.use("/__heygen_avatars", async (_req, res) => {
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ avatars: [], note: "HeyGen integration not configured. Set HEYGEN_API_KEY in ~/.claude-os/config.json." }));
          });
          server.middlewares.use("/__heygen_voices", async (_req, res) => {
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ voices: [], note: "HeyGen integration not configured." }));
          });
          server.middlewares.use("/__heygen_generate", async (_req, res) => {
            res.statusCode = 503;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "HeyGen integration not configured. Set HEYGEN_API_KEY." }));
          });
          server.middlewares.use("/__heygen_status", async (_req, res) => {
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ status: "unknown", note: "HeyGen integration not configured." }));
          });
          server.middlewares.use("/__video_workspace", async (req, res) => {
            // Aggregate every Video Studio render + Higgsfield + Hermes media folder
            try {
              const { readdir, stat: statP } = await import("node:fs/promises");
              const { homedir } = await import("node:os");
              const { join: joinP } = await import("node:path");
              const url = new URL(req.url ?? "/", "http://x");
              const bucket = url.searchParams.get("bucket");
              const buckets = [
                { id: "video-studio", label: "Video Studio renders", root: joinP(homedir(), ".agentic-os", "video-projects") },
                { id: "hermes-media",  label: "~/Documents/Hermes",   root: joinP(homedir(), "Documents", "Hermes") },
              ];
              if (!bucket) {
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ buckets: buckets.map(b => ({ id: b.id, label: b.label })) }));
                return;
              }
              const target = buckets.find(b => b.id === bucket);
              if (!target || !existsSync(target.root)) {
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ items: [] }));
                return;
              }
              // Shallow scan
              const items: any[] = [];
              for (const entry of (await readdir(target.root, { withFileTypes: true }).catch(() => []))) {
                if (entry.isFile() && !entry.name.startsWith(".")) {
                  try {
                    const p = joinP(target.root, entry.name);
                    const st = await statP(p);
                    items.push({ name: entry.name, size: st.size, mtime: st.mtimeMs });
                  } catch { /* skip */ }
                }
              }
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ items, root: target.root }));
            } catch (e: any) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: e?.message ?? String(e) }));
            }
          });

          // ─── /__video_workspace_upload · ingest into the shared asset library ─
          // POST JSON { name, base64, kind? } → writes the file into the
          // Universal Asset Library root (~/.agentic-os/video-projects/, the
          // same folder /__video_workspace scans and Asset Library reads), and
          // records a lineage/proof record under .lineage/. Loopback only,
          // extension-allowlisted, 64MB cap, path-contained. No fake uploads.
          server.middlewares.use("/__video_workspace_upload", async (req, res, next) => {
            if (req.method !== "POST") return next();
            if (!isLoopback(req)) { res.statusCode = 403; res.end(JSON.stringify({ error: "loopback only" })); return; }
            const { writeFile, mkdir } = await import("node:fs/promises");
            const { homedir } = await import("node:os");
            const { join: joinP, extname, basename } = await import("node:path");
            const ALLOWED = new Set(["png","jpg","jpeg","webp","gif","svg","mp4","webm","mov","mp3","wav","ogg","m4a","pdf","txt","md","markdown","json","csv"]);
            const MAX = 64 * 1024 * 1024;
            let body = "";
            let aborted = false;
            req.on("data", (c) => { body += c; if (body.length > MAX * 1.4) { aborted = true; req.destroy(); } });
            req.on("end", async () => {
              if (aborted) { res.statusCode = 413; res.end(JSON.stringify({ error: "too large (64MB max)" })); return; }
              try {
                const parsed = JSON.parse(body || "{}") as { name?: string; base64?: string; kind?: string };
                const rawName = basename(String(parsed.name ?? "")).replace(/[^A-Za-z0-9._-]/g, "_");
                const ext = extname(rawName).slice(1).toLowerCase();
                if (!rawName || !ALLOWED.has(ext)) { res.statusCode = 415; res.end(JSON.stringify({ error: `unsupported or missing file type: .${ext}` })); return; }
                const b64 = String(parsed.base64 ?? "").replace(/^data:[^;]+;base64,/, "");
                if (!b64) { res.statusCode = 400; res.end(JSON.stringify({ error: "no file data" })); return; }
                const buf = Buffer.from(b64, "base64");
                if (buf.length > MAX) { res.statusCode = 413; res.end(JSON.stringify({ error: "too large (64MB max)" })); return; }
                const root = process.env.BASELINE_ASSET_ROOT || joinP(homedir(), ".agentic-os", "video-projects");
                await mkdir(root, { recursive: true });
                await mkdir(joinP(root, ".lineage"), { recursive: true });
                // de-dupe name collisions with a short prefix
                const stamped = `${Date.now().toString(36)}-${rawName}`;
                const dest = joinP(root, stamped);
                await writeFile(dest, buf);
                const kind = /png|jpe?g|webp|gif|svg/.test(ext) ? "image" : /mp4|webm|mov/.test(ext) ? "video" : /mp3|wav|ogg|m4a/.test(ext) ? "audio" : "document";
                const lineage = { name: stamped, original: rawName, kind, ext, size: buf.length, source: "upload", uploadedAt: new Date().toISOString(), library: "universal-asset" };
                await writeFile(joinP(root, ".lineage", `${stamped}.json`), JSON.stringify(lineage, null, 2));
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ ok: true, asset: { name: stamped, size: buf.length, kind, path: dest, mtime: Date.now(), lineage } }));
              } catch (e) {
                res.statusCode = 500;
                res.end(JSON.stringify({ error: (e as Error)?.message ?? String(e) }));
              }
            });
          });

          // ─── /__video_workspace_raw · stream an asset for inline preview ─────
          // GET ?path=<abs> → streams bytes with the right content-type + Range
          // support so <video>/<audio>/<img>/<iframe> previews work in-canvas.
          // Home-contained only.
          server.middlewares.use("/__video_workspace_raw", async (req, res, next) => {
            if (req.method !== "GET") return next();
            const { homedir } = await import("node:os");
            const nodePath = await import("node:path");
            const { statSync } = await import("node:fs");
            const url = new URL(req.url ?? "/", "http://x");
            const resolved = nodePath.resolve(url.searchParams.get("path") ?? "");
            if (!resolved.startsWith(homedir()) || !existsSync(resolved)) { res.statusCode = 404; res.end("not found"); return; }
            const ext = nodePath.extname(resolved).slice(1).toLowerCase();
            const MIME: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif", svg: "image/svg+xml", mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime", mp3: "audio/mpeg", wav: "audio/wav", ogg: "audio/ogg", m4a: "audio/mp4", pdf: "application/pdf" };
            const mime = MIME[ext] ?? "application/octet-stream";
            const size = statSync(resolved).size;
            const range = req.headers.range;
            res.setHeader("Content-Type", mime);
            res.setHeader("Accept-Ranges", "bytes");
            if (range) {
              const m = /bytes=(\d+)-(\d*)/.exec(range);
              const start = m ? parseInt(m[1], 10) : 0;
              const end = m && m[2] ? parseInt(m[2], 10) : size - 1;
              res.statusCode = 206;
              res.setHeader("Content-Range", `bytes ${start}-${end}/${size}`);
              res.setHeader("Content-Length", String(end - start + 1));
              createReadStream(resolved, { start, end }).pipe(res);
            } else {
              res.setHeader("Content-Length", String(size));
              createReadStream(resolved).pipe(res);
            }
          });

          // ─── /__graphify · Structural Brain Layer (codebase knowledge graph) ─
          // GET  → cached graph + health (builds + caches graphify-out/graph.json
          //        on first call or when ?refresh=1). ?q=<question> → ranked nodes.
          // Repeatable + cacheable: the graph is cached in-memory + on disk; a
          // query never triggers a full rebuild. Secrets/node_modules excluded.
          server.middlewares.use("/__graphify", async (req, res, next) => {
            if (req.method !== "GET" && req.method !== "POST") return next();
            if (!isLoopback(req)) { res.statusCode = 403; res.end(JSON.stringify({ error: "loopback only" })); return; }
            const { readdir, readFile, mkdir, writeFile, stat } = await import("node:fs/promises");
            const { join: J } = await import("node:path");
            const url = new URL(req.url ?? "/", "http://x");
            const ROOT = process.cwd();
            const OUT = J(ROOT, "graphify-out");
            const GRAPH_FILE = J(OUT, "graph.json");
            const EXCLUDE = ["node_modules", ".git", "dist", "build", ".next", "coverage", "graphify-out", ".cache", "logs"];
            const isSecret = (p: string) => /\.env(\.|$)|\.key$|\.pem$|secret|credential|token/i.test(p);
            const classify = (p: string): string =>
              /\/api\/|route\.tsx?$/.test(p) ? "api" : /\/routes?\//.test(p) || /\/app\/.*\/page\.tsx?$/.test(p) ? "route"
              : /\/components?\//.test(p) ? "component" : /workflow/i.test(p) ? "workflow" : /skill/i.test(p) ? "skill"
              : /agent/i.test(p) ? "agent" : /\/lib\//.test(p) ? "lib" : "file";

            async function scan(dir: string, acc: string[] = []): Promise<string[]> {
              let entries: import("node:fs").Dirent[] = [];
              try { entries = await readdir(dir, { withFileTypes: true }); } catch { return acc; }
              for (const e of entries) {
                if (EXCLUDE.includes(e.name) || e.name.startsWith(".")) continue;
                const full = J(dir, e.name);
                if (e.isDirectory()) await scan(full, acc);
                else if (/\.(ts|tsx|js|jsx)$/.test(e.name) && !isSecret(full)) acc.push(full);
              }
              return acc;
            }

            async function build() {
              const srcDir = J(ROOT, "src");
              const files = await scan(srcDir);
              const rel = (p: string) => p.slice(ROOT.length + 1);
              const ids = new Set(files.map(rel));
              const nodes = files.map((p) => ({ id: rel(p), label: p.split("/").pop(), kind: classify(rel(p)), path: rel(p) }));
              const edges: { from: string; to: string; kind: string }[] = [];
              let mtimeSum = 0;
              for (const p of files) {
                try {
                  const st = await stat(p); mtimeSum += Math.floor(st.mtimeMs);
                  const txt = await readFile(p, "utf8");
                  const fromDir = rel(p).split("/").slice(0, -1).join("/");
                  for (const m of txt.matchAll(/import[^'"]*['"]([^'"]+)['"]/g)) {
                    const spec = m[1];
                    let target: string | null = null;
                    if (spec.startsWith("@/")) target = "src/" + spec.slice(2);
                    else if (spec.startsWith(".")) {
                      const parts = (fromDir + "/" + spec).split("/"); const out: string[] = [];
                      for (const seg of parts) { if (seg === "." || seg === "") continue; if (seg === "..") out.pop(); else out.push(seg); }
                      target = out.join("/");
                    }
                    if (!target) continue;
                    const cand = [target, target + ".ts", target + ".tsx", target + "/index.ts", target + "/index.tsx"];
                    const hit = cand.find((c) => ids.has(c));
                    if (hit && hit !== rel(p)) edges.push({ from: rel(p), to: hit, kind: "imports" });
                  }
                } catch { /* skip */ }
              }
              const graph = { nodes, edges, generatedAt: Date.now(), repoHash: `${files.length}:${mtimeSum}` };
              try { await mkdir(OUT, { recursive: true }); await writeFile(GRAPH_FILE, JSON.stringify(graph)); } catch { /* non-fatal */ }
              return graph;
            }

            let graph: { nodes: { id: string; kind: string; path: string }[]; edges: { from: string; to: string }[]; generatedAt: number; repoHash: string } | null = null;
            const refresh = url.searchParams.get("refresh") === "1" || req.method === "POST";
            if (!refresh) {
              try { graph = JSON.parse(await readFile(GRAPH_FILE, "utf8")); } catch { /* none yet */ }
            }
            if (!graph) graph = await build();

            res.setHeader("Content-Type", "application/json");
            res.setHeader("Cache-Control", "no-store");
            const q = url.searchParams.get("q");
            if (q) {
              const terms = q.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 2);
              const ranked = graph.nodes
                .map((n) => ({ n, score: terms.reduce((s, t) => s + (n.path.toLowerCase().includes(t) ? 2 : 0), 0) }))
                .filter((x) => x.score > 0).sort((a, b) => b.score - a.score).slice(0, 12).map((x) => x.n);
              res.end(JSON.stringify({ query: q, results: ranked, total: graph.nodes.length }));
              return;
            }
            const deg = new Map<string, number>();
            for (const e of graph.edges) deg.set(e.to, (deg.get(e.to) ?? 0) + 1);
            const god = [...deg.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([id, inDegree]) => ({ id, inDegree }));
            res.end(JSON.stringify({ graph, health: { nodes: graph.nodes.length, edges: graph.edges.length, generatedAt: graph.generatedAt, repoHash: graph.repoHash, godNodes: god } }));
          });

          // ─── /__graphify_clone · remote-repo runner ──────────────────────
          // POST { url } → clone a public repo (https-only, host-allowlisted) to a
          // sandboxed temp dir with --depth 1, build its knowledge graph, return
          // graph + health, then delete the clone. Secrets/heavy dirs excluded.
          // No arbitrary shell: git invoked via execFile (argv, no shell), timeout-capped.
          server.middlewares.use("/__graphify_clone", async (req, res, next) => {
            if (req.method !== "POST") return next();
            if (!isLoopback(req)) { res.statusCode = 403; res.end(JSON.stringify({ error: "loopback only" })); return; }
            const send = (code: number, body: unknown) => { res.statusCode = code; res.setHeader("Content-Type", "application/json"); res.setHeader("Cache-Control", "no-store"); res.end(JSON.stringify(body)); };
            let raw = ""; req.on("data", (c: Buffer) => (raw += c.toString()));
            await new Promise<void>((r) => req.on("end", () => r()));
            let repoUrl = "";
            try { repoUrl = String((JSON.parse(raw || "{}") as { url?: string }).url ?? "").trim(); } catch { return send(400, { error: "invalid JSON" }); }
            // Validate: https only, known git hosts, no shell metacharacters.
            let parsed: URL;
            try { parsed = new URL(repoUrl); } catch { return send(400, { error: "invalid url" }); }
            const ALLOWED_HOSTS = ["github.com", "gitlab.com", "bitbucket.org"];
            if (parsed.protocol !== "https:" || !ALLOWED_HOSTS.includes(parsed.hostname)) {
              return send(400, { error: "https only, host must be github.com / gitlab.com / bitbucket.org" });
            }
            if (/[;&|`$(){}<>\s]/.test(repoUrl)) return send(400, { error: "illegal characters in url" });

            const { mkdtemp, rm, readdir, readFile, stat } = await import("node:fs/promises");
            const { join: J } = await import("node:path");
            const { tmpdir } = await import("node:os");
            const { execFile } = await import("node:child_process");
            const { promisify } = await import("node:util");
            const efp = promisify(execFile);

            const EXCLUDE = ["node_modules", ".git", "dist", "build", ".next", "coverage", "graphify-out", ".cache", "logs", "vendor", "venv", "__pycache__"];
            const isSecret = (p: string) => /\.env(\.|$)|\.key$|\.pem$|secret|credential|token/i.test(p);
            const classify = (p: string): string =>
              /\/api\/|route\.tsx?$/.test(p) ? "api" : /\/routes?\//.test(p) || /\/app\/.*\/page\.tsx?$/.test(p) ? "route"
              : /\/components?\//.test(p) ? "component" : /workflow/i.test(p) ? "workflow" : /skill/i.test(p) ? "skill"
              : /agent/i.test(p) ? "agent" : /\/lib\//.test(p) ? "lib" : "file";

            let dir = "";
            try {
              dir = await mkdtemp(J(tmpdir(), "graphify-clone-"));
              // Shallow, blobless, no checkout of submodules; hard timeout.
              await efp("git", ["clone", "--depth", "1", "--single-branch", "--no-tags", repoUrl, dir], { timeout: 60_000, maxBuffer: 8 * 1024 * 1024 });

              const MAX_FILES = 4000;
              async function scan(d: string, acc: string[] = []): Promise<string[]> {
                if (acc.length > MAX_FILES) return acc;
                let entries: import("node:fs").Dirent[] = [];
                try { entries = await readdir(d, { withFileTypes: true }); } catch { return acc; }
                for (const e of entries) {
                  if (EXCLUDE.includes(e.name) || e.name.startsWith(".")) continue;
                  const full = J(d, e.name);
                  if (e.isDirectory()) await scan(full, acc);
                  else if (/\.(ts|tsx|js|jsx|py|go|rs|java|rb)$/.test(e.name) && !isSecret(full)) acc.push(full);
                  if (acc.length > MAX_FILES) break;
                }
                return acc;
              }
              const files = await scan(dir);
              const rel = (p: string) => p.slice(dir.length + 1);
              const ids = new Set(files.map(rel));
              const nodes = files.map((p) => ({ id: rel(p), label: p.split("/").pop(), kind: classify(rel(p)), path: rel(p) }));
              const edges: { from: string; to: string; kind: string }[] = [];
              let mtimeSum = 0;
              for (const p of files) {
                try {
                  const st = await stat(p); mtimeSum += Math.floor(st.mtimeMs);
                  const txt = await readFile(p, "utf8");
                  const fromDir = rel(p).split("/").slice(0, -1).join("/");
                  for (const m of txt.matchAll(/(?:import|from|require)[^'"]*['"]([^'"]+)['"]/g)) {
                    const spec = m[1]; let target: string | null = null;
                    if (spec.startsWith("@/")) target = "src/" + spec.slice(2);
                    else if (spec.startsWith(".")) {
                      const parts = (fromDir + "/" + spec).split("/"); const out: string[] = [];
                      for (const seg of parts) { if (seg === "." || seg === "") continue; if (seg === "..") out.pop(); else out.push(seg); }
                      target = out.join("/");
                    }
                    if (!target) continue;
                    const cand = [target, target + ".ts", target + ".tsx", target + ".js", target + "/index.ts", target + "/index.tsx"];
                    const hit = cand.find((c) => ids.has(c));
                    if (hit && hit !== rel(p)) edges.push({ from: rel(p), to: hit, kind: "imports" });
                  }
                } catch { /* skip */ }
              }
              const deg = new Map<string, number>();
              for (const e of edges) deg.set(e.to, (deg.get(e.to) ?? 0) + 1);
              const god = [...deg.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([id, inDegree]) => ({ id, inDegree }));
              const graph = { nodes, edges, generatedAt: Date.now(), repoHash: `${files.length}:${mtimeSum}`, source: repoUrl };
              send(200, { graph, health: { nodes: nodes.length, edges: edges.length, generatedAt: graph.generatedAt, repoHash: graph.repoHash, godNodes: god, source: repoUrl } });
            } catch (e) {
              send(502, { error: `clone/build failed: ${(e as Error).message}` });
            } finally {
              if (dir) await rm(dir, { recursive: true, force: true }).catch(() => {});
            }
          });

          // ─── /__agent_activity · real activity feed for the Agent Activity Visualizer ─
          // Reads the genuine tool-execution ledger (~/.claude-os/tool-executions.jsonl)
          // so every agent page can PROVE what's happening — never fabricated.
          // Returns recent events (verb/tool/duration/approval/proof) + a derived
          // status. Empty ledger → honest idle. Loopback only.
          server.middlewares.use("/__agent_activity", async (req, res, next) => {
            if (req.method !== "GET") return next();
            if (!isLoopback(req)) { res.statusCode = 403; res.end(JSON.stringify({ error: "loopback only" })); return; }
            const { homedir } = await import("node:os");
            const { join: joinP } = await import("node:path");
            const url = new URL(req.url ?? "/", "http://x");
            const limit = Math.min(40, Number(url.searchParams.get("limit")) || 20);
            const ledger = joinP(homedir(), ".claude-os", "tool-executions.jsonl");
            const events: unknown[] = [];
            try {
              if (existsSync(ledger)) {
                const lines = readFileSync(ledger, "utf8").trim().split("\n").filter(Boolean);
                for (const line of lines.slice(-limit).reverse()) {
                  try {
                    const e = JSON.parse(line) as Record<string, unknown>;
                    events.push({
                      tool: e.tool_id ?? "tool",
                      verb: e.verb ?? "",
                      argv: e.argv_redacted ?? "",
                      ok: e.ok ?? null,
                      approved: e.approved ?? null,
                      refused: e.refused_reason ?? null,
                      proof: e.proof ?? null,
                      durationMs: e.duration_ms ?? null,
                      startedAt: e.started_at ?? null,
                    });
                  } catch { /* skip bad line */ }
                }
              }
            } catch { /* honest empty */ }
            res.setHeader("Content-Type", "application/json");
            res.setHeader("Cache-Control", "no-store");
            res.end(JSON.stringify({
              agent: url.searchParams.get("agent") ?? null,
              source: "tool-executions.jsonl",
              hasActivity: events.length > 0,
              status: events.length > 0 ? "completed" : "idle",
              events,
            }));
          });

          // ─── /__claude_ant · Claude Platform CLI cockpit ────────────────
          // GET → connection status, verifies it's the *real* ant (not Apache Ant)
          // POST { cmd } → run a read-oriented `ant` subcommand, returns stdout/stderr
          // Output forced to --output json where the subcommand supports it.
          server.middlewares.use("/__claude_ant", async (req, res, next) => {
            if (!isLoopback(req)) { res.statusCode = 403; res.end(JSON.stringify({ error: "loopback only" })); return; }
            const { execFile } = await import("node:child_process");
            const { promisify } = await import("node:util");
            const efp = promisify(execFile);
            const bin = process.env.AGENTIC_OS_ANT_BIN ?? "ant";
            const method = (req.method ?? "GET").toUpperCase();
            res.setHeader("Content-Type", "application/json");
            res.setHeader("Cache-Control", "no-store");
            if (method === "GET") {
              try {
                const v = await efp(bin, ["--version"], { timeout: 6000 });
                const txt = (v.stdout + " " + v.stderr).toLowerCase();
                const isApacheAnt = /apache ant/.test(txt);
                const looksClaude = /anthropic|claude|platform/.test(txt) || (!isApacheAnt && !!v.stdout);
                res.end(JSON.stringify({
                  connected: looksClaude && !isApacheAnt,
                  wrongAnt: isApacheAnt,
                  version: (v.stdout || v.stderr || "").trim(),
                  bin,
                }));
              } catch (e: any) {
                res.end(JSON.stringify({ connected: false, reason: "not-installed", error: e?.message ?? String(e), bin }));
              }
              return;
            }
            if (method === "POST") {
              let body = "";
              for await (const chunk of req) body += chunk.toString();
              try {
                const { cmd } = JSON.parse(body) as { cmd?: string };
                if (!cmd || typeof cmd !== "string") {
                  res.statusCode = 400; res.end(JSON.stringify({ ok: false, cmd: "", stdout: "", stderr: "missing cmd" }));
                  return;
                }
                // Force JSON output for subcommands that support it; ant's default
                // "explore" output is a TUI that hangs headlessly.
                const args = cmd.split(/\s+/).filter(Boolean);
                if (!args.includes("--output") && !args.includes("-o")) args.push("--output", "json");
                try {
                  const r = await efp(bin, args, { timeout: 30_000, maxBuffer: 4 * 1024 * 1024 });
                  let parsed: unknown = undefined;
                  try { parsed = JSON.parse(r.stdout); } catch { /* not JSON */ }
                  res.end(JSON.stringify({ ok: true, cmd, stdout: r.stdout, stderr: r.stderr, parsed }));
                } catch (e: any) {
                  res.end(JSON.stringify({ ok: false, cmd, stdout: e?.stdout ?? "", stderr: e?.stderr ?? e?.message ?? String(e) }));
                }
              } catch (e: any) {
                res.statusCode = 500;
                res.end(JSON.stringify({ ok: false, cmd: "", stdout: "", stderr: e?.message ?? String(e) }));
              }
              return;
            }
            return next();
          });

          // ─── /__hermes_dashboard · Hermes Manage tab lifecycle ──────────
          // GET → status { running, url }
          // POST → ensure-running (spawns `hermes dashboard --tui --no-open --port 9119`)
          // Embeds the real FastAPI Hermes dashboard (model/provider/keys/
          // sessions/cron/skills/MCP/channels/logs/analytics).
          const HERMES_DASH_URL = "http://127.0.0.1:9119";
          async function hermesDashUp(): Promise<boolean> {
            try {
              const r = await fetch(`${HERMES_DASH_URL}/api/status`, {
                cache: "no-store" as any,
                signal: AbortSignal.timeout(2500),
              });
              return r.ok;
            } catch { return false; }
          }
          server.middlewares.use("/__hermes_dashboard", async (req, res, next) => {
            if (!isLoopback(req)) { res.statusCode = 403; res.end(JSON.stringify({ error: "loopback only" })); return; }
            const method = (req.method ?? "GET").toUpperCase();
            res.setHeader("Content-Type", "application/json");
            res.setHeader("Cache-Control", "no-store");
            if (method === "GET") {
              res.end(JSON.stringify({ running: await hermesDashUp(), url: HERMES_DASH_URL }));
              return;
            }
            if (method === "POST") {
              if (await hermesDashUp()) {
                res.end(JSON.stringify({ running: true, url: HERMES_DASH_URL, started: false }));
                return;
              }
              try {
                const child = spawn("hermes", ["dashboard", "--tui", "--no-open", "--port", "9119"], {
                  detached: true, stdio: "ignore", env: { ...process.env },
                });
                child.unref();
              } catch (e) {
                res.statusCode = 500;
                res.end(JSON.stringify({ running: false, url: HERMES_DASH_URL, error: String(e) }));
                return;
              }
              for (let i = 0; i < 30; i++) {
                await new Promise((r) => setTimeout(r, 1000));
                if (await hermesDashUp()) {
                  res.end(JSON.stringify({ running: true, url: HERMES_DASH_URL, started: true }));
                  return;
                }
              }
              res.end(JSON.stringify({
                running: false,
                url: HERMES_DASH_URL,
                started: true,
                warn: "Dashboard is still starting (first launch builds the UI). Try Refresh in a few seconds. Requires `hermes` CLI on PATH.",
              }));
              return;
            }
            return next();
          });

          // ─── /__voice_speak · ElevenLabs TTS proxy ──────────────────────
          // POST { text, voiceId } → audio/mpeg stream.
          // The ElevenLabs API key lives ONLY here (read from
          // ~/.claude-os/config.json or ELEVENLABS_API_KEY env). The browser
          // never sees it.
          // ─── /__slim_phone_status · honest phone-provider probe ─────────
          // Reports which telephony provider (if any) is configured from env.
          // Never fakes a number; returns { configured:false } until real keys
          // + SLIM_PHONE_NUMBER exist. Loopback + Baseline-OS only.
          server.middlewares.use("/__slim_phone_status", (req, res, next) => {
            if (req.method !== "GET") return next();
            if (!isLoopback(req)) { res.statusCode = 403; res.end(JSON.stringify({ error: "loopback only" })); return; }
            const number = process.env.SLIM_PHONE_NUMBER || null;
            const providers: Array<[string, string[]]> = [
              ["twilio", ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN"]],
              ["elevenlabs", ["ELEVENLABS_API_KEY", "ELEVENLABS_AGENT_ID"]],
              ["retell", ["RETELL_API_KEY"]],
              ["vapi", ["VAPI_API_KEY"]],
            ];
            const found = providers.find(([, keys]) => keys.every((k) => !!process.env[k]));
            const configured = !!found && !!number;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ configured, provider: found?.[0] ?? null, number: configured ? number : null }));
          });

          server.middlewares.use("/__voice_speak", async (req, res, next) => {
            if (req.method !== "POST") return next();
            if (!isLoopback(req)) { res.statusCode = 403; res.end(JSON.stringify({ error: "loopback only" })); return; }
            try {
              const cfgPath = join(homedir(), ".claude-os", "config.json");
              let apiKey = process.env.ELEVENLABS_API_KEY ?? "";
              if (!apiKey && existsSync(cfgPath)) {
                try {
                  const cfg = JSON.parse(readFileSync(cfgPath, "utf8"));
                  apiKey = cfg.voice?.elevenlabs_api_key ?? cfg.ELEVENLABS_API_KEY ?? cfg.elevenlabs_api_key ?? "";
                } catch { /* skip */ }
              }
              const body = await new Promise<string>((resolve) => {
                let buf = ""; req.on("data", (c) => { buf += c; }); req.on("end", () => resolve(buf));
              });
              const { text, voiceId } = JSON.parse(body || "{}") as { text?: string; voiceId?: string };
              if (!text || !voiceId) { res.statusCode = 400; res.end(JSON.stringify({ error: "text + voiceId required" })); return; }
              if (!apiKey) { res.statusCode = 503; res.end(JSON.stringify({ error: "ELEVENLABS_API_KEY not set in ~/.claude-os/config.json (under voice.elevenlabs_api_key) or env" })); return; }
              const upstream = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`, {
                method: "POST",
                headers: {
                  "xi-api-key": apiKey,
                  "Content-Type": "application/json",
                  "Accept": "audio/mpeg",
                },
                body: JSON.stringify({
                  text: text.slice(0, 2500),
                  model_id: "eleven_turbo_v2_5",
                  voice_settings: { stability: 0.45, similarity_boost: 0.75, style: 0.0, use_speaker_boost: true },
                }),
              });
              if (!upstream.ok) {
                const errBody = await upstream.text().catch(() => "");
                res.statusCode = upstream.status;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ error: `ElevenLabs ${upstream.status}: ${errBody.slice(0,200)}` }));
                return;
              }
              res.setHeader("Content-Type", "audio/mpeg");
              res.setHeader("Cache-Control", "no-store");
              const buf = Buffer.from(await upstream.arrayBuffer());
              res.end(buf);
            } catch (e: any) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: e?.message ?? String(e) }));
            }
          });

          // ─── /__voice_voices · list ElevenLabs voices for the user's account ─
          // GET → { voices: [{ voice_id, name, labels, preview_url }] }
          server.middlewares.use("/__voice_voices", async (req, res, next) => {
            if (req.method !== "GET") return next();
            if (!isLoopback(req)) { res.statusCode = 403; res.end(JSON.stringify({ error: "loopback only" })); return; }
            try {
              const cfgPath = join(homedir(), ".claude-os", "config.json");
              let apiKey = process.env.ELEVENLABS_API_KEY ?? "";
              if (!apiKey && existsSync(cfgPath)) {
                try {
                  const cfg = JSON.parse(readFileSync(cfgPath, "utf8"));
                  apiKey = cfg.voice?.elevenlabs_api_key ?? cfg.ELEVENLABS_API_KEY ?? cfg.elevenlabs_api_key ?? "";
                } catch { /* skip */ }
              }
              if (!apiKey) {
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ voices: [], note: "ELEVENLABS_API_KEY not set. Add to ~/.claude-os/config.json under voice.elevenlabs_api_key, or export ELEVENLABS_API_KEY." }));
                return;
              }
              const upstream = await fetch("https://api.elevenlabs.io/v1/voices", {
                headers: { "xi-api-key": apiKey, "Accept": "application/json" },
              });
              if (!upstream.ok) {
                res.statusCode = upstream.status;
                res.end(JSON.stringify({ error: `ElevenLabs ${upstream.status}` }));
                return;
              }
              const j = await upstream.json() as { voices: Array<{ voice_id: string; name: string; labels?: Record<string,string>; preview_url?: string }> };
              res.setHeader("Content-Type", "application/json");
              res.setHeader("Cache-Control", "no-store");
              res.end(JSON.stringify({ voices: j.voices.map((v) => ({ voice_id: v.voice_id, name: v.name, labels: v.labels ?? {}, preview_url: v.preview_url ?? null })) }));
            } catch (e: any) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: e?.message ?? String(e) }));
            }
          });


          // ───────────────────────────────────────────────────────────────
          // DOCUMENTS GALLERY — three middlewares for the Hermes-page
          // "documents" surface. Source folder: ~/Documents/Hermes/
          // (auto-created on first hit so a fresh operator gets an empty
          // gallery instead of an error). Drag/save anything here and
          // it appears on the dashboard within 5 seconds (the gallery
          // polls). Click-to-delete removes from disk.
          //
          //   GET    /__hermes_documents             → list metadata
          //   GET    /__hermes_documents/file?name=  → stream one file
          //   DELETE /__hermes_documents?name=       → delete one file
          //
          // All three: loopback-only, path-traversal guarded
          // (filename must be a bare basename — no slashes, no `..`).
          // ───────────────────────────────────────────────────────────────
          const DOCUMENTS_DIR = join(homedir(), "Documents", "Hermes");
          // Soft-delete target. Files moved here on DELETE; the restore
          // endpoint moves them back. The dotfile prefix means listing
          // already skips this dir, so it doesn't show in the gallery.
          const TRASH_DIR = join(DOCUMENTS_DIR, ".trash");

          function ensureDocumentsDir() {
            try {
              if (!existsSync(DOCUMENTS_DIR)) {
                mkdirSync(DOCUMENTS_DIR, { recursive: true });
              }
            } catch {
              /* ignore — listing will return empty */
            }
          }

          function ensureTrashDir() {
            try {
              if (!existsSync(TRASH_DIR)) {
                mkdirSync(TRASH_DIR, { recursive: true });
              }
            } catch {
              /* ignore — soft-delete will fall back to hard-delete */
            }
          }

          // Trash IDs encode the original filename so restore can move
          // the file back without needing a separate manifest. Format:
          // {timestamp}__{originalname}. The timestamp prefix makes them
          // unique even across rapid same-name deletions.
          function safeTrashId(id: string | null): string | null {
            if (!id) return null;
            if (id.length === 0 || id.length > 320) return null;
            if (id.includes("/") || id.includes("\\")) return null;
            if (id.includes("..")) return null;
            if (!id.includes("__")) return null;
            return id;
          }

          function originalNameFromTrashId(id: string): string | null {
            // id = "{ms}__{originalname}". Split on the first __ only —
            // the original filename can contain __ in rare cases.
            const idx = id.indexOf("__");
            if (idx < 0) return null;
            const name = id.slice(idx + 2);
            return safeDocName(name);
          }

          function safeDocName(name: string | null): string | null {
            if (!name) return null;
            // Reject path-traversal, absolute paths, hidden files,
            // anything that contains a separator. Filename must be a
            // bare basename of reasonable length.
            if (name.length === 0 || name.length > 255) return null;
            if (name.includes("/") || name.includes("\\")) return null;
            if (name.includes("..")) return null;
            if (name.startsWith(".")) return null;
            return name;
          }

          // Symlink-safe path resolver. safeDocName() blocks string-form
          // path traversal but does NOT stop symlinks — an operator (or
          // attacker) could drop ~/Documents/Hermes/secret.html as a
          // symlink to ~/.ssh/id_rsa, and renameSync() would silently
          // move the private key into .trash/, or readFileSync() would
          // stream it back over the loopback endpoint. realpathSync()
          // follows every symlink to the true on-disk path; if that
          // path doesn't live inside DOCUMENTS_DIR or TRASH_DIR, we
          // refuse the operation. Returns the safe absolute path or
          // null if it would escape.
          let DOCUMENTS_DIR_REAL: string | null = null;
          let TRASH_DIR_REAL: string | null = null;
          function resolveInsideDocs(
            rawPath: string,
            allowTrash = false,
          ): string | null {
            try {
              // Cache the real root paths after first successful resolve
              // (cheap), so we don't realpath() the same dirs every call.
              if (DOCUMENTS_DIR_REAL === null) {
                DOCUMENTS_DIR_REAL = realpathSync(DOCUMENTS_DIR);
              }
              if (allowTrash && TRASH_DIR_REAL === null && existsSync(TRASH_DIR)) {
                TRASH_DIR_REAL = realpathSync(TRASH_DIR);
              }
              const real = realpathSync(rawPath);
              const docPrefix = DOCUMENTS_DIR_REAL + sep;
              if (real === DOCUMENTS_DIR_REAL || real.startsWith(docPrefix)) {
                return real;
              }
              if (allowTrash && TRASH_DIR_REAL) {
                const trashPrefix = TRASH_DIR_REAL + sep;
                if (real === TRASH_DIR_REAL || real.startsWith(trashPrefix)) {
                  return real;
                }
              }
              return null;
            } catch {
              // ENOENT / ELOOP / permission errors all collapse to "no".
              return null;
            }
          }

          function classifyDoc(ext: string): string {
            const e = ext.toLowerCase().replace(/^\./, "");
            if (["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "ico", "avif"].includes(e)) return "image";
            if (["pdf"].includes(e)) return "pdf";
            if (["html", "htm"].includes(e)) return "html";
            if (["md", "markdown", "mdx"].includes(e)) return "markdown";
            if (["txt", "log"].includes(e)) return "text";
            if (["json", "yaml", "yml", "toml", "csv", "tsv"].includes(e)) return "data";
            if (["mp4", "mov", "webm", "mkv", "avi"].includes(e)) return "video";
            if (["mp3", "wav", "ogg", "m4a", "flac"].includes(e)) return "audio";
            if (["zip", "tar", "gz", "tgz", "7z", "rar"].includes(e)) return "archive";
            if (["ts", "tsx", "js", "jsx", "py", "rb", "go", "rs", "java", "c", "cpp", "sh"].includes(e)) return "code";
            return "other";
          }

          // Read at most this many bytes per file when parsing the
          // title + description metadata. Big enough to catch frontmatter
          // and HTML <head>, small enough that a folder full of multi-MB
          // PDFs still lists in milliseconds.
          const META_READ_CAP = 4096;

          // Per-type metadata parser. Returns { title, description } —
          // either may be null. Hermes is asked (via the onboarding prompt)
          // to embed these explicitly so we get clean strings; the
          // fallbacks here mean even files without explicit metadata still
          // render with something better than the raw filename.
          function parseDocMeta(
            path: string,
            type: string,
          ): { title: string | null; description: string | null } {
            // Skip types that can't be cheaply parsed for text metadata.
            if (["image", "pdf", "video", "audio", "archive"].includes(type)) {
              return { title: null, description: null };
            }
            let head: string;
            try {
              const buf = readFileSync(path);
              head = buf.subarray(0, META_READ_CAP).toString("utf8");
            } catch {
              return { title: null, description: null };
            }

            // Trim a string to N words, with an ellipsis if truncated.
            // Kept loose — the operator-side word caps are soft.
            const trimWords = (s: string | null, n: number): string | null => {
              if (!s) return null;
              const cleaned = s.replace(/\s+/g, " ").trim();
              if (!cleaned) return null;
              const parts = cleaned.split(" ");
              if (parts.length <= n) return cleaned;
              return parts.slice(0, n).join(" ") + "…";
            };

            let title: string | null = null;
            let description: string | null = null;

            if (type === "html") {
              // Explicit hermes-* meta tags win — that's what Hermes is
              // asked to emit. Fall back to <title> and the standard
              // <meta name="description"> so non-Hermes HTML still works.
              const metaTitle = head.match(
                /<meta\s+name=["']hermes-title["']\s+content=["']([^"']+)["']/i,
              );
              const metaDesc = head.match(
                /<meta\s+name=["']hermes-description["']\s+content=["']([^"']+)["']/i,
              );
              const fallbackTitle = head.match(/<title>([^<]+)<\/title>/i);
              const fallbackDesc = head.match(
                /<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i,
              );
              title = metaTitle?.[1] ?? fallbackTitle?.[1] ?? null;
              description = metaDesc?.[1] ?? fallbackDesc?.[1] ?? null;
            } else if (type === "markdown") {
              // YAML frontmatter first, then fall back to first # heading
              // + first paragraph.
              const fm = head.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
              if (fm) {
                const t = fm[1].match(/^title:\s*(.+)$/m);
                const d = fm[1].match(/^description:\s*(.+)$/m);
                if (t) title = t[1].replace(/^["']|["']$/g, "").trim();
                if (d) description = d[1].replace(/^["']|["']$/g, "").trim();
              }
              if (!title) {
                const h1 = head.match(/^#\s+(.+?)\s*$/m);
                if (h1) title = h1[1];
              }
              if (!description) {
                // Strip frontmatter + heading, then first paragraph.
                const body = head
                  .replace(/^---[\s\S]*?\n---\s*\n/, "")
                  .replace(/^#.+$/m, "")
                  .trim();
                const para = body.split(/\n\s*\n/).find((p) => p.trim());
                if (para) description = para.replace(/[*_`]/g, "").trim();
              }
            } else if (type === "data") {
              // JSON: look for top-level title/description, or _hermes.{title,description}.
              if (path.endsWith(".json")) {
                try {
                  const parsed = JSON.parse(head);
                  title =
                    parsed?._hermes?.title ??
                    parsed?.title ??
                    parsed?.name ??
                    null;
                  description =
                    parsed?._hermes?.description ??
                    parsed?.description ??
                    parsed?.summary ??
                    null;
                  if (typeof title !== "string") title = null;
                  if (typeof description !== "string") description = null;
                } catch {
                  // Truncated JSON inside the 4KB window — try a permissive
                  // regex on the head instead.
                  const t = head.match(/"title"\s*:\s*"([^"]+)"/);
                  const d = head.match(/"description"\s*:\s*"([^"]+)"/);
                  title = t?.[1] ?? null;
                  description = d?.[1] ?? null;
                }
              } else {
                // YAML / TOML / CSV — look for a leading comment pair.
                const t = head.match(/^[#\s]*title:\s*(.+)$/im);
                const d = head.match(/^[#\s]*description:\s*(.+)$/im);
                if (t) title = t[1].trim();
                if (d) description = d[1].trim();
              }
            } else if (type === "text") {
              // Convention: first non-empty line = title, second = description,
              // optionally prefixed with a leading "# " or similar.
              const lines = head
                .split(/\r?\n/)
                .map((l) => l.replace(/^[#\s>*—\-=]+/, "").trim())
                .filter((l) => l.length > 0);
              if (lines[0]) title = lines[0];
              if (lines[1]) description = lines[1];
            } else if (type === "code") {
              // First leading-comment line as title, second as description.
              const lines = head
                .split(/\r?\n/)
                .map((l) =>
                  l.replace(/^\s*(\/\/|#|--|\/\*|\*)\s?/, "").trim(),
                )
                .filter((l) => l.length > 0 && !l.startsWith("*/"));
              if (lines[0]) title = lines[0];
              if (lines[1]) description = lines[1];
            }

            // Soft caps to keep card layouts tidy. Hermes is asked for
            // ≤5 / ≤15 words; we enforce slightly looser limits server-side
            // so legacy or hand-edited files don't get awkwardly chopped.
            return {
              title: trimWords(title, 8),
              description: trimWords(description, 22),
            };
          }

          // Cache wrapper around parseDocMeta. Keyed on the absolute
          // path; cache hits when mtimeMs AND size both match. The
          // gallery polls every 5s, so without this we'd readFileSync
          // every file on every poll (200 files = 200 syncs / 5s,
          // blocks HMR + the rest of the dev server). Per-process map
          // so it dies with vite reload.
          interface MetaCacheEntry {
            mtimeMs: number;
            size: number;
            meta: { title: string | null; description: string | null };
          }
          const docMetaCache = new Map<string, MetaCacheEntry>();
          function cachedParseDocMeta(
            path: string,
            type: string,
            mtimeMs: number,
            size: number,
          ): { title: string | null; description: string | null } {
            const cached = docMetaCache.get(path);
            if (cached && cached.mtimeMs === mtimeMs && cached.size === size) {
              return cached.meta;
            }
            const meta = parseDocMeta(path, type);
            docMetaCache.set(path, { mtimeMs, size, meta });
            // Soft cap on cache size to bound memory if the operator
            // is churning many files. Drop oldest insertion when we
            // exceed 5000 entries — generous given the 1000-file
            // enumeration cap.
            if (docMetaCache.size > 5000) {
              const firstKey = docMetaCache.keys().next().value;
              if (firstKey) docMetaCache.delete(firstKey);
            }
            return meta;
          }

          server.middlewares.use("/__hermes_documents", (req, res, next) => {
            if (!isLoopback(req)) {
              res.statusCode = 403;
              res.end(JSON.stringify({ error: "loopback only" }));
              return;
            }
            const url = new URL(req.url || "", "http://localhost");
            // GET /__hermes_documents/file?name=… → stream one file with
            // a sensible Content-Type so the preview pane can render it
            // (img tag for images, iframe for html/pdf, fetch+text for
            // markdown/text/code).
            if (req.method === "GET" && url.pathname.endsWith("/file")) {
              const name = safeDocName(url.searchParams.get("name"));
              if (!name) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: "invalid name" }));
                return;
              }
              const rawPath = join(DOCUMENTS_DIR, name);
              if (!existsSync(rawPath)) {
                res.statusCode = 404;
                res.end(JSON.stringify({ error: "not found" }));
                return;
              }
              // Symlink-escape guard: refuse to serve anything whose
              // real on-disk path escapes ~/Documents/Hermes/. Stops
              // an attacker who can plant a symlink in the folder from
              // exfiltrating ~/.ssh/id_rsa or other arbitrary files.
              const safePath = resolveInsideDocs(rawPath);
              if (!safePath) {
                res.statusCode = 403;
                res.end(JSON.stringify({ error: "path escapes documents folder" }));
                return;
              }
              const ext = name.includes(".") ? name.split(".").pop()!.toLowerCase() : "";
              const mimeMap: Record<string, string> = {
                png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg",
                gif: "image/gif", webp: "image/webp", svg: "image/svg+xml",
                bmp: "image/bmp", ico: "image/x-icon", avif: "image/avif",
                pdf: "application/pdf",
                html: "text/html; charset=utf-8", htm: "text/html; charset=utf-8",
                md: "text/markdown; charset=utf-8", markdown: "text/markdown; charset=utf-8",
                txt: "text/plain; charset=utf-8", log: "text/plain; charset=utf-8",
                json: "application/json; charset=utf-8",
                yaml: "text/yaml; charset=utf-8", yml: "text/yaml; charset=utf-8",
                csv: "text/csv; charset=utf-8",
                mp4: "video/mp4", mov: "video/quicktime", webm: "video/webm",
                mp3: "audio/mpeg", wav: "audio/wav", ogg: "audio/ogg",
              };
              const mime = mimeMap[ext] ?? "application/octet-stream";
              try {
                const st = statSync(safePath);
                res.setHeader("Content-Type", mime);
                res.setHeader("Cache-Control", "no-store");
                res.setHeader("Content-Length", String(st.size));
                // Stream instead of slurping — a 2GB video would
                // otherwise pull the whole file into memory before
                // the first byte ships.
                const stream = createReadStream(safePath);
                stream.on("error", (err: any) => {
                  if (!res.headersSent) {
                    res.statusCode = 500;
                    res.end(JSON.stringify({ error: err?.message ?? "stream failed" }));
                  } else {
                    res.destroy(err);
                  }
                });
                stream.pipe(res);
              } catch (err: any) {
                res.statusCode = 500;
                res.end(JSON.stringify({ error: err?.message ?? "read failed" }));
              }
              return;
            }
            // DELETE /__hermes_documents?name=… → soft-delete (move to
            // .trash/). Returns a trashId the operator can use within
            // the undo window to restore the file. Files in .trash/
            // are not auto-purged — operator can clean manually from
            // Finder. This means "delete" is genuinely reversible
            // forever, not just within the 8-second toast window.
            // Skip when the path is one of the sub-routes — those have
            // their own DELETE handlers below.
            if (req.method === "DELETE" && !url.pathname.endsWith("/trash")) {
              const name = safeDocName(url.searchParams.get("name"));
              if (!name) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: "invalid name" }));
                return;
              }
              const path = join(DOCUMENTS_DIR, name);
              try {
                if (!existsSync(path)) {
                  res.statusCode = 404;
                  res.end(JSON.stringify({ error: "not found" }));
                  return;
                }
                // Symlink guard — refuse to trash anything whose real
                // path is outside ~/Documents/Hermes/. Stops a symlink
                // attack from moving ~/.ssh/id_rsa into .trash/.
                if (!resolveInsideDocs(path)) {
                  res.statusCode = 403;
                  res.end(JSON.stringify({ error: "path escapes documents folder" }));
                  return;
                }
                ensureTrashDir();
                const trashId = `${Date.now()}__${name}`;
                renameSync(path, join(TRASH_DIR, trashId));
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ ok: true, trashId }));
              } catch (err: any) {
                res.statusCode = 500;
                res.end(JSON.stringify({ error: err?.message ?? "delete failed" }));
              }
              return;
            }
            // POST /__hermes_documents/restore?trashId=… → undo a
            // soft-delete by moving the file back to its original name.
            // If a file with the original name already exists (operator
            // recreated it in the meantime), append a numeric suffix
            // rather than clobbering.
            if (req.method === "POST" && url.pathname.endsWith("/restore")) {
              const trashId = safeTrashId(url.searchParams.get("trashId"));
              if (!trashId) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: "invalid trashId" }));
                return;
              }
              const original = originalNameFromTrashId(trashId);
              if (!original) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: "invalid trashId payload" }));
                return;
              }
              const trashPath = join(TRASH_DIR, trashId);
              if (!existsSync(trashPath)) {
                res.statusCode = 404;
                res.end(JSON.stringify({ error: "trash entry not found" }));
                return;
              }
              // Symlink guard — the entry in .trash/ must resolve to a
              // path actually inside .trash/. Without this, an attacker
              // could plant a symlink inside .trash/ pointing to e.g.
              // ~/.zshrc and a restore would happily move it into
              // ~/Documents/Hermes/.
              if (!resolveInsideDocs(trashPath, /*allowTrash*/ true)) {
                res.statusCode = 403;
                res.end(JSON.stringify({ error: "trash entry escapes folder" }));
                return;
              }
              // Compute a non-clobbering target name. If the original is
              // taken, append " (restored)", then " (restored 2)", etc.
              let targetName = original;
              if (existsSync(join(DOCUMENTS_DIR, targetName))) {
                const dot = original.lastIndexOf(".");
                const stem = dot > 0 ? original.slice(0, dot) : original;
                const ext = dot > 0 ? original.slice(dot) : "";
                let n = 1;
                let candidate = `${stem} (restored)${ext}`;
                while (existsSync(join(DOCUMENTS_DIR, candidate))) {
                  n += 1;
                  candidate = `${stem} (restored ${n})${ext}`;
                }
                targetName = candidate;
              }
              try {
                renameSync(trashPath, join(DOCUMENTS_DIR, targetName));
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ ok: true, restoredAs: targetName }));
              } catch (err: any) {
                res.statusCode = 500;
                res.end(JSON.stringify({ error: err?.message ?? "restore failed" }));
              }
              return;
            }
            // GET /__hermes_documents/trash → list everything in the
            // soft-delete folder so the operator can restore or
            // permanently delete from a dedicated UI.
            if (req.method === "GET" && url.pathname.endsWith("/trash")) {
              const items: Array<{
                trashId: string;
                originalName: string;
                deletedMs: number;
                sizeBytes: number;
              }> = [];
              try {
                if (existsSync(TRASH_DIR)) {
                  for (const entry of readdirSync(TRASH_DIR)) {
                    const original = originalNameFromTrashId(entry);
                    if (!original) continue;
                    try {
                      const st = statSync(join(TRASH_DIR, entry));
                      if (!st.isFile()) continue;
                      const tsRaw = entry.split("__")[0];
                      const ts = Number(tsRaw);
                      items.push({
                        trashId: entry,
                        originalName: original,
                        deletedMs: Number.isFinite(ts) ? ts : st.mtimeMs,
                        sizeBytes: st.size,
                      });
                    } catch {
                      /* skip unreadable entry */
                    }
                  }
                }
              } catch {
                /* ignore — return empty */
              }
              items.sort((a, b) => b.deletedMs - a.deletedMs);
              res.setHeader("Content-Type", "application/json");
              res.setHeader("Cache-Control", "no-store");
              res.end(JSON.stringify({ items }));
              return;
            }
            // DELETE /__hermes_documents/trash?trashId=… → permanently
            // remove one trashed file. DELETE /__hermes_documents/trash
            // (no trashId) → empty the entire trash.
            if (req.method === "DELETE" && url.pathname.endsWith("/trash")) {
              const trashIdParam = url.searchParams.get("trashId");
              if (trashIdParam) {
                const trashId = safeTrashId(trashIdParam);
                if (!trashId) {
                  res.statusCode = 400;
                  res.end(JSON.stringify({ error: "invalid trashId" }));
                  return;
                }
                const p = join(TRASH_DIR, trashId);
                try {
                  if (existsSync(p)) {
                    // Symlink guard — the entry must be inside .trash/,
                    // not a symlink to ~/.zshrc or similar.
                    if (!resolveInsideDocs(p, /*allowTrash*/ true)) {
                      res.statusCode = 403;
                      res.end(JSON.stringify({ error: "trash entry escapes folder" }));
                      return;
                    }
                    unlinkSync(p);
                  }
                  res.setHeader("Content-Type", "application/json");
                  res.end(JSON.stringify({ ok: true }));
                } catch (err: any) {
                  res.statusCode = 500;
                  res.end(JSON.stringify({ error: err?.message ?? "purge failed" }));
                }
                return;
              }
              // Empty all — unlink every file inside TRASH_DIR. Each
              // entry is symlink-checked before unlink so an attacker
              // can't seed .trash/ with a symlink to a system file and
              // weaponize "empty trash" into a system deletion.
              let purged = 0;
              const errors: string[] = [];
              try {
                if (existsSync(TRASH_DIR)) {
                  for (const entry of readdirSync(TRASH_DIR)) {
                    const p = join(TRASH_DIR, entry);
                    try {
                      // Use lstatSync to inspect the link itself, not
                      // its target. resolveInsideDocs then verifies the
                      // resolved path is genuinely inside .trash/.
                      const lst = lstatSync(p);
                      if (!lst.isFile() && !lst.isSymbolicLink()) continue;
                      if (!resolveInsideDocs(p, /*allowTrash*/ true)) {
                        errors.push(`${entry}: refused (escapes folder)`);
                        continue;
                      }
                      unlinkSync(p);
                      purged += 1;
                    } catch (e: any) {
                      errors.push(`${entry}: ${e?.message ?? "purge failed"}`);
                    }
                  }
                }
              } catch (e: any) {
                errors.push(e?.message ?? "could not read trash dir");
              }
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ ok: errors.length === 0, purged, errors }));
              return;
            }
            // GET /__hermes_documents → list metadata
            if (req.method !== "GET") return next();
            ensureDocumentsDir();
            const items: Array<{
              name: string;
              type: string;
              ext: string;
              sizeBytes: number;
              modifiedMs: number;
              title: string | null;
              description: string | null;
            }> = [];
            // Cap so a runaway folder doesn't hang the dev server's
            // event loop on the 5s polling cadence. 1000 is well past
            // any realistic operator's gallery; if it ever trips we
            // surface a `truncated` flag in the response.
            const MAX_ENTRIES = 1000;
            let truncated = false;
            try {
              const entries = readdirSync(DOCUMENTS_DIR);
              for (const name of entries) {
                if (items.length >= MAX_ENTRIES) {
                  truncated = true;
                  break;
                }
                if (name.startsWith(".")) continue; // skip .DS_Store etc.
                try {
                  const p = join(DOCUMENTS_DIR, name);
                  // lstatSync inspects the link itself — we want to
                  // skip symlinks entirely from the listing, never
                  // mind serving them. If an operator drops a symlink
                  // it just doesn't appear in the gallery.
                  const lst = lstatSync(p);
                  if (lst.isSymbolicLink()) continue;
                  if (!lst.isFile()) continue;
                  const ext = name.includes(".") ? name.split(".").pop()!.toLowerCase() : "";
                  const type = classifyDoc(ext);
                  // Cached metadata read — keyed on (path, mtimeMs, size).
                  // At 200+ files on a 5s poll the uncached cost is
                  // 200×readFileSync + regex/parse every 5s. With the
                  // cache the cost drops to a single lstat per file
                  // unless its mtime or size changed.
                  const meta = cachedParseDocMeta(p, type, lst.mtimeMs, lst.size);
                  items.push({
                    name,
                    type,
                    ext,
                    sizeBytes: lst.size,
                    modifiedMs: lst.mtimeMs,
                    title: meta.title,
                    description: meta.description,
                  });
                } catch {
                  /* skip unreadable entry */
                }
              }
            } catch {
              /* ignore — return empty list */
            }
            // Newest first by default.
            items.sort((a, b) => b.modifiedMs - a.modifiedMs);

            // Trash count — cheap, lets the frontend conditionally
            // render the "Trash · N" link without an extra round trip.
            let trashCount = 0;
            try {
              if (existsSync(TRASH_DIR)) {
                for (const entry of readdirSync(TRASH_DIR)) {
                  if (originalNameFromTrashId(entry)) trashCount += 1;
                }
              }
            } catch {
              /* ignore — leave count at 0 */
            }

            res.setHeader("Content-Type", "application/json");
            res.setHeader("Cache-Control", "no-store");
            res.end(JSON.stringify({ folder: DOCUMENTS_DIR, items, trashCount, truncated }));
          });

          // GET /__just-installed — true the first time after `bun run setup`,
          // false thereafter. Setup writes ~/.claude-os/show-wizard; this
          // endpoint reads + deletes it so the dashboard force-opens the
          // wizard once even if the browser has stale claude-os-config from
          // a prior install.
          server.middlewares.use("/__just-installed", (req, res, next) => {
            if (req.method !== "GET") return next();
            const marker = join(homedir(), ".claude-os", "show-wizard");
            let justInstalled = false;
            try {
              if (existsSync(marker)) {
                justInstalled = true;
                unlinkSync(marker);
              }
            } catch {
              /* ignore */
            }
            res.setHeader("Content-Type", "application/json");
            res.setHeader("Cache-Control", "no-store");
            res.end(JSON.stringify({ justInstalled }));
          });

          // GET /__token — hands the per-run refresh token to the dashboard
          // so it can authenticate /__refresh_data. Loopback-only and must
          // match the local file's contents (which only the user account
          // can read), so a browser extension on another origin can't get
          // it. Rotated every dev-server boot.
          server.middlewares.use("/__token", (req, res, next) => {
            if (req.method !== "GET") return next();
            if (!isLoopback(req)) {
              res.statusCode = 403;
              res.end(JSON.stringify({ error: "loopback only" }));
              return;
            }
            res.setHeader("Content-Type", "application/json");
            res.setHeader("Cache-Control", "no-store");
            res.end(JSON.stringify({ token: REFRESH_TOKEN }));
          });

          // POST /__refresh_data — re-runs the aggregator. Locked down to
          // (a) loopback origin only, and (b) a per-run token in the
          // X-Claude-OS-Token header. Any drive-by request from another
          // origin or extension is rejected with 403. Without this, every
          // tab on localhost:8081 could trigger a full machine scan that
          // reads ~/.claude/, decodes JWTs, and runs `security
          // dump-keychain`.
          server.middlewares.use("/__refresh_data", (req, res) => {
            if (req.method !== "POST") {
              res.statusCode = 405;
              res.end("Method not allowed");
              return;
            }
            if (!isLoopback(req)) {
              res.statusCode = 403;
              res.end(JSON.stringify({ ok: false, error: "loopback only" }));
              return;
            }
            const provided = req.headers["x-claude-os-token"];
            if (provided !== REFRESH_TOKEN) {
              res.statusCode = 403;
              res.end(JSON.stringify({ ok: false, error: "invalid token" }));
              return;
            }
            try {
              const root = resolve(__dirname);
              execSync("bun run scripts/aggregate.ts", {
                cwd: root,
                stdio: "pipe",
                timeout: 30000,
              });
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ ok: true }));
            } catch (err: any) {
              res.statusCode = 500;
              res.end(JSON.stringify({ ok: false, error: err.message }));
            }
          });

          // GET/POST /__os_config — read or merge ~/.claude-os/config.json.
          // GET  → returns the full config object (or {} if not found).
          // POST → merges the JSON body into the config and saves it.
          // Loopback-only: never reachable from another machine on the LAN.
          server.middlewares.use("/__os_config", (req, res, next) => {
            if (!isLoopback(req)) {
              res.statusCode = 403;
              res.end(JSON.stringify({ ok: false, error: "loopback only" }));
              return;
            }
            const configDir = join(homedir(), ".claude-os");
            const configPath = join(configDir, "config.json");

            if (req.method === "GET") {
              try {
                const raw = existsSync(configPath)
                  ? readFileSync(configPath, "utf8")
                  : "{}";
                res.setHeader("Content-Type", "application/json");
                res.setHeader("Cache-Control", "no-store");
                res.end(raw);
              } catch (err: any) {
                res.statusCode = 500;
                res.end(JSON.stringify({ ok: false, error: err.message }));
              }
              return;
            }

            if (req.method === "POST") {
              let body = "";
              req.on("data", (chunk: Buffer) => {
                body += chunk.toString();
              });
              req.on("end", () => {
                try {
                  const incoming = JSON.parse(body);
                  let existing: Record<string, unknown> = {};
                  if (existsSync(configPath)) {
                    try {
                      existing = JSON.parse(readFileSync(configPath, "utf8"));
                    } catch {
                      /* corrupt — overwrite */
                    }
                  }
                  const merged = { ...existing, ...incoming };
                  mkdirSync(configDir, { recursive: true });
                  writeFileSync(configPath, JSON.stringify(merged, null, 2), "utf8");
                  res.setHeader("Content-Type", "application/json");
                  res.end(JSON.stringify({ ok: true }));
                } catch (err: any) {
                  res.statusCode = 400;
                  res.end(JSON.stringify({ ok: false, error: err.message }));
                }
              });
              return;
            }

            next();
          });

          // POST /__obsidian_write — write a file into the configured Obsidian
          // vault. Body: { relativePath: string, content: string }.
          // Reads vaultPath from ~/.claude-os/config.json → obsidianVaultPath.
          // Creates parent directories as needed, then writes the file.
          // Returns { ok: true, path: absolutePath } or { ok: false, error }.
          // Loopback-only.
          server.middlewares.use("/__obsidian_write", (req, res, next) => {
            if (req.method !== "POST") return next();
            if (!isLoopback(req)) {
              res.statusCode = 403;
              res.end(JSON.stringify({ ok: false, error: "loopback only" }));
              return;
            }
            let body = "";
            req.on("data", (chunk: Buffer) => {
              body += chunk.toString();
            });
            req.on("end", () => {
              try {
                const { relativePath, content } = JSON.parse(body) as {
                  relativePath: string;
                  content: string;
                };
                if (!relativePath || typeof content !== "string") {
                  res.statusCode = 400;
                  res.end(
                    JSON.stringify({
                      ok: false,
                      error: "relativePath and content are required",
                    }),
                  );
                  return;
                }

                // Read vault path from config
                const configPath = join(homedir(), ".claude-os", "config.json");
                let vaultPath: string | undefined;
                if (existsSync(configPath)) {
                  try {
                    const cfg = JSON.parse(readFileSync(configPath, "utf8"));
                    vaultPath = cfg?.obsidianVaultPath;
                  } catch {
                    /* ignore parse errors */
                  }
                }

                if (!vaultPath) {
                  res.statusCode = 422;
                  res.end(
                    JSON.stringify({ ok: false, error: "No vault configured" }),
                  );
                  return;
                }

                const absPath = join(vaultPath, relativePath);
                const dir = absPath.substring(0, absPath.lastIndexOf("/"));
                mkdirSync(dir, { recursive: true });
                writeFileSync(absPath, content, "utf8");

                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ ok: true, path: absPath, vaultPath }));
              } catch (err: any) {
                res.statusCode = 400;
                res.end(JSON.stringify({ ok: false, error: err.message }));
              }
            });
          });

          // ──────────────────────────────────────────────────────────────
          // GET /__ruflo_status — check if Ruflo is registered as an MCP
          // server in Claude's settings. Returns { registered: bool, mcpName? }
          // ──────────────────────────────────────────────────────────────
          server.middlewares.use("/__ruflo_status", (req, res, next) => {
            if (req.method !== "GET") return next();
            if (!isLoopback(req)) {
              res.statusCode = 403;
              res.end(JSON.stringify({ ok: false, error: "loopback only" }));
              return;
            }
            try {
              const home = homedir();
              // Check ~/.claude/settings.json for mcpServers
              let registered = false;
              let mcpName: string | null = null;
              const settingsPath = join(home, ".claude", "settings.json");
              if (existsSync(settingsPath)) {
                try {
                  const s = JSON.parse(readFileSync(settingsPath, "utf8"));
                  const mcpServers = s?.mcpServers ?? {};
                  for (const key of Object.keys(mcpServers)) {
                    if (key.toLowerCase().includes("ruflo")) {
                      registered = true;
                      mcpName = key;
                      break;
                    }
                  }
                } catch { /* ignore */ }
              }
              // Also check ~/.claude.json global config
              if (!registered) {
                const globalCfg = join(home, ".claude.json");
                if (existsSync(globalCfg)) {
                  try {
                    const g = JSON.parse(readFileSync(globalCfg, "utf8"));
                    const mcpServers = g?.mcpServers ?? {};
                    for (const key of Object.keys(mcpServers)) {
                      if (key.toLowerCase().includes("ruflo")) {
                        registered = true;
                        mcpName = key;
                        break;
                      }
                    }
                  } catch { /* ignore */ }
                }
              }
              res.setHeader("Content-Type", "application/json");
              res.setHeader("Cache-Control", "no-store");
              res.end(JSON.stringify({ registered, mcpName }));
            } catch (err: any) {
              res.statusCode = 500;
              res.end(JSON.stringify({ registered: false, error: err.message }));
            }
          });

          // ──────────────────────────────────────────────────────────────
          // GET /__opencode_status — probe whether the opencode CLI is
          // installed on this machine. opencode is sst/opencode — a TUI
          // coding agent. We surface it as a tab inside the Coding Agent so
          // operators can flip between Gemma 4 (Ollama) and opencode without
          // leaving the page. Returns { installed: bool, version: string|null,
          // path: string|null, error: string|null }
          server.middlewares.use("/__opencode_status", async (req, res, next) => {
            if (req.method !== "GET") return next();
            if (!isLoopback(req)) {
              res.statusCode = 403;
              res.end(JSON.stringify({ installed: false, error: "loopback only" }));
              return;
            }
            try {
              const { execFile } = await import("node:child_process");
              const { promisify } = await import("node:util");
              const { existsSync } = await import("node:fs");
              const efp = promisify(execFile);
              const candidates = [
                "opencode",
                "/opt/homebrew/bin/opencode",
                "/usr/local/bin/opencode",
                `${process.env.HOME ?? ""}/.opencode/bin/opencode`,
              ];
              const bin = candidates.find((c) => c === "opencode" || existsSync(c)) ?? null;
              if (!bin) {
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ installed: false, version: null, path: null, error: null }));
                return;
              }
              try {
                const r = await efp(bin, ["--version"], { timeout: 4000 }) as { stdout: string; stderr: string };
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({
                  installed: true,
                  version: r.stdout.trim() || r.stderr.trim() || "(unknown)",
                  path: bin,
                  error: null,
                }));
              } catch (e: any) {
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({
                  installed: false,
                  version: null,
                  path: bin,
                  error: e?.message ?? "probe failed",
                }));
              }
            } catch (err: any) {
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ installed: false, error: err?.message ?? String(err) }));
            }
          });

          // GET /__fcc_status — probe whether the Free Claude Code proxy
          // (fcc-server) is running on localhost:8082.
          // Returns { live: bool, port: 8082, model: string | null }
          // ──────────────────────────────────────────────────────────────
          server.middlewares.use("/__fcc_status", async (req, res, next) => {
            if (req.method !== "GET") return next();
            if (!isLoopback(req)) {
              res.statusCode = 403;
              res.end(JSON.stringify({ ok: false, error: "loopback only" }));
              return;
            }
            try {
              const controller = new AbortController();
              const timeout = setTimeout(() => controller.abort(), 1500);
              let live = false;
              try {
                const probe = await fetch("http://127.0.0.1:8082/health", {
                  signal: controller.signal,
                });
                live = probe.ok || probe.status < 500;
              } catch { /* server not running */ }
              clearTimeout(timeout);
              res.setHeader("Content-Type", "application/json");
              res.setHeader("Cache-Control", "no-store");
              res.end(JSON.stringify({
                live,
                port: 8082,
                model: live ? "open_router/openrouter/owl-alpha" : null,
                adminUrl: "http://127.0.0.1:8082/admin",
              }));
            } catch (err: any) {
              res.end(JSON.stringify({ live: false, error: err.message }));
            }
          });

          // ──────────────────────────────────────────────────────────────
          // POST /__fcc_chat — proxy a chat turn to the Free Claude Code
          // proxy (fcc-server on :8082). Accepts { messages, stream? }.
          // Forwards to http://127.0.0.1:8082/v1/messages (Anthropic API).
          // Returns streaming SSE or a plain JSON response.
          // ──────────────────────────────────────────────────────────────
          server.middlewares.use("/__fcc_chat", async (req, res, next) => {
            if (req.method !== "POST") return next();
            if (!isLoopback(req)) {
              res.statusCode = 403;
              res.end(JSON.stringify({ ok: false, error: "loopback only" }));
              return;
            }
            let body = "";
            req.on("data", (chunk: Buffer) => { body += chunk.toString(); });
            req.on("end", async () => {
              try {
                const parsed = JSON.parse(body);
                const messages = parsed.messages ?? [];
                // Forward to fcc-server using Anthropic Messages API format
                const upstream = await fetch("http://127.0.0.1:8082/v1/messages", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    "x-api-key": "freecc",
                    "anthropic-version": "2023-06-01",
                  },
                  body: JSON.stringify({
                    model: "claude-sonnet-4-5",
                    max_tokens: 4096,
                    messages,
                    stream: false,
                  }),
                });
                if (!upstream.ok) {
                  const errText = await upstream.text();
                  res.statusCode = upstream.status;
                  res.end(JSON.stringify({ ok: false, error: errText }));
                  return;
                }
                const result = await upstream.json() as any;
                const text = result?.content?.[0]?.text ?? result?.completion ?? JSON.stringify(result);
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ ok: true, text, model: result?.model ?? "owl-alpha" }));
              } catch (err: any) {
                res.statusCode = 500;
                res.end(JSON.stringify({ ok: false, error: err.message }));
              }
            });
          });

          // ──────────────────────────────────────────────────────────────
          // GET /__hermes_mcp_status — check hermes-mcp installation +
          // whether the Hermes gateway is reachable on :8642.
          // ──────────────────────────────────────────────────────────────
          server.middlewares.use("/__hermes_mcp_status", async (req, res, next) => {
            if (req.method !== "GET") return next();
            if (!isLoopback(req)) { res.statusCode = 403; res.end("{}"); return; }
            try {
              let mcpInstalled = false;
              let gatewayReachable = false;
              // Check if hermes-mcp binary is on PATH
              try {
                execSync("hermes-mcp --version", { stdio: "pipe", timeout: 3000 });
                mcpInstalled = true;
              } catch {
                // try pipx / local install paths
                const candidates = [
                  join(homedir(), ".local", "bin", "hermes-mcp"),
                  "/opt/homebrew/bin/hermes-mcp",
                  "/usr/local/bin/hermes-mcp",
                ];
                mcpInstalled = candidates.some((p) => existsSync(p));
              }
              // Probe the Hermes gateway (default port 8642)
              try {
                const ctrl = new AbortController();
                const t = setTimeout(() => ctrl.abort(), 1200);
                const probe = await fetch("http://127.0.0.1:8642/health", { signal: ctrl.signal });
                clearTimeout(t);
                gatewayReachable = probe.ok || probe.status < 500;
              } catch { /* gateway offline */ }
              res.setHeader("Content-Type", "application/json");
              res.setHeader("Cache-Control", "no-store");
              res.end(JSON.stringify({ mcpInstalled, gatewayReachable }));
            } catch (err: any) {
              res.end(JSON.stringify({ mcpInstalled: false, gatewayReachable: false, error: err.message }));
            }
          });

          // ──────────────────────────────────────────────────────────────
          // GET /__antigravity_status — check if Antigravity is configured
          // (~/.gemini/antigravity/ exists) and optionally probe the API.
          // ──────────────────────────────────────────────────────────────
          server.middlewares.use("/__antigravity_status", (req, res, next) => {
            if (req.method !== "GET") return next();
            if (!isLoopback(req)) { res.statusCode = 403; res.end("{}"); return; }
            try {
              const home = homedir();
              const agDir = join(home, ".gemini", "antigravity");
              const configured = existsSync(agDir);
              const stateFile = join(agDir, "antigravity_state.pbtxt");
              const hasState = existsSync(stateFile);
              res.setHeader("Content-Type", "application/json");
              res.setHeader("Cache-Control", "no-store");
              res.end(JSON.stringify({ configured, hasState, dir: configured ? agDir : null }));
            } catch (err: any) {
              res.end(JSON.stringify({ configured: false, error: err.message }));
            }
          });

          // ──────────────────────────────────────────────────────────────
          // /__runtime_cli_status?bin=<name> — generic loopback probe used
          // by the Claude Code / HyperFrames / MiniMax pages to verify a
          // CLI is actually installed before claiming it's available. No
          // fake "connected" states — if the binary isn't on PATH and isn't
          // at a common install location, we return { ok: false }.
          // ──────────────────────────────────────────────────────────────
          server.middlewares.use("/__runtime_cli_status", async (req, res, next) => {
            if (req.method !== "GET") return next();
            if (!isLoopback(req)) { res.statusCode = 403; res.end("{}"); return; }
            try {
              const url = new URL(req.url ?? "", "http://localhost");
              const binParam = url.searchParams.get("bin") ?? "";
              const bin = binParam.replace(/[^a-z0-9_-]/gi, "").slice(0, 64);
              if (!bin) {
                res.statusCode = 400; res.end(JSON.stringify({ error: "bin param required" })); return;
              }
              // Probe ALL PATH entries plus the standard local locations
              // claude-os ships into so we don't false-negative on installs
              // outside the dev server's inherited PATH.
              const PATH = (process.env.PATH ?? "").split(":").filter(Boolean);
              const extra = [
                join(homedir(), ".local", "bin"),
                join(homedir(), ".bun", "bin"),
                "/opt/homebrew/bin",
                "/usr/local/bin",
              ];
              let found: string | null = null;
              for (const dir of [...PATH, ...extra]) {
                const candidate = join(dir, bin);
                if (existsSync(candidate)) { found = candidate; break; }
              }
              res.setHeader("Content-Type", "application/json");
              res.setHeader("Cache-Control", "no-store");
              if (!found) {
                res.end(JSON.stringify({ ok: false, bin, found: null, version: null }));
                return;
              }
              // Try to capture a version string but never block on failure —
              // many CLIs have no --version and that's not an error state.
              let version: string | null = null;
              try {
                const { execFileSync } = await import("node:child_process");
                const out = execFileSync(found, ["--version"], { timeout: 1500, stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
                version = out.split("\n")[0]?.slice(0, 120) ?? null;
              } catch { /* no version probe available */ }
              res.end(JSON.stringify({ ok: true, bin, found, version }));
            } catch (err: any) {
              res.statusCode = 500;
              res.end(JSON.stringify({ ok: false, error: err.message }));
            }
          });

          // ──────────────────────────────────────────────────────────────
          // /__maestro_status — read-only snapshot of the Maestro project
          // state in the current working directory. Walt's rule: no fake
          // state. If the maestro CLI is not installed we honestly report
          // that, with a setup-needed hint. If the CLI is installed but the
          // project hasn't been initialised we report that too.
          //
          // /__maestro_exec — POST a whitelisted maestro subcommand and
          // stream stdout/stderr back. Writable commands must explicitly
          // opt in to the allowlist; arbitrary shell coercion is blocked
          // by sanitising every argv slot.
          // ──────────────────────────────────────────────────────────────
          server.middlewares.use("/__maestro_status", async (req, res, next) => {
            if (req.method !== "GET") return next();
            if (!isLoopback(req)) { res.statusCode = 403; res.end("{}"); return; }
            try {
              const url = new URL(req.url ?? "", "http://localhost");
              const cwd = url.searchParams.get("cwd") || process.cwd();
              const { execFileSync } = await import("node:child_process");
              // Locate the binary the same way /__runtime_cli_status does.
              const PATH = (process.env.PATH ?? "").split(":").filter(Boolean);
              const extra = [
                join(homedir(), ".local", "bin"),
                join(homedir(), ".bun", "bin"),
                "/opt/homebrew/bin",
                "/usr/local/bin",
              ];
              let bin: string | null = null;
              for (const dir of [...PATH, ...extra]) {
                const cand = join(dir, "maestro");
                if (existsSync(cand)) { bin = cand; break; }
              }
              const installed = !!bin;
              let version: string | null = null;
              if (installed) {
                try {
                  version = execFileSync(bin!, ["--version"], { timeout: 2000, stdio: ["ignore", "pipe", "ignore"] })
                    .toString().trim().split("\n")[0]?.slice(0, 120) ?? null;
                } catch { /* version probe failed; not fatal */ }
              }
              // Project state — read .maestro/ from the cwd. We don't shell
              // out to maestro for this (faster + survives a missing CLI).
              const maestroDir = join(cwd, ".maestro");
              const project_initialized = existsSync(maestroDir);
              let mission_control: unknown = null;
              if (installed && project_initialized) {
                try {
                  const raw = execFileSync(bin!, ["mission-control", "--json"], {
                    cwd, timeout: 4000, stdio: ["ignore", "pipe", "ignore"],
                  }).toString().trim();
                  if (raw) mission_control = JSON.parse(raw);
                } catch { /* honest null */ }
              }
              res.setHeader("Content-Type", "application/json");
              res.setHeader("Cache-Control", "no-store");
              res.end(JSON.stringify({
                installed,
                bin,
                version,
                cwd,
                project_initialized,
                maestro_dir: project_initialized ? maestroDir : null,
                mission_control,
              }));
            } catch (err: any) {
              res.statusCode = 500;
              res.end(JSON.stringify({ installed: false, error: err.message }));
            }
          });

          // Whitelisted Maestro subcommands. The page passes ONE of these
          // command-keys; the sidecar maps it to argv. No raw user-supplied
          // tokens flow into argv slots.
          const MAESTRO_COMMANDS: Record<string, { argv: string[]; writes: boolean }> = {
            status:            { argv: ["status"], writes: false },
            "task status":     { argv: ["task", "status"], writes: false },
            "mission-control --json":    { argv: ["mission-control", "--json"], writes: false },
            "mission-control --preview": { argv: ["mission-control", "--preview"], writes: false },
            "validate show":   { argv: ["validate", "show"], writes: false },
            "memory-compile":  { argv: ["memory-compile"], writes: false },
            init:              { argv: ["init"], writes: true },
            "task ready":      { argv: ["task", "ready"], writes: true },
            "task claim":      { argv: ["task", "claim"], writes: true },
            "task update":     { argv: ["task", "update"], writes: true },
            handoff:           { argv: ["handoff"], writes: true },
            "handoff pickup":  { argv: ["handoff", "pickup"], writes: true },
            "checkpoint save": { argv: ["checkpoint", "save"], writes: true },
            "memory-correct":  { argv: ["memory-correct"], writes: true },
          };

          server.middlewares.use("/__maestro_exec", async (req, res, next) => {
            if (req.method !== "POST") return next();
            if (!isLoopback(req)) { res.statusCode = 403; res.end("{}"); return; }
            try {
              let raw = "";
              for await (const chunk of req as AsyncIterable<Buffer>) raw += chunk.toString("utf8");
              let body: { command?: string; cwd?: string; args?: string[] } = {};
              try { body = JSON.parse(raw || "{}"); } catch { res.statusCode = 400; res.end(JSON.stringify({ error: "bad_json" })); return; }
              const commandKey = String(body.command ?? "").trim();
              const spec = MAESTRO_COMMANDS[commandKey];
              if (!spec) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: "unknown_command", supported: Object.keys(MAESTRO_COMMANDS) }));
                return;
              }
              // Sanitize any caller-supplied extra args — single token, no
              // shell metachars, max 32 chars each, max 8 tokens.
              const extraArgs = Array.isArray(body.args)
                ? body.args.slice(0, 8).map((a) => String(a).replace(/[^A-Za-z0-9_\-.,@:/=]/g, "").slice(0, 32)).filter(Boolean)
                : [];
              const cwd = typeof body.cwd === "string" && body.cwd.startsWith("/") ? body.cwd : process.cwd();
              const { execFileSync } = await import("node:child_process");
              const PATH = (process.env.PATH ?? "").split(":").filter(Boolean);
              const extra = [
                join(homedir(), ".local", "bin"),
                join(homedir(), ".bun", "bin"),
                "/opt/homebrew/bin",
                "/usr/local/bin",
              ];
              let bin: string | null = null;
              for (const dir of [...PATH, ...extra]) {
                const cand = join(dir, "maestro");
                if (existsSync(cand)) { bin = cand; break; }
              }
              if (!bin) {
                res.statusCode = 503;
                res.end(JSON.stringify({ error: "maestro_not_installed", hint: "Install Maestro then try again." }));
                return;
              }
              try {
                const out = execFileSync(bin, [...spec.argv, ...extraArgs], {
                  cwd, timeout: 30000, stdio: ["ignore", "pipe", "pipe"], maxBuffer: 1024 * 1024,
                }).toString();
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ ok: true, command: commandKey, writes: spec.writes, stdout: out.slice(0, 200_000) }));
              } catch (e: any) {
                res.statusCode = 500;
                res.end(JSON.stringify({
                  ok: false,
                  command: commandKey,
                  error: e.message,
                  stdout: typeof e.stdout === "object" ? Buffer.from(e.stdout).toString().slice(0, 200_000) : null,
                  stderr: typeof e.stderr === "object" ? Buffer.from(e.stderr).toString().slice(0, 200_000) : null,
                }));
              }
            } catch (err: any) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: err.message }));
            }
          });

          // ──────────────────────────────────────────────────────────────
          // /__credentials — Baseline OS local credential store (BYOK).
          //
          // GET    list / get-one (no raw secrets, only masked preview)
          // PUT    /__credentials/<provider_id>  body: { secrets, public_config, mode }
          // DELETE /__credentials/<provider_id>
          //
          // Storage: ~/.claude-os/credentials.local.json (file mode 0600).
          // Loopback-only — the local box owner is the only allowed caller.
          // ──────────────────────────────────────────────────────────────
          server.middlewares.use("/__credentials", async (req, res, next) => {
            if (!isLoopback(req)) { res.statusCode = 403; res.end("{}"); return; }
            try {
              const url = new URL(req.url ?? "", "http://localhost");
              const segs = url.pathname.replace(/^\/__credentials\/?/, "").split("/").filter(Boolean);
              const providerId = segs[0] ?? null;
              const credMod = await import("./src/lib/credentials-local");
              const catalogMod = await import("./src/lib/credentials-catalog");

              const send = (status: number, body: unknown) => {
                res.statusCode = status;
                res.setHeader("Content-Type", "application/json");
                res.setHeader("Cache-Control", "no-store");
                res.end(JSON.stringify(body));
              };

              if (req.method === "GET") {
                if (!providerId) {
                  const rows = credMod.listCredentialsLocal();
                  const byId = new Map(rows.map((r) => [r.provider_id, r]));
                  const providers = catalogMod.PROVIDER_CATALOG.map((p) => ({ ...p, saved: byId.get(p.id) ?? null }));
                  const summary = {
                    total: catalogMod.PROVIDER_CATALOG.length,
                    connected: rows.filter((r) => r.status === "connected").length,
                    pending: rows.filter((r) => r.status === "pending").length,
                    error: rows.filter((r) => r.status === "error").length,
                    missing: catalogMod.PROVIDER_CATALOG.length - rows.length,
                  };
                  return send(200, {
                    encryption_configured: true,
                    storage: { kind: "local_file", path: credMod.CRED_FILE_PATH },
                    summary,
                    providers,
                  });
                }
                if (!catalogMod.getProvider(providerId)) return send(404, { error: "unknown_provider" });
                return send(200, { credential: credMod.getCredentialLocal(providerId) });
              }

              if (req.method === "PUT") {
                if (!providerId) return send(400, { error: "provider_id_required" });
                if (!catalogMod.getProvider(providerId)) return send(404, { error: "unknown_provider" });
                let raw = "";
                for await (const chunk of req as AsyncIterable<Buffer>) raw += chunk.toString("utf8");
                let body: { secrets?: Record<string, string>; public_config?: Record<string, string>; mode?: "bring_your_own_key" | "mission_control_credits" | "both" } = {};
                try { body = JSON.parse(raw || "{}"); } catch { return send(400, { error: "bad_json" }); }
                const view = credMod.upsertCredentialLocal({
                  providerId,
                  secrets: body.secrets ?? {},
                  publicConfig: body.public_config,
                  mode: body.mode,
                });
                return send(200, { credential: view });
              }

              if (req.method === "DELETE") {
                if (!providerId) return send(400, { error: "provider_id_required" });
                const ok = credMod.deleteCredentialLocal(providerId);
                return send(ok ? 200 : 404, { ok });
              }

              return next();
            } catch (err: unknown) {
              res.statusCode = 500;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
            }
          });

          // ──────────────────────────────────────────────────────────────
          // /__notebooklm_status is registered later — see the notebooklm-py
          // CLI bridge block. The older `nlm`-based probe has been retired.

          // ══════════════════════════════════════════════════════════════
          // POST /__agent_run — THE agentic execution engine.
          //
          // For every agent in the dashboard, this endpoint spawns the
          // RIGHT backend CLI (or HTTP API) for that agent, streams its
          // output back as SSE, and lets the agent actually execute
          // tools — file ops, shell, web, skills — via the CLI's own
          // sandbox. No more text-only OpenRouter relay.
          //
          // Body: { agent: string, messages: ChatMessage[], sessionId?: string }
          // Stream: data: { delta: string, done: boolean }
          //         data: { delta: "", done: true, model: string, exit: number }
          //
          // Backend dispatch:
          //   hermes-pantheon → `hermes chat -q "<summon>, <msg>" -Q --yolo`
          //     (covers maggie-walker, robert-smith, rogers-hobson, walter-
          //     thornton, slim-charles, saul, and every persona YAML on disk)
          //   hermes (default) → `hermes chat -q "<msg>" -Q --yolo`
          //   codex            → `codex exec "<msg>"` (real codex CLI)
          //   gemini           → `gemini "<msg>"` (Google Gemini CLI)
          //   notebooklm       → `notebooklm ask "<msg>"` (cited Q&A)
          //   everything else  → `claude -p` with persona-injected
          //     --append-system-prompt-file, --add-dir repo + ~/.claude-os
          //     + ~/.hermes (+ Obsidian vault if configured),
          //     --permission-mode bypassPermissions
          //
          // ══════════════════════════════════════════════════════════════
          interface AgentBackend {
            kind: "hermes-default" | "hermes-persona" | "cli" | "claude-persona" | "codex-persona";
            bin?: string;
            argsFor?: (msg: string) => string[];
            summonPhrase?: string;
            systemPrompt?: string;
            displayModel?: string;
          }
          const HOME = homedir();
          const CLAUDE_BIN = process.env.CLAUDE_BIN
            || (existsSync(join(HOME, ".local/bin/claude")) ? join(HOME, ".local/bin/claude") : "claude");
          const HERMES_BIN = process.env.HERMES_BIN
            || (existsSync(join(HOME, ".local/bin/hermes")) ? join(HOME, ".local/bin/hermes") : "hermes");
          // Read Obsidian vault path so claude-persona agents can write there
          let OBSIDIAN_VAULT: string | null = null;
          try {
            const cfgPath = join(HOME, ".claude-os", "config.json");
            if (existsSync(cfgPath)) {
              const cfg = JSON.parse(readFileSync(cfgPath, "utf-8"));
              if (typeof cfg.obsidianVaultPath === "string" && cfg.obsidianVaultPath.trim()) {
                OBSIDIAN_VAULT = cfg.obsidianVaultPath.trim();
              }
            }
          } catch { /* skip */ }

          // System prompts for agents that fall back to `claude -p`
          const PERSONA_PROMPT_OPENCLAW = `You are OpenClaw — a multi-agent swarm orchestrator. Decompose complex tasks into parallel sub-agents, delegate, then synthesize results. Tools available: Read, Write, Edit, Bash, Glob, Grep, Task, WebFetch, WebSearch. The user's repo is at /Users/walt/code/claude-os. Config: ~/.claude-os/config.json. Hermes Agent on the user's machine handles long-running execution — when a task fits Hermes (cron, kanban, scheduled work), suggest delegating via /__agent_message. Be direct, take action, show your work.`;
          const PERSONA_PROMPT_ANTIGRAVITY = `You are Antigravity — Google's multi-agent code orchestration platform persona. You decompose engineering tasks into parallel sub-agent runs, then validate + integrate. Tools: Read, Write, Edit, Bash, Glob, Grep, Task, WebFetch. Repo: /Users/walt/code/claude-os. Prefer the Task tool for parallel sub-research; prefer Edit over Write for existing files; verify your changes with Bash. End every response with what's done + what's next.`;
          const PERSONA_PROMPT_RUFLO = `You are Ruflo — an AI agent orchestration platform persona (multi-agent swarms, hive-mind coordination, MCP server management). When given a goal: 1) think through the swarm topology (which sub-agents you'd spawn, what each handles), 2) execute the actual work using your tools (Read, Write, Edit, Bash, Glob, Grep, Task, WebFetch), 3) report the result with the swarm rationale alongside. Repo: /Users/walt/code/claude-os.`;
          const PERSONA_PROMPT_CLAUDECLAW = `You are ClaudeClaw — a real-time peer-bus coordinator between multiple AI agents. Your job: take the user's intent, decide which agents in the bus would tackle it best (Hermes for long-running ops, OpenClaw for parallel research, Codex for code generation, Gemini for orchestration planning), then actually execute the work yourself using your tools — don't just hand off, deliver. Tools: Read, Write, Edit, Bash, Glob, Grep, Task, WebFetch. Repo: /Users/walt/code/claude-os.`;
          const PERSONA_PROMPT_FREECLAUDE = `You are Free Claude — the local-first, free-tier Claude persona. Prefer simple, frugal solutions. Tools: Read, Write, Edit, Bash, Glob, Grep. Avoid expensive tool calls when a cheaper one will do. Repo: /Users/walt/code/claude-os.`;
          const PERSONA_PROMPT_HERMES_MCP = `You are the Hermes MCP Loop assistant. You help the user set up, troubleshoot, and use the Hermes MCP bridge — the connector between Claude and Hermes Agent that lets Claude delegate execution to Hermes on the user's machine. Architecture: Brain (Claude) → Bridge (Hermes MCP, OAuth) → Hands (Hermes Agent, tools, this machine). Tools you have: Read, Write, Edit, Bash. The setup wizard lives at /hermes-mcp-loop with scripts at scripts/hermes-mcp-loop-{up,down}.sh and endpoint /__hermes_mcp_loop_status.`;

          // Read every persona YAML on disk and build summon-phrase map.
          // Anything on disk under ~/.hermes/pantheon/personas/<id>.yaml gets
          // routed to `hermes chat -q "<first summon phrase>, <msg>"`.
          // Read a persona YAML's system_prompt + tone for in-line injection.
          // hermes chat -q does NOT auto-load pantheon personas (those are
          // gateway-only routing definitions). To get the persona's voice
          // from the CLI, we wrap the user's message with the persona's
          // system_prompt + identity instructions so Hermes adopts the voice
          // while still running with its REAL tools (file/terminal/web/etc).
          function readPersonaSystemPrompt(id: string): { system: string; tone: string; name: string } | null {
            try {
              const f = join(HOME, ".hermes", "pantheon", "personas", `${id}.yaml`);
              if (!existsSync(f)) return null;
              const raw = readFileSync(f, "utf-8");
              // Tolerant single-key extraction. Captures everything from
              // system_prompt: up to the next top-level key (`skills:` / `tools:` / etc.)
              const sm = raw.match(/^\s*system_prompt:\s*([\s\S]+?)(?=^[a-z_]+:\s*$|^[a-z_]+:\s*\n)/m);
              let sys = "";
              if (sm) {
                sys = sm[1].trim()
                  // Strip YAML block scalar markers
                  .replace(/^[>|][-+]?\s*\n?/, "")
                  // Strip quotes
                  .replace(/^['"]|['"]\s*$/g, "")
                  // Un-escape YAML doubled single-quotes
                  .replace(/''/g, "'");
              }
              const tone = (raw.match(/^\s*tone:\s*(.+)$/m) ?? [, ""])[1].replace(/^['"]|['"]$/g, "").trim();
              const name = (raw.match(/^name:\s*(.+)$/m) ?? [, id])[1].replace(/^['"]|['"]$/g, "").trim();
              return { system: sys, tone, name };
            } catch { return null; }
          }
          function wrapPersonaMessage(personaId: string, userMsg: string): string {
            const p = readPersonaSystemPrompt(personaId);
            if (!p || !p.system) return userMsg;
            return `[ADOPT THIS PERSONA — read the system instructions below and respond as this character. Stay in voice. Use the REAL Hermes Agent tools (file/terminal/web/shell/memory/kanban/browser) when the task needs them. Do not break character to say you're "an AI" or "fictional".]

===== PERSONA SYSTEM PROMPT (you ARE ${p.name}) =====
${p.system}
===== END PERSONA SYSTEM PROMPT =====

[VOICE OVERRIDE: ${p.tone}]

[USER MESSAGE FROM WALT:]
${userMsg}

[YOUR RESPONSE — in ${p.name}'s voice, using Hermes tools as needed. Lead with the answer or next move. No "Sure!" / "Great question!" / "I'd be happy to". End with the next concrete action.]`;
          }

          function buildHermesPersonaBackends(): Record<string, AgentBackend> {
            const out: Record<string, AgentBackend> = {};
            try {
              const dir = join(HOME, ".hermes", "pantheon", "personas");
              if (!existsSync(dir)) return out;
              for (const f of readdirSync(dir)) {
                if (!f.endsWith(".yaml")) continue;
                const id = f.replace(/\.yaml$/, "");
                try {
                  const raw = readFileSync(join(dir, f), "utf-8");
                  // Tolerant summon-phrase extraction — find first list item under summon_phrases:
                  const m = raw.match(/summon_phrases:\s*(?:\r?\n\s*-\s*([^\r\n]+))?/);
                  const summon = (m && m[1]) ? m[1].replace(/^['"]|['"]$/g, "").trim() : id;
                  out[id] = { kind: "hermes-persona", summonPhrase: summon, displayModel: `hermes/${id}` };
                } catch { /* skip bad YAML */ }
              }
            } catch { /* skip */ }
            return out;
          }

          const AGENT_BACKENDS: Record<string, AgentBackend> = {
            // Default Hermes agent page (no persona prefix)
            "hermes":          { kind: "hermes-default", displayModel: "hermes" },
            // Native CLIs
            "codex":           { kind: "cli", bin: "codex",       argsFor: (m) => ["exec", "--skip-git-repo-check", "--dangerously-bypass-approvals-and-sandbox", m], displayModel: "codex-cli" },
            // Claude Code CLI — the real `claude` binary, same non-interactive
            // pattern as Codex. -p sends the prompt, --dangerously-skip-permissions
            // avoids the interactive approval prompt. Falls back gracefully if
            // the CLI isn't on PATH (the spawn error surfaces in the SSE stream).
            "claude-code":     { kind: "cli", bin: "claude",      argsFor: (m) => ["-p", m, "--dangerously-skip-permissions"], displayModel: "claude-code-cli" },
            "gemini":          { kind: "cli", bin: "gemini",      argsFor: (m) => [m],             displayModel: "gemini" },
            "notebooklm":      { kind: "cli", bin: "notebooklm",  argsFor: (m) => ["ask", m],      displayModel: "notebooklm" },
            // Google Antigravity (`agy --print`) — installed via
            // `brew install antigravity-cli`. The binary lands at /opt/
            // homebrew/bin/agy (the original `antigravity` is symlinked
            // away by Homebrew to avoid clashing with Python's antigravity
            // module). Non-interactive: `agy --print "<prompt>"
            // --dangerously-skip-permissions --add-dir <repo>`.
            "antigravity":     { kind: "cli", bin: "agy",
              argsFor: (m) => ["--print", m, "--dangerously-skip-permissions", "--add-dir", process.cwd()],
              displayModel: "antigravity" },
            // Claude-persona fallbacks (real agentic execution via Claude CLI)
            // OpenClaw runs through the Codex CLI. The model ID is env-driven
            // so we never ship a placeholder identifier; CODEX_MODEL overrides
            // the documented fallback below. Walt's rule: "Remove placeholder
            // model identifiers." Until a sync against OpenRouter's catalogue
            // confirms a current OpenAI default, gpt-4o is the safest known-
            // real model id we can fall back to.
            "openclaw":        { kind: "codex-persona",  systemPrompt: PERSONA_PROMPT_OPENCLAW,    displayModel: `openai/${process.env.CODEX_MODEL || "gpt-4o"}` },
            "ruflo":           { kind: "claude-persona", systemPrompt: PERSONA_PROMPT_RUFLO,       displayModel: "claude/ruflo" },
            "claudeclaw":      { kind: "claude-persona", systemPrompt: PERSONA_PROMPT_CLAUDECLAW,  displayModel: "claude/claudeclaw" },
            "free-claude":     { kind: "claude-persona", systemPrompt: PERSONA_PROMPT_FREECLAUDE,  displayModel: "claude/free" },
            "hermes-mcp":      { kind: "claude-persona", systemPrompt: PERSONA_PROMPT_HERMES_MCP,  displayModel: "claude/hermes-mcp" },
            // Hermes pantheon — all persona YAMLs on disk (Maggie, Robert,
            // Rogers&Hobson, Walter Thornton, plus every other persona)
            ...buildHermesPersonaBackends(),
          };

          server.middlewares.use("/__agent_run", async (req, res) => {
            if (req.method !== "POST") { res.statusCode = 405; res.end("POST only"); return; }
            if (!isLoopback(req)) { res.statusCode = 403; res.end("loopback only"); return; }
            let body = "";
            req.on("data", (c: Buffer) => { body += c.toString(); });
            req.on("end", async () => {
              let parsed: { agent?: string; messages?: { role: string; content: string }[]; sessionId?: string };
              try { parsed = JSON.parse(body); } catch { res.statusCode = 400; res.end(`{"error":"invalid JSON"}`); return; }
              const agentId = String(parsed.agent ?? "").trim();
              const userMsg = (parsed.messages ?? []).filter((m) => m.role === "user").pop()?.content ?? "";
              if (!agentId || !userMsg) { res.statusCode = 400; res.end(`{"error":"agent + at least one user message required"}`); return; }

              // ── Graphify runtime brain (Phase 4.5) ──────────────────────
              // PI Agent step: query the codebase graph for this task and INJECT
              // the located file slice as a system message BEFORE the agent runs
              // (graph-first; avoids whole-repo scans). Optional + non-fatal.
              let graphCtx: { files: string[]; confidence: number; nodes: number } | null = null;
              try {
                const gp = join(process.cwd(), "graphify-out", "graph.json");
                if (existsSync(gp)) {
                  const g = JSON.parse(readFileSync(gp, "utf8")) as { nodes: { path: string }[] };
                  const terms = userMsg.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 2);
                  const ranked = g.nodes
                    .map((n) => ({ p: n.path, s: terms.reduce((a, t) => a + (n.path.toLowerCase().includes(t) ? 2 : 0), 0) }))
                    .filter((x) => x.s > 0).sort((a, b) => b.s - a.s).slice(0, 12).map((x) => x.p);
                  if (ranked.length) {
                    graphCtx = { files: ranked, confidence: Math.min(1, ranked.length / 8), nodes: ranked.length };
                    parsed.messages = [
                      { role: "system", content: `Graphify (structural brain) located these files for the task — open ONLY these unless insufficient:\n${ranked.map((f) => "- " + f).join("\n")}\nDo not scan the whole repository.` },
                      ...(parsed.messages ?? []),
                    ];
                  }
                }
              } catch { /* graph optional — fall back to a normal run */ }

              res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
              res.setHeader("Cache-Control", "no-cache, no-transform");
              res.setHeader("X-Accel-Buffering", "no");
              res.flushHeaders?.();
              const send = (obj: any): void => { try { res.write(`data: ${JSON.stringify(obj)}\n\n`); } catch { /* connection closed */ } };
              // Surface structural awareness to the client (Agent Activity panel).
              if (graphCtx) send({ graph: graphCtx });

              const cfg = AGENT_BACKENDS[agentId];
              if (!cfg) {
                send({ delta: `Agent "${agentId}" is not wired into /__agent_run yet. Add it to AGENT_BACKENDS in vite.config.ts.`, done: true, model: "none" });
                return res.end();
              }

              // Resolve bin + args
              let bin = "", args: string[] = [];
              const env = { ...process.env, FORCE_COLOR: "0", NO_COLOR: "1" };
              let cleanupTmp: string | null = null;
              try {
                switch (cfg.kind) {
                  case "hermes-default": {
                    bin = HERMES_BIN;
                    args = ["chat", "-q", userMsg, "-Q", "--yolo"];
                    if (parsed.sessionId) args.push("--resume", parsed.sessionId);
                    break;
                  }
                  case "hermes-persona": {
                    bin = HERMES_BIN;
                    // Persona is activated by INJECTING the full system_prompt
                    // from the YAML into the user message body. hermes chat -q
                    // doesn't auto-load pantheon personas; the gateway routes
                    // by channel_prompts but the CLI doesn't, so we forward
                    // the persona instructions inline.
                    const wrapped = wrapPersonaMessage(agentId, userMsg);
                    args = ["chat", "-q", wrapped, "-Q", "--yolo"];
                    if (parsed.sessionId) args.push("--resume", parsed.sessionId);
                    break;
                  }
                  case "cli": {
                    bin = cfg.bin!;
                    args = cfg.argsFor!(userMsg);
                    break;
                  }
                  case "codex-persona": {
                    bin = "codex";
                    const prompt = `${cfg.systemPrompt ?? ""}\n\nUSER MESSAGE:\n${userMsg}`;
                    // Audit fix: model id was hardcoded to "gpt-5.5" which is
                    // not a known current OpenAI model. Read from CODEX_MODEL
                    // env with a known-real fallback so the runtime never
                    // ships a placeholder identifier.
                    const codexModel = (process.env.CODEX_MODEL || "gpt-4o").trim();
                    args = [
                      "exec",
                      "--model", codexModel,
                      "--json",
                      "--skip-git-repo-check",
                      "--dangerously-bypass-approvals-and-sandbox",
                      prompt,
                    ];
                    break;
                  }
                  case "claude-persona": {
                    bin = CLAUDE_BIN;
                    // stream-json + verbose + include-partial-messages → we
                    // get session_id at start, tool_use as structured events,
                    // tool_result events, and char-by-char text deltas. This
                    // is what makes tool-use visible in the chat UI.
                    args = ["-p", userMsg,
                      "--output-format", "stream-json",
                      "--verbose",
                      "--include-partial-messages",
                      "--add-dir", process.cwd(),
                      "--add-dir", join(HOME, ".claude-os"),
                      "--add-dir", join(HOME, ".hermes"),
                      "--permission-mode", "bypassPermissions",
                    ];
                    if (OBSIDIAN_VAULT) args.push("--add-dir", OBSIDIAN_VAULT);
                    if (cfg.systemPrompt) {
                      const tmpFile = join("/tmp", `agentos-persona-${agentId}-${Date.now()}.md`);
                      writeFileSync(tmpFile, cfg.systemPrompt, "utf-8");
                      cleanupTmp = tmpFile;
                      args.push("--append-system-prompt-file", tmpFile);
                    }
                    if (parsed.sessionId) args.push("--resume", parsed.sessionId);
                    break;
                  }
                }

                const { spawn } = await import("node:child_process");
                const cp = spawn(bin, args, { cwd: process.cwd(), env, stdio: ["pipe", "pipe", "pipe"] });
                // Close stdin so CLIs that wait for piped input (codex exec,
                // claude -p) don't stall and don't emit "no stdin in 3s" noise.
                try { cp.stdin?.end(); } catch { /* skip */ }
                let killed = false;
                const killTimer = setTimeout(() => {
                  killed = true;
                  send({ delta: "\n\n[timeout — agent killed after 5 minutes]\n", done: false });
                  try { cp.kill("SIGTERM"); } catch { /* skip */ }
                }, 5 * 60_000);

                // Two parsers, picked by backend kind:
                //  · claude-persona → newline-delimited JSON from
                //    `--output-format stream-json`. We extract session_id,
                //    text deltas, tool_use start, and tool_result events
                //    and emit them as structured SSE so the UI can render
                //    tool chips ("✦ Write(/tmp/x.md) · done").
                //  · everything else → raw stdout/stderr with a small noise
                //    filter (Hermes session_id line, codex decoration,
                //    Claude's "no stdin in 3s" warning).
                const NOISE = [
                  /^Warning: no stdin data received in 3s.*$/m,
                  /^\s*--------\s*$/m,
                  /^\s*tokens used\s*$/m,
                  /^\s*\d[\d,]*\s*$/m,                       // bare token counts on their own line
                  // Codex startup banner — the metadata block users
                  // shouldn't see bleeding into chat:
                  //   Reading additional input from stdin...
                  //   OpenAI Codex v0.133.0
                  //   workdir: ...
                  //   model: gpt-5.5
                  //   provider: openai
                  //   approval: never
                  //   sandbox: danger-full-access
                  //   reasoning effort: medium
                  //   reasoning summaries: none
                  //   session id: 019e7b61-...
                  /^Reading additional input from stdin\.{3}\s*\n?/m,
                  /^OpenAI Codex v[\d.]+\s*\n?/m,
                  /^workdir:\s.*\n?/m,
                  /^model:\s+[\w./-]+\s*\n?/m,
                  /^provider:\s+\w+\s*\n?/m,
                  /^approval:\s+\w+\s*\n?/m,
                  /^sandbox:\s+[\w-]+\s*\n?/m,
                  /^reasoning effort:\s+\w+\s*\n?/m,
                  /^reasoning summaries:\s+\w+\s*\n?/m,
                  /^session id:\s+[a-f0-9-]+\s*\n?/m,
                  // Gemini CLI banner — Node deprecation warnings, hook init,
                  // env var disambiguation. None of it belongs in the chat UI.
                  /^\(node:\d+\)\s+\[DEP\d+\][^\n]*\n?/m,
                  /^\(Use `node --trace-deprecation[^\n]*\n?/m,
                  /^Hook registry initialized with \d+ hook entries\s*\n?/m,
                  /^Both GOOGLE_API_KEY and GEMINI_API_KEY are set[^\n]*\n?/m,
                  // Hermes CLI session-id leak that survives the structured emitSessionOnce
                  /^session_id:\s+\S+\s*\n?/m,
                ];
                let sessionEmitted = false;
                function emitSessionOnce(id: string | undefined): void {
                  if (!id || sessionEmitted) return;
                  sessionEmitted = true;
                  send({ sessionId: id });
                }

                function filterAndForward(raw: string, _fromStderr: boolean): void {
                  let s = raw;
                  // Pull out Hermes session_id and emit as a separate event for client resume
                  const sm = s.match(/(?:^|\n)session_id:\s*([A-Za-z0-9_\-]+)/);
                  if (sm) {
                    emitSessionOnce(sm[1]);
                    s = s.replace(/(?:^|\n)session_id:\s*[A-Za-z0-9_\-]+\n?/g, "");
                  }
                  for (const re of NOISE) s = s.replace(re, "");

                  // Codex CLI emits, in separate SSE chunks:
                  //   1.  "user\n<echoed query>\n"            ← drop entire chunk
                  //   2.  "codex\n<actual response>\n"        ← drop the leading "codex\n"
                  //   3.  "<actual response>\n"               ← keep
                  // Plus same-chunk variants. Strip in this order:
                  s = s.replace(/^\s*user\s*\n[\s\S]*?\ncodex\s*\n/, "");  // same-chunk pair
                  if (/^\s*user\s*\n/.test(s)) return;                      // entire chunk is just the echo
                  s = s.replace(/^codex\s*\n/, "");                         // standalone "codex\n" line at start

                  if (s.trim().length === 0) return;
                  send({ delta: s, done: false });
                }

                // ── Claude stream-json parser (claude-persona only) ──
                let jsonLineBuf = "";
                function handleClaudeEvent(evt: any): void {
                  if (!evt || typeof evt !== "object") return;
                  if (typeof evt.session_id === "string") emitSessionOnce(evt.session_id);

                  // Partial text deltas (one char/word at a time)
                  if (evt.type === "stream_event" && evt.event) {
                    const ev = evt.event;
                    if (ev.type === "content_block_delta") {
                      if (ev.delta?.type === "text_delta" && typeof ev.delta.text === "string") {
                        send({ delta: ev.delta.text, done: false });
                      }
                      // input_json_delta accumulates tool input JSON — skip for now,
                      // we read the final input from the assistant message event below.
                    } else if (ev.type === "content_block_start" && ev.content_block?.type === "tool_use") {
                      send({ tool: { id: ev.content_block.id, name: ev.content_block.name, status: "running" }, done: false });
                    }
                    return;
                  }

                  // Final assistant message — emits the parsed tool_use input
                  if (evt.type === "assistant" && evt.message?.content) {
                    for (const block of evt.message.content) {
                      if (block.type === "tool_use") {
                        // Trim large inputs for transport
                        const inputStr = JSON.stringify(block.input ?? {});
                        send({
                          tool: {
                            id: block.id,
                            name: block.name,
                            status: "input-complete",
                            input: inputStr.length > 1200 ? inputStr.slice(0, 1200) + "…" : block.input,
                          },
                          done: false,
                        });
                      }
                    }
                    return;
                  }

                  // Tool result coming back to the model — surface it to the UI
                  if (evt.type === "user" && evt.message?.content) {
                    for (const block of evt.message.content) {
                      if (block.type === "tool_result") {
                        const raw = typeof block.content === "string"
                          ? block.content
                          : Array.isArray(block.content)
                            ? block.content.map((c: any) => c?.text ?? JSON.stringify(c)).join("\n")
                            : JSON.stringify(block.content);
                        send({
                          tool: {
                            id: block.tool_use_id,
                            status: block.is_error ? "error" : "complete",
                            result: raw.length > 1500 ? raw.slice(0, 1500) + "…" : raw,
                          },
                          done: false,
                        });
                      }
                    }
                    return;
                  }

                  // Final result event — could surface usage if useful
                  if (evt.type === "result") {
                    // Pass through total cost / duration as metadata for the UI footer
                    send({
                      meta: {
                        durationMs: evt.duration_ms,
                        totalCostUsd: evt.total_cost_usd,
                        numTurns: evt.num_turns,
                      },
                    });
                  }
                }

                function parseClaudeStreamJson(raw: string): void {
                  jsonLineBuf += raw;
                  // stream-json is line-delimited JSON; split on \n, keep tail
                  const lines = jsonLineBuf.split("\n");
                  jsonLineBuf = lines.pop() ?? "";
                  for (const line of lines) {
                    const t = line.trim();
                    if (!t) continue;
                    try { handleClaudeEvent(JSON.parse(t)); }
                    catch { /* incomplete or non-JSON line — skip */ }
                  }
                }

                let codexJsonLineBuf = "";
                function parseCodexJson(raw: string): void {
                  codexJsonLineBuf += raw;
                  const lines = codexJsonLineBuf.split("\n");
                  codexJsonLineBuf = lines.pop() ?? "";
                  for (const line of lines) {
                    const t = line.trim();
                    if (!t || !t.startsWith("{")) continue;
                    try {
                      const evt = JSON.parse(t);
                      if (evt.type === "thread.started" && typeof evt.thread_id === "string") {
                        emitSessionOnce(evt.thread_id);
                      }
                      if (
                        evt.type === "item.completed"
                        && evt.item?.type === "agent_message"
                        && typeof evt.item.text === "string"
                      ) {
                        send({ delta: evt.item.text, done: false });
                      }
                      if (evt.type === "turn.completed" && evt.usage) {
                        send({ meta: { numTurns: 1 } });
                      }
                    } catch { /* skip malformed JSON/noise */ }
                  }
                }

                const useClaudeStreamJson = cfg.kind === "claude-persona";
                const useCodexJson = cfg.kind === "codex-persona";
                cp.stdout.on("data", (d: Buffer) => {
                  const s = d.toString("utf-8");
                  if (useClaudeStreamJson) parseClaudeStreamJson(s);
                  else if (useCodexJson) parseCodexJson(s);
                  else filterAndForward(s, false);
                });
                cp.stderr.on("data", (d: Buffer) => {
                  // claude-persona writes only stream-json to stdout; stderr is real errors.
                  // For non-claude backends, treat stderr same as stdout (Hermes/codex
                  // sometimes write benign progress markers there).
                  filterAndForward(d.toString("utf-8"), true);
                });
                cp.on("close", (code: number | null) => {
                  clearTimeout(killTimer);
                  if (cleanupTmp) { try { unlinkSync(cleanupTmp); } catch { /* skip */ } }
                  if (!killed) send({ delta: "", done: true, model: cfg.displayModel ?? agentId, exit: code ?? -1 });
                  res.end();
                });
                cp.on("error", (e: Error) => {
                  clearTimeout(killTimer);
                  const hint = (e as NodeJS.ErrnoException).code === "ENOENT"
                    ? `\n[fatal] "${bin}" not found on PATH. Install it (e.g. brew install ${cfg.bin ?? bin}) or set its env override.\n`
                    : `\n[fatal] ${e.message}\n`;
                  send({ delta: hint, done: true, model: cfg.displayModel ?? agentId, exit: -1 });
                  res.end();
                });
              } catch (e) {
                if (cleanupTmp) { try { unlinkSync(cleanupTmp); } catch { /* skip */ } }
                send({ delta: `\n[fatal] ${String(e)}\n`, done: true, model: cfg.displayModel ?? agentId, exit: -1 });
                res.end();
              }
            });
          });

          // ══════════════════════════════════════════════════════════════
          // POST /__ai_chat — Legacy streaming chat endpoint (OpenRouter).
          // KEPT as-is for back-compat, but the FullChat component now
          // routes through /__agent_run by default. This stays in place
          // so older callers (skills.tsx ad-hoc chats, etc.) keep working.
          // ══════════════════════════════════════════════════════════════
          // POST /__ai_chat — Universal streaming chat endpoint.
          // Routes to the right provider based on "agent" field.
          // All agents use OpenRouter (key from env or .env.local).
          // Returns SSE: data: {"delta":"...", "done":false}
          //             data: {"delta":"", "done":true, "model":"..."}
          // ══════════════════════════════════════════════════════════════
          server.middlewares.use("/__ai_chat", async (req, res, next) => {
            if (req.method !== "POST") return next();
            if (!isLoopback(req)) {
              res.statusCode = 403;
              res.end(JSON.stringify({ error: "loopback only" }));
              return;
            }

            // Read body
            let body = "";
            req.on("data", (chunk: Buffer) => { body += chunk.toString(); });
            req.on("end", async () => {
              try {
                const parsed = JSON.parse(body);
                const { agent, messages = [], stream = true } = parsed;

                // Load OpenRouter key from env or .env.local
                let orKey = process.env.OPENROUTER_API_KEY ?? "";
                if (!orKey) {
                  // Try reading from .env.local
                  try {
                    const envPath = resolve(__dirname, ".env.local");
                    if (existsSync(envPath)) {
                      const envText = readFileSync(envPath, "utf-8");
                      const m = envText.match(/OPENROUTER_API_KEY=(.+)/);
                      if (m) orKey = m[1].trim();
                    }
                  } catch { /* ignore */ }
                }

                // Agent → model + system prompt routing
                // All Claude agents use claude-opus-4-7 — the most capable model
                const SHARED_SKILLS_NOTE = `

SHARED SKILLS: You have access to a 155-skill agency knowledge base at ~/.claude-os/skills/ with a master index at ~/.claude-os/skills/SKILL_INDEX.json. It covers PropControl pipelines (24-pipeline-locked-reference is the master), 3D rendering, MLOps, creative production, agentic-os orchestration, propcontrol ops doctrine, and dozens of productivity skills (airtable, etc.). When the user describes a task, scan SKILL_INDEX.json first — if a matching skill exists, route to that SKILL.md and execute without re-discovery. The list is also browsable in the dashboard at /library.

MEMORY LAYERS — you have TWO long-term memory brains. Use them deliberately:

1. OBSIDIAN VAULT (file-based) — for personal/operator memory: Goals, Journal, Guide, chat logs. Writes via /__obsidian_write to {vault}/Baseline Automations/. Best for: daily notes, voice-captured thoughts, durable personal data the operator owns offline.

2. NOTION (cloud-based, "Slim Charles Memory Layer" integration) — for agent-shared structured memory: project briefs, research notes, agent reports, links to docs. Writes via /__notion_page POST. Reads via /__notion_search POST (body: { query, filter:{ value:"page"|"database" }}) and /__notion_page?id=<id> GET. The operator picks an Baseline Automations root page (stored at ~/.claude-os/config.json → notionRootPageId); new pages land under it. Existing relevant pages include "PropControl Baseline Automations Memory", "AI Agent Factory Repos + Full Stack Architecture", "Spec Kit Agent Factory Setup". Best for: cross-agent handoffs, structured project docs, anything the operator might browse in Notion later.

ROUTING RULE: personal/daily/voice → Obsidian. Structured/cross-agent/shareable → Notion. When in doubt, write to both.

CROSS-AGENT BUS (Maestro): post or read peer messages via /__agent_message. POST { from, to, subject, body } to send. GET ?to=<self>&since=<ms> to read. Use this when a task needs another agent's specialty (e.g. Gemini → Hermes for long-running orchestration, OpenClaw → Studio for creative briefs).

BROWSER AUTOMATION (Ai-agent-harness-browser-use): POST /__browser_use { task, agent? } drives a real Chromium via browser-use. Use this for: form filling, login flows, scraping interactive sites, multi-page workflows. If the local service isn't running on :8000, the endpoint returns setup instructions.

PINECONE LONG-TERM MEMORY (the third brain — infinite, semantic):
  POST /__pinecone_query  { text, topK? }  → semantic search across permanent memory
  POST /__pinecone_upsert { text, metadata? }  → store a memory permanently
  Use this for: cross-session knowledge that must survive context resets, recall by meaning not keyword, long horizon project state. The user has hundreds of past memories already indexed — search before answering anything that sounds like prior knowledge.

NOTEBOOKLM (cited research brain): GET /__notebooklm_list returns the user's NotebookLM notebooks. POST /__notebooklm_query { notebookId, question } returns a cited answer. Use this when the user references "my notebook", "my research", or asks anything that needs grounded citations from their own sources. The Antigravity meeting-prep skill (in the shared library) chains this with web research.

LOCAL GEMMA 4 (free + private): POST /__ollama_chat { model, messages } streams from Ollama on 127.0.0.1:11434. Default model: gemma4:31b. Use this for: prototyping, cheap iteration, offline work, anything that doesn't need a frontier model. GET /__ollama_status to check availability + list installed models.

TRIAD WORKFLOW (Opus / DeepSeek / GPT council): For high-stakes work, run the 3-model council — you (Opus) interrogate + brief, DeepSeek grinds in parallel, GPT critiques, you validate. This is the meta — use it when one model alone isn't enough. Hand brief to peer via /__agent_message.

3-BRAIN MEMORY MODEL: Identity (~/.claude/CLAUDE.md global) · Project (project-folder CLAUDE.md + memory/) · Archived (Pinecone + Notion + Obsidian). Always check the right brain for the right context before re-discovering.

CODEX + GEMINI CLI: User has @openai/codex and @google/gemini-cli installed and registered as Claude plugins. You can /plugin install codex@openai-codex and use Gemini CLI multimodal directly inside this session.`;
                const AGENT_CONFIG: Record<string, { model: string; system: string }> = {
                  gemini: {
                    model: "google/gemini-3.5-flash",
                    system: `You are Gemini 3.5 Flash — the lead orchestrator inside this Baseline Automations. Google DeepMind's fastest frontier model with a 1M-token context window. Be helpful, precise, and decisive.

PRIMARY ROLE — HIGGSFIELD SUPERCOMPUTER ORCHESTRATOR
You are the designated lead for Higgsfield Supercomputer work (image + video generation). When the operator briefs a shoot, campaign, or creative project, produce a runnable orchestration plan:
  1. Shot list (3-5 numbered shots, clear creative intent each)
  2. Per-shot model routing across the Higgsfield catalog:
     - Soul → character continuity / identity-locked portraits
     - Nano Banana → image editing / variation / inpaint
     - Seedance → motion / dance / kinetic video
     - Kling → cinematic narrative video
     - Marketing Studio → product / ad-creative
  3. Full generation prompts (subject, style, lighting, mood, composition, palette, lens, aspect)
  4. Exact higgsfield CLI commands (group parallel-safe vs sequential)
  5. Handoff suggestions to OpenClaw (channels/posting) and Hermes (long-running pipelines)
  6. Quality gates between shots

HIGGSFIELD CONNECTION CONTEXT
  - MCP endpoint: https://mcp.higgsfield.ai/mcp (OAuth device flow, discovery at /.well-known/oauth-protected-resource)
  - CLI: 'npm install -g @higgsfield/cli && higgsfield auth login'
  - Operator's device-auth URL is available; assume the user has it ready.

WHEN NOT DOING HIGGSFIELD WORK
General-purpose helper: reasoning, coding, analysis, long documents. Stay in orchestrator mode — break complex requests into numbered steps with clear handoffs. Lean on the shared skill library (see SHARED SKILLS below) before re-discovering anything.`,
                  },
                  antigravity: {
                    model: "google/gemini-3.5-flash",
                    system: "You are an AI agent orchestrator powered by Gemini 3.5 Flash running inside the Hermes MCP Loop Architecture. You can decompose complex goals into parallel subagent tasks, build HTML/code, research, write, and execute multi-step workflows. When given a goal, think step by step, identify subtasks, and execute them. Always save outputs as described.",
                  },
                  openclaw: {
                    model: "anthropic/claude-sonnet-4-6",
                    system: "You are OpenClaw, an autonomous multi-agent system. You spawn parallel sub-agents to tackle coding tasks: refactoring, code review, test writing, bug hunting, repo indexing, and migrations. You're precise, technical, and action-oriented. Break complex tasks into parallel workstreams and execute them thoroughly.",
                  },
                  "free-claude": {
                    // This route is now Gemma 4 via local Ollama. The /agents/free-claude
                    // page calls /__ollama_chat directly, so this OpenRouter fallback is
                    // only used if something else hits the /__ai_chat router with agent="free-claude".
                    model: "google/gemma-2-27b-it",
                    system: "You are Gemma — a frontier open-source model. The user prefers to run you locally via Ollama for $0/forever and full privacy. The dashboard's /agents/free-claude page is your real chat surface; this OpenRouter route is just a fallback.",
                  },
                  "hermes-mcp": {
                    model: "anthropic/claude-sonnet-4-6",
                    system: "You are helping the user set up and use the Hermes MCP bridge — the connector between Claude and Hermes Agent. You understand the Hermes MCP Loop architecture. Help the user configure, troubleshoot, and use the bridge effectively.",
                  },
                  ruflo: {
                    model: "anthropic/claude-sonnet-4-6",
                    system: "You are Ruflo, a multi-model AI agent orchestration system. You have access to 200+ tools across content creation, research, code review, security scanning, and documentation. You can spawn multiple specialized subagents, manage memory, and automate complex workflows. When given a task, think about which tools and subagents would be most effective, then execute. Be direct and action-oriented.",
                  },
                  codex: {
                    model: "anthropic/claude-sonnet-4-6",
                    system: `You are Codex, an elite AI coding agent AND the lead driver for browser automation in this OS.

PRIMARY ROLES
1. Coding: production-quality code, debug, architect systems, review PRs, write tests, build apps. Think like a senior engineer — plan, write clean code, handle edges, explain decisions.
2. Browser automation lead: when the operator needs a website driven (login flows, form filling, scraping, multi-step workflows), you are the preferred driver. Use POST /__browser_use { task, agent: "codex" } and produce a precise, step-by-step task description (numbered, with explicit selectors when known). You are better than the other agents at this because: terse instructions, exact element identifiers, no narration.

BROWSER-USE TASK FORMAT
Bad: "Go to amazon and find a mouse"
Good: "1. Navigate to amazon.com. 2. Type 'wireless mouse' into the search input (id=twotabsearchtextbox). 3. Press Enter. 4. Sort by 'Avg. Customer Review'. 5. Extract title + price + rating of the top 3 results. 6. Return as JSON."

You can work in any language or framework.`,
                  },
                  seo: {
                    model: "anthropic/claude-sonnet-4-6",
                    system: "You are an elite SEO content strategist and writer. You create high-ranking, engaging content that ranks on Google and converts readers. You understand E-E-A-T, semantic SEO, topical authority, and content strategy. You write articles that are genuinely helpful, not just keyword-stuffed. You can do keyword research, content planning, on-page optimization, meta descriptions, and full content creation.",
                  },
                  studio: {
                    model: "anthropic/claude-sonnet-4-6",
                    system: "You are a creative AI studio assistant. You excel at creative writing, copywriting, brand storytelling, script writing, content strategy, and creative direction. You understand visual language, narrative structure, brand voice, and audience psychology. You help create compelling image generation prompts, video scripts, voice scripts, ad copy, and creative campaigns.",
                  },
                  ollama: {
                    model: parsed.model ?? "qwen2.5:7b",
                    system: "You are a helpful AI assistant running locally via Ollama.",
                  },
                };

                const config = AGENT_CONFIG[agent];
                if (!config) {
                  res.statusCode = 400;
                  res.end(JSON.stringify({ error: `Unknown agent: ${agent}` }));
                  return;
                }

                // ─── Persistent per-agent memory injection ─────────────────
                // Reads ~/.claude-os/memories/<agent>.jsonl and prepends a
                // compact recall block to the system prompt so the agent
                // remembers prior turns even across browser reloads / app
                // restarts. Also appends the current user turn immediately so
                // a follow-up question recalls it.
                let memoryRecall = "";
                try {
                  const memDirSetup = join(homedir(), ".claude-os", "memories");
                  if (!existsSync(memDirSetup)) mkdirSync(memDirSetup, { recursive: true });
                  const memFile = join(memDirSetup, agent.replace(/[^a-zA-Z0-9_-]/g, "_") + ".jsonl");
                  if (existsSync(memFile)) {
                    const lines = readFileSync(memFile, "utf8").trim().split("\n").filter(Boolean);
                    const recent = lines.slice(-30);
                    const facts: string[] = [];
                    for (const l of recent) {
                      try {
                        const e = JSON.parse(l) as { ts?: string; role?: string; summary?: string; content?: string };
                        const text = (e.summary || e.content || "").toString().slice(0, 280);
                        if (text.trim()) facts.push(`[${(e.ts || "").slice(0,16)}] ${e.role}: ${text}`);
                      } catch { /* skip */ }
                    }
                    if (facts.length > 0) {
                      memoryRecall = `\n\nMEMORY RECALL — last ${facts.length} turns the operator had with you (be consistent with these facts; do not contradict, do not fabricate beyond them):\n${facts.join("\n")}\n`;
                    }
                  }
                  // Append the current user turn synchronously so the next ask
                  // recalls it even if the model dies mid-stream.
                  const lastUserMsg = (messages as Array<{ role: string; content: string }>).slice().reverse().find((m) => m.role === "user");
                  if (lastUserMsg?.content) {
                    appendFileSync(memFile, JSON.stringify({
                      ts: new Date().toISOString(),
                      role: "user",
                      content: lastUserMsg.content.slice(0, 2000),
                    }) + "\n");
                  }
                  // Stash a writer for the assistant turn so the stream close
                  // path can persist the reply summary.
                  (req as any).__memWrite = (replyText: string) => {
                    try {
                      const summary = replyText.replace(/\s+/g, " ").trim().slice(0, 280);
                      if (summary) appendFileSync(memFile, JSON.stringify({
                        ts: new Date().toISOString(),
                        role: "assistant",
                        summary,
                      }) + "\n");
                    } catch { /* skip */ }
                  };
                } catch { /* memory is best-effort; never block chat on it */ }

                // Special case: Ollama runs locally, different API
                if (agent === "ollama") {
                  // POST to localhost:11434/api/chat (Ollama native format)
                  const ollamaRes = await fetch("http://127.0.0.1:11434/api/chat", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      model: config.model,
                      messages: [
                        { role: "system", content: config.system + memoryRecall + SHARED_SKILLS_NOTE },
                        ...messages,
                      ],
                      stream: true,
                    }),
                  });

                  res.setHeader("Content-Type", "text/event-stream");
                  res.setHeader("Cache-Control", "no-cache");
                  res.setHeader("Connection", "keep-alive");
                  res.setHeader("Access-Control-Allow-Origin", "*");

                  if (!ollamaRes.ok || !ollamaRes.body) {
                    res.write(`data: ${JSON.stringify({ error: "Ollama error", done: true })}\n\n`);
                    res.end();
                    return;
                  }

                  const reader = ollamaRes.body.getReader();
                  const decoder = new TextDecoder();
                  let lastModel = config.model;
                  let replyAcc = "";
                  while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    const text = decoder.decode(value, { stream: true });
                    for (const line of text.split("\n").filter(Boolean)) {
                      try {
                        const j = JSON.parse(line);
                        if (j.message?.content) {
                          replyAcc += j.message.content;
                          res.write(`data: ${JSON.stringify({ delta: j.message.content, done: false })}\n\n`);
                        }
                        if (j.done) {
                          res.write(`data: ${JSON.stringify({ delta: "", done: true, model: lastModel })}\n\n`);
                        }
                      } catch { /* skip bad JSON */ }
                    }
                  }
                  try { (req as any).__memWrite?.(replyAcc); } catch { /* skip */ }
                  res.end();
                  return;
                }

                // All other agents use OpenRouter (OpenAI-compatible streaming)
                if (!orKey) {
                  res.statusCode = 503;
                  res.end(JSON.stringify({ error: "No OPENROUTER_API_KEY set. Add it to .env.local" }));
                  return;
                }

                // Default to a budget that fits a tightly-credited OpenRouter
                // plan (was 4096; that 402'd every Understand/CLI/Studio call
                // when the operator's balance ran below ~600 credits). Caller
                // can override via parsed.max_tokens.
                const reqMaxTokens = Math.max(256, Math.min(parsed.max_tokens ?? 1500, 4096));

                res.setHeader("Content-Type", "text/event-stream");
                res.setHeader("Cache-Control", "no-cache");
                res.setHeader("Connection", "keep-alive");
                res.setHeader("Access-Control-Allow-Origin", "*");

                // Accumulator for memory writeback at the end of the stream.
                let replyAcc = "";

                // Streams from OpenRouter and translates → our SSE shape.
                // On 402 (insufficient credits) we silently fall back to
                // local Ollama Gemma so the surface keeps working at $0.
                async function streamOpenRouter(maxTokens: number): Promise<{ ok: true } | { ok: false; status: number; body: string }> {
                  const orRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      "Authorization": `Bearer ${orKey}`,
                      "HTTP-Referer": "http://localhost:8081",
                      "X-Title": "Claude OS Dashboard",
                    },
                    body: JSON.stringify({
                      model: config.model,
                      messages: [{ role: "system", content: config.system }, ...messages],
                      stream: true,
                      max_tokens: maxTokens,
                    }),
                  });
                  if (!orRes.ok || !orRes.body) {
                    const errText = await orRes.text().catch(() => "unknown error");
                    return { ok: false, status: orRes.status, body: errText };
                  }
                  const r = orRes.body.getReader();
                  const d = new TextDecoder();
                  let buf = "";
                  let lastModel = config.model;
                  while (true) {
                    const { done, value } = await r.read();
                    if (done) {
                      res.write(`data: ${JSON.stringify({ delta: "", done: true, model: lastModel })}\n\n`);
                      break;
                    }
                    buf += d.decode(value, { stream: true });
                    const lines = buf.split("\n");
                    buf = lines.pop() ?? "";
                    for (const line of lines) {
                      if (!line.startsWith("data: ")) continue;
                      const data = line.slice(6).trim();
                      if (data === "[DONE]") {
                        res.write(`data: ${JSON.stringify({ delta: "", done: true, model: lastModel })}\n\n`);
                        continue;
                      }
                      try {
                        const j = JSON.parse(data);
                        const delta = j.choices?.[0]?.delta?.content ?? "";
                        if (j.model) lastModel = j.model;
                        if (delta) { replyAcc += delta; res.write(`data: ${JSON.stringify({ delta, done: false })}\n\n`); }
                      } catch { /* skip */ }
                    }
                  }
                  return { ok: true };
                }

                async function streamOllamaFallback(reason: string): Promise<void> {
                  // Local Ollama gemma3:4b — small + fast + $0. Big system
                  // prompts get truncated to keep the context reasonable.
                  const ollamaModel = process.env.OLLAMA_DEFAULT_MODEL ?? "gemma3:4b";
                  res.write(`data: ${JSON.stringify({ delta: `[fell back to local ${ollamaModel}: ${reason}]\n\n`, done: false })}\n\n`);
                  const oRes = await fetch("http://127.0.0.1:11434/api/chat", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      model: ollamaModel,
                      messages: [{ role: "system", content: config.system.slice(0, 1800) + memoryRecall }, ...messages],
                      stream: true,
                    }),
                  });
                  if (!oRes.ok || !oRes.body) {
                    res.write(`data: ${JSON.stringify({ error: `Ollama fallback also failed: HTTP ${oRes.status}. Start Ollama or top up OpenRouter credits.`, done: true })}\n\n`);
                    return;
                  }
                  const r = oRes.body.getReader();
                  const d = new TextDecoder();
                  while (true) {
                    const { done, value } = await r.read();
                    if (done) break;
                    for (const line of d.decode(value, { stream: true }).split("\n").filter(Boolean)) {
                      try {
                        const j = JSON.parse(line);
                        const delta = j.message?.content ?? "";
                        if (delta) { replyAcc += delta; res.write(`data: ${JSON.stringify({ delta, done: false })}\n\n`); }
                        if (j.done) res.write(`data: ${JSON.stringify({ delta: "", done: true, model: ollamaModel })}\n\n`);
                      } catch { /* skip */ }
                    }
                  }
                }

                const firstResult = await streamOpenRouter(reqMaxTokens);
                if (!firstResult.ok) {
                  // 402 = insufficient credits. Parse OpenRouter's "can only
                  // afford N tokens" hint and either retry at the cap or fall
                  // back to local Gemma. Either way the user gets an answer.
                  if (firstResult.status === 402) {
                    const m = firstResult.body.match(/can only afford (\d+)/);
                    if (m) {
                      const affordable = Math.max(128, parseInt(m[1], 10) - 32);
                      const retry = await streamOpenRouter(affordable);
                      if (!retry.ok) await streamOllamaFallback(`OpenRouter 402 — credits exhausted`);
                    } else {
                      await streamOllamaFallback(`OpenRouter 402 — credits exhausted`);
                    }
                  } else {
                    res.write(`data: ${JSON.stringify({ error: firstResult.body, done: true })}\n\n`);
                  }
                  try { (req as any).__memWrite?.(replyAcc); } catch { /* skip */ }
                  res.end();
                  return;
                }
                try { (req as any).__memWrite?.(replyAcc); } catch { /* skip */ }
                res.end();
                return;
              } catch (err: any) {
                if (!res.headersSent) {
                  res.statusCode = 500;
                  res.end(JSON.stringify({ error: err.message }));
                }
                return;
              }
            });
          });

          // ══════════════════════════════════════════════════════════════
          // GET /__openclaw_proxy/* — Transparent proxy to the OpenClaw
          // gateway at localhost:18789. Strips X-Frame-Options and
          // frame-ancestors CSP so the Control UI can be embedded as an
          // iframe in the dashboard (same-machine localhost only).
          // ══════════════════════════════════════════════════════════════
          server.middlewares.use("/__openclaw_proxy", async (req, res, next) => {
            if (!isLoopback(req)) {
              res.statusCode = 403;
              res.end("Loopback only");
              return;
            }
            const OPENCLAW_PORT = 18789;
            // Strip the /__openclaw_proxy prefix to get the real path
            const targetPath = (req.url ?? "/").replace(/^\/?__openclaw_proxy/, "") || "/";

            try {
              const upstream = await fetch(`http://localhost:${OPENCLAW_PORT}${targetPath}`, {
                method: req.method ?? "GET",
                headers: (() => {
                  const h: Record<string, string> = {};
                  const raw = req.headers;
                  for (const [k, v] of Object.entries(raw)) {
                    if (k.toLowerCase() === "host") { h[k] = `localhost:${OPENCLAW_PORT}`; continue; }
                    if (typeof v === "string") h[k] = v;
                    else if (Array.isArray(v)) h[k] = v[0] ?? "";
                  }
                  return h;
                })(),
                signal: AbortSignal.timeout(10_000),
                // forward body for POST/PUT
                body: ["GET", "HEAD"].includes(req.method ?? "GET") ? undefined : req as any,
                // @ts-ignore — duplex required for streaming body
                duplex: "half",
              });

              res.statusCode = upstream.status;

              // Copy headers, stripping anti-framing restrictions
              for (const [k, v] of upstream.headers.entries()) {
                const kl = k.toLowerCase();
                if (kl === "x-frame-options") continue; // drop entirely
                if (kl === "content-security-policy") {
                  // Allow embedding from our dashboard origin
                  const modified = v
                    .replace(/frame-ancestors\s+'none'/g, "frame-ancestors 'self' http://localhost:8081")
                    .replace(/frame-ancestors\s+'self'/g, "frame-ancestors 'self' http://localhost:8081");
                  res.setHeader(k, modified);
                  continue;
                }
                res.setHeader(k, v);
              }

              if (!upstream.body) { res.end(); return; }
              const reader = upstream.body.getReader();
              const pump = async (): Promise<void> => {
                const { done, value } = await reader.read();
                if (done) { res.end(); return; }
                res.write(Buffer.from(value));
                return pump();
              };
              await pump();
            } catch (err: any) {
              if (!res.headersSent) {
                res.statusCode = 502;
                res.end(JSON.stringify({ error: `OpenClaw gateway unreachable: ${err.message}` }));
              }
            }
          });

          // ══════════════════════════════════════════════════════════════
          // GET /__openclaw_status — Quick probe: is the gateway running?
          // Returns { running: bool, assistantName: string, port: number }
          // ══════════════════════════════════════════════════════════════
          server.middlewares.use("/__openclaw_status", async (req, res) => {
            if (!isLoopback(req)) { res.statusCode = 403; res.end("loopback only"); return; }
            const { token, port } = readOpenClawGateway();
            res.setHeader("Content-Type", "application/json");
            try {
              const r = await fetch(`http://localhost:${port}/__openclaw/control-ui-config.json`, {
                headers: token ? { Authorization: `Bearer ${token}` } : {},
                signal: AbortSignal.timeout(3000),
              });
              if (r.ok) {
                const cfg = await r.json() as { assistantName?: string };
                res.end(JSON.stringify({ running: true, port, assistantName: cfg.assistantName ?? "Phil Gaston", hasToken: Boolean(token) }));
              } else {
                res.end(JSON.stringify({ running: false, port, hasToken: Boolean(token) }));
              }
            } catch {
              res.end(JSON.stringify({ running: false, port, hasToken: Boolean(token) }));
            }
          });

          // ══════════════════════════════════════════════════════════════
          // GET /__openclaw_token — Return the gateway bearer token + URL so
          // the dashboard can show "copy → paste into Control UI Settings"
          // when the gateway page says "unauthorized: gateway token missing".
          // Loopback-only.
          // ══════════════════════════════════════════════════════════════
          server.middlewares.use("/__openclaw_token", async (req, res) => {
            if (!isLoopback(req)) { res.statusCode = 403; res.end("loopback only"); return; }
            const { token, port } = readOpenClawGateway();
            res.setHeader("Content-Type", "application/json");
            res.setHeader("Cache-Control", "no-store");
            res.end(JSON.stringify({ token, port, url: `http://localhost:${port}` }));
          });

          // ══════════════════════════════════════════════════════════════
          // GET /__vitals — Agent health check (Claude, OpenClaw, Hermes)
          // ══════════════════════════════════════════════════════════════
          server.middlewares.use("/__vitals", async (req, res) => {
            if (req.method !== "GET") { res.statusCode = 405; res.end(); return; }

            const { execFile, execSync: execSyncV } = await import("node:child_process");
            const { promisify } = await import("node:util");
            const execFileP = promisify(execFile);

            function whichBin(bin: string): string | null {
              try { return (execSyncV(`which ${bin} 2>/dev/null`, { encoding: "utf8" }) as string).trim() || null; } catch { return null; }
            }

            async function probeCmd(cmd: string, args: string[]): Promise<{ ok: boolean; stdout: string; latencyMs: number }> {
              const t0 = Date.now();
              try {
                const { stdout } = await execFileP(cmd, args, { timeout: 5000 }) as { stdout: string; stderr: string };
                return { ok: true, stdout: stdout.trim(), latencyMs: Date.now() - t0 };
              } catch { return { ok: false, stdout: "", latencyMs: Date.now() - t0 }; }
            }

            const claudePath = whichBin("claude");
            // OpenClaw ships as a gateway daemon — the user-facing binary may be
            // `openclaw`, `openclaw-gateway`, or `clawd` depending on install.
            // We probe ALL of them, and if none is on PATH we fall back to a
            // direct HTTP hit on the gateway port :18789. A running gateway is
            // the actual definition of "OpenClaw online" regardless of CLI.
            const openclawPath = whichBin("openclaw") || whichBin("openclaw-gateway") || whichBin("clawd");
            const hermesPath = whichBin("hermes");

            // Direct gateway probe — works whether or not a CLI is on PATH.
            async function gatewayProbe(): Promise<{ ok: boolean; stdout: string; latencyMs: number }> {
              const t0 = Date.now();
              const { token, port } = readOpenClawGateway();
              try {
                const r = await fetch(`http://127.0.0.1:${port}/__openclaw/control-ui-config.json`, {
                  headers: token ? { Authorization: `Bearer ${token}` } : {},
                  signal: AbortSignal.timeout(2000),
                });
                if (!r.ok) return { ok: false, stdout: "", latencyMs: Date.now() - t0 };
                const cfg = await r.json() as { assistantName?: string; agents?: unknown[] };
                const count = Array.isArray(cfg.agents) ? cfg.agents.length : 0;
                return { ok: true, stdout: `${count} agent${count === 1 ? "" : "s"} (${cfg.assistantName ?? "openclaw"})`, latencyMs: Date.now() - t0 };
              } catch {
                return { ok: false, stdout: "", latencyMs: Date.now() - t0 };
              }
            }

            const [claudeRes, openclawRes, hermesRes] = await Promise.all([
              claudePath ? probeCmd(claudePath, ["--version"]) : Promise.resolve({ ok: false, stdout: "", latencyMs: 0 }),
              // Prefer CLI if present (gives `openclaw health` output); fall back to gateway HTTP probe.
              openclawPath
                ? probeCmd(openclawPath, ["health"]).catch(() => gatewayProbe())
                : gatewayProbe(),
              hermesPath ? probeCmd(hermesPath, ["status"]).catch(() => ({ ok: false, stdout: "", latencyMs: 0 })) : Promise.resolve({ ok: false, stdout: "", latencyMs: 0 }),
            ]);

            const claudeVersion = claudeRes.stdout.split("\n")[0] || "unknown";
            const agentMatch = openclawRes.stdout.match(/(\d+)\s+agent/i);
            const agentCount = agentMatch ? parseInt(agentMatch[1]) : 0;
            const modelMatch = hermesRes.stdout.match(/model[:\s]+([^\s]+)/i);
            const hermesModel = modelMatch ? modelMatch[1] : "unknown";
            const providerMatch = hermesRes.stdout.match(/provider[:\s]+([^\s]+)/i);
            const hermesProvider = providerMatch ? providerMatch[1] : "unknown";

            const vitals = {
              ts: Date.now(),
              claude: { ok: claudeRes.ok, version: claudeVersion, latencyMs: claudeRes.latencyMs },
              openclaw: { ok: openclawRes.ok, agents: agentCount, latencyMs: openclawRes.latencyMs },
              hermes: { ok: hermesRes.ok, model: hermesModel, provider: hermesProvider, latencyMs: hermesRes.latencyMs },
              openrouter: { ok: false },
            };

            res.setHeader("Content-Type", "application/json");
            res.setHeader("Cache-Control", "no-cache");
            res.end(JSON.stringify(vitals));
          });

          // ══════════════════════════════════════════════════════════════
          // POST /__run — CLI command runner for CommandPalette
          // ══════════════════════════════════════════════════════════════
          server.middlewares.use("/__run", async (req, res) => {
            if (req.method !== "POST") { res.statusCode = 405; res.end(); return; }

            let body = "";
            req.on("data", (chunk: Buffer) => { body += chunk.toString(); });
            req.on("end", async () => {
              try {
                const parsed = JSON.parse(body) as { agent: string; args: string[] };
                const { agent, args = [] } = parsed;

                const binaries: Record<string, string> = {
                  claude: "claude",
                  openclaw: "openclaw",
                  hermes: "hermes",
                };
                const bin = binaries[agent];
                if (!bin) {
                  res.statusCode = 400;
                  res.end(JSON.stringify({ error: `unknown agent: ${agent}` }));
                  return;
                }

                const safeArgs = (args as string[]).filter((a) => /^[A-Za-z0-9 ._\-\/]+$/.test(a));

                const { execFile: execFileCli } = await import("node:child_process");
                const { promisify: prom } = await import("node:util");
                const efp = prom(execFileCli);
                try {
                  const { stdout, stderr } = await efp(bin, safeArgs, { timeout: 10000 }) as { stdout: string; stderr: string };
                  res.setHeader("Content-Type", "application/json");
                  res.end(JSON.stringify({ stdout, stderr }));
                } catch (e: unknown) {
                  const err = e as { stdout?: string; stderr?: string; message?: string };
                  res.setHeader("Content-Type", "application/json");
                  res.end(JSON.stringify({ stdout: err.stdout ?? "", stderr: err.stderr ?? err.message ?? String(e) }));
                }
              } catch {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: "invalid json" }));
              }
            });
          });

          // ══════════════════════════════════════════════════════════════
          // ══════════════════════════════════════════════════════════════
          // /__kanban_* — multi-agent execution kanban (Campaign #86).
          //
          // Backed by Hermes' real SQLite kanban (~/.hermes/kanban.db) via
          // the `hermes kanban` CLI. Hermes owns persistence, state
          // transitions, parent/child decomposition, audit trail.
          //
          // Assignees can be either:
          //   · A Hermes profile YAML (~/.hermes/pantheon/personas/*) →
          //     Hermes' own dispatcher claims and runs the task
          //   · A non-Hermes agent id (codex / gemini / openclaw /
          //     claudeclaw / antigravity / ruflo / free-claude /
          //     notebooklm / hermes-mcp) → our external dispatcher
          //     (further down) claims, runs via /__agent_run, captures
          //     output, marks the task complete.
          //
          // Columns map 1:1 to Hermes' status enum:
          //   triage · todo · ready · running · blocked · done (+ archived)
          //
          // Endpoints (all loopback-only):
          //   GET  /__kanban_tasks?archived=&assignee=&q=
          //   GET  /__kanban_show?id=
          //   GET  /__kanban_assignees
          //   GET  /__kanban_workspace_files?id=
          //   POST /__kanban_create        { title, body?, assignee?,
          //                                  workspace?, priority?,
          //                                  parents?, autoDecompose? }
          //   POST /__kanban_decompose     { id?, all? }
          //   POST /__kanban_assign        { id, profile }
          //   POST /__kanban_archive       { ids: string[] }
          //   POST /__kanban_complete      { ids: string[] }
          //   POST /__kanban_block         { ids: string[], reason? }
          //   POST /__kanban_unblock       { ids: string[] }
          //   POST /__kanban_dispatch_now  { id }        — claim + run NOW
          //   POST /__kanban_dispatch_pass {}            — one Hermes pass
          //
          // ══════════════════════════════════════════════════════════════

          // The set of agent ids we dispatch ourselves (not Hermes profiles).
          // Must stay in sync with AGENT_BACKENDS above.
          const NON_HERMES_AGENTS = new Set([
            "codex", "gemini", "openclaw", "claudeclaw", "antigravity",
            "ruflo", "free-claude", "notebooklm", "hermes-mcp",
          ]);

          function kanbanCmd(args: string[]): { ok: boolean; stdout: string; stderr: string; code: number } {
            const r = spawnSync(HERMES_BIN, ["kanban", ...args], {
              encoding: "utf-8",
              stdio: ["ignore", "pipe", "pipe"],
              timeout: 30_000,
            });
            return { ok: r.status === 0, stdout: r.stdout ?? "", stderr: r.stderr ?? "", code: r.status ?? -1 };
          }
          async function readJsonBody(req: any): Promise<any> {
            return new Promise((resolve, reject) => {
              let body = "";
              req.on("data", (c: Buffer) => { body += c.toString(); });
              req.on("end", () => { try { resolve(body ? JSON.parse(body) : {}); } catch (e) { reject(e); } });
              req.on("error", reject);
            });
          }
          function endJson(res: any, status: number, payload: unknown): void {
            res.statusCode = status;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify(payload));
          }

          // GET /__kanban_tasks
          server.middlewares.use("/__kanban_tasks", (req, res, next) => {
            if (req.method !== "GET") return next();
            if (!isLoopback(req)) return endJson(res, 403, { error: "loopback only" });
            const url = new URL(req.url ?? "/", "http://x");
            const args = ["list", "--json"];
            if (url.searchParams.get("archived") === "1") args.push("--archived");
            const a = url.searchParams.get("assignee");
            if (a) args.push("--assignee", a);
            const r = kanbanCmd(args);
            if (!r.ok) return endJson(res, 500, { error: r.stderr || "kanban list failed" });
            let tasks: any[] = [];
            try { tasks = JSON.parse(r.stdout || "[]"); } catch { /* skip */ }
            // Client-side search filter for the q param (title + body match)
            const q = url.searchParams.get("q")?.toLowerCase();
            if (q) tasks = tasks.filter((t) => `${t.title} ${t.body ?? ""}`.toLowerCase().includes(q));
            endJson(res, 200, { tasks });
          });

          // GET /__kanban_show?id=
          server.middlewares.use("/__kanban_show", (req, res, next) => {
            if (req.method !== "GET") return next();
            if (!isLoopback(req)) return endJson(res, 403, { error: "loopback only" });
            const id = new URL(req.url ?? "/", "http://x").searchParams.get("id");
            if (!id) return endJson(res, 400, { error: "id required" });
            const r = kanbanCmd(["show", id, "--json"]);
            if (!r.ok) return endJson(res, 500, { error: r.stderr || "kanban show failed" });
            try { endJson(res, 200, JSON.parse(r.stdout)); }
            catch (e) { endJson(res, 500, { error: String(e), raw: r.stdout.slice(0, 600) }); }
          });

          // GET /__kanban_assignees — Hermes profiles + non-Hermes agents
          server.middlewares.use("/__kanban_assignees", (req, res, next) => {
            if (req.method !== "GET") return next();
            if (!isLoopback(req)) return endJson(res, 403, { error: "loopback only" });
            const hermes: { id: string; name: string; backend: "hermes" }[] = [];
            try {
              const dir = join(HOME, ".hermes", "pantheon", "personas");
              if (existsSync(dir)) {
                for (const f of readdirSync(dir)) {
                  if (!f.endsWith(".yaml")) continue;
                  const id = f.replace(/\.yaml$/, "");
                  const raw = readFileSync(join(dir, f), "utf-8");
                  const m = raw.match(/^name:\s*(.+)$/m);
                  hermes.push({ id, name: m ? m[1].replace(/^['"]|['"]$/g, "").trim() : id, backend: "hermes" });
                }
              }
            } catch { /* skip */ }
            hermes.push({ id: "default", name: "Default (Hermes)", backend: "hermes" });
            const nonHermes = [
              { id: "codex",        name: "Codex (OpenAI)",       backend: "codex" as const },
              { id: "gemini",       name: "Gemini 3.5 Flash",      backend: "gemini" as const },
              { id: "openclaw",     name: "OpenClaw",              backend: "claude-persona" as const },
              { id: "claudeclaw",   name: "ClaudeClaw",            backend: "claude-persona" as const },
              { id: "antigravity",  name: "Antigravity",           backend: "cli" as const },
              { id: "ruflo",        name: "Ruflo",                 backend: "claude-persona" as const },
              { id: "free-claude",  name: "Free Claude",           backend: "claude-persona" as const },
              { id: "notebooklm",   name: "NotebookLM",            backend: "notebooklm" as const },
              { id: "hermes-mcp",   name: "Hermes MCP Loop",       backend: "claude-persona" as const },
            ];
            endJson(res, 200, { hermes, nonHermes });
          });

          // GET /__kanban_workspace_files?id=
          server.middlewares.use("/__kanban_workspace_files", (req, res, next) => {
            if (req.method !== "GET") return next();
            if (!isLoopback(req)) return endJson(res, 403, { error: "loopback only" });
            const id = new URL(req.url ?? "/", "http://x").searchParams.get("id");
            if (!id) return endJson(res, 400, { error: "id required" });
            const dir = join(HOME, ".hermes", "kanban", "workspace", id);
            if (!existsSync(dir)) return endJson(res, 200, { dir, files: [] });
            const out: { name: string; size: number; mtime: number; isDir: boolean }[] = [];
            try {
              for (const name of readdirSync(dir)) {
                const p = join(dir, name);
                try {
                  const st = statSync(p);
                  out.push({ name, size: st.size, mtime: st.mtimeMs, isDir: st.isDirectory() });
                } catch { /* skip */ }
              }
            } catch { /* skip */ }
            out.sort((a, b) => b.mtime - a.mtime);
            endJson(res, 200, { dir, files: out });
          });

          // POST /__kanban_create
          server.middlewares.use("/__kanban_create", async (req, res, next) => {
            if (req.method !== "POST") return next();
            if (!isLoopback(req)) return endJson(res, 403, { error: "loopback only" });
            let body: any;
            try { body = await readJsonBody(req); } catch { return endJson(res, 400, { error: "invalid JSON" }); }
            const title = String(body.title ?? "").trim();
            if (!title) return endJson(res, 400, { error: "title required" });
            const args = ["create", title, "--json"];
            if (body.body) args.push("--body", String(body.body));
            if (body.assignee) args.push("--assignee", String(body.assignee));
            if (body.workspace) args.push("--workspace", String(body.workspace));
            if (typeof body.priority === "number") args.push("--priority", String(body.priority));
            for (const p of (Array.isArray(body.parents) ? body.parents : [])) args.push("--parent", String(p));
            for (const s of (Array.isArray(body.skills) ? body.skills : [])) args.push("--skill", String(s));
            // Always start in triage so decompose can flesh out children before
            // promotion to todo/ready. This matches the user's spec ("as soon
            // as I click the add button, it needs to triage a task and split
            // everything into multiple sub-tasks").
            args.push("--triage");
            const r = kanbanCmd(args);
            if (!r.ok) return endJson(res, 500, { error: r.stderr || "kanban create failed", stdout: r.stdout });
            let task: any = null;
            try { task = JSON.parse(r.stdout); } catch { /* skip */ }
            // Auto-decompose if requested (the user spec says this should be
            // the default when kanban.auto_decompose is on in Hermes config).
            const autoDecompose = body.autoDecompose ?? true;
            let children: any[] | null = null;
            if (autoDecompose && task?.id) {
              const dec = kanbanCmd(["decompose", task.id, "--json"]);
              if (dec.ok) {
                try {
                  // decompose --json emits one JSON object per child on stdout
                  children = dec.stdout.trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));
                } catch { /* skip */ }
              }
            }
            endJson(res, 200, { task, children, decomposed: autoDecompose });
          });

          // POST /__kanban_decompose
          server.middlewares.use("/__kanban_decompose", async (req, res, next) => {
            if (req.method !== "POST") return next();
            if (!isLoopback(req)) return endJson(res, 403, { error: "loopback only" });
            let body: any;
            try { body = await readJsonBody(req); } catch { return endJson(res, 400, { error: "invalid JSON" }); }
            const args = ["decompose", "--json"];
            if (body.all) args.push("--all");
            else if (body.id) args.push(String(body.id));
            else return endJson(res, 400, { error: "id or all required" });
            const r = kanbanCmd(args);
            if (!r.ok) return endJson(res, 500, { error: r.stderr || "kanban decompose failed" });
            const children = r.stdout.trim().split("\n").filter(Boolean).map((l) => {
              try { return JSON.parse(l); } catch { return null; }
            }).filter(Boolean);
            endJson(res, 200, { children });
          });

          // POST /__kanban_assign / archive / complete / block / unblock — bulk-ish
          server.middlewares.use("/__kanban_assign", async (req, res, next) => {
            if (req.method !== "POST") return next();
            if (!isLoopback(req)) return endJson(res, 403, { error: "loopback only" });
            let body: any;
            try { body = await readJsonBody(req); } catch { return endJson(res, 400, { error: "invalid JSON" }); }
            const id = String(body.id ?? "");
            const profile = String(body.profile ?? "");
            if (!id || !profile) return endJson(res, 400, { error: "id + profile required" });
            const r = kanbanCmd(["assign", id, profile]);
            endJson(res, r.ok ? 200 : 500, { ok: r.ok, stderr: r.stderr });
          });
          for (const op of ["archive", "complete", "block", "unblock"] as const) {
            server.middlewares.use(`/__kanban_${op}`, async (req, res, next) => {
              if (req.method !== "POST") return next();
              if (!isLoopback(req)) return endJson(res, 403, { error: "loopback only" });
              let body: any;
              try { body = await readJsonBody(req); } catch { return endJson(res, 400, { error: "invalid JSON" }); }
              const ids = Array.isArray(body.ids) ? body.ids.map(String) : (body.id ? [String(body.id)] : []);
              if (ids.length === 0) return endJson(res, 400, { error: "ids required" });
              const r = kanbanCmd([op, ...ids]);
              endJson(res, r.ok ? 200 : 500, { ok: r.ok, stderr: r.stderr });
            });
          }

          // POST /__kanban_dispatch_pass — one Hermes dispatcher pass
          server.middlewares.use("/__kanban_dispatch_pass", async (req, res, next) => {
            if (req.method !== "POST") return next();
            if (!isLoopback(req)) return endJson(res, 403, { error: "loopback only" });
            const r = kanbanCmd(["dispatch", "--json"]);
            endJson(res, r.ok ? 200 : 500, { ok: r.ok, stdout: r.stdout, stderr: r.stderr });
          });

          // POST /__kanban_dispatch_now — claim a ready task and run it NOW.
          // For Hermes assignees, kick the Hermes dispatcher. For non-Hermes,
          // run our external loop synchronously for that one task and stream
          // back the result.
          server.middlewares.use("/__kanban_dispatch_now", async (req, res, next) => {
            if (req.method !== "POST") return next();
            if (!isLoopback(req)) return endJson(res, 403, { error: "loopback only" });
            let body: any;
            try { body = await readJsonBody(req); } catch { return endJson(res, 400, { error: "invalid JSON" }); }
            const id = String(body.id ?? "");
            if (!id) return endJson(res, 400, { error: "id required" });
            const show = kanbanCmd(["show", id, "--json"]);
            if (!show.ok) return endJson(res, 500, { error: show.stderr });
            let task: any;
            try { task = JSON.parse(show.stdout).task; } catch { return endJson(res, 500, { error: "bad show JSON" }); }
            const assignee = task.assignee ?? "";
            if (!NON_HERMES_AGENTS.has(assignee)) {
              // Hermes profile — let Hermes own the run
              const r = kanbanCmd(["dispatch", "--max", "1", "--json"]);
              return endJson(res, r.ok ? 200 : 500, { ok: r.ok, backend: "hermes", stdout: r.stdout, stderr: r.stderr });
            }
            // Non-Hermes agent: run through /__agent_run internally
            externalKanbanRunOne(task).then((result) => endJson(res, 200, { ok: true, backend: "external", ...result }))
              .catch((e) => endJson(res, 500, { error: String(e) }));
          });

          // ── External dispatcher for non-Hermes agents ────────────────────
          // Polls Hermes kanban for status="ready" tasks assigned to one of
          // our non-Hermes agents, runs them through the same backend the
          // chat UI uses (/__agent_run dispatch table), captures output as
          // a kanban comment, and marks the task complete (or blocks it on
          // failure).
          async function externalKanbanRunOne(task: any): Promise<{ id: string; ok: boolean; output: string; comment: string }> {
            const { spawn } = await import("node:child_process");
            const id = task.id as string;
            const agentId = task.assignee as string;
            const msg = task.body ? `${task.title}\n\n${task.body}` : task.title;
            // Find the same backend the chat dispatcher would use
            const cfg = AGENT_BACKENDS[agentId];
            if (!cfg) return { id, ok: false, output: "", comment: `[external dispatcher] no backend for assignee "${agentId}"` };
            // Claim the task (atomic) — sets running
            const claim = kanbanCmd(["claim", id]);
            if (!claim.ok) return { id, ok: false, output: "", comment: `[external dispatcher] claim failed: ${claim.stderr}` };
            // Reuse the same arg-builder logic from /__agent_run (a thin re-derivation)
            let bin = "", args: string[] = [];
            const env = { ...process.env, FORCE_COLOR: "0", NO_COLOR: "1" };
            let cleanupTmp: string | null = null;
            try {
              switch (cfg.kind) {
                case "hermes-default":
                case "hermes-persona": {
                  bin = HERMES_BIN;
                  const prefix = cfg.summonPhrase ? `${cfg.summonPhrase}, ` : "";
                  args = ["chat", "-q", prefix + msg, "-Q", "--yolo"];
                  break;
                }
                case "cli": {
                  bin = cfg.bin!;
                  args = cfg.argsFor!(msg);
                  break;
                }
                case "claude-persona": {
                  bin = CLAUDE_BIN;
                  args = ["-p", msg, "--add-dir", process.cwd(),
                    "--add-dir", join(HOME, ".claude-os"),
                    "--add-dir", join(HOME, ".hermes"),
                    "--permission-mode", "bypassPermissions"];
                  if (OBSIDIAN_VAULT) args.push("--add-dir", OBSIDIAN_VAULT);
                  if (cfg.systemPrompt) {
                    const tmpFile = join("/tmp", `kanban-persona-${agentId}-${id}.md`);
                    writeFileSync(tmpFile, cfg.systemPrompt, "utf-8");
                    cleanupTmp = tmpFile;
                    args.push("--append-system-prompt-file", tmpFile);
                  }
                  break;
                }
              }
              const collected: string[] = [];
              await new Promise<void>((resolve) => {
                const cp = spawn(bin, args, { cwd: process.cwd(), env, stdio: ["pipe", "pipe", "pipe"] });
                try { cp.stdin?.end(); } catch { /* skip */ }
                cp.stdout.on("data", (d: Buffer) => collected.push(d.toString("utf-8")));
                cp.stderr.on("data", (d: Buffer) => collected.push(d.toString("utf-8")));
                cp.on("close", () => resolve());
                cp.on("error", () => resolve());
                // 5 min hard timeout
                setTimeout(() => { try { cp.kill("SIGTERM"); } catch { /* skip */ } resolve(); }, 5 * 60_000);
              });
              const output = collected.join("");
              // Persist a comment with the output, then complete the task
              const truncated = output.length > 6000 ? output.slice(0, 6000) + `\n[output truncated, full length ${output.length}]` : output;
              const commentText = `[external dispatcher · ${agentId}]\n\n${truncated.trim() || "(no output)"}`;
              const commentR = kanbanCmd(["comment", id, commentText]);
              const completeR = kanbanCmd(["complete", id]);
              if (cleanupTmp) { try { unlinkSync(cleanupTmp); } catch { /* skip */ } }
              return { id, ok: completeR.ok, output, comment: commentR.ok ? "saved" : `comment failed: ${commentR.stderr}` };
            } catch (e) {
              if (cleanupTmp) { try { unlinkSync(cleanupTmp); } catch { /* skip */ } }
              kanbanCmd(["block", id]);
              return { id, ok: false, output: "", comment: `[external dispatcher] crash: ${String(e)}` };
            }
          }

          // The external dispatcher poll loop — runs every 60s while the dev
          // server is up. Picks the oldest ready non-Hermes task, runs it,
          // moves on. Single-threaded so we don't fire 9 LLMs at once on a
          // /dispatch pass.
          let externalDispatchInFlight = false;
          async function externalDispatcherTick(): Promise<void> {
            if (externalDispatchInFlight) return;
            externalDispatchInFlight = true;
            try {
              const r = kanbanCmd(["list", "--status", "ready", "--json"]);
              if (!r.ok) return;
              let tasks: any[] = [];
              try { tasks = JSON.parse(r.stdout || "[]"); } catch { /* skip */ }
              const candidate = tasks.find((t) => NON_HERMES_AGENTS.has(t.assignee));
              if (!candidate) return;
              await externalKanbanRunOne(candidate);
            } finally {
              externalDispatchInFlight = false;
            }
          }
          setInterval(() => { void externalDispatcherTick(); }, 60_000);
          // Initial tick after a short delay so we don't slow boot
          setTimeout(() => { void externalDispatcherTick(); }, 8_000);

          // ══════════════════════════════════════════════════════════════
          // /__hermes_workspace, /__hermes_goal_*, /__hermes_mcp_*
          //   — Campaign #88: real Hermes page sub-surfaces.
          //
          //  Workspace (typed buckets):
          //    GET /__hermes_workspace_buckets  →
          //      { buckets: [{ id, label, dir, files: [...] }] }
          //    Buckets surface:
          //      · kanban     — ~/.hermes/kanban/workspace/* (per-task outputs)
          //      · sessions   — ~/.hermes/sessions/*.jsonl  (last 30)
          //      · memories   — ~/.hermes/memories/*
          //      · images     — ~/.hermes/images/*
          //      · audio      — ~/.hermes/audio_cache/*
          //      · pastes     — ~/.hermes/pastes/*
          //
          //    GET /__hermes_file?path=<abs>          → raw bytes for preview
          //      Only paths inside ~/.hermes or the repo are served (path-
          //      traversal guard). Range header is honoured so the browser
          //      can scrub videos.
          //
          //  Goal Mode (autonomous long-runs):
          //    POST /__hermes_goal_run { goal, model?, skills? }
          //      → SSE stream of the autonomous run. Spawns
          //        `hermes -z "<goal>" -Q --yolo` (the -z flag IS goal mode
          //        — single autonomous shot with no human-in-loop). Each
          //        chunk wrapped as data: {delta:"…"} for chat-shaped UI
          //        consumption.
          //    GET  /__hermes_goal_history
          //      → list of recent autonomous runs by mtime
          //
          //  MCP Control Room:
          //    GET  /__hermes_mcp_servers     → wraps `hermes mcp list`
          //    POST /__hermes_mcp_add         { name, url|command, args? }
          //    POST /__hermes_mcp_remove      { name }
          //    POST /__hermes_mcp_test        { name }
          //    POST /__hermes_mcp_login       { name }
          // ══════════════════════════════════════════════════════════════

          function hermesCmd(args: string[], timeoutMs = 20_000): { ok: boolean; stdout: string; stderr: string } {
            const r = spawnSync(HERMES_BIN, args, { encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"], timeout: timeoutMs });
            return { ok: r.status === 0, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
          }
          function safeListDir(dir: string, opts: { maxItems?: number; recursive?: boolean } = {}): { name: string; path: string; size: number; mtime: number; isDir: boolean; ext: string }[] {
            const max = opts.maxItems ?? 60;
            const out: { name: string; path: string; size: number; mtime: number; isDir: boolean; ext: string }[] = [];
            if (!existsSync(dir)) return out;
            try {
              const walk = (root: string, depth: number): void => {
                if (out.length >= max) return;
                for (const name of readdirSync(root)) {
                  if (out.length >= max) return;
                  if (name.startsWith(".")) continue;
                  const p = join(root, name);
                  try {
                    const st = statSync(p);
                    const ext = name.lastIndexOf(".") > 0 ? name.slice(name.lastIndexOf(".") + 1).toLowerCase() : "";
                    out.push({ name, path: p, size: st.size, mtime: st.mtimeMs, isDir: st.isDirectory(), ext });
                    if (opts.recursive && st.isDirectory() && depth < 2) walk(p, depth + 1);
                  } catch { /* skip unreadable */ }
                }
              };
              walk(dir, 0);
            } catch { /* skip */ }
            return out.sort((a, b) => b.mtime - a.mtime).slice(0, max);
          }

          server.middlewares.use("/__hermes_workspace_buckets", (req, res, next) => {
            if (req.method !== "GET") return next();
            if (!isLoopback(req)) return endJson(res, 403, { error: "loopback only" });
            const root = join(HOME, ".hermes");
            const buckets = [
              { id: "kanban",   label: "Kanban worker outputs",  dir: join(root, "kanban", "workspace"), files: safeListDir(join(root, "kanban", "workspace"), { recursive: true, maxItems: 80 }) },
              { id: "sessions", label: "Chat sessions",          dir: join(root, "sessions"),            files: safeListDir(join(root, "sessions"), { maxItems: 30 }) },
              { id: "memories", label: "Hermes memory files",    dir: join(root, "memories"),            files: safeListDir(join(root, "memories"), { maxItems: 40 }) },
              { id: "images",   label: "Generated images",       dir: join(root, "images"),              files: safeListDir(join(root, "images"), { maxItems: 40 }) },
              { id: "audio",    label: "Audio outputs (TTS)",    dir: join(root, "audio_cache"),         files: safeListDir(join(root, "audio_cache"), { maxItems: 40 }) },
              { id: "pastes",   label: "Pastes",                 dir: join(root, "pastes"),              files: safeListDir(join(root, "pastes"), { maxItems: 40 }) },
              { id: "goal",     label: "Goal Mode runs",         dir: join(HOME, ".claude-os", "goal-runs"), files: safeListDir(join(HOME, ".claude-os", "goal-runs"), { maxItems: 40 }) },
            ];
            endJson(res, 200, { buckets });
          });

          // GET /__hermes_file?path=...  — preview / serve a file with Range
          server.middlewares.use("/__hermes_file", async (req, res, next) => {
            if (req.method !== "GET") return next();
            if (!isLoopback(req)) return endJson(res, 403, { error: "loopback only" });
            const url = new URL(req.url ?? "/", "http://x");
            const path = url.searchParams.get("path") ?? "";
            if (!path) return endJson(res, 400, { error: "path required" });
            const resolved = resolve(path);
            const allowed = [resolve(HOME, ".hermes"), resolve(HOME, ".claude-os"), resolve(process.cwd())];
            if (!allowed.some((root) => resolved === root || resolved.startsWith(root + "/"))) {
              return endJson(res, 403, { error: "path outside allowed roots" });
            }
            if (!existsSync(resolved)) return endJson(res, 404, { error: "not found" });
            let st: ReturnType<typeof statSync>;
            try { st = statSync(resolved); } catch { return endJson(res, 404, { error: "stat failed" }); }
            if (st.isDirectory()) return endJson(res, 400, { error: "path is a directory" });
            const ext = resolved.slice(resolved.lastIndexOf(".") + 1).toLowerCase();
            const mime: Record<string, string> = {
              png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", svg: "image/svg+xml",
              mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime",
              mp3: "audio/mpeg", wav: "audio/wav", m4a: "audio/mp4", ogg: "audio/ogg",
              pdf: "application/pdf",
              html: "text/html", htm: "text/html",
              json: "application/json", yaml: "text/yaml", yml: "text/yaml",
              md: "text/markdown", txt: "text/plain", log: "text/plain", jsonl: "application/x-ndjson",
              ts: "text/plain", tsx: "text/plain", js: "text/plain", jsx: "text/plain", py: "text/plain",
            };
            const contentType = mime[ext] ?? "application/octet-stream";
            const range = req.headers.range as string | undefined;
            // createReadStream is top-level imported
            if (range && st.size > 0) {
              const m = /bytes=(\d*)-(\d*)/.exec(range);
              if (m) {
                const start = m[1] ? parseInt(m[1], 10) : 0;
                const end = m[2] ? parseInt(m[2], 10) : st.size - 1;
                res.statusCode = 206;
                res.setHeader("Content-Range", `bytes ${start}-${end}/${st.size}`);
                res.setHeader("Accept-Ranges", "bytes");
                res.setHeader("Content-Length", String(end - start + 1));
                res.setHeader("Content-Type", contentType);
                createReadStream(resolved, { start, end }).pipe(res);
                return;
              }
            }
            res.setHeader("Content-Type", contentType);
            res.setHeader("Content-Length", String(st.size));
            res.setHeader("Accept-Ranges", "bytes");
            createReadStream(resolved).pipe(res);
          });

          // POST /__hermes_goal_run — autonomous long-run via Hermes -z
          server.middlewares.use("/__hermes_goal_run", async (req, res, next) => {
            if (req.method !== "POST") return next();
            if (!isLoopback(req)) return endJson(res, 403, { error: "loopback only" });
            let body: any;
            try { body = await readJsonBody(req); } catch { return endJson(res, 400, { error: "invalid JSON" }); }
            const goal = String(body.goal ?? "").trim();
            if (!goal) return endJson(res, 400, { error: "goal required" });
            const args: string[] = ["-z", goal, "-Q", "--yolo"];
            if (body.model) args.push("-m", String(body.model));
            if (Array.isArray(body.skills) && body.skills.length > 0) args.push("--skills", body.skills.join(","));
            // Persist a copy of the run output to ~/.claude-os/goal-runs/<ts>.log
            const runsDir = join(HOME, ".claude-os", "goal-runs");
            try { if (!existsSync(runsDir)) mkdirSync(runsDir, { recursive: true }); } catch { /* skip */ }
            const logPath = join(runsDir, `${new Date().toISOString().replace(/[:.]/g, "-")}.log`);
            try { writeFileSync(logPath, `# Hermes goal mode\n# ${new Date().toISOString()}\n# goal: ${goal}\n\n`); } catch { /* skip */ }
            res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
            res.setHeader("Cache-Control", "no-cache");
            res.flushHeaders?.();
            const send = (obj: any): void => { try { res.write(`data: ${JSON.stringify(obj)}\n\n`); } catch { /* skip */ } };
            const appendLog = (chunk: string): void => { try { appendFileSync(logPath, chunk); } catch { /* skip */ } };
            const { spawn } = await import("node:child_process");
            const cp = spawn(HERMES_BIN, args, { cwd: process.cwd(), env: { ...process.env, FORCE_COLOR: "0", NO_COLOR: "1" } });
            try { cp.stdin?.end(); } catch { /* skip */ }
            cp.stdout.on("data", (d: Buffer) => { const s = d.toString("utf-8"); appendLog(s); send({ delta: s, done: false }); });
            cp.stderr.on("data", (d: Buffer) => { const s = d.toString("utf-8"); appendLog(s); send({ delta: s, done: false }); });
            cp.on("close", (code) => { send({ delta: "", done: true, exit: code ?? -1, logPath }); res.end(); });
            cp.on("error", (e) => { send({ delta: `\n[error] ${e.message}\n`, done: true, exit: -1 }); res.end(); });
            setTimeout(() => { try { cp.kill("SIGTERM"); } catch { /* skip */ } }, 30 * 60_000); // 30 min goal cap
          });

          // GET /__hermes_goal_history — list past goal runs
          server.middlewares.use("/__hermes_goal_history", (req, res, next) => {
            if (req.method !== "GET") return next();
            if (!isLoopback(req)) return endJson(res, 403, { error: "loopback only" });
            const dir = join(HOME, ".claude-os", "goal-runs");
            endJson(res, 200, { dir, runs: safeListDir(dir, { maxItems: 40 }) });
          });

          // GET /__hermes_mcp_servers
          server.middlewares.use("/__hermes_mcp_servers", (req, res, next) => {
            if (req.method !== "GET") return next();
            if (!isLoopback(req)) return endJson(res, 403, { error: "loopback only" });
            const r = hermesCmd(["mcp", "list"]);
            // hermes mcp list emits human text; parse loosely into entries
            const lines = (r.stdout + "\n" + r.stderr).split("\n").map((l) => l.trim()).filter(Boolean);
            const servers: { name: string; raw: string }[] = [];
            for (const l of lines) {
              const m = /^[•·\-\*]?\s*([a-zA-Z0-9_\-]+)\s*(?::|·)?\s*(.*)$/.exec(l);
              if (m && !/no mcp servers configured/i.test(l) && !/Add one with:/i.test(l) && !/^hermes mcp/i.test(l)) {
                servers.push({ name: m[1], raw: l });
              }
            }
            endJson(res, 200, { ok: r.ok, servers, raw: r.stdout || r.stderr });
          });

          for (const op of ["add", "remove", "test", "login"] as const) {
            server.middlewares.use(`/__hermes_mcp_${op}`, async (req, res, next) => {
              if (req.method !== "POST") return next();
              if (!isLoopback(req)) return endJson(res, 403, { error: "loopback only" });
              let body: any;
              try { body = await readJsonBody(req); } catch { return endJson(res, 400, { error: "invalid JSON" }); }
              const name = String(body.name ?? "").trim();
              if (!name && op !== "add") return endJson(res, 400, { error: "name required" });
              const args: string[] = ["mcp"];
              if (op === "remove") args.push("remove", name);
              else if (op === "test") args.push("test", name);
              else if (op === "login") args.push("login", name);
              else { // add
                args.push("add", String(body.name ?? "").trim());
                if (body.url)     args.push("--url", String(body.url));
                if (body.command) args.push("--command", String(body.command));
                if (Array.isArray(body.args) && body.args.length > 0) args.push("--args", ...body.args.map(String));
              }
              const r = hermesCmd(args, 60_000);
              endJson(res, r.ok ? 200 : 500, { ok: r.ok, stdout: r.stdout, stderr: r.stderr });
            });
          }

          // ══════════════════════════════════════════════════════════════
          // /__search_chats — Campaign #90: full-text search across every
          //   past chat session on disk.
          //
          // Sources (in order):
          //   · ~/.claude/projects/**/*.jsonl    (Claude Code sessions)
          //   · ~/.hermes/sessions/*.jsonl       (Hermes Agent sessions)
          //
          // Each line of a jsonl session is one event {timestamp, message,
          // ...}. We grep for the query, then for each hit emit:
          //   { source, file, mtime, snippet, role, ts }
          //
          // Results are grouped per-file (one card per session) with up
          // to 3 best snippets per session, sorted by mtime desc.
          //
          // Implementation: use `rg` (ripgrep) if installed (10–100×
          // faster than grep). Falls back to a JS scanner. Hard cap at
          // 2000 grep results, 80 files surfaced.
          // ══════════════════════════════════════════════════════════════
          server.middlewares.use("/__search_chats", async (req, res, next) => {
            if (req.method !== "GET") return next();
            if (!isLoopback(req)) return endJson(res, 403, { error: "loopback only" });
            const url = new URL(req.url ?? "/", "http://x");
            const q = (url.searchParams.get("q") ?? "").trim();
            const sourceFilter = (url.searchParams.get("source") ?? "").trim();
            if (!q) return endJson(res, 400, { error: "q required" });

            const ROOTS: { source: "claude" | "hermes"; root: string }[] = [];
            const claudeRoot = join(HOME, ".claude", "projects");
            const hermesRoot = join(HOME, ".hermes", "sessions");
            if (existsSync(claudeRoot) && (!sourceFilter || sourceFilter === "claude")) ROOTS.push({ source: "claude", root: claudeRoot });
            if (existsSync(hermesRoot) && (!sourceFilter || sourceFilter === "hermes")) ROOTS.push({ source: "hermes", root: hermesRoot });

            // Try ripgrep first (spawnSync is top-level imported)
            function rgAvailable(): boolean {
              try { return spawnSync("which", ["rg"], { encoding: "utf-8" }).status === 0; } catch { return false; }
            }
            const haveRg = rgAvailable();

            type Hit = { source: "claude" | "hermes"; file: string; line: string; lineNo: number };
            const allHits: Hit[] = [];
            const MAX_HITS = 2000;

            for (const { source, root } of ROOTS) {
              if (allHits.length >= MAX_HITS) break;
              if (haveRg) {
                const r = spawnSync("rg", ["-i", "--no-heading", "-n", "-g", "*.jsonl", "--", q, root], {
                  encoding: "utf-8", maxBuffer: 32 * 1024 * 1024, timeout: 8000,
                });
                if (r.stdout) {
                  for (const out of r.stdout.split("\n")) {
                    if (allHits.length >= MAX_HITS) break;
                    if (!out.trim()) continue;
                    const m = /^(.+?):(\d+):(.*)$/.exec(out);
                    if (!m) continue;
                    allHits.push({ source, file: m[1], lineNo: parseInt(m[2], 10), line: m[3] });
                  }
                }
              } else {
                // Pure-JS scanner fallback
                const walk = (dir: string): void => {
                  if (allHits.length >= MAX_HITS) return;
                  try {
                    for (const name of readdirSync(dir)) {
                      if (allHits.length >= MAX_HITS) return;
                      const p = join(dir, name);
                      let st: ReturnType<typeof statSync>;
                      try { st = statSync(p); } catch { continue; }
                      if (st.isDirectory()) { walk(p); continue; }
                      if (!name.endsWith(".jsonl")) continue;
                      try {
                        const txt = readFileSync(p, "utf-8");
                        const qLow = q.toLowerCase();
                        let lineNo = 0;
                        for (const line of txt.split("\n")) {
                          lineNo++;
                          if (line.toLowerCase().includes(qLow)) {
                            allHits.push({ source, file: p, lineNo, line });
                            if (allHits.length >= MAX_HITS) return;
                          }
                        }
                      } catch { /* skip */ }
                    }
                  } catch { /* skip */ }
                };
                walk(root);
              }
            }

            // Group by file (one card per session)
            const byFile = new Map<string, { source: "claude" | "hermes"; file: string; mtime: number; hits: Hit[] }>();
            for (const h of allHits) {
              let mtime = 0;
              try { mtime = statSync(h.file).mtimeMs; } catch { /* skip */ }
              const entry = byFile.get(h.file) ?? { source: h.source, file: h.file, mtime, hits: [] };
              if (entry.hits.length < 3) entry.hits.push(h);
              byFile.set(h.file, entry);
            }
            // Extract one snippet per hit (try to find role + content fields,
            // otherwise just trim the raw line)
            function extractSnippet(raw: string): { role: string; text: string; ts: string | null } {
              let role = "?", text = raw, ts: string | null = null;
              try {
                const j = JSON.parse(raw);
                ts = j.timestamp ?? j.ts ?? j.created_at ?? null;
                if (typeof j.role === "string") role = j.role;
                else if (typeof j.message?.role === "string") role = j.message.role;
                else if (typeof j.type === "string") role = j.type;
                const content = j.message?.content ?? j.content;
                if (typeof content === "string") text = content;
                else if (Array.isArray(content)) {
                  text = content.map((c: any) => c?.text ?? "").filter(Boolean).join(" ").trim() || JSON.stringify(content).slice(0, 240);
                } else if (j.text) text = String(j.text);
              } catch { /* keep raw */ }
              // Trim around the match
              const qLow = q.toLowerCase();
              const idx = text.toLowerCase().indexOf(qLow);
              if (idx !== -1) {
                const start = Math.max(0, idx - 90);
                const end = Math.min(text.length, idx + q.length + 90);
                text = (start > 0 ? "…" : "") + text.slice(start, end) + (end < text.length ? "…" : "");
              } else if (text.length > 240) text = text.slice(0, 240) + "…";
              return { role, text, ts };
            }
            const groups = Array.from(byFile.values()).map((g) => ({
              source: g.source,
              file: g.file,
              fileName: g.file.split("/").pop() ?? g.file,
              mtime: g.mtime,
              hits: g.hits.map((h) => ({ lineNo: h.lineNo, ...extractSnippet(h.line) })),
            })).sort((a, b) => b.mtime - a.mtime).slice(0, 80);
            endJson(res, 200, { q, total: allHits.length, sessions: groups, usedRg: haveRg });
          });

          // GET /__chat_session?file=...&limit=100 — load a session for replay
          server.middlewares.use("/__chat_session", (req, res, next) => {
            if (req.method !== "GET") return next();
            if (!isLoopback(req)) return endJson(res, 403, { error: "loopback only" });
            const url = new URL(req.url ?? "/", "http://x");
            const file = url.searchParams.get("file") ?? "";
            if (!file) return endJson(res, 400, { error: "file required" });
            const resolved = resolve(file);
            const allowed = [resolve(HOME, ".claude", "projects"), resolve(HOME, ".hermes", "sessions")];
            if (!allowed.some((root) => resolved.startsWith(root + "/"))) return endJson(res, 403, { error: "path outside allowed roots" });
            if (!existsSync(resolved)) return endJson(res, 404, { error: "not found" });
            const limit = Math.min(2000, parseInt(url.searchParams.get("limit") ?? "300", 10));
            try {
              const txt = readFileSync(resolved, "utf-8");
              const lines = txt.split("\n").filter(Boolean).slice(-limit);
              const events = lines.map((l) => { try { return JSON.parse(l); } catch { return { raw: l }; } });
              endJson(res, 200, { file: resolved, count: events.length, events });
            } catch (e) {
              endJson(res, 500, { error: String(e) });
            }
          });

          // ══════════════════════════════════════════════════════════════
          // /__swarm_dispatch — Campaign #91: cross-engine swarm launcher.
          //
          // Takes one mission + a list of worker agents and:
          //   1. Creates a parent kanban task with the mission as body.
          //   2. Calls `hermes kanban decompose <parent_id>` so Hermes
          //      breaks the mission into child sub-tasks.
          //   3. Iterates the child tasks and round-robins them across
          //      the provided agent list, calling
          //      `hermes kanban assign <child> <agent>` for each.
          //   4. Returns { parentId, children: [{ id, assignee }] }.
          //
          // The actual execution is the kanban external dispatcher loop
          // we already built — it picks up each ready non-Hermes task
          // and runs it through /__agent_run. So the swarm wiring is a
          // thin orchestration layer over the existing engine, not a
          // parallel runtime.
          //
          // Supports any mix of:
          //   · Hermes pantheon profiles (maggie-walker, slim-charles, …)
          //   · Non-Hermes agents (codex, gemini, claudeclaw, openclaw,
          //     antigravity, ruflo, free-claude, notebooklm, hermes-mcp)
          //
          // ══════════════════════════════════════════════════════════════
          server.middlewares.use("/__swarm_dispatch", async (req, res, next) => {
            if (req.method !== "POST") return next();
            if (!isLoopback(req)) return endJson(res, 403, { error: "loopback only" });
            let body: any;
            try { body = await readJsonBody(req); } catch { return endJson(res, 400, { error: "invalid JSON" }); }
            const objective = String(body.objective ?? "").trim();
            const agents: string[] = (Array.isArray(body.agents) ? body.agents : []).map(String).filter(Boolean);
            if (!objective) return endJson(res, 400, { error: "objective required" });
            if (agents.length === 0) return endJson(res, 400, { error: "at least one agent required" });
            // 1. Create parent task in triage
            const create = kanbanCmd(["create", objective.slice(0, 180), "--body", objective, "--triage", "--json"]);
            if (!create.ok) return endJson(res, 500, { error: "parent create failed", stderr: create.stderr });
            let parent: any;
            try { parent = JSON.parse(create.stdout); } catch { return endJson(res, 500, { error: "parent create JSON parse failed" }); }
            // 2. Decompose
            const dec = kanbanCmd(["decompose", parent.id, "--json"]);
            const children: any[] = dec.stdout.trim().split("\n").filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
            // 3. Round-robin assign
            const assigned: { id: string; assignee: string }[] = [];
            for (let i = 0; i < children.length; i++) {
              const agent = agents[i % agents.length];
              const r = kanbanCmd(["assign", children[i].id, agent]);
              if (r.ok) assigned.push({ id: children[i].id, assignee: agent });
            }
            endJson(res, 200, {
              parentId: parent.id,
              parent,
              children,
              assigned,
              note: assigned.length === children.length
                ? "swarm assigned · kanban dispatcher will pick up ready tasks within ~60s"
                : `partial assignment: ${assigned.length}/${children.length}`,
            });
          });

          // ══════════════════════════════════════════════════════════════
          // /__workflow_* — Campaign #89: Dynamic Workflow / Swarm engine.
          //
          // The user's 7-phase spec asks for a mission planner that:
          //   1. Takes one plain-English mission
          //   2. Generates a plan (objectives, workstreams, agent roles,
          //      tasks, dependencies, verification requirements)
          //   3. Fans tasks out to specialist sub-agents (via the kanban
          //      external dispatcher we already shipped in #86)
          //   4. Runs judge/reviewer agents that verify outputs
          //   5. Persists every artifact for later audit
          //
          // Persistence: ~/.claude-os/workflows/<run_id>.json — one file
          // per run with the full lifecycle (plan, tasks, events,
          // verifications, artifacts). Plus a flat index in
          // ~/.claude-os/workflows/_index.json so the list endpoint
          // doesn't have to read every run on each request.
          //
          // The engine REUSES the swarm dispatcher (#91) for fan-out and
          // the kanban (#86) for execution — workflow_runs are a thin
          // record on top, not a parallel runtime.
          // ══════════════════════════════════════════════════════════════
          const WORKFLOWS_DIR = join(HOME, ".claude-os", "workflows");
          function ensureWorkflowsDir(): void {
            try { if (!existsSync(WORKFLOWS_DIR)) mkdirSync(WORKFLOWS_DIR, { recursive: true }); } catch { /* skip */ }
          }
          function loadWorkflowIndex(): { runs: any[] } {
            ensureWorkflowsDir();
            const p = join(WORKFLOWS_DIR, "_index.json");
            if (!existsSync(p)) return { runs: [] };
            try { return JSON.parse(readFileSync(p, "utf-8")); } catch { return { runs: [] }; }
          }
          function saveWorkflowIndex(idx: { runs: any[] }): void {
            ensureWorkflowsDir();
            writeFileSync(join(WORKFLOWS_DIR, "_index.json"), JSON.stringify({ runs: idx.runs.slice(-200) }, null, 2));
          }
          function loadWorkflow(id: string): any | null {
            const p = join(WORKFLOWS_DIR, `${id}.json`);
            if (!existsSync(p)) return null;
            try { return JSON.parse(readFileSync(p, "utf-8")); } catch { return null; }
          }
          function saveWorkflow(run: any): void {
            ensureWorkflowsDir();
            writeFileSync(join(WORKFLOWS_DIR, `${run.id}.json`), JSON.stringify(run, null, 2));
          }
          function newRunId(): string {
            return `wf_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
          }
          function uniqAgents(list: string[]): string[] {
            return Array.from(new Set(list));
          }

          // POST /__workflow_create { mission, agents?, autoVerify? }
          server.middlewares.use("/__workflow_create", async (req, res, next) => {
            if (req.method !== "POST") return next();
            if (!isLoopback(req)) return endJson(res, 403, { error: "loopback only" });
            let body: any;
            try { body = await readJsonBody(req); } catch { return endJson(res, 400, { error: "invalid JSON" }); }
            const mission = String(body.mission ?? "").trim();
            const agents = uniqAgents(Array.isArray(body.agents) && body.agents.length > 0
              ? body.agents.map(String)
              : ["claudeclaw", "gemini", "codex", "ruflo"]);
            const autoVerify = body.autoVerify !== false;
            if (!mission) return endJson(res, 400, { error: "mission required" });

            // 1. Create parent kanban task + decompose + round-robin assign
            const create = kanbanCmd(["create", mission.slice(0, 180), "--body", mission, "--triage", "--json"]);
            if (!create.ok) return endJson(res, 500, { error: "kanban parent create failed", stderr: create.stderr });
            let parent: any; try { parent = JSON.parse(create.stdout); } catch { return endJson(res, 500, { error: "parent JSON parse failed" }); }
            const dec = kanbanCmd(["decompose", parent.id, "--json"]);
            const children: any[] = dec.stdout.trim().split("\n").filter(Boolean)
              .map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
            const assigned: { id: string; assignee: string }[] = [];
            for (let i = 0; i < children.length; i++) {
              const a = agents[i % agents.length];
              if (kanbanCmd(["assign", children[i].id, a]).ok) assigned.push({ id: children[i].id, assignee: a });
            }
            // 2. Persist a workflow_run record
            const runId = newRunId();
            const run = {
              id: runId,
              mission,
              status: "running",
              created_at: Date.now(),
              created_by: "user",
              parentTaskId: parent.id,
              agents,
              children: children.map((c) => ({ id: c.id, title: c.title })),
              assigned,
              autoVerify,
              events: [{ kind: "created", at: Date.now() }],
              verification: null as null | { status: "pending" | "passed" | "failed"; verdict?: string; at?: number },
            };
            saveWorkflow(run);
            const idx = loadWorkflowIndex();
            idx.runs.push({ id: runId, mission: mission.slice(0, 180), status: run.status, created_at: run.created_at, parentTaskId: parent.id, taskCount: children.length });
            saveWorkflowIndex(idx);
            endJson(res, 200, { runId, parentTaskId: parent.id, children, assigned, autoVerify });
          });

          // GET /__workflow_list
          server.middlewares.use("/__workflow_list", (req, res, next) => {
            if (req.method !== "GET") return next();
            if (!isLoopback(req)) return endJson(res, 403, { error: "loopback only" });
            const idx = loadWorkflowIndex();
            // sort newest first, return last 100
            const runs = (idx.runs ?? []).slice().sort((a, b) => (b.created_at ?? 0) - (a.created_at ?? 0)).slice(0, 100);
            endJson(res, 200, { runs });
          });

          // GET /__workflow_show?id=X
          server.middlewares.use("/__workflow_show", (req, res, next) => {
            if (req.method !== "GET") return next();
            if (!isLoopback(req)) return endJson(res, 403, { error: "loopback only" });
            const id = new URL(req.url ?? "/", "http://x").searchParams.get("id");
            if (!id) return endJson(res, 400, { error: "id required" });
            const run = loadWorkflow(id);
            if (!run) return endJson(res, 404, { error: "not found" });
            // Cross-reference current kanban statuses for parent + each child
            const liveStatuses: Record<string, any> = {};
            try {
              const show = kanbanCmd(["show", run.parentTaskId, "--json"]);
              if (show.ok) liveStatuses[run.parentTaskId] = JSON.parse(show.stdout).task;
            } catch { /* skip */ }
            for (const c of run.children ?? []) {
              try {
                const show = kanbanCmd(["show", c.id, "--json"]);
                if (show.ok) liveStatuses[c.id] = JSON.parse(show.stdout).task;
              } catch { /* skip */ }
            }
            endJson(res, 200, { run, liveStatuses });
          });

          // POST /__workflow_verify { runId }
          //   Spawns a "judge" claude run that reads every child task's
          //   latest_summary + comments from the kanban and emits a
          //   pass/fail verdict against the mission's acceptance criteria.
          server.middlewares.use("/__workflow_verify", async (req, res, next) => {
            if (req.method !== "POST") return next();
            if (!isLoopback(req)) return endJson(res, 403, { error: "loopback only" });
            let body: any;
            try { body = await readJsonBody(req); } catch { return endJson(res, 400, { error: "invalid JSON" }); }
            const runId = String(body.runId ?? "");
            const run = loadWorkflow(runId);
            if (!run) return endJson(res, 404, { error: "run not found" });
            // Gather child outputs
            const childReports: string[] = [];
            for (const c of (run.children ?? [])) {
              try {
                const show = kanbanCmd(["show", c.id, "--json"]);
                if (!show.ok) continue;
                const det = JSON.parse(show.stdout);
                const summary = det.latest_summary ?? "(no summary)";
                const comments = (det.comments ?? []).map((cm: any) => `${cm.author}: ${cm.body}`).join("\n").slice(0, 800);
                childReports.push(`### ${c.id} · ${c.title}\nstatus: ${det.task.status}\nsummary: ${summary}\ncomments:\n${comments || "(none)"}`);
              } catch { /* skip */ }
            }
            const judgePrompt = `You are the Verification Judge for a Dynamic Workflow run.

MISSION:
${run.mission}

CHILD TASK OUTPUTS:
${childReports.join("\n\n---\n\n")}

Your job:
  1. Score the run pass/fail against the mission's implicit acceptance criteria.
  2. Identify any missing pieces, unsafe changes, hallucinated claims.
  3. Cite specific evidence from the child reports above.

Return EXACTLY this format on a single line first, then a body:
VERDICT: PASS  (or FAIL)
Then 3-6 short lines of reasoning. No fluff. No emojis.`;

            // Spawn claude as the judge
            const { spawn } = await import("node:child_process");
            const cp = spawn(CLAUDE_BIN, [
              "-p", judgePrompt,
              "--add-dir", process.cwd(),
              "--add-dir", join(HOME, ".claude-os"),
              "--permission-mode", "bypassPermissions",
            ], { cwd: process.cwd(), env: { ...process.env, FORCE_COLOR: "0", NO_COLOR: "1" } });
            try { cp.stdin?.end(); } catch { /* skip */ }
            const collected: string[] = [];
            cp.stdout.on("data", (d: Buffer) => collected.push(d.toString("utf-8")));
            cp.stderr.on("data", (d: Buffer) => collected.push(d.toString("utf-8")));
            await new Promise<void>((resolve) => { cp.on("close", () => resolve()); cp.on("error", () => resolve()); setTimeout(() => { try { cp.kill("SIGTERM"); } catch { /* skip */ } resolve(); }, 3 * 60_000); });
            const verdictText = collected.join("").trim();
            const passed = /VERDICT\s*:\s*PASS/i.test(verdictText);
            run.verification = { status: passed ? "passed" : "failed", verdict: verdictText.slice(0, 4000), at: Date.now() };
            run.events.push({ kind: "verified", at: Date.now(), payload: { status: run.verification.status } });
            run.status = passed ? "completed" : "needs_approval";
            saveWorkflow(run);
            // Update index
            const idx = loadWorkflowIndex();
            const entry = idx.runs.find((r: any) => r.id === runId);
            if (entry) { entry.status = run.status; saveWorkflowIndex(idx); }
            endJson(res, 200, { run });
          });

          // ══════════════════════════════════════════════════════════════
          // /__hyperedit_* — HyperEdit lifecycle for the /hyperedit page.
          //
          // HyperEdit needs TWO local processes:
          //   1. Its Vite dev server on :5173 (`npm run dev` in ~/code/hyperedit)
          //   2. Its FFmpeg/asset server on :3333 (`npm run ffmpeg-server`)
          //
          // Without (2) every upload silently fails because the asset POST
          // (session/{id}/assets) has no server to talk to. Users see the
          // upload widget, click it, nothing happens.
          //
          // GET  /__hyperedit_status      → { editor:bool, ffmpeg:bool }
          // POST /__hyperedit_ffmpeg_start → spawns `npm run ffmpeg-server`
          //                                  detached, logs to
          //                                  /tmp/hyperedit-ffmpeg.log, returns
          //                                  { ok, pid }. Idempotent — if
          //                                  already running, returns 409.
          // ══════════════════════════════════════════════════════════════
          server.middlewares.use("/__hyperedit_status", async (req, res, next) => {
            if (req.method !== "GET") return next();
            if (!isLoopback(req)) return endJson(res, 403, { error: "loopback only" });
            const probe = (port: number): Promise<boolean> => new Promise((r) => {
              // Use fetch (built-in Node 18+) so both IPv4 + IPv6 localhost
              // resolve correctly. Vite servers often bind IPv6-only, which
              // would fail a raw 127.0.0.1 TCP connect.
              fetch(`http://localhost:${port}/`, { signal: AbortSignal.timeout(2000) })
                .then(() => r(true))
                .catch(() => r(false));
            });
            // The editor must NOT be probed on 5173 — that's Baseline OS
            // itself (this app), which would always report "live" and iframe
            // the dashboard into itself. The hyperedit editor lands on the
            // next free vite port (5174+) when Baseline OS already holds 5173.
            // Probe a configurable range server-side (no browser CORS limits).
            const envPort = Number(process.env.HYPEREDIT_PORT) || 0;
            const candidates = envPort ? [envPort] : [5174, 5175, 5176, 5177, 5178];
            const probed = await Promise.all(candidates.map(async (p) => [p, await probe(p)] as const));
            const live = probed.find(([, ok]) => ok);
            const ffmpeg = await probe(3333);
            endJson(res, 200, {
              editor: !!live,
              ffmpeg,
              ports: { editor: live ? live[0] : candidates[0], ffmpeg: 3333 },
            });
          });

          server.middlewares.use("/__hyperedit_ffmpeg_start", async (req, res, next) => {
            if (req.method !== "POST") return next();
            if (!isLoopback(req)) return endJson(res, 403, { error: "loopback only" });
            // Already running? bail.
            const isUp = await new Promise<boolean>((r) => {
              fetch("http://localhost:3333/", { signal: AbortSignal.timeout(1500) })
                .then(() => r(true))
                .catch(() => r(false));
            });
            if (isUp) return endJson(res, 409, { ok: false, error: "ffmpeg server already running on :3333" });

            const hyperRepo = join(HOME, "code", "hyperedit");
            if (!existsSync(hyperRepo)) return endJson(res, 404, { error: `hyperedit repo not at ${hyperRepo}` });
            const logPath = "/tmp/hyperedit-ffmpeg.log";
            try {
              const fd = openSync(logPath, "a");
              const cp = spawn("npm", ["run", "ffmpeg-server"], {
                cwd: hyperRepo,
                env: { ...process.env, FORCE_COLOR: "0" },
                detached: true,
                stdio: ["ignore", fd, fd],
              });
              cp.unref();
              // Wait up to 8s for the server to come up
              for (let i = 0; i < 16; i++) {
                await new Promise((r) => setTimeout(r, 500));
                const up = await new Promise<boolean>((r) => {
                  const sock = createConnection({ port: 3333, host: "127.0.0.1" }, () => { sock.end(); r(true); });
                  sock.on("error", () => r(false));
                  setTimeout(() => { try { sock.destroy(); } catch { /* skip */ } r(false); }, 600);
                });
                if (up) return endJson(res, 200, { ok: true, pid: cp.pid, logPath });
              }
              endJson(res, 504, { ok: false, error: "spawned but didn't bind :3333 within 8s — check log", logPath, pid: cp.pid });
            } catch (e) {
              endJson(res, 500, { ok: false, error: String(e) });
            }
          });

          // GET/POST /__hermes_kanban — Kanban task board
          // Backed by ~/.claude-os/kanban.json
          // ══════════════════════════════════════════════════════════════
          server.middlewares.use("/__hermes_kanban", async (req, res) => {
            const { readFile, writeFile, mkdir } = await import("node:fs/promises");
            const { existsSync: exSync } = await import("node:fs");
            const { homedir } = await import("node:os");
            const nodePath = await import("node:path");

            const kanbanPath = nodePath.join(homedir(), ".claude-os", "kanban.json");

            async function loadTasks() {
              try {
                if (!exSync(kanbanPath)) return [];
                const raw = await readFile(kanbanPath, "utf8") as string;
                return JSON.parse(raw) as Array<{ id: string; title: string; status: string; createdAt: number }>;
              } catch { return []; }
            }

            async function saveTasks(tasks: unknown[]) {
              const dir = nodePath.join(homedir(), ".claude-os");
              if (!exSync(dir)) await mkdir(dir, { recursive: true });
              await writeFile(kanbanPath, JSON.stringify(tasks, null, 2));
            }

            if (req.method === "GET") {
              const tasks = await loadTasks();
              res.setHeader("Content-Type", "application/json");
              res.setHeader("Cache-Control", "no-cache");
              res.end(JSON.stringify({ tasks }));
              return;
            }

            if (req.method === "POST") {
              let body = "";
              req.on("data", (chunk: Buffer) => { body += chunk.toString(); });
              req.on("end", async () => {
                try {
                  const parsed = JSON.parse(body) as { action: string; title?: string; status?: string; id?: string };
                  const tasks = await loadTasks();

                  if (parsed.action === "add" && parsed.title) {
                    const newTask = { id: `task-${Date.now()}`, title: (parsed.title as string).slice(0, 200), status: parsed.status || "todo", createdAt: Date.now() };
                    tasks.push(newTask);
                    await saveTasks(tasks);
                    res.setHeader("Content-Type", "application/json");
                    res.end(JSON.stringify({ tasks }));
                  } else if (parsed.action === "move" && parsed.id && parsed.status) {
                    const task = tasks.find((t: { id: string }) => t.id === parsed.id);
                    if (task) (task as { status: string }).status = parsed.status as string;
                    await saveTasks(tasks);
                    res.setHeader("Content-Type", "application/json");
                    res.end(JSON.stringify({ tasks }));
                  } else if (parsed.action === "delete" && parsed.id) {
                    const filtered = tasks.filter((t: { id: string }) => t.id !== parsed.id);
                    await saveTasks(filtered);
                    res.setHeader("Content-Type", "application/json");
                    res.end(JSON.stringify({ tasks: filtered }));
                  } else {
                    res.statusCode = 400;
                    res.end(JSON.stringify({ error: "invalid action" }));
                  }
                } catch {
                  res.statusCode = 400;
                  res.end(JSON.stringify({ error: "invalid json" }));
                }
              });
              return;
            }

            res.statusCode = 405;
            res.end();
          });

          // ══════════════════════════════════════════════════════════════
          // GET /__workspace?dir=<agent> — file browser for agent output dirs
          //   agent ∈ { hermes | openclaw | gemini | codex }
          //   returns: { files: [{ name, path, size, mtime, kind }] }
          // GET /__workspace_file?path=<abs-path> — single file preview
          //   returns: { text } for text/markdown, { dataUrl } for images
          // ══════════════════════════════════════════════════════════════
          server.middlewares.use("/__workspace", async (req, res) => {
            const { readdir, stat } = await import("node:fs/promises");
            const { existsSync: exSync } = await import("node:fs");
            const { homedir } = await import("node:os");
            const nodePath = await import("node:path");

            const url = new URL(req.url ?? "/", "http://x");
            const agent = (url.searchParams.get("dir") ?? "").toLowerCase();

            const DIRS: Record<string, string[]> = {
              hermes:   [".hermes/sessions", ".hermes/memories", ".hermes/pantheon/personas"],
              openclaw: [".openclaw", ".claude-os/openclaw"],
              gemini:   [".claude-os/gemini"],
              codex:    [".claude-os/codex", ".codex"],
              studio:   [".claude-os/studio"],
            };

            const roots = (DIRS[agent] ?? []).map((p) => nodePath.join(homedir(), p));

            const all: { name: string; path: string; size: number; mtime: number; kind: string; bucket: string }[] = [];

            async function walk(root: string, bucket: string, depth = 0) {
              if (depth > 3 || !exSync(root)) return;
              try {
                const entries = await readdir(root, { withFileTypes: true });
                for (const ent of entries) {
                  if (ent.name.startsWith(".")) continue;
                  const full = nodePath.join(root, ent.name);
                  if (ent.isDirectory()) { await walk(full, bucket, depth + 1); continue; }
                  if (!ent.isFile()) continue;
                  try {
                    const st = await stat(full);
                    const ext = nodePath.extname(ent.name).slice(1).toLowerCase();
                    const kind = /png|jpe?g|gif|webp|svg/.test(ext) ? "image"
                               : /md|txt|json|yaml|yml|jsonl|log/.test(ext) ? "text"
                               : /mp4|webm|mov/.test(ext) ? "video"
                               : /mp3|wav|ogg/.test(ext) ? "audio"
                               : "file";
                    all.push({ name: ent.name, path: full, size: st.size, mtime: st.mtimeMs, kind, bucket });
                  } catch { /* skip */ }
                }
              } catch { /* skip */ }
            }

            for (const r of roots) await walk(r, nodePath.basename(r));

            all.sort((a, b) => b.mtime - a.mtime);
            res.setHeader("Content-Type", "application/json");
            res.setHeader("Cache-Control", "no-cache");
            res.end(JSON.stringify({ files: all.slice(0, 200) }));
          });

          server.middlewares.use("/__workspace_file", async (req, res) => {
            const { readFile } = await import("node:fs/promises");
            const { existsSync: exSync } = await import("node:fs");
            const { homedir } = await import("node:os");
            const nodePath = await import("node:path");

            const url = new URL(req.url ?? "/", "http://x");
            const filePath = url.searchParams.get("path") ?? "";

            const home = homedir();
            const resolved = nodePath.resolve(filePath);
            if (!resolved.startsWith(home) || !exSync(resolved)) {
              res.statusCode = 404;
              res.end(JSON.stringify({ error: "not found" }));
              return;
            }
            const ext = nodePath.extname(resolved).slice(1).toLowerCase();
            res.setHeader("Content-Type", "application/json");
            res.setHeader("Cache-Control", "no-cache");
            try {
              if (/png|jpe?g|gif|webp|svg/.test(ext)) {
                const buf = await readFile(resolved);
                const mime = ext === "svg" ? "image/svg+xml" : `image/${ext === "jpg" ? "jpeg" : ext}`;
                res.end(JSON.stringify({ kind: "image", dataUrl: `data:${mime};base64,${buf.toString("base64")}` }));
              } else if (/mp4|webm|mov|mp3|wav|ogg/.test(ext)) {
                res.end(JSON.stringify({ kind: "media", note: "media files served via raw path; use /__workspace_raw" }));
              } else {
                const text = await readFile(resolved, "utf8") as string;
                res.end(JSON.stringify({ kind: "text", text: text.slice(0, 200_000) }));
              }
            } catch (e) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: String(e) }));
            }
          });

          // ══════════════════════════════════════════════════════════════
          // /__studio_history — GET list, POST save
          //   storage: ~/.claude-os/studio/<kind>/<ts>.json
          // ══════════════════════════════════════════════════════════════
          server.middlewares.use("/__studio_history", async (req, res) => {
            const { readFile, writeFile, mkdir, readdir, unlink } = await import("node:fs/promises");
            const { existsSync: exSync } = await import("node:fs");
            const { homedir } = await import("node:os");
            const nodePath = await import("node:path");

            const root = nodePath.join(homedir(), ".claude-os", "studio");

            if (req.method === "GET") {
              const url = new URL(req.url ?? "/", "http://x");
              const kind = (url.searchParams.get("kind") ?? "").replace(/[^a-z0-9_-]/gi, "");
              const dir = kind ? nodePath.join(root, kind) : root;
              const items: { id: string; kind: string; prompt: string; result: string; ts: number }[] = [];
              if (exSync(dir)) {
                try {
                  if (kind) {
                    const files = await readdir(dir);
                    for (const f of files.filter((f) => f.endsWith(".json"))) {
                      try {
                        const raw = await readFile(nodePath.join(dir, f), "utf8") as string;
                        items.push(JSON.parse(raw));
                      } catch { /* skip */ }
                    }
                  } else {
                    const subs = await readdir(root);
                    for (const sub of subs) {
                      const sd = nodePath.join(root, sub);
                      try {
                        const files = await readdir(sd);
                        for (const f of files.filter((f) => f.endsWith(".json"))) {
                          try {
                            const raw = await readFile(nodePath.join(sd, f), "utf8") as string;
                            items.push(JSON.parse(raw));
                          } catch { /* skip */ }
                        }
                      } catch { /* skip */ }
                    }
                  }
                } catch { /* skip */ }
              }
              items.sort((a, b) => b.ts - a.ts);
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ items: items.slice(0, 100) }));
              return;
            }

            if (req.method === "POST") {
              let body = "";
              req.on("data", (c: Buffer) => { body += c.toString(); });
              req.on("end", async () => {
                try {
                  const parsed = JSON.parse(body) as { kind: string; prompt: string; result: string; id?: string };
                  const kind = (parsed.kind || "misc").replace(/[^a-z0-9_-]/gi, "");
                  const id = parsed.id || `${Date.now()}`;
                  const dir = nodePath.join(root, kind);
                  if (!exSync(dir)) await mkdir(dir, { recursive: true });
                  const entry = { id, kind, prompt: parsed.prompt, result: parsed.result, ts: Date.now() };
                  await writeFile(nodePath.join(dir, `${id}.json`), JSON.stringify(entry, null, 2));
                  res.setHeader("Content-Type", "application/json");
                  res.end(JSON.stringify(entry));
                } catch (e) {
                  res.statusCode = 400;
                  res.end(JSON.stringify({ error: String(e) }));
                }
              });
              return;
            }

            if (req.method === "DELETE") {
              const url = new URL(req.url ?? "/", "http://x");
              const kind = (url.searchParams.get("kind") ?? "").replace(/[^a-z0-9_-]/gi, "");
              const id = (url.searchParams.get("id") ?? "").replace(/[^a-z0-9_-]/gi, "");
              if (kind && id) {
                const p = nodePath.join(root, kind, `${id}.json`);
                try { await unlink(p); } catch { /* skip */ }
              }
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ ok: true }));
              return;
            }

            res.statusCode = 405;
            res.end();
          });

          // ══════════════════════════════════════════════════════════════
          // /__skills_shared — Shared skill library readable by all agents.
          //   GET                → { total, skills: [{ name, path, desc, cat, tags }] }
          //   GET ?name=<name>   → returns { name, content } of SKILL.md
          // Backed by ~/.claude-os/skills/SKILL_INDEX.json
          // ══════════════════════════════════════════════════════════════
          server.middlewares.use("/__skills_shared", async (req, res) => {
            const { readFile } = await import("node:fs/promises");
            const { existsSync: exSync } = await import("node:fs");
            const { homedir } = await import("node:os");
            const nodePath = await import("node:path");

            const root = nodePath.join(homedir(), ".claude-os", "skills");
            const indexPath = nodePath.join(root, "SKILL_INDEX.json");

            const url = new URL(req.url ?? "/", "http://x");
            const name = url.searchParams.get("name");

            if (name) {
              const safe = name.replace(/\.\./g, "").replace(/[^a-zA-Z0-9 ._\-\/]/g, "");
              try {
                if (!exSync(indexPath)) {
                  res.statusCode = 404;
                  res.end(JSON.stringify({ error: "index missing" }));
                  return;
                }
                const idx = JSON.parse(await readFile(indexPath, "utf8") as string) as { skills: { name: string; path: string }[] };
                const skill = idx.skills.find((s) => s.name === safe);
                if (!skill) {
                  res.statusCode = 404;
                  res.end(JSON.stringify({ error: "skill not found" }));
                  return;
                }
                const md = nodePath.join(root, skill.path);
                const text = await readFile(md, "utf8") as string;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ name: skill.name, path: skill.path, content: text.slice(0, 100_000) }));
              } catch (e) {
                res.statusCode = 500;
                res.end(JSON.stringify({ error: String(e) }));
              }
              return;
            }

            try {
              if (!exSync(indexPath)) {
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ total: 0, skills: [], note: "no SKILL_INDEX yet — install via slim-charles-agency-knowledge-base" }));
                return;
              }
              const idx = JSON.parse(await readFile(indexPath, "utf8") as string);
              res.setHeader("Content-Type", "application/json");
              res.setHeader("Cache-Control", "no-cache");
              res.end(JSON.stringify(idx));
            } catch (e) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: String(e) }));
            }
          });

          // ══════════════════════════════════════════════════════════════
          // /__cli_registry — Registry of CLI-Anything tool wrappers.
          // Reads /tmp/agent-os-repos/CLI-Anything or ~/.claude-os/cli-anything
          // Returns: { tools: [{ name, hasSkill, path }] }
          // ══════════════════════════════════════════════════════════════
          server.middlewares.use("/__cli_registry", async (req, res) => {
            const { readdir, stat } = await import("node:fs/promises");
            const { existsSync: exSync } = await import("node:fs");
            const { homedir } = await import("node:os");
            const nodePath = await import("node:path");

            // Candidate paths. We walk ALL of them and union by tool name
            // because different installers drop harnesses in different roots:
            //   · ~/.claude-os/cli-anything                            (legacy git clone, no prefix)
            //   · /tmp/agent-os-repos/CLI-Anything                     (legacy git clone, no prefix)
            //   · ~/.claude-os/skills/CLI-Anything/skills              (older skills-installer layout, cli-anything- prefix)
            //   · ~/.agents/skills                                     (current skills-installer global layout)
            const candidates = [
              { dir: nodePath.join(homedir(), ".claude-os", "cli-anything"),                     strip: ""              },
              { dir: "/tmp/agent-os-repos/CLI-Anything",                                          strip: ""              },
              { dir: nodePath.join(homedir(), ".claude-os", "skills", "CLI-Anything", "skills"), strip: "cli-anything-" },
              { dir: nodePath.join(homedir(), ".agents", "skills"),                              strip: "cli-anything-" },
            ];
            const hits = candidates.filter((c) => exSync(c.dir));

            if (hits.length === 0) {
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ tools: [], note: "CLI-Anything not installed. Run `npx skills add HKUDS/CLI-Anything -g -y` to install the harnesses, or clone https://github.com/WaltLuv/CLI-Anything to /tmp/agent-os-repos/CLI-Anything." }));
              return;
            }

            try {
              const byName = new Map<string, { name: string; path: string; hasSkill: boolean }>();
              for (const hit of hits) {
                const entries = await readdir(hit.dir, { withFileTypes: true });
                for (const e of entries) {
                  if (!e.isDirectory()) continue;
                  if (e.name.startsWith(".") || e.name === "node_modules" || e.name === "docs" || e.name === "assets" || e.name === "tests") continue;
                  if (e.name === "cli-hub-meta-skill" || e.name === "cli-anything") continue;   // meta-skills, not harnesses
                  // For the prefixed roots, the bare "cli-anything" pseudo-skill
                  // is a meta-template — skip it too.
                  if (hit.strip && e.name === hit.strip.replace(/-$/, "")) continue;
                  const dir = nodePath.join(hit.dir, e.name);
                  try {
                    const sub = await readdir(dir);
                    const hasSkill = sub.some((f) => f.toUpperCase() === "SKILL.MD" || f.toUpperCase() === "SKILL.MARKDOWN" || f === "SKILL.md");
                    if (!hasSkill) continue;   // only count harnesses with a SKILL.md
                    const st = await stat(dir);
                    if (!st.isDirectory()) continue;
                    const display = hit.strip && e.name.startsWith(hit.strip) ? e.name.slice(hit.strip.length) : e.name;
                    // Union: first writer wins so the canonical claude-os path
                    // is preferred when both exist with the same logical name.
                    if (!byName.has(display)) byName.set(display, { name: display, path: dir, hasSkill });
                  } catch { /* skip */ }
                }
              }
              const tools = [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
              res.setHeader("Content-Type", "application/json");
              res.setHeader("Cache-Control", "no-cache");
              res.end(JSON.stringify({ tools, root: hits.map((h) => h.dir).join(" + ") }));
            } catch (e) {
              res.statusCode = 500;
              res.end(JSON.stringify({ error: String(e) }));
            }
          });

          // ══════════════════════════════════════════════════════════════
          // Higgsfield MCP live data — wraps the `higgsfield` CLI for the
          // /higgsfield page. All endpoints are loopback-only and return the
          // JSON shape the CLI emits with `--json`.
          //
          //   GET /__higgsfield_account        → email, credits, plan
          //   GET /__higgsfield_generations    → list of generation jobs
          //   GET /__higgsfield_workspaces     → workspace + role + credits
          //   GET /__higgsfield_transactions   → credit history (last 30)
          //   GET /__higgsfield_models?type=image|video|all
          //   POST /__higgsfield_generate     { model, prompt, aspect? }
          // ══════════════════════════════════════════════════════════════
          async function hfCall(args: string[], timeoutMs = 30_000): Promise<{ ok: boolean; stdout: string; stderr: string }> {
            const { execFile } = await import("node:child_process");
            const { promisify } = await import("node:util");
            const { existsSync } = await import("node:fs");
            const efp = promisify(execFile);
            const candidates = ["higgsfield", "/opt/homebrew/bin/higgsfield", "/usr/local/bin/higgsfield"];
            const bin = candidates.find((c) => c === "higgsfield" || existsSync(c)) ?? "higgsfield";
            try {
              const r = await efp(bin, [...args, "--json"], { timeout: timeoutMs, maxBuffer: 8 * 1024 * 1024 }) as { stdout: string; stderr: string };
              return { ok: true, stdout: r.stdout, stderr: r.stderr };
            } catch (e: unknown) {
              const err = e as { stdout?: string; stderr?: string; message?: string };
              return { ok: false, stdout: err.stdout ?? "", stderr: err.stderr ?? err.message ?? String(e) };
            }
          }

          server.middlewares.use("/__higgsfield_account", async (req, res) => {
            const r = await hfCall(["account", "status"]);
            res.setHeader("Content-Type", "application/json");
            if (!r.ok) { res.statusCode = 503; res.end(JSON.stringify({ ok: false, error: r.stderr || "higgsfield CLI not available — run `npm install -g @higgsfield/cli && higgsfield auth login`" })); return; }
            try { res.end(JSON.stringify({ ok: true, ...JSON.parse(r.stdout) })); }
            catch { res.end(JSON.stringify({ ok: true, raw: r.stdout })); }
          });

          server.middlewares.use("/__higgsfield_generations", async (req, res) => {
            const r = await hfCall(["generate", "list"]);
            res.setHeader("Content-Type", "application/json");
            if (!r.ok) { res.statusCode = 503; res.end(JSON.stringify({ ok: false, error: r.stderr })); return; }
            try { res.end(JSON.stringify({ ok: true, generations: JSON.parse(r.stdout) })); }
            catch { res.end(JSON.stringify({ ok: true, raw: r.stdout })); }
          });

          server.middlewares.use("/__higgsfield_workspaces", async (req, res) => {
            const r = await hfCall(["workspace", "list"]);
            res.setHeader("Content-Type", "application/json");
            if (!r.ok) { res.statusCode = 503; res.end(JSON.stringify({ ok: false, error: r.stderr })); return; }
            try { res.end(JSON.stringify({ ok: true, workspaces: JSON.parse(r.stdout) })); }
            catch { res.end(JSON.stringify({ ok: true, raw: r.stdout })); }
          });

          server.middlewares.use("/__higgsfield_transactions", async (req, res) => {
            const url = new URL(req.url ?? "/", "http://x");
            const size = (url.searchParams.get("size") ?? "30").replace(/[^0-9]/g, "") || "30";
            const r = await hfCall(["account", "transactions", "--size", size]);
            res.setHeader("Content-Type", "application/json");
            if (!r.ok) { res.statusCode = 503; res.end(JSON.stringify({ ok: false, error: r.stderr })); return; }
            try { res.end(JSON.stringify({ ok: true, transactions: JSON.parse(r.stdout) })); }
            catch { res.end(JSON.stringify({ ok: true, raw: r.stdout })); }
          });

          server.middlewares.use("/__higgsfield_models", async (req, res) => {
            const url = new URL(req.url ?? "/", "http://x");
            const type = (url.searchParams.get("type") ?? "all").replace(/[^a-z]/g, "");
            const args = type === "image" ? ["model", "list", "--image"] :
                         type === "video" ? ["model", "list", "--video"] :
                         ["model", "list"];
            const r = await hfCall(args);
            res.setHeader("Content-Type", "application/json");
            if (!r.ok) { res.statusCode = 503; res.end(JSON.stringify({ ok: false, error: r.stderr })); return; }
            try { res.end(JSON.stringify({ ok: true, models: JSON.parse(r.stdout) })); }
            catch { res.end(JSON.stringify({ ok: true, raw: r.stdout })); }
          });

          server.middlewares.use("/__higgsfield_generate", async (req, res) => {
            if (req.method !== "POST") { res.statusCode = 405; res.end(); return; }
            let body = "";
            req.on("data", (c: Buffer) => { body += c.toString(); });
            req.on("end", async () => {
              try {
                const parsed = JSON.parse(body) as { model?: string; prompt: string; aspect?: string };
                const model = (parsed.model ?? "nano_banana_2").replace(/[^a-z0-9_]/gi, "");
                if (!parsed.prompt) { res.statusCode = 400; res.end(JSON.stringify({ error: "prompt required" })); return; }
                const args = ["generate", "create", model, "--prompt", parsed.prompt.slice(0, 2000)];
                // Higgsfield CLI uses `--aspect_ratio` not `--aspect` (verified
                // 2026-05-30 against `hf model get veo3_1` + nano_banana_2 —
                // both accept aspect_ratio with values like 16:9, 9:16, 1:1).
                if (parsed.aspect) args.push("--aspect_ratio", parsed.aspect.replace(/[^0-9:]/g, ""));
                const r = await hfCall(args, 60_000);
                res.setHeader("Content-Type", "application/json");
                if (!r.ok) { res.statusCode = 503; res.end(JSON.stringify({ ok: false, error: r.stderr })); return; }
                try {
                  const jobIds = JSON.parse(r.stdout) as string[];
                  res.end(JSON.stringify({ ok: true, jobIds }));
                } catch { res.end(JSON.stringify({ ok: true, raw: r.stdout })); }
              } catch (e) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: String(e) }));
              }
            });
          });

          // ══════════════════════════════════════════════════════════════
          // /__higgsfield_dashboard — Serves dashboard.html from cloned repo
          //   GET  → raw HTML so /higgsfield can iframe it.
          // ══════════════════════════════════════════════════════════════
          server.middlewares.use("/__higgsfield_dashboard", async (req, res) => {
            const { readFile } = await import("node:fs/promises");
            const { existsSync: exSync } = await import("node:fs");
            const candidates = [
              "/tmp/agent-os-repos/higgsfield-supercomputer/dashboard.html",
              `${process.env.HOME}/.claude-os/higgsfield/dashboard.html`,
            ];
            const found = candidates.find(exSync);
            if (!found) {
              res.statusCode = 404;
              res.setHeader("Content-Type", "text/html");
              res.end("<h1>Higgsfield dashboard not found</h1><p>Clone https://github.com/WaltLuv/higgsfield-supercomputer to /tmp/agent-os-repos/higgsfield-supercomputer</p>");
              return;
            }
            try {
              const html = await readFile(found, "utf8") as string;
              res.setHeader("Content-Type", "text/html; charset=utf-8");
              res.end(html);
            } catch (e) {
              res.statusCode = 500;
              res.end(`<pre>${String(e)}</pre>`);
            }
          });

          // ══════════════════════════════════════════════════════════════
          // Ollama — local Gemma 4 + any other Ollama model.
          //   GET  /__ollama_status          → { ok, host, models[], default }
          //   POST /__ollama_chat            → { model, messages } streams NDJSON deltas
          // ══════════════════════════════════════════════════════════════
          const OLLAMA_HOST = (process.env.OLLAMA_HOST ?? "http://127.0.0.1:11434").replace(/\/+$/, "");
          const OLLAMA_DEFAULT = process.env.OLLAMA_DEFAULT_MODEL ?? "gemma4:31b";

          server.middlewares.use("/__ollama_status", async (req, res) => {
            res.setHeader("Content-Type", "application/json");
            res.setHeader("Cache-Control", "no-cache");
            try {
              const r = await fetch(`${OLLAMA_HOST}/api/tags`, { signal: AbortSignal.timeout(3000) });
              if (!r.ok) {
                res.end(JSON.stringify({ ok: false, host: OLLAMA_HOST, error: `HTTP ${r.status}` }));
                return;
              }
              const j = await r.json() as { models?: { name: string; size: number; modified_at: string }[] };
              res.end(JSON.stringify({
                ok: true,
                host: OLLAMA_HOST,
                default: OLLAMA_DEFAULT,
                models: (j.models ?? []).map((m) => ({ name: m.name, sizeMB: Math.round(m.size / 1024 / 1024), modified: m.modified_at })),
              }));
            } catch (e) {
              res.end(JSON.stringify({ ok: false, host: OLLAMA_HOST, error: String(e), hint: "Run `ollama serve` or open the Ollama desktop app." }));
            }
          });

          server.middlewares.use("/__ollama_chat", async (req, res) => {
            if (req.method !== "POST") { res.statusCode = 405; res.end(); return; }
            let body = "";
            req.on("data", (c: Buffer) => { body += c.toString(); });
            req.on("end", async () => {
              try {
                const parsed = JSON.parse(body) as { model?: string; messages: { role: string; content: string }[]; prompt?: string };
                const messages = parsed.messages ?? (parsed.prompt ? [{ role: "user", content: parsed.prompt }] : []);
                const r = await fetch(`${OLLAMA_HOST}/api/chat`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ model: parsed.model ?? OLLAMA_DEFAULT, messages, stream: true }),
                });
                if (!r.ok || !r.body) {
                  res.statusCode = r.status;
                  res.setHeader("Content-Type", "application/json");
                  res.end(JSON.stringify({ error: `Ollama ${r.status}` }));
                  return;
                }
                res.setHeader("Content-Type", "application/x-ndjson");
                res.setHeader("Cache-Control", "no-cache");
                const reader = r.body.getReader();
                const decoder = new TextDecoder();
                let buf = "";
                while (true) {
                  const { value, done } = await reader.read();
                  if (done) break;
                  buf += decoder.decode(value, { stream: true });
                  const lines = buf.split("\n");
                  buf = lines.pop() ?? "";
                  for (const line of lines) {
                    if (!line.trim()) continue;
                    try {
                      const evt = JSON.parse(line) as { message?: { content?: string }; done?: boolean };
                      const delta = evt.message?.content ?? "";
                      if (delta) res.write(JSON.stringify({ type: "delta", delta }) + "\n");
                      if (evt.done) res.write(JSON.stringify({ type: "done" }) + "\n");
                    } catch { /* skip non-JSON */ }
                  }
                }
                res.end();
              } catch (e) {
                res.statusCode = 500;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ error: String(e) }));
              }
            });
          });

          // ══════════════════════════════════════════════════════════════
          // Pinecone — long-term vector memory (semantic search + store).
          //   Auth: PINECONE_API_KEY + PINECONE_INDEX_HOST (set in .env.local)
          //   POST /__pinecone_query   body { text, topK? } → { matches[] }
          //   POST /__pinecone_upsert  body { text, metadata? } → { id }
          //   GET  /__pinecone_status  → { ok, indexHost, indexName, dim }
          // ══════════════════════════════════════════════════════════════
          async function pineconeEmbed(text: string, inputType: "query" | "passage"): Promise<number[] | null> {
            const key = process.env.PINECONE_API_KEY;
            if (!key) return null;
            const model = process.env.PINECONE_EMBED_MODEL ?? "multilingual-e5-large";
            const r = await fetch("https://api.pinecone.io/embed", {
              method: "POST",
              headers: {
                "Api-Key": key,
                "Content-Type": "application/json",
                "X-Pinecone-API-Version": "2025-01",
              },
              body: JSON.stringify({
                model,
                inputs: [{ text }],
                parameters: { input_type: inputType, truncate: "END" },
              }),
            });
            if (!r.ok) throw new Error(`embed ${r.status}: ${(await r.text()).slice(0, 200)}`);
            const j = await r.json() as { data?: { values?: number[] }[] };
            return j.data?.[0]?.values ?? null;
          }

          server.middlewares.use("/__pinecone_status", async (req, res) => {
            res.setHeader("Content-Type", "application/json");
            const key = process.env.PINECONE_API_KEY;
            const host = process.env.PINECONE_INDEX_HOST;
            const name = process.env.PINECONE_INDEX_NAME ?? "claude-os";
            if (!key || !host) {
              res.end(JSON.stringify({ ok: false, error: "PINECONE_API_KEY + PINECONE_INDEX_HOST required in .env.local", indexName: name }));
              return;
            }
            try {
              const r = await fetch(`https://${host.replace(/^https?:\/\//, "")}/describe_index_stats`, {
                method: "POST",
                headers: { "Api-Key": key, "Content-Type": "application/json" },
                body: "{}",
                signal: AbortSignal.timeout(5000),
              });
              const j = await r.json() as { dimension?: number; totalVectorCount?: number; namespaces?: Record<string, { vectorCount: number }> };
              res.end(JSON.stringify({ ok: r.ok, indexHost: host, indexName: name, dim: j.dimension, totalVectors: j.totalVectorCount, namespaces: j.namespaces }));
            } catch (e) {
              res.end(JSON.stringify({ ok: false, error: String(e) }));
            }
          });

          server.middlewares.use("/__pinecone_query", async (req, res) => {
            if (req.method !== "POST") { res.statusCode = 405; res.end(); return; }
            let body = "";
            req.on("data", (c: Buffer) => { body += c.toString(); });
            req.on("end", async () => {
              try {
                const parsed = JSON.parse(body) as { text: string; topK?: number };
                const host = process.env.PINECONE_INDEX_HOST;
                const key = process.env.PINECONE_API_KEY;
                if (!host || !key) {
                  res.statusCode = 503;
                  res.end(JSON.stringify({ error: "Pinecone not configured" }));
                  return;
                }
                const vec = await pineconeEmbed(parsed.text, "query");
                if (!vec) { res.statusCode = 500; res.end(JSON.stringify({ error: "embed failed" })); return; }
                const r = await fetch(`https://${host.replace(/^https?:\/\//, "")}/query`, {
                  method: "POST",
                  headers: { "Api-Key": key, "Content-Type": "application/json" },
                  body: JSON.stringify({ vector: vec, topK: parsed.topK ?? 5, includeMetadata: true }),
                });
                res.setHeader("Content-Type", "application/json");
                res.end(await r.text());
              } catch (e) {
                res.statusCode = 500;
                res.end(JSON.stringify({ error: String(e) }));
              }
            });
          });

          server.middlewares.use("/__pinecone_upsert", async (req, res) => {
            if (req.method !== "POST") { res.statusCode = 405; res.end(); return; }
            let body = "";
            req.on("data", (c: Buffer) => { body += c.toString(); });
            req.on("end", async () => {
              try {
                const parsed = JSON.parse(body) as { text: string; metadata?: Record<string, unknown> };
                const host = process.env.PINECONE_INDEX_HOST;
                const key = process.env.PINECONE_API_KEY;
                if (!host || !key) {
                  res.statusCode = 503;
                  res.end(JSON.stringify({ error: "Pinecone not configured" }));
                  return;
                }
                const vec = await pineconeEmbed(parsed.text, "passage");
                if (!vec) { res.statusCode = 500; res.end(JSON.stringify({ error: "embed failed" })); return; }
                const id = `mem_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
                const r = await fetch(`https://${host.replace(/^https?:\/\//, "")}/vectors/upsert`, {
                  method: "POST",
                  headers: { "Api-Key": key, "Content-Type": "application/json" },
                  body: JSON.stringify({
                    vectors: [{
                      id,
                      values: vec,
                      metadata: {
                        text: parsed.text.slice(0, 30_000),
                        timestamp: Math.floor(Date.now() / 1000),
                        source: "claude-os",
                        ...(parsed.metadata ?? {}),
                      },
                    }],
                  }),
                });
                res.setHeader("Content-Type", "application/json");
                if (!r.ok) {
                  res.statusCode = r.status;
                  res.end(JSON.stringify({ error: `upsert ${r.status}`, body: (await r.text()).slice(0, 200) }));
                  return;
                }
                res.end(JSON.stringify({ ok: true, id }));
              } catch (e) {
                res.statusCode = 500;
                res.end(JSON.stringify({ error: String(e) }));
              }
            });
          });

          // ══════════════════════════════════════════════════════════════
          // NotebookLM bridge — wraps the `notebooklm` CLI (notebooklm-py).
          //   GET  /__notebooklm_status        → { ok, hasCli }
          //   GET  /__notebooklm_list          → notebooks visible to the CLI
          //   POST /__notebooklm_query         body { notebookId, question } → cited answer
          // ══════════════════════════════════════════════════════════════
          async function notebooklmCall(args: string[]): Promise<{ ok: boolean; stdout: string; stderr: string }> {
            const { execFile } = await import("node:child_process");
            const { promisify } = await import("node:util");
            const { existsSync } = await import("node:fs");
            const { homedir } = await import("node:os");
            const nodePath = await import("node:path");
            const efp = promisify(execFile);
            const candidates = [
              "notebooklm",
              nodePath.join(homedir(), ".local", "bin", "notebooklm"),
              nodePath.join(homedir(), ".local", "pipx", "venvs", "notebooklm-py", "bin", "notebooklm"),
            ];
            const bin = candidates.find((c) => c === "notebooklm" || existsSync(c)) ?? "notebooklm";
            try {
              const r = await efp(bin, args, {
                timeout: 60_000,
                maxBuffer: 8 * 1024 * 1024,
                env: { ...process.env, PATH: `${nodePath.join(homedir(), ".local", "bin")}:${process.env.PATH ?? ""}` },
              }) as { stdout: string; stderr: string };
              return { ok: true, stdout: r.stdout, stderr: r.stderr };
            } catch (e: unknown) {
              const err = e as { stdout?: string; stderr?: string; message?: string };
              return { ok: false, stdout: err.stdout ?? "", stderr: err.stderr ?? err.message ?? String(e) };
            }
          }

          server.middlewares.use("/__notebooklm_status", async (req, res) => {
            res.setHeader("Content-Type", "application/json");
            const r = await notebooklmCall(["auth", "check"]);
            res.end(JSON.stringify({ ok: r.ok, hasCli: r.ok || /not authenticated/i.test(r.stderr), stdout: r.stdout, stderr: r.stderr.slice(0, 400), setup: r.ok ? null : "pip install \"notebooklm-py[browser]\" && playwright install chromium && notebooklm login" }));
          });

          server.middlewares.use("/__notebooklm_list", async (req, res) => {
            res.setHeader("Content-Type", "application/json");
            const r = await notebooklmCall(["list", "--json"]);
            if (!r.ok) {
              res.statusCode = 503;
              res.end(JSON.stringify({ ok: false, error: r.stderr || "notebooklm CLI not available" }));
              return;
            }
            try {
              const parsed = JSON.parse(r.stdout) as { notebooks?: { id: string; title: string; created_at?: string; is_owner?: boolean }[] };
              // CLI nests as { notebooks: { notebooks: [...] } }; flatten.
              const list = Array.isArray(parsed.notebooks) ? parsed.notebooks : [];
              res.end(JSON.stringify({ ok: true, notebooks: list }));
            } catch {
              res.end(JSON.stringify({ ok: true, raw: r.stdout }));
            }
          });

          // POST /__notebooklm_download — Pulls an artifact to disk via the CLI.
          //   body { notebook, type: audio|video|slide-deck|infographic|mind-map|quiz|flashcard|data-table|report, name? }
          //   Saves to ~/.claude-os/notebooklm/<notebook>/<type>/<filename>
          //   Returns { ok, path, sizeBytes }
          server.middlewares.use("/__notebooklm_download", async (req, res) => {
            if (req.method !== "POST") { res.statusCode = 405; res.end(); return; }
            let body = "";
            req.on("data", (c: Buffer) => { body += c.toString(); });
            req.on("end", async () => {
              try {
                const { mkdir, stat } = await import("node:fs/promises");
                const { homedir } = await import("node:os");
                const nodePath = await import("node:path");
                const parsed = JSON.parse(body) as { notebook: string; type: string; name?: string };
                if (!parsed.notebook || !parsed.type) { res.statusCode = 400; res.end(JSON.stringify({ error: "notebook + type required" })); return; }
                const safeType = parsed.type.replace(/[^a-z-]/g, "");
                const safeName = (parsed.name ?? "").replace(/[^a-zA-Z0-9 ._-]/g, "");
                const dest = nodePath.join(homedir(), ".claude-os", "notebooklm", parsed.notebook, safeType);
                await mkdir(dest, { recursive: true });
                const args = ["download", safeType, "-n", parsed.notebook, dest];
                if (safeName) args.push("--name", safeName);
                const r = await notebooklmCall(args);
                res.setHeader("Content-Type", "application/json");
                if (!r.ok) { res.statusCode = 500; res.end(JSON.stringify({ ok: false, error: r.stderr, stdout: r.stdout })); return; }
                // Find the newest file in dest
                try {
                  const { readdir } = await import("node:fs/promises");
                  const files = await readdir(dest);
                  let newest = ""; let newestMtime = 0; let newestSize = 0;
                  for (const f of files) {
                    const p = nodePath.join(dest, f);
                    try { const st = await stat(p); if (st.mtimeMs > newestMtime) { newest = p; newestMtime = st.mtimeMs; newestSize = st.size; } } catch { /* skip */ }
                  }
                  res.end(JSON.stringify({ ok: true, path: newest, sizeBytes: newestSize, stdout: r.stdout.slice(-400) }));
                } catch (e) {
                  res.end(JSON.stringify({ ok: true, stdout: r.stdout.slice(-400), note: `download done but couldn't stat: ${String(e)}` }));
                }
              } catch (e) {
                res.statusCode = 500;
                res.end(JSON.stringify({ error: String(e) }));
              }
            });
          });

          // GET /__notebooklm_artifacts?notebook=<id>[&type=audio|video|slide-deck|infographic|...]
          //   Lists artifacts in a notebook. Returns the JSON shape the CLI emits.
          server.middlewares.use("/__notebooklm_artifacts", async (req, res) => {
            const url = new URL(req.url ?? "/", "http://x");
            const notebook = (url.searchParams.get("notebook") ?? "").replace(/[^a-zA-Z0-9_-]/g, "");
            const type = (url.searchParams.get("type") ?? "all").replace(/[^a-z-]/g, "");
            if (!notebook) { res.statusCode = 400; res.end(JSON.stringify({ error: "notebook required" })); return; }
            const args = ["artifact", "list", "-n", notebook, "--type", type, "--json"];
            const r = await notebooklmCall(args);
            res.setHeader("Content-Type", "application/json");
            if (!r.ok) {
              res.statusCode = 503;
              res.end(JSON.stringify({ ok: false, error: r.stderr || "notebooklm CLI not available" }));
              return;
            }
            try {
              const parsed = JSON.parse(r.stdout);
              res.end(JSON.stringify({ ok: true, ...parsed }));
            } catch {
              res.end(JSON.stringify({ ok: true, raw: r.stdout }));
            }
          });

          server.middlewares.use("/__notebooklm_query", async (req, res) => {
            if (req.method !== "POST") { res.statusCode = 405; res.end(); return; }
            let body = "";
            req.on("data", (c: Buffer) => { body += c.toString(); });
            req.on("end", async () => {
              try {
                const parsed = JSON.parse(body) as { notebookId: string; question: string };
                if (!parsed.notebookId || !parsed.question) {
                  res.statusCode = 400;
                  res.end(JSON.stringify({ error: "notebookId + question required" }));
                  return;
                }
                const safe = parsed.notebookId.replace(/[^a-zA-Z0-9_-]/g, "");
                const r = await notebooklmCall(["use", safe]);
                if (!r.ok) { res.statusCode = 500; res.end(JSON.stringify({ error: r.stderr })); return; }
                const ask = await notebooklmCall(["ask", parsed.question]);
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ ok: ask.ok, answer: ask.stdout, error: ask.ok ? null : ask.stderr }));
              } catch (e) {
                res.statusCode = 500;
                res.end(JSON.stringify({ error: String(e) }));
              }
            });
          });

          // ══════════════════════════════════════════════════════════════
          // Maestro — cross-agent communication bus.
          //   Best-feature extraction from WaltLuv/maestro: every agent can
          //   post a message to the shared log; agents can read peer messages
          //   on each turn (we inject a tail into their system prompt below).
          //
          //   POST /__agent_message   body { from, to, subject, body, threadId? }
          //   GET  /__agent_message   ?to=<agent>&since=<ms>  → recent messages
          //   Persisted at ~/.claude-os/maestro/messages.jsonl
          // ══════════════════════════════════════════════════════════════
          server.middlewares.use("/__agent_message", async (req, res) => {
            const { readFile, mkdir, appendFile } = await import("node:fs/promises");
            const { existsSync: ex } = await import("node:fs");
            const { homedir } = await import("node:os");
            const nodePath = await import("node:path");

            const dir = nodePath.join(homedir(), ".claude-os", "maestro");
            const logPath = nodePath.join(dir, "messages.jsonl");

            if (req.method === "GET") {
              const url = new URL(req.url ?? "/", "http://x");
              const to = (url.searchParams.get("to") ?? "").toLowerCase().replace(/[^a-z0-9_-]/gi, "");
              const since = parseInt(url.searchParams.get("since") ?? "0", 10) || 0;
              const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50", 10) || 50, 200);
              if (!ex(logPath)) {
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ messages: [] }));
                return;
              }
              try {
                const raw = await readFile(logPath, "utf8") as string;
                const all = raw.split("\n").filter(Boolean).map((l) => {
                  try { return JSON.parse(l); } catch { return null; }
                }).filter(Boolean) as { from: string; to: string; ts: number; subject: string; body: string; threadId?: string }[];
                const filtered = all
                  .filter((m) => (!to || m.to === to || m.to === "all") && m.ts > since)
                  .slice(-limit);
                res.setHeader("Content-Type", "application/json");
                res.setHeader("Cache-Control", "no-cache");
                res.end(JSON.stringify({ messages: filtered }));
              } catch (e) {
                res.statusCode = 500;
                res.end(JSON.stringify({ error: String(e) }));
              }
              return;
            }

            if (req.method === "POST") {
              let body = "";
              req.on("data", (c: Buffer) => { body += c.toString(); });
              req.on("end", async () => {
                try {
                  const parsed = JSON.parse(body) as { from: string; to: string; subject?: string; body: string; threadId?: string; autoReply?: boolean };
                  if (!parsed.from || !parsed.to || !parsed.body) {
                    res.statusCode = 400;
                    res.end(JSON.stringify({ error: "from, to, body required" }));
                    return;
                  }
                  if (!ex(dir)) await mkdir(dir, { recursive: true });
                  const fromAgent = parsed.from.toLowerCase();
                  const toAgent = parsed.to.toLowerCase();
                  const threadId = parsed.threadId ?? `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
                  const msg = {
                    id: `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
                    from: fromAgent,
                    to: toAgent,
                    subject: (parsed.subject ?? "").slice(0, 200),
                    body: parsed.body.slice(0, 10_000),
                    threadId,
                    ts: Date.now(),
                  };
                  await appendFile(logPath, JSON.stringify(msg) + "\n");
                  res.setHeader("Content-Type", "application/json");
                  res.end(JSON.stringify(msg));

                  // ── Auto-routing: actually invoke the target agent so it replies.
                  // Skip when to === "all" (broadcast — no single addressee to invoke),
                  // when the sender is also the recipient (loop guard), or when the
                  // caller explicitly opts out with autoReply:false.
                  const SHOULD_AUTOROUTE = toAgent !== "all"
                    && toAgent !== fromAgent
                    && parsed.autoReply !== false
                    && !fromAgent.startsWith("auto-")    // don't recurse on auto-replies
                    && !toAgent.startsWith("auto-");
                  if (SHOULD_AUTOROUTE) {
                    // Fire and forget — don't block the original POST. The reply lands
                    // in the same JSONL log + Maestro UI picks it up on next refresh.
                    setImmediate(async () => {
                      try {
                        const peerPrompt = `[MAESTRO MESSAGE]\nFrom: ${fromAgent}\nSubject: ${msg.subject || "(no subject)"}\n\n${msg.body}\n\n[end]\n\nReply as ${toAgent} would, in your voice. Be concise (max 4 paragraphs). If the message requires action, name the action + when you'll do it. End with one concrete next step.`;
                        const aiReq = await fetch("http://127.0.0.1:8081/__ai_chat", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ agent: toAgent, prompt: peerPrompt }),
                          signal: AbortSignal.timeout(120_000),
                        });
                        if (!aiReq.body) return;
                        const reader = aiReq.body.getReader();
                        const decoder = new TextDecoder();
                        let buf = "";
                        let replyText = "";
                        while (true) {
                          const { value, done } = await reader.read();
                          if (done) break;
                          buf += decoder.decode(value, { stream: true });
                          const lines = buf.split("\n");
                          buf = lines.pop() ?? "";
                          for (const line of lines) {
                            if (!line.trim()) continue;
                            try {
                              const evt = JSON.parse(line) as { type?: string; delta?: string };
                              if (evt.type === "delta" && evt.delta) replyText += evt.delta;
                            } catch { /* skip */ }
                          }
                        }
                        if (replyText.trim()) {
                          const replyMsg = {
                            id: `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
                            from: toAgent,
                            to: fromAgent,
                            subject: `Re: ${msg.subject || "(no subject)"}`,
                            body: replyText.slice(0, 10_000),
                            threadId,
                            ts: Date.now(),
                            autoReplied: true,
                          };
                          await appendFile(logPath, JSON.stringify(replyMsg) + "\n");
                        }
                      } catch { /* swallow — auto-route is best-effort */ }
                    });
                  }
                } catch (e) {
                  res.statusCode = 400;
                  res.end(JSON.stringify({ error: String(e) }));
                }
              });
              return;
            }

            res.statusCode = 405;
            res.end();
          });

          // ══════════════════════════════════════════════════════════════
          // /__pantheon_avatar_list — GET → all available avatar IDs.
          //   Returns:  { available: [{ id, url, sizeBytes, mtime }], inUse: [<id>] }
          //   - `available`: every PNG/JPG/WebP under ~/.hermes/pantheon/assets/
          //   - `inUse`: ids that an existing persona's `avatar:` field points at
          //   The "Pick an avatar" picker reads this so both the 20 PropControl
          //   portraits AND any user-generated ones show up immediately.
          // ══════════════════════════════════════════════════════════════
          server.middlewares.use("/__pantheon_avatar_list", async (req, res) => {
            const { readdir, stat, readFile } = await import("node:fs/promises");
            const { existsSync } = await import("node:fs");
            const { homedir } = await import("node:os");
            const nodePath = await import("node:path");

            const assetsDir = nodePath.join(homedir(), ".hermes", "pantheon", "assets");
            const personasDir = nodePath.join(homedir(), ".hermes", "pantheon", "personas");

            const available: { id: string; url: string; sizeBytes: number; mtime: number }[] = [];
            try {
              if (existsSync(assetsDir)) {
                for (const f of await readdir(assetsDir)) {
                  if (!/\.(png|jpe?g|webp)$/i.test(f)) continue;
                  const id = f.replace(/\.[^.]+$/, "");
                  try {
                    const st = await stat(nodePath.join(assetsDir, f));
                    available.push({
                      id,
                      url: `/__pantheon_avatar?id=${encodeURIComponent(id)}`,
                      sizeBytes: st.size,
                      mtime: st.mtimeMs,
                    });
                  } catch { /* skip */ }
                }
              }
            } catch { /* skip */ }

            const inUse: string[] = [];
            try {
              if (existsSync(personasDir)) {
                for (const f of await readdir(personasDir)) {
                  if (!f.endsWith(".yaml")) continue;
                  try {
                    const raw = await readFile(nodePath.join(personasDir, f), "utf8") as string;
                    // very small YAML pluck — avatar field is single-line
                    const m = raw.match(/^avatar:\s*assets\/([\w.-]+)\.\w+/m);
                    if (m) inUse.push(m[1]);
                  } catch { /* skip */ }
                }
              }
            } catch { /* skip */ }

            available.sort((a, b) => b.mtime - a.mtime);
            res.setHeader("Content-Type", "application/json");
            res.setHeader("Cache-Control", "no-cache");
            res.end(JSON.stringify({ available, inUse }));
          });

          // ══════════════════════════════════════════════════════════════
          // /__pantheon_avatar_generate — POST { id, prompt, style? }
          //   1. Calls FAL.ai Flux Schnell with a cinematic-portrait
          //      prompt wrapper (same recipe used for the original 20)
          //   2. Downloads the result
          //   3. Saves to ~/.hermes/pantheon/assets/<id>.png
          //   Returns: { ok, url: "/__pantheon_avatar?id=<id>", sizeBytes }
          //   Cost: ~$0.003 per call.
          // ══════════════════════════════════════════════════════════════
          server.middlewares.use("/__pantheon_avatar_generate", async (req, res) => {
            if (req.method !== "POST") { res.statusCode = 405; res.end(); return; }
            let body = "";
            req.on("data", (c: Buffer) => { body += c.toString(); });
            req.on("end", async () => {
              try {
                const key = process.env.FAL_KEY;
                if (!key) { res.statusCode = 503; res.end(JSON.stringify({ error: "FAL_KEY missing in .env.local" })); return; }
                const parsed = JSON.parse(body) as { id: string; prompt: string; style?: string };
                const id = (parsed.id ?? "").toLowerCase().replace(/[^a-z0-9_-]/g, "");
                if (!id) { res.statusCode = 400; res.end(JSON.stringify({ error: "id required (lowercase, alphanumeric/_-)" })); return; }
                if (!parsed.prompt?.trim()) { res.statusCode = 400; res.end(JSON.stringify({ error: "prompt required" })); return; }

                // Wrap user prompt in the same cinematic-portrait recipe used for the original 20
                const styleWrapper = parsed.style === "raw"
                  ? parsed.prompt
                  : `cinematic editorial portrait photograph of ${parsed.prompt}, dramatic three-point lighting, shot on Arri Alexa 50mm Master Prime, shallow depth of field, color graded, photojournalistic, no logos, no text, high detail`;

                const r = await fetch("https://fal.run/fal-ai/flux/schnell", {
                  method: "POST",
                  headers: { "Authorization": `Key ${key}`, "Content-Type": "application/json" },
                  body: JSON.stringify({
                    prompt: styleWrapper.slice(0, 2000),
                    image_size: "square_hd",
                    num_inference_steps: 4,
                    num_images: 1,
                    enable_safety_checker: false,
                  }),
                  signal: AbortSignal.timeout(60_000),
                });
                const j = await r.json() as { images?: { url: string }[]; error?: string };
                const imgUrl = j.images?.[0]?.url;
                if (!imgUrl) { res.statusCode = r.status || 500; res.end(JSON.stringify({ error: j.error ?? "no image returned" })); return; }

                // Download + save
                const { writeFile, mkdir } = await import("node:fs/promises");
                const { homedir } = await import("node:os");
                const nodePath = await import("node:path");
                const dir = nodePath.join(homedir(), ".hermes", "pantheon", "assets");
                await mkdir(dir, { recursive: true });
                const outPath = nodePath.join(dir, `${id}.png`);
                const imgRes = await fetch(imgUrl);
                const buf = Buffer.from(await imgRes.arrayBuffer());
                await writeFile(outPath, buf);

                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({
                  ok: true,
                  id,
                  url: `/__pantheon_avatar?id=${encodeURIComponent(id)}?t=${Date.now()}`,
                  sizeBytes: buf.length,
                  promptUsed: styleWrapper,
                }));
              } catch (e) {
                res.statusCode = 500;
                res.end(JSON.stringify({ error: String(e) }));
              }
            });
          });

          // ══════════════════════════════════════════════════════════════
          // /__pantheon_avatar?id=<persona-id> — Stream a PNG from
          // ~/.hermes/pantheon/assets/. Bridges the file-based persona
          // avatars into the dashboard's web origin.
          // ══════════════════════════════════════════════════════════════
          server.middlewares.use("/__pantheon_avatar", async (req, res) => {
            const { readFile } = await import("node:fs/promises");
            const { existsSync } = await import("node:fs");
            const { homedir } = await import("node:os");
            const nodePath = await import("node:path");
            const url = new URL(req.url ?? "/", "http://x");
            const id = (url.searchParams.get("id") ?? "").replace(/[^a-zA-Z0-9_-]/g, "");
            if (!id) { res.statusCode = 400; res.end("id required"); return; }
            const candidates = [
              nodePath.join(homedir(), ".hermes", "pantheon", "assets", `${id}.png`),
              nodePath.join(homedir(), ".hermes", "pantheon", "assets", `${id}.jpg`),
              nodePath.join(homedir(), ".hermes", "pantheon", "assets", `${id}.webp`),
            ];
            const p = candidates.find(existsSync);
            if (!p) { res.statusCode = 404; res.end("not found"); return; }
            const ext = nodePath.extname(p).slice(1);
            res.setHeader("Content-Type", ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg");
            res.setHeader("Cache-Control", "public, max-age=86400");
            res.end(await readFile(p));
          });

          // ══════════════════════════════════════════════════════════════
          // /__dream_run — POST to run `claude -p "/dream"` server-side.
          //   Streams stdout back so the home page can show a live log,
          //   then re-runs the aggregator so live-data.json picks up the
          //   freshly written dream-{date}.json. Critical: pass
          //   --add-dir ~/.claude-os so Claude is allowed to write the
          //   prescription file (without that, the run completes but the
          //   JSON write is denied and the dashboard stays empty).
          // ══════════════════════════════════════════════════════════════
          server.middlewares.use("/__dream_run", async (req, res) => {
            if (req.method !== "POST") { res.statusCode = 405; res.end(); return; }
            try {
              const { spawn } = await import("node:child_process");
              const home = homedir();
              const claudeBin = process.env.CLAUDE_BIN
                || (existsSync(join(home, ".local/bin/claude")) ? join(home, ".local/bin/claude") : "claude");
              res.setHeader("Content-Type", "text/plain; charset=utf-8");
              res.setHeader("Cache-Control", "no-cache");
              res.setHeader("X-Accel-Buffering", "no");
              res.write(`▶ ${claudeBin} -p "/dream" --add-dir ${home}/.claude-os --permission-mode bypassPermissions\n`);
              const cp = spawn(claudeBin, [
                "-p", "/dream",
                "--add-dir", join(home, ".claude-os"),
                "--permission-mode", "bypassPermissions",
              ], {
                cwd: process.cwd(),
                env: { ...process.env, FORCE_COLOR: "0" },
              });
              cp.stdout.on("data", (d: Buffer) => res.write(d));
              cp.stderr.on("data", (d: Buffer) => res.write(d));
              cp.on("close", async (code: number) => {
                res.write(`\n[/dream exit ${code}]\n`);
                // Re-aggregate so live-data.json picks up the new dream JSON
                try {
                  res.write(`▶ bun run scripts/aggregate.ts\n`);
                  const agg = spawn("bun", ["run", "scripts/aggregate.ts"], { cwd: process.cwd(), env: process.env });
                  agg.stdout.on("data", (d: Buffer) => res.write(d));
                  agg.stderr.on("data", (d: Buffer) => res.write(d));
                  agg.on("close", () => { res.write(`\n✓ done. Reload the dashboard to see the new dream.\n`); res.end(); });
                } catch (e) { res.write(`\n[aggregate error] ${String(e)}\n`); res.end(); }
              });
              cp.on("error", (e: Error) => { res.write(`\n[error] ${e.message}\n`); res.end(); });
              setTimeout(() => { try { cp.kill(); } catch { /* skip */ } }, 5 * 60_000);
            } catch (e) {
              res.statusCode = 500;
              res.end(`error: ${String(e)}`);
            }
          });

          // ══════════════════════════════════════════════════════════════
          // /__hermes_mcp_loop_up / /__hermes_mcp_loop_down — Run the one-shot scripts.
          //   POST /__hermes_mcp_loop_up   → runs scripts/hermes-mcp-loop-up.sh, streams stdout
          //   POST /__hermes_mcp_loop_down → runs scripts/hermes-mcp-loop-down.sh
          // Note: the up script may need user interaction for the `hermes login`
          // browser flow. We capture stdout so the UI can show progress, but
          // the OAuth itself happens in the user's browser.
          // ══════════════════════════════════════════════════════════════
          for (const [route, scriptName] of [["/__hermes_mcp_loop_up", "hermes-mcp-loop-up.sh"], ["/__hermes_mcp_loop_down", "hermes-mcp-loop-down.sh"]] as const) {
            server.middlewares.use(route, async (req, res) => {
              if (req.method !== "POST") { res.statusCode = 405; res.end(); return; }
              try {
                const { spawn } = await import("node:child_process");
                const cp = spawn("bash", [`scripts/${scriptName}`], {
                  cwd: process.cwd(),
                  env: { ...process.env, FORCE_COLOR: "0" },
                });
                res.setHeader("Content-Type", "text/plain; charset=utf-8");
                res.setHeader("Cache-Control", "no-cache");
                res.setHeader("X-Accel-Buffering", "no");
                cp.stdout.on("data", (d: Buffer) => res.write(d));
                cp.stderr.on("data", (d: Buffer) => res.write(d));
                cp.on("close", (code: number) => { res.write(`\n[exit ${code}]\n`); res.end(); });
                cp.on("error", (e: Error) => { res.write(`\n[error] ${e.message}\n`); res.end(); });
                // Detach after 5 min so a stuck process can't hold the connection forever
                setTimeout(() => { try { cp.kill(); } catch { /* skip */ } }, 5 * 60_000);
              } catch (e) {
                res.statusCode = 500;
                res.end(`error: ${String(e)}`);
              }
            });
          }

          // ══════════════════════════════════════════════════════════════
          // /__hermes_mcp_loop_status — Drives the /hermes-mcp-loop page. Detects each layer
          //   of the Hermes MCP setup chain in one round-trip.
          // ══════════════════════════════════════════════════════════════
          server.middlewares.use("/__hermes_mcp_loop_status", async (req, res) => {
            const { execFile } = await import("node:child_process");
            const { promisify } = await import("node:util");
            const { readFile } = await import("node:fs/promises");
            const { existsSync } = await import("node:fs");
            const efp = promisify(execFile);

            async function whichInfo(bin: string): Promise<{ installed: boolean; version?: string; path?: string }> {
              try {
                const w = await efp("which", [bin]) as { stdout: string };
                const path = w.stdout.trim();
                if (!path) return { installed: false };
                let version: string | undefined;
                try { const v = await efp(bin, ["--version"], { timeout: 5000 }) as { stdout: string }; version = v.stdout.split("\n")[0].trim(); } catch { /* skip */ }
                return { installed: true, path, version };
              } catch { return { installed: false }; }
            }

            async function portUp(url: string): Promise<boolean> {
              try {
                const r = await fetch(url, { signal: AbortSignal.timeout(2000) });
                return r.ok || r.status < 500;
              } catch { return false; }
            }

            async function readCloudflaredUrl(): Promise<string | null> {
              try {
                const log = await readFile("/tmp/cloudflared.log", "utf8") as string;
                const m = log.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
                return m ? m[0] : null;
              } catch { return null; }
            }

            const [hermesMcp, cloudflared, gatewayLive, bridgeLive, tunnelUrl] = await Promise.all([
              whichInfo("hermes-mcp"),
              whichInfo("cloudflared"),
              portUp("http://127.0.0.1:8642/v1/health"),
              portUp("http://127.0.0.1:8765/health"),
              readCloudflaredUrl(),
            ]);

            res.setHeader("Content-Type", "application/json");
            res.setHeader("Cache-Control", "no-cache");
            res.end(JSON.stringify({
              hermesMcp,
              cloudflared,
              gatewayLive,
              bridgeLive,
              tunnelUrl,
              oauthClientId: process.env.OAUTH_CLIENT_ID ?? null,
              oauthClientSecret: process.env.OAUTH_CLIENT_SECRET ?? null,
            }));
          });

          // ══════════════════════════════════════════════════════════════
          // /__plugin_status — Surface install + auth state for the CLI
          //   trio that powers ClaudeClaw: claude, codex, gemini.
          //   GET → { claude:{installed,version}, codex:{...}, gemini:{...} }
          // ══════════════════════════════════════════════════════════════
          server.middlewares.use("/__plugin_status", async (req, res) => {
            const { execFile } = await import("node:child_process");
            const { promisify } = await import("node:util");
            const efp = promisify(execFile);
            async function probe(bin: string): Promise<{ installed: boolean; version?: string; path?: string }> {
              try {
                const which = await efp("which", [bin]) as { stdout: string };
                const path = which.stdout.trim();
                if (!path) return { installed: false };
                let version: string | undefined;
                try {
                  const v = await efp(bin, ["--version"], { timeout: 8000 }) as { stdout: string };
                  version = v.stdout.split("\n").find((l) => l.trim() && !l.startsWith("("))?.trim();
                } catch { /* skip */ }
                return { installed: true, path, version };
              } catch { return { installed: false }; }
            }
            const [claude, codex, gemini] = await Promise.all([probe("claude"), probe("codex"), probe("gemini")]);
            res.setHeader("Content-Type", "application/json");
            res.setHeader("Cache-Control", "no-cache");
            res.end(JSON.stringify({ claude, codex, gemini }));
          });

          // ══════════════════════════════════════════════════════════════
          // /__triad_run — The Opus / DeepSeek / GPT council.
          //   POST { brief } → streams NDJSON events:
          //     {role:"conductor"|"worker"|"critic", phase, delta}
          //     {phase:"done", verdict, artifact}
          //
          //   Phase 1: Conductor (Opus 4.7) writes a one-page brief.
          //   Phase 2: Worker (DeepSeek V4 → via OpenRouter) drafts 3 angles
          //            in parallel against the brief.
          //   Phase 3: Critic (GPT-5.5 → via OpenRouter) reviews each draft,
          //            returns SHIP / REVISE / FUNDAMENTAL FLAW.
          //   Phase 4: Conductor validates the converged output.
          // ══════════════════════════════════════════════════════════════
          server.middlewares.use("/__triad_run", async (req, res) => {
            if (req.method !== "POST") { res.statusCode = 405; res.end(); return; }
            let body = "";
            req.on("data", (c: Buffer) => { body += c.toString(); });
            req.on("end", async () => {
              try {
                const parsed = JSON.parse(body) as { brief: string };
                if (!parsed.brief?.trim()) { res.statusCode = 400; res.end(JSON.stringify({ error: "brief required" })); return; }

                res.setHeader("Content-Type", "application/x-ndjson");
                res.setHeader("Cache-Control", "no-cache");

                const apiKey = process.env.OPENROUTER_API_KEY;
                if (!apiKey) { res.write(JSON.stringify({ phase: "error", message: "OPENROUTER_API_KEY missing" }) + "\n"); res.end(); return; }

                async function callModel(model: string, system: string, user: string): Promise<string> {
                  const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                    method: "POST",
                    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
                    body: JSON.stringify({
                      model,
                      messages: [{ role: "system", content: system }, { role: "user", content: user }],
                      stream: false,
                      max_tokens: 2000,
                    }),
                  });
                  const j = await r.json() as { choices?: { message: { content: string } }[]; error?: { message: string } };
                  if (j.error) throw new Error(j.error.message);
                  return j.choices?.[0]?.message?.content ?? "";
                }

                function emit(o: Record<string, unknown>) { res.write(JSON.stringify(o) + "\n"); }

                try {
                  // Phase 1: Conductor (Opus)
                  emit({ phase: "conductor", role: "Opus 4.7", status: "thinking", message: "Interrogating the goal + writing brief…" });
                  const conductorSystem = `You are the Conductor of the Triad council. Take the operator's brief and write a tight one-page execution brief for the Worker (DeepSeek). Include:
1. Goal (one sentence)
2. Constraints + success criteria (bullets)
3. Failure modes to avoid (bullets)
4. 3-5 angles for the Worker to attack in parallel
End with: "DISPATCH TO WORKER"`;
                  const brief = await callModel("anthropic/claude-opus-4-7", conductorSystem, parsed.brief);
                  emit({ phase: "conductor", role: "Opus 4.7", status: "done", content: brief });

                  // Phase 2: Worker (DeepSeek) — 3 parallel angles
                  emit({ phase: "worker", role: "DeepSeek V4", status: "thinking", message: "Drafting 3 angles in parallel…" });
                  const workerSystem = `You are the Worker of the Triad. Read the Conductor's brief. Produce 3 numbered drafts (Angle 1, Angle 2, Angle 3) — each attacking the goal from a different strategic stance. Be specific, opinionated, runnable. Show reasoning inside each draft.`;
                  const drafts = await callModel("deepseek/deepseek-chat", workerSystem, brief);
                  emit({ phase: "worker", role: "DeepSeek V4", status: "done", content: drafts });

                  // Phase 3: Critic (GPT-5.5)
                  emit({ phase: "critic", role: "GPT-5.5", status: "thinking", message: "Tearing each draft apart…" });
                  const criticSystem = `You are the Critic of the Triad. Read the Conductor's brief and the Worker's 3 drafts. For each draft return:
▎ VERDICT — SHIP / REVISE / FUNDAMENTAL FLAW
▎ WHAT BREAKS — specific failures with examples
▎ WHAT'S MISSING — gaps vs brief
▎ Final: "BEST ANGLE — which wins and why"
Be specific, not vague.`;
                  const critique = await callModel("openai/gpt-5", criticSystem, `BRIEF:\n${brief}\n\nDRAFTS:\n${drafts}`);
                  emit({ phase: "critic", role: "GPT-5.5", status: "done", content: critique });

                  // Phase 4: Conductor validates final
                  emit({ phase: "validate", role: "Opus 4.7", status: "thinking", message: "Validating + producing final artifact…" });
                  const finalSystem = `You are the Conductor again. Given the brief, the Worker's drafts, and the Critic's review, produce the FINAL ARTIFACT. Pick the best angle (or synthesize), incorporate the Critic's must-fix items, output the runnable result. Open with a 1-paragraph summary, then the deliverable.`;
                  const final = await callModel("anthropic/claude-opus-4-7", finalSystem, `BRIEF:\n${brief}\n\nDRAFTS:\n${drafts}\n\nCRITIQUE:\n${critique}`);
                  emit({ phase: "validate", role: "Opus 4.7", status: "done", content: final });

                  // Persist to studio history so it lands in /higgsfield gallery search
                  try {
                    await fetch("http://127.0.0.1:8081/__studio_history", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ kind: "triad", prompt: parsed.brief, result: final }),
                    });
                  } catch { /* skip */ }

                  emit({ phase: "done", artifact: final });
                  res.end();
                } catch (e) {
                  emit({ phase: "error", message: String(e) });
                  res.end();
                }
              } catch (e) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: String(e) }));
              }
            });
          });

          // ══════════════════════════════════════════════════════════════
          // /__skills_install — triggers `bun run scripts/install-skills.ts`
          //   POST → runs the installer + returns its output
          // ══════════════════════════════════════════════════════════════
          server.middlewares.use("/__skills_install", async (req, res) => {
            if (req.method !== "POST") { res.statusCode = 405; res.end(); return; }
            try {
              const { execFile } = await import("node:child_process");
              const { promisify } = await import("node:util");
              const efp = promisify(execFile);
              const result = await efp("bun", ["run", "scripts/install-skills.ts"], { cwd: process.cwd(), timeout: 180_000 });
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ ok: true, stdout: result.stdout, stderr: result.stderr }));
            } catch (e: unknown) {
              const err = e as { stdout?: string; stderr?: string; message?: string };
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ ok: false, stdout: err.stdout ?? "", stderr: err.stderr ?? err.message ?? String(e) }));
            }
          });

          // ══════════════════════════════════════════════════════════════
          // /__browser_use — Browser automation harness.
          //   POST { task, agent? } → forwards to local browser-use service
          //   on http://127.0.0.1:8000 (or returns setup instructions if down).
          // ══════════════════════════════════════════════════════════════
          server.middlewares.use("/__browser_use", async (req, res) => {
            if (req.method !== "POST") { res.statusCode = 405; res.end(); return; }
            let body = "";
            req.on("data", (c: Buffer) => { body += c.toString(); });
            req.on("end", async () => {
              try {
                const parsed = JSON.parse(body) as { task: string; agent?: string };
                if (!parsed.task) { res.statusCode = 400; res.end(JSON.stringify({ error: "task required" })); return; }
                // Try local browser-use service first
                try {
                  const r = await fetch("http://127.0.0.1:8000/run", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ task: parsed.task, max_steps: 25 }),
                    signal: AbortSignal.timeout(60_000),
                  });
                  if (r.ok) {
                    res.setHeader("Content-Type", "application/json");
                    res.end(JSON.stringify({ ok: true, source: "browser-use", result: await r.json() }));
                    return;
                  }
                } catch { /* fall through */ }
                // Service is down → return setup instructions
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({
                  ok: false,
                  source: "stub",
                  note: "browser-use service not running on :8000",
                  setup: [
                    "pip install browser-use",
                    "playwright install chromium",
                    "export OPENAI_API_KEY=...  (or OPENROUTER_API_KEY)",
                    "python -m browser_use.server --port 8000",
                  ],
                  repo: "https://github.com/WaltLuv/Ai-agent-harness-browser-use",
                }));
              } catch (e) {
                res.statusCode = 500;
                res.end(JSON.stringify({ error: String(e) }));
              }
            });
          });

          // ══════════════════════════════════════════════════════════════
          // /__pocket_tts — Pocket TTS fallback.
          //   POST { text, voice? } → tries local pocket-tts-openapi on :8001
          //   Falls back to a note pointing the user at /__tts (ElevenLabs).
          // ══════════════════════════════════════════════════════════════
          server.middlewares.use("/__pocket_tts", async (req, res) => {
            if (req.method !== "POST") { res.statusCode = 405; res.end(); return; }
            let body = "";
            req.on("data", (c: Buffer) => { body += c.toString(); });
            req.on("end", async () => {
              try {
                const parsed = JSON.parse(body) as { text: string; voice?: string };
                if (!parsed.text) { res.statusCode = 400; res.end(JSON.stringify({ error: "text required" })); return; }
                try {
                  const r = await fetch("http://127.0.0.1:8001/v1/audio/speech", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ input: parsed.text, voice: parsed.voice ?? "default", model: "tts-1" }),
                    signal: AbortSignal.timeout(60_000),
                  });
                  if (r.ok) {
                    const buf = Buffer.from(await r.arrayBuffer());
                    res.setHeader("Content-Type", "application/json");
                    res.end(JSON.stringify({ ok: true, source: "pocket-tts", audio: `data:audio/mpeg;base64,${buf.toString("base64")}` }));
                    return;
                  }
                } catch { /* fall through */ }
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({
                  ok: false,
                  note: "pocket-tts service not running on :8001 — falling back to ElevenLabs via /__tts",
                  repo: "https://github.com/WaltLuv/pocket-tts-openapi",
                }));
              } catch (e) {
                res.statusCode = 500;
                res.end(JSON.stringify({ error: String(e) }));
              }
            });
          });

          // ══════════════════════════════════════════════════════════════
          // Notion — second memory brain alongside Obsidian.
          //   Auth: NOTION_TOKEN  (Notion-Version: 2022-06-28)
          //   The integration must be SHARED with target pages/databases via
          //   the Notion UI before they appear in search.
          //
          //   GET  /__notion_status        → { ok, token, root, workspaces }
          //   POST /__notion_search        → body { query?, filter? } → search results
          //   GET  /__notion_page?id=…     → page metadata + child block text
          //   POST /__notion_page          → body { parent, title, content, kind? } create
          //   POST /__notion_append        → body { pageId, content } append blocks
          //   POST /__notion_root          → body { rootPageId } save as Baseline Automations root
          // ══════════════════════════════════════════════════════════════
          const NOTION_VERSION = "2022-06-28";

          async function notionFetch(path: string, init: RequestInit = {}) {
            const token = process.env.NOTION_TOKEN;
            if (!token) throw new Error("NOTION_TOKEN missing");
            const r = await fetch(`https://api.notion.com${path}`, {
              ...init,
              headers: {
                "Authorization": `Bearer ${token}`,
                "Notion-Version": NOTION_VERSION,
                "Content-Type": "application/json",
                ...(init.headers ?? {}),
              },
            });
            const text = await r.text();
            let body: unknown = null;
            try { body = JSON.parse(text); } catch { /* leave as text */ }
            if (!r.ok) throw new Error(`Notion ${r.status}: ${typeof body === "object" && body && "message" in body ? (body as { message: string }).message : text.slice(0, 200)}`);
            return body as Record<string, unknown>;
          }

          // Convert plain text to Notion block array (one paragraph per line).
          function textToBlocks(content: string): unknown[] {
            return content.split("\n").map((line) => ({
              object: "block",
              type: "paragraph",
              paragraph: { rich_text: [{ type: "text", text: { content: line.slice(0, 1990) } }] },
            }));
          }

          server.middlewares.use("/__notion_status", async (req, res) => {
            res.setHeader("Content-Type", "application/json");
            res.setHeader("Cache-Control", "no-cache");
            if (!process.env.NOTION_TOKEN) {
              res.end(JSON.stringify({ ok: false, error: "NOTION_TOKEN missing in .env.local" }));
              return;
            }
            try {
              // /v1/users/me — verifies the integration token works
              const me = await notionFetch("/v1/users/me");
              // Read root page id from ~/.claude-os/config.json if user set one
              let rootPageId: string | null = null;
              try {
                const { readFile } = await import("node:fs/promises");
                const { existsSync: ex } = await import("node:fs");
                const { homedir } = await import("node:os");
                const np = await import("node:path");
                const cfg = np.join(homedir(), ".claude-os", "config.json");
                if (ex(cfg)) {
                  const j = JSON.parse(await readFile(cfg, "utf8") as string);
                  rootPageId = j.notionRootPageId ?? null;
                }
              } catch { /* skip */ }
              res.end(JSON.stringify({
                ok: true,
                integration: { name: (me.name as string) ?? "Notion integration", type: me.type ?? "bot", id: me.id ?? null },
                rootPageId,
              }));
            } catch (e) {
              res.end(JSON.stringify({ ok: false, error: String(e) }));
            }
          });

          server.middlewares.use("/__notion_search", async (req, res) => {
            res.setHeader("Content-Type", "application/json");
            if (req.method !== "POST") {
              // Allow GET with empty query for "list everything shared with integration"
              try {
                const j = await notionFetch("/v1/search", { method: "POST", body: JSON.stringify({ page_size: 50 }) });
                res.end(JSON.stringify(j));
              } catch (e) {
                res.statusCode = 500;
                res.end(JSON.stringify({ error: String(e) }));
              }
              return;
            }
            let body = "";
            req.on("data", (c: Buffer) => { body += c.toString(); });
            req.on("end", async () => {
              try {
                const parsed = JSON.parse(body || "{}") as { query?: string; filter?: { value: "page" | "database" } };
                const payload: Record<string, unknown> = { page_size: 50 };
                if (parsed.query) payload.query = parsed.query;
                if (parsed.filter) payload.filter = { property: "object", value: parsed.filter.value };
                const j = await notionFetch("/v1/search", { method: "POST", body: JSON.stringify(payload) });
                res.end(JSON.stringify(j));
              } catch (e) {
                res.statusCode = 500;
                res.end(JSON.stringify({ error: String(e) }));
              }
            });
          });

          server.middlewares.use("/__notion_page", async (req, res) => {
            res.setHeader("Content-Type", "application/json");
            if (req.method === "GET") {
              const url = new URL(req.url ?? "/", "http://x");
              const id = (url.searchParams.get("id") ?? "").replace(/[^a-f0-9-]/gi, "");
              if (!id) { res.statusCode = 400; res.end(JSON.stringify({ error: "id required" })); return; }
              try {
                const page = await notionFetch(`/v1/pages/${id}`);
                const blocks = await notionFetch(`/v1/blocks/${id}/children?page_size=100`);
                res.end(JSON.stringify({ page, blocks }));
              } catch (e) {
                res.statusCode = 500;
                res.end(JSON.stringify({ error: String(e) }));
              }
              return;
            }

            if (req.method === "POST") {
              let body = "";
              req.on("data", (c: Buffer) => { body += c.toString(); });
              req.on("end", async () => {
                try {
                  const parsed = JSON.parse(body) as { parent?: string; title: string; content?: string };
                  // Resolve parent: explicit > config root > error
                  let parentId = parsed.parent;
                  if (!parentId) {
                    try {
                      const { readFile } = await import("node:fs/promises");
                      const { existsSync: ex } = await import("node:fs");
                      const { homedir } = await import("node:os");
                      const np = await import("node:path");
                      const cfg = np.join(homedir(), ".claude-os", "config.json");
                      if (ex(cfg)) {
                        const j = JSON.parse(await readFile(cfg, "utf8") as string);
                        parentId = j.notionRootPageId;
                      }
                    } catch { /* skip */ }
                  }
                  if (!parentId) {
                    res.statusCode = 400;
                    res.end(JSON.stringify({ error: "no parent — pass `parent` or set notionRootPageId via POST /__notion_root" }));
                    return;
                  }
                  const payload = {
                    parent: { page_id: parentId },
                    properties: { title: { title: [{ text: { content: parsed.title.slice(0, 240) } }] } },
                    children: parsed.content ? textToBlocks(parsed.content) : [],
                  };
                  const j = await notionFetch("/v1/pages", { method: "POST", body: JSON.stringify(payload) });
                  res.end(JSON.stringify({ ok: true, page: j }));
                } catch (e) {
                  res.statusCode = 500;
                  res.end(JSON.stringify({ error: String(e) }));
                }
              });
              return;
            }

            res.statusCode = 405;
            res.end();
          });

          server.middlewares.use("/__notion_append", async (req, res) => {
            if (req.method !== "POST") { res.statusCode = 405; res.end(); return; }
            let body = "";
            req.on("data", (c: Buffer) => { body += c.toString(); });
            req.on("end", async () => {
              try {
                const parsed = JSON.parse(body) as { pageId: string; content: string };
                const j = await notionFetch(`/v1/blocks/${parsed.pageId}/children`, {
                  method: "PATCH",
                  body: JSON.stringify({ children: textToBlocks(parsed.content) }),
                });
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ ok: true, result: j }));
              } catch (e) {
                res.statusCode = 500;
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ error: String(e) }));
              }
            });
          });

          server.middlewares.use("/__notion_root", async (req, res) => {
            if (req.method !== "POST") { res.statusCode = 405; res.end(); return; }
            let body = "";
            req.on("data", (c: Buffer) => { body += c.toString(); });
            req.on("end", async () => {
              try {
                const parsed = JSON.parse(body) as { rootPageId: string };
                const { readFile, writeFile, mkdir } = await import("node:fs/promises");
                const { existsSync: ex } = await import("node:fs");
                const { homedir } = await import("node:os");
                const np = await import("node:path");
                const dir = np.join(homedir(), ".claude-os");
                const cfg = np.join(dir, "config.json");
                if (!ex(dir)) await mkdir(dir, { recursive: true });
                let existing: Record<string, unknown> = {};
                if (ex(cfg)) {
                  try { existing = JSON.parse(await readFile(cfg, "utf8") as string); } catch { /* fresh */ }
                }
                existing.notionRootPageId = parsed.rootPageId;
                await writeFile(cfg, JSON.stringify(existing, null, 2));
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ ok: true, notionRootPageId: parsed.rootPageId }));
              } catch (e) {
                res.statusCode = 500;
                res.end(JSON.stringify({ error: String(e) }));
              }
            });
          });

          // ══════════════════════════════════════════════════════════════
          // /__tts — ElevenLabs text-to-speech for NotebookLM Audio Overview.
          //   POST { script, voice? }
          //   - script: full text or "Host A: …\nHost B: …" 2-host dialogue
          //   - voice : optional override; otherwise rotates between
          //             ELEVENLABS_VOICE_A and ELEVENLABS_VOICE_B per line.
          //   Returns { audio: dataUrl (mp3) }
          //
          // Uses ElevenLabs Multilingual v2 model. Concatenates per-line audio
          // for dialogue scripts. Falls back to single-voice if only one
          // speaker is detected.
          // ══════════════════════════════════════════════════════════════
          server.middlewares.use("/__tts", async (req, res) => {
            if (req.method !== "POST") { res.statusCode = 405; res.end(); return; }

            let body = "";
            req.on("data", (c: Buffer) => { body += c.toString(); });
            req.on("end", async () => {
              try {
                const key = process.env.ELEVENLABS_API_KEY;
                if (!key) {
                  res.statusCode = 503;
                  res.end(JSON.stringify({ error: "ELEVENLABS_API_KEY not set" }));
                  return;
                }
                const parsed = JSON.parse(body) as { script: string; voice?: string };
                const script = (parsed.script ?? "").trim();
                if (!script) {
                  res.statusCode = 400;
                  res.end(JSON.stringify({ error: "script required" }));
                  return;
                }

                const VOICE_A = process.env.ELEVENLABS_VOICE_A || "rWyjfFeMZ6PxkHqD3wGC";
                const VOICE_B = process.env.ELEVENLABS_VOICE_B || "YjlcD3XHztjJEo2wNszv";

                // Parse 2-host dialogue:  matches "Host A:", "A:", "Speaker 1:" etc.
                interface Line { voice: string; text: string }
                const lines: Line[] = [];
                const rawLines = script.split("\n").map((l) => l.trim()).filter(Boolean);
                const hostRe = /^(host\s*[ab12]|speaker\s*[ab12]|[ab]|alex|jamie|maya|leo)\s*:\s*/i;
                let toggle = 0;
                for (const raw of rawLines) {
                  const match = raw.match(hostRe);
                  if (match) {
                    const tag = match[0].toLowerCase();
                    const isA = /\b(a|1|alex|maya)\b/.test(tag);
                    const text = raw.slice(match[0].length).trim();
                    if (text) lines.push({ voice: isA ? VOICE_A : VOICE_B, text });
                  } else {
                    // No speaker tag — alternate by paragraph
                    lines.push({ voice: toggle++ % 2 === 0 ? VOICE_A : VOICE_B, text: raw });
                  }
                }
                if (lines.length === 0) lines.push({ voice: parsed.voice || VOICE_A, text: script });

                // Synth each line, concatenate audio buffers.
                const chunks: Buffer[] = [];
                for (const ln of lines) {
                  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${ln.voice}`, {
                    method: "POST",
                    headers: {
                      "xi-api-key": key,
                      "Content-Type": "application/json",
                      "Accept": "audio/mpeg",
                    },
                    body: JSON.stringify({
                      text: ln.text,
                      model_id: "eleven_multilingual_v2",
                      voice_settings: { stability: 0.4, similarity_boost: 0.85, style: 0.25, use_speaker_boost: true },
                    }),
                  });
                  if (!r.ok) {
                    const err = await r.text();
                    res.statusCode = r.status;
                    res.end(JSON.stringify({ error: `ElevenLabs ${r.status}: ${err.slice(0, 240)}` }));
                    return;
                  }
                  const buf = Buffer.from(await r.arrayBuffer());
                  chunks.push(buf);
                }
                const audio = Buffer.concat(chunks);
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({
                  audio: `data:audio/mpeg;base64,${audio.toString("base64")}`,
                  lines: lines.length,
                  bytes: audio.length,
                }));
              } catch (e) {
                res.statusCode = 500;
                res.end(JSON.stringify({ error: String(e) }));
              }
            });
          });

          // ══════════════════════════════════════════════════════════════
          // /__fal_image — Real image generation via FAL.ai Flux Schnell.
          //   POST { prompt, size? }  → { url, prompt }
          //   ~$0.003 per call · square_hd · 4-step inference (fast)
          //   Auto-archives to /__studio_history (kind: studio-image-fal)
          //   so it shows up in the /higgsfield + studio galleries.
          // ══════════════════════════════════════════════════════════════
          server.middlewares.use("/__fal_image", async (req, res) => {
            if (req.method !== "POST") { res.statusCode = 405; res.end(); return; }
            let body = "";
            req.on("data", (c: Buffer) => { body += c.toString(); });
            req.on("end", async () => {
              try {
                const key = process.env.FAL_KEY;
                if (!key) { res.statusCode = 503; res.end(JSON.stringify({ error: "FAL_KEY missing" })); return; }
                const parsed = JSON.parse(body) as { prompt: string; size?: string };
                if (!parsed.prompt?.trim()) { res.statusCode = 400; res.end(JSON.stringify({ error: "prompt required" })); return; }
                const r = await fetch("https://fal.run/fal-ai/flux/schnell", {
                  method: "POST",
                  headers: { "Authorization": `Key ${key}`, "Content-Type": "application/json" },
                  body: JSON.stringify({
                    prompt: parsed.prompt.slice(0, 2000),
                    image_size: parsed.size ?? "square_hd",
                    num_inference_steps: 4,
                    num_images: 1,
                    enable_safety_checker: false,
                  }),
                  signal: AbortSignal.timeout(60_000),
                });
                const j = await r.json() as { images?: { url: string }[]; error?: string };
                const url = j.images?.[0]?.url;
                if (!url) { res.statusCode = r.status || 500; res.end(JSON.stringify({ error: j.error ?? "no image" })); return; }
                // Persist to studio history so the gallery picks it up
                try {
                  await fetch("http://127.0.0.1:8081/__studio_history", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ kind: "studio-image-fal", prompt: parsed.prompt, result: url }),
                  });
                } catch { /* skip */ }
                res.setHeader("Content-Type", "application/json");
                res.end(JSON.stringify({ url, prompt: parsed.prompt }));
              } catch (e) {
                res.statusCode = 500;
                res.end(JSON.stringify({ error: String(e) }));
              }
            });
          });

          // ══════════════════════════════════════════════════════════════
          // /__env_status — Which integration keys are present (no values).
          //   GET → { keys: [{ name, present, group }] }
          // ══════════════════════════════════════════════════════════════
          server.middlewares.use("/__env_status", (req, res) => {
            const groups: Record<string, string[]> = {
              core:        ["OPENROUTER_API_KEY", "ANTHROPIC_API_KEY"],
              providers:   ["OPENAI_API_KEY", "GEMINI_API_KEY", "GROQ_API_KEY"],
              media:       ["ELEVENLABS_API_KEY", "FAL_KEY"],
              higgsfield:  ["HIGGSFIELD_API_KEY_ID", "HIGGSFIELD_API_KEY_SECRET", "HIGGSFIELD_DEVICE_CODE"],
              voice:       ["ELEVENLABS_VOICE_A", "ELEVENLABS_VOICE_B", "ELEVENLABS_VOICE_NARRATOR", "ELEVENLABS_VOICE_ENERGETIC", "ELEVENLABS_VOICE_CALM"],
              integrations:["NOTION_TOKEN", "RESEND_API_KEY", "APOLLO_API_KEY", "GITHUB_TOKEN"],
              twilio:      ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_PHONE_NUMBER", "TWILIO_API_KEY_SID"],
              channels:    ["TELEGRAM_BOT_TOKEN", "SLACK_BOT_TOKEN", "DISCORD_TOKEN", "WHATSAPP_CLOUD_TOKEN"],
            };
            const out: { name: string; present: boolean; group: string; preview?: string }[] = [];
            for (const [group, names] of Object.entries(groups)) {
              for (const name of names) {
                const v = process.env[name];
                out.push({
                  name,
                  group,
                  present: Boolean(v),
                  preview: v ? `${v.slice(0, 4)}…${v.slice(-4)}` : undefined,
                });
              }
            }
            res.setHeader("Content-Type", "application/json");
            res.setHeader("Cache-Control", "no-cache");
            res.end(JSON.stringify({ keys: out }));
          });

          // ══════════════════════════════════════════════════════════════
          // /__higgsfield_status — Returns MCP URL + whether OAuth keys are present.
          //   Surfaces device-flow URL for the user to copy/paste into Claude / OpenClaw / Hermes.
          // ══════════════════════════════════════════════════════════════
          server.middlewares.use("/__higgsfield_status", (req, res) => {
            const mcpUrl = process.env.HIGGSFIELD_MCP_URL || "https://mcp.higgsfield.ai/mcp";
            const deviceCode = process.env.HIGGSFIELD_DEVICE_CODE;
            const keyId = process.env.HIGGSFIELD_API_KEY_ID;
            const keySecret = process.env.HIGGSFIELD_API_KEY_SECRET;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({
              mcp: { url: mcpUrl, discovery: "https://mcp.higgsfield.ai/.well-known/oauth-protected-resource" },
              auth: {
                deviceCode: deviceCode || null,
                deviceUrl: deviceCode ? `https://higgsfield.ai/device?code=${deviceCode}` : null,
                hasApiKey: Boolean(keyId && keySecret),
              },
            }));
          });

          // ══════════════════════════════════════════════════════════════
          // /__hermes_goal — Long-horizon goal mode
          //   POST { goal } → starts `hermes chat --yolo --max-turns 50` in scratch dir
          //   GET  ?id=<id> → returns running status + tail of log
          // ══════════════════════════════════════════════════════════════
          server.middlewares.use("/__hermes_goal", async (req, res) => {
            const { readFile, writeFile, mkdir } = await import("node:fs/promises");
            const { existsSync: exSync } = await import("node:fs");
            const { homedir } = await import("node:os");
            const nodePath = await import("node:path");
            const { spawn } = await import("node:child_process");

            const goalsDir = nodePath.join(homedir(), ".claude-os", "goals");

            if (req.method === "GET") {
              const url = new URL(req.url ?? "/", "http://x");
              const id = (url.searchParams.get("id") ?? "").replace(/[^a-z0-9_-]/gi, "");
              if (!id) {
                res.statusCode = 400;
                res.end(JSON.stringify({ error: "id required" }));
                return;
              }
              const dir = nodePath.join(goalsDir, id);
              const logPath = nodePath.join(dir, "log.txt");
              const metaPath = nodePath.join(dir, "meta.json");
              const meta = exSync(metaPath) ? JSON.parse(await readFile(metaPath, "utf8") as string) : {};
              const log = exSync(logPath) ? (await readFile(logPath, "utf8") as string).slice(-20000) : "";
              res.setHeader("Content-Type", "application/json");
              res.setHeader("Cache-Control", "no-cache");
              res.end(JSON.stringify({ meta, log }));
              return;
            }

            if (req.method === "POST") {
              let body = "";
              req.on("data", (c: Buffer) => { body += c.toString(); });
              req.on("end", async () => {
                try {
                  const parsed = JSON.parse(body) as { goal: string };
                  const goal = (parsed.goal || "").trim().slice(0, 2000);
                  if (!goal) {
                    res.statusCode = 400;
                    res.end(JSON.stringify({ error: "goal required" }));
                    return;
                  }
                  const id = `goal-${Date.now()}`;
                  const dir = nodePath.join(goalsDir, id);
                  await mkdir(dir, { recursive: true });
                  const logPath = nodePath.join(dir, "log.txt");
                  const metaPath = nodePath.join(dir, "meta.json");
                  await writeFile(metaPath, JSON.stringify({ id, goal, startedAt: Date.now(), status: "running" }, null, 2));
                  await writeFile(logPath, `> goal: ${goal}\n\n`);

                  const { createWriteStream } = await import("node:fs");
                  const out = createWriteStream(logPath, { flags: "a" });

                  let cp;
                  try {
                    cp = spawn("hermes", ["chat", "--yolo", "--max-turns", "50", "--prompt", goal], { cwd: dir, env: { ...process.env, HERMES_NO_TTY: "1" } });
                  } catch (e) {
                    out.write(`\n[spawn-error] ${String(e)}\n`);
                    out.end();
                    await writeFile(metaPath, JSON.stringify({ id, goal, startedAt: Date.now(), status: "error", error: String(e) }, null, 2));
                    res.setHeader("Content-Type", "application/json");
                    res.end(JSON.stringify({ id, status: "error", error: String(e) }));
                    return;
                  }
                  cp.stdout?.on("data", (d: Buffer) => out.write(d));
                  cp.stderr?.on("data", (d: Buffer) => out.write(d));
                  cp.on("close", async (code: number) => {
                    out.end();
                    try {
                      await writeFile(metaPath, JSON.stringify({ id, goal, startedAt: Date.now(), finishedAt: Date.now(), status: code === 0 ? "done" : "error", exitCode: code }, null, 2));
                    } catch { /* skip */ }
                  });

                  res.setHeader("Content-Type", "application/json");
                  res.end(JSON.stringify({ id, status: "running" }));
                } catch (e) {
                  res.statusCode = 400;
                  res.end(JSON.stringify({ error: String(e) }));
                }
              });
              return;
            }

            res.statusCode = 405;
            res.end();
          });
        },
      },
    ],
    server: {
      // Bind to localhost (resolves to 127.0.0.1 / ::1 — loopback only).
      // The dev server scans private user data (~/.claude/, keychain, JWTs)
      // so it must never be reachable from another machine on the LAN.
      // Using "localhost" (not "127.0.0.1") makes Vite display the
      // friendlier URL, and means the browser treats every visit as the
      // same origin — so localStorage (saved config, profile photo) stays
      // consistent regardless of whether the user types localhost or 127…
      host: "localhost",
      port: 8081,
      strictPort: true,
      // Exclude live-data.json from the file watcher. The aggregator writes
      // this file during the wizard (Steps 2 and 7). Without this exclusion,
      // Vite triggers HMR on every write, which re-mounts route components,
      // destroys React state, and creates infinite scan/activate loops.
      // The app reads the file at import time; hot-reloading it mid-wizard
      // is actively harmful.
      watch: { ignored: ["**/src/data/live-data.json"] },
    },
  },
});
