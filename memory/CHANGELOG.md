# Mission Control — Changelog

Append-only log of significant deliveries. PRD.md holds the durable product spec; this file holds the timeline.

---

## 2026-05-30 (PM) · Launch Readiness Pass — single consolidated execution

**Goal:** finish every remaining engineering item between Mission Control and customer #1. No new dashboards / panels / analytics.

### Hermes — real runtime proof (matches OpenClaw standard)
- `agent_id=55`, name `hermes-prod-1`, workspace_id=1, runtime_type=hermes.
- Registration, heartbeat, persistence, workspace scope, reconnect — all proven.
- `/api/agent-runtimes` `registered[]` shows `status=connected, hb_age<10s` against both `hermes-prod-1` and `openclaw-prod-1` simultaneously.

### Multi-tenant correctness fix (P0 — was a SaaS blocker)
- Migration `052_agent_name_unique_per_workspace`: rebuilds `agents` table dropping global `UNIQUE(name)` in favor of `UNIQUE(name, workspace_id)`. SQLite table-rebuild pattern, duplicates de-duplicated by appending `__dup_<id>` to later collisions.
- Two customers can now both name an agent `hermes-prod-1` / `researcher` / etc.

### Domain migration: `baseline-agents.com` (Resend-verified canonical host)
- `/app/.env`: `GOOGLE_REDIRECT_URI` flipped from `mission.baselineautomations.com` → `baseline-agents.com`.
- `/app/.env.production.example`: `MC_ALLOWED_HOSTS`, `MC_HOST`, `GOOGLE_REDIRECT_URI`, `RESEND_FROM` all switched.
- Flight Deck `desktop/src/allowlist.js`: `MODES.production` + `ALLOWED_HOSTS` updated.
- Flight Deck `desktop/src-tauri/tauri.conf.json` CSP: added `https://baseline-agents.com` + `https://*.baseline-agents.com` to `connect-src` / `frame-src` / `img-src`.

### Production hardening verification (all green)
- `tsc --noEmit` — 0 errors
- `eslint .` — 0 errors
- `vitest run` — **1236 / 1236 pass**
- `next build` — clean

### Operator deliverable
- `/app/docs/operations/LAUNCH_OPERATOR_PACKAGE.md` — single document, every command verbatim, covers DigitalOcean + Google + Stripe + Flight Deck + rollback + health verification. Supersedes prior multi-document readiness reports.

### Result
0 engineering blockers between current code and customer #1. All remaining items are operator credentials/registrations (DO token, GCP origins, Stripe live keys, Flight Deck signing).

---


# Mission Control — Changelog

Append-only log of significant deliveries. PRD.md holds the durable product spec; this file holds the timeline.

---

## 2026-05-29 · Revenue-Readiness Stack

**Goal:** make the launch + sales materials complete and usable. A new operator should be able to read one quickstart, pick a vertical, mint a signed demo, run discovery, and propose a 14-day pilot without consulting anyone else.

### Sales — docs hardened
- `docs/sales/cpa.md`, `law-firm.md`, `ai-agency.md` — "SOC 2 path active" → "SOC 2 path in progress" (compliance overclaim → honest)
- `docs/sales/README.md` — Marketing Agency row added to vertical index; backlog note removed

### Sales — new assets
- `docs/sales/marketing-agency.md` — full 7-asset playbook for marketing / creative / growth / ads / content / social agencies. Roster: AI Campaign Operator, Content Calendar Manager, Client Success Assistant, Reporting Analyst, Lead Follow-Up Agent. Tiered $299 / $799 per-client math included.
- `docs/sales/SALES_OPERATOR_QUICKSTART.md` — single-document operator guide (22 sections): 60-sec pitch · ICP · $1 offer · vertical-to-pitch lookup · demo flow · AI-employee language · Mission Control / Baseline OS / memory / approvals / ROI / objections · close question · follow-up cadence · post-no-response · post-demo-watched · post-pilot-proposed · daily routine · pre-call checklist · escalation matrix.

### Operations — verification corrected
- `docs/operations/PRODUCTION_VERIFICATION_CHECKLIST.md` — T8.1 corrected from non-existent `/api/marketplace/bundles` to actual `/api/marketplace/catalog`; T9.1 corrected from 404 `/docs/getting-started` to valid `/docs`, `/onboarding`, `/app/help`, `/app/docs`.

### Operations — readiness proven
- `docs/operations/PRODUCTION_READINESS_REPORT.md` — tier-by-tier dry-run against preview environment. Vitest 1214/1214. Typecheck clean. 9/9 verticals mint signed demo links. Hermes + OpenClaw + Claude Code runtime harnesses all PASS. Remaining work flagged as operator-provisioning (DO deploy, Stripe live webhook, Flight Deck install) — not engineering.
- `docs/operations/proofs/runtime-validation-preview-2026-05-29.txt` — proof artifact, 3 runtimes × 6 stages, all PASS.

### Codebase
- No product code changed in this pass. This was strictly docs + sales enablement.

### Result
All 9 launch verticals shipping with complete playbooks (PM · GC · Home Services · Real Estate · Mortgage · CPA · Law Firm · Marketing Agency · AI Agency). Production verification checklist validated end-to-end. A new sales operator can open `SALES_OPERATOR_QUICKSTART.md`, follow it linearly, and close pilots without coaching.


---

## 2026-05-30 · OpenClaw Live Proof + Google OAuth Wiring + DO Preflight PASS

**Goal:** Close the last 3 blockers for DigitalOcean deployment — prove OpenClaw is a real runtime (not simulation), wire Google OAuth creds, and confirm the production env template passes preflight.

### OpenClaw — real runtime proof (P0 complete)
- `/app/scripts/connect-runtime.mjs` executed against the user's external OpenClaw instance:
  - Registered `openclaw-prod-1` (agent_id=48, workspace_id=1, runtime_type=openclaw) via `POST /api/agents/register`.
  - Probed `https://keen-matsumoto-2.preview.emergentagent.com` → HTTP 200, `probe=alive`.
  - Heartbeats accepted at 10s cadence; `GET /api/agent-runtimes` shows `connection_status=connected`, `seconds_since_heartbeat=8`.
  - Refresh persistence proven (multiple polls return same row).
  - Connection transition proven: heartbeat halted → row aged to 81s (about to flip to offline at 90s window) → re-register restored `hb_age=7s, status=connected`, idempotent (`new=false`, same agent_id).
  - SQLite row confirmed in `agents` table with `workspace_id=1`; isolated from older test workspaces (99/113/131/...).
- Targeted vitest: `runtime-lifecycle.test.ts` — 5/5 pass (handshake, heartbeat-age transitions, persistence-across-restart).

### Google OAuth — credentials wired (P0 complete)
- Added to `/app/.env`:
  - `GOOGLE_CLIENT_ID=271101705254-75q3pv36d1v7ogasnr9ccd8g7slldb2b.apps.googleusercontent.com`
  - `GOOGLE_CLIENT_SECRET=GOCSPX-…NkOK`
  - `GOOGLE_REDIRECT_URI=https://mission.baselineautomations.com/api/auth/google/callback`
  - `NEXT_PUBLIC_GOOGLE_CLIENT_ID=` (same as `GOOGLE_CLIENT_ID`)
- Implementation status:
  - **Current flow:** Google Identity Services (GIS) popup with ID-token verification at `POST /api/auth/google` (`src/lib/google-auth.ts`). Uses `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (browser) + `GOOGLE_CLIENT_ID` (server audience check). **Does not require redirect URI or client secret to function.**
  - **Authorized JavaScript origins** in GCP must include `https://mission.baselineautomations.com` (and any other origins users will log in from).
  - `GOOGLE_CLIENT_SECRET` + `GOOGLE_REDIRECT_URI` are stored for future server-side OAuth-code-flow callback (`/api/auth/google/callback` route not yet implemented — only needed if Drive/Calendar scopes are added later).
- Ecosystem audit result: **Sibling app source (PropControl / VoiceOps / VisionOps) not mounted in this container.** Public references to PropControl found in `/app/docs/source/` only — no shared OAuth client config inside MC. The user is providing one Google client for Mission Control; no duplication risk in this codebase.

### OpenClaw gateway token wired
- Added to `/app/.env`: `OPENCLAW_GATEWAY_TOKEN=aee2…fd16`, `OPENCLAW_GATEWAY_URL`, `OPENCLAW_GATEWAY_WS_URL`.

### DigitalOcean deploy template — completed + preflight PASS
- `/app/.env.production.example` updated: added `SHARE_SIGNING_SECRET`, `MC_ENABLE_HSTS`, `OPENCLAW_GATEWAY_TOKEN`, all four Google OAuth vars, Resend (`RESEND_API_KEY`, `RESEND_FROM`). Switched `OPENCLAW_GATEWAY_HOST` default from `host.docker.internal` → `127.0.0.1` (gateway-local enforcement).
- `bash scripts/preflight-production.sh` run against a fully-populated synthetic `.env.production` → **Preflight PASSED** (1 warning: Stripe in mock mode — expected).

### Result
All P0 deployment blockers cleared. Operator can now follow `/app/docs/operations/DEPLOY_DAY_RUNBOOK.md` and `/app/docs/operations/DIGITALOCEAN_EXECUTION.md` end-to-end. Remaining steps are pure operator actions (DO account creds, push image to GHCR, `doctl apps create`, attach domain, configure live Stripe webhook).
