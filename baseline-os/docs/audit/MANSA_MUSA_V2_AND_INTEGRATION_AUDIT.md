# Mansa Musa V2 + Integration Audit

**Generated:** 2026-06-09 · **Author:** Claude Code · **Scope:** Baseline OS (design) + both apps (integration)
Legend: ✅ wired · 🟡 partial · ❌ missing

## 1. Mansa Musa V2 roadmap

**Aesthetic target:** *Mansa Musa × Apple × Palantir × Iron Man × Wakanda* — elite, intelligent, wealthy, futuristic, operational, premium, powerful. NOT museum / historical recreation / generic Afrocentric template.

**V1 (shipped):** tokens (gold/night/parchment/indigo/terracotta), SVG motifs (gold-rule, mali-grid, sankore-arch), applied to the home hero.

**V2 foundation (this slice):**
- Elevated token set: **holographic gold**, carbon-black glass, HUD cyan, regal-violet — `MANSA_V2` (glass surfaces, glow, grid overlays, HUD treatments).
- A reusable **`<MansaSurface>` / `<MansaPanel>`** primitive so every surface adopts the look consistently (glass card + gold hairline + optional geometric grid backdrop) with **zero layout/functional change**.
- A **`<MansaHeader>`** (HUD-style title bar with Sankoré crest + gold rule).

**V2 rollout order (visual enhancement only, surface-by-surface):**
1. Flight Deck (command-center bridge) — highest priority
2. Graphify · Maestro · Hermes MCP (operational HUDs)
3. Gemini Flow · Replay · Org Chart
4. Video Studio / Creative OS · HyperEdit
5. Knowledge OS · NotebookLM · PI Agent
6. Slim Charles Voice (neural-intelligence command center — see §7)

## 2. Flight Deck audit

Current `/flight-deck` (211 lines): consumes the **real** Runtime Registry, shows status counts (healthy/warning/critical/offline) + per-runtime records. Honest, but reads like a status list, not a command bridge.
**Gaps → V2 redesign targets:**
- ❌ Cost Monitor (no spend view) · ❌ Approval Center · ❌ Deployment Center (deploy actions)
- 🟡 Health Monitor (counts only; no trend/logs) · 🟡 Workforce Command (no org/workforce link)
- ❌ Replay/Proof/Graphify participation on the surface
**Redesign:** Runtime Control Tower + Workforce Command + Deployment + Health + Cost + Approval, in the Mansa V2 HUD — "bridge of a billion-dollar company."

## 3. Disconnected systems (integration coverage)

**Agent Activity** — OS ✅: hermes, gemini, codex, ruflo, maestro, org-chart, video-studio. MC ✅: org-chart, gemini-flow, orchestration, video-studio, hermes, agent-history.
❌ both: **Flight Deck, Graphify page, Knowledge OS/NotebookLM, PI Agent, Slim Charles (OS), HyperEdit, Agent Factory**.

**Replay emission** — OS ✅: workforce-os (directives), gemini, org-chart, maestro. MC ✅: dynamic-workflow, gemini-flow, orchestration, install, factory, hermes-tasks.
❌ both: **Video Studio renders, Creative OS pipelines, Agent Factory (OS), Flight Deck deploys, Slim Charles sessions**.

**Graphify (graph-first)** — OS ✅: graphify, workforce-os, gemini, maestro, agent_run. MC ✅: graphify, gemini-flow, orchestration, hermes-tasks.
❌ both: **Video Studio, HyperEdit, Knowledge OS, PI Agent, Agent Factory**.

**Org Chart** — ✅ Agent Factory (sync), Workforce Install (gen). ❌ Video Studio / Gemini Flow / Maestro teams → org.

**Knowledge OS** — ✅ brain-layer registry (Graphify #5). ❌ explicit write-hooks on nearly every surface.

**Proof** — ✅ Video/Creative Studio, Agent Factory, Hermes logs, directive runs, Maestro. ❌ Flight Deck, HyperEdit, PI Agent, Slim Charles.

## 4. Visual consistency audit (Baseline OS)

| Surface | Mansa applied |
|---|---|
| Workforce OS home hero | ✅ V1 |
| Flight Deck, Graphify, Gemini, Hermes, Maestro, Replay, Video Studio, HyperEdit, Agent Factory, Org Chart, Creative OS, NotebookLM, PI Agent, Slim Charles | ❌ (V2 rollout) |

Inconsistent palettes today: violet (hero/maestro), cyan (graphify), gold (gemini), yellow (video). V2 unifies on the Mansa HUD with per-surface accent tones.

## 5. Proof-system coverage audit
✅ Video/Creative Studio (proof drawer), Agent Factory (build proof), Hermes (exec/approval logs), directive runs, Maestro routing, Replay proof events.
❌ Flight Deck, HyperEdit, PI Agent, Slim Charles, NotebookLM. → add proof events / visible proof panels.

## 6. Replay-system coverage audit
Replay UI ✅ both apps (`/replay`, `/app/replay`). Emitters wired (see §3). **Gaps:** Video Studio, Creative OS, Agent Factory (OS), Flight Deck, Slim Charles, VisionOps live runs. → emit on those actions.

## 7. Next implementation order
1. **Mansa V2 foundation** (`MANSA_V2` tokens + `MansaSurface`/`MansaHeader`) — this slice.
2. **Flight Deck redesign** (control tower + cost + approval + deploy + health) in V2.
3. **Close Agent-Activity gaps**: embed on Flight Deck, Graphify, Knowledge OS, PI Agent, Agent Factory.
4. **Close Replay/Proof gaps**: emit from Video Studio, Creative OS, Agent Factory, Flight Deck.
5. **Slim Charles Voice V2** — neural-intelligence command center (active pathways, memory/graph/tool/skill/replay/approval activity). OS only.
6. **Roll V2 across remaining surfaces** (consistency).
