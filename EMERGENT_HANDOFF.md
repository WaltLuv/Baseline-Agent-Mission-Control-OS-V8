# Emergent Production Handoff — Mission Control v3.0

## Project Overview

Mission Control is an open-source AI agent orchestration dashboard built with Next.js 16, React 19, TypeScript 5, SQLite (better-sqlite3), and Tailwind CSS 3. It manages AI agent fleets, dispatches tasks, tracks token usage and costs, and provides a complete billing/monetization engine.

**Repo:** https://github.com/WaltLuv/baseline-united-mission-control
**Branch:** `main` (commits `ec9c530` and `be77508`)

---

## 1. Quick Setup

```bash
pnpm install
pnpm build
pnpm tsx scripts/seed-billing-data.ts   # Seeds pricing_configs, credit_packages, credit_feature_pricing, adds usage_events columns
pnpm dev         # Dev on localhost:3000
pnpm test:all    # lint + typecheck + vitest + playwright e2e + build
```

---

## 2. What's Already Done (Do NOT redo)

**Core platform:** 32 UI panels, agent lifecycle, WebSocket/SSE real-time, RBAC with Google Sign-In, quality gates, multi-tenancy, Stripe Checkout, landing/pricing/onboarding pages, demo seed, MCP server (35 tools), CLI, REST API with OpenAPI, Docker deployment.

**Billing engine** (committed in `be77508`):
- `src/lib/token-cost-calculator.ts` — 11 LLM providers, wholesale rates, 2.5x markup
- `src/lib/pricing-seeds.ts` — 14 providers, 4 credit packages ($10/$25/$50/$200), 12 feature prices
- `src/lib/billing.ts` — 3 cost modes (token/custom/config), dual safety fallbacks, NEVER charges zero
- `src/lib/migrations.ts` — migration 031_ billing seed and usage columns, adds missing DB columns
- `src/app/api/billing/margin/route.ts` — wholesale vs retail revenue, margin %
- `scripts/seed-billing-data.ts` — one-run seeding script
- `README.md` — updated with Billing & Monetization section
- `BILLING_OVERHAUL.md` — billing documentation

---

## 3. What Emergent Must Do

### Priority 1: Billing Pipeline Verification (CRITICAL — revenue depends on this)

```
1. VERIFY `POST /api/tokens` endpoint works end-to-end:
   - Send sample request with input/output tokens → verify calculateTokenCosts() computes wholesale cost
   - Verify 2.5x markup is applied → retail credits calculated → credits deducted from workspace balance
   - Verify usage_events row is written with input_tokens, output_tokens, raw_cost_cents, retail_cost_cents, markup_multiplier

2. VERIFY `GET /api/billing/margin` endpoint:
   - Run sample agent sessions to populate usage_events
   - Verify wholesale vs retail calculations are correct
   - Verify margin percentage matches expected (60% with 2.5x markup)

3. FIX type mismatches:
   - billing.ts imports from token-cost-calculator.ts and pricing-seeds.ts — verify no path errors
   - chargeForAgentSession() accepts 'agent_session' — verify gateway calls it
   - getMarginReport() uses raw_cost_cents and retail_cost_cents — verify migration 031 added them
   - usage_events table has input_tokens, output_tokens, markup_multiplier — verify schema

4. TEST the fallback chain:
   - Delete a row from pricing_configs → verify dual fallbacks still return a cost (13 credits default)
   - Verify Math.max(1, creditsRequired) prevents zero-charge bugs
   - Verify INSUFFICIENT_CREDITS error returns HTTP 402

5. INTEGRATE the gateway:
   - Gateway/agent needs to call POST /api/tokens when reporting session completion
   - Pass: workspaceId, agentId, taskId, model, provider, inputTokens, outputTokens, sessionId

6. AUDIT the seeding flow:
   - seed-billing-data.ts PRICING_CONFIGS_SEED — verify no duplicate insert failures
   - CREDIT_PACKAGES_SEED verifies 4 packages with correct prices: Starter=1000/$10, Power=2750/$25, Pro=6000/$50, Enterprise=25000/$200
   - Migration 031 does not conflict with existing data (uses INSERT OR IGNORE)
```

### Priority 2: Type Safety & Build

```
1. `pnpm typecheck` → fix ALL TypeScript errors
2. `pnpm lint` → fix ALL ESLint errors
3. `pnpm test:all` → fix ALL failing tests
4. Resolve peer dependency conflicts
5. `pnpm build` succeeds with zero errors/warnings
```

### Priority 3: Database & Migrations

```
1. Run all migrations in order. Verify 031_ billing_seed_and_usage_columns succeeds on existing DBs.
2. Verify SQLite schema matches expected state (pricing_configs, usage_events, credit_ledger, credit_packages, credit_feature_pricing, credit_purchase_orders, stripe_webhook_events, billing_plans, customer_subscriptions).
3. Add missing indexes: idx_usage_events_workspace, idx_credit_ledger_workspace for margin/balance queries.
4. Verify getWorkspaceBalance() recalculates from ledger sum (not cached field) — this is the source of truth.
```

### Priority 4: Production Hardening

```
1. SECURITY:
   - All API routes check authentication (requireRole()) except public landing pages
   - Stripe webhook signatures are validated before processing credits
   - Idempotency keys prevent duplicate credit grants from webhook replay
   - chargeForAction() checks balance BEFORE deducting (verify not bypassable)
   - Remove billing.ts.original and migrations.ts.original backup files from repo

2. ERROR HANDLING:
   - Add try/catch around database operations in billing.ts
   - chargeForAgentSession() returns proper error to gateway on insufficient credits
   - Add logging for billing errors: insufficient credits, pricing config not found, token calc failures

3. RATE LIMITING:
   - Add rate limiting to POST /api/tokens (prevent gateway spam)
   - Add rate limiting to POST /api/billing/purchase-order (prevent abuse)

4. MONITORING:
   - Structured logging for all credit mutations
   - Health check endpoint verifies DB connectivity + ledger consistency
   - Daily cron: recalculateBalance() for all workspaces, alert on discrepancies

5. BACKUPS:
   - Add backup script for SQLite database
   - Add restore script that verifies backup integrity
```

### Priority 5: Tests

```
1. Unit tests:
   - token-cost-calculator.ts: test calculateTokenCosts() for each provider, verify markup
   - billing.ts: test chargeForAction() all 3 modes, insufficient credits error, idempotency
   - billing.ts: test getPricingConfig() fallback chain (exact → provider → event_type → default → hardcoded 13 credits)
   - billing.ts: test chargeForAgentSession() end-to-end with mock tokens
   - billing.ts: test getMarginReport() with pre-populated usage_events

2. Integration tests:
   - POST /api/tokens: verify credits deducted, usage_events written
   - GET /api/billing/margin: verify wholesale/retail/margin calculations
   - Stripe webhook fulfillment: verify credits granted, idempotency prevents duplicates
   - seed-billing-data.ts: populates all tables without errors

3. E2E tests:
   - Complete flow: sign up → buy credits → run agent → tokens consumed → credits deducted → margin visible
   - Insufficient credits flow: run out → agent blocked → buy credits → agent resumes

4. Load test:
   - 100 concurrent token reports → no race conditions in credit deductions
   - Webhook replay → idempotency prevents double credit grants
```

### Priority 6: Documentation & DX

```
1. Verify README.md billing section (already added)
2. Verify BILLING_OVERHAUL.md (already added)
3. Add OpenAPI spec examples for billing endpoints
4. Add docs/billing.md with full billing flow explanation
5. Add example curl commands for testing billing endpoints
6. Add docs/migration.md explaining migrations and seeding
7. Add docs/troubleshooting/billing.md with common issues (insufficient credits, pricing config not found)
```

### Priority 7: Polishing

```
1. Remove all console.log/console.error in production code
2. Remove debugging comments and dead code
3. Verify imports use correct paths (@/lib/ vs relative)
4. No `any` types except where unavoidable
5. Run pnpm knip — remove unused deps
6. Verify next.config.js is production-ready (output: 'standalone')
7. Verify Docker deployment works with billing engine
8. Verify landing page, pricing page, onboarding wizard use billing data
9. Add loading states and error boundaries to billing UI components
10. Add "low balance" modal prompting credit purchase
11. Add usage history table to billing overview
12. Add margin percentage to billing overview
```

---

## 4. Known Issues to Watch For

| Issue | Location | Impact |
|-------|----------|--------|
| `creditsRequired = 0` bug | billing.ts old code | **CRITICAL** — eliminated by fallback chain + Math.max(1, ...) |
| Missing usage_events columns | Migrations needed | Added by migration 031 |
| pricing_configs never seeded | Post-migration | Fixed by seed-billing-data.ts |
| Stripe webhook signature | Billing webhook route | Verify signature is checked |
| Rate limiting on POST /api/tokens | API route | Not implemented — add it |
| Duplicate credit grants | Webhook handler | Idempotency keys prevent |
| SQLite concurrency | usage_events inserts | better-sqlite3 is synchronous |

---

## 5. Acceptance Criteria (Must Pass Before Production)

- [ ] `pnpm typecheck` → zero errors
- [ ] `pnpm lint` → zero errors
- [ ] `pnpm test:all` → all tests pass
- [ ] `pnpm build` → zero errors, zero warnings
- [ ] `POST /api/tokens` works end-to-end: tokens → wholesale → markup → credits → charged
- [ ] `GET /api/billing/margin` shows correct wholesale/retail/margin
- [ ] Pricing seed data loaded (14 providers, 12 features)
- [ ] Pricing seed data loaded (4 packages, $10/$25/$50/$200)
- [ ] Insufficient credits returns HTTP 402 and blocks action
- [ ] Stripe webhook idempotency prevents duplicate credit grants
- [ ] Migration 031 runs successfully on existing databases
- [ ] No `creditsRequired = 0` bugs anywhere in codebase
- [ ] Rate limiting on `POST /api/tokens`
- [ ] Docker deployment works with billing engine
- [ ] Landing, pricing, onboarding pages use billing data
- [ ] All `.original` backup files removed
- [ ] All debugging code removed
- [ ] Documentation complete

---

## 6. Revenue Flow Diagram

```
AGENT SESSION (agent consumes tokens)
         ↓
  GATEWAY reports: POST /api/tokens
         ↓
  chargeForAgentSession()
         ↓
  chargeForAction() → 3 modes:
    MODE 1: calculateTokenCosts() → wholesale USD → 2.5x markup → retail credits
    MODE 2: customCredits override
    MODE 3: getPricingConfig() → lookup → fallback chain → 13 credits default
         ↓
  Math.max(1, creditsRequired)  ← NEVER zero
         ↓
  recordUsageEvent() → usage_events table
  deductCredits() → credit_ledger table
         ↓
  GET /api/billing/margin → wholesale vs retail → margin %
```

---

This is the definitive handoff. Follow sections in order. Billing is the most critical piece — verify it first. Everything else is polish and production hardening.

**Owner:** Walter Thornton (Founder/CEO, Baseline Automations)
