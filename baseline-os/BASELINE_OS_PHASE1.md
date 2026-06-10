# Baseline OS · Phase 1 — Runtime Registry & Workforce Awareness Layer

> **Status: shipped (2026-06-01).**
> The foundation Baseline OS will stand on. Every later phase (Router,
> Tool Registry, Approval Engine, Templates, Memory Coordination) depends on
> the runtime awareness this phase delivers.

---

## Why this comes first

The directive is explicit:

> Do not start Approval Engine, Tool Registry, Memory Router, or Workforce
> Router until Runtime Registry is complete. Everything else depends on
> workforce awareness.

Workforce awareness means Mission Control can answer, at any moment:

| Question | How Phase 1 answers it |
|---|---|
| What runtimes exist? | `mc runtime list` / `GET /api/runtimes` |
| Which are connected? | `status: healthy` or `warning` |
| Which are healthy? | `status: healthy` + `health_score` |
| Which workspace owns them? | `workspace_id` (currently `local`; multi-workspace lands in Phase 2) |
| What capabilities do they expose? | `capabilities[]` |
| What tools do they have? | `installed_tools[]` |
| What skills do they have? | `installed_skills[]` |
| What tasks are they executing? | `active_tasks` (per-task breakdown is Phase 2) |
| What version are they running? | `version` |
| What costs are they generating? | `cost_today_usd`, `cost_month_usd` |

Until *all of those* return real values, nothing downstream can route safely.

---

## Architecture

```
                              Operator
                                 ↓
                          Mission Control
                                 ↓
                      ┌─────────────────────┐
                      │   Baseline OS       │
                      │                     │
                      │  ┌───────────────┐  │
                      │  │ Phase 1 ★     │  │
                      │  │ Runtime       │  │
                      │  │ Registry      │  │
                      │  └──────┬────────┘  │
                      │         │           │
                      │  Phase 2: Workforce Router (depends on ★)
                      │  Phase 3: Tool Registry      (depends on ★)
                      │  Phase 4: Approval Engine    (depends on ★ + 2 + 3)
                      │  Phase 5: Workforce Templates(depends on 1-4)
                      │  Phase 6: Memory Coordination(depends on 1-5)
                      └──────────┬──────────┘
                                 ↓
                       MCP Agent Gateway
                                 ↓
        ┌──────────┬──────────┬──────────────┬─────────┬──────────┬──────────┐
        Hermes    OpenClaw   Claude Code    Codex     VoiceOps   VisionOps
        ─────     ────────   ───────────    ─────     ────────   ─────────
        (every runtime registered + heartbeated through Phase 1)
                                 ↓
                          External Systems
```

Three artifacts make up Phase 1:

1. **Persistence**: `~/.claude-os/runtime-registry.json` (atomic write, JSON).
2. **API**: `/api/runtimes/*` on the Baseline OS dev server (`:8081`).
3. **Operator surfaces**: `mc` CLI, the `/runtime-registry` page, and `/flight-deck`.

Each consumes the same data; none owns it.

---

## Data model

`src/lib/runtime-registry.ts` defines the canonical type:

```ts
interface RuntimeRecord {
  runtime_id: string;            // "<type>@<host>"  ← stable, unique
  runtime_type: "hermes" | "openclaw" | "claude-code" | "codex" | "voiceops" | "visionops";
  workspace_id: string;          // "local" until multi-workspace
  name: string;                  // human label
  status: "healthy" | "warning" | "critical" | "offline";   // derived
  last_seen: string | null;      // ISO timestamp
  version: string | null;
  host: string;
  environment: "local" | "remote" | "cloud";
  capabilities: string[];        // e.g. ["chat", "code.edit", "browser.control"]
  installed_tools: string[];     // e.g. ["Read", "Write", "Bash"]
  installed_skills: string[];    // e.g. skill ids from ~/.hermes/skills/
  active_tasks: number;
  heartbeat_interval_sec: number;
  health_score: number;          // 0–100, derived
  cost_today_usd: number;
  cost_month_usd: number;
  failure_count_24h: number;
  consecutive_failures: number;
  metadata: Record<string, unknown>;
}
```

`status` and `health_score` are *always* recomputed on read so a stale on-disk
value can never lie. Health is **not binary**:

```
inferStatus():
  · no last_seen                            → offline
  · age > 900s                              → offline
  · age > 300s OR consecutive_failures ≥ 3  → critical
  · age >  60s OR consecutive_failures ≥ 1  → warning
  · else                                    → healthy

healthScoreFor():
  start 100
  − up to 40 for heartbeat staleness past 60s
  − up to 40 for failures in last 24h
  − up to 30 for consecutive failures
  clamp [0, 100]
```

---

## Runtime lifecycle

```
   ┌─────────────────────────────────────────────────────────────────┐
   │                                                                 │
   │  discoverRuntimes()  ◄────── auto-runs on every GET /api/runtimes
   │  (probes 6 runtime types,                                       │
   │   upserts records)                                              │
   │         │                                                       │
   │         ▼                                                       │
   │   ┌───────────┐  heartbeat(id, {…})   ┌──────────────────────┐  │
   │   │  healthy  │ ───────────────────►  │ heartbeat persists,  │  │
   │   └───────────┘                       │ resets consecutive   │  │
   │         │                             │ failures to 0        │  │
   │         │ heartbeat ages past 60s     └──────────────────────┘  │
   │         ▼                                                       │
   │   ┌───────────┐                                                 │
   │   │  warning  │  ← inferStatus() recomputes on every read       │
   │   └───────────┘                                                 │
   │         │ heartbeat ages past 300s OR 3 consecutive failures    │
   │         ▼                                                       │
   │   ┌───────────┐                                                 │
   │   │ critical  │  ← mc health exits 2                            │
   │   └───────────┘                                                 │
   │         │ heartbeat ages past 900s                              │
   │         ▼                                                       │
   │   ┌───────────┐                                                 │
   │   │  offline  │  ← Flight Deck moves it to the muted rail       │
   │   └───────────┘                                                 │
   │                                                                 │
   └─────────────────────────────────────────────────────────────────┘
```

Discovery is **idempotent and append-only**. A runtime that was once
registered is never auto-deleted — operators expect to see history (and the
historical fields are read by future phases for cost reporting and SLO math).

---

## API endpoints

All loopback-only. JSON in / JSON out.

| Method | Path | Purpose |
|---|---|---|
| GET  | `/api/runtimes`                       | List all + force re-discovery |
| POST | `/api/runtimes/discover`              | Same as above, explicit POST |
| GET  | `/api/runtimes/doctor`                | Full diagnostic pass |
| GET  | `/api/runtimes/:id`                   | One record |
| GET  | `/api/runtimes/:id/health`            | Status + score + failure counters |
| GET  | `/api/runtimes/:id/tasks`             | Active task count + breakdown |
| GET  | `/api/runtimes/:id/capabilities`      | Capability verbs + tools + skills |
| GET  | `/api/runtimes/:id/doctor`            | Per-runtime diagnostic |
| GET  | `/api/runtimes/:id/logs`              | Tail of well-known log paths |
| POST | `/api/runtimes/:id/heartbeat`         | Record a heartbeat (optionally `failed`) |

---

## CLI — `mc`

The operator's control surface. Installed at `bin/mc` (add to PATH):

```bash
export PATH="$HOME/code/claude-os/bin:$PATH"
mc help
```

Phase 1 subcommands:

| Command | Description |
|---|---|
| `mc help`                                 | Help text |
| `mc health`                               | Overall health, exit 2 on critical |
| `mc status`                               | Brief status of every runtime |
| `mc runtime list`                         | Tabular runtime list |
| `mc runtime inspect <id>`                 | Full record + capabilities + skills |
| `mc runtime doctor`                       | Deep health pass on every runtime |
| `mc runtime heartbeat <id> [--failed]`    | Record a heartbeat |
| `mc runtime capabilities <id>`            | Capability verbs |
| `mc runtime skills <id>`                  | Installed skill ids |
| `mc runtime tasks <id>`                   | Active task count |
| `mc runtime logs <id> [--lines N]`        | Tail recent log lines |

Every command accepts `--json` for piping.

Phase 1.5+ surface (referenced but not yet implemented):
`mc gateway health` · `mc task list` · `mc workspace list` ·
`mc employee list` · `mc skill list` · `mc flightdeck doctor` · `mc deploy health`

The CLI is the Operator Control Surface. It is **not** a Claude Code competitor.

---

## Operator surfaces

| Route | Purpose |
|---|---|
| `/runtime-registry` | Full Mission Control view of every runtime — drill-down, capability chips, skill list, raw metadata, heartbeat buttons |
| `/flight-deck`      | At-a-glance "desktop operator terminal" — top status pill, count strip, per-runtime rails. Refreshes every 4s |

Both consume `/api/runtimes` exclusively. Phase 2+ can wrap `/flight-deck`
in a native shell (Tauri / Electron) without rewriting the data contract —
that's the whole point of having a strict API boundary in Phase 1.

---

## Files added / changed

```
src/lib/runtime-registry.ts        NEW   data model + persistence + 6 probes (Hermes, OpenClaw, Claude Code, Codex, VoiceOps, VisionOps)
src/lib/mission-control-sync.ts    NEW   Phase 1.5 — bridge to MC V8 (handshake, heartbeat, pull, doctor, offline queue)
scripts/mc.ts                      NEW   mc CLI implementation (incl. mc sync *)
bin/mc                             NEW   bash wrapper that execs bun → scripts/mc.ts
vite.config.ts                     EDIT  +1 import block, +1 API dispatcher (/api/runtimes/*), /__ai_chat max_tokens fix + Ollama fallback
src/routes/runtime-registry.tsx    NEW   Mission Control view
src/routes/flight-deck.tsx         NEW   Desktop Operator Terminal
src/components/app-sidebar.tsx     EDIT  +Flight Deck + Runtime Registry rows under Personal
BASELINE_OS_PHASE1.md              NEW   this document
MISSION_CONTROL_SYNC.md            NEW   Phase 1.5 sync contract with MC V8
CLI_ANYTHING_EVALUATION.md         NEW   tool-registry evaluation (prior turn)
```

For the sync contract details (endpoints, env vars, troubleshooting,
field mapping, proof transcript), see **`MISSION_CONTROL_SYNC.md`**.
Phase 2 (Workforce Router) is **blocked** until that sync is verified
end-to-end against a live MC V8 instance.

Persisted state lives in `~/.claude-os/runtime-registry.json`. It is
git-ignored and rebuilt on demand — operators can delete it without losing
any source-of-truth data.

---

## Proof — Phase 1 live on this machine

```
$ mc runtime list
RUNTIME                                  STATUS         VERSION                       LAST SEEN       TASKS    HEALTH
──────────────────────────────────────────────────────────────────────────────────────────────────────────────
claude-code@Walters-Mac-mini.local      ● healthy      2.1.150 (Claude Code)         0s ago          1        100/100
codex@Walters-Mac-mini.local            ○ offline      codex-cli 0.133.0             never           0        0/100
hermes@Walters-Mac-mini.local           ● healthy      Hermes Agent v0.15.1          0s ago          0        100/100
openclaw@Walters-Mac-mini.local         ● healthy      unknown                       0s ago          0        100/100
```

```
$ mc runtime doctor
Runtime Doctor
────────────────────────────────────────────────────────────
● healthy   hermes@Walters-Mac-mini.local
    ✓ heartbeat_age      1s since last_seen
    ✓ liveness_probe     responding
    ✓ failure_rate       0 failures/24h · 0 consecutive
…
```

Both `/runtime-registry` and `/flight-deck` pages render the same data live
and refresh every 4–5s. Heartbeat buttons in the UI mutate the registry
through `POST /api/runtimes/:id/heartbeat` and the change is visible in
`mc runtime list` within one refresh cycle.

---

## What Phase 1 does **not** do (deliberately deferred)

- **Cost tracking**: `cost_today_usd` / `cost_month_usd` exist as fields but
  are not yet populated from real provider telemetry. Hermes already emits
  cost events; wiring them is a 1-day task on top of Phase 1 and lands with
  Phase 2.
- **Multi-workspace**: `workspace_id` is hard-coded to `local`. The data
  model already supports multiple workspaces; the UI assumes one.
- **Per-task breakdown**: `active_tasks` is a count. The breakdown (task id,
  agent, started_at, status) requires Phase 2's task queue.
- **Push heartbeats from runtimes**: Phase 1 supports operator-initiated and
  CLI-initiated heartbeats. Runtimes registering themselves on boot is
  Phase 1.5; the API surface already accepts it.
- **Native Flight Deck shell**: the directive describes Flight Deck as the
  Desktop Operator Terminal. Phase 1 ships it as a route inside the
  dashboard. A Tauri shell can wrap the same `/flight-deck` view with no
  contract changes.

These are explicitly named so the next phase knows what's already underway.

---

## Phase sequencing

| Phase | Title                          | Depends on        | Priority |
|------:|--------------------------------|-------------------|---------:|
| ★ 1   | Runtime Registry               | —                 | ⭐⭐⭐⭐⭐ |
|   2   | Workforce Router               | 1                 | ⭐⭐⭐⭐⭐ |
|   3   | Tool Registry                  | 1                 | ⭐⭐⭐⭐ |
|   4   | Approval Engine                | 1, 2, 3           | ⭐⭐⭐⭐ |
|   5   | Workforce Templates            | 1–4               | ⭐⭐⭐⭐ |
|   6   | Memory Coordination            | 1–5               | ⭐⭐⭐ |

Phase 2 (Workforce Router) is the natural next step. It consumes the
Runtime Registry to answer the directive's central question:

> Given a task, *who should do this?*

That answer requires capabilities, skills, current load, and approval policy
— all of which Phase 1 now exposes as a stable read surface.

---

## How to verify Phase 1 yourself

```bash
# 1. CLI surface
mc health                     # exit code reflects overall status
mc runtime list
mc runtime doctor
mc runtime inspect hermes@$(hostname)
mc runtime heartbeat hermes@$(hostname)

# 2. API surface
curl -s http://localhost:8081/api/runtimes | jq '.runtimes[].runtime_id'
curl -s http://localhost:8081/api/runtimes/doctor | jq

# 3. UI surfaces
open http://localhost:8081/flight-deck
open http://localhost:8081/runtime-registry
```

If every command returns real data on your machine — without you editing
anything by hand — Phase 1 has done its job.
