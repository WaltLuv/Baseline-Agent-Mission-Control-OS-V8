# Baseline OS · Phase 3 — Execution Tool Registry

> **Status: shipped (2026-06-01).**
> The execution layer. Phase 1 knew *who exists*. Phase 1.5 synced *what
> exists* to MC. Phase 2 *decided* who should act. Phase 3 *acts* — through
> approved CLIs, with secrets safe, with audit, with MC telemetry.

The directive: **"Do not rebuild CLI Anything. Upgrade it."** This phase
is that upgrade. The existing `/cli` page is now the Tool Registry view.
No new framework, no new dashboard, no new marketplace.

---

## What ships

| Surface | Path | Owns |
|---|---|---|
| Data layer | `src/lib/tool-registry.ts` | `ToolRegistryEntry`, validation, approval gate, secret handling, `executeTool()` spawn wrapper, telemetry update |
| Persistence | `~/.claude-os/tool-registry.json` | seed entries + telemetry counters |
| Audit ledger | `~/.claude-os/tool-executions.jsonl` | append-only; every run lands here including refusals |
| API | `vite.config.ts` `/api/tools/*` | list / get / schema / validate / run / logs / audit / enable / disable / seed / probe |
| CLI | `scripts/mc.ts` `mc tool *` | mirrors the API + table output + audit tail |
| UI | `src/routes/cli.tsx` | operator-grade table + per-action Test button + Schema view + recent audit rail |
| MC bridge | `publishToolExecution()` in `mission-control-sync.ts` | posts every linked-task execution to MC as a comment |
| Notion shim | `bin/notion-q` | token-safe Notion API wrapper (whoami / search / page-get) so the 3rd proof loop uses a real binary |

---

## ToolRegistryEntry — the data model

```ts
interface ToolRegistryEntry {
  id: string;
  cli_name: string;                     // executable on PATH or absolute
  category: string;
  description: string;
  workspace_id: string;                 // "*" = tenant-wide
  installed_status: "available" | "installed" | "broken";
  enabled_status: "enabled" | "disabled";
  allowed_runtimes: string[];           // Phase 1 runtime_type list (or ["*"])
  allowed_agents: string[];             // ["*"] in Phase 3
  required_secrets: string[];           // env-var NAMES only (never values)
  risk_level: "LOW" | "MEDIUM" | "HIGH" | "BLOCKED";
  approval_policy: "auto" | "approval-required" | "blocked";
  supported_actions: ToolAction[];
  examples: ToolExample[];
  audit_required: boolean;
  // Telemetry (mutated per execution)
  last_used_at: string | null;
  success_count: number;
  failure_count: number;
  average_runtime_ms: number;
  logs_enabled: boolean;
}

interface ToolAction {
  verb: string;
  description: string;
  argv: string[];                       // template w/ ${name} tokens
  input_schema: Record<string, { type: "string" | "number" | "boolean"; required?: boolean; pattern?: string; max_length?: number }>;
  output_schema: Record<string, unknown>;
  risk_level?: RiskLevel;               // override entry's default
  success_exit_codes?: number[];
  timeout_ms?: number;
}
```

Seeded entries are stored at `~/.claude-os/tool-registry.json`; operator
edits survive restarts.

---

## Security model — the non-negotiables

1. **`spawn(cmd, argv, {shell: false})` only.** No `exec`, no shell. Every
   token in the `argv` template that references an `${arg}` is filled from
   the caller's typed input — those tokens never contain shell metacharacters
   because spawn() takes them as separate argv entries, not as a single string.
2. **Strict input validation.** Every argument must match the action's
   `input_schema` (type + required + optional `pattern` + `max_length`).
   Unknown args are rejected. No coercion silently changes meaning.
3. **Approved tools only.** The dispatcher refuses any `tool_id` not in the
   registry. There's no "bring your own binary" path.
4. **Workspace scope.** Entries declare `workspace_id`; requests for a
   mismatched workspace are refused with a typed reason.
5. **Risk gates.** `LOW` + `auto` runs without a token. `MEDIUM` / `HIGH` /
   any non-auto policy requires an `approval_token` (Phase 4 will bind to a
   real engine; Phase 3 accepts any ≥ 8-char token as a stub so the contract
   is testable end-to-end).
6. **`BLOCKED` always refuses** — at the entry OR action level.
7. **Secrets are env-var names only.** `required_secrets: ["NOTION_TOKEN"]`
   tells the executor to copy that env var into the spawned process's env.
   The value never enters argv. The value never enters the audit ledger.
   The value never goes to MC. The UI shows the name with a ✓/✗ indicator
   for whether the OS has it, never the value itself.
8. **Audit on every call.** Whether the call succeeded, was refused at the
   gate, validation-rejected, or process-killed — a JSONL row lands.
9. **No filesystem access from the tools we ship in Phase 3** beyond what the
   underlying binaries already do (`gh` writes its own state; `notion-q` is
   network-only; `mc` is loopback-only).

---

## API — MCP-style surface

| Method | Path | Purpose |
|---|---|---|
| GET  | `/api/tools` | `cli_tool_list` |
| GET  | `/api/tools/:id` | `cli_tool_get` |
| GET  | `/api/tools/:id/schema?verb=V` | `cli_tool_schema` |
| GET  | `/api/tools/:id/logs?limit=N` | `cli_tool_logs` (audit tail filtered by tool) |
| GET  | `/api/tools/audit?limit=N&tool=ID` | global execution audit |
| POST | `/api/tools/:id/validate` | `cli_tool_validate` — dry-run args |
| POST | `/api/tools/:id/run` | `cli_tool_run` — execute with audit + telemetry |
| POST | `/api/tools/:id/enable` | toggle |
| POST | `/api/tools/:id/disable` | toggle |
| POST | `/api/tools/seed?force=true` | re-install canonical entries |
| POST | `/api/tools/probe` | refresh installed status for every entry |

All loopback-only.

---

## CLI — `mc tool`

```
mc tool list [--installed-only]
mc tool inspect <id>
mc tool schema <id> [--verb V]
mc tool validate <id> --verb V --args 'k=v,k=v'
mc tool run <id> --verb V [--args 'k=v,k=v'] [--task-id N] [--approval-token T]
mc tool enable <id>
mc tool disable <id>
mc tool audit [--lines N] [--tool ID]
mc tool seed [--force]
```

Every command supports `--json` for piping.

---

## Three seed entries (the proof loops use these)

### 1. `mc` — Mission Control / Baseline OS operator CLI

`cli_name`: absolute path to `bin/mc`. LOW risk, auto-approved. Verbs:
- `runtime-list` — `mc runtime list --json` (the canonical runtime probe)
- `sync-status` — `mc sync status --json`
- `route-preview` — `mc route preview --json "${description}"`

### 2. `gh` — GitHub CLI

LOW risk by default. Action-level overrides bump destructive verbs to MEDIUM:
- `auth-status` — LOW
- `repo-view` — LOW (read-only)
- `issue-list` — LOW
- `issue-create` — **MEDIUM** (writes to GitHub). Requires approval_token.

### 3. `notion-q` — token-safe Notion API shim

Ships in `bin/notion-q` (~60 lines of Bun TypeScript). Required secret:
`NOTION_TOKEN`. The token is read from the spawned process env, never argv.
Verbs:
- `whoami` — `GET /users/me`
- `search` — `POST /search { query }`
- `page-get` — `GET /pages/:id`

---

## Proof transcript — live, 2026-06-01

All three proof loops ran against the live MC V8 instance from Phase A
(`http://127.0.0.1:3000`, workspace `phase-a-workspace`).

### Proof loop 1 — Mission Control CLI

```
POST /api/route   { description: "list every registered runtime via the operator CLI" }
  router decision_id: route_1780363317455_adf398
POST /api/tools/mc/run   { verb: "runtime-list", decision_id: "route_…" }
  audit_id:   tx_1780363317457_6062e77b
  ok:         true   exit=0   duration=298ms   approved=true
  argv:       ['runtime', 'list', '--json']
  stdout:     { "ok": true, "runtimes": [ { "runtime_id": "claude-code@…", … } ] }
```

### Proof loop 2 — GitHub CLI

```
POST /api/tools/gh/run   { verb: "repo-view", args: { repo: "WaltLuv/baseline-agent-os" } }
  audit_id:   tx_1780363317759_6bbfc3e5
  ok:         true   exit=0   duration=433ms
  argv:       ['repo', 'view', 'WaltLuv/baseline-agent-os', '--json',
               'name,description,stargazerCount,isPrivate']
  stdout:     {"description":"Personal Agent OS — Claude Code + Codex + Gemini + 230 skills + multi-model orchestration, all on localhost.","isPrivate":true,"name":"baseline-agent-os","stargazerCount":0}
```

### Proof loop 3 — Notion (token-safe)

```
POST /api/tools/notion-q/run   { verb: "whoami" }
  audit_id:   tx_1780363318196_6e0c9be6
  ok:         true   exit=0   duration=859ms   approved=true
  argv:       ['whoami']                       ← NOTION_TOKEN NEVER appears
  stdout:     { "object": "user",
                "id": "1c039cd8-3a54-402c-8f96-f8ee08e828c7",
                "name": "Slim Charles Memory Layer",
                "type": "bot", "bot": { … } }
```

### MC execution telemetry (the last hop)

A `mc.sync-status` run linked to MC task 1:

```
POST /api/tools/mc/run   { verb: "sync-status", task_id: 1 }
  audit_id:   tx_1780363457873_d8f8ecda
  ok:         true   exit=0   duration=35ms

GET /api/tasks/1/comments  →  1 comment present, posted by baseline-os-tool-registry:

  ### Tool execution — mc.sync-status  ✅ ok
  - audit_id: `tx_1780363457873_d8f8ecda`
  - exit_code: `0`
  - duration: `35ms`
  - approved: `true`
  - argv: `sync status --json`
  **stdout (head):** { "ok": true, "cfg": { … } }
```

That closes the full proof diagram from the directive:

```
Mission Control Task              ✓ id=1 in MC
↓
Router Decision                   ✓ decision_id (Phase 2)
↓
Tool Selected                     ✓ entry from registry
↓
CLI Executes                      ✓ real spawn, real exit, real stdout
↓
Output Captured                   ✓ stored on the ExecutionResult
↓
Execution Ledger                  ✓ ~/.claude-os/tool-executions.jsonl
↓
Mission Control Proof             ✓ comment on the linked task
```

No mock execution. No placeholders. Real assignments, real spawns, real
audit, real telemetry.

---

## Files added / changed

```
src/lib/tool-registry.ts            NEW  data model + executor + audit
src/lib/mission-control-sync.ts     EDIT publishToolExecution() for MC telemetry
src/routes/cli.tsx                  REWRITE Tool Registry view (was 67-tool browser)
vite.config.ts                      EDIT +1 import block, +1 /api/tools dispatcher
scripts/mc.ts                       EDIT +9 mc tool subcommands wired into help/dispatcher
bin/notion-q                        NEW  token-safe Notion API shim (3 verbs)
BASELINE_OS_PHASE3.md               NEW  this doc
~/.claude-os/tool-registry.json     NEW  persisted entries (gitignored, run-time)
~/.claude-os/tool-executions.jsonl  NEW  append-only audit (gitignored, run-time)
```

---

## What Phase 3 deliberately does **not** do

- **Approval engine** — Phase 4. The risk gate accepts any ≥8-char approval
  token as a stub so the contract surface is testable. Phase 4 will replace
  this with a real operator-issued approval flow.
- **Router → registry auto-link in Phase 2** — Phase 2's `selected_tool`
  hint stays a runtime-installed-tool match. The Phase 3 executor is the
  canonical "what runs" decider; the router suggests and the operator picks
  the registry entry by id. A future refinement could collapse this.
- **Browser-driven tool fallback** — directive's "CLI/API first, browser
  second, manual third" rule. Phase 3 ships the CLI/API path. A browser
  fallback (`browser-use` already endpoint-wrapped) lands as a Phase 3.5
  add-on with the same `executeTool()` interface.
- **The remaining 64 CLI-Anything wrappers** — Phase 3 ships 3 canonical
  entries (mc, gh, notion-q). The remaining 64 wrappers from CLI-Anything
  enter the registry as operator-driven additions (or a future bulk-import
  task) rather than auto-installed without operator review.

---

## How to verify Phase 3 yourself

```bash
# 1. CLI surface
mc tool list
mc tool inspect notion-q
mc tool run mc --verb runtime-list
mc tool run gh --verb repo-view --args 'repo=WaltLuv/baseline-agent-os'
mc tool run notion-q --verb whoami           # needs NOTION_TOKEN in env or .env.local
mc tool audit --lines 20

# 2. API surface
curl -s http://localhost:8081/api/tools | jq '.entries[].id'
curl -s -X POST http://localhost:8081/api/tools/mc/run \
  -H 'Content-Type: application/json' \
  -d '{"verb":"runtime-list","task_id":1}'   # task_id triggers MC telemetry
curl -s http://localhost:8081/api/tools/audit?limit=5 | jq

# 3. UI surface
open http://localhost:8081/cli
#   → operator-grade Tool Registry, click Test on any LOW-risk verb,
#     see the real exit code + stdout
```
