# Architecture review — Maestro vs the SQLite Kanban Dispatcher

> B.L.A.S.T. phase: **B**lueprint
> Operator: Walter Thornton · Date: 2026-06-06
> Pre-requisite for: #62 SQLite Kanban Dispatcher

This is the explicit recommendation Walt asked for before #62 lands. The
goal: avoid building two parallel task systems by clarifying who owns
what.

---

## 1. What each system is good at

### Maestro (third-party CLI, local-first)

- **Purpose**: conductor for multi-agent software-engineering missions.
- **Scope**: planning + state, NOT execution. It tracks missions,
  milestones, features, tasks, blockers, handoffs, checkpoints,
  validation assertions, memory corrections, and which agents are
  currently active on which task.
- **State**: `.maestro/` directory in each project repo (JSON / YAML).
- **Interface**: a CLI with first-class `mission-control --json` and
  `--preview` outputs — designed for dashboards to read.
- **Strengths**: rich blocker / handoff graph, project-aware (lives in
  the repo), version-control friendly, well-defined writable commands
  (`task ready`, `task claim`, `handoff`, `checkpoint save`,
  `memory-correct`).
- **Weaknesses**: no runtime execution engine of its own (it's a
  notebook for state, not a worker queue), no Telegram approval gate,
  no MC sync built in.

### Hermes SQLite Kanban Dispatcher (this repo, scaffolded)

- **Purpose**: runtime execution queue that actually CLAIMS work and
  hands it to an agent. Survives restarts, atomic single-claim, parent /
  child fan-in.
- **Scope**: claim → run → record proof → done. NOT the planning layer.
- **State**: `~/.claude-os/kanban.sqlite` + `~/.claude-os/kanban-events.jsonl`
  (host-wide, not per-project).
- **Interface**: `mc kanban` CLI (`doctor`, `list`, `add`, plus the
  unimplemented `dispatch` + `daemon`) + the engine library.
- **Strengths**: durable, atomic, restart-safe; built-in scoring rubric;
  Walt's Telegram approval gate naturally hangs off the
  `approval_required` state; existing kanban-events.jsonl is already
  the event ledger that #63 MC Mirroring will read.
- **Weaknesses**: greenfield; no project context (a task ID has no
  inherent "which repo / mission did this come from?"); doesn't model
  blockers as a first-class graph; reinvents handoff semantics that
  Maestro already has.

---

## 2. Are they duplicates?

**No — they overlap by < 25%.**

| Capability | Maestro | Kanban Dispatcher |
|---|---|---|
| Mission / milestone planning | ✅ first-class | ❌ |
| Blocker graph | ✅ first-class | ⚠️ parent/child only |
| Handoff semantics | ✅ first-class | ❌ |
| Checkpoint save / memory-correct | ✅ first-class | ❌ |
| Validation assertions | ✅ first-class | ❌ |
| Project context (repo-local state) | ✅ `.maestro/` | ❌ (host-wide) |
| Restart-safe durable claim | ❌ (CLI state) | ✅ SQLite + atomic UPDATE |
| Atomic single-claim race protection | ❌ | ✅ |
| Event ledger for MC mirroring | ❌ | ✅ `kanban-events.jsonl` |
| Telegram approval gate hook | ❌ | ✅ `approval_required` state |
| Scoring rubric (frequency × pain × solvability) | ❌ | ✅ |
| Dashboards (`mission-control --json`) | ✅ first-class | ❌ |

The two systems answer different questions:
- **Maestro** answers: *"What are we trying to build, in what order, with
  what acceptance criteria?"*
- **Kanban Dispatcher** answers: *"Which runnable unit of work do I claim
  RIGHT NOW, and how do I prove it landed?"*

---

## 3. Recommendation

**Build the SQLite Kanban Dispatcher (option 3 in Walt's framing), but
make Maestro the planning source-of-truth feeding into it.**

Specifically:

1. **Maestro stays as the upstream planner.** Operators run
   `maestro init`, define missions / features / tasks, declare blockers
   and acceptance criteria. The `.maestro/` directory in each repo is
   the source-of-truth for *what should exist*.

2. **Kanban Dispatcher is the downstream worker queue.** When a Maestro
   task is marked `ready` (`maestro task ready <id>`), an importer
   inserts a corresponding row into the Kanban board with the Maestro
   task id as the `parent_id` and the assignee from
   `maestro mission-control --json`. The kanban now owns:
   - Atomic claim (no two dispatchers spawn the same Maestro task twice).
   - Runtime proof recording.
   - Approval-gate routing (Telegram / MC).
   - Restart safety.

3. **Bidirectional state sync, both directions read-only at the
   boundary:**
   - Maestro → Kanban: importer reads `mission-control --json`, writes
     rows. Maestro state is NEVER mutated from the kanban side.
   - Kanban → Maestro: when a kanban task lands in `done` / `failed`,
     the dispatcher calls `maestro task update <id> --status=done`
     (or `--status=failed`). This is the ONE direction where the kanban
     mutates Maestro; it's a thin reverse-hook, not a generic write.

4. **No duplicate UI.** The `/maestro` page in Baseline OS surfaces the
   Maestro CLI dashboards (this commit). The `mc kanban` CLI + a small
   `/app/kanban` mc-v8 page surface the dispatcher's queue. They share
   a "via Maestro task" reference column when applicable so the
   operator can trace any kanban row back to its mission.

5. **Mission Control (cloud) remains read-only over both.** Per Walt's
   rule for #63: MC observes kanban events + Maestro mission snapshots
   via mirroring; the kanban engine and the Maestro CLI both stay on
   the local box. MC never writes either.

### Why not just use Maestro?
Maestro has no atomic-claim semantics, no restart-safe worker queue,
no approval-gate state, and no built-in event ledger for MC mirroring.
The dispatcher is the missing 25% — and conveniently the 25% Walt
already scaffolded.

### Why not just use the kanban?
The kanban has no mission / blocker / handoff model and no per-project
context. Pretending it does duplicates what Maestro already does well
and locks us out of Maestro's growing ecosystem.

---

## 4. Concrete next-step contract for #62

Land the dispatcher with **one** Maestro integration point and the
Telegram approval gate; defer advanced routing.

- `mc kanban dispatch` — single tick:
  1. `promoteReady()` — move `todo` rows whose parents are `done` → `ready`.
  2. `claimNext()` — pick the highest-scoring `ready` row, atomic claim → `in_progress`.
  3. If `approval_policy === 'required'`: post to Telegram, transition
     to `approval_required`. Wait for decision.
  4. Otherwise: spawn the assignee, write proof, transition `done`/`failed`.
- `mc kanban import-from-maestro` — read `maestro mission-control --json`
  in the current project, upsert any `ready` Maestro tasks as kanban
  rows. Idempotent (UNIQUE on `maestro_task_id`).
- `mc kanban daemon` — loop with backoff. **NOT in #62**; lands in a
  follow-up after Telegram + advanced routing are wired (#62.1 / #62.2).

That keeps the diff per commit small, the audit trail clean, and the
boundary with Maestro narrow enough that swapping Maestro out for a
different planning tool later is a one-file change.

---

*Reviewed-by: Claude (System Pilot). Pending: Walt's explicit go on the
boundary recommendation before any /lib/kanban-dispatcher code lands.*
