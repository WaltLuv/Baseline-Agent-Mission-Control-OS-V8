# Orchestration architecture — three-mode map

> Phase 1 deliverable for #62. Maps every Maestro concept across the SQLite
> Kanban Dispatcher (Baseline OS local) and the cloud-native orchestration
> layer (Mission Control). Walt's bottom line: **Mission Control cloud
> must stand alone, Baseline OS local must stand alone, hybrid sync is
> optional.**

---

## 1. Deployment-mode contract

| Mode | Storage | Engine | Optional sync |
|---|---|---|---|
| **Baseline OS local** | `~/.claude-os/kanban.sqlite` + `~/.claude-os/kanban-events.jsonl` | SQLite Kanban Dispatcher (`mc kanban`) + optional Maestro CLI in repo | → MC via #63 event/proof mirror |
| **Mission Control cloud** | `workspace_credentials`, `orchestration_*` tables, multi-tenant SQLite | Cloud orchestration API (`/api/orchestration/*`) + remote runtime claim | ← Baseline OS mirror inbound (#63) |
| **Hybrid** | Both | Both | event/proof only, NOT DB replication |

**Hard rules** (no dependency chains):

- Mission Control does NOT shell out to the local `maestro` CLI for any cloud flow.
- Mission Control does NOT read `.maestro/` from disk.
- Baseline OS does NOT require Mission Control to function (offline / air-gapped works).
- Local users can run without Maestro installed (kanban is the floor).

---

## 2. Concept map (the table Walt asked for)

| Concept | Maestro (local) | SQLite Kanban (Baseline OS) | Mission Control Cloud | Decision |
|---|---|---|---|---|
| **Mission / program** | first-class | — | `orchestration_missions` | **Build** in MC; mirror from Maestro JSON when present |
| **Milestone** | first-class | — | metadata field on mission | **Reuse** mission row; expand later if needed |
| **Feature / task group** | first-class | — | `tag` column on `orchestration_tasks` | **Reuse** tag; no separate table this slice |
| **Task** | first-class | `tasks` (kanban id) | `orchestration_tasks` (workspace_id + mission_id) | **Build cloud table** + **reuse local kanban** |
| **Task dependencies** | first-class (blocker graph) | `parent_id` on `tasks` | `orchestration_task_dependencies` | **Build cloud table**; local kanban already has parent_id |
| **Ready queue** | derived | `dispatcher.promoteReady()` | derived via `dependencies_satisfied()` view | **Reuse engine** in local; **derive** in cloud |
| **Atomic claim** | ❌ (no worker model) | `claimNext()` UPDATE-WHERE | `claimReadyTask()` UPDATE-WHERE + workspace gate | **Reuse pattern**; same `WHERE status='ready'` predicate |
| **Worker assignment** | `task claim`, `handoff` | `assignee` field + atomic claim | `claimed_by_runtime_key_id` + `claimed_at` | **Build cloud**; map to existing `runtime_keys` table |
| **Stale claim recovery** | ❌ | heartbeat + TTL | heartbeat + TTL via cron sweep | **Build both** (engine + cloud) |
| **Handoff** | first-class | `dispatcher_runs` row | `orchestration_events` row | **Reuse events**; one event_type per transition |
| **Checkpoint save** | first-class | `mc kanban export` JSON snapshot | `GET /api/orchestration/export?format=maestro` | **Build export endpoint** |
| **Validation assertion** | first-class | proof row | `orchestration_proofs.proof_type='assertion'` | **Reuse proofs table** |
| **Reply / principle / memory note** | first-class | — | not implemented | **Defer** — Maestro-only until customer demand |
| **Proof receipt** | derived | engine writes via `markDone(proof)` | `orchestration_proofs` (sha256, uri, metadata) | **Build cloud table** + **reuse local engine** |
| **Event ledger** | local journal | `~/.claude-os/kanban-events.jsonl` | `orchestration_events` table | **Both**; #63 mirrors local → cloud |
| **Dispatcher run** | ❌ | `dispatcher_runs` table | `orchestration_events.event_type='dispatcher_run.*'` | **Reuse events** in cloud |
| **Approval gate** | ❌ | `requestApproval` + `decideApproval` | `orchestration_tasks.status='approval_required'` + existing Approval Engine | **Reuse Approval Engine** (don't build a second one) |
| **Telegram approval** | ❌ | hook on `requestApproval` (TODO #62.1) | hook on `orchestration_events` + existing Telegram credential | **Wire later** in #62.1 (both modes) |
| **Credit billing** | ❌ | ❌ | `applyCreditMutation()` on dispatcher run completion | **Reuse existing billing** |
| **Runtime registry** | implicit | manual assignee field | existing `runtimes` table + `runtime_keys` table | **Reuse**, claim must validate runtime key |
| **Workspace isolation** | ❌ | local-only, no tenancy | `workspace_id` UNIQUE constraints + role gate | **Build cloud-side**, default everywhere |

### Verdict on overlap

- **Maestro vs SQLite Kanban**: < 25% overlap (already concluded in the Baseline OS review). Maestro = planning notebook; Kanban = atomic worker queue. **Keep both.**
- **Mission Control cloud vs SQLite Kanban**: ~70% conceptual overlap by design — same atomic-claim model, same status lifecycle. **But the storage layer is separate by mandate.** Cloud has its own tables, multi-tenant from day one, ties into the credit ledger.
- **Mission Control cloud vs Maestro**: ~50% overlap on the noun model (missions / tasks / dependencies / proofs / events). **MC adopts the Maestro nouns** so Maestro JSON import/export is trivial; **MC adds workspace_id + runtime key auth + credit gate** which Maestro doesn't have.

---

## 3. What gets built now, reused, deferred

**Build now (this commit):**

- mc-v8 migration `067_cloud_orchestration` — `orchestration_missions`, `orchestration_tasks`, `orchestration_task_dependencies`, `orchestration_events`, `orchestration_proofs`.
- mc-v8 `src/lib/orchestration/store.ts` — pure data layer.
- mc-v8 API routes (admin-or-runtime-key auth):
  - `POST /api/orchestration/missions`
  - `POST /api/orchestration/missions/[id]/tasks`
  - `POST /api/orchestration/tasks/[id]/dependencies`
  - `POST /api/orchestration/tasks/[id]/claim` (runtime claim)
  - `PUT  /api/orchestration/tasks/[id]` (status update from runtime)
  - `POST /api/orchestration/tasks/[id]/proof`
  - `GET  /api/orchestration/tasks` (workspace-scoped list)
  - `GET  /api/orchestration/export?format=maestro` (JSON export)
- mc-v8 `/app/orchestration` page — read-only list of missions / ready / blocked / active / proofs / events, with a "Source: cloud | baseline-local | maestro-import" badge.
- claude-os `mc kanban` CLI extensions — the remaining commands Walt named: `create`, `ready`, `claim`, `update`, `complete`, `fail`, `block`, `unblock`, `events`, `proof`, `dispatch --once`, `export`.

**Reuse:**

- Runtime key authentication (existing `runtime_keys` table + `requireRuntimeKey` helper).
- Approval Engine (existing `approvals` infrastructure).
- Credit billing (`applyCreditMutation` on dispatcher run completion).
- Existing `audit_log` for every mutation.
- Existing SQLite Kanban engine in `claude-os/src/lib/kanban.ts` (atomic-claim pattern + scoring rubric).
- Existing `kanban-events.jsonl` as the mirror source for #63.

**Defer:**

- `mc kanban daemon` (long-running loop with backoff) — lands in #62.1 after Telegram is wired.
- Telegram approval gate on both modes — #62.1.
- Maestro JSON import endpoint (only export this slice) — #62.2.
- Maestro concepts that don't have a clear use yet: replies, principles, memory notes — keep an empty seat in the schema, surface only when a customer needs it.
- The `task_dependencies` separate table on Baseline OS — the local kanban already covers fan-in via `parent_id`; only the cloud side needs the explicit join table for many-to-many dependencies.

---

## 4. Maestro compatibility decision

**Maestro is the conceptual blueprint, not a runtime dependency.**

- The cloud `orchestration_*` tables borrow Maestro's noun model (mission, milestone, feature, task, dependency, handoff, checkpoint, assertion).
- `GET /api/orchestration/export?format=maestro` returns a JSON document the local `maestro` CLI can consume (mission + milestone + feature + task array with dependencies and proofs).
- The local kanban can `import-maestro` (reads `mission-control --json` from a local Maestro project, upserts to its own SQLite). Already designed in the Baseline OS architecture review; CLI wrapper lands in this commit's claude-os extensions.
- Local Maestro and cloud MC stay completely decoupled — neither shells out to the other for core flows; sync is event/proof only via #63.

---

## 5. Remote-runtime claim flow (no Baseline OS in the loop)

```
[ Customer creates a mission via /app/orchestration ]
        │
        ▼
POST /api/orchestration/missions     (admin or operator + workspace_id)
        │
POST /api/orchestration/missions/<id>/tasks
        │
POST /api/orchestration/tasks/<id>/dependencies (optional)
        │
        ▼  (tasks land status='todo'; auto-promote to 'ready' when deps satisfied)
[ Remote runtime — laptop / VPS / cloud worker ]
        │  authed via runtime_key (existing /api/runtimes path)
        │
POST /api/orchestration/tasks/<id>/claim
  · atomic UPDATE WHERE status='ready' AND workspace_id=?
  · sets claimed_by_runtime_key_id, claimed_at, status='in_progress'
  · returns task payload + last-known proofs
        │
PUT /api/orchestration/tasks/<id>            (progress + status flips)
POST /api/orchestration/tasks/<id>/proof     (sha256 + uri + metadata)
        │
        ▼
[ Cloud writes orchestration_events + applyCreditMutation for paid usage ]
[ Daily Brief / ROI / Activity Feed consume the events ]
```

No Baseline OS in the chain. Runtime can be any host that has a valid `runtime_key` for the workspace.

---

## 6. Hybrid mirror contract (the #63 hook)

When a Baseline OS box is connected, the local kanban emits events into
`~/.claude-os/kanban-events.jsonl`. The #63 mirror process tails that
file and POSTs each event to:

```
POST /api/orchestration/mirror   (runtime_key auth)
body:
  {
    source: "baseline-local",
    workspace_id: <int>,
    event_type: "task.claimed" | "task.completed" | "proof.attached" | …,
    payload: {…}
  }
```

The mirror endpoint upserts a row into `orchestration_events` with
`source='baseline-local'` (vs the cloud-native `source='cloud'`). The
`/app/orchestration` page's task source column reads this. **No DB
replication; events only.**

---

## 7. Security contract (cloud side)

- Every cloud write requires either an admin session cookie OR a valid
  `runtime_key` whose workspace_id matches the row.
- `claim` is workspace-scoped at the SQL level (`UPDATE … WHERE
  workspace_id = ? AND status = 'ready'`) — a runtime key for ws-A
  cannot claim a task in ws-B even if it guesses the task id.
- Proof bodies are bounded (≤256 KB metadata blob; hashes only, no raw
  content) and never logged in audit details.
- The Approval Engine gate stays on `status='approval_required'` —
  same lifecycle, no second approval system.

---

*Reviewed-by: Claude (System Pilot) — Phase 1 of #62. Phase 2 build
ships in the same commit chain so the architecture map is paired with
working code.*
