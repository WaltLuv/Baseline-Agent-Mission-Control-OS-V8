# Mission Control v3.0 — Emergent Production Handoff PRD

> Owner: Walter Thornton (Founder/CEO, Baseline Automations)
> Repo: WaltLuv/baseline-united-mission-control · branch `main`
> Stack: Next.js 16 (App Router) · React 19 · TypeScript 5 · SQLite (better-sqlite3) · Tailwind CSS 3 · pnpm · Vitest · Playwright

---

## 1. Problem Statement (verbatim original handoff)

Production handoff for **Mission Control v3.0** with seven prioritised areas:

1. **Billing Pipeline Verification** (revenue-critical) — verify `POST /api/tokens` → wholesale → 2.5× markup → credits → ledger; verify `GET /api/billing/margin`; fix type mismatches; test the fallback chain; integrate the gateway phone-home; audit the seeding flow.
2. **Type Safety & Build** — `pnpm typecheck`, `pnpm lint`, `pnpm test:all`, `pnpm build` all green.
3. **Database & Migrations** — migration `031_billing_seed_and_usage_columns` runs cleanly; add `idx_usage_events_workspace` and `idx_credit_ledger_workspace` indexes; ledger sum is the source of truth.
4. **Production Hardening** — auth, error handling, rate limiting, monitoring, backups.
5. **Tests** — unit / integration / E2E / load coverage of the billing pipeline.
6. **Documentation & DX** — billing docs, migration docs, troubleshooting docs.
7. **Polish** — clean logs, dead code, unused deps, low-balance modal, usage history; **add Real Estate Sales Agent (#5) and Mortgage Broker (#6) onboarding templates**.

User chose: **Priorities 1, 2, 3, and Priority 7 #13** for this iteration; Stripe test/mock mode; local `AUTH_USER` / `AUTH_PASS`; targeted billing tests + smoke build only.

---

## 2. User Personas

| Persona | Role | Cares about |
|---------|------|-------------|
| **Walter (Founder)** | CEO / shipping the launch | Revenue accuracy, no zero-charge bugs, margin visibility |
| **Operator** | Day-to-day workspace user | Onboarding speed, agent fleet, predictable billing |
| **Gateway / Agent** | Programmatic caller | Reliable `POST /api/tokens` charge, idempotency, clear 402 on insufficient credits |
| **Admin** | Workspace owner / accountant | Credit packages, ledger audit, top-ups |

---

## 3. Core Requirements (static)

- Billing is **never free**: every action charges at least 1 credit (`Math.max(1, …)` safeguard).
- Pricing lookup has a **five-step fallback chain** (exact → provider → event_type → DB default → hardcoded 13 credits).
- All credit mutations are **idempotent** by `idempotency_key`.
- `getWorkspaceBalance()` is computed from `SUM(credit_ledger.amount)` — single source of truth.
- Migrations run in order; existing DBs upgrade safely (`INSERT OR IGNORE` after creating proper unique indexes).
- `POST /api/tokens` must:
  - Charge credits via `chargeForAgentSession`.
  - Return HTTP **402** with body `{ error: "INSUFFICIENT_CREDITS", ... }` on shortage.
  - Record a `usage_events` row with full provenance (wholesale, retail, markup, tokens).
- 6 onboarding business templates (Property Manager, General Contractor, Home Services, AI Agency, **Real Estate Sales Agent**, **Mortgage Broker**).

---

## 4. What's Been Implemented (this run, 2026-05-27)

### Priority 1 — Billing pipeline verified end-to-end
- ✅ `POST /api/tokens` now calls `chargeForAgentSession()`: tokens → wholesale → 2.5× markup → credits → deduct → record in `usage_events`.
  - Returns HTTP `402 INSUFFICIENT_CREDITS` on shortage (verified live; balance unchanged).
  - Supports caller-supplied `idempotencyKey`; repeat calls do not double-charge (verified live).
- ✅ `GET /api/billing/margin` now uses `requireRole('viewer')`; computes wholesale/retail/margin% per timeframe (`day` / `week` / `month` / `all`).
- ✅ Verified live: Sonnet 4 @ 10k input + 5k output = wholesale 11¢, retail 27¢, **margin 59.26 %** (target ≈60 %).
- ✅ Fixed `getWorkspaceFromAuth` import error in margin route.
- ✅ Fixed `token-cost-calculator.ts` `CostResult` field name mismatch (`wholesaleCostCents`/`retailCostCents`).
- ✅ Removed unused imports in `billing.ts`.

### Priority 2 — Type safety & build
- ✅ `pnpm typecheck` → **0 errors**.
- ✅ `pnpm lint` → **0 errors** (10 pre-existing low-priority warnings remain).
- ✅ `pnpm build` (Turbopack) → **compiled successfully in 60s**; 3 expected warnings (stripe lazy-require, dynamic fs patterns in `super/os-users` route).
- ✅ Vitest unit tests added: `src/lib/__tests__/billing.test.ts` (18 tests) + `src/lib/__tests__/token-cost-calculator.test.ts` (6 tests) — **all 24 pass**.

### Priority 3 — Database & migrations
- ✅ Fixed syntax error joining migration `031_billing_seed_and_usage_columns` to the migrations array (missing `},` between `020_memory_metadata` and `031`, and a stray `}`).
- ✅ Migration 031 is now **idempotent & complete**:
  - Adds `input_tokens`, `output_tokens`, `markup_multiplier` columns to `usage_events`.
  - Adds **performance indexes** `idx_usage_events_workspace(workspace_id, created_at)` and `idx_credit_ledger_workspace(workspace_id, created_at)`.
  - De-dupes pre-existing `pricing_configs` and `credit_feature_pricing` rows, then adds **unique indexes** `ux_pricing_configs_lookup(event_type, provider, model)` and `ux_cfp_feature_variant(feature_name, variant)` — fixes the duplicate-insert bug we caught in QA.
  - Seeds **14 pricing configs** (11 LLM + voice + image + places + sms + bot + rent_estimate + default).
  - Seeds **12 feature prices**.
  - Resets credit_packages to the 4 launch SKUs with **correct totals**: Starter 1 000/$10, Power 2 750/$25, Pro 6 000/$50, Enterprise 25 000/$200 (previously Pro and Enterprise rolled up to 5 500 / 22 500 — fixed).
- ✅ `scripts/seed-billing-data.ts` now sets `MISSION_CONTROL_TEST_MODE=1` so scheduler doesn't keep the process alive, and exits 0 cleanly.

### Priority 7 #13 — Onboarding templates
- ✅ Added **Real Estate Sales Agent** template (🏡) with 4 agents (Lead Capture, CMA Analyst, Showing Coordinator, Transaction Coordinator) and 7 skills (lead-capture, buyer-seller-intake, cma-report-generator, showing-scheduling, offer-follow-up, transaction-coordination, post-close-nurture). 5 workflows.
- ✅ Added **Mortgage Broker** template (💰) with 5 agents (Application Intake, Pre-Qual Scorer, Doc Collection Bot, Rate Quote Engine, Loan Officer Assistant) and 7 skills (application-intake, pre-qualification-scoring, document-collection-request, rate-quote-comparison, underwriting-status-tracker, loan-officer-dashboard, closing-checklist). 6 workflows.
- ✅ Verified live: Both templates render in onboarding wizard step 2 and review correctly on step 3.

---

## 5. Acceptance Criteria Status (Priorities 1-3 + 7#13)

| Item | Status |
|------|--------|
| `pnpm typecheck` → zero errors | ✅ |
| `pnpm lint` → zero errors | ✅ (10 pre-existing warnings) |
| Billing-targeted vitest → all pass | ✅ 24/24 |
| `pnpm build` → zero errors | ✅ (3 expected warnings) |
| `POST /api/tokens` end-to-end pipeline | ✅ verified live |
| `GET /api/billing/margin` correct calculations | ✅ verified live (59.26 %) |
| Pricing seed (14 providers, 12 features) | ✅ verified |
| Credit packages 4 × correct totals (1k / 2.75k / 6k / 25k) | ✅ verified |
| Insufficient credits returns HTTP 402 | ✅ verified live |
| Migration 031 runs cleanly + indexes added | ✅ |
| No `creditsRequired = 0` bug | ✅ `Math.max(1, …)` test green |
| Onboarding: Real Estate (#5) + Mortgage Broker (#6) | ✅ verified live |

---

## 6. Backlog / Deferred (per user scope)

### P0 (must complete before public launch)
- Priority 4: Production hardening — Stripe webhook signature validation, rate limiting on `POST /api/tokens` & `POST /api/billing/purchase-order`, structured logging for credit mutations, health check ledger consistency, daily `recalculateBalance` cron with alert.
- Priority 5: Add E2E + integration tests for the full sign-up → buy → run → margin loop; webhook idempotency under replay; load test 100 concurrent token reports.

### P1
- Priority 6: `docs/billing.md`, `docs/migration.md`, `docs/troubleshooting/billing.md`, OpenAPI billing examples, curl snippets.
- Priority 7: low-balance modal, usage history table on Billing Overview, margin % on Billing Overview, remove `console.log` calls from prod paths, knip pass.

### P2
- Per-agent cost breakdown UI.
- API token rotation UI.

---

## 7. Operational Notes

- Local credentials: `AUTH_USER=admin` / `AUTH_PASS=admin12345` (see `/app/memory/test_credentials.md`).
- Run order: `pnpm install` → migrations auto-apply on first DB open → `MISSION_CONTROL_TEST_MODE=1 pnpm tsx scripts/seed-billing-data.ts` (or simply boot, migration 031 seeds the same data idempotently) → `pnpm dev`.
- Stripe is in **test/mock mode** (no real keys required; `src/app/api/stripe/checkout/route.ts` returns a mock session when `STRIPE_SECRET_KEY` is unset).
- Test mode hatch: setting `MISSION_CONTROL_TEST_MODE=1` skips webhook listener + scheduler init (used by seed script and tests).
