# Value / ROI — Baseline OS → Mission Control Contract

**Version:** 1
**Anchor commit:** `src/lib/roi.ts` + `src/lib/daily-brief.ts` (shared formula).
**Lane:** Baseline OS produces the payload. Mission Control consumes it. No UI, no email template, no "Show your boss" page lives in Baseline OS.

This is the second handoff in the value-reporting pair. The Daily Brief (v1, shipped) surfaces what happened *yesterday*. The ROI report surfaces what's been happening *since install / over a rolling window / month-to-date / year-to-date*. Same data sources, same formula constants — different time scales and different aggregations.

---

## 1 · JSON payload shape

Full TypeScript types live in `src/lib/roi.ts`.

```ts
interface ValueRoiPayload {
  version: 1;
  generated_at: string;
  generator: { name: "baseline-os"; component: "roi"; engine_version: string };
  source_endpoints: {
    tasks:              { kind: "mc_api"; method: "GET"; path: string };
    executions:         { kind: "file";   path: string };
    approvals_history:  { kind: "file";   path: string };
    approvals_queue:    { kind: "file";   path: string };
    routing_decisions:  { kind: "file";   path: string };
    workforce_template: { kind: "file";   path: string };
    config:             { kind: "file";   path: string };
  };
  scope: {
    workspace_id: number | string;
    workforce_slug: string | null;
    date_range: {
      mode: "since_install" | "last_7d" | "last_30d" | "mtd" | "qtd" | "ytd" | "custom";
      start: string; end: string;
    };
  };
  inputs: {
    hourly_rate_usd: number;
    rate_source: "config" | "default";
    per_action_minutes: { LOW: number; MEDIUM: number; HIGH: number; task_closed: number };
    formula_method: string;
  };
  totals: {
    hours_saved: number;
    labor_value_usd: number;
    tool_executions: number;
    proofs_delivered: number;
    tasks_completed: number;
    approvals_granted: number;
    blocked_refusals: number;
  };
  prior_period: {
    start: string; end: string;
    hours_saved: number;
    labor_value_usd: number;
    delta_pct: number | null;          // null when prior == 0
  };
  by_persona: Array<{
    employee_id: string; name: string; role: string;
    hours_saved: number; labor_value_usd: number;
    tool_executions: number; proofs_delivered: number;
  }>;
  by_workflow: Array<{
    workflow_id: string; name: string; employee_id: string | null;
    hours_saved: number; labor_value_usd: number;
    runs: number; proofs: number;
  }>;
  by_tier: {
    LOW:     { count: number; hours: number; labor_value_usd: number };
    MEDIUM:  { count: number; hours: number; labor_value_usd: number };
    HIGH:    { count: number; hours: number; labor_value_usd: number };
    BLOCKED: { count: number; note: string };  // explicitly no $ for BLOCKED
  };
  proof_rollup: {
    total: number;
    by_tier: { LOW: number; MEDIUM: number; HIGH: number };
    most_recent: ProofLink[];           // same shape as Daily Brief
  };
  approval_throughput: {
    requested: number;
    granted: number;
    denied: number;
    grant_rate: number | null;          // granted / (granted + denied)
    avg_decision_minutes: number | null;
  };
  headline: string;                     // rule-generated
  summary: string;                      // rule-generated
}
```

---

## 2 · Metric definitions

| Metric                            | Definition                                                                 |
|---|---|
| `totals.hours_saved`              | Sum of per-tier minutes for every `ok=true` execution in window + (5 min × `tasks_completed`), divided by 60. |
| `totals.labor_value_usd`          | `totals.hours_saved × inputs.hourly_rate_usd`. Single multiplier — transparent and verifiable. |
| `totals.tool_executions`          | All execution rows in window (success + failure + refusal). |
| `totals.proofs_delivered`         | Subset of executions with `ok=true`. Each carries `stdout_sha256` + `args_fingerprint`. |
| `totals.tasks_completed`          | MC tasks in scope with status ∈ {completed, done, closed} in window. |
| `totals.approvals_granted`        | `approval-history.jsonl` events with `event ∈ {approved, consumed}` in window. |
| `totals.blocked_refusals`         | Executions with `proof.effective_risk = "BLOCKED"` OR `refused_reason ~ /BLOCKED/i`. |
| `prior_period.*`                  | Same metrics computed over the equal-length window immediately before `date_range`. |
| `prior_period.delta_pct`          | `(current - prior) / prior × 100`. `null` when prior == 0 (no baseline). |
| `by_persona[]`                    | Per-employee rollup of executions whose `tool_id` ∈ employee's bound tools. |
| `by_workflow[]`                   | Per-workflow rollup. An execution is attributed when `(tool_id, verb)` matches a `skill` whose `skill_id` ∈ `workflow.skill_ids`. |
| `by_tier`                         | Counts + hours + dollar value per LOW/MEDIUM/HIGH; BLOCKED gets count + a `note` (no dollar value). |
| `proof_rollup`                    | Total proof count, by tier, plus the most-recent N proof links (capped by `limit`). |
| `approval_throughput.grant_rate`  | `granted / (granted + denied)`; `null` when both are 0. |
| `approval_throughput.avg_decision_minutes` | Mean `(decided_at − requested_at)` in minutes across decisions in window. |

---

## 3 · Hours-saved formula

**Imported verbatim from `src/lib/daily-brief.ts`** via the exported `HOURS_FORMULA_PER_ACTION_MINUTES` constant. ROI and Daily Brief cannot drift on this.

```
hours_saved = (LOW × 2min + MEDIUM × 10min + HIGH × 30min + tasks_completed × 5min) / 60
```

| Component         | Minutes / occurrence | Rationale |
|---|---:|---|
| LOW execution     |  2 | Read/search/status — replaces a quick lookup. |
| MEDIUM execution  | 10 | Draft/log/create — replaces composition of an artifact. |
| HIGH execution    | 30 | Co-signed send/publish — agent prepped fully; operator only reviews. |
| BLOCKED refusal   |  0 | Action never happened. |
| Task closure      |  5 | Triage time saved per closed task. |

The same constants surface in `payload.inputs.per_action_minutes` so MC can show the assumptions inline.

---

## 4 · Labor-value formula

```
labor_value_usd = hours_saved × hourly_rate_usd
```

Single multiplier. No per-role rates in v1 — keep MC's "Show your boss" page transparent.

### Where the rate comes from (in order)

1. **Explicit override**: `?hourly_rate_usd=N` query param OR `mc roi --rate N`. `rate_source = "config"`.
2. **`~/.claude-os/config.json`** with any of these shapes:
   ```json
   { "roi": { "hourly_rate_usd": 150 } }
   { "hourlyRate": 150 }
   { "hourly_rate": 150 }
   ```
   `rate_source = "config"`.
3. **Default**: `120` USD/hr. `rate_source = "default"`. Matches the existing Baseline OS UI default in `src/lib/time-saved.ts`.

MC should treat `rate_source: "default"` as a soft signal — the customer hasn't told us yet, so render with "Default $120/hr" pill and a "Set your rate" link if appropriate.

### `by_tier.BLOCKED` explicitly carries no dollar value

```json
"BLOCKED": {
  "count": 7,
  "note": "BLOCKED refusals prevent the action from happening — no dollar value is attributed by default. Mission Control may model 'prevented-harm' value separately."
}
```

Putting a dollar value on prevented harm is speculative. MC may model it however it likes (legal cost averted, compliance fine averted, etc.) on its own surface — the engine refuses to fabricate.

---

## 5 · Proof rollup rules

`proof_rollup.most_recent[]` is a copy of the `ProofLink` shape from `daily-brief.ts`:

```ts
interface ProofLink {
  audit_id: string;
  tool_id: string; verb: string;
  task_id: string | number | null;
  finished_at: string;
  effective_risk: "LOW" | "MEDIUM" | "HIGH" | "BLOCKED";
  stdout_sha256: string;
  args_fingerprint: string;
  approval_request_id: string | null;
  proof_url: string;                    // deep link (hint; MC may rewrite)
}
```

- Construction: every `ok=true` execution in window produces a ProofLink.
- `proof_url` = `${MC_URL}/app/tasks/{task_id}?audit={audit_id}` when `task_id` set, else `cli://audit/{audit_id}`.
- Sort: newest first.
- Cap: `limit` (1..200, default 50).
- Per-tier counts: `proof_rollup.by_tier` — same numbers as `by_tier.{LOW,MEDIUM,HIGH}.count` for `ok=true` executions; pre-summed so MC doesn't recompute.
- `total`: `proofs_delivered` from totals; included for the rollup to be self-contained.

---

## 6 · Date-range rules

| Mode             | Window resolves to                                                          |
|---|---|
| `since_install`  | `[install_state.installed_at, until)`. Falls back to `last_30d` if workforce isn't installed. |
| `last_7d`        | `[until − 7d, until)`                                                       |
| `last_30d`       | `[until − 30d, until)` (default)                                            |
| `mtd`            | `[first day of month UTC, until)`                                           |
| `qtd`            | `[first day of calendar quarter UTC, until)`                                |
| `ytd`            | `[first day of year UTC, until)`                                            |
| `custom`         | `[since, until)` — `since` is required; engine throws if missing            |

`until` defaults to `now` if omitted.

**Prior period** is always the equal-length window immediately preceding `date_range`. For `mode=mtd` that means "the equivalent period of last month" — same number of days from the 1st of the prior month. For `since_install` it's a window of equal duration ending at `installed_at`. This makes month-over-month + post-launch-growth comparisons honest.

---

## 7 · Attention / failure / critical classification

ROI deliberately does **not** carry attention items (those live on Daily Brief). The reporting surface focuses on aggregate value, not operational triage.

The four execution states from Daily Brief still apply behind the scenes:

| State                     | Counts toward                       |
|---|---|
| **Success** (`ok=true`)   | `proofs_delivered`, `by_persona.proofs_delivered`, `by_workflow.proofs`, `proof_rollup.*` |
| **Failure** (`ok=false, approved=true`) | `tool_executions` and `by_workflow.runs` but NOT `proofs_delivered` |
| **Refusal** (non-BLOCKED) | `tool_executions` only |
| **BLOCKED**               | `tool_executions` + `blocked_refusals` + `by_tier.BLOCKED.count` |

---

## 8 · Workspace / workforce scope

- **`workspace_id`** — numeric MC id or slug. Defaults to `cfg.workspaceId` from `~/.claude-os/mc-sync-config.json`.
- **`workforce_slug`** — when set, restricts:
  - Tasks to those tagged with the workforce OR in `install_state.created_task_ids`.
  - Executions to the union of `template.new_tools[].id` and `template.skills[].tool_id`.
  - Workflow attribution to the workforce's template only (`by_workflow` will only contain workflows from this template).
  - Persona rollup to `template.employees`.
- **null `workforce_slug`** — "all workforces in workspace". `by_persona` + `by_workflow` will be empty arrays (no template to map against). `totals` and `by_tier` still aggregate across everything.

---

## 9 · Sample Property Management payload

Captured live from `GET /api/roi?workforce_slug=property-management&mode=last_30d&limit=4`. Arrays trimmed for readability — the wire payload was 5.4 KB.

```json
{
  "version": 1,
  "generated_at": "2026-06-02T11:28:45.982Z",
  "generator": { "name": "baseline-os", "component": "roi", "engine_version": "1.0" },
  "scope": {
    "workspace_id": "default",
    "workforce_slug": "property-management",
    "date_range": { "mode": "last_30d", "start": "2026-05-03T11:28:45.965Z", "end": "2026-06-02T11:28:45.965Z" }
  },
  "inputs": {
    "hourly_rate_usd": 120,
    "rate_source": "default",
    "per_action_minutes": { "LOW": 2, "MEDIUM": 10, "HIGH": 30, "task_closed": 5 },
    "formula_method": "hours = (LOW×2min + MEDIUM×10min + HIGH×30min + tasks_completed×5min) / 60. …"
  },
  "totals": {
    "hours_saved": 1.43,
    "labor_value_usd": 171.6,
    "tool_executions": 31,
    "proofs_delivered": 15,
    "tasks_completed": 0,
    "approvals_granted": 7,
    "blocked_refusals": 7
  },
  "prior_period": {
    "start": "2026-04-03T11:28:45.965Z",
    "end":   "2026-05-03T11:28:45.965Z",
    "hours_saved": 0, "labor_value_usd": 0, "delta_pct": null
  },
  "by_persona": [
    { "employee_id": "marcus-doyle",  "name": "Marcus Doyle",  "role": "Maintenance Dispatcher",  "hours_saved": 1.43, "labor_value_usd": 171.6, "tool_executions": 31, "proofs_delivered": 15 },
    { "employee_id": "tessa-reyes",   "name": "Tessa Reyes",   "role": "Tenant Relations Lead",   "hours_saved": 0.07, "labor_value_usd":   8.4, "tool_executions":  9, "proofs_delivered":  2 },
    { "employee_id": "quinn-hartley", "name": "Quinn Hartley", "role": "Inspections & Compliance","hours_saved": 0.07, "labor_value_usd":   8.4, "tool_executions":  9, "proofs_delivered":  2 }
    /* … 3 more personas, all with 0 in window … */
  ],
  "by_workflow": [
    { "workflow_id": "maintenance_intake", "name": "Maintenance Request Intake → Dispatch",
      "employee_id": "marcus-doyle",
      "hours_saved": 1.03, "labor_value_usd": 124, "runs": 12, "proofs": 3 }
  ],
  "by_tier": {
    "LOW":     { "count": 13, "hours": 0.43, "labor_value_usd":  52 },
    "MEDIUM":  { "count":  0, "hours":    0, "labor_value_usd":   0 },
    "HIGH":    { "count":  2, "hours":    1, "labor_value_usd": 120 },
    "BLOCKED": { "count":  7, "note": "BLOCKED refusals prevent the action from happening — no dollar value is attributed by default. Mission Control may model 'prevented-harm' value separately." }
  },
  "proof_rollup": {
    "total": 15,
    "by_tier": { "LOW": 13, "MEDIUM": 0, "HIGH": 2 },
    "most_recent": [
      { "audit_id": "tx_1780382578987_ee87eec8", "tool_id": "gh", "verb": "auth-status",
        "task_id": "1", "finished_at": "2026-06-02T06:42:59.364Z",
        "effective_risk": "LOW",
        "stdout_sha256": "792948247993ba104429141fab692d09f46b220f9b2ff7364f3e82694dba1c1d",
        "args_fingerprint": "0e4264319a325aa303820ec513abde1c42dd9fef5cf054c26530f18c887faaac",
        "approval_request_id": null,
        "proof_url": "http://127.0.0.1:3000/app/tasks/1?audit=tx_1780382578987_ee87eec8" }
      /* … 3 more proof links … */
    ]
  },
  "approval_throughput": {
    "requested": 8, "granted": 4, "denied": 3,
    "grant_rate": 0.57, "avg_decision_minutes": 1.21
  },
  "headline": "1.43h saved · $172 of operator time covered.",
  "summary":  "No prior-period baseline for comparison. Marcus Doyle (Maintenance Dispatcher) carried 1.43h / $172. 15 cryptographically-signed proofs delivered."
}
```

The full sample lives at `docs/phase-5.6/sample-pm-roi.json`.

---

## 10 · How Mission Control consumes it

Two interchangeable entry points produce the same payload.

### 10.1 HTTP — `GET /api/roi` (loopback only)

```
GET http://localhost:8081/api/roi
    ?workspace_id={id}
    &workforce_slug={slug}                    (optional; null = all)
    &mode={since_install|last_7d|last_30d|mtd|qtd|ytd|custom}
    &since={ISO8601}                          (required for custom)
    &until={ISO8601}                          (optional; defaults to now)
    &hourly_rate_usd={N}                       (optional; overrides config + default)
    &limit={N}                                 (1..200, default 50; caps proof_rollup.most_recent)
```

Response: `200 OK`, `Content-Type: application/json`, body = `ValueRoiPayload`.

Errors: `403` (non-loopback caller), `405` (non-GET), `500` (engine fault).

### 10.2 CLI — `mc roi`

```
mc roi
  [--workspace-id N] [--workforce <slug>]
  [--mode since_install|last_7d|last_30d|mtd|qtd|ytd|custom]
  [--since ISO] [--until ISO]
  [--rate N]                                   # USD/hr override
  [--limit N]
  [--pretty]                                   # human-readable; default is JSON
```

Default output is the same JSON payload on stdout (pipes into MC / Resend / dashboards directly).

### 10.3 Suggested MC consumption pattern

```
1. MC fetches the ROI payload per workspace × workforce on the page load /
   schedule of its choice (e.g. on /app/value, monthly email, etc.).
2. MC renders the "Show your boss" page from `totals`, `prior_period`,
   `by_persona`, `by_workflow`, `by_tier`, `proof_rollup`, plus `headline`
   and `summary` for the top.
3. MC may stack multiple ROI payloads over time to build trend charts.
   Each payload is self-contained — no server-side history required of
   Baseline OS.
4. When the customer changes their hourly rate, MC writes to
   ~/.claude-os/config.json and re-fetches; rate_source flips to "config"
   and labor_value_usd recomputes deterministically from the same hours.
```

### 10.4 Versioning + drift policy

- `version: 1`. Breaking changes bump the integer and ship side-by-side.
- New optional fields can be added without a version bump; consumers MUST tolerate unknown keys.
- The hours-saved formula constants are surfaced in `inputs.per_action_minutes` so MC can render the assumptions without hard-coding them. If the constants change, MC's display follows automatically.
- `inputs.rate_source` lets MC distinguish "we're guessing" from "the customer told us".

### 10.5 What Baseline OS will NOT add to the payload

- No customer-facing copy beyond the rule-generated `headline` and `summary`.
- No "what this means for your business" recommendation strings.
- No vendor cost tracking (LLM tokens, API spend, infra) — that's a different surface.
- No CSAT, NPS, or other survey-derived metrics.
- No dollar value on BLOCKED refusals — MC may model prevented-harm separately.
- No PDF / image / chart artifact — MC renders.

Those belong on MC's side of the lane.

— end of contract —
