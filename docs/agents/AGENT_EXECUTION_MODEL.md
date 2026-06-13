# Agent Execution Model

Mission Control agents are **not fake cards**. Every agent resolves to an
execution profile and a readiness status computed from the workspace
**Capability Matrix**. No fake green states.

Source: `src/lib/agents/execution-model.ts` · API: `GET /api/agents/readiness`.

## Execution levels
- **Level 1 — Demo Agent** — simulation only; seeded proof/replay/activity; no
  live execution. Status: **Demo Only**.
- **Level 2 — Native Workflow Agent** — runs real Mission Control workflows
  (maintenance triage, owner approval, vendor dispatch, proof/replay, comms,
  billing/credit debits). Needs **no** external runtime. Status: **Native
  Workflow Ready**.
- **Level 3 — Runtime Agent** — requires a connected runtime (Hermes, Claude
  Code, Codex, OpenClaw, Opencode, PI Agent, Browser/Computer Use, Flight Deck,
  Baseline OS tools/skills). Status: **Runtime Connected** when the runtime is
  up, else **Needs Runtime** / **Needs Credentials**.

## Readiness statuses
`Ready · Demo Only · Native Workflow Ready · Runtime Connected · Needs Runtime ·
Needs Credentials · Needs Approval · Offline`

A Level-3 agent is **Needs Runtime** until its runtime capability is connected
in the Capability Matrix — never a fake green.

## What each agent shows
execution level · assigned runtime · runtime status · PI context status · tools ·
skills · permissions · approval rules · last execution · proof/replay history ·
setup-needed items.

## Examples (canonical profiles)
| Agent | Level | Runtime | Status (unconnected) |
|---|---|---|---|
| Maintenance Dispatcher | 2 | MC workflow engine (Hermes optional) | Native Workflow Ready |
| Vendor Coordinator | 2 | MC workflow engine | Native Workflow Ready |
| Owner Relations | 2 | MC workflow engine | Native Workflow Ready |
| Claude Code Engineer | 3 | Claude Code (Flight Deck) | Needs Runtime |
| Codex Agent | 3 | Codex | Needs Runtime |
| OpenClaw | 3 | OpenClaw | Needs Runtime |
| PI Agent | harness | PI CLI/SDK | Ready (harness) — context layer, not the worker |

## Customer vs operator/admin
Customers see workflow outcomes + readiness. Operators/admins (and Baseline OS)
see full runtime/provider detail.
