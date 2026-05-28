# Runtime Hook Integration Guide

The **runtime telemetry adapter** (`src/lib/runtime-telemetry.ts`) is the single
contract every AI Workforce runtime — Hermes, OpenClaw, Claude Code, and future
adapters — uses to report:

- skill activations  (`reportSkillEvent`)
- escalations       (`reportEscalation`)
- memory citations  (`reportMemoryUse`)
- collaboration     (`reportCollaboration`)
- outcomes          (`reportOutcome`)
- token usage       (`reportTokenUsage`)
- composite events  (`reportSkillExecution`)

This document is the **exact integration package** for each runtime. Mission
Control side is fully shipped — runtimes need only call these endpoints from
their existing execution loops.

---

## 1. Contract (HTTP — language agnostic)

| Event                | Endpoint                          | Required fields                          |
| -------------------- | --------------------------------- | ---------------------------------------- |
| Skill activation     | `POST /api/skills/event`          | `skillSlug`                              |
| Escalation           | `POST /api/agents/escalation`     | `reason`                                 |
| Memory citation      | `POST /api/agents/memory-use`     | `source`, `title`                        |
| Hand-off             | `POST /api/agents/collaboration`  | `fromAgentSlug`, `toAgentSlug`           |
| Task outcome         | `POST /api/agents/outcome`        | `status` (`done` \| `failed` \| `partial`) |
| Token usage          | `POST /api/tokens`                | `model`, `inputTokens`, `outputTokens`   |

Common headers:

```
Content-Type: application/json
X-Api-Key: <workspace API key>      # or:
Cookie: mc-session=<session token>  # for human-operator-initiated runs
```

Every endpoint is workspace-scoped and rate-limited. All return either
`{ ok: true, ... }` or `{ error: "<reason>" }` with a 4xx/5xx.

**Hard rule:** runtimes **must never crash** because telemetry failed. Use
short timeouts (≤ 5s) and a fire-and-forget pattern.

---

## 2. TypeScript / Node runtimes (Hermes orchestrator, Claude Code workers)

```ts
import {
  reportSkillExecution,
  type TelemetryConfig,
} from '@/lib/runtime-telemetry'

const config: TelemetryConfig = {
  baseUrl: process.env.MC_URL ?? 'http://localhost:3000',
  apiKey: process.env.MC_API_KEY,
  timeoutMs: 4_000,
}

// inside the runtime's skill executor, after the skill returns:
await reportSkillExecution(config, {
  tokens: {
    model: 'claude-3-5-sonnet',
    inputTokens: usage.input,
    outputTokens: usage.output,
    sessionId: session.id,
    agentId: agent.id,
    taskId: task.id,
  },
  skill: {
    skillSlug,
    agentSlug: agent.slug,
    valueImpactCents: result.value_cents ?? 0,
    durationMinutes: result.duration_min,
    success: result.success,
    taskId: task.id,
    note: result.summary,
  },
  memory: result.cited_memory && {
    source: result.cited_memory.source, // 'Obsidian' | 'Notion' | 'Pinecone' | 'Internal'
    title: result.cited_memory.title,
    excerpt: result.cited_memory.excerpt,
    agentSlug: agent.slug,
    taskId: task.id,
  },
  outcome: {
    agentSlug: agent.slug,
    taskId: task.id,
    status: result.success ? 'done' : result.escalated ? 'partial' : 'failed',
    valueImpactCents: result.value_cents,
    durationMinutes: result.duration_min,
    summary: result.summary,
  },
})
```

The composite helper never throws and returns
`{ tokens, skill, memory, outcome }` results. Inspect them if you want to
log failures locally — but **do not raise** based on a non-200 status.

---

## 3. Python runtimes (Hermes Agent hook, OpenClaw worker, Claude Code skill executors)

```python
import os, httpx

MC_URL = os.environ.get("MC_URL", "http://localhost:3000")
MC_API_KEY = os.environ.get("MC_API_KEY", "")

def _headers():
    h = {"Content-Type": "application/json"}
    if MC_API_KEY:
        h["X-Api-Key"] = MC_API_KEY
    return h

async def report_skill_event(skill_slug, *, agent_slug=None, value_cents=0,
                             duration_min=None, success=True, task_id=None, note=None):
    payload = {
        "skillSlug": skill_slug,
        "agentSlug": agent_slug,
        "valueImpactCents": value_cents,
        "durationMinutes": duration_min,
        "success": success,
        "taskId": task_id,
        "note": note,
    }
    try:
        async with httpx.AsyncClient(timeout=4.0) as client:
            await client.post(f"{MC_URL}/api/skills/event",
                              json=payload, headers=_headers())
    except Exception:
        # NEVER crash the runtime on telemetry failure.
        pass
```

Repeat the same `try/except` shape for the other endpoints. The Hermes hook
shipped in `src/app/api/hermes/route.ts` already follows this contract for
session lifecycle — extend it with the calls above when integrating new
skill execution events from the Hermes runtime side.

---

## 4. OpenClaw browser/tool runtime

OpenClaw runs in a browser context — use the global `fetch` directly, no SDK
needed. Set the API key via the workspace's OpenClaw config:

```ts
async function report(path: string, body: unknown) {
  try {
    await fetch(`${MC_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': MC_API_KEY,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(4_000),
    })
  } catch {
    /* fire-and-forget */
  }
}

// After each browser tool action:
await report('/api/skills/event', { skillSlug: tool.id, agentSlug, success: ok })
```

---

## 5. Local proof harness

A self-contained mock proves the contract end-to-end:

```bash
# from repo root, with MC running on http://127.0.0.1:3000
node scripts/runtime-telemetry-harness.mjs
```

The harness:
1. Logs in as admin
2. Installs `pdf-generation`
3. Calls every telemetry endpoint via the adapter shape
4. Reads back the leaderboard + trace + approval queue to confirm the loop closed

---

## 6. Acceptance checklist for a runtime adapter

- [ ] Calls are fire-and-forget (timeouts ≤ 5 s, exceptions swallowed)
- [ ] Workspace API key passed via `X-Api-Key`
- [ ] `agentSlug` set on every call where possible
- [ ] `taskId` set when the runtime knows it
- [ ] Composite `reportSkillExecution` used for skill-completion events
- [ ] No vector / embedding / namespace terminology in any field
- [ ] Local harness passes against a development Mission Control

Once those boxes are checked, the runtime is fully integrated with the
Baseline OS operational loop:

> **runtime action → telemetry → trace → approval → skill ROI → recommendation → operator action**
