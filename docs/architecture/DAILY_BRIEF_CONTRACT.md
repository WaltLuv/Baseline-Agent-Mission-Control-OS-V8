# Daily Brief — Handoff Contract

> **Status:** v1 (Feb 2026). Mission Control consumer is live; Mission
> Control fallback aggregator is live. Baseline OS aggregator is **not
> yet implemented** — when it is, it must return the exact JSON shape
> defined here with `source: 'baseline-os'` and Mission Control will
> proxy through unchanged.

> **Lane discipline:**
> - **Baseline OS (Claude Code)** owns the aggregation logic, metric
>   definitions, plain-English insight generation, estimated-hours
>   formula, proof extraction, and the decisioning rules behind the
>   attention list.
> - **Mission Control (Emergent)** owns the in-app panel, email
>   template, customer-facing copy, manual send flow, browser testing,
>   and the empty/error/critical-banner states.

## Source of truth

```
src/lib/daily-brief/types.ts        ← canonical TypeScript contract
src/lib/daily-brief/aggregator.ts   ← Mission Control fallback (interim)
src/app/api/daily-brief/route.ts    ← consumer route
src/components/briefing/daily-brief-panel.tsx
                                    ← UI consumer
```

The TypeScript types in `types.ts` are the wire format. JSON returned by
Baseline OS MUST validate against `DailyBriefPayload`.

## Endpoint

```
GET /api/daily-brief?window=since-yesterday|since-last-login
```

- Auth: viewer-or-higher (session cookie or `x-api-key`).
- Returns: `application/json` matching `DailyBriefPayload`.
- Latency budget: < 250 ms end-to-end.

## How Baseline OS plugs in

Set the env var:

```
BASELINE_OS_DAILY_BRIEF_URL=https://baseline-os.local/api/daily-brief
```

The Mission Control route will:
1. Forward `workspace_id`, `user_id`, and `window` as query params.
2. Forward the request inside a 5-second deadline.
3. If Baseline OS responds 200 with a parseable `DailyBriefPayload`,
   ship it to the UI as-is.
4. Otherwise, fall back to `aggregateDailyBrief()`.

This means **Mission Control will never be blocked on Baseline OS
availability** — the consumer experience always works.

## ⚠ Field-name reconciliation pending (Claude v1 vs Mission Control v0)

Claude Code's published Baseline OS contract
(`/Users/walt/code/claude-os/DAILY_BRIEF_CONTRACT.md`) groups the
counters under a `counters` object with these names:

| Baseline OS (Claude) | Mission Control (this consumer) |
|----------------------|--------------------------------|
| `counters.tasks_completed` | `by_the_numbers.tasks_handled` |
| `counters.tasks_in_flight` | (not surfaced; derived from `tasks_open` on the Value page) |
| `counters.approvals_requested` | `by_the_numbers.approvals_requested` |
| `counters.approvals_granted` | `by_the_numbers.approvals_granted` |
| `counters.approvals_denied` | (not surfaced — TODO) |
| `counters.approvals_pending` | (not surfaced — surfaced via `attention[]` instead) |
| `counters.tool_executions` | `by_the_numbers.tool_executions` |
| `counters.proofs_delivered` | `by_the_numbers.proofs_delivered` |
| `counters.failures` | `by_the_numbers.failed_executions` |
| `counters.blocked_refusals` | (not surfaced — TODO, will become its own attention pill) |

**Resolution plan (lane-respectful):**
1. Mission Control consumer will accept BOTH shapes in the next
   pass: when `payload.counters` is present and `payload.by_the_numbers`
   is absent, map at the route layer (Mission Control's lane — UI
   adaptation).
2. NO recomputation. NO new fields on the producer side. The mapper
   is a pure rename + the addition of two extra UI pills for
   `approvals_denied` and `blocked_refusals`.
3. Claude's `failures` distinction (four-state classification) feeds
   the `attention[]` list verbatim — Mission Control just renders it.

This is tracked at the top of `src/app/api/daily-brief/route.ts` as a
TODO. The current Mission Control fallback aggregator continues to
emit the local v0 shape so the panel renders today.

## Field-by-field contract

### `workspace_id: number`
Scope of the brief. Required. Must match the authenticated session's
workspace.

### `workforce_slug: string | null`
Slug of the installed workforce template
(`property-management`, `general-contractor`, …) or `null` if no
template installed (the consumer renders the empty state).

### `workforce_vertical: string | null`
Pretty-printed vertical label ("Property Management"). Used in the
headline and narrative.

### `date_range`
- `from_iso`, `to_iso` — ISO-8601 timestamps.
- `window` — exactly `'since-yesterday'` or `'since-last-login'`.
- `label` — short human label ("Since yesterday", "Since your last
  visit · 8h ago"). Rendered in the panel header.

### `headline: string`
One sentence. Newspaper-style. Workforce-vertical first if available.
Examples:
- "Your Property Management workforce handled 14 tasks since yesterday."
- "Quiet morning. Your Property Management workforce is standing by."
- "No workforce yet."

### `narrative: string`
2–3 sentence paragraph. Past-tense, "while you were focused
elsewhere…" voice. Must include the lead persona by first name when
applicable. Must NOT use technical jargon. Must NOT exceed ~400 chars.

### `by_the_numbers: DailyBriefByTheNumbers`
Seven counters. All zero is valid. All integers EXCEPT
`estimated_hours_saved` which is `number` rounded to 1 decimal.

| Field | Definition |
|-------|-----------|
| `tasks_handled` | Tasks transitioned to a terminal status (done/completed/closed) in the window. |
| `approvals_requested` | Tool executions where `approval_required=1` and `approval_requested_at` falls in the window. |
| `approvals_granted` | Tool executions where `approved_at` falls in the window. |
| `tool_executions` | Total `tool_executions` rows created in the window. |
| `proofs_delivered` | Tool executions with a non-null `proof_url` completed in the window. |
| `failed_executions` | Tool executions with `status='failed'` OR `exit_code != 0` in the window. |
| `estimated_hours_saved` | Baseline OS formula. Mission Control fallback uses `(tasks_handled × 25min + tool_executions × 5min) / 60`, rounded to 0.1. Baseline OS may override with a more accurate model. |

### `attention: DailyBriefAttention[]`
Ordered list of items the operator must look at. Each item:

- `kind`: one of `approval_pending` · `failed_execution` ·
  `critical_workflow` · `stale_task` · `blocked_task`.
- `title`: 1-line human-readable summary.
- `detail` (optional): 1-sentence explanation of urgency.
- `task_id` / `agent_id` (optional): for deep-linking.
- `since_iso` (optional): when the item became attention-worthy.
- `url`: customer-facing deep-link (must be a Mission Control route).

Mission Control fallback limits each kind to 5 items; total cap = 15.

### `persona_breakdown: DailyBriefPersona[]`
One row per AI employee from the installed workforce template
(`agents.source = 'workforce-template:<slug>'`). Counts are computed
over the window for `completed`, all-time for `in_progress` /
`blocked`.

### `proof_links: DailyBriefProofLink[]`
Up to 6. Each is a tool execution that delivered a non-empty
`proof_url`. Customer-facing rendering shows the linked task title and
optionally the agent name.

### `status_line: string`
One short line. Always present. Rules:
- 0 attention items → `"Status: clean."`
- 1 attention item → `"Status: 1 item needs your eye."`
- N > 1 attention items → `"Status: N items need your eye."`

### `critical_banner: DailyBriefCriticalBanner | null`
Set only when at least one truly severe condition exists:
- a failed execution in the window, **or**
- a critical-priority task that has not yet been resolved.

When set:
- `headline` is a single sentence ("1 critical item needs you now.")
- `detail` is one supporting sentence.
- `action_url` deep-links to either `/app/tool-executions` (failed) or
  `/app/tasks/kanban` (critical workflow).
- `action_label` is the CTA verb (e.g., "Review failed runs →").

### `empty_state: { headline, detail, cta_label, cta_url } | null`
Returned when **no workforce is installed yet**. UI renders only the
empty state in this case (no numbers, no attention, no personas).

### `generated_at: string`
ISO-8601 timestamp of payload generation.

### `source: 'baseline-os' | 'mission-control-fallback'`
Identifies which engine produced the payload. The UI surfaces it as
fine-print under the panel header so operators (and the next agent
debugging this) can tell at a glance which side answered.

## Hours-saved formula (Baseline OS may override)

Mission Control fallback uses:

```
estimated_hours_saved = round(
  (tasks_handled × 25 + tool_executions × 5) / 60,
  1
)
```

The 25-min and 5-min constants are interim placeholders. Baseline OS
SHOULD replace this with a model that uses:
- task type (from `tasks.metadata.workforce_workflow_slug`)
- approval policy (low/medium/high) as a complexity proxy
- historical operator timing where available
- per-vertical multipliers

## Empty states

Mission Control fallback emits the empty state when:
- `settings` has no `ws.<workspaceId>.workforce.installed.*` row.

Baseline OS MAY emit empty state for additional reasons (e.g., new
workspace without any history) — those are encouraged.

## Error handling

The Mission Control consumer:
- Treats any HTTP non-2xx from the route as an error and renders the
  retryable error state.
- Validates that `headline` is a string before consuming a Baseline OS
  payload; falls back to local aggregator otherwise.
- Never throws on missing optional fields — every UI component is
  defensive.

## Versioning

This is v1. Future revisions:
- Add a `version: 1` field to the payload.
- Bump on any breaking change.
- Mission Control consumer supports the latest version + the prior
  version for one full release.

## Test surface

Hit the endpoint:

```bash
curl -s -b /tmp/cookies.txt 'http://127.0.0.1:3000/api/daily-brief?window=since-yesterday' | jq .
curl -s -b /tmp/cookies.txt 'http://127.0.0.1:3000/api/daily-brief?window=since-last-login'  | jq .
```

UI: `/app/overview` → top of the page, above Executive Briefing.

## Open questions for Claude Code (Baseline OS)

1. Will Baseline OS expose the brief over HTTP (preferred) or CLI?
   Mission Control assumes HTTP. CLI is fine if it returns JSON on
   stdout and exits 0.
2. Authentication of the Baseline OS endpoint — shared secret? mTLS?
   workspace-scoped API key? Mission Control defaults to an internal
   workspace header for now.
3. Should the brief include a `confidence` field per metric so the UI
   can surface "preliminary" data while ingestion is in flight?
4. Should email-ready HTML be included in the payload, or should
   Mission Control template the email itself? **Recommend Mission
   Control templates** (lane discipline: experience vs decision).
