# Baseline OS Correction Pass — Implementation Report

**Date:** 2026-06-04
**Branch:** main (pushed)
**Scope:** Audit-approved 9-step plan + 5 new ClaudeClaw specialists

---

## ✅ Smoke test results

### Route HTTP checks
| Route | Status | Notes |
|---|---|---|
| `/` | 200 | Home |
| `/documents` | 200 | V2.3 Documents Gallery |
| `/personas` | 200 | with inline voice+text chat |
| `/claudeclaw` | 200 | rebranded **Claude Code** in sidebar |
| `/agents/free-claude` | 200 | Coding Agent — Chat / Terminal / OpenCode / Ant / Models / Setup |
| `/agents/hermes` | 200 | + Manage tab + Media tab |
| `/video-studio` | 200 | Hermes Video Agent — HyperFrames |
| `/studio` | 200 | preserved |
| `/flight-deck` | 200 | preserved |
| `/aion-ui` | **404** | concept removed ✓ |
| `/agentic-os` | **404** | concept removed ✓ |

### Backend endpoint health
| Endpoint | Status |
|---|---|
| `/__hermes_documents` | 200 (V2.3 backend, soft-delete to `.trash/`) |
| `/__hermes_dashboard` | 200 (running: true on :9119) |
| `/__claude_ant` | 200 (graceful "not installed") |
| `/__hyperframes_projects` | 200 (0 projects, HyperFrames CLI installed at 0.6.71) |
| `/__hermes_studio_list` | 200 (graceful "needs MiniMax auth") |
| `/__video_workspace` | 200 |
| `/__voice_voices` | 200 (26 ElevenLabs voices) |

---

## Commits this pass (9)

| # | Commit | What |
|---|---|---|
| 1 | `6e44ba8` | **cleanup:** delete Aion UI + Agentic OS routes/sidebar/files |
| 2 | `d0372f7` | **documents:** V2.3 Hermes Documents Gallery (2158 LOC + 10 engraved art assets) |
| 3 | `2527acf` | **personas:** inline FullChat per persona (mirrors ClaudeClaw Specialists pattern) |
| 4 | `dfdd092` | **claude-code:** rename + 5 new specialists + real `claude` CLI runtime toggle |
| 5 | `e494c75` | **hermes:** HermesManage tab — iframe of Hermes FastAPI dashboard :9119 |
| 6 | `2ab1a04` | **coding-agent:** Claude Platform `ant` cockpit tab |
| 7 | `6fb9018` | **video-studio:** HyperFrames Video Agent — 861 LOC component + 9 endpoints |
| 8 | `db09e0a` | **hermes-media:** MiniMax/Grok studio tab with honest "needs auth" stubs |
| 9 | (this report) | **report** |

---

## Feature delivery vs the audit table

| # | Feature | Status |
|---|---|---|
| 1 | Aion UI removal | ✅ removed completely |
| 2 | Agentic OS removal | ✅ removed completely |
| 3 | Documents Gallery V2.3 | ✅ ported with engraved art, `.trash/` + Undo |
| 4 | Hermes install prompt modal | ✅ inside Documents Gallery |
| 5 | Hermes Video Agent | ✅ ported VideoStudio (861 LOC) + lib/video-projects + 9 endpoints |
| 6 | Hermes Manage | ✅ iframe of FastAPI dashboard :9119 with graceful start/error states |
| 7 | Claude Platform `ant` cockpit | ✅ ported, distinguishes Apache Ant, graceful missing-CLI state |
| 8 | ClaudeClaw → Claude Code rename | ✅ display + sidebar |
| 9 | Real `claude` CLI tab | ✅ new `claude-code` agent slot + 3-way runtime toggle (Claude · Claude CLI · Codex) |
| 10 | Personas inline chat | ✅ voice + text via FullChat overlay |
| 11 | Mission Control V8 launcher | ✅ (existing sidebar entry preserved; no dedicated page) |
| 12 | MiniMax Studio audit + patch | ✅ Media tab on Hermes page + honest "needs auth" |
| 13 | 5 new ClaudeClaw specialists | ✅ Receptionist · Dispatcher · Account Manager · Compliance Officer · CFO (existing 7 preserved) |

---

## HyperFrames CLI install

`npm install -g hyperframes@0.6.71` — installed to `~/.hermes/node/bin/hyperframes`, symlinked to `/opt/homebrew/bin/hyperframes`. Now resolvable via `which hyperframes` in the render endpoint.

---

## Setup-needed states (honest, not faked)

| Surface | Missing dependency | Setup command shown in UI |
|---|---|---|
| Claude Platform `ant` cockpit | `ant` binary | `brew install anthropics/tap/ant` + `ant auth login` |
| Hermes Manage | `hermes dashboard --tui` | spawn handled automatically; falls back to "Try again" + manual command |
| Video Studio HeyGen avatars | `HEYGEN_API_KEY` | shown in stub response |
| Hermes Media (MiniMax/Grok) | `hermes auth add minimax-oauth` | shown in error message |

---

## What was NOT done (deferred from the bigger ask)

The user dumped several large additional requests on top of the audit-approved 9-step plan. Those are queued as a separate backlog (not started, awaiting prioritization):

1. **Insurance Company Demo** (6 personas + 12 workflows + 4-tier approval policies + demo data) — described in the prompt; out of scope for this correction pass.
2. **Tonbi/Hermes SQLite Kanban Dispatcher** — referenced repo `https://github.com/WaltLuv/hermes-multi-agent-workflow.git`. Architecture: schema + dispatcher loop + scoring rubric + Telegram gate + Mission Control sync + CLI commands. ~2 weeks of focused work.
3. **Mission Control page-mirroring** — porting 20+ Baseline OS surfaces into MC v8 with "no fake state" rule. This is a `mc-v8` repo change, not Baseline OS.
4. **Flight Deck visibility in MC** — manifest endpoints, download buttons, pairing flow.
5. **MC landing page = `/workforce-os`** — port the Workforce OS landing page to MC v8 home.
6. **System Pilot B.L.A.S.T. memory init** — `/memory/`, `/architecture/`, `/execution/` folder structure + CLAUDE.md template.
7. **CLAUDE.md project operating-manual template** propagation — informational; no code.

These should each get their own scoping pass before code lands.

---

## Files changed this session (12)

```
A  IMPLEMENTATION_REPORT_2026-06-04.md
A  src/assets/hermes-art/file-types/*.webp (10 assets)
A  src/components/claude-ant.tsx
A  src/components/hermes-documents-gallery.tsx
A  src/components/hermes-manage.tsx
A  src/components/hermes-studio-media.tsx
A  src/components/video-studio.tsx
A  src/lib/video-projects.ts
A  src/routes/video-studio.tsx
M  src/components/app-sidebar.tsx
M  src/components/full-chat.tsx
M  src/routes/agents.free-claude.tsx
M  src/routes/agents.hermes.tsx
M  src/routes/claudeclaw.tsx
M  src/routes/documents.tsx
M  src/routes/personas.tsx
M  vite.config.ts (5 new endpoint blocks + 3 imports + ant + hyperframes + heygen + studio stubs)
D  src/routes/aion-ui.tsx
D  src/routes/agentic-os.tsx
```

---

## Truth standard adherence

- ✅ No fake connected states
- ✅ No fake tool execution
- ✅ No fake agents / skills / data
- ✅ Every "needs setup" surface shows the actual setup command
- ✅ No Aion UI anywhere
- ✅ No Agentic OS page
- ✅ Existing pillars untouched: Mission Control sync · Daily Brief · ROI · Runtime Registry · Tool Registry · Approval Engine · Workforce Router · CLI registry

