# Mission Control — Changelog

Append-only log of significant deliveries. PRD.md holds the durable product spec; this file holds the timeline.

---

## 2026-06-02 · Phase 4 prep — Approval Supervision (Claude Code owns decisioning)

### Scope (approved by Walt — pure DISPLAY, zero approval logic)
Surface 7 approval fields inside Task Detail, Approval Queue, Activity Feed, Tool Executions:
`approval_status`, `approval_reason`, `approval_requested_by`, `approval_requested_at`, `approved_by`, `approved_at`, `approval_audit_id`. Claude Code's Baseline OS owns the Approval Engine. Mission Control SUPERVISES.

### Shipped
- **Migration 056**: 4 new additive columns on `tool_executions` — `approval_requested_by`, `approval_requested_at`, `approval_reason`, `approval_audit_id`. New partial index `idx_tool_executions_approval_queue` for fast "awaiting approval" reads. No backfill, no destructive changes.
- **`src/lib/baseline-os/tool-executions.ts`** updates:
  - `startToolExecution()` now sets `approval_requested_by` (falls back to `requested_by` if not supplied) and `approval_requested_at` when status = `awaiting_approval`. NULL for auto-approved (low/medium) and blocked — Mission Control reads these as "supervised by human" markers.
  - `approveToolExecution()` now accepts an optional `reason` (≤500 chars), writes the audit row FIRST, captures the audit_log id into `approval_audit_id`, and persists `approval_reason`. Activity feed mirror includes the reason in the description.
  - `rejectToolExecution()` already captured rejection_reason; now also captures `approval_audit_id` for symmetry.
- **API surface** (additive only — no new endpoints):
  - `POST /api/tool-executions` accepts `approval_requested_by` so the router can identify itself separately from the task requestor.
  - `POST /api/tool-executions/:id/approve` accepts `{ reason?: string }`.
  - All GET routes already returned full row — the new columns flow through automatically.
- **`<TaskRouterDecision>` (Task Detail)** — added two new inline rows per execution:
  - Approved/Rejected footer (emerald/rose tone) with `approved_by` / `rejected_by`, time-ago, `audit #N` link, and the verbatim approval/rejection reason rendered as an italic quote.
  - Awaiting-approval banner (amber tone) showing `approval_requested_by` and `approval_requested_at`.
- **`/app/tool-executions` slide-over detail panel** — added 4 new metadata rows: Approval requested by · Approval audit · Approved-at timestamp · Rejection metadata. Added a dedicated "Approval reason" section above the command block with emerald-on-emerald styling so it visually anchors as a positive decision (the rejection_reason section already existed in the data; the visual treatment now distinguishes them).
- **`ExecApprovalPanel` (Approval Queue)** — new `<ToolExecutionApprovalsSection>` mounted at the top of the approvals view. Polls `/api/tool-executions?status=pending_approval` every 12s. Renders a compact row per pending CLI execution with risk pill, command, optional `task #N` deep-link, requester + relative time, and **Approve / Reject** buttons that POST to the existing endpoints. Hides completely when nothing pending — never adds clutter for operators with empty queues.
- **Activity Feed** — descriptions now include the approval reason inline (e.g. `Approved resend · send-email — customer expects this email today and the PR has...`). Icons + colors for `tool_execution_approved` / `tool_execution_rejected` already shipped in the previous changelog entry.

### Verified
- 30/30 vitest pass (5 signup + 7 runtime-key + 13 supervision + 5 onboarding-state).
- 2 new Phase 4 regression tests:
  - HIGH-risk execution sets `approval_requested_by` + `approval_requested_at`, then approve captures `approval_audit_id` + `approval_reason`.
  - LOW-risk auto-approved executions explicitly do NOT set `approval_requested_at/by` (those fields are only meaningful when supervised).
- End-to-end curl proof: HIGH-risk request → GET detail returns the 4 new fields populated → approve with reason → all 7 directive fields present + verbatim reason in response → pending_approval filter returns only remaining queue → activity feed lists both events with reason in description.
- Browser proof (`/tmp/p4_task_detail.png`): single screenshot shows Task Detail with both states visible — one execution in `AWAITING APPROVAL` (with `⏳ awaiting approval · requested by workforce-router-claude-p4-1 · 4s ago`) and one `COMPLETED` (with `✓ approved by p4ui_xxx · 4s ago · audit #9` and the italicized approval reason quote underneath).

### Field-shape contract handed to Claude Code (Phase 4 integration)
1. When the Baseline OS Approval Engine sends a request for human approval, set `approval_requested_by` to the engine's own identity (e.g. `workforce-router-<runtime>` or `approval-engine-v1`). Mission Control will display it verbatim — operators will know exactly which subsystem requested the gate.
2. The Approval Engine MAY auto-approve LOW/MEDIUM by setting `policy_override` on the start call. HIGH continues to gate by default; this is workspace-configurable in Phase 4+.
3. The Approval Engine MAY approve or reject through the same `/approve` and `/reject` endpoints with `actor` derived from its session token. Reasons up to 500 chars are persisted verbatim and shown to operators.
4. Mission Control never makes a decision. It writes the decision the engine sent.

### Boundaries honored
- No approval logic in Mission Control.
- No new endpoints.
- No second approval queue.
- No tool selection / routing decisions.
- Pure read-side display.



## 2026-06-02 · Phase 3 prep — supervisor consumes Workforce Router output

### Scope (approved by Walt — pure DISPLAY, no decision logic)
Prepare Mission Control to consume Baseline OS Phase 3 outputs:
`selected_tool`, `execution_id`, `tool_execution_status`, `tool_execution_logs`, `tool_execution_proof` — surfaced inside Task Detail, Activity Feed, Tool Executions, Runtime Registry. Mission Control supervises. Does NOT build execution logic / tool selection / routing.

### Shipped
- **`src/components/baseline-os/task-router-decision.tsx`** (new): self-contained, polls `/api/tasks/:id` + `/api/tool-executions?task_id=:id` every 15s. Renders the directive's mandated five-stage breadcrumb: **Task → Router (confidence %) → Runtime → Tool → Terminal state**. Below the breadcrumb: skill, confidence, approval flag, reason quote, and a clickable list of all linked tool executions with status badge / exit code / cost / proof link. Returns `null` until the Router has touched the task — never blocks the Task Detail pane.
- **Task Detail integration**: slotted into the existing `TaskDetailModal` details tab (right after the metadata grid, before the GitHub section) in `src/components/panels/task-board-panel.tsx`. Task interface extended with all 7 router projection fields so the parent passes `initialDecision` for synchronous render.
- **Activity Feed mirror** (`src/components/panels/activity-feed-panel.tsx`): added 6 new event types with distinct icons + Tailwind color tokens:
  - `task_router_decision` (`↳`, violet)
  - `tool_execution_requested` (`⌁`, violet)
  - `tool_execution_approved` (`✓`, emerald)
  - `tool_execution_rejected` (`✕`, rose)
  - `tool_execution_completed` (`✓`, emerald)
  - `tool_execution_failed` (`!`, red)
- **Activity-log write-side** (`src/lib/baseline-os/tool-executions.ts`): every lifecycle event now writes to BOTH `audit_log` (immutable proof) AND `activities` (display feed). Covers:
  - `startToolExecution` → `tool_execution_requested`
  - `approveToolExecution` → `tool_execution_approved`
  - `rejectToolExecution` → `tool_execution_rejected` (with reason)
  - `patchToolExecution` on terminal state → `tool_execution_completed` or `tool_execution_failed`
- **No new endpoints**. No new schema. No routing decisions on MC side. No tool-selection logic on MC side. Strict consumer-only work.

### Verified
- 28/28 vitest pass (signup 5 + runtime-key 7 + supervision 11 + onboarding-state 5). New test `lifecycle events surface into the Activity Feed (read-side mirror)` asserts all 3 expected activity rows land (`tool_execution_requested`, `tool_execution_approved`, `tool_execution_completed`) after a full HIGH-risk execution lifecycle.
- Browser proof (`/tmp/task_detail_breadcrumb.png`): single screenshot shows the exact directive flow:
  ```
  Task → Router (87%) → claude-demo-1 → stripe-cli → Complete
  SKILL: draft-pr · CONFIDENCE: 87%
  "task title matches draft-pr skill exemplars; runtime has gh CLI installed"
  TOOL EXECUTIONS (1)
  [COMPLETED] stripe-cli · charge   exit 0   ~$0.029   proof ↗
  ```
  Every stage rendered with correct tone (emerald = done). Confidence label. Reason quote. Cost. Proof link to Stripe. Click on execution row routes to `/app/tool-executions` for the full audit detail.

### Field-shape contract for Claude Code (Phase 3 integration)
When Baseline OS's Tool Registry executes a CLI, POST to Mission Control in this exact order:
1. `POST /api/tasks/:id/routing` — router writes its decision FIRST (before runtime dispatch).
2. `POST /api/tool-executions` — runtime records intent. Must include `task_id`, `runtime_id` (numeric internal_id from `GET /api/runtimes`), `cli_tool_id`, `command_name`, `command_args_redacted`. Receives `execution_id` (the `id` in the response) for subsequent PATCHes.
3. `PATCH /api/tool-executions/:id` — runtime advances lifecycle: `{ status: 'running', started_at }`, then on completion `{ status: 'completed' | 'failed', completed_at, exit_code, stdout_summary, stderr_summary, proof_url, proof_payload, cost_estimate }`.
4. For HIGH-risk: runtime polls `/api/tool-executions/:id` for `status === 'approved'` before executing. If `awaiting_approval`, hold until human OK.

Mission Control will automatically:
- Mirror every event into Activity Feed.
- Link audit_log entries via `audit_event_id`.
- Render the breadcrumb on Task Detail.
- Update the Connected Tools supervisor page in real time.



## 2026-06-01 · Nav rail "Connected Tools" + retire legacy onboarding overlays

### Approved scope (Walt):
1. Add "Connected Tools" to nav under OBSERVE
2. Fix lingering admin overlay on `/app`

### Shipped
- `src/components/layout/nav-rail.tsx`: added `{ id: 'tool-executions', label: 'Connected Tools', icon: <ConnectedToolsIcon /> }` under OBSERVE between Approvals and Office. Custom SVG glyph (circle + 8-spoke radiating lines) in the 16-grid stroke style of the rest of the rail. Routes via `panelHref('tool-executions')` → `/app/tool-executions`, which is served by the standalone page I shipped yesterday (not the panel dispatcher).
- **Retired legacy onboarding auto-opens** — the new Activation Hub (`/app/activate`) is now the canonical post-signup experience:
  - `src/lib/onboarding-state.ts::shouldShowOnboarding` now returns `false` unconditionally. Killed the full-screen "Welcome to Mission Control · 0 of 5 runtimes ready · OpenClaw / Hermes / Claude Code / Codex / OpenCode" carousel that was occluding the entire dashboard for admin@workspace=1.
  - `src/components/help/first-run-tour.tsx::FirstRunTour` auto-open useEffect retired. Now sets the `mc:first-run-tour:v1` localStorage key on first mount so the legacy code path stays dormant.
  - Replay capability preserved for both — the Settings panel "Replay onboarding" button and the Help menu "Replay tour" button still work via the existing `mc:first-run-tour:replay` window event and the `setShowOnboarding(true)` store action.
- `src/lib/__tests__/onboarding-state.test.ts`: existing test rewritten to enforce "never auto-opens" contract (5 assertions covering admin / non-admin × completed / skipped / fresh).

### Verified
- 27/27 vitest pass across signup (5), runtime-key (7), supervision (10), onboarding-state (5).
- Browser proof: `/app` for legacy `admin/admin12345` now shows the clean dashboard — setup checklist, top bar, gateway banner, all 14 nav-rail icons including the new Connected Tools one. **0 dialogs / 0 modals / 0 overlays** (verified via `document.querySelectorAll('[role=dialog], [aria-modal=true]')` returning `[]`).
- `/app/tool-executions` reachable: testid `tool-executions-page` present, "Execution supervisor" headline + filter chips + empty state copy ("No commands waiting on you. Your workforce is autonomous within the safe-risk envelope you've set.") all render correctly.

### Carry-over (per Walt's "no new features until the loop exists" rule)
- No `/api/runtimes/:id/health` (Phase 3+).
- No workspace-level risk-policy editor (Phase 3+).
- Mission Control Phase 1 is complete. Waiting for Claude Code Workforce Router integration to close the full loop: **Task → Baseline OS Router → Runtime Assignment → Execution → Tool Execution Ledger → Mission Control Proof**.

### Note on Claude Code's debug session (not actionable on MC side)
Walt pasted Claude Code's `/tmp/mc-v8` session: he POSTed 4 runtimes to `http://127.0.0.1:3000/api/runtime/handshake` and got success responses, but `GET /api/runtime/handshake` returned 0 and `sqlite3 ... SELECT * FROM runtime_registry;` returned 0 rows. This is in his local clone at `/tmp/mc-v8` — NOT this MC instance. Three possible root-causes from this side of the boundary:
1. His Vite + Next.js dev server is double-running on different ports — POSTs landing on one DB, sqlite3 inspecting another.
2. His MC_API_KEY env var matches MC's global key resolver, which returns `workspace_id = getDefaultWorkspaceContext().workspaceId` (first workspace by id ASC). If his `/tmp/mc-v8` DB has no workspaces, the insert succeeds against `workspace_id = 1` (FK-less) but his sqlite3 query is hitting a different `.data/` directory.
3. He's connected to a stale `next dev` instance that returned 200 from a stub before the real route attached.

Field mapping on this MC instance is provably correct (10 supervision tests verify INSERT → SELECT round-trip, plus end-to-end curl through the external proxy URL). No code change needed on the supervision side.



## 2026-06-01 · Mission Control Supervision Layer (Tool Executions + Runtime Registry consumer)

### Mandate (from Walt + Claude Code)
- Mission Control supervises. Baseline OS routes. Runtimes execute.
- Claude Code shipped the local Baseline OS Runtime Registry (commit `7cea85f` on `baseline-agent-os`). My job is to **consume**, not rebuild.

### Shipped
- **Migrations 053–055**: extended `runtime_registry` with `host` / `installed_tools` / `installed_skills` / `health_score` / `metadata` (additive, idempotent); new `tool_executions` table; `tasks` gains the 6 Workforce-Router projection columns (`assigned_runtime`, `selected_tool`, `selected_skill`, `routing_reason`, `routing_confidence`, `router_approval_required`, `router_decided_at`).
- **Runtime Registry consumer**:
  - `GET /api/runtimes` — Phase 1 projection (runtime_id, runtime_type, status: `healthy / warning / critical / offline`, health_score, capabilities, installed_tools, installed_skills, active_tasks, heartbeat_age, last_seen, host, workspace_id, metadata, internal_id).
  - `GET /api/runtimes/[id]` — single-runtime detail.
  - `GET /api/runtimes/[id]/tasks` — tasks the Workforce Router assigned to that runtime.
  - `POST /api/runtime/heartbeat` — extended to persist the Phase 1 extras Claude Code sends (host / installedTools / installedSkills / healthScore / capabilities / version / metadata).
  - Status derivation pure function `deriveStatus(health, lastSeenAt)` → healthy / warning (>120s OR amber) / critical (>300s OR red) / offline (>600s). Snapshot non-mutating.
  - `installationId` is the canonical `runtime_id` on the wire — matches Claude Code's `mission-control-sync.ts` field mapping.
  - **No second registry.** Existing `runtime_registry` table reused; no `/api/runtimes/sync` route added (would duplicate Claude Code's `/api/runtime/handshake` consumer).
- **Workforce Router decision sink**: `POST /api/tasks/[id]/routing` accepts `assigned_runtime`, `selected_tool`, `selected_skill`, `routing_reason`, `routing_confidence` (0..1), `approval_required`. Audit-logged + activity-logged. Mission Control stores and displays — it never decides.
- **Tool Executions supervisor** (`Connected Tools` per the customer-facing copy rule — never "CLI Anything" in UI):
  - `POST /api/tool-executions` — runtime records intent. Classifies risk (`low` auto-runs, `medium` auto-runs, `high` → `awaiting_approval`, `blocked` → never runs). Audit row created + linked back via `audit_event_id`.
  - `PATCH /api/tool-executions/[id]` — runtime advances lifecycle: status → running → completed/failed; persists exit_code, stdout/stderr summaries, proof_url, proof_payload, cost_estimate. Status transitions validated.
  - `GET /api/tool-executions` — list with filters: `status`, `task_id`, `runtime_id`, `limit`, `offset`. Filter `status=pending_approval` returns only HIGH-risk items awaiting human OK.
  - `GET /api/tool-executions/[id]` — full detail including proof payload (JSON-parsed).
  - `POST /api/tool-executions/[id]/approve` — admin/owner approves; rejects if status != `awaiting_approval`.
  - `POST /api/tool-executions/[id]/reject` — admin/owner rejects with optional reason.
  - Risk classifier (`/app/src/lib/baseline-os/tool-executions.ts::classifyRisk`): LOW = list/cat/read/get/search/show/status/describe/view/preview/render. MEDIUM = create-draft/draft/generate/write/render-pdf/export/archive. HIGH = send-email/send/email/invite/charge/invoice/publish/deploy/apply/create-pr/merge. BLOCKED = delete-all/drop/rm-rf/destroy/reset-database/truncate. Workspace policies can override via `policy_override` on the start payload.
- **UI surface**: `/app/tool-executions` — supervisor view. Filter chips (Needs approval / All / Running / Completed / Failed / Rejected), risk + status badges, command preview, approve/reject buttons (admin only), audit IDs, proof links, cost estimates, task back-links. Slide-over detail with stdout/stderr/proof_payload JSON. No new dashboard — single focused page.
- **MC_API_KEY auth**: existing `requireRole` already supports `x-api-key` header via `agent_api_keys.key_hash`; no changes needed. Runtime sync does NOT depend on browser cookies.

### Verified
- 10/10 new vitest tests in `/app/src/lib/baseline-os/__tests__/supervision.test.ts` pass (runtime projection, status derivation across all 4 levels, router-decision-on-task, full LOW/MEDIUM/HIGH/BLOCKED lifecycle, approve/reject, list filters).
- 5/5 signup + 7/7 runtime-key tests still pass (no regressions).
- End-to-end browser proof (`/tmp/te_pending.png`, `/tmp/te_all.png`): supervisor UI renders, awaiting-approval row has working Approve/Reject buttons, completed row links to Stripe proof URL + audit #14, blocked row is non-actionable.
- End-to-end curl proof: handshake → heartbeat (extended) → list (Phase 1 projection) → create task → POST routing decision → GET /api/runtimes/:id/tasks reflects assignment → POST tool-executions (low/high/blocked) → approve → patch running → patch completed with proof → ledger filtered by `pending_approval` is empty afterwards.

### What Claude Code still needs to expose (for the closed loop)
1. Real `installation_id` per-host (current local registry uses `kind-prod-1` placeholders). Recommend hostname + UUID.
2. `health_score` numeric (0–100) on every heartbeat, not just `green/amber/red`.
3. `installed_tools[]` and `installed_skills[]` on heartbeat (Phase 1 docs Claude Code spec'd them; the wire payload should include them every cycle).
4. `metadata` object: at minimum `last_task_at`, `uptime_s`, runtime version, OS, arch.
5. When the Workforce Router selects a runtime + tool, POST to `/api/tasks/:id/routing` BEFORE dispatching to the runtime. Mission Control needs the decision to display "Router Decision → Runtime Assigned → Execution Started → Execution Complete" on Task Detail.
6. When the runtime executes a CLI, POST `/api/tool-executions` with `task_id`, `runtime_id` (numeric internal_id from /api/runtimes), `cli_tool_id`, `command_name`, `command_args_redacted` — then PATCH lifecycle.

### Files added/modified
- `src/lib/migrations.ts` — migrations 053, 054, 055
- `src/lib/baseline-os/runtime-registry.ts` — extended fields, projection helper, `getRuntimeByInternalId`, `deriveStatus`
- `src/lib/baseline-os/tool-executions.ts` (new) — full supervision module
- `src/app/api/runtime/heartbeat/route.ts` — accepts Phase 1 extended fields
- `src/app/api/runtimes/route.ts` (new) + `[id]/route.ts` + `[id]/tasks/route.ts`
- `src/app/api/tasks/[id]/routing/route.ts` (new) — Workforce Router decision write-back
- `src/app/api/tool-executions/route.ts` (new) — GET list, POST start
- `src/app/api/tool-executions/[id]/route.ts` (new) — GET, PATCH
- `src/app/api/tool-executions/[id]/approve/route.ts` (new)
- `src/app/api/tool-executions/[id]/reject/route.ts` (new)
- `src/app/app/tool-executions/page.tsx` (new) — supervisor UI
- `src/lib/baseline-os/__tests__/supervision.test.ts` (new) — 10 regression tests



## 2026-06-01 · Activation Stabilization Pass

### Root-cause fixes (no new features, no new dashboards)
- **Onboarding agent provisioning was silently 4xx-ing.** `/app/src/app/onboarding/page.tsx` POSTed `{name, status:"active", capacity:3}` to `/api/agents`. (a) `status:"active"` is not in the enum (`online|offline|busy|idle|error`). (b) `capacity` is not a column on the SQLite `agents` table. (c) `role` was missing yet the route requires it. Fixed by sending `{name, role:"AI Employee", status:"offline"}`. This is the actual code path that originated the recurring `SqliteError: table agents has no column named capacity` history (also caught by the seed-demo script's swallow-and-fallback). The runtime-key route itself was never the source — confirmed by 7 fresh regression assertions.
- **New workspaces had no default project.** `/api/auth/signup` and `/api/workspaces` POST now seed a default `General` project inside the same transaction that creates the workspace. Without this, the onboarding wizard's first `/api/tasks` call 500'd with `No active project available in workspace` for every new customer (the migration only seeded `General` for workspaces that already existed at migration time).
- **Standalone static asset symlink lost on every `pnpm build`.** `/app/scripts/start-with-node22.sh` now unconditionally re-creates `/app/.next/standalone/.next/static → /app/.next/static` and `/app/.next/standalone/public → /app/public` on every supervisor start (previously skipped if a stale dir was already there). Closes the recurring deploy regression flagged by testing-agent iterations 4/6/7.
- **Login submit testid.** Added `data-testid="login-submit"` to the sign-in `<Button>` so logout/login round-trip tests don't depend on translated button text.

### Verified (Customer Zero browser pass — testing-agent iteration 7)
- 18/18 backend pytest assertions pass.
- Browser-walked: `/signup` → `/onboarding` (3 steps) → `/app/activate` → Runtime Wizard (Claude key minted, command rendered with `MC_URL` + `MC_API_KEY` + `RUNTIME_TYPE` + `connect-runtime.mjs`) → Invite Team (invite sent + chip shown) → `/help` (9 articles · 7 categories · client-side search) → `/pricing` → `/app/billing` → logout/login round-trip.
- 5/5 existing signup tests still pass.
- 7/7 new regression tests in `/app/src/app/api/onboarding/runtime-key/__tests__/runtime-key.test.ts` pass (covers schema integrity, idempotency, all four runtimes, unauth 401, bad-runtime 400).

### Files changed
- `src/app/onboarding/page.tsx` — agent payload corrected.
- `src/app/api/auth/signup/route.ts` — seed default `General` project.
- `src/app/api/workspaces/route.ts` — seed default `General` project.
- `src/app/login/page.tsx` — `data-testid="login-submit"` on the submit button.
- `scripts/start-with-node22.sh` — unconditional re-symlink of standalone static/public.
- `src/app/api/onboarding/runtime-key/__tests__/runtime-key.test.ts` (new) — 7 regression tests.

### Carry-over (not blocking activation)
- `/app/activate` overlay for legacy `admin@workspace=1` — old "Welcome to Mission Control" setup modal still occludes the new Activation Hub. New signups are unaffected. Cosmetic; not on the customer self-serve path.
- `/login` UI submit click (`button:has-text('Sign in')`) intermittently does not navigate after a 200 from `/api/auth/login`. The added testid is a workaround for tests. Real-cause investigation deferred.



## 2026-05-31 · Customer Zero Browser Pass (browser-proven)

### Shipped — closes 3 launch-blockers
- **TeamPanel** at `/app/team` — `src/components/panels/team-panel.tsx`. Members list, invite form, role picker, pending invites with copy/revoke buttons. Admin-only invite section; operator sees read-only members.
- **RuntimeKeysPanel** at `/app/runtime-keys` — `src/components/panels/runtime-keys-panel.tsx`. Pick agent → name → days → mint. Returned `mca_…` value shown ONCE in copy-now amber block with ready-to-paste systemd snippet. Existing keys table with revoke.
- **AgentGatewayPanel** at `/app/agent-gateway` — `src/components/panels/agent-gateway-panel.tsx`. Health card (uptime, mc_connected, agent pills), tasks list, click-to-expand log viewer (stdout + stderr).
- `/api/workspaces/[id]/members` — GET endpoint backing TeamPanel; cross-workspace 403.
- Nav rail entries for Team, Runtime keys, Agent Gateway in `src/components/layout/nav-rail.tsx`.
- `/login` label fix: `username` → `Username or email` to match what the field actually accepts.

### Root-cause fixes found during the browser pass
1. **Supervisor was running `next start` under `output: standalone`** — silently fell back to a stale mode, new routes weren't served. Switched to `node /app/.next/standalone/server.js`. Added symlinks `.next/standalone/{.data,.env,.next/static}` so standalone server reads the real DB / env / static chunks.
2. **FirstRunTour auto-opened on every URL** and yanked the user back to `/app` because step 1's panel = 'overview'. Customer navigates to `/app/team` → 1.5s → tour opens → tour navigates → URL reverts. Fix in `src/components/help/first-run-tour.tsx`: only auto-open when `window.location.pathname === '/app'`.
3. **Onboarding wizard re-opened on every new browser session** for users who had skipped previously, because `dismissedThisSession` is sessionStorage-scoped. Fix in `src/lib/onboarding-session.ts`: trust server-side `completed`/`skipped` flags as the source of truth; do NOT auto-replay.
4. **TeamPanel filter on non-existent `status` field** — API returns `used_at`/`revoked_at`/`expires_at`. Filter rewritten; new invite optimistically prepends to UI.

### Verification (live, this pass)
| Gate | Result |
|---|---|
| `tsc --noEmit` | ✅ 0 errors |
| `pnpm vitest run` | ✅ all green (1259 baseline + 5 new agent-gateway-client + 5 onboarding) |
| `yarn build` | ✅ Compiled in 131s |
| `/app/team` panel renders in browser | ✅ data-testid='team-panel' count=1 |
| Invite submit → accept_url box | ✅ data-testid='invite-accept-url-box' count=1 |
| `/app/runtime-keys` mint key | ✅ minted `mca_de792a7720…` shown in fresh-key-block |
| `/app/agent-gateway` health | ✅ "Gateway reachable" + 4 agent pills + 3 task rows visible |
| Cross-workspace `/api/workspaces/1/members` | ✅ 403 |
| `/forgot-password` on a freshly-signed-up user | ✅ 200 (was 429) |

### Operator actions still required
- Push `flight-deck-v0.1.0` git tag → installer binaries
- Stripe live keys → `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_LIVE_MODE=true`
- Google Cloud Console → add production origin to OAuth Authorized JavaScript origins



## 2026-05-31 · FastMCP Agent Gateway bootstrap + MC_API_KEY connector

**Goal:** finish the architectural mandate — bootstrap the scaffolded
`/services/agent-gateway` into Mission Control (real HTTP control plane,
real MC proxy, real telemetry phone-home) AND eliminate browser-cookie
dependence for unattended daemons.

### A — FastMCP Agent Gateway, integrated end-to-end
- `services/agent-gateway/src/agent_gateway/http_api.py` — new HTTP control
  plane mounted alongside FastMCP via `@mcp.custom_route`:
  - `GET /health` (open)         — liveness, identity, agent inventory, MC link state
  - `GET /v1/agents` (open)      — enabled agents + advertised tool names
  - `GET /v1/tasks` (api-key)    — recent task list (limit, agent filter)
  - `GET /v1/tasks/{id}`         — single task envelope (status, exit_code, cost)
  - `GET /v1/logs/{id}`          — stdout/stderr tail
  - `POST /v1/bootstrap`         — force telemetry re-register (idempotent)
- `services/agent-gateway/src/agent_gateway/telemetry.py` rewritten so
  register / heartbeat both go through `/api/agents/register` (the only
  endpoint MC actually supports for runtime handshake). Heartbeat is a
  cheap idempotent re-handshake that bumps `last_seen` server-side.
- `services/agent-gateway/src/agent_gateway/__main__.py` now spins up a
  sibling thread on boot that registers + heartbeats — no longer waits for
  the first MCP tool call. Telemetry fires on process start.
- Mission Control side:
  - `src/lib/agent-gateway-client.ts` — single source of truth for gateway
    reachability. 5s timeout, env-driven URL, mirrors api key onto both
    `x-api-key` and `Authorization: Bearer`.
  - `src/app/api/agent-gateway/{health,tasks,tasks/[id],logs/[id]}/route.ts`
    — Next.js proxy endpoints. Health = viewer role. Tasks/logs = operator
    role (prompts may contain sensitive content).
- Env contract (Mission Control):
  ```
  AGENT_GATEWAY_URL=http://127.0.0.1:8765
  AGENT_GATEWAY_API_KEY=<same value the gateway uses as its MC_API_KEY>
  ```
- Supervisor template `scripts/supervisor.agent-gateway.conf` for the
  operator to copy onto the host where the CLI agents (`claude`, `codex`,
  `opencode`, `hermes`) live. Off-by-default in dev containers.

### B — MC_API_KEY support in `scripts/connect-runtime.mjs`
Connector now accepts EITHER:
  - `MC_API_KEY=mca_<48 hex>` → sends `x-api-key:` + `Authorization: Bearer`
  - `MC_SESSION="<mc-session value>"` → sends `cookie:`
…and bails with a clear error if neither is set. Honest auth-mode logging
on every register / heartbeat line so operators see what's actually in use.

### C — Documentation
- `docs/operations/RUNTIME_API_KEYS.md` — operator-grade guide: minting,
  scopes, revocation, connecting any of Hermes / OpenClaw / Claude Code /
  Codex / agent-gateway with an API key, systemd unit, failure matrix,
  security defaults.
- `services/agent-gateway/README.md` extended with §4b describing the MC
  HTTP control plane and the env contract.

### Verification (live, this pass)
| Gate | Result |
|------|--------|
| `npx tsc --noEmit` | ✅ 0 errors |
| `pnpm vitest run` | ✅ **1259 / 1259** (+5 new agent-gateway-client) |
| `pytest -q` (gateway) | ✅ **27 / 27** |
| `yarn build` (next 16.2.6 turbopack) | ✅ Compiled in 151s |
| `/api/status?action=health` | ✅ 200 (DB + memory + disk healthy) |
| `/api/agent-gateway/health` (cookie, no key) | ✅ 200, `mc_connected: true` |
| `/api/agent-gateway/tasks` (cookie + AGENT_GATEWAY_API_KEY) | ✅ 200, real task list |
| `/api/agent-gateway/tasks/{id}` | ✅ 200, single task envelope |
| `/api/agent-gateway/logs/{id}?stream=stdout` | ✅ 200, real log content |
| `connect-runtime.mjs MC_API_KEY=…` | ✅ register + heartbeat, `connection_status: connected`, no cookie |
| Gateway auto-register on boot | ✅ logged "Registered with Mission Control as agent-gateway-test (agent_id=93)" |
| Public routes (/, /login, /signup, /pricing, /marketplace, /roi-calculator, /flight-deck, /docs) | ✅ all 200 |
| Auth-required routes without cookie | ✅ 307 (page) / 401 (api) — no leaks |
| Homepage scroll trap | ✅ no `h-screen overflow-hidden` on root |
| Emergent preview URL | ✅ Live at https://mission-control-v8.preview.emergentagent.com |

### Files changed
```
new   services/agent-gateway/src/agent_gateway/http_api.py
new   scripts/supervisor.agent-gateway.conf
new   docs/operations/RUNTIME_API_KEYS.md
new   src/lib/agent-gateway-client.ts
new   src/lib/__tests__/agent-gateway-client.test.ts
new   src/app/api/agent-gateway/health/route.ts
new   src/app/api/agent-gateway/tasks/route.ts
new   src/app/api/agent-gateway/tasks/[id]/route.ts
new   src/app/api/agent-gateway/logs/[id]/route.ts
mod   services/agent-gateway/src/agent_gateway/gateway.py      (register http_api)
mod   services/agent-gateway/src/agent_gateway/telemetry.py    (register via /api/agents/register, agent_id tracking)
mod   services/agent-gateway/src/agent_gateway/__main__.py     (telemetry thread on boot)
mod   services/agent-gateway/README.md                         (§4b MC control plane)
mod   scripts/connect-runtime.mjs                              (MC_API_KEY support)
mod   memory/test_credentials.md                               (gateway env + API-key flow)
mod   .env                                                     (AGENT_GATEWAY_URL + AGENT_GATEWAY_API_KEY)
```

### Operator actions still required (no engineering fix)
- **Stripe live keys** — set `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` +
  `NEXT_PUBLIC_STRIPE_LIVE_MODE=true` on the deployed host.
- **Flight Deck v0.1.0 GitHub Release** — push tag `flight-deck-v0.1.0`
  to fire the existing CI matrix.
- **Google Cloud Console** — add the production origin to
  Authorized JavaScript origins (current code is correct; only Google's
  side needs the value).

---


## 2026-05-30 (PM #5) · Flight Deck production-test readiness

**Goal:** A user can pick Mission Control's deployment target (Emergent / DigitalOcean / Staging / Localhost / Custom), persist it across restarts, see real runtime status, and reset their session — without any background polling. Plus a public download page, a CI build matrix, full docs.

**Desktop shell (`/app/desktop/`):**
- `src/allowlist.js` — Replaced two-preset list with four named presets (`emergent`, `digitalocean`, `staging`, `localhost`) plus `MODE_LABELS`. `ALLOWED_HOSTS` now permits `*.emergent.host`, `*.emergentagent.com`, `*.preview.emergentagent.com`, `baseline-agents.com` (and subdomains), legacy `baselineautomations.com`, plus loopback. Wildcard prefix `*.` supported in `hostMatches()`. `activeUrl()` returns `''` for empty presets (instead of silently falling back) so the UI can prompt for a Custom URL.
- `index.html` — Picker for the four presets with hosts surfaced beneath each label, Custom URL field with allowlist hint, runtime status panel (Hermes · OpenClaw/OpenCode · Claude Code · Codex) with a **manual Refresh button**, **Reset Session** button (clears local target settings + posts `/api/auth/logout`), version footer.
- `src/main.js` — Auto-polling **removed**. Status refresh happens only on: initial load, target change, manual Refresh, manual Test Connection. `fetchRuntimeStatus()` reads both filesystem-detected `runtimes[]` (local install) and DB-registered `registered[]` (remote handshake), and reports `connected`/`stale`/`disconnected`/`not connected`/`login required` per row.
- `src-tauri/tauri.conf.json` — CSP extended to include `*.emergent.host` and `*.emergentagent.com` in `connect-src` / `frame-src` / `img-src`.

**Public download page (`/app/src/app/flight-deck/page.tsx` + `/download` redirect):**
- Honest amber "Installer build pending — use local build instructions" banner while `releaseStatus === 'pending-build'`.
- Three platform cards (macOS / Windows / Linux) each with status badge, expected artifact name, and a copy-to-clipboard build command. **No Download buttons appear** because no binaries exist yet — JSX guard requires `p.status === 'available' && releaseUrl`, both false.
- Full build-from-source recipe (Rust prereqs per OS, clone+install+run in two terminals, installer build).
- GitHub Actions tagging instructions.
- "What Flight Deck does" outcome list — including "Never bundles credentials", "Does not auto-refresh", "Allowlisted hosts only".
- Added `/flight-deck` and `/download` to the public-path allowlist in `src/proxy.ts` (previously they 307-redirected to `/login`).

**Cross-platform CI (`/app/.github/workflows/flight-deck-release.yml`):**
- Matrix builds: macOS-arm64, macOS-x64, Windows-x64, Linux-x64.
- Triggered by `flight-deck-v*` tag or `workflow_dispatch`.
- Rust + Node setup, Cargo cache, Tauri build per `--target`.
- Apple + Windows signing secrets are optional — workflow produces unsigned dev builds if secrets are absent.
- Release stage downloads all artifacts and publishes them to a GitHub Release with honest "unsigned development build" release notes.

**Docs:**
- `desktop/README.md` rewritten — full prereq + run-locally + build + sign + troubleshooting table.
- Root `README.md` quickstart section adds the "Run the Flight Deck desktop terminal alongside it" two-terminal recipe and a pointer to the local check script.

**Local check script (`/app/scripts/local-flight-deck-check.mjs`):**
- Probes `/`, `/api/status?action=health`, `/api/agent-runtimes`, `/login` against `http://localhost:3000` (port + URL overridable).
- Exits 0 on green; exits 1 with concrete remediation when MC is unreachable; treats `/api/agent-runtimes` 401 as the expected "session required, click Refresh after sign-in" hint.

**Tests:**
- `desktop/__tests__/allowlist.test.js` — rewritten to cover all 4 presets, wildcard host matching, custom URL precedence, loopback rule, malformed input rejection.
- `desktop/__tests__/runtime-status.test.js` — covers active URL resolution, empty `emergent` preset, custom URL override, navigation blocking, full host allowlist.
- `src/app/flight-deck/__tests__/page.test.ts` — pins the honest contract: `releaseStatus='pending-build'`, `releaseUrl=null`, banner test id present, all 3 platform cards, JSX guard requires both `status === 'available'` AND `releaseUrl` before rendering a Download anchor.

**Quality gates after this pass:**
- `tsc --noEmit` — clean
- `vitest run` — **1254 / 1254 pass** (was 1241; +13 new desktop + flight-deck tests)
- `next build` — clean
- Live probe: `/flight-deck` → 200, `/download` → 307 → `/flight-deck` → 200
- Screenshot proof captured: hero, platform cards, build instructions, CI section, "What Flight Deck does", CTA — every section renders, no broken Download buttons, banner is honest about CI status.

---



**P0a — Hero copy reverts (per user):**
- Hero pill: `Business Systems, Installed` → `AI Workforce OS`
- Final CTA H2: `Ready to stop chasing work and start finishing it?` → `Ready to deploy your first AI employee?`
- All other outcome-first messaging (Problem section, Solution section, How-it-works "Install / Automate / Monitor", outcome-led features, verticals, testimonial, pricing copy) **preserved**.

**P0b — Google Auth `[GSI_LOGGER]: Check credential status returns invalid response`:**

Root-caused into TWO distinct issues:

1. **CSP violation (code fix):** Console showed `Loading the stylesheet 'https://accounts.google.com/gsi/style' violates "style-src-elem 'self' 'unsafe-inline'"`. The CSP builder (`src/lib/csp.ts`) allowed `accounts.google.com` in `script-src` and `frame-src` only — missing from `style-src` / `style-src-elem` / `connect-src` / `img-src`-for-avatars. GSI cannot render its credential picker UI without all of those.

   **Fix:** rewrote `buildMissionControlCsp` to grant the full GSI surface when `googleEnabled=true`:
   - `script-src` → adds `https://accounts.google.com https://apis.google.com`
   - `style-src` + `style-src-elem` → adds `https://accounts.google.com`
   - `connect-src` → adds `https://accounts.google.com https://oauth2.googleapis.com`
   - `frame-src` → adds `https://accounts.google.com https://content.googleapis.com`
   - `img-src` → adds `https://*.googleusercontent.com https://lh3.googleusercontent.com`

   Browser re-verification: the stylesheet CSP violation is gone; GSI button renders cleanly. New regression tests in `src/lib/__tests__/csp.test.ts` pin every Google surface and assert nothing leaks when `googleEnabled=false`.

2. **Missing origin in Google Cloud Console (operator action):** Google's credential-status endpoint replies "invalid" for any origin not in the OAuth client's Authorized JavaScript origins. The Emergent preview URL `https://e3fc518c-…preview.emergentagent.com` was never added (only `mission.baselineautomations.com` was, and that domain isn't owned by us). Updated `docs/operations/LAUNCH_OPERATOR_PACKAGE.md §C.1` with the current preview URL + a warning that this error has no code-side fix and disappears the moment the origin lands in GCP.

**P1 — Host hardening runbook (new §I in `LAUNCH_OPERATOR_PACKAGE.md`):**

Added a complete §I "Host hardening" section covering:
- I.1 — Non-root container user (already in `Dockerfile.hardened` line 92 — `USER nextjs` UID 1001 — documented with verification command)
- I.2 — NTP (`timedatectl set-ntp true` + verification)
- I.3 — UFW firewall (allow OpenSSH, 80, 443, then enable)
- I.4 — Unattended-upgrades for Debian/Ubuntu and dnf-automatic for RHEL/Fedora
- I.5 — fail2ban (SSH brute-force lockout)
- I.6 — `/tmp` hardening with `noexec,nosuid,nodev` in `/etc/fstab`
- I.7 — AppArmor (Ubuntu/Debian) or SELinux (RHEL/Fedora) confirmation
- I.8 — Core-dump suppression (`kernel.core_pattern = |/bin/false`) persisted via `/etc/sysctl.d`
- I.9 — Optional LUKS encryption of the data volume
- I.10 — 8-step verification checklist

Explicit note at top of §I: if the operator uses **DigitalOcean App Platform** (the recommended path), DO manages all of this; this section only applies to raw droplet deployments.

**Verification:**
- `tsc --noEmit` — clean
- `vitest run` — **1241 / 1241 pass** (was 1239; +2 new CSP regression tests)
- Browser re-test on `/login`: GSI script loaded, `window.google.accounts` present, Sign-in-with-Google button rendered, stylesheet CSP violation **gone**. Remaining `inline script violates CSP` is a `next dev` HMR injection — not present in production builds and unrelated to GSI.

---

## 2026-05-30 (PM #3) · Homepage positioning rewrite + Stripe Connect clarification

**1. Stripe Connect blocker resolved (without writing code):**
Walter was being prompted in the Stripe Dashboard to choose Platform / Marketplace / Connect Express / Custom. Confirmed Mission Control needs **Stripe Billing + Checkout only**. No Connect, no platform/marketplace, no application fees, no seller onboarding. Mission Control sells subscriptions + credit packs directly to its own customers. The sample-code zip the user downloaded was Connect-specific and is being ignored.

**2. Homepage positioning rewrite — outcomes first, AI as engine.**
Spec from user: lead with outcomes, technology second. Rewrote `/app/src/app/page.tsx` end-to-end:

| Section | Before | After |
|---|---|---|
| Hero pill | "AI Workforce OS" | "Business Systems, Installed" |
| Hero H1 | "Hire AI Employees. Install AI Skills. Operate Your Business." | "We install systems into your business so work gets done faster, more consistently, and at a lower cost." |
| Hero sub | "Businesses use AI Workforce OS to deploy AI employees, automate workflows, supervise operations…" | "Powered by automation, workflows, AI employees, and operational systems managed through Baseline OS." |
| Primary CTA | "Book a Demo" | "See How It Works" |
| Secondary CTA | "View Pricing" | "Start Free" |
| Nav | Features · How It Works · Pricing | The Problem · How It Works · What You Get · Pricing |
| NEW section | — | **Problem:** "Most businesses lose money because work falls through the cracks." + 5 concrete pain examples (leads, invoices, approvals, communication, repetitive work) |
| NEW section | — | **Solution:** "We install systems that make sure the right work gets done at the right time." |
| How It Works | "Configure · Deploy · Supervise" (technology framing) | "Install Systems · Automate Work · Monitor Results" (outcome framing) + "Under the hood" callout that introduces AI employees / skills / teams / workflows / Baseline OS *after* the value is understood |
| Features | "Deploy AI Agents · Supervise Workflows · Track Costs · Quality Gates · Multi-Tenant Workspaces · Security Scanning" | "Work that doesn't fall through the cracks · Consistent execution every day · Visibility into who did what · Approval before anything risky · Costs you can actually see · Separate workspaces for each part of the business" |
| Verticals heading | (just a trust strip below hero) | "Built for Businesses That Depend on Execution" — full section, dedicated heading + the 9-vertical strip |
| Testimonial | "Baseline Automations turned our reactive workflows into a proactive AI-driven workforce…" | "Baseline Automations helped us install systems that eliminated bottlenecks, improved accountability, and gave our team back over 20+ hours per week…" |
| Metrics | 20+ / 3.2× / 40% | **Preserved unchanged** |
| Pricing sub | "Start free. Upgrade as your AI workforce grows…" | "Start with the systems you need today and expand as your operation grows." |
| Pricing card copy | "1 AI Agent · Up to 10 Agents · Unlimited Agents" | "1 automated workflow · Up to 10 active workflows · Unlimited workflows · Per-location workspaces" |
| Final CTA | "Ready to deploy your first AI employee?" | "Ready to stop chasing work and start finishing it?" |

AI / agent / runtime / orchestration terminology is fully removed from the first impression and reintroduced only in the "Under the hood" callout in §How It Works (one paragraph, deeper in the page).

**Verification:**
- Hero H1 confirmed via DOM read: `"We install systems into your business so work gets done faster, more consistently, and at a lower cost."`
- 5 problem items, 3 how-steps (Install / Automate / Monitor), 9 verticals, 3 pricing cards, 3 metrics all present and rendering.
- bodyHeight = 5294px > viewport, scrollY reaches 4214 after scrollTo(bottom) — page scrolls cleanly.
- Scroll regression test still passes (root layout fix from PM #2 preserved).
- `tsc --noEmit` clean, `eslint` clean (one pre-existing `<img>` warning), `vitest run` **1239 / 1239**, `next build` clean.

---

## 2026-05-30 (PM #2) · P0 FIX — homepage scroll trap

**Root cause:** root layout `/app/src/app/layout.tsx` line 122 wrapped every page in `<div className="h-screen overflow-hidden">`. That made sense for the authenticated dashboard (a fixed-viewport split-pane workstation) but trapped scroll for every public route — homepage, `/login`, `/signup`, `/marketplace`, `/pricing`, etc., all of which use `min-h-screen` and expect to scroll. Mouse wheel, trackpad, and mobile touch all dead. Body height clipped to 100vh; content below the fold hidden entirely.

**Fix (root-cause, not patched):**
- `/app/src/app/layout.tsx` — removed `h-screen overflow-hidden`. Root wrapper now `<div className="bg-background text-foreground">`.
- `/app/src/app/app/layout.tsx` — NEW. Re-applies `h-screen overflow-hidden` only to the authenticated `/app/*` segment.

**Proof:**

| Metric | Before | After |
|---|---|---|
| `document.body.scrollHeight` (home) | 1080 (= viewport, trapped) | 3923 |
| `scrollY` after `scrollTo(bottom)` | 0 (frozen) | 2843 |
| Mobile (390×844) bottom scrollY | 0 | 2843 |
| Footer DOM visible | No | Yes — "© 2026 Baseline Automations" |
| Main-frame navigations in 3-min observation | (n/a) | 0 (zero auto-refresh) |
| Body height variation in 3-min observation | (n/a) | 0 (stable 3923) |

**Regression test added:** `src/app/__tests__/homepage-scroll.test.ts` — 3 assertions guarding the layout shape, runs in the standard vitest suite.

**Quality gates after fix:**
- `tsc --noEmit` — 0 errors
- `eslint .` — 0 errors
- `vitest run` — **1239 / 1239 pass** (was 1236; +3 regression tests)
- `next build` — clean

---

## 2026-05-30 (PM) · Launch Readiness Pass — single consolidated execution

**Goal:** finish every remaining engineering item between Mission Control and customer #1. No new dashboards / panels / analytics.

### Hermes — real runtime proof (matches OpenClaw standard)
- `agent_id=55`, name `hermes-prod-1`, workspace_id=1, runtime_type=hermes.
- Registration, heartbeat, persistence, workspace scope, reconnect — all proven.
- `/api/agent-runtimes` `registered[]` shows `status=connected, hb_age<10s` against both `hermes-prod-1` and `openclaw-prod-1` simultaneously.

### Multi-tenant correctness fix (P0 — was a SaaS blocker)
- Migration `052_agent_name_unique_per_workspace`: rebuilds `agents` table dropping global `UNIQUE(name)` in favor of `UNIQUE(name, workspace_id)`. SQLite table-rebuild pattern, duplicates de-duplicated by appending `__dup_<id>` to later collisions.
- Two customers can now both name an agent `hermes-prod-1` / `researcher` / etc.

### Domain migration: `baseline-agents.com` (Resend-verified canonical host)
- `/app/.env`: `GOOGLE_REDIRECT_URI` flipped from `mission.baselineautomations.com` → `baseline-agents.com`.
- `/app/.env.production.example`: `MC_ALLOWED_HOSTS`, `MC_HOST`, `GOOGLE_REDIRECT_URI`, `RESEND_FROM` all switched.
- Flight Deck `desktop/src/allowlist.js`: `MODES.production` + `ALLOWED_HOSTS` updated.
- Flight Deck `desktop/src-tauri/tauri.conf.json` CSP: added `https://baseline-agents.com` + `https://*.baseline-agents.com` to `connect-src` / `frame-src` / `img-src`.

### Production hardening verification (all green)
- `tsc --noEmit` — 0 errors
- `eslint .` — 0 errors
- `vitest run` — **1236 / 1236 pass**
- `next build` — clean

### Operator deliverable
- `/app/docs/operations/LAUNCH_OPERATOR_PACKAGE.md` — single document, every command verbatim, covers DigitalOcean + Google + Stripe + Flight Deck + rollback + health verification. Supersedes prior multi-document readiness reports.

### Result
0 engineering blockers between current code and customer #1. All remaining items are operator credentials/registrations (DO token, GCP origins, Stripe live keys, Flight Deck signing).

---


# Mission Control — Changelog

Append-only log of significant deliveries. PRD.md holds the durable product spec; this file holds the timeline.

---

## 2026-05-29 · Revenue-Readiness Stack

**Goal:** make the launch + sales materials complete and usable. A new operator should be able to read one quickstart, pick a vertical, mint a signed demo, run discovery, and propose a 14-day pilot without consulting anyone else.

### Sales — docs hardened
- `docs/sales/cpa.md`, `law-firm.md`, `ai-agency.md` — "SOC 2 path active" → "SOC 2 path in progress" (compliance overclaim → honest)
- `docs/sales/README.md` — Marketing Agency row added to vertical index; backlog note removed

### Sales — new assets
- `docs/sales/marketing-agency.md` — full 7-asset playbook for marketing / creative / growth / ads / content / social agencies. Roster: AI Campaign Operator, Content Calendar Manager, Client Success Assistant, Reporting Analyst, Lead Follow-Up Agent. Tiered $299 / $799 per-client math included.
- `docs/sales/SALES_OPERATOR_QUICKSTART.md` — single-document operator guide (22 sections): 60-sec pitch · ICP · $1 offer · vertical-to-pitch lookup · demo flow · AI-employee language · Mission Control / Baseline OS / memory / approvals / ROI / objections · close question · follow-up cadence · post-no-response · post-demo-watched · post-pilot-proposed · daily routine · pre-call checklist · escalation matrix.

### Operations — verification corrected
- `docs/operations/PRODUCTION_VERIFICATION_CHECKLIST.md` — T8.1 corrected from non-existent `/api/marketplace/bundles` to actual `/api/marketplace/catalog`; T9.1 corrected from 404 `/docs/getting-started` to valid `/docs`, `/onboarding`, `/app/help`, `/app/docs`.

### Operations — readiness proven
- `docs/operations/PRODUCTION_READINESS_REPORT.md` — tier-by-tier dry-run against preview environment. Vitest 1214/1214. Typecheck clean. 9/9 verticals mint signed demo links. Hermes + OpenClaw + Claude Code runtime harnesses all PASS. Remaining work flagged as operator-provisioning (DO deploy, Stripe live webhook, Flight Deck install) — not engineering.
- `docs/operations/proofs/runtime-validation-preview-2026-05-29.txt` — proof artifact, 3 runtimes × 6 stages, all PASS.

### Codebase
- No product code changed in this pass. This was strictly docs + sales enablement.

### Result
All 9 launch verticals shipping with complete playbooks (PM · GC · Home Services · Real Estate · Mortgage · CPA · Law Firm · Marketing Agency · AI Agency). Production verification checklist validated end-to-end. A new sales operator can open `SALES_OPERATOR_QUICKSTART.md`, follow it linearly, and close pilots without coaching.


---

## 2026-05-30 · OpenClaw Live Proof + Google OAuth Wiring + DO Preflight PASS

**Goal:** Close the last 3 blockers for DigitalOcean deployment — prove OpenClaw is a real runtime (not simulation), wire Google OAuth creds, and confirm the production env template passes preflight.

### OpenClaw — real runtime proof (P0 complete)
- `/app/scripts/connect-runtime.mjs` executed against the user's external OpenClaw instance:
  - Registered `openclaw-prod-1` (agent_id=48, workspace_id=1, runtime_type=openclaw) via `POST /api/agents/register`.
  - Probed `https://mission-control-v8.preview.emergentagent.com` → HTTP 200, `probe=alive`.
  - Heartbeats accepted at 10s cadence; `GET /api/agent-runtimes` shows `connection_status=connected`, `seconds_since_heartbeat=8`.
  - Refresh persistence proven (multiple polls return same row).
  - Connection transition proven: heartbeat halted → row aged to 81s (about to flip to offline at 90s window) → re-register restored `hb_age=7s, status=connected`, idempotent (`new=false`, same agent_id).
  - SQLite row confirmed in `agents` table with `workspace_id=1`; isolated from older test workspaces (99/113/131/...).
- Targeted vitest: `runtime-lifecycle.test.ts` — 5/5 pass (handshake, heartbeat-age transitions, persistence-across-restart).

### Google OAuth — credentials wired (P0 complete)
- Added to `/app/.env`:
  - `GOOGLE_CLIENT_ID=271101705254-75q3pv36d1v7ogasnr9ccd8g7slldb2b.apps.googleusercontent.com`
  - `GOOGLE_CLIENT_SECRET=GOCSPX-…NkOK`
  - `GOOGLE_REDIRECT_URI=https://mission.baselineautomations.com/api/auth/google/callback`
  - `NEXT_PUBLIC_GOOGLE_CLIENT_ID=` (same as `GOOGLE_CLIENT_ID`)
- Implementation status:
  - **Current flow:** Google Identity Services (GIS) popup with ID-token verification at `POST /api/auth/google` (`src/lib/google-auth.ts`). Uses `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (browser) + `GOOGLE_CLIENT_ID` (server audience check). **Does not require redirect URI or client secret to function.**
  - **Authorized JavaScript origins** in GCP must include `https://mission.baselineautomations.com` (and any other origins users will log in from).
  - `GOOGLE_CLIENT_SECRET` + `GOOGLE_REDIRECT_URI` are stored for future server-side OAuth-code-flow callback (`/api/auth/google/callback` route not yet implemented — only needed if Drive/Calendar scopes are added later).
- Ecosystem audit result: **Sibling app source (PropControl / VoiceOps / VisionOps) not mounted in this container.** Public references to PropControl found in `/app/docs/source/` only — no shared OAuth client config inside MC. The user is providing one Google client for Mission Control; no duplication risk in this codebase.

### OpenClaw gateway token wired
- Added to `/app/.env`: `OPENCLAW_GATEWAY_TOKEN=aee2…fd16`, `OPENCLAW_GATEWAY_URL`, `OPENCLAW_GATEWAY_WS_URL`.

### DigitalOcean deploy template — completed + preflight PASS
- `/app/.env.production.example` updated: added `SHARE_SIGNING_SECRET`, `MC_ENABLE_HSTS`, `OPENCLAW_GATEWAY_TOKEN`, all four Google OAuth vars, Resend (`RESEND_API_KEY`, `RESEND_FROM`). Switched `OPENCLAW_GATEWAY_HOST` default from `host.docker.internal` → `127.0.0.1` (gateway-local enforcement).
- `bash scripts/preflight-production.sh` run against a fully-populated synthetic `.env.production` → **Preflight PASSED** (1 warning: Stripe in mock mode — expected).

### Result
All P0 deployment blockers cleared. Operator can now follow `/app/docs/operations/DEPLOY_DAY_RUNBOOK.md` and `/app/docs/operations/DIGITALOCEAN_EXECUTION.md` end-to-end. Remaining steps are pure operator actions (DO account creds, push image to GHCR, `doctl apps create`, attach domain, configure live Stripe webhook).
