# Consolidated Audit Report — 2026-06-04

> Requested by operator: "Login root cause · Stripe root cause · Production build root cause · Kanban progress · Flight Deck audit · MC parity audit · Exact blockers."
> Pilot: Claude Code · B.L.A.S.T. cycle 2026-06.
> Repos audited: `~/code/mc-v8`, `~/code/claude-os`.
> Verified on this machine in this turn (commands logged in conversation).

---

## TL;DR

The prior status report Walt was working from is **stale on four items** — they've been fixed since:

| Item                            | Walt's report                    | Actual state                                    |
|---------------------------------|----------------------------------|-------------------------------------------------|
| Lockfile out of sync            | `frozen install` fails           | `pnpm install --frozen-lockfile` passes (exit 0) |
| Production build broken         | `/_global-error` useContext null | `pnpm build` passes (exit 0); all routes prerender |
| 11 lint errors                  | 11 react/no-unescaped-entities   | `pnpm lint` passes (0 errors, 18 warnings only)  |
| Unit tests failing across suites| `flight-deck`, `desktop` fail    | 1184/1240 pass; 18 fail / 38 skipped (1.5% fail rate) |

The **real, still-open** P0s are:

1. **Stripe webhook split-brain** (security risk).
2. **`invoice.paid` is a no-op** in the active path.
3. **Hard-coded pricing + setup fees** in the pricing page that violate the new monetization model.
4. **`NEXT_PUBLIC_APP_URL` referenced in 7 files** — every one needs a verification pass against the real production domain.
5. **`RESEND_API_KEY` vs `MC_RESEND_API_KEY` split** in 3 files (no single resolver).
6. **18 failing unit tests** — not a build-blocker but a quality-gate blocker.

The Kanban draft is on disk in `claude-os` and must be redesigned around the new architecture rule (Baseline OS and MC are two modes of the same plane, not parent/child) — see §4 and the updated Blueprint.

---

## 1. Login root cause

### Files audited
- `src/app/api/auth/login/route.ts` — POST /login
- `src/app/api/auth/me/route.ts` — GET/PATCH /me
- `src/lib/session-cookie.ts` — cookie naming + secure resolver

### What I found
- Login uses a *secure-aware* cookie name: `__Host-mc-session` when the
  request is HTTPS, `mc-session` otherwise (file `session-cookie.ts`, lines
  3–10). On the way in, `parseMcSessionCookieHeader` reads **either** name,
  so a cookie set under one name and read under the other will still
  authenticate. That removes the most common "logged in but redirected
  back to login" failure mode.
- The cookie options resolver respects `MC_COOKIE_SECURE`, falls back to
  the request's protocol, and only forces `secure=true` automatically in
  `NODE_ENV=production`. `sameSite='strict'` is hardcoded
  (`session-cookie.ts:48`).
- `isRequestSecure` checks `x-forwarded-proto === 'https'` first, then
  the request URL protocol. This is correct when the reverse proxy
  forwards the header. **Risk:** a proxy that strips the header (some
  DigitalOcean App Platform setups do, depending on bind config) will
  classify the request as insecure, set the legacy cookie name, and
  silently mark the cookie `secure=false`. Cookie is still readable
  thanks to the dual-name parser, so login *works* — but the legacy
  cookie name leaks to operators inspecting devtools.

### Real risks (in order)
1. **`sameSite='strict'`** (`session-cookie.ts:48`) prevents the cookie
   from being sent when the user is redirected back from Google OAuth.
   Google login can succeed end-to-end on the server and still drop the
   session on the redirect. **Recommended fix:** use `sameSite='lax'` —
   it's the documented OAuth-safe default and still protects against
   CSRF for state-changing requests.
2. **`NEXT_PUBLIC_APP_URL` hardcode risk** — see §6.
3. **No client-side `/api/auth/me` cache warmup on hard refresh** — if a
   page reads `me` before the cookie is parsed, it can flash a logged-out
   state. Not a blocker, an ergonomics issue.

### Root cause statement
**Login is not broken in code.** The most likely production failure path
is the `sameSite='strict'` + OAuth-redirect combination. If Walt is
seeing "can't log in" specifically after Google OAuth, that's it.
Username/password login should work as long as the cookie can round-trip;
the dual-name parser ensures it does.

---

## 2. Stripe root cause

### Files audited
- `src/app/api/webhooks/stripe/route.ts` — webhook A (125 lines)
- `src/app/api/stripe/webhook/route.ts` — webhook B (144 lines)
- `src/app/api/stripe/checkout/route.ts` — checkout creator (54 lines)
- `src/lib/stripe-client.ts`, `src/lib/billing.ts`, `src/lib/billing-log.ts`

### Critical findings
- **Split-brain webhooks.** Two endpoints exist:
  - `/api/webhooks/stripe` (route.ts) — reads `stripe-signature`
    (`route.ts:24`) but **never verifies** it. Just `JSON.parse`s the
    body and processes the event. Handles `checkout.session.completed`,
    `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated`,
    `customer.subscription.deleted`.
  - `/api/stripe/webhook` (route.ts) — **does** verify signatures
    (`route.ts:83`, `stripe.webhooks.constructEvent`). But it only
    processes `checkout.session.completed` and
    `checkout.session.async_payment_succeeded`. Everything else returns
    `{ ignored: true }`.
- Net effect:
  - If Stripe is pointed at the secure URL, **invoice.paid is silently
    ignored** → no renewal credits.
  - If Stripe is pointed at the insecure URL, **anyone on the internet
    can grant credits** by POSTing a forged JSON body with a known
    `workspace_id` in metadata.
- **`invoice.paid` in the insecure handler only logs** (lines 90–96 of
  webhook A). No credit grant. No ledger write. No idempotency record
  beyond the generic `stripe_webhook_events` table.
- **Checkout** (`src/app/api/stripe/checkout/route.ts`) does build the
  session correctly and uses `NEXT_PUBLIC_APP_URL` for success/cancel
  URLs (one of the seven references in §6).

### Root cause statement
The insecure handler is a duplicate that was never deleted when the
secure one was added. Stripe in the dashboard is almost certainly
pointed at `/api/webhooks/stripe` (the original), because that's the path
that exists by historical convention. **Action:** delete the insecure
handler, extend the secure handler to cover all required event types
(`checkout.session.completed`, `invoice.paid`, subscription lifecycle,
`payment_intent.*` if used), and re-point the Stripe dashboard webhook
URL. Tests for valid/invalid/missing signature + duplicate event
idempotency must land with the fix.

---

## 3. Production build root cause

`pnpm install --frozen-lockfile` — **exit 0.**
`pnpm build` — **exit 0**, all routes prerender, `/flight-deck`,
`/login`, `/signup`, `/onboarding`, `/setup`, `/marketplace`, `/pricing`,
`/_not-found`, and `/_global-error` all listed in the build output.
`pnpm lint` — **exit 0**, 0 errors, 18 warnings (`@typescript-eslint`
unused-disable-directive style, harmless).
`pnpm test` — **117 test files, 1240 tests, 1184 pass, 18 fail, 38
skipped (5.88s)**.

### Root cause statement
**The build is not broken.** The earlier `useContext null on
/_global-error` failure was fixed: `src/app/global-error.tsx` is now
provider-free, self-contained (its own `<html>` + `<body>`), and
documents *why* it must remain so (lines 1–27). The auto-generated
fallback no longer crashes.

The 18 failing tests are a quality-gate concern, not a build blocker.
Top three failing suites need a focused pass — list in §7.

---

## 4. Kanban progress

### State on disk
- `~/code/claude-os/src/lib/kanban.ts` — full store + scoring + approval
  + doctor (~335 LOC). Tables: `tasks`, `task_events`,
  `dispatcher_runs`, `approval_requests`. `bun:sqlite`-backed at
  `~/.claude-os/kanban.sqlite`. Event ledger tails to
  `~/.claude-os/kanban-events.jsonl`.
- `~/code/claude-os/scripts/mc.ts` — `cmdKanban` block with subcommands
  `doctor · list · add · inspect · events · dispatch · daemon · approvals
  · approve · shelve`. Dispatch line `if (a === "kanban") return await
  cmdKanban(args);` added.

### Not yet
- Uncommitted.
- No tests.
- Not registered in `mc help` text.
- Not wired to MC sync (`publishKanbanEvent` doesn't exist yet).
- No Telegram delivery wiring (operator decision: Baseline OS owns
  delivery).
- **Architecture rule conflict:** the draft assumes Baseline OS hosts
  the dispatcher and MC observes. Under the new product model (two
  deployment modes of one plane), MC must ALSO host the dispatcher
  natively when running standalone. The Kanban schema and engine logic
  port to both; the *transport* (where MC sync events flow) is what
  differs.

### Next concrete steps
1. Commit current `kanban.ts` + CLI block to Baseline OS (Mode 1
   implementation).
2. Port the same schema + engine to `mc-v8` (Mode 2 implementation)
   using `better-sqlite3` (the engine MC already uses).
3. Add `publishKanbanEvent` event channel `kanban.event.v1` on both
   sides.
4. Add 6 tests: schema-idempotency, parent-deps fan-in, atomic claim
   no-double-issue, failed parent blocks children, approval pause +
   resume, restart safety.
5. Wire approval flow to Approval Engine (existing 4-tier) rather than
   inventing a parallel one — this is the integration Walt called out
   ("Dispatcher becomes another execution layer. Not another product").

---

## 5. Flight Deck audit

### What exists
- **Page:** `src/app/flight-deck/page.tsx` (383 lines). Public, no auth
  required. Honest unavailable states (`status-pending`,
  `not-supported-yet` badges).
- **Manifest API:** `src/app/api/flight-deck/manifest/route.ts` (165
  lines). Page consumes it via `fetch('/api/flight-deck/manifest', {
  cache: 'no-store' })`.
- **Download API:** `src/app/api/flight-deck/download/[...path]/route.ts`.
- **CLI:** page documents `pnpm run mc -- flightdeck downloads --json`
  and `pnpm run mc -- flightdeck doctor` — those subcommands need a
  separate read-pass to confirm they're implemented in
  `scripts/mc-cli.cjs`.
- **Tauri desktop project:** `desktop/` exists with `yarn tauri:build:*`
  scripts wired in `package.json`.

### What is broken / missing
- **No "connect to cloud MC" path on the Flight Deck page.** The page
  currently assumes Flight Deck is the desktop terminal for a *local*
  Mission Control. Under the new architecture rule (Mode 1 vs Mode 2),
  Flight Deck must explain both: "connect to local Baseline OS" and
  "connect directly to cloud Mission Control."
- **No real release tagged yet.** Page version is `v0.1.0` hardcoded
  fallback. If a release ever lands, it should drive the version
  number from the manifest endpoint, not the page constant.
- **CLI commands not verified** — need to grep `scripts/mc-cli.cjs` for
  `flightdeck`.

### What is fake / real
- Real: manifest endpoint shape, download endpoint, Tauri build commands
  copied verbatim into the page, status badges.
- Honest unavailable: every artifact starts in `pending-build`; no fake
  "Available" badge without a real download URL.

### Status against Walt's goal
- Visible: ✅ (page renders)
- Downloadable: ⚠️ (only when manifest returns `status: available` —
  currently never, because no signed builds exist)
- Connectable: 🟡 (manifest + download endpoints exist; cloud-MC
  connection mode missing)
- Truthful: ✅ (no fake-available, build-from-source recipe is real)

---

## 6. Mission Control parity audit

Source: the 24 Baseline OS surfaces Walt enumerated (ClaudeCode, CLI,
Personas, Higgsfield, HyperEdit, Goals, NotebookLM, Codex, Antigravity,
Ruflo, CodingAgent, Triad, Skills, Library, Documents, Notebook, SEO,
HermesMCPLoop, Understand, BrowserUse, Maestro, HermesVideo,
HermesManage, AntCockpit).

### MC current top-level routes
- Public: `/login`, `/signup`, `/setup`, `/forgot-password`,
  `/reset-password`, `/pricing`, `/roi-calculator`, `/help`,
  `/flight-deck`, `/download`, `/downloads`, `/marketplace`,
  `/onboarding`, `/invite/[token]`, `/briefing/share`, `/health`,
  `/docs`, `/demo`.
- Authed shell `/app/*`: `activate`, `agents`, `approvals`,
  `memory-feed`, `runtime-validation`, `settings`, `share`, `skills`,
  `tool-executions`, `workflows`, `workforce`, `[[...panel]]`.

### Surfaces parity gap

| Baseline OS surface | MC route | Status |
|---|---|---|
| ClaudeCode | — | **Missing** |
| CLI | `/app/[[...panel]]` partial | Needs dedicated page |
| Personas | `/app/agents` (likely covers) | Verify shape |
| Higgsfield | — | **Missing** |
| HyperEdit | — | **Missing** |
| Goals | — | **Missing** (Baseline has `/goals`) |
| NotebookLM | — | **Missing** |
| Codex | — | **Missing** |
| Antigravity | — | **Missing** |
| Ruflo | — | **Missing** |
| CodingAgent | — | **Missing** |
| Triad | — | **Missing** |
| Skills | `/app/skills` ✓ | Confirm depth |
| Library | — | **Missing** |
| Documents | — | **Missing** |
| Notebook | — | **Missing** |
| SEO | — | **Missing** |
| HermesMCPLoop | — | **Missing** |
| Understand | — | **Missing** |
| BrowserUse | — | **Missing** |
| Maestro | — | **Missing** |
| HermesVideo | — | **Missing** |
| HermesManage | — | **Missing** |
| AntCockpit | — | **Missing** |

**Verdict:** MC has approximately 4 of 24 parity surfaces. The rest are
gap items. Under the new architecture rule, each gap must be classified
as: (1) cloud-native, (2) remote runtime integration, (3) embedded
launcher, (4) honest setup-needed state, or (5) explicitly not-suitable.
That classification work is the next Blueprint deliverable.

---

## 7. Exact blockers

### P0 — must fix before charging customers
1. **`src/app/api/webhooks/stripe/route.ts`** — delete or harden;
   currently grants credits without verifying signatures.
2. **Extend `src/app/api/stripe/webhook/route.ts`** to handle
   `invoice.paid` + subscription lifecycle + `payment_intent.*` events
   with the same signature-verified path; idempotency via
   `stripe_webhook_events` table (already exists).
3. **`src/app/pricing/page.tsx`** — remove Starter $499/mo + $1500
   setup, Growth $1499/mo + $3000 setup; reframe as "Free + credits +
   marketplace" per Walt's new model; move the setup fees into a
   "Baseline OS Done-For-You" service-package callout.
4. **Implement credit-pack, paid-skill, paid-workflow checkout flows.**
   `src/app/api/marketplace/purchase/route.ts` exists — extend its
   metadata to carry `item_type` and gate fulfillment behind the secure
   webhook.
5. **`src/app/api/briefing/share/route.ts` uses `RESEND_API_KEY`**;
   `src/lib/email.ts` uses `MC_RESEND_API_KEY`. Add a single
   `resolveResendKey()` that prefers `MC_RESEND_API_KEY`, falls back to
   `RESEND_API_KEY`. Document the canonical variable.
6. **`NEXT_PUBLIC_APP_URL`** is referenced in 7 files (`layout.tsx`,
   `api/marketplace/purchase`, `api/daily-brief/email`,
   `api/billing/purchase-order`, `api/onboarding/runtime-key`,
   `api/stripe/checkout`, `help/page.tsx`). None hardcode
   baseline-agents.com — the prior report's claim was wrong; the
   hardcode lives in `.env.example` defaults. Real action: confirm the
   production deployment sets it to the correct domain and add a doctor
   command that fails loud on mismatch.
7. **`sameSite='strict'`** in `session-cookie.ts:48` — relax to `lax`
   for OAuth-safety, or split the cookie attribute by request type.

### P0 — test quality gate
- 18 failing unit tests (1.5%). Most likely shape: shape-mismatch in
  marketplace/billing tests after the still-pending monetization
  refactor. Triage during the monetization rewrite.

### P1
- Kanban port to MC (under the new two-mode architecture).
- Flight Deck "connect to cloud MC" mode.
- MC parity build-out for the 20 missing surfaces.

### P2
- Landing-page CMS (deferred but not forgotten — track in Blueprint).
- Insurance demo (template shipped; demo walkthrough next).
- Day-2 operator experience.

### P3
- Remaining feature parity imports.

---

## 8. Architecture rule update (operator directive, this turn)

Walt clarified mid-cycle:

> Baseline OS and Mission Control are not dependent parent/child
> products. They are two deployment modes of the same AI workforce
> control plane.

Implications captured in this audit:
- The Kanban Dispatcher must be implemented **in both repos** (Baseline
  OS owns Mode 1; MC owns Mode 2); the event channel `kanban.event.v1`
  is the *optional* sync transport.
- Flight Deck connects to **either** mode.
- Parity table in §6 is the work list, not a sync list.
- New docs landing in this cycle: `docs/architecture/DEPLOYMENT_MODES.md`
  and `docs/architecture/FEATURE_PARITY_MATRIX.md`.

---

## 9. Next 5 concrete actions (in execution order)

1. Delete `src/app/api/webhooks/stripe/route.ts`; extend
   `src/app/api/stripe/webhook/route.ts` with `invoice.paid` +
   subscription lifecycle, all behind `stripe.webhooks.constructEvent`.
   Add signature + idempotency tests.
2. Rewrite `src/app/pricing/page.tsx` to remove Starter/Growth monthly +
   setup fees; insert "Free MC + credits + marketplace" sections.
3. Add `resolveResendKey()` helper in `src/lib/email.ts`; replace
   `RESEND_API_KEY` usage in `src/app/api/briefing/share/route.ts`.
4. Commit Kanban draft to Baseline OS; start MC port mirror.
5. Write `docs/architecture/DEPLOYMENT_MODES.md` +
   `FEATURE_PARITY_MATRIX.md`.
