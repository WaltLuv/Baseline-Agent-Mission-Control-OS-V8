# PI Agent Harness

PI Agent is the **context/memory layer**, not the runtime. It WRAPS the
specialized workers (Hermes, Claude Code, Codex, OpenClaw, native workflow
agents) — it never replaces them.

Backend: `src/lib/pi/harness.ts` · UI: `/app/pi-agent` ·
API: `POST /api/pi/run`, `GET /api/pi/packages`.

## Flow
`request → PI context package → policy gate → route to specialized sub-agent →
execute (Level 2 workflow engine OR Level 3 runtime) → proof/replay → PI memory
update`.

## Responsibilities
retrieve workspace memory · tenant/property/vendor/owner context · query
Graphify · query Knowledge OS · enforce policy + approval context · route tasks ·
inject context into execution · update memory after completion · index
proof/replay · create a context package for every major workflow.

## Data
`pi_context_packages`, `pi_routing_logs`, `pi_memory_events` (migration 079).

## Runtime registration (when PI CLI/SDK exists)
```
runtime_type: pi-agent
capabilities: memory_context, graphify_query, knowledge_lookup, proof_index,
              replay_index, task_routing, policy_context
```
If the PI CLI/SDK is **not** installed, the page shows
**“Setup needed — connect PI Agent runtime.”** The harness (context layer) is
built-in and Ready; the CLI/SDK runtime is a separate, honest setup-needed.
The command input is hidden until a runtime connects — no fake connection.
