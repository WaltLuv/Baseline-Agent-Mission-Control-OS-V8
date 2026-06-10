# Daily Brief — Baseline OS → Mission Control Contract

**Version:** 1
**Anchor commit:** the Phase 5.5 sources at `src/lib/daily-brief.ts` + `src/data/workforces/property-management.json`.
**Lane:** Baseline OS produces the payload. Mission Control consumes it. No UI, email template, or dashboard panel lives in Baseline OS.

This document is the handoff. Once Emergent has it, both teams can ship their halves of the Daily Brief without stepping on each other.

---

## 1 · JSON payload shape

The full TypeScript types live in `src/lib/daily-brief.ts`. The wire shape is JSON; every field is required unless the type explicitly says `null`-able.

```ts
interface DailyBriefPayload {
  version: 1;
  generated_at: string;                       // ISO 8601
  generator: {
    name: "baseline-os";
    component: "daily-brief";
    engine_version: string;                   // e.g. "1.0"
  };
  source_endpoints: {
    tasks:              { kind: "mc_api"; method: "GET"; path: string };
    executions:         { kind: "file";   path: string };
    approvals_history:  { kind: "file";   path: string };
    approvals_queue:    { kind: "file";   path: string };
    routing_decisions:  { kind: "file";   path: string };
    workforce_template: { kind: "file";   path: string };
  };
  scope: {
    workspace_id: number | string;
    workforce_slug: string | null;            // null = all workforces in workspace
    date_range: {
      mode: "since_yesterday" | "since_last_visit" | "custom";
      start: string;                          // ISO 8601, inclusive
      end:   string;                          // ISO 8601, inclusive
    };
  };
  headline: string;                           // rule-generated, see §6
  summary:  string;                           // rule-generated, see §6
  counters: {
    tasks_completed: number;
    tasks_in_flight: number;
    approvals_requested: number;
    approvals_granted: number;
    approvals_denied: number;
    approvals_pending: number;
    tool_executions: number;
    proofs_delivered: number;
    failures: number;
    blocked_refusals: number;
  };
  policy_breakdown: { LOW: number; MEDIUM: number; HIGH: number; BLOCKED: number };
  estimated_hours_saved: {
    total: number;                            // hours, 2-decimal
    method: string;                           // human-readable formula
    breakdown: {
      by_risk_tier: { LOW: number; MEDIUM: number; HIGH: number };
      task_closure: number;
    };
    per_action_minutes: { LOW: number; MEDIUM: number; HIGH: number; task_closed: number };
  };
  attention_items: AttentionItem[];
  persona_breakdown: PersonaSummary[];
  proof_links: ProofLink[];
}

interface AttentionItem {
  id: string;                                  // stable; safe to dedupe on
  kind: "approval_pending" | "execution_failure" | "blocked_refusal"
      | "high_priority_task" | "expired_approval";
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  title: string;
  reason: string;
  employee_id: string | null;
  task_id: string | number | null;
  audit_id: string | null;
  occurred_at: string;
  deep_link: string;                           // hint; MC may replace
}

interface PersonaSummary {
  employee_id: string;
  name: string;
  role: string;
  tasks_done: number;
  tasks_in_progress: number;
  tool_executions: number;
  last_action_at: string | null;
}

interface ProofLink {
  audit_id: string;
  tool_id: string;
  verb: string;
  task_id: string | number | null;
  finished_at: string;
  effective_risk: "LOW" | "MEDIUM" | "HIGH" | "BLOCKED";
  stdout_sha256: string;
  args_fingerprint: string;
  approval_request_id: string | null;
  proof_url: string;                           // canonical deep link
}
```

---

## 2 · Aggregation rules

Each metric is computed from the data sources in §3 within the resolved `scope.date_range`. Same input, same output (deterministic — no LLM, no randomness).

| Metric                | Source                       | Filter                                                                                          | Aggregation |
|---|---|---|---|
| `tasks_completed`     | MC `/api/tasks`              | scope + status ∈ {completed, done, closed}                                                      | count       |
| `tasks_in_flight`     | MC `/api/tasks`              | scope + status ∉ {completed, done, closed, archived}                                            | count       |
| `approvals_requested` | `approval-history.jsonl`     | event = "requested" AND `ts` ∈ window                                                           | count       |
| `approvals_granted`   | `approval-history.jsonl`     | event ∈ {"approved", "consumed"} AND `ts` ∈ window                                              | count       |
| `approvals_denied`    | `approval-history.jsonl`     | event = "denied" AND `ts` ∈ window                                                              | count       |
| `approvals_pending`   | `approval-queue.json`        | status = "pending" (no window — snapshot)                                                        | count       |
| `tool_executions`     | `tool-executions.jsonl`      | `finished_at` ∈ window AND (no workforce scope OR tool_id ∈ workforce.tool_ids)                 | count       |
| `proofs_delivered`    | `tool-executions.jsonl`      | window + workforce + `ok=true`                                                                   | count       |
| `failures`            | `tool-executions.jsonl`      | window + `approved=true` AND `ok=false` (tool ran but failed)                                    | count       |
| `blocked_refusals`    | `tool-executions.jsonl`      | window + `proof.effective_risk = "BLOCKED"` OR `refused_reason ~ /BLOCKED/i`                    | count       |
| `policy_breakdown`    | `tool-executions.jsonl`      | window + workforce + group by `proof.effective_risk`                                            | count       |

**Workforce scoping (§8):** the per-workforce filter on executions uses `workforce.new_tools[].id ∪ workforce.skills[].tool_id` — the set of tool_ids the template introduces or binds skills against.

**De-duping:** consumers SHOULD de-dupe on `attention_items[].id` and `proof_links[].audit_id` if they merge multiple polls. The IDs are stable across runs as long as the underlying audit row hasn't moved.

---

## 3 · Data source mapping

| Source                | Type         | Default path                                                  | Owned by      |
|---|---|---|---|
| Tasks                 | MC HTTP      | `${MC_URL}/api/tasks?workspace_id=…&limit=200`               | Mission Control (read-only here) |
| Tool executions       | file         | `~/.claude-os/tool-executions.jsonl`                         | Baseline OS — Phase 3/4 audit ledger |
| Approval history      | file         | `~/.claude-os/approval-history.jsonl`                        | Baseline OS — Phase 4 audit ledger |
| Approval queue        | file         | `~/.claude-os/approval-queue.json`                           | Baseline OS — Phase 4 queue snapshot |
| Routing decisions     | file         | `~/.claude-os/router-decisions.jsonl`                        | Baseline OS — Phase 2 audit ledger |
| Workforce template    | file         | `src/data/workforces/<slug>.json`                            | Baseline OS — Phase 5 content |

If MC is unreachable when the brief is requested, the payload still ships — `mc_tasks` becomes an empty array, `tasks_completed` and `tasks_in_flight` are 0, and the engine logs a soft warning in the response (`source_endpoints.tasks.path` still echoes the URL it tried). All other counters come from local files and remain accurate.

---

## 4 · Estimated-hours-saved formula

Defined as constants in `src/lib/daily-brief.ts` so the doc and the code cannot drift.

```
hours_saved = (LOW × 2min + MEDIUM × 10min + HIGH × 30min + tasks_completed × 5min) / 60
```

| Component         | Minutes per occurrence | Rationale |
|---|---:|---|
| LOW execution     |  2 | Read/search/status calls — they replace a quick lookup the operator would have done manually. |
| MEDIUM execution  | 10 | Drafts / logs / creates — they prepare an artifact the operator would otherwise compose. |
| HIGH execution    | 30 | Co-signed sends / publishes — the agent prepped fully; the operator only reviews. |
| BLOCKED refusal   |  0 | The action never happened. |
| Task closure      |  5 | Triage time saved per closed task. |

These defaults reflect median operator effort. Operators may override per-workforce in a future iteration via a `template.estimated_minutes_overrides` block; the engine will honor that block and re-emit `per_action_minutes` so MC can show the source of truth.

`breakdown.by_risk_tier` shows hours by tier so MC can render a stacked bar without recomputing.

---

## 5 · Proof link rules

Every windowed execution with `ok=true` produces a `ProofLink`. Construction:

| Field                | Source                                |
|---|---|
| `audit_id`           | `executions[].audit_id`               |
| `tool_id`, `verb`    | execution row, top-level              |
| `task_id`            | execution row, top-level (may be null)|
| `finished_at`        | execution row                         |
| `effective_risk`     | `execution.proof.effective_risk`      |
| `stdout_sha256`      | `execution.proof.stdout_sha256` (hex 64) |
| `args_fingerprint`   | `execution.proof.args_fingerprint` (hex 64) |
| `approval_request_id`| `execution.proof.approval_request_id` (HIGH executions only) |
| `proof_url`          | `${MC_URL}/app/tasks/{task_id}?audit={audit_id}` when task_id set; otherwise `cli://audit/{audit_id}` |

The `proof_url` is a **hint** — MC may rewrite it to match its routing/locale. The pair `(task_id, audit_id)` is the canonical join key.

Proofs are sorted newest-first and capped at `input.limit ?? 50`.

---

## 6 · Attention-item rules

| Trigger | Severity rule | `kind` |
|---|---|---|
| Approval pending in queue | age > 4h → `HIGH`; > 1h → `MEDIUM`; else `LOW` | `approval_pending` |
| `approval=true, ok=false` execution in window | always `MEDIUM` | `execution_failure` |
| BLOCKED refusal in window | always `CRITICAL` | `blocked_refusal` |
| MC task with `priority` ∈ {high, urgent} and status not closed | `urgent` → `CRITICAL`; `high` → `HIGH` | `high_priority_task` |
| Expired approval (engine sweep flagged it) | always `MEDIUM` | `expired_approval` |

Sort order: severity ASC (CRITICAL first), then `occurred_at` DESC. Capped at `limit`.

Headline + summary are generated from counters (see `generateHeadline` / `generateSummary` in `daily-brief.ts`). Examples:

- `"7 BLOCKED refusals in window — review immediately."`
- `"2 approvals waiting on you."`
- `"Quiet window — nothing of consequence."`
- `"Marcus Doyle (Maintenance Dispatcher) led the window with 0 closed and 31 tool executions. 15 cryptographically-signed proofs delivered. Operator granted 7 approvals. Estimated 3.17h of operator time saved."`

---

## 7 · Failure / critical classification

The engine separates four execution states; MC should map them to UI affordances accordingly:

| State                       | Definition                                                                 | UI hint                  | Counter                |
|---|---|---|---|
| **Success**                 | `ok=true, approved=true`                                                   | ✅ green                 | `proofs_delivered`     |
| **Failure**                 | `ok=false, approved=true` (tool ran, returned non-success exit)            | ⚠ amber, retryable       | `failures`             |
| **Refusal (non-BLOCKED)**   | `ok=false, approved=false`, not BLOCKED — validation/disabled/expired     | ℹ️ neutral; not in counters| (omitted)              |
| **BLOCKED**                 | `proof.effective_risk = "BLOCKED"` OR `refused_reason ~ /BLOCKED/i`        | 🛑 red, surface critical  | `blocked_refusals` + `attention_items[CRITICAL]` |

A "critical" attention item is **only** generated by BLOCKED or by `urgent`-priority open tasks. MC should treat the `attention_items[].severity` ladder as the authoritative ordering — don't re-derive from counters.

---

## 8 · Workspace / workforce scope

- **`workspace_id`** — either the numeric MC workspace id (`1`) or the workspace slug (`default`). The engine accepts either form and forwards what the caller provided. Defaults to `cfg.workspaceId` from `~/.claude-os/mc-sync-config.json` (the `BASELINE_WORKSPACE_ID` env var). MC SHOULD pass the numeric id when known.
- **`workforce_slug`** — optional, defaults to `null` (= all workforces in the workspace). When set:
  - Tasks are filtered to those whose `metadata.workforce_id` matches OR whose `tags` include `workforce:<slug>` OR which were created by the installer (`install_state.created_task_ids`).
  - Tool executions are filtered to the union of `template.new_tools[].id` and `template.skills[].tool_id`.
  - The persona breakdown reads `template.employees`.
- **Date range** — `mode: since_yesterday` (default, last 24h ending at `until`), `since_last_visit` (24h fallback when caller has no last-visit timestamp; caller should pass `since` explicitly), or `custom` with explicit `since`/`until`.

---

## 9 · Sample Property Management payload

Captured live from `GET /api/daily-brief?workforce_slug=property-management&limit=10` against the running Baseline OS on 2026-06-02 (trimmed arrays for readability — the wire payload was 10.6KB):

```json
{
  "version": 1,
  "generated_at": "2026-06-02T10:09:52.132Z",
  "generator": { "name": "baseline-os", "component": "daily-brief", "engine_version": "1.0" },
  "source_endpoints": {
    "tasks":              { "kind": "mc_api", "method": "GET", "path": "http://127.0.0.1:3000/api/tasks" },
    "executions":         { "kind": "file",   "path": "/Users/walt/.claude-os/tool-executions.jsonl" },
    "approvals_history":  { "kind": "file",   "path": "/Users/walt/.claude-os/approval-history.jsonl" },
    "approvals_queue":    { "kind": "file",   "path": "/Users/walt/.claude-os/approval-queue.json" },
    "routing_decisions":  { "kind": "file",   "path": "/Users/walt/.claude-os/router-decisions.jsonl" },
    "workforce_template": { "kind": "file",   "path": "src/data/workforces/property-management.json" }
  },
  "scope": {
    "workspace_id": "default",
    "workforce_slug": "property-management",
    "date_range": { "mode": "since_yesterday", "start": "2026-06-01T10:09:52.117Z", "end": "2026-06-02T10:09:52.117Z" }
  },
  "headline": "7 BLOCKED refusals in window — review immediately.",
  "summary": "Marcus Doyle (Maintenance Dispatcher) led the window with 0 closed and 31 tool executions. 15 cryptographically-signed proofs delivered. Operator granted 7 approvals. Estimated 3.17h of operator time saved.",
  "counters": {
    "tasks_completed": 0,  "tasks_in_flight": 8,
    "approvals_requested": 8, "approvals_granted": 7, "approvals_denied": 3, "approvals_pending": 0,
    "tool_executions": 31, "proofs_delivered": 15, "failures": 0, "blocked_refusals": 7
  },
  "policy_breakdown": { "LOW": 20, "MEDIUM": 0, "HIGH": 5, "BLOCKED": 6 },
  "estimated_hours_saved": {
    "total": 3.17,
    "method": "hours = (LOW×2min + MEDIUM×10min + HIGH×30min + tasks_completed×5min) / 60. …",
    "breakdown": { "by_risk_tier": { "LOW": 0.6667, "MEDIUM": 0, "HIGH": 2.5 }, "task_closure": 0 },
    "per_action_minutes": { "LOW": 2, "MEDIUM": 10, "HIGH": 30, "task_closed": 5 }
  },
  "attention_items": [
    {
      "id": "attn_blk_tx_1780381941186_1a34c68b",
      "kind": "blocked_refusal",
      "severity": "CRITICAL",
      "title": "BLOCKED · notion-q.page-delete",
      "reason": "policy: BLOCKED — configured tier; refuses execution regardless of approval",
      "employee_id": null,
      "task_id": 1008,
      "audit_id": "tx_1780381941186_1a34c68b",
      "occurred_at": "2026-06-02T06:32:21.186Z",
      "deep_link": "http://127.0.0.1:3000/app/tasks/1008"
    }
    /* … 2 more CRITICAL items, then HIGH priority-task items … */
  ],
  "persona_breakdown": [
    { "employee_id": "tessa-reyes",   "name": "Tessa Reyes",   "role": "Tenant Relations Lead",   "tasks_done": 0, "tasks_in_progress": 2, "tool_executions":  9, "last_action_at": "2026-06-02T06:32:21.186Z" },
    { "employee_id": "marcus-doyle",  "name": "Marcus Doyle",  "role": "Maintenance Dispatcher",  "tasks_done": 0, "tasks_in_progress": 2, "tool_executions": 31, "last_action_at": "2026-06-02T06:42:59.364Z" },
    { "employee_id": "rena-patel",    "name": "Rena Patel",    "role": "Leasing Coordinator",     "tasks_done": 0, "tasks_in_progress": 1, "tool_executions":  0, "last_action_at": null }
    /* …owen-whitfield, vince-cardella, quinn-hartley… */
  ],
  "proof_links": [
    {
      "audit_id": "tx_1780382578987_ee87eec8",
      "tool_id": "gh", "verb": "auth-status",
      "task_id": "1",
      "finished_at": "2026-06-02T06:42:59.364Z",
      "effective_risk": "LOW",
      "stdout_sha256": "792948247993ba104429141fab692d09f46b220f9b2ff7364f3e82694dba1c1d",
      "args_fingerprint": "0e4264319a325aa303820ec513abde1c42dd9fef5cf054c26530f18c887faaac",
      "approval_request_id": null,
      "proof_url": "http://127.0.0.1:3000/app/tasks/1?audit=tx_1780382578987_ee87eec8"
    },
    {
      "audit_id": "tx_1780381939715_86deb067",
      "tool_id": "gh", "verb": "issue-create",
      "task_id": 1007,
      "finished_at": "2026-06-02T06:32:20.827Z",
      "effective_risk": "HIGH",
      "stdout_sha256": "be23024cd5d9610927a48e89dc14d9b9622cedb9dccd31317d509ff032af2aea",
      "args_fingerprint": "7e239da4eba89a611c85b2aa1ba3c1467b9bf76f994422e651b8446be0cc34e3",
      "approval_request_id": "appr_1780381939625_f2b5a343",
      "proof_url": "http://127.0.0.1:3000/app/tasks/1007?audit=tx_1780381939715_86deb067"
    }
    /* …more proofs… */
  ]
}
```

The full sample lives at `docs/phase-5.5/sample-pm-brief.json` (10.6KB, six personas, all 11 attention items, all 18 proof links from the window).

---

## 10 · How Mission Control consumes it

Two interchangeable entry points produce the **same payload**:

### 10.1 HTTP — `GET /api/daily-brief` (loopback only)

```
GET http://127.0.0.1:8081/api/daily-brief
    ?workspace_id={id}
    &workforce_slug={slug}              (optional; null = all)
    &mode={since_yesterday|since_last_visit|custom}
    &since={ISO8601}                     (optional; required for custom)
    &until={ISO8601}                     (optional; defaults to now)
    &limit={N}                           (optional; 1..200, default 50)
```

Response: `200 OK`, `Content-Type: application/json`, body = `DailyBriefPayload`.

Errors: `403` (non-loopback caller), `500` (engine fault). The endpoint never returns 4xx for missing scope — defaults apply.

### 10.2 CLI — `mc daily-brief`

```
mc daily-brief
  [--workspace-id N] [--workforce <slug>]
  [--mode since_yesterday|since_last_visit|custom]
  [--since ISO] [--until ISO]
  [--limit N]
  [--pretty]                             # human-readable; default is JSON
```

Default output is the same JSON payload on stdout (so MC can pipe it into Resend / email / a panel without an HTTP round-trip).

### 10.3 Suggested MC consumption pattern

```
1. MC fetches the payload on a schedule (e.g. 06:00 local) per workspace × workforce.
2. MC renders the in-app Daily Brief panel from `headline`, `summary`, `counters`,
   `attention_items`, `persona_breakdown`, `proof_links`.
3. MC sends a Resend email using the same payload — subject from `headline`,
   body from `summary` + a table of counters + the top N attention_items with
   `deep_link` rewritten to MC's public URL.
4. MC stores the raw payload alongside the email send record so the same brief
   can be re-rendered later (idempotency + audit).
5. ROI page reads `estimated_hours_saved` across multiple briefs and aggregates.
```

### 10.4 Versioning + drift policy

- The wire payload carries `version: 1`. Any breaking field rename, removal, or semantics change bumps to `version: 2` and ships a side-by-side path. MC may treat unknown future versions as version 1 plus extra optional fields.
- New optional fields may be added without a version bump; consumers MUST tolerate unknown keys.
- The hours-saved formula constants are surfaced inside `estimated_hours_saved.per_action_minutes` so MC can show the assumptions inline without hard-coding them.

### 10.5 What Baseline OS will NOT add to the payload

To keep the lane clean and avoid duplicate calculations:

- No rendered HTML / Markdown / email body.
- No customer-facing copy beyond `headline` and `summary` (which are deterministic + neutral).
- No pricing, billing, or revenue figures.
- No CSAT / customer-sentiment scoring.
- No "what to do next" recommendations — MC owns CTAs.

Those belong on MC's side of the lane.

— end of contract —
