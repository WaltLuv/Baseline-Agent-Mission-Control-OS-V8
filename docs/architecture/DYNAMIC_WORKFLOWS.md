# Dynamic Workflows / Swarm Mode — Architecture (backlog)

> Native architecture pattern for AI Workforce OS. Built in-house. Not
> a dependency on Anthropic Claude Code Dynamic Workflows — same
> conceptual contract, adapted to our stack (SQLite WAL, Mission
> Control event bus, existing agent registry).

---

## 1. Stage contract — five gates

Every mission flows through **Command → Plan → Swarm → Verify → Keep**.
Each stage is observable, persistable, and revocable.

| Stage | Owner | Produces | Persistence row |
|-------|-------|----------|-----------------|
| **Command** | Operator | A plain-English mission string | `workflow_runs` |
| **Plan** | Mission Planner | Objectives, workstreams, agent roles, dependency graph, acceptance criteria, deliverables | `workflow_tasks` (status=`planned`) |
| **Swarm** | Swarm Executor | Per-task agent outputs, files touched, tool calls, confidence | `workflow_tasks` (status=`running` → `completed`) |
| **Verify** | Verification Judges | Pass / attention / fail per acceptance criterion + evidence pointer | `workflow_verifications` |
| **Keep** | Workspace Persistor | Final summary, change set, artifacts, recommended next actions | `workflow_artifacts`, `workflow_events` |

A run is **never** marked `completed` until every Verify entry returns `pass`
(or the operator explicitly accepts an `attention` finding through
`workflow_approvals`).

---

## 2. Data model — minimal new tables

```sql
CREATE TABLE workflow_runs (
  id             TEXT PRIMARY KEY,
  mission        TEXT NOT NULL,
  status         TEXT NOT NULL CHECK (status IN ('queued','running','needs_approval','failed','completed')),
  created_by     INTEGER NOT NULL,
  created_at     INTEGER NOT NULL,
  updated_at     INTEGER NOT NULL,
  model          TEXT,
  provider       TEXT,
  token_estimate INTEGER,
  final_summary  TEXT,
  verification_status TEXT
);

CREATE TABLE workflow_tasks (
  id             TEXT PRIMARY KEY,
  run_id         TEXT NOT NULL REFERENCES workflow_runs(id),
  assigned_agent TEXT NOT NULL,
  task_title     TEXT NOT NULL,
  task_prompt    TEXT NOT NULL,
  status         TEXT NOT NULL CHECK (status IN ('planned','running','review','needs_approval','completed','failed')),
  dependency_ids TEXT,             -- JSON array
  output         TEXT,
  confidence     REAL,
  files_touched  TEXT,             -- JSON array
  verification_result TEXT,        -- JSON
  created_at     INTEGER NOT NULL,
  updated_at     INTEGER NOT NULL
);

CREATE TABLE workflow_agents (
  id             TEXT PRIMARY KEY,
  run_id         TEXT NOT NULL REFERENCES workflow_runs(id),
  agent_id       INTEGER NOT NULL,       -- FK into existing agents table
  role           TEXT NOT NULL,
  status         TEXT NOT NULL
);

CREATE TABLE workflow_events (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id         TEXT NOT NULL REFERENCES workflow_runs(id),
  task_id        TEXT REFERENCES workflow_tasks(id),
  ts             INTEGER NOT NULL,
  kind           TEXT NOT NULL,          -- 'stage_change','agent_output','tool_call','judge_verdict','approval_requested'
  detail         TEXT                    -- JSON
);

CREATE TABLE workflow_verifications (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id         TEXT NOT NULL REFERENCES workflow_runs(id),
  judge          TEXT NOT NULL,
  question       TEXT NOT NULL,
  verdict        TEXT NOT NULL CHECK (verdict IN ('pass','attention','fail')),
  evidence       TEXT
);

CREATE TABLE workflow_artifacts (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id         TEXT NOT NULL REFERENCES workflow_runs(id),
  kind           TEXT NOT NULL,           -- 'file','test','report','summary'
  path           TEXT,
  payload        TEXT
);

CREATE TABLE workflow_approvals (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id         TEXT NOT NULL REFERENCES workflow_runs(id),
  requested_by   TEXT NOT NULL,           -- agent id or 'system'
  requested_at   INTEGER NOT NULL,
  reason         TEXT NOT NULL,
  resolved_at    INTEGER,
  resolved_by    INTEGER,                 -- operator user id
  decision       TEXT CHECK (decision IN ('approved','rejected'))
);
```

All tables additive — no existing schema breakage.

---

## 3. Services

```
src/lib/workflows/
├── orchestrator.ts          # Mission entry; transitions runs through stages
├── mission-planner.ts       # Command → Plan; emits tasks + dep graph
├── swarm-executor.ts        # Plan → Swarm; runs tasks respecting deps
├── verification-judges.ts   # Swarm → Verify; per-criterion checks
├── workspace-persistor.ts   # Verify → Keep; writes artifacts + summary
├── approval-gate.ts         # Pauses runs that touch risky surfaces
└── types.ts                 # Stage, Run, Task, Judge, Approval
```

Existing pieces to reuse:
- `src/lib/event-bus.ts` — emit `workflow:*` events for UI/SSE.
- `src/lib/auth.ts` — `requireRole('operator')` on every mutating route.
- `src/lib/rate-limit.ts` — limit mission creation per operator (3/min).
- `src/app/api/tokens` — billing reporting from inside agent tasks.
- `src/app/api/agents/:id/heartbeat` — runtime-side polling stays the same.

---

## 4. API surface

| Method | Path | Auth | Notes |
|--------|------|------|-------|
| POST | `/api/workflows` | operator | Creates a run; body `{ mission }`; returns `run_id` |
| GET  | `/api/workflows` | operator | Lists recent runs for the workspace |
| GET  | `/api/workflows/:id` | operator | Full run detail (tasks, events, verifications, artifacts) |
| POST | `/api/workflows/:id/approve` | operator | Resolves a pending approval |
| POST | `/api/workflows/:id/cancel` | operator | Cancels in-flight runs |
| GET  | `/api/workflows/:id/stream` | operator | SSE — live event feed |

Every endpoint returns the same shape the existing Mission Control
agents endpoints use (`{ ok, data }` / `{ error }`).

---

## 5. Safety / governance

A run **must** request approval before:
- Writing to a tracked source file outside an explicit scope token.
- Touching DB rows that are user-owned (operators must opt in).
- Calling deployment endpoints (`/api/deploy/*`).
- Spending more than the per-workspace mission budget (default $1).

Approval gating is implemented in `approval-gate.ts` and consumes
`workflow_approvals`. The verification judge can also raise
`needs_approval` when an `attention`-level finding crosses a policy
threshold (e.g. > 5 file mutations).

No secret/key data is ever embedded into `workflow_events.detail` or
`workflow_artifacts.payload`. The persistor scrubs strings matching
`SHARE_SIGNING_SECRET`, `STRIPE_*`, `AUTH_SECRET`, `API_KEY` before
write.

---

## 6. UI surfaces

- `/app/workflows/swarm` — the public-facing demo (already shipped,
  simulated data).
- `/app/workflows` — operator-facing list of real runs (backlog).
- `/app/workflows/:id` — single-run detail page with stage timeline,
  swarm map, verification panel, approval queue (backlog).

The simulated demo uses the same component vocabulary (`Stage`,
`SwarmAgent`, `MissionTemplate`) as the production planner output so
the UI doesn't need to change shape when the backend lands.

---

## 7. Rollout plan

| Slice | Scope | Acceptance |
|-------|-------|------------|
| **Slice 0** (shipped) | Demo panel + architecture doc | `/app/workflows/swarm` walks the five stages with deterministic fake data |
| **Slice 1** | Migrations + `POST /api/workflows` + mission planner producing a deterministic plan for the three demo missions | Run row + tasks persisted; UI lists run id |
| **Slice 2** | Swarm executor with single-agent execution per task; events streamed via SSE | Demo missions complete end-to-end; outputs persisted |
| **Slice 3** | Verification judges + approval gate | Risky actions block on `needs_approval`; judge verdicts visible in UI |
| **Slice 4** | Artifacts (file diffs, test runs) + recommended next actions | Run page shows full diff and test summary |
| **Slice 5** | Multi-agent parallelism with dependency graph | Tasks run in parallel where deps allow |

Each slice ships standalone behind a feature flag (`MC_WORKFLOWS_ENABLED`)
so the demo surface keeps working while the engine is built.
