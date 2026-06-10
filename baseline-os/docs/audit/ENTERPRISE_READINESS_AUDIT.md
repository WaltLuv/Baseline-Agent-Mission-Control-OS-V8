# Enterprise Readiness Audit — Baseline OS + Mission Control

Date: 2026-06-08
Scope: 10 audited surfaces across `/Users/walt/code/claude-os` (Baseline OS) and `/Users/walt/code/mc-v8` (Mission Control).

---

## 1. Readiness Table

| Surface | Readiness | One-line root cause / gap |
|---|---|---|
| HyperEdit page (`/hyperedit`) + MC HyperFrames pipeline | 🟢 green | No regression. 238 lines, all functions present; "stripped" hypothesis disproven by git history. |
| Video Studio (`/video-studio`) | 🔴 red | Built as a render dashboard, not a creative workspace; no upload/dropzone, canvas, timeline, chat, or proof drawer. |
| Gemini Agent pages (`/agents/gemini`) | 🟡 yellow | Generic LLM chat shell; no Google Flow / Imagen integration; `VideoAgentStudio` orphaned (route 404s). |
| Hermes MCP pages (`/agents/hermes-mcp`, `/hermes-mcp-loop`, `/agents/hermes`) | 🟡 yellow | Setup-guide + chat only; no MCP server status, tool list, dispatcher, or call-log proof trail. |
| AI Org Chart (`/org-chart`, MC `org-chart-panel.tsx`) | 🔴 red | CRUD/scoping solid but rendering is flat lists; MC renders no hierarchy at all; no canvas/graph viz. |
| Baseline OS sidebar nav (`app-sidebar.tsx`) | 🟡 yellow | Personal section holds 15 items, must hold 3; 12 misplaced; `/notes` route does not exist. |
| Homepage "Today at a glance" dashboard (`index.tsx`) | 🟢 green | All 13 blocks live and data-bound; only cosmetic/art polish outstanding. |
| State persistence inventory | 🟢 green | Durable layer exists and tested; 11 components still bypass it via raw `localStorage` (migration backlog). |
| Graphify integration | 🔴 red | Feature absent in both repos; no route, dependency, security model, or spec. npm `graphify` is an unrelated random-graph lib. |
| MC parity registry & P1 upgrades | 🟢 green | All six P1 surfaces in parity registry, routable, workspace-scoped, no Slim Charles leakage. |

Summary: 4 green, 3 yellow, 3 red.

---

## 2. HyperEdit Root Cause (explicit)

The audit hypothesis was that HyperEdit functionality had been **stripped/removed** in a commit. This is **disproven**.

- **No commit removed any functionality.** There is no "what was removed" because nothing was removed.
- Git history shows 5 commits on `src/routes/hyperedit.tsx`, all additive:
  - `5bef2ad` — feat: 9-deliverable batch (HyperEdit created, 177 lines)
  - `4cdf196` — fix: SSE parser + `/__agent_run` routing (177 lines, no size change)
  - `547f61f` — fix: FFmpeg server auto-start + dual-port probing (177 lines)
  - `e143cfc` — feat: RuntimeCredentialStatus badge (177 → 238 lines)
- Line-count progression is monotonically non-decreasing (177 → 177 → 177 → 238). Current file at `/Users/walt/code/claude-os/src/routes/hyperedit.tsx` is 238 lines = initial 177 + 61 lines of FFmpeg state + drafter refinements.
- Current functionality verified present: (1) live Vite iframe at `:5173`, (2) FFmpeg health probes + auto-start at `:3333`, (3) Remotion drafter with `/__agent_run` SSE streaming, (4) `RuntimeCredentialStatus` badge.
- MC side: HyperFrames lives in `provider-matrix-panel.tsx` (119 lines, since `5328efe`) with the 6-stage pipeline (storyboard, rasterize, encode, transcribe, caption, proof) rendering correctly.

**Root cause: n/a — never stripped.** The regression report was a false alarm. The proof commit to cite if challenged: `git show 5bef2ad:src/routes/hyperedit.tsx` (177 lines) vs current (238 lines).

**Restore plan: none required.** Recommended action: close the regression ticket and record in CLAUDE.md that HyperEdit is green to prevent re-investigation.

Key files:
- `/Users/walt/code/claude-os/src/routes/hyperedit.tsx`
- `/Users/walt/code/mc-v8/src/components/panels/provider-matrix-panel.tsx`
- `/Users/walt/code/mc-v8/src/lib/creative/hyperframes-pipeline.ts`

---

## 3. Priority Order (P0 first), sequenced to avoid shared-file conflicts

Shared files that multiple surfaces touch must be edited in a deliberate order to avoid merge conflicts:
- `src/components/app-sidebar.tsx` (sidebar nav)
- router/route tree (`src/router.tsx`, new `src/routes/*.tsx`)
- `/Users/walt/code/mc-v8/src/lib/parity/surfaces.ts` (parity registry)
- both `CLAUDE.md` files
- `vite.config.ts` (sidecar endpoints — touched by Video Studio, Hermes MCP, Graphify)

### P0 — Foundation & shared-file changes (do FIRST, serialize edits)

1. **Sidebar nav + `/notes` route** (`app-sidebar.tsx`, new `src/routes/notes.tsx`).
   Do this before any other surface adds nav links, since every new surface (Graphify, restructured Video Studio) will want a nav entry. Land the trim first, then later surfaces append cleanly to the `tools` array.
2. **vite.config.ts sidecar endpoint contract** — agree the naming convention (`/__<feature>_<verb>`) and add stubs in one pass for the new endpoints Video Studio, Hermes MCP, and Graphify will need. Avoids three surfaces each rewriting the same middleware block.
3. **MC parity registry baseline** (`surfaces.ts`) — confirm current honest states (Gemini `setup_needed`, Hermes `cloud_pairing`). All later MC changes (Gemini, Org Chart) update this file; establish the canonical version first.

### P1 — High-value, customer-visible surfaces (mostly isolated files after P0)

4. **AI Org Chart V2** (red) — `org-chart.tsx`, MC `org-chart-panel.tsx`. Visual/UX is production-breaking; MC renders no hierarchy. Self-contained per-file after P0.
5. **Video Studio rebuild** (red) — `components/video-studio.tsx` + `vite.config.ts` upload endpoint (already stubbed in P0). Foundational gap (no upload).
6. **Hermes MCP control room** (yellow) — `agents.hermes-mcp.tsx` + new `mcp-*` components + `vite.config.ts` MCP endpoints (stubbed in P0).
7. **Gemini Google Flow** (yellow) — `agents.gemini.tsx`, expose `agents.gemini.studio.tsx` route, wire `VideoAgentStudio`. Updates `surfaces.ts` (P0 baseline) and `provider-matrix.ts`.

### P2 — Hardening & polish (lower customer impact)

8. **State persistence migration** (green→hardened) — migrate 11 raw-`localStorage` components to `durableSet`. Touches many files but each is isolated; can be done incrementally.
9. **Homepage visual polish** (green) — `index.tsx` cosmetic-only changes; no functional risk.

### P3 — New feature, needs spec first

10. **Graphify** (red) — undefined feature. Needs spec + security architecture before any code. Touches `vite.config.ts`, router, both repos, parity registry — do LAST so its shared-file edits don't block higher-priority work.

### CLAUDE.md updates
Batch all CLAUDE.md edits at the END of each surface's work (not mid-stream) so the two CLAUDE.md files are edited once per surface, in sequence, avoiding cross-surface conflicts.

---

## 4. Per-Surface Restore Plans

### 4.1 HyperEdit — 🟢
No restore needed. Close the regression ticket. Record green status in CLAUDE.md.

### 4.2 Video Studio — 🔴
`/Users/walt/code/claude-os/src/components/video-studio.tsx` (860 lines), `src/routes/video-studio.tsx`.
1. Add upload UI to Workspace tab (drag-drop + file picker); new `POST /__video_workspace_upload` (multipart). Store metadata via `CreativeAsset` schema in `src/lib/claude-code-studio.ts`.
2. Restructure 3-pane → 4-pane: Left (asset library/upload), Center (canvas), Right (AI chat), Bottom (timeline). Use grid helpers from `studio-toolbox.tsx`.
3. Integrate shared creative core: import `normalizeStudioHistory`, `filterAssetsByProvider`, `CreativeAsset`, `CreativeJob` from `lib/claude-code-studio.ts`; replace ad-hoc `RenderJob`/`AvatarJob`.
4. Add right AI chat sidebar (adapt `StudioToolbox`); wire `/__ai_chat`; store convo in `/__studio_history`.
5. Implement bottom timeline pane (frame scrubber / render-progress track) — optional for MVP.
6. Add unified "Feed" tab merging Create + Avatar jobs + upload mtimes.
7. Add proof drawer: "Mark as Proof" on Workspace items; new `/__studio_proofs` endpoint.
8. Wire Higgsfield provider via `lib/higgsfield-control.ts` (`HIGGSFIELD_TABS`); `POST /__higgsfield_generate`.
9. Add cross-asset reference ("use this image in next video").
10. Expose Workspace as a proof source in MC kanban (low priority).
11. E2E test upload → generate → render → feed → proof export.
12. Update `architecture/video-studio.md`.

### 4.3 Gemini Agent — 🟡
`agents.gemini.tsx` (202), `agents.gemini.studio.tsx` (15, route not exposed → 404), `video-agent-studio.tsx` (424, orphaned), `studio-toolbox.tsx`, MC `surfaces.ts`, `provider-matrix.ts`.
1. Confirm intent with Walt: Google Flow creative orchestrator vs. plain chat.
2. Design Flow surface: prompt+context input → Gemini reasoning panel → visual preview → asset manifest → export.
3. Integrate Gemini API: `GEMINI_API_KEY` probe + status; `/__gemini_reason` (or `/__agent_run` agent=gemini) returning `{shots[], planMarkdown}`.
4. Build visual preview workspace (shot cards + timeline + voiceover script).
5. Add structured "Workflow Plan" panel (shot list, duration, cost from provider matrix, approval).
6. Wire shot generation to Higgsfield/FAL/TTS per shot.
7. Export/proof packet (markdown + JSON manifest) to `~/Downloads` or Obsidian.
8. Integrate Creative Provider Matrix status derivation (credential present → `setup_needed` if missing).
9. Repurpose `VideoAgentStudio` "Video Agent" tab as Gemini-driven orchestrator; expose the `/agents/gemini/studio` route.
10. Add Google auth/quota status display in Control Room.
11. Add demo mode if live Imagen/Generation APIs unavailable.
12. E2E test the upload → plan → review → generate → proof flow.
13. Update MC parity (`surfaces.ts`) once OS flow works.
14. Document Gemini's orchestrator role in both CLAUDE.md files.

### 4.4 Hermes MCP — 🟡
`agents.hermes-mcp.tsx` (792, setup-guide-only), `hermes-mcp-loop.tsx` (293, real harness), `agents.hermes.tsx` (8300, agent dashboard not MCP), `vite.config.ts`.
1. `GET /__mcp_servers` — list connected MCP servers, tool schemas, auth, heartbeat.
2. `POST /__mcp_call` — execute tool via bridge; append to `~/.claude-os/mcp-calls.jsonl`.
3. `GET /__mcp_logs` — paginated call log with filters (timestamp, tokens, cost, exit code).
4. New `src/components/mcp-connection-status.tsx` (bridge health, OAuth age, tunnel reachability).
5. New `src/components/mcp-servers-list.tsx` (per-server cards + schema inspector).
6. New `src/components/mcp-tool-dispatcher.tsx` (schema-driven form → `/__mcp_call`).
7. New `src/components/mcp-call-log.tsx` (paginated proof-trail table).
8. New `src/components/mcp-workflow-launcher.tsx` (pre-built MCP sequences + SSE log).
9. Replace generic `FullChat` in `agents.hermes-mcp.tsx` with the 3-column control room (Status | Servers | Dispatcher) + Call Log.
10. Honest offline/empty states ("Bridge Offline. Run: hermes-mcp serve").
11. Update `architecture/hermes-mcp.md`.
12. (Optional) Greek/Roman art header.
13. Test: register a test MCP server, verify discovery + call + log entry.
14. Ship after e2e; update CLAUDE.md.

### 4.5 AI Org Chart — 🔴
`/Users/walt/code/claude-os/src/routes/org-chart.tsx`, MC `org-chart-panel.tsx`, ref `memory-graph.tsx`.
1. Add graph library: use `reagraph` (already in MC deps; both repos accept D3-style hierarchy).
2. Create `OrgChartCanvas` wrapper around `reagraph` `GraphCanvas`; convert flat list → nodes+edges.
3. Design node cards: avatar, name, role, department color badge, runtime dot, status, approval icon (ref MC `MemoryGraph` lines 26-44, 65-105).
4. Department clusters via `node.group` (Leadership/Creative/Video/Intelligence/Engineering/Operations/Personal color map).
5. Draggable nodes: `onNodeDragEnd` → update `managerId` + persist; pan/zoom out-of-box.
6. Replace modal/inline forms with right-sliding `OrgChartSidePanel`; keep existing `csv()`/`set()`/`save()` logic.
7. Illustrated empty state (SVG tree + "Create first agent" CTA).
8. Port to both repos: OS new `OrgChartCanvas.tsx`; MC replace `org-chart-panel.tsx` render (keep `/api/org-chart` CRUD).
9. Preserve CRUD — only rendering/forms change; regression-test create/edit/delete/archive/reassign.
10. Approval-authority visibility (shield icon, amber=walt-approval, red=walt-only).
11. Skills/tools on node (top 2 truncated, expand in panel/tooltip).
12. Test workspace isolation: MC `workspace_id` filtering; OS `localStorage` key `baseline-os-org-chart` privacy.

### 4.6 Sidebar Nav — 🟡
`/Users/walt/code/claude-os/src/components/app-sidebar.tsx`, new `src/routes/notes.tsx`.
1. Create `/notes` route (`src/routes/notes.tsx`, stub acceptable) with `BookMarked` icon.
2. Trim Personal to exactly 3: Goals, Journal, Notes.
3. Move 12 items to `tools` (order): Notebook, Prompts, Search Chats, Guide, Kanban, Mission Control, Flight Deck, Runtime Registry, Approvals, Employee Personas, AI Org Chart, SEO, Studio. Final `tools` = 23 items.
4. Verify icons — all already imported, no new imports.
5. Commit `app-sidebar.tsx` (routes unchanged; all links resolve).

### 4.7 Homepage Dashboard — 🟢
`/Users/walt/code/claude-os/src/routes/index.tsx`. Functional state complete. Cosmetic-only backlog (optional):
1. Spacing p-5→p-6, header/icon size bumps.
2. Borders rounded-2xl→rounded-3xl, increased opacity/weight.
3. Glows h-44→h-56, blur-[40px], higher opacity + transitions.
4. Animation polish (sheen 0.45→0.55, active dot glow, today-bar pulse).
5. Typography tracking + text-shadow.
6. Dream hero motion (`dreamPulse` 8s loop).
7. Card outer glow / inset highlights.
8–9. Optional art-direction swap (West African royal / Mansa Musa era) for hermes-art + dream imagery.
10. Verify mobile responsive, WCAG AA, live data binding, zero functional change.

### 4.8 State Persistence — 🟢 (hardening backlog)
Durable layer (`src/lib/state-integrity.ts`, tested) exists. 11 components bypass it.
1–14. Migrate to `durableSet`/`usePersistentString`: theme-toggle, voice, app-sidebar (read symmetry), full-chat, codex-terminal, antigravity-terminal, agent-factory, video-studio, goals, journal, prompts, hermes-mnemosyne, price-overrides, setup config-draft.
15. Add sidecar tests (`/__os_config`, `/__obsidian_write`).
16. Cross-tab sync test (StorageEvent).
17. SSR hydration test (StrictMode).
18. Quota-exceeded handling (`QuotaExceededError` → toast + audit).
19. Implement `/__notion_page` stub.
20. Audit-log export endpoint + `/settings` UI.
21. `/debug/storage` inspection tool.
22. Document `docs/persistence.md`.

### 4.9 Graphify — 🔴 (new feature; spec first)
Absent in both repos. `mc-v8` security patterns (`secret-scanner.ts`, `security-scan.ts`) are the reference.
1. Write `docs/graphify-spec.md`: graph-health metrics, safe repo import (https + temp clone + 1h TTL + path containment), PI-Agent context ownership, secret blocklist, code-execution prevention. **Clarify whether npm `graphify` (random-graph lib) is wanted or a custom impl is needed.**
2. Install dependency (or build custom) in both `package.json`.
3. MC `src/app/api/graphify/route.ts`: `POST /import`, `GET /health`, `GET /query`.
4. OS `src/routes/graphify.tsx` + sidecar `/__graphify_import`.
5. OS sidecar handler in `src/start.ts` (temp clone, scan, compute, TTL cleanup).
6. PI-Agent context injection (`lib/graphify-context.ts` both repos).
7. MCP tools in `scripts/mc-mcp-server.cjs` (`graphify_import_repo`, `graphify_query`, `graphify_health`).
8. Secret blocklist enforcement (extend `secret-scanner.ts`; `.gitignore` + `blocklist.json`).
9. `graphHealthCalc` (`lib/graph-metrics.ts` both repos): density, avg path, orphan ratio, clustering → 0-100.
10. Sandboxed `graph-viewer.html` in `public/` (no eval/require; iframe sandbox; XSS-tested).
11. Test: secret-scan unit, public-repo E2E, security audit (no path traversal/code exec), typecheck+lint.
12. `docs/graphify-operations.md` + nav links + PI-Agent learn via `memory_store`.
13. Deploy + monitor temp-dir cleanup; SLA import <2s small / <30s large.

### 4.10 MC Parity Registry & P1 — 🟢
`/Users/walt/code/mc-v8/src/lib/parity/surfaces.ts`, `app/app/[[...panel]]/page.tsx`, `__tests__/no-slim-charles.test.ts`. Verified complete:
- All six P1 surfaces (Gemini, Hermes MCP, Maestro, Org Chart V2, Agent Factory, Creative/Video) in parity registry with honest states.
- All 20 `status: live` surfaces have routable pages or ContentRouter cases.
- No-Slim-Charles test passes (zero hits on forbidden patterns).
No restore action; keep `surfaces.ts` as the canonical state source as Gemini/Org Chart work updates it.

---

## 5. Genuinely Done vs Shell (honesty section)

**Genuinely done (real, working, verified):**
- **HyperEdit** — fully operational, 238 lines, live iframe + FFmpeg probes + SSE drafter + credential badge. No regression. The "stripped" claim was false.
- **Homepage dashboard** — 13 blocks live with real data binding; only cosmetic polish remains.
- **State-integrity durable layer** — implemented and unit-tested (`state-integrity.ts` + `.test.ts`). (Adoption is incomplete — see shell note.)
- **MC parity registry** — six P1 surfaces registered with honest states, routable, workspace-scoped, no personal-data leakage (test-enforced).
- **`hermes-mcp-loop.tsx`** — a real automation harness: port probing (:8642/:8765), OAuth detection, tunnel detection, up/down scripts with SSE logs, honest `[setup-needed]` markers.

**Shell / aspirational (UI or description exists, the capability does not):**
- **Video Studio** — a render *dashboard*, not the advertised creative *workspace*. No upload, canvas, timeline, chat, or proof drawer. The target architecture is described but unbuilt.
- **Gemini Agent** — Control Room *describes* Gemini as "lead orchestrator for the Higgsfield Supercomputer," but the page is a generic 4-tab LLM chat wired to `/__ai_chat` (Claude/OpenRouter), not Gemini/Imagen. `VideoAgentStudio` (the real orchestration UI) is orphaned and its route 404s.
- **Hermes MCP page** (`agents.hermes-mcp.tsx`) — a setup wizard + generic chat. No MCP server status, tool list, dispatcher, or call-log. It never transitions from `[setup-needed]` to `[operational]`.
- **AI Org Chart** — CRUD and workspace scoping are real and solid, but the *visualization* is a shell: flat indented lists in OS, no hierarchy at all in MC. Graph deps (`reagraph`/`reactflow`) are installed but unused for the org chart.
- **Graphify** — does not exist. No route, dependency, endpoint, or spec. The `/graphify` concept is an undefined feature request; the npm `graphify` package is an unrelated random-graph generator.

**Partial (real core, incomplete adoption):**
- **State persistence** — durable layer is genuinely done and tested, but 11 components still use the raw `useState + localStorage` anti-pattern and bypass verification, leaving them exposed to empty-default clobber on quota/corruption.
- **Sidebar nav** — functional but misconfigured: Personal section holds 15 items (should be 3), and the `/notes` link target route does not exist yet.
