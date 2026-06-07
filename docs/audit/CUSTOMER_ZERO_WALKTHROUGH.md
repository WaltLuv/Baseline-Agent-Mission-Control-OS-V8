# Customer Zero — real-UI end-to-end walkthrough

> Ran 2026-06-06 against a fresh, empty database with a real Chromium browser
> driving the actual rendered UI (Playwright, not unit tests). A brand-new
> customer ("Casey Zero") signed up and went all the way to a 100% activated
> workspace. Every step captured a screenshot.
>
> Harness: `scripts/customer-zero-walkthrough.mjs`
> Screenshots + machine ledger: `docs/audit/customer-zero/` (`ledger.json`)
> Server: production standalone build, fresh `MISSION_CONTROL_DATA_DIR`,
> `CREDENTIALS_ENCRYPTION_KEY` set (as a real deployment requires).

## Result

**17 functional steps PASS · 0 FAIL · 0 PARTIAL · 5 INFO (external-dependency).**
**Final setup completion: 100%.**

The 100% is real, not asserted from a unit test — it is the same
`/api/help/checklist` value the overview bar renders, and it is backed by
actual rows written through the UI:

| Predicate | DB proof after walkthrough |
|-----------|----------------------------|
| users | 2 (seeded admin + Casey Zero) |
| workforce-template agents (`source LIKE 'workforce-template:%'`) | 6 |
| tasks | 13 |
| runtime_registry (a runtime connected) | 1 |
| workspace_credentials with secret_preview | 1 |

## Routes tested + proof

| # | Step | Route | Status | Screenshot |
|---|------|-------|--------|------------|
| 1 | New signup | `/signup` → `/onboarding` | ✅ PASS | `01-signup-filled.png` |
| 2 | Email verification | n/a | ℹ️ INFO | — |
| 3 | First login (cold, cookies cleared) | `/login` → `/app` | ✅ PASS | `02-login-page.png` |
| 4 | Choose template | `/onboarding` (9 verticals) | ✅ PASS | `03-onboarding-templates.png` |
| 5 | Workforce deployment | `/onboarding` launch | ✅ PASS | `04`, `05-onboarding-deployed.png` |
| 6 | Activation Hub | `/app/activate` | ✅ PASS | `06-activation-hub.png` |
| 7 | Workforce Templates (install) | `/app/activate` | ✅ PASS | `07-workforce-installed.png` |
| 8 | Connect runtime (+ host handshake) | `/app/activate` + `POST /api/runtime/handshake` (HTTP 200) | ✅ PASS | `08-runtime-connect.png` |
| 9 | Credentials + API key setup (BYOK) | `/app/credentials` | ✅ PASS | `09`,`10`,`11-credentials-saved.png` |
| 10 | Runtimes page | `/app/runtimes` | ✅ PASS | `12-runtimes-page.png` |
| 11 | Hermes VPS pairing | `/app/runtimes` | ℹ️ INFO | `12-runtimes-page.png` |
| 12 | Billing history | `/app/billing` | ✅ PASS | `13-billing-page.png` |
| 13 | Credit purchase | `/app/billing` | ℹ️ INFO | `13-billing-page.png` |
| 14 | Marketplace | `/marketplace` | ✅ PASS | `14-marketplace-page.png` |
| 15 | Marketplace purchase | `/marketplace` | ℹ️ INFO | `14-marketplace-page.png` |
| 16 | Flight Deck | `/flight-deck` | ✅ PASS | `15-flight-deck.png` |
| 17 | Overview | `/app` | ✅ PASS | `16-overview.png` |
| 18 | Daily Brief | `/app` | ✅ PASS | `16-overview.png` |
| 19 | ROI / Value | `/app/value` | ✅ PASS | `17-roi-value.png` |
| 20 | Orchestration | `/app/orchestration` | ✅ PASS | `18-orchestration.png` |
| 21 | Progress reaches 100% | `/api/help/checklist` | ✅ PASS | (16) |
| 22 | Mirrored events | `/api/maestro/events` | ℹ️ INFO | — |

## Failures found + fixes applied

### 🔴 FIXED — Billing dead-ended for fresh customers ("available in Full mode")
A brand-new workspace defaults to **essential** interface mode. `/app/billing`
was **not** in the essential-panel allowlist, so a first-run customer who
clicked Billing — or the onboarding success screen's **"Add Credit Fuel"** CTA,
which links to `/app/billing` — hit a wall: *"billing is available in Full
mode"* with only "Switch to Full" / "Go to Overview". A customer literally
could not reach the page to add credits/fuel. (See the first run's
`13-billing-page.png` before the fix.)

**Fix:** added `'billing'` to `ESSENTIAL_PANELS` in
`src/app/app/[[...panel]]/page.tsx`. Billing/credits is now always reachable.
Re-run confirms the real billing panel renders (fuel meter, credit packs,
top-up, ledger). This is the one true defect Customer Zero surfaced.

### Test-harness fixes (not product bugs)
- Dashboard-shell panels (`/app`, `/app/billing`, …) hold an open SSE
  connection, so `networkidle` never settles — switched the harness to
  `domcontentloaded` + explicit post-boot waits.
- The setup checklist **correctly self-hides at 100%**; the harness now treats
  that as the success signal instead of waiting for it.

## Items requiring external systems (INFO, not failures)

- **Email verification** — there is **no email-verification gate**. Signup
  creates a session and lands directly on `/onboarding`. Frictionless by
  design; if a verified-email requirement is wanted for production, it does
  not exist today. Flagged for a product decision.
- **Hermes VPS pairing** — no dedicated pairing UI on `/app/runtimes` yet
  (that's task #105, the next item in the queue). The backend pairing flow
  works today: `POST /api/onboarding/runtime-key {runtime:"hermes-vps"}`
  returns a ready-to-paste curl command (see `docs/security/VPS_HERMES_PAIRING.md`).
- **Credit purchase** and **Marketplace purchase** — both depend on a live
  Stripe checkout + a real/test card to grant credits. The UI surfaces were
  reached and behave correctly (with 0 credits the marketplace shows
  "Insufficient credits"); the actual purchase can't complete in a local
  sandbox without Stripe keys. To verify on DigitalOcean, set the Stripe env
  and use a Stripe test card.
- **Mirrored events** — `/api/maestro/events` returns 404 here; the MC mirror
  is opt-in (`mc mirror configure` on the runtime), so this is expected.

## Console observations
The browser console logged CSP violations of the form *"Executing inline
script violates… script-src 'self' 'nonce-…' 'strict-dynamic'"*. The app
rendered and hydrated correctly throughout (every step passed), so these are
not blocking — but they indicate some inline scripts aren't carrying the CSP
nonce. Worth a dedicated follow-up before production to confirm nothing
user-facing is being silently blocked. Not part of the onboarding scope.

## How to reproduce
```bash
# build once
pnpm build && cp -r .next/static .next/standalone/.next/static && cp -r public .next/standalone/public
# fresh server
rm -rf /tmp/cz-data && CREDENTIALS_ENCRYPTION_KEY=$(openssl rand -hex 32) \
  MISSION_CONTROL_DATA_DIR=/tmp/cz-data MC_DISABLE_RATE_LIMIT=1 NEXT_PUBLIC_GATEWAY_OPTIONAL=true \
  PORT=4317 node .next/standalone/server.js &
# walkthrough
BASE=http://127.0.0.1:4317 node scripts/customer-zero-walkthrough.mjs
```
