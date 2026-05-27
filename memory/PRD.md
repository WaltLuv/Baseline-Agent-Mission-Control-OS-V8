# Mission Control v3.0 — Production Handoff PRD

> Owner: Walter Thornton (Founder/CEO, Baseline Automations)
> Repo: WaltLuv/baseline-united-mission-control · branch `main`
> Stack: Next.js 16 · React 19 · TypeScript 5 · SQLite (better-sqlite3) · Tailwind 3 · pnpm · Vitest · Playwright

---

## 1. Problem Statement

Production handoff for Mission Control v3.0. Two iterations completed.

**Iteration 1** — Priorities 1, 2, 3, and 7#13: billing pipeline verification, type-safety/build/test green, DB migrations + indexes, and Real Estate / Mortgage Broker onboarding templates.

**Iteration 2** — Commercial-product pass: re-frame Mission Control as the operating system for an AI workforce (not a developer dashboard). Build the **wow moment**, **top-up flow**, **trust surfaces**, **workforce fuel meter**, and add three more industry templates (**CPA / Accounting Firm**, **Marketing Agency**, **Law Firm**).

---

## 2. User Personas

| Persona | Role | Cares about |
|---------|------|-------------|
| **Walter (Founder)** | CEO / shipping the launch | Revenue accuracy, no zero-charge bugs, margin visibility |
| **Business owner** | Plumbing co, CPA, law firm, real-estate agency, etc. | Relief, leverage, visibility, time saved, ROI |
| **Operator** | Day-to-day workspace user | Onboarding speed, predictable billing, "no more chaos" |
| **Gateway / Agent** | Programmatic caller | Reliable POST /api/tokens charge, idempotency, clear 402 on insufficient credits |
| **Admin** | Workspace owner / accountant | Credit packages, ledger audit, top-ups |

---

## 3. Core Product Principle

Mission Control v3 is **not the product**. The **AI workforce is the product**.
Mission Control is the operating system that makes the AI workforce **visible, manageable, trustworthy, and scalable**.

Customers don't buy panels, agents, orchestration, or models — they buy relief, leverage, visibility, automation, time savings, labor reduction, and operational clarity.

---

## 4. What's Been Implemented

### Iteration 1 (2026-05-27 AM) — Priorities 1, 2, 3, 7#13
- **Billing pipeline verified end-to-end live.** `POST /api/tokens` now drives the full token → wholesale → 2.5× markup → credit deduct → ledger flow via `chargeForAgentSession`. Sonnet 4 @ 10k/5k → 11¢ → 27¢ → 27 credits. **Margin = 59.26 %** (target ≈60 %). Idempotency works. Insufficient credits → HTTP 402, balance unchanged.
- **Fallback chain** (exact → provider → event_type → DB default → hardcoded 13 credits) all verified. `Math.max(1, …)` confirms no zero-charge.
- **DB & migrations**: fixed syntax error joining migration 031, added performance indexes (`idx_usage_events_workspace`, `idx_credit_ledger_workspace`) and **unique indexes** (`ux_pricing_configs_lookup`, `ux_cfp_feature_variant`) to fix the duplicate-insert bug. 14 pricing configs + 12 feature prices + 4 credit packages with correct launch totals.
- **Type safety**: `tsc` 0 errors, `eslint` 0 errors, `next build` ✓ 60 s.
- **Real Estate Sales Agent** + **Mortgage Broker** onboarding templates added (#5, #6).

### Iteration 2 (2026-05-27 PM) — Commercial product pass
- **Onboarding rebrand to "Set Up Your AI Workforce"**, with explicit time-saved / labor-equivalent / employee-count copy. 3-step wizard, business-friendly language, no AI jargon.
- **Wow moment screen** ("Your AI Workforce is Ready") shows: estimated hours saved / month, dollar labor-equivalent, AI-employee headcount, the first 5-minute starter task already queued, and (where applicable) the compliance note. Two CTAs: *Open Mission Control →* / *Add Credit Fuel*.
- **Shared `src/lib/business-templates.ts`** is now the source of truth for all templates. Each template carries `aiEmployees`, `skills`, `workflows`, `starterTaskTitle`, `starterTaskDescription`, `roiMessage`, `estimatedHoursSavedPerMonth`, `recommendedStarterCredits`, and an optional `complianceNote`.
- **3 new templates** (acceptance criteria for this iteration):
  - **📊 CPA / Accounting Firm** — 5 AI employees, 9 skills, 6 workflows. Starter task: *Create a missing-document checklist and follow-up email for a tax client*. ROI: *Reduce admin follow-up during tax season and free staff from repetitive document chasing*. Compliance: AI does not give tax advice or sign returns.
  - **📣 Marketing Agency** — 5 AI employees, 9 skills, 6 workflows. Starter task: *Create a 7-day content calendar for a client campaign*. ROI: *Produce campaign assets and client reports faster without adding more account managers*.
  - **⚖️ Law Firm** — 5 AI employees, 9 skills, 6 workflows. Starter task: *Summarize a new client intake and draft a consultation follow-up email*. ROI: *Reduce intake bottlenecks, speed up client communication, and keep matters organized*. Compliance: **AI does not provide legal advice or represent the firm to clients.**
- **9 total business templates** (PM, GC, Home Services, AI Agency, Real Estate, Mortgage, CPA, Marketing, Law).
- **Workforce Fuel Meter** (`src/components/billing/workforce-fuel.tsx`) reframes credits as fuel:
  - Big "X,XXX credits" reading + "~N days of runway · M credits/day avg".
  - Color-graded progress bar (red < 5 days, amber < 10 days, emerald otherwise).
  - Inline "Top Up" / "⚡ Add Fuel Now" CTA.
- **Low-Balance Modal** auto-surfaces when balance < 100 credits OR runway < 5 days. Shows recommended package (the smallest pkg covering 30 days of runway), exact dollar cost, projected days-of-runway after top-up, and a 1-click *Top Up — $X* CTA. Dismiss-once-per-mount UX so it doesn't nag.
- **Stripe checkout continuation in test/mock mode** (`POST /api/billing/purchase-order` auto-fulfills with `fulfillPurchaseOrder()` when `STRIPE_SECRET_KEY` is unset). Verified live: balance 30 → 1,030 in ~3 seconds without leaving the page.
- **Re-titled BillingPanel** to "AI Workforce Billing" with subtitle "Track credits, usage, and costs for your AI workforce".
- **Pre-existing routing bug fixed**: `pathname.slice(1)` was producing `'app/billing'` instead of `'billing'`, leaving every panel under `/app/*` blank. Now strips the leading `/app/` segment correctly.
- **5 new vitest unit tests** for `computeFuelFromOverview` (zero-balance, runway math, recommended-package picker, healthy state, low-balance threshold). **29/29 billing-related unit tests pass.**

---

## 5. Acceptance Criteria Status (this iteration)

| Item | Status |
|------|--------|
| `pnpm typecheck` → zero errors | ✅ |
| `pnpm lint` → zero errors (10 pre-existing warnings) | ✅ |
| `pnpm build` → zero errors | ✅ Compiled successfully in 58 s; 123/123 pages generated |
| Billing-targeted vitest → all pass | ✅ 29/29 |
| All 9 onboarding templates render in wizard | ✅ verified live |
| CPA / Marketing Agency / Law Firm templates: correct agents / skills / workflows | ✅ verified live |
| Each new template: ROI message + first 5-minute task + sample starter task seeded | ✅ |
| Law Firm: no legal-advice claims | ✅ verified ("do not provide legal advice or represent the firm to clients") |
| CPA: no tax-advice claims | ✅ verified ("do not give tax advice or sign returns") |
| Workforce Fuel Meter renders on BillingPanel overview | ✅ verified live (1,030 credits / 30+ days runway / Fully fueled) |
| Low-Balance Modal auto-surfaces when low + 1-click top-up works | ✅ verified live (Starter / $10 / 333 days runway after top-up) |
| Stripe checkout continuation seamless in test/mock mode | ✅ verified live (balance jumped 30 → 1,030 instantly) |
| Business-friendly executive language | ✅ "AI Workforce Billing", "Workforce Fuel", "AI Employees" |

---

## 6. Backlog / Deferred

### P0 (must complete before public launch)
- Priority 4 hardening — Stripe webhook signature validation (live mode), rate limiting on `POST /api/tokens` and `POST /api/billing/purchase-order`, structured logging for credit mutations, health-check ledger consistency, daily `recalculateBalance` cron with alerts.
- Live-mode Stripe checkout URL generation in `purchase-order/route.ts` (the playbook already integrates `stripe/checkout/route.ts` — wire it up).
- Priority 5 — E2E sign-up → buy → run → margin loop; webhook replay idempotency under load; 100 concurrent token reports load test.

### P1
- Auto-reload (subscription) for credits to prevent the workforce ever pausing.
- Usage history table + margin % widget on Billing Overview panel (still room beneath the meter).
- Trust surfaces: workspace-health score, AI workforce-health score, approval logs, AI-action traceability, security-posture indicator.
- Demo environment (seed all 9 templates with sample activity).
- Landing & pricing page polish using business templates and ROI language.
- Marketplace framing ("App Store for AI Employees").
- Priority 6 docs — `docs/billing.md`, `docs/migration.md`, `docs/troubleshooting/billing.md`, OpenAPI examples.

### P2
- Per-agent / per-AI-employee cost breakdown UI.
- API token rotation UI.
- Flight Deck desktop companion (Tauri v2).

---

## 7. Operational Notes

- Local credentials: `AUTH_USER=admin` / `AUTH_PASS=admin12345` (see `/app/memory/test_credentials.md`).
- Run order: `pnpm install` → migrations auto-apply on first DB open → `MISSION_CONTROL_TEST_MODE=1 pnpm tsx scripts/seed-billing-data.ts` (or just boot — migration 031 seeds identically) → `pnpm dev`.
- Stripe runs in **test/mock mode** (no real keys required). `purchase-order` route auto-fulfills credits when `STRIPE_SECRET_KEY` is unset. Set `STRIPE_SECRET_KEY` to switch to real checkout.
- Test-mode hatch: `MISSION_CONTROL_TEST_MODE=1` skips the webhook listener + scheduler init (used by seed script and tests).
- Pre-existing routing bug fix: `src/app/app/[[...panel]]/page.tsx` now strips the `/app/` URL segment before matching the panel id. Previously every panel rendered blank.
