# CLI-Anything Page — Phase 3 Audit (the current state)

> This audit is the prep work for Phase 3 (Tool Registry). Per the directive's
> own phase sequence, **Phase 3 is blocked until Phase 2 (Workforce Router)
> ships** — but the audit itself is safe to file now so we know exactly what's
> being upgraded when Phase 3 starts.

Captured: 2026-06-01 against `7cea85f`.

---

## Current implementation

| Surface | Path | Lines | What it does |
|---|---|---|---:|
| Route | `src/routes/cli.tsx` | ~210 | Browse 67 CLI wrappers + click for AI briefing |
| Backend | `vite.config.ts` `server.middlewares.use("/__cli_registry")` | ~45 | Scans a single directory, returns `{ tools: [...], root: "..." }` |
| AI briefing | `/__ai_chat` (routed to `openclaw` after this turn's fix) | shared | 4-section briefing per tool |

The backend reads from one of two well-known paths and returns a flat list:

```ts
candidates = [
  ~/.claude-os/cli-anything,
  /tmp/agent-os-repos/CLI-Anything,
];
```

The shape it returns is intentionally tiny — just enough to power the list view:

```ts
{ tools: [{ name: "3MF", path: "/tmp/agent-os-repos/CLI-Anything/3MF", hasSkill: false }, ...], root: "..." }
```

Verified live:

```
$ curl -s http://localhost:8081/__cli_registry | jq '.tools | length'
67

$ curl -s http://localhost:8081/__cli_registry | jq '.tools[0:3]'
[
  { "name": "3MF",         "path": ".../3MF",         "hasSkill": false },
  { "name": "adguardhome", "path": ".../adguardhome", "hasSkill": false },
  { "name": "anygen",      "path": ".../anygen",      "hasSkill": false }
]
```

67 tools discovered, 0 advertising a `SKILL.md`. The `hasSkill` flag is the
only structural metadata the page knows about today; everything else has to
be inferred by the operator at runtime.

---

## What the page does today (vs. what the directive needs)

| Capability | Today | Phase 3 spec | Gap |
|---|---|---|---|
| List installed CLIs | ✅ 67 visible | ✅ "installed" + "available" sections | Need to distinguish *registered for this workspace* from *discoverable on disk* |
| AI briefing per tool | ✅ (fixed this turn — see below) | ✅ + add "schema view" button | Need a structured schema, not a free-text brief |
| Search / filter | ✅ name filter | ✅ + category facets | Need category metadata per tool |
| Categorisation | ❌ | ✅ (build, comms, finance, infra, …) | No categories assigned |
| Risk level per tool | ❌ | ✅ LOW / MEDIUM / HIGH / BLOCKED | Missing entirely |
| Allowed runtimes | ❌ | ✅ which runtimes can invoke this CLI | Missing entirely |
| Allowed agents | ❌ | ✅ (per-runtime allowlist) | Missing entirely |
| Required credentials | ❌ | ✅ list of env-var names | Missing entirely |
| Required approvals | ❌ | ✅ per-verb policy | Missing entirely |
| Command examples | ⚠ in the AI briefing only | ✅ structured `examples[]` array | Free text only |
| Input / output schema | ❌ | ✅ JSON schema per verb | Missing entirely |
| Success / failure criteria | ❌ | ✅ exit-code + stdout matchers | Missing entirely |
| Workspace scope | ❌ (global) | ✅ per-workspace enable/disable | Missing entirely |
| Last-used / success-rate | ❌ | ✅ telemetry | Missing entirely |
| Logs surface | ❌ | ✅ tail per tool | Missing entirely |
| "Test CLI" button | ❌ | ✅ sandbox-and-show-result | Missing entirely |
| "Enable for workspace" | ❌ | ✅ workspace gate | Missing entirely |
| MCP-style endpoints | ❌ | ✅ `cli_tool_list`, `get`, `run`, `logs`, `status`, `schema`, `validate` | Missing entirely |
| Routing decision | ❌ (user picks manually) | ✅ `routeToolForTask(task)` | Missing entirely |
| Audit / command ledger | ❌ | ✅ every invocation logged with proof | Missing entirely |

**Summary**: the existing page is a *catalog browser*. The directive asks for an *execution layer*. Those are different surfaces; the catalog is 70% of the way there for *discovery*, and ~0% of the way there for *execution + governance*.

---

## What this turn fixed on the existing page

Two real defects that were blocking the catalog from being useful at all:

1. **AI briefings were stuck on "waiting for briefing…"** — the OpenRouter side had only ~362 credits but the request hardcoded `max_tokens: 4096`, so every brief 402'd before streaming. Fixed by (a) defaulting `max_tokens` to 1500, (b) adding a 402 fallback to local Ollama Gemma, (c) routing CLI-Anything off `studio` (creative-writing system prompt) → `openclaw` (technical system prompt). Verified live: a fresh brief now streams in ~10s.

2. **Briefings were getting the wrong "voice"** even when they did stream, because the `studio` system prompt told the model it was a creative writer. Same fix as (1c) above.

These were pre-existing bugs in the catalog UX, not Phase 3 work.

---

## Recommended Phase 3 shape (when its turn comes)

Per the directive's strict phase sequence (Phase 2 must finish first), here's the design the audit suggests when we actually start Phase 3:

```
ToolRegistryEntry {
  id                  string   // e.g. "notion-cli"
  cli_name            string
  category            string   // e.g. "knowledge", "finance", "infra"
  description         string
  workspace_id        string   // (or "*" for tenant-wide)
  installed_status    "available" | "installed" | "broken"
  enabled_status      "enabled" | "disabled"
  allowed_runtimes    RuntimeKind[]   // from Phase 1
  allowed_agents      string[]
  required_secrets    string[]        // env-var names only, never values
  risk_level          "LOW" | "MEDIUM" | "HIGH" | "BLOCKED"
  approval_policy     "auto" | "approval-required" | "blocked"
  supported_actions   { verb, input_schema, output_schema, success_criteria, failure_states, risk_level }[]
  examples            { description, argv, expected_exit_code }[]
  audit_required      boolean
  last_used_at        string | null
  success_rate        number
  failure_rate        number
  average_runtime_ms  number
  logs_enabled        boolean
}
```

The routing function the directive describes:

```ts
routeToolForTask(task) → {
  decision: "cli" | "api" | "browser" | "manual",
  tool_id?: string,
  runtime_id?: string,           // from Phase 1 registry
  approval_required: boolean,
  proof_contract: "stdout+exit" | "stdout+exit+log" | "stdout+exit+log+screenshot",
  rationale: string,
}
```

This routing function is **the entire reason Phase 1 (Runtime Registry) had to ship first**. Without `allowed_runtimes` resolving to live `runtime_id`s, the router has nothing to point a CLI at.

The MCP-style endpoints (`cli_tool_list`, `cli_tool_get`, `cli_tool_run`, `cli_tool_logs`, `cli_tool_status`, `cli_tool_schema`, `cli_tool_validate`) are a thin shim over `ToolRegistryEntry` + `spawn(cmd, argv[])` with the security rules baked in (no shell interpolation, workspace-scoped env injection, audit log entry per call). Already sketched as one-file architecture in `CLI_ANYTHING_EVALUATION.md` from the prior turn.

---

## Why I am not starting the upgrade itself this turn

The directive's phase ordering is explicit:

| Phase | | Depends on |
|---|---|---|
| 1   | Runtime Registry | — |
| 1.5 | Mission Control sync (the gate) | 1 |
| 2   | Workforce Router | 1 + 1.5 |
| 3   | Tool Registry (the CLI-Anything upgrade) | 1 + 2 |

Phase 1.5 just shipped. Phase 2 is the next allowed move. Starting Phase 3 ahead of Phase 2 would violate the rule the directive opened with ("Do not start Workforce Router until sync is complete" implies the same discipline downstream — Phase 3 needs the Router's task model to know what `task` `routeToolForTask(task)` even consumes).

So this audit is the right deliverable for now — it locks in what changes when Phase 3 starts, without sneaking implementation in ahead of the sequence.

---

## What to do next (your call)

Three legitimate options after this push:

- **A. Verify the sync loop end-to-end** by spinning up MC V8 (`cd /tmp/mc-v8 && pnpm install && pnpm dev`) and running `mc sync push && mc sync flush && mc sync pull`. Closes the two deferred proof points in `MISSION_CONTROL_SYNC.md` and formally clears Phase 2.
- **B. Start Phase 2 (Workforce Router)** assuming the sync code is correct (it matches MC's source). Faster, with the residual risk that a real MC instance surfaces a contract bug.
- **C. Override the phase rule and start Phase 3 (the CLI-Anything upgrade) now** because the existing catalog is high-value and you want the operator-grade UI sooner. Doable, with the caveat that the Router will need to be retrofitted to consume the registry in Phase 2.

I'd recommend **A → B**. The CLI-Anything upgrade is a stronger surface when there's a real Router on top of it.
