# Agent Phone-Home Architecture

> Audience: integrators building AI Employees that connect to Mission Control.

## Core idea

**AI Employees do NOT run inside Mission Control.** They run wherever they
run best — Hermes (brain), OpenClaw (browser/tool/VPS), Claude Code
(engineering), or any framework adapter you write (CrewAI / LangGraph /
AutoGen). Mission Control is the **dashboard / supervision layer** they
phone home to.

This means:

- Mission Control consumes ~zero LLM tokens itself.
- The AI Employees do the actual work, on their own infra.
- All cost, memory, optimization, and execution status flows back to
  Mission Control through these endpoints.

## Endpoints

All endpoints accept `Authorization: Bearer <agent_api_key>` (workspace-
scoped) and respect the standard rate-limit middleware.

### 1. `POST /api/agents/register`

Self-register an AI employee.

```http
POST /api/agents/register
Authorization: Bearer <viewer-key>
Content-Type: application/json

{
  "name": "phil",
  "role": "assistant",
  "capabilities": ["browser", "email", "calendar"],
  "framework": "openclaw"
}
```

Idempotent: if `name` already exists, returns the existing row and bumps
`last_seen`.

### 2. `POST /api/agents/[id]/heartbeat`

Phone home with health + optional inline token usage.

```http
POST /api/agents/phil/heartbeat
Content-Type: application/json

{
  "connection_id": "phil-vps-1",
  "status": "idle",
  "last_activity": "Closed reconciliation #88",
  "token_usage": {
    "model": "anthropic/claude-sonnet-4",
    "inputTokens": 1820,
    "outputTokens": 412,
    "taskId": 217
  }
}
```

Response includes any work items the agent should pick up (mentions,
assigned tasks, urgent activities) — Mission Control's way of telling the
agent "here's the next thing".

### 3. `PATCH /api/tasks/:id`

Update a task as work progresses. Mission Control records the state
change, broadcasts it on the event bus, and surfaces it in the Activity
Feed + Executive Briefing.

### 4. `POST /api/billing/charge` *(via `POST /api/tokens`)*

Charge a workspace for token usage. Idempotent by `idempotencyKey`. Auto-
applies retail markup from `pricing_configs`. Rate-limited at 120/min
per agent.

### 5. `POST /api/memory/update`

Push a memory entry (decision · learning · "why this recommendation").

### 6. `POST /api/optimization/report`

Phone home an optimization signal so Daily Optimization can surface it.

```http
POST /api/optimization/report
Content-Type: application/json

{
  "agent": "phil",
  "kind": "bottleneck",
  "impact": "high",
  "summary": "3 customer playbook lookups failed in the last hour",
  "rationale": "Notion connector returned 429 on /databases/<id>/query",
  "confidence": 0.86,
  "suggestedAction": { "label": "Rotate Notion integration token", "href": "/app/settings/baseline-os-memory" }
}
```

## What Mission Control surfaces back

For every registered agent, Mission Control displays:

- **Identity** — codename, mission, personality, strengths
- **Operational dimensions** — operating style, tone, escalation behavior,
  trust score, memory profile, execution preference (5 derived signals)
- **Status** — `online | idle | busy | offline` (heartbeat age driven)
- **Capabilities** — declared at registration
- **Cost** — credits used today / this month, top model, top task
- **Memory sync status** — last memory write, last optimization report
- **Recent work** — last 50 activities (links from Activity Feed)

## Native Triple Threat Stack (default)

| Role | Where it runs | Native engine |
| --- | --- | --- |
| Brain + optional operator | server / VPS | **Hermes** |
| Browser / tool / VPS / external app operator | server / VPS / desktop | **OpenClaw** |
| Engineering / code builder | desktop / CI | **Claude Code** |

Framework adapters (CrewAI / LangGraph / AutoGen) are optional. They are
**not the main product story**; they let advanced operators bring existing
flows under Mission Control supervision.

## Reference flow

1. Agent boots → `POST /api/agents/register` (idempotent)
2. Agent loop:
   - `POST /api/agents/<id>/heartbeat` every 60s
   - On work item → execute → `POST /api/tokens` per LLM call
   - On finish → `PATCH /api/tasks/:id` `{ status: 'done' }`
   - On learning → `POST /api/memory/update`
3. On detection of bottleneck → `POST /api/optimization/report`

All endpoints are workspace-scoped. There is no path that lets one
workspace's agent reach into another.
