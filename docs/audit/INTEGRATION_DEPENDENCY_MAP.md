# Integration Dependency Map

**Generated:** 2026-06-08 · **Author:** Claude Code
**Thesis:** integration quality > feature quantity. Every surface must participate
in the six platform systems. This map lists the remaining gaps and the order to
close them. Legend: ✅ wired · 🟡 partial · ❌ missing.

## Gaps by system (what still needs wiring)

### Replay (biggest gap — close first)
Emits today: Workforce Install ✅ (MC), Agent Factory ✅ (MC), Gemini Flow 🟡 (events generated, not persisted).
Still ❌ persisting replay: **Org Chart generation, Creative OS actions, Agent Factory (OS), Gemini Flow (both), Maestro, Hermes, VisionOps/VoiceOps/PropControl/Market Swarm**.
**Blocker:** OS had no replay *store* (only the pure model) and there was **no Replay UI** in either app.

### Agent Activity
✅: agent pages, Video/Creative Studio, Gemini Flow, Org Chart side panel.
❌: HyperEdit, Pipeline, Workforce Install confirmation, Knowledge OS, Maestro.

### Graphify
✅: agent pages (structural panel), Gemini Flow (graph-first), Video Studio.
✅: OS `/__agent_run` injects; **MC `POST /api/hermes/tasks` now injects graph-first too (closed 2026-06-09)**.
❌: Pipeline, Maestro, Hermes task path (MC).

### Org Chart
✅: Agent Factory (auto-sync), Workforce Install (auto-gen).
❌: Video/Creative Studio link, Gemini Flow agents → org, Maestro teams.

### Knowledge OS
✅: brain-layer registry incl. Graphify (#5).
❌: almost every surface lacks an explicit Knowledge OS hook (Video Studio UAL is the only 🟡).

### Proof
✅: Video/Creative Studio proof drawer, Agent Factory, Workforce Install.
❌: Org Chart, Pipeline, Gemini Flow, Maestro, Hermes.

## Close-order (gaps before new surfaces)

| # | Work | Why |
|---|---|---|
| 1 | **Replay store (OS) + Replay UI (both)** | Tier-1 trust feature; data exists, UI is the missing piece. |
| 2 | **Replay emission everywhere** | Org Chart gen, Creative OS, Gemini Flow, Agent Factory(OS) → persist replay. |
| 3 | **MC deep Graphify injection** | kill the OS↔MC architectural mismatch (task→graph→context→execute). |
| 4 | **Hermes MCP Enterprise** | registries + logs + replay + graph + proof (no ghosts). |
| 5 | **Maestro** | routing HQ; participates in all six. |
| 6 | **Graphify remote-repo runner** | URL→clone→graph→query→deps→context. |
| 7 | **Mansa Musa design system** (OS only) | visual layer. |

## Universal primitives (reuse — do not reinvent)
- Replay: OS `src/lib/replay.ts` (pure) + NEW `replay-store.ts` (localStorage) · MC `replay/store.ts` + `mission_replays` + NEW `/api/replay` list.
- Agent Activity: `<AgentActivity agentId/>`.
- Graphify: `graphify/context.ts` `buildGraphContext` + `/__graphify` / `/api/graphify`.
- Org Chart: `workforce-autogen` (OS) · `org-chart/store` (MC).
- Proof: replay proof events + proof drawer.
