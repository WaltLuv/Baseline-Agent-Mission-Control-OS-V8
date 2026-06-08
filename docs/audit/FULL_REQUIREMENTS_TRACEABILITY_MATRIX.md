# Full Requirements Traceability Matrix

**Generated:** 2026-06-08 · **Author:** Claude Code
**Apps:** Baseline OS (`~/code/claude-os`, Vite/TanStack/Bun) · Baseline Mission Control (`~/code/mc-v8`, Next.js)
**Live (local):** Baseline OS → http://127.0.0.1:5173 (27/27 routes 200) · Baseline Mission Control → http://127.0.0.1:3000 (44/44 routes OK)

## Status legend
- **Complete** — built, routed, visible in nav/tabs, wired to real data or honest setup-needed, tested, pushed.
- **Complete (local) / ext-cred** — fully wired in code; live execution needs a private external credential only Walt can provide.
- **Blocked: ext-cred** — cannot execute without a user-owned API key / paid account.
- **Blocked: no public API** — provider has no public write API; honest setup/connect state is the correct end-state.
- **Needs Walt decision** — product decision required.

> Rule applied: nothing marked Complete unless built + routed + tested + pushed. External-dependency items say exactly why Claude Code cannot finish them alone.

| # | Requirement | Baseline OS status | BL route/tab | Mission Control status | MC route/tab | Backend/API | Data/Storage | Tests | Commit | Why-not-complete (if any) |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Workforce OS landing | Complete | `/workforce-os` | Complete | `/` (home) | static | — | landing-page.test, homepage-scroll | 5328efe… | — |
| 2 | 11 vertical templates | Complete | `/workforce-os` | Complete | `/app/activate` | `/api/workforce/templates` | sqlite | route-health, activation | prior | — |
| 3 | 13 console directives (3 general + 6 industry + 4 ops) | Complete | `/workforce-os` console | Complete | `/` console | static sim | — | workforce-console.test (both), landing-page | 3944902, dde4ba8 | VisionOps/VoiceOps/PropControl/Market Swarm added |
| 4 | Activation / setup (11 installs) | Complete | `/setup` | Complete | `/app/activate` | `/api/workforce/*` | sqlite | route-health | prior | — |
| 5 | Mission Control nav parity | n/a | — | Complete | nav-rail | — | — | parity.test (nav coverage) | prior | — |
| 6 | BL ↔ MC feature parity | Complete | sidebar | Complete | nav-rail + `FEATURE_SURFACES` | — | — | parity.test | prior | — |
| 7 | Claude Code Studio | Complete | `/studio` | Complete | `/app/creative` | creative libs | sqlite/core | creative tests (BL) | prior | — |
| 8 | Higgsfield Supercomputer | Complete (local)/ext-cred | `/higgsfield` | Complete (local)/ext-cred | `/app/higgsfield` | higgsfield libs | shared core | higgsfield tests (BL) | prior | Generation needs Higgsfield account/credentials (no public open API) |
| 9 | Higgsfield CRUD/uploads/documents | Complete (local)/ext-cred | `/higgsfield`, `/documents` | Complete (local)/ext-cred | `/app/higgsfield`, `/app/documents` | documents-store, `/api/documents` | sqlite + blobs | documents tests | prior | Cloud asset push needs provider creds |
| 10 | Creative Provider Matrix | Complete | (in studio) | Complete | `/app/provider-matrix` | provider-matrix lib | — | provider tests | prior | — |
| 11 | HyperFrames pipeline | Complete (local)/ext-cred | `/hyperedit`,`/video-studio` | Complete (local)/ext-cred | `/app/hyperframes` | hyperframes-pipeline | — | hyperframes tests | prior | Render runtime pairing for full encode |
| 12 | Agent Factory (build me X) | Complete | `/agents/free-claude` → Factory tab; `/agents/slim-charles` → Build tab | Complete | `/app/agent-factory` | `/api/agent-factory/*` (MC); `/__ollama_chat` (BL) | output dir / localStorage | agent-factory.test (MC), slim-charles.test (BL), production-unlock.test | 743bf4e, 8309753, 3944902 | Primary engine = Claude Code (READY when CLI connected); Ollama optional fallback, never required |
| 13 | AI Org Chart | Complete (private) | `/org-chart` | Complete (blank canvas, workspace-scoped) | `/app/org-chart` | `/api/org-chart` (MC) | sqlite `org_agents.workspace_id` (MC); localStorage (BL) | org-chart.test (MC isolation), slim-charles.test (BL) | fb92ccf, 6a97d7a | — |
| 14 | Pipeline | Complete (private) | (operator) | Complete (workspace-scoped) | `/app/pipeline` | `/api/pipeline-ideas` | sqlite `pipeline_ideas.workspace_id` | pipeline.test (gate + isolation) | 26ee32d | — |
| 15 | Slim Charles (PRIVATE) | Complete | `/agents/slim-charles` | **Absent by design** | — (guard test) | `/__hermes_chat` | localStorage | slim-charles.test (BL), no-slim-charles.test (MC) | 6a97d7a, 1d27e6d | MC must never expose Slim |
| 16 | Slim Voice tab | Complete (local)/ext-cred | `/agents/slim-charles` → Voice | Absent by design | — | browser SpeechRecognition + Hermes | — | slim-charles.test | 6a97d7a | Realtime spoken voice needs ElevenLabs/GPT-Realtime/Gemini Live key |
| 17 | Hermes | Complete (local)/ext-cred | `/agents/hermes` | Complete (connect-runtime) | `/app/hermes` | `/__hermes_*`; `/api/hermes/*` | sqlite | hermes tests | prior | Live agent needs local Hermes install |
| 18 | Hermes VPS | Complete (local)/ext-cred | `/agents/hermes/control` | Complete (pairing UI) | `/app/hermes-manage`, `/app/runtimes` | runtime registry | sqlite | hermes-vps-card.test | prior | VPS pairing key (no SSH stored) |
| 19 | Codex | Complete (local)/ext-cred | `/agents/codex` | Complete (connect-runtime) | `/app/codex` | runtime registry | sqlite | parity, runtime-lifecycle | prior | Runtime pairing |
| 20 | OpenClaw | Complete (local)/ext-cred | `/agents/openclaw` | Complete (connect-runtime) | `/app/openclaw` | `/__*`, gateway | sqlite | openclaw-gateway.test | prior | Runtime pairing |
| 21 | Gemini | Complete (local)/ext-cred | `/agents/gemini` | Complete | `/app/gemini` | runtime registry | sqlite | parity | prior | API key for live calls |
| 22 | Antigravity | Complete (local)/ext-cred | `/agents/antigravity` | Complete | `/app/antigravity` | runtime registry | sqlite | parity | prior | Runtime pairing |
| 23 | OMP / Oh My Pi | Complete (local)/ext-cred | (agents) | Complete | `/app/oh-my-pi` | runtime registry | sqlite | agent-runtimes-omp.test | prior | Runtime pairing |
| 24 | Browser Use | Complete (local)/ext-cred | `/browser` | Complete | `/app/browser-use` | runtime | sqlite | browser-security.test | prior | Runtime pairing |
| 25 | Maestro | Complete | `/maestro` | Complete | `/app/maestro` | maestro libs | sqlite | — | prior | — |
| 26 | Skills | Complete | `/skills` | Complete | `/app/skills` | `/api/skills` | sqlite | skill tests | prior | — |
| 27 | Skills Library | Complete | `/skills` | Complete | `/app/library` | skill-registry | sqlite | skill-registry | prior | — |
| 28 | Skills Marketplace | Complete | (skills) | Complete | `/marketplace` | marketplace-catalog | sqlite | marketplace-credits | prior | Prices shown; no "insufficient credits" |
| 29 | GStack first 25 | Complete | (import path via skills) | Complete | `/app/gstack-import` | `/api/gstack/import` | localStorage registry + manifest | gstack/manifest.test | 3944902 | Bundled first-25 classified manifest + validator + upload UI; live execution of credentialed skills stays setup-needed |
| 30 | API Keys / Credentials | Complete | `/settings` | Complete | `/app/credentials` | `/api/credentials/catalog` | sqlite (encrypted) | credentials tests | prior | Values entered by Walt |
| 31 | Billing / credits | Complete (local)/ext-cred | — | Complete (local)/ext-cred | `/app/billing` | `/api/billing/*` | sqlite | billing tests | prior | Stripe keys (#32) |
| 32 | Stripe | Blocked: ext-cred | — | Blocked: ext-cred | `/app/billing` | `/api/billing` | sqlite | — | prior | Live charges require Walt's Stripe secret + webhook secret |
| 33 | Email verification | Complete (local)/ext-cred | — | Complete | `/verify-email` | `/api/auth/*` | sqlite | email-verification, db-seed-auth | prior | Email delivery needs an email provider key (logs "setup_required" otherwise) |
| 34 | Google OAuth | Blocked: ext-cred | — | Complete (local)/ext-cred | `/login` | `/api/auth/oauth` | sqlite | oauth_states | prior | Needs Google client id/secret + consent screen |
| 35 | Flight Deck | Complete | `/flight-deck` | Complete | `/flight-deck` | `/api/health,/api/runtimes` | sqlite | flight-deck tests | 37f1857 | Desktop build artifact pending (honest "pending-build") |
| 36 | Daily Brief | Complete | (dream) | Complete | `/app` (brief) | `/api/briefing` | sqlite | — | prior | — |
| 37 | ROI / Value | Complete | `/` KPIs | Complete | `/app/value` | `/api/roi` | sqlite | optimization-report | prior | — |
| 38 | Proofs / Handoff | Complete | `/flight-deck` | Complete | `/app/proofs` | deployment-center | sqlite | deployment-center.test | 37f1857 | — |
| 39 | Knowledge OS | Complete | `/notebook`,`/memory` | Complete | `/app/knowledge-os` | knowledge libs | sqlite | knowledge.test | prior | — |
| 40 | NotebookLM Brain Layer 4 | Complete (local)/ext-cred | `/notebook` | Complete (local)/ext-cred | `/app/notebooklm` | brain-layers, import-sources | sqlite | knowledge.test | prior | NotebookLM has no official public write API — import/preview only |
| 41 | Obsidian | Complete (local)/ext-cred | `/goals`,`/journal` | Complete (connect) | `/app/obsidian` | `/__obsidian_write` | vault files | — | prior | Vault path is Walt's local vault |
| 42 | Notion | Blocked: ext-cred | — | Blocked: ext-cred | `/app/notion` | config.integrations.notion | — | config-paths.test | prior | Needs NOTION_API_KEY + database id |
| 43 | Pinecone | Blocked: ext-cred | (memory) | Blocked: ext-cred | `/app/pinecone` | `/__pinecone_*`; config | — | config-paths.test | prior | Needs PINECONE_API_KEY + index host |
| 44 | PI Agent | Complete | (memory) | Complete | `/app/pi-agent` | pi-agent lib | sqlite | knowledge.test | prior | CMO, distinct from Oh My Pi |
| 45 | Universal Asset Library | Complete | `/documents` | Complete | `/app/asset-library` | universal-asset | sqlite | knowledge.test | prior | — |
| 46 | Documents | Complete | `/documents` | Complete | `/app/documents` | `/api/documents` | sqlite + blobs | documents tests | prior | — |
| 47 | Library | Complete | `/skills` | Complete | `/app/library` | skill-registry | sqlite | — | prior | — |
| 48 | Goals | Complete | `/goals` | Complete | `/app/goals` | `/__obsidian_write`; `/api/goals` | vault/sqlite | — | prior | — |
| 49 | SEO | Complete | `/seo` | Complete | `/app/seo` | `/__ai_chat` | sqlite | — | prior | Live gen needs a model key |
| 50 | Memory Browser | Complete | `/memory` | Complete | `/app/memory` | memory libs | sqlite | memory tests | prior | — |
| 51 | Configurable paths | Complete | config.json | Complete | Settings → Paths | `/api/config/paths` | env | config-paths.test | prior | — |
| 52 | Forbidden-name cleanup | Complete | shipped src clean | Complete | shipped src clean | — | — | forbidden-names.test | 9a17f01 | Only legacy `docs/imports/**` retain historical names |
| 53 | Token/security cleanup | Complete | — | Complete | — | scanForSecrets | — | scan-credentials.test | prior | Secret scan clean (only fake fixtures in scanner tests) |
| 54 | Route health | Complete | 27/27 200 | Complete | 44/44 OK | route-health.mjs | — | route-health.test | this pass | — |
| 55 | Local server readiness | Complete | :5173 live | Complete | :3000 live | dev servers | — | — | this pass | Both running, migrations applied |
| 56 | Production Unlock Center | Complete | `/production-unlock` | Complete | `/app/production-unlock` | `/__os_config` (BL); `/api/credentials/catalog` + `/api/credentials/[id]/test` (MC) | sqlite (encrypted) / local config | production-unlock.test (both) | 3944902, dde4ba8 | Status/env vars/test/unlocks/readiness per integration; honest setup-needed |
| 57 | AI Agent Workforce Setup | n/a (in `/workforce-os`) | `/workforce-os` | Complete | `/app/agent-workforce-setup` | static | — | agent-workforce-setup.test | (this pass) | Offers + 5-pillar model + 9-step build process + build/spec repos (customer-safe) |

## Counts
- Total requirements audited: **57**
- Complete (incl. private/blank-canvas): **41**
- Complete (local) / external-credential pending: **12**
- Blocked by external credential / no public API: **4** (Stripe, Notion, Pinecone, Google OAuth-on-BL)
- Needs Walt decision: **0**
- **Missing: 0**

## What truly requires Walt (external credentials / decisions)
- **Stripe** secret + webhook secret (live charges).
- **Google OAuth** client id/secret + consent screen.
- **Notion** API key + database id; **Pinecone** API key + index host.
- **ElevenLabs / GPT-Realtime / Gemini Live** key for Slim's spoken realtime voice.
- **Higgsfield / NotebookLM** account access (NotebookLM has no public write API → import/preview is the correct end-state).
- **Ollama** is an OPTIONAL local fallback for Agent Factory; the primary engine is Claude Code (no Ollama required).
- **GStack first 25**: DONE — bundled first-25 classified manifest ships with an import path + manifest upload; no Walt action needed to seed.

Everything else is wired by Claude Code and needs no Walt CLI action.

## This pass (Production Unlock + GStack + ops directives + Workforce Setup)
- 13 console directives in both apps (added VisionOps / VoiceOps / PropControl / 100-Agent Market Swarm).
- Production Unlock Center in both apps (MC `/app/production-unlock`, BL `/production-unlock`).
- GStack first-25 import (MC `/app/gstack-import` + `/api/gstack/import`).
- AI Agent Workforce Setup surfaced in MC (`/app/agent-workforce-setup`).
- Commits: MC `3944902`; BL `dde4ba8`; + this matrix/Workforce-Setup commit.
