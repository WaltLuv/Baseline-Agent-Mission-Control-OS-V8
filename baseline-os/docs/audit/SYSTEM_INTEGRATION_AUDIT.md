# System Integration Audit

**Generated:** 2026-06-08 · **Author:** Claude Code
**Rule:** a feature is COMPLETE only when connected to all six platform systems:
**Org Chart · Agent Activity · Replay · Graphify · Knowledge OS · Proof.**
Legend: ✅ wired · 🟡 partial · ❌ missing · — n/a

> This is the honest current state. Every 🟡/❌ below is backlog. Surfaces are
> the same in Baseline OS (local) and Mission Control (workspace-scoped) unless
> noted; Slim Charles is Baseline-OS-only.

## Integration matrix

| Surface | Org Chart | Agent Activity | Replay | Graphify | Knowledge OS | Proof |
|---|---|---|---|---|---|---|
| Org Chart V2 | ✅ self | ✅ side panel | 🟡 model, not emitting | 🟡 via AgentActivity | 🟡 | 🟡 analytics |
| Video / Creative Studio | ❌ not linked | ✅ embedded | 🟡 proof drawer only | ✅ structural panel | 🟡 UAL | ✅ proof drawer |
| HyperEdit | ❌ | ❌ | ❌ | ❌ | ❌ | 🟡 logs |
| Agent pages (Hermes/Codex/Gemini/Ruflo) | 🟡 via factory | ✅ | 🟡 | ✅ structural panel | ❌ | 🟡 |
| Agent Factory | ✅ auto-sync | 🟡 | ✅ build→replay (MC) | 🟡 | ❌ | ✅ build proof |
| Workforce Install | ✅ auto-gen | ❌ | ✅ install→replay (MC) | ❌ | ❌ | ✅ |
| Pipeline | ❌ | ❌ | 🟡 | ❌ | ❌ | 🟡 |
| Gemini | ❌ | ✅ panel | ❌ | ✅ panel | ❌ | ❌ |
| Hermes MCP | ❌ | 🟡 | ❌ | 🟡 | ❌ | ❌ |
| Maestro | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Graphify | — | ✅ | 🟡 (context emits events) | ✅ self | ✅ brain #5 | 🟡 |
| Knowledge OS / NotebookLM / Pinecone / Notion / Obsidian | ❌ | ❌ | ❌ | 🟡 (graph registered) | ✅ self | ❌ |
| Production Unlock / GStack / Workforce Setup | — | ❌ | ❌ | ❌ | ❌ | 🟡 |

## Backlog derived from the audit (ordered by current priority)

1. **Gemini → Google Flow** (all six ❌/🟡 → must ship Graphify-first + AgentActivity + Replay-emitting + Proof).
2. **Hermes MCP Enterprise** — MCP/tools/skills/providers panels + execution/approval log + replay + graph + proof.
3. **Maestro** — orchestration HQ; wire all six.
4. **Workforce Replay UI** — surface the replay store visually for installs / factory / creative / workflows / org-gen.
5. **MC deep Graphify injection** — make MC execution paths graph-first like OS `/__agent_run`.
6. **Graphify remote-repo runner** — URL → clone → graph → query → deps → agent context.
7. **Cross-wiring pass** — emit Replay events + Proof from Video Studio / Org Chart / Pipeline / Workforce Install actions; link Video Studio ↔ Org Chart; add Knowledge OS hooks.
8. **Mansa Musa design system** (Baseline OS only) — visual layer.

## Shared integration primitives (already built — reuse, don't reinvent)
- **Agent Activity:** `<AgentActivity agentId/>` (both apps) + `/__agent_activity` (OS ledger) — embed on any surface.
- **Replay:** OS `src/lib/replay.ts` (pure) · MC `src/lib/replay/store.ts` + `mission_replays` table — `startReplay/recordReplayEvent/endReplay`.
- **Graphify:** `src/lib/graphify/graph.ts` + `context.ts` (`buildGraphContext`) · OS `/__graphify`, MC `/api/graphify`.
- **Org Chart:** OS localStorage roster + `workforce-autogen` · MC `/api/org-chart` + `store.ts` (`syncFactoryAgent`).
- **Proof:** Video Studio proof drawer pattern + replay proof events.
- **Knowledge OS:** brain layers (Obsidian/Notion/Pinecone/NotebookLM/Graphify) registry.
