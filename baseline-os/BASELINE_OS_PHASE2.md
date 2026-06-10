# Baseline OS · Phase 2 — Workforce Router

> **Status: shipped (2026-06-01).**
> The decision layer. The first piece that makes Baseline OS feel
> intelligent rather than simply connected.
>
> Phase 1 answered *who exists*. Phase 1.5 answered *how do we sync*. Phase 2
> answers *who should do this work, with what tool, what skill, and what
> approval gate.*

---

## Why this is the brain

Every prior phase was infrastructure: registry, heartbeats, sync, audit. The
router is the first artifact that **decides**:

```
Task
 ↓
Baseline OS Router
 ↓
Best Runtime  +  Best Skill  +  Best Tool  +  Approval  +  Memory hint  +  Proof contract
 ↓
Execution
```

Without the router, every task is a human-pick. With it, the system can
default to a defensible choice and let the operator override only when
they want to. That's the line between "AI workforce orchestration" and "AI
agent fleet that needs a manager."

---

## What the router answers (the directive's 6 questions)

| Directive question | Phase 2 answer field |
|---|---|
| Which runtime should execute? | `selected_runtime` |
| Which tool should be used?    | `selected_tool` |
| Which skill is required?      | `selected_skill` |
| Is approval required?         | `approval.required` + `approval.risk` |
| What memory should be loaded? | `memory_hint.keys[]` (Phase 6 will upgrade to semantic) |
| What proof is required?       | `proof_contract` |

Plus three things the directive asked for as outputs:

- `routing_reason` (joined `rationale[]`)
- `routing_confidence` (0-100, normalized to 0.0–1.0 on the wire to MC)
- `alternatives[]` with score so an operator can see why the winner won

---

## Architecture

```
                ┌─────────────────────────────────────┐
                │  Mission Control V8                 │
                │  · /api/tasks    (create)           │
                │  · /api/tasks/:id/routing (publish) │
                │  · PUT /api/tasks/:id     (fallback)│
                └──────────────┬──────────────────────┘
                               ▲
                               │ POST routing decision (x-api-key)
                               │
┌──────────────────────────────┴──────────────────────────────────┐
│  Baseline OS                                                    │
│                                                                 │
│  /api/route            POST  → dry-run RoutingDecision          │
│  /api/route/execute    POST  → route + publish to MC            │
│  /api/route/proof      POST  → create + route + publish loop    │
│  /api/route/audit      GET   → tail of decisions                │
│  /api/route/categories GET   → category catalog                 │
│                                                                 │
│  ┌─────────────────────────────────────────────────┐            │
│  │ src/lib/workforce-router.ts                     │            │
│  │ · categorize(text)                              │            │
│  │ · scoreRuntime(record, category, preferred)     │            │
│  │ · pickSkill / pickTool                          │            │
│  │ · computeApproval (policy)                      │            │
│  │ · pickMemoryHints (Phase 6 placeholder)         │            │
│  │ · pickProofContract                             │            │
│  │ · routeTask → RoutingDecision                   │            │
│  └────────────────┬────────────────────────────────┘            │
│                   ▼                                             │
│           ~/.claude-os/router-decisions.jsonl                   │
│           (audit ledger — append-only)                          │
│                                                                 │
│           Reads ↑↑↑                                             │
│           ┌─────────────────────────────────────────┐           │
│           │ src/lib/runtime-registry.ts (Phase 1)   │           │
│           │ → live capabilities + health + load     │           │
│           └─────────────────────────────────────────┘           │
└─────────────────────────────────────────────────────────────────┘
```

The router is a **pure function over the Runtime Registry**. It owns no
runtime, runs no subprocess, and chats with no agent. It reads live state,
applies the policy, and emits a typed decision.

---

## Routing model

### Task categorization

Each category has a small set of regex patterns. The categorizer runs all
patterns against the task description and picks the highest-scoring
category, breaking ties in this order: **coding → research → operations →
content → browser** (heaviest-cognitive-work-first). When nothing matches,
the default is **research** (the safest read-only category).

| Category | Signal verbs (sample) | Phase 2 leads | Required capabilities |
|---|---|---|---|
| coding     | implement, refactor, fix, debug, edit, lint, test code | Claude Code, Codex, OpenClaw | `code.edit`, `code.read`, `shell.exec` |
| research   | research, investigate, analyze, summarize, explore     | Claude Code, Hermes, Codex   | `chat`, `memory.read` |
| browser    | navigate, click, scrape, fill form, log in              | OpenClaw, Codex               | `browser.control` |
| content    | write, draft, generate post/image/video, compose       | Claude Code, Hermes           | `chat` |
| operations | deploy, restart, configure, install, cron, monitor     | Hermes, OpenClaw              | `shell.exec`, `cron` |

### Runtime scoring

For each candidate runtime in the live registry:

```
score = capability_match (0-50)
      + category_prior_bonus (0/8/15/25)
      + health_bonus (0/2/8/20)
      + load_bonus (0/8/15)
      + preferred_runtime_bonus (0 or 25)
```

Offline runtimes are skipped (`-100`). The candidate with the highest score
wins. The next 3 alternates are included for transparency.

### Skill + tool selection

Skill: prefers an explicit `preferred_skill`, else picks the first installed
skill whose id keyword-matches the category bucket. Returns `null` when
nothing matches — the audit ledger shows `selected_skill: null` honestly
rather than guessing.

Tool: maps required capabilities to typical tool names per runtime (e.g.
`code.edit` → `Edit` / `Write`, `browser.control` → `browser` / `browser-use`).
Returns the first match.

### Approval policy

Phase 2 is intentionally conservative. The full Approval Engine is Phase 4.

| Pattern in description | Risk | Required | Behavior |
|---|---|---|---|
| `rm -rf`, `drop table`, `wipe`, `format disk`, `truncate` | **BLOCKED** | yes | No runtime selected. Confidence 0. Decision still logged. |
| `deploy`, `production`, `prod`, `send email/sms`, `publish`, `delete`, `merge to main`, `force-push` | **HIGH** | yes | Runtime selected, but `approval.required=true` so the dispatcher must wait for operator OK. |
| `install`, `configure`, `restart`, `update`, `create user` | **MEDIUM** | yes | Same as HIGH — approval required. |
| Category is `operations` | implicit | yes | Operations always need approval in Phase 2. |
| Caller asserts `requires_approval: true` | explicit | yes | Honored. |
| Otherwise | **auto** | no | Free to run. |

### Confidence score

`floor((winner_score / 135) * 100)` — then docked by:

- `-10` if no skill matched
- `-10` if no tool matched
- `-5` if approval is required

Reported on the wire to MC as `routing_confidence: 0.66` (i.e. 66/100).

### Memory hint

Phase 2 ships a keyword-extraction placeholder: noun-like tokens from the
description plus `workspace:<id>` and `category:<name>`. **Phase 6 (Memory
Coordination) will replace this with real semantic retrieval.** Marking
this explicitly so the field doesn't read as production-grade when it
isn't.

### Proof contract

| Category | Contract |
|---|---|
| browser | `stdout+exit+log+screenshot` |
| operations | `stdout+exit+log` |
| else | `stdout+exit` |

This pins what artifact the executing runtime owes the audit ledger.

---

## API surface

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/route`                 | Dry-run. Returns `RoutingDecision` without publishing or assigning. |
| POST | `/api/route/execute`         | Route + publish to MC. Requires `taskId`. |
| POST | `/api/route/proof`           | End-to-end loop: create task in MC → route → publish. |
| GET  | `/api/route/audit?limit=N`   | Tail of recent `RoutingDecision`s. |
| GET  | `/api/route/categories`      | Catalog. |

All loopback-only on the Baseline OS dev server. Writes flow to MC over
the sync layer's `x-api-key` channel.

---

## Publishing routing decisions to MC

The directive named the target endpoint:

> POST /api/tasks/:id/routing
> body: { assigned_runtime, selected_tool, selected_skill,
>          routing_reason, routing_confidence, approval_required }

Mission Control V8 of this writing (verified at `/tmp/mc-v8` on 2026-06-01)
does **not** yet ship that route. To respect the contract without blocking,
`publishRoutingDecision()` in `src/lib/mission-control-sync.ts`:

1. Calls `POST /api/tasks/:id/routing` first.
2. On `404 / 405 / 501`, falls back to `PUT /api/tasks/:id` with:
   ```json
   {
     "assigned_to": "<assigned_runtime>",
     "metadata": {
       "routing": { full payload },
       "routed_at": "<iso>",
       "routed_by": "baseline-os-workforce-router"
     }
   }
   ```

When MC adds the dedicated route, the direct call wins and no code change
is needed on the Baseline OS side. The proof transcript below shows both
the dedicated attempt and the successful fallback.

---

## CLI — `mc route`

| Command | Purpose | Exit |
|---|---|---|
| `mc route categories` | List the 5 supported categories | 0 |
| `mc route preview <task...>` | Dry-run, no audit write, no publish | 0 |
| `mc route run <task...> --task-id <id>` | Route + publish to MC for an existing task | 0/1 |
| `mc route proof <task...> --title <t>` | End-to-end: create task in MC → route → publish | 0/1 |
| `mc route audit [--lines N]` | Tail recent decisions with status icons | 0 |

Every command takes `--json`.

---

## Proof transcript — captured live on 2026-06-01

### Categorization — 5-of-5 expected categories

```
expected=coding     got=coding     → runtime=claude-code@…  conf= 66 tool=Edit      approval=auto
expected=research   got=research   → runtime=hermes@…       conf= 74 tool=memory    approval=auto
expected=browser    got=browser    → runtime=openclaw@…     conf= 71 tool=browser   approval=auto
expected=content    got=content    → runtime=hermes@…       conf= 54 tool=?         approval=auto
expected=operations got=operations → runtime=hermes@…       conf= 58 tool=shell     approval=approval
```

### Approval policy — verbs trigger correctly

```
"deploy to production and send the launch email to all customers"
  approval.required: True
  approval.risk:     approval
  approval.reason:   matched a HIGH-risk verb — approval required

"rm -rf /etc/passwd"
  approval.risk:     blocked
  approval.reason:   matched a BLOCKED verb pattern — task refuses to route
  selected_runtime:  None
```

### End-to-end loop via `mc route proof`

```
$ mc route proof --title "Phase2 CLI Proof" research the latest transformer …
mc route proof — end-to-end
────────────────────────────────────────────
  ✓ task created in MC  (id 3)
  category      research  (confidence 74/100)
  runtime       hermes@Walters-Mac-mini.local (score 100)
  skill         research · keyword match on "research"
  tool          memory · covers required capability "memory.read"
  approval      auto · no risk verbs detected
  proof         stdout+exit
  memory hint   10 keys (research, latest, transformer, scaling, laws, write…)
  alternatives  claude-code(85) · openclaw(35) · codex(-100)
  decision_id   route_1780360121666_e79069
✓ routing published via fallback-put  (HTTP 200)
```

### MC's view of the task post-publish

```
$ curl … GET /api/tasks/1
id:            1
title:         Phase 2 Proof — refactor auth middleware
status:        inbox
assigned_to:   claude-code@Walters-Mac-mini.local      ← from router
metadata.routing:
  assigned_runtime:    claude-code@Walters-Mac-mini.local
  selected_tool:       Edit
  selected_skill:      None
  routing_confidence:  0.66
  approval_required:   False
  category:            coding
  decision_id:         route_1780359362762_1175d1
  routing_reason:      category: coding (scores coding=1, research=0, …) · winner runtime …
```

That's the full chain from the directive's proof diagram:

```
Task Created                            ✓ POST /api/tasks → id 1
↓
Router Decision                         ✓ /api/route/proof → RoutingDecision
↓
Routing POST                            ✓ PUT /api/tasks/1 (fallback-put, HTTP 200)
↓
Mission Control Receives Decision       ✓ task.assigned_to + task.metadata.routing
↓
Runtime Assigned                        ✓ assigned_to = "claude-code@Walters-Mac-mini.local"
↓
Execution Begins                        Deferred — Phase 3 (Tool Registry) wires the actual exec
```

The final step is deliberately deferred to **Phase 3 (Tool Registry)**.
Phase 2 generates the decision and writes it to MC. Phase 3 picks up the
assignment and dispatches into the chosen runtime via the CLI/MCP shim.

---

## Files added / changed

```
src/lib/workforce-router.ts         NEW  routing engine + audit ledger
src/lib/mission-control-sync.ts     EDIT publishRoutingDecision + createTask + config-file fallback
src/lib/runtime-registry.ts         EDIT widened claude-code + codex capabilities (added chat / memory.read)
vite.config.ts                      EDIT +1 import block, +1 /api/route dispatcher
scripts/mc.ts                       EDIT +5 route subcommands wired into help/dispatcher
BASELINE_OS_PHASE2.md               NEW  this doc
~/.claude-os/router-decisions.jsonl NEW  append-only audit ledger (gitignored, run-time data)
~/.claude-os/mc-sync-config.json    NEW  persistent sync config (gitignored)
```

---

## What Phase 2 does **not** do (deliberately deferred)

- **Actual dispatch into runtimes** — Phase 3 (Tool Registry + CLI/MCP shim) owns this. The router writes the decision; Phase 3 reads it and spawns the appropriate process.
- **Semantic memory retrieval** — Phase 6 will replace the keyword-extraction `memory_hint` with real vector retrieval. Until then the field is honestly labeled placeholder.
- **Skill registry** — Phase 5 (Workforce Templates) will introduce a proper skill catalog with versions and dependencies. Phase 2 picks from `installed_skills[]` on the runtime record only.
- **Multi-step task graphs** — the router is a single-shot decision per task. Subtask decomposition is Phase 7+ workforce planning. The directive forbids "another framework" so we are NOT building a planner here.

These are named so Phase 3 inherits no ambiguity.

---

## Phase 3 readiness check

Phase 3 (Tool Registry) needs:

- ✅ A live Runtime Registry per workspace (Phase 1)
- ✅ A sync contract to MC for tool installs + invocation logs (Phase 1.5)
- ✅ A typed `selected_tool.id` on every routing decision (Phase 2 ←)
- ⏸ The Tool Registry data model (`ToolRegistryEntry`) — scoped in `CLI_ANYTHING_AUDIT.md`
- ⏸ The CLI/MCP execution shim — scoped in `CLI_ANYTHING_EVALUATION.md`

The remaining two are exactly what Phase 3 implements. Audit + evaluation
docs from the prior turns are the contract Phase 3 inherits.
