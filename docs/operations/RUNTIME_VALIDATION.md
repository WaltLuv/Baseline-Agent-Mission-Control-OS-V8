# Runtime Validation — Mission Control v3

> Mission Control supervises AI runtimes. This document is the contract
> any runtime must satisfy to be **fully supervisable**, and the harness
> we run after each deploy to prove the contract still holds.

---

## Supported runtimes

| Runtime | Detection key | Notes |
|---------|---------------|-------|
| Hermes  | `hermes`      | Per-session hook posts events to `/api/hermes/events` |
| OpenClaw / OpenCode | `openclaw`, `opencode` | Local gateway speaks to `/api/agents/*` and `/api/agent-runtimes` |
| Claude Code | `claude` | Heartbeat + tasks via `/api/agents/[id]/heartbeat` and `/api/tasks/[id]` |

Detected via `GET /api/agent-runtimes`. Anything not in the list of
`detectAllRuntimes()` is treated as **inactive** in the dashboard.

---

## The contract — five flows

A runtime is "fully supervisable" if it can hit each of these in order:

### 1. Registration

```
POST /api/agents/register
auth: viewer (session cookie or API key)
body: { name: string, role?: string, capabilities?: string[], framework?: string }
```

Idempotent. If an agent with the same `name` exists, returns the same
record with `last_seen` bumped. Server enforces `NAME_RE` and rate-limits
5 / min / IP.

Returns: `{ id, name, role, status }`.

### 2. Heartbeat

```
GET /api/agents/:id/heartbeat
auth: viewer
```

Pulls @-mentions, assigned tasks, and recent activity. Returns
`HEARTBEAT_OK` if nothing's pending. Runtimes should poll every 30–60 s.

### 3. Task update

```
PATCH /api/tasks/:id
auth: viewer
body: { status?: 'planned' | 'in_progress' | 'completed' | 'blocked' | 'review', notes?: string }
```

Idempotent on `status`. Re-emit the same status freely; the activity
feed dedupes.

### 4. Billing report

```
POST /api/tokens
auth: viewer
body: {
  model: string,
  sessionId: string,
  inputTokens: number,
  outputTokens: number,
  provider: string,
  agentId: number,
  idempotencyKey: string
}
```

`idempotencyKey` is **required**. The token ledger refuses duplicates
silently. Replays return the original credit-deduction record.

### 5. Telemetry (Hermes-style)

```
POST /api/hermes/events
auth: viewer
body: { event: string, session_id?: string, source?: string, timestamp?: number, agent_name?: string, ... }
```

Server-side parses `event in ('session:start','session:end','agent:start','agent:end')`
and emits to the event bus. Extra fields are preserved.

OpenClaw / Claude can post the same payload — the route is event-shape
based, not Hermes-specific.

---

## The harness

`scripts/runtime-validate.sh` walks the five flows in order against a
running Mission Control instance and prints PASS / FAIL for each.

Usage:

```bash
./scripts/runtime-validate.sh \
  --base-url https://mission.example.com \
  --auth-user admin --auth-pass <pass> \
  --runtime hermes
```

What it does:

1. Logs in as the supplied admin.
2. Self-registers a synthetic agent named `validate-<runtime>-<ts>`.
3. Hits the heartbeat endpoint and asserts a 200 response.
4. Creates a task, transitions it `planned → in_progress → completed`,
   and verifies `/api/tasks/:id` reflects each.
5. Posts a $0.0001 token charge with an idempotency key and replays it
   once — asserts the second call produces no double-charge.
6. Posts a `session:start` and `session:end` telemetry pair.
7. Cleans up the synthetic agent (DELETE /api/agents/:id).

Each step prints exactly one line:

```
PASS register agent → id=42
PASS heartbeat 200
PASS task transitions 3/3
PASS billing idempotent (1st: 0.0001 credits, 2nd: 0 credits)
PASS telemetry session:start / session:end
PASS cleanup agent 42
```

A FAIL line aborts the run with exit code 1 and dumps the full HTTP
response for forensics.

---

## What "supervisable" means in production

After the harness passes:

- The agent shows up in **Agent Squad** with green presence.
- Heartbeats keep the agent visible in the **Workforce Life Signals**.
- Task transitions appear in the **Activity Feed** and **Task Board**.
- Billing charges roll into the **Billing Panel** ledger.
- Telemetry rolls into the **Standup Panel** and **Audit Trail**.

If any of those surfaces aren't updating after a green harness run, the
problem is in the panel — not the runtime contract.

---

## Adding a new runtime

1. Add a detection branch to `src/lib/agent-runtimes/index.ts` (or
   subdirectory) — return `{ id, status, version, detail }`.
2. Add a row to the table at the top of this file.
3. Run `./scripts/runtime-validate.sh --runtime <id>` in CI to gate
   future regressions.

That's the whole onboarding — the contract is the contract.
