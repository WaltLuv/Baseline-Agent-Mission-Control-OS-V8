# Mission Control — Changelog

Append-only log of significant deliveries. PRD.md holds the durable product spec; this file holds the timeline.

---

## 2026-05-30 (PM #5) · Flight Deck production-test readiness

**Goal:** A user can pick Mission Control's deployment target (Emergent / DigitalOcean / Staging / Localhost / Custom), persist it across restarts, see real runtime status, and reset their session — without any background polling. Plus a public download page, a CI build matrix, full docs.

**Desktop shell (`/app/desktop/`):**
- `src/allowlist.js` — Replaced two-preset list with four named presets (`emergent`, `digitalocean`, `staging`, `localhost`) plus `MODE_LABELS`. `ALLOWED_HOSTS` now permits `*.emergent.host`, `*.emergentagent.com`, `*.preview.emergentagent.com`, `baseline-agents.com` (and subdomains), legacy `baselineautomations.com`, plus loopback. Wildcard prefix `*.` supported in `hostMatches()`. `activeUrl()` returns `''` for empty presets (instead of silently falling back) so the UI can prompt for a Custom URL.
- `index.html` — Picker for the four presets with hosts surfaced beneath each label, Custom URL field with allowlist hint, runtime status panel (Hermes · OpenClaw/OpenCode · Claude Code · Codex) with a **manual Refresh button**, **Reset Session** button (clears local target settings + posts `/api/auth/logout`), version footer.
- `src/main.js` — Auto-polling **removed**. Status refresh happens only on: initial load, target change, manual Refresh, manual Test Connection. `fetchRuntimeStatus()` reads both filesystem-detected `runtimes[]` (local install) and DB-registered `registered[]` (remote handshake), and reports `connected`/`stale`/`disconnected`/`not connected`/`login required` per row.
- `src-tauri/tauri.conf.json` — CSP extended to include `*.emergent.host` and `*.emergentagent.com` in `connect-src` / `frame-src` / `img-src`.

**Public download page (`/app/src/app/flight-deck/page.tsx` + `/download` redirect):**
- Honest amber "Installer build pending — use local build instructions" banner while `releaseStatus === 'pending-build'`.
- Three platform cards (macOS / Windows / Linux) each with status badge, expected artifact name, and a copy-to-clipboard build command. **No Download buttons appear** because no binaries exist yet — JSX guard requires `p.status === 'available' && releaseUrl`, both false.
- Full build-from-source recipe (Rust prereqs per OS, clone+install+run in two terminals, installer build).
- GitHub Actions tagging instructions.
- "What Flight Deck does" outcome list — including "Never bundles credentials", "Does not auto-refresh", "Allowlisted hosts only".
- Added `/flight-deck` and `/download` to the public-path allowlist in `src/proxy.ts` (previously they 307-redirected to `/login`).

**Cross-platform CI (`/app/.github/workflows/flight-deck-release.yml`):**
- Matrix builds: macOS-arm64, macOS-x64, Windows-x64, Linux-x64.
- Triggered by `flight-deck-v*` tag or `workflow_dispatch`.
- Rust + Node setup, Cargo cache, Tauri build per `--target`.
- Apple + Windows signing secrets are optional — workflow produces unsigned dev builds if secrets are absent.
- Release stage downloads all artifacts and publishes them to a GitHub Release with honest "unsigned development build" release notes.

**Docs:**
- `desktop/README.md` rewritten — full prereq + run-locally + build + sign + troubleshooting table.
- Root `README.md` quickstart section adds the "Run the Flight Deck desktop terminal alongside it" two-terminal recipe and a pointer to the local check script.

**Local check script (`/app/scripts/local-flight-deck-check.mjs`):**
- Probes `/`, `/api/status?action=health`, `/api/agent-runtimes`, `/login` against `http://localhost:3000` (port + URL overridable).
- Exits 0 on green; exits 1 with concrete remediation when MC is unreachable; treats `/api/agent-runtimes` 401 as the expected "session required, click Refresh after sign-in" hint.

**Tests:**
- `desktop/__tests__/allowlist.test.js` — rewritten to cover all 4 presets, wildcard host matching, custom URL precedence, loopback rule, malformed input rejection.
- `desktop/__tests__/runtime-status.test.js` — covers active URL resolution, empty `emergent` preset, custom URL override, navigation blocking, full host allowlist.
- `src/app/flight-deck/__tests__/page.test.ts` — pins the honest contract: `releaseStatus='pending-build'`, `releaseUrl=null`, banner test id present, all 3 platform cards, JSX guard requires both `status === 'available'` AND `releaseUrl` before rendering a Download anchor.

**Quality gates after this pass:**
- `tsc --noEmit` — clean
- `vitest run` — **1254 / 1254 pass** (was 1241; +13 new desktop + flight-deck tests)
- `next build` — clean
- Live probe: `/flight-deck` → 200, `/download` → 307 → `/flight-deck` → 200
- Screenshot proof captured: hero, platform cards, build instructions, CI section, "What Flight Deck does", CTA — every section renders, no broken Download buttons, banner is honest about CI status.

---



**P0a — Hero copy reverts (per user):**
- Hero pill: `Business Systems, Installed` → `AI Workforce OS`
- Final CTA H2: `Ready to stop chasing work and start finishing it?` → `Ready to deploy your first AI employee?`
- All other outcome-first messaging (Problem section, Solution section, How-it-works "Install / Automate / Monitor", outcome-led features, verticals, testimonial, pricing copy) **preserved**.

**P0b — Google Auth `[GSI_LOGGER]: Check credential status returns invalid response`:**

Root-caused into TWO distinct issues:

1. **CSP violation (code fix):** Console showed `Loading the stylesheet 'https://accounts.google.com/gsi/style' violates "style-src-elem 'self' 'unsafe-inline'"`. The CSP builder (`src/lib/csp.ts`) allowed `accounts.google.com` in `script-src` and `frame-src` only — missing from `style-src` / `style-src-elem` / `connect-src` / `img-src`-for-avatars. GSI cannot render its credential picker UI without all of those.

   **Fix:** rewrote `buildMissionControlCsp` to grant the full GSI surface when `googleEnabled=true`:
   - `script-src` → adds `https://accounts.google.com https://apis.google.com`
   - `style-src` + `style-src-elem` → adds `https://accounts.google.com`
   - `connect-src` → adds `https://accounts.google.com https://oauth2.googleapis.com`
   - `frame-src` → adds `https://accounts.google.com https://content.googleapis.com`
   - `img-src` → adds `https://*.googleusercontent.com https://lh3.googleusercontent.com`

   Browser re-verification: the stylesheet CSP violation is gone; GSI button renders cleanly. New regression tests in `src/lib/__tests__/csp.test.ts` pin every Google surface and assert nothing leaks when `googleEnabled=false`.

2. **Missing origin in Google Cloud Console (operator action):** Google's credential-status endpoint replies "invalid" for any origin not in the OAuth client's Authorized JavaScript origins. The Emergent preview URL `https://e3fc518c-…preview.emergentagent.com` was never added (only `mission.baselineautomations.com` was, and that domain isn't owned by us). Updated `docs/operations/LAUNCH_OPERATOR_PACKAGE.md §C.1` with the current preview URL + a warning that this error has no code-side fix and disappears the moment the origin lands in GCP.

**P1 — Host hardening runbook (new §I in `LAUNCH_OPERATOR_PACKAGE.md`):**

Added a complete §I "Host hardening" section covering:
- I.1 — Non-root container user (already in `Dockerfile.hardened` line 92 — `USER nextjs` UID 1001 — documented with verification command)
- I.2 — NTP (`timedatectl set-ntp true` + verification)
- I.3 — UFW firewall (allow OpenSSH, 80, 443, then enable)
- I.4 — Unattended-upgrades for Debian/Ubuntu and dnf-automatic for RHEL/Fedora
- I.5 — fail2ban (SSH brute-force lockout)
- I.6 — `/tmp` hardening with `noexec,nosuid,nodev` in `/etc/fstab`
- I.7 — AppArmor (Ubuntu/Debian) or SELinux (RHEL/Fedora) confirmation
- I.8 — Core-dump suppression (`kernel.core_pattern = |/bin/false`) persisted via `/etc/sysctl.d`
- I.9 — Optional LUKS encryption of the data volume
- I.10 — 8-step verification checklist

Explicit note at top of §I: if the operator uses **DigitalOcean App Platform** (the recommended path), DO manages all of this; this section only applies to raw droplet deployments.

**Verification:**
- `tsc --noEmit` — clean
- `vitest run` — **1241 / 1241 pass** (was 1239; +2 new CSP regression tests)
- Browser re-test on `/login`: GSI script loaded, `window.google.accounts` present, Sign-in-with-Google button rendered, stylesheet CSP violation **gone**. Remaining `inline script violates CSP` is a `next dev` HMR injection — not present in production builds and unrelated to GSI.

---

## 2026-05-30 (PM #3) · Homepage positioning rewrite + Stripe Connect clarification

**1. Stripe Connect blocker resolved (without writing code):**
Walter was being prompted in the Stripe Dashboard to choose Platform / Marketplace / Connect Express / Custom. Confirmed Mission Control needs **Stripe Billing + Checkout only**. No Connect, no platform/marketplace, no application fees, no seller onboarding. Mission Control sells subscriptions + credit packs directly to its own customers. The sample-code zip the user downloaded was Connect-specific and is being ignored.

**2. Homepage positioning rewrite — outcomes first, AI as engine.**
Spec from user: lead with outcomes, technology second. Rewrote `/app/src/app/page.tsx` end-to-end:

| Section | Before | After |
|---|---|---|
| Hero pill | "AI Workforce OS" | "Business Systems, Installed" |
| Hero H1 | "Hire AI Employees. Install AI Skills. Operate Your Business." | "We install systems into your business so work gets done faster, more consistently, and at a lower cost." |
| Hero sub | "Businesses use AI Workforce OS to deploy AI employees, automate workflows, supervise operations…" | "Powered by automation, workflows, AI employees, and operational systems managed through Baseline OS." |
| Primary CTA | "Book a Demo" | "See How It Works" |
| Secondary CTA | "View Pricing" | "Start Free" |
| Nav | Features · How It Works · Pricing | The Problem · How It Works · What You Get · Pricing |
| NEW section | — | **Problem:** "Most businesses lose money because work falls through the cracks." + 5 concrete pain examples (leads, invoices, approvals, communication, repetitive work) |
| NEW section | — | **Solution:** "We install systems that make sure the right work gets done at the right time." |
| How It Works | "Configure · Deploy · Supervise" (technology framing) | "Install Systems · Automate Work · Monitor Results" (outcome framing) + "Under the hood" callout that introduces AI employees / skills / teams / workflows / Baseline OS *after* the value is understood |
| Features | "Deploy AI Agents · Supervise Workflows · Track Costs · Quality Gates · Multi-Tenant Workspaces · Security Scanning" | "Work that doesn't fall through the cracks · Consistent execution every day · Visibility into who did what · Approval before anything risky · Costs you can actually see · Separate workspaces for each part of the business" |
| Verticals heading | (just a trust strip below hero) | "Built for Businesses That Depend on Execution" — full section, dedicated heading + the 9-vertical strip |
| Testimonial | "Baseline Automations turned our reactive workflows into a proactive AI-driven workforce…" | "Baseline Automations helped us install systems that eliminated bottlenecks, improved accountability, and gave our team back over 20+ hours per week…" |
| Metrics | 20+ / 3.2× / 40% | **Preserved unchanged** |
| Pricing sub | "Start free. Upgrade as your AI workforce grows…" | "Start with the systems you need today and expand as your operation grows." |
| Pricing card copy | "1 AI Agent · Up to 10 Agents · Unlimited Agents" | "1 automated workflow · Up to 10 active workflows · Unlimited workflows · Per-location workspaces" |
| Final CTA | "Ready to deploy your first AI employee?" | "Ready to stop chasing work and start finishing it?" |

AI / agent / runtime / orchestration terminology is fully removed from the first impression and reintroduced only in the "Under the hood" callout in §How It Works (one paragraph, deeper in the page).

**Verification:**
- Hero H1 confirmed via DOM read: `"We install systems into your business so work gets done faster, more consistently, and at a lower cost."`
- 5 problem items, 3 how-steps (Install / Automate / Monitor), 9 verticals, 3 pricing cards, 3 metrics all present and rendering.
- bodyHeight = 5294px > viewport, scrollY reaches 4214 after scrollTo(bottom) — page scrolls cleanly.
- Scroll regression test still passes (root layout fix from PM #2 preserved).
- `tsc --noEmit` clean, `eslint` clean (one pre-existing `<img>` warning), `vitest run` **1239 / 1239**, `next build` clean.

---

## 2026-05-30 (PM #2) · P0 FIX — homepage scroll trap

**Root cause:** root layout `/app/src/app/layout.tsx` line 122 wrapped every page in `<div className="h-screen overflow-hidden">`. That made sense for the authenticated dashboard (a fixed-viewport split-pane workstation) but trapped scroll for every public route — homepage, `/login`, `/signup`, `/marketplace`, `/pricing`, etc., all of which use `min-h-screen` and expect to scroll. Mouse wheel, trackpad, and mobile touch all dead. Body height clipped to 100vh; content below the fold hidden entirely.

**Fix (root-cause, not patched):**
- `/app/src/app/layout.tsx` — removed `h-screen overflow-hidden`. Root wrapper now `<div className="bg-background text-foreground">`.
- `/app/src/app/app/layout.tsx` — NEW. Re-applies `h-screen overflow-hidden` only to the authenticated `/app/*` segment.

**Proof:**

| Metric | Before | After |
|---|---|---|
| `document.body.scrollHeight` (home) | 1080 (= viewport, trapped) | 3923 |
| `scrollY` after `scrollTo(bottom)` | 0 (frozen) | 2843 |
| Mobile (390×844) bottom scrollY | 0 | 2843 |
| Footer DOM visible | No | Yes — "© 2026 Baseline Automations" |
| Main-frame navigations in 3-min observation | (n/a) | 0 (zero auto-refresh) |
| Body height variation in 3-min observation | (n/a) | 0 (stable 3923) |

**Regression test added:** `src/app/__tests__/homepage-scroll.test.ts` — 3 assertions guarding the layout shape, runs in the standard vitest suite.

**Quality gates after fix:**
- `tsc --noEmit` — 0 errors
- `eslint .` — 0 errors
- `vitest run` — **1239 / 1239 pass** (was 1236; +3 regression tests)
- `next build` — clean

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
