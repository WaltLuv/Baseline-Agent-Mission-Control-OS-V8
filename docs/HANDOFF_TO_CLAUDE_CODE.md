# HANDOFF TO CLAUDE CODE — Mission Control V2

**Handoff Date:** 2026-05-22
**Current Commit:** `61c264f` (latest)
**Latest Phase Marker:** `e769a7a` (Phase 5 production hardening)
**Previous Handoff Commit:** `61c264f` (Phase 5B security fixes — multi-tenant data isolation patches)
**Repo:** `/opt/data/profiles/saul-revenue/baseline-united-mission-control`
**Parent Agent:** Hermes Agent (Nous Research, running on Telegram)

---

## 1. CURRENT MISSION

### Phase 5C — Unified Billing + Credit System (STARTING NOW)
Build the customer-facing billing, credit, subscription, and usage metering layer into Mission Control. This transforms Mission Control from a free internal tool into a revenue-generating SaaS platform.

### Phase 6 — Claude OS Feature Port (PLANNED, AFTER BILLING)
Port key Claude OS concepts (Daily Optimization/Dream Panel, Fleet Health Score, Skills ROI, Agent Personas/Pantheon, Memory Graph upgrade, Agent Discovery Scanner) into Mission Control panels. **Concepts only — no code merge.** See `CLAUDE_OS_INTEGRATION_PLAN.md`.

---

## 2. PRODUCT VISION

Mission Control V2 is the **AI Workforce Operating System** — the command center and billing platform for multi-agent operations. It sits at the center of a portfolio:

| Layer | Product | Role |
|-------|---------|------|
| **Eyes** | VisionOps | Field intelligence — photo/video analysis, damage assessment, scope estimation |
| **Voice** | VoiceOps | Telephony — AI call answering, voice work orders, transcript → action |
| **Ops System** | PropControl | Real estate maintenance workflow engine — the canonical system of record |
| **Command Center + Billing** | **Mission Control V2** | Fleet management dashboard, agent orchestration, cost tracking, **billing portal** |

Mission Control V2 is where customers log in to manage their AI workforce, see costs, and pay.

---

## 3. COMPLETED PHASES (with Commit Hashes)

See `PHASE_HISTORY.md` for full detail. Summary:

| Phase | Marked Commit | Description |
|-------|--------------|-------------|
| Phase 1 | `001b0ff` | Core engine (CLI, MCP, REST) — 35 MCP tools, task board, agent dispatch |
| Phase 2 | `1519c77` | AI workforce model — 11 agents with souls, memory, workflows, cost tracking |
| Phase 3 | `44861cb` | Customer-ready panels — 32 panels with empty states, summaries, translations |
| Phase 4 | `87e8050` | Production polish — guided forms, customer modes, zero fixes, safety |
| Phase 5 | `e769a7a` | Infrastructure hardening — Docker, monitoring, multi-tenant, performance optimization |
| Phase 5B | `61c264f` | Security fixes — 3 multi-tenant data isolation leaks patched |

---

## 4. CURRENT REPO STATE

**Stack:** Next.js 16, React 19, TypeScript 5, SQLite (better-sqlite3), Tailwind CSS 3, Zustand, pnpm
**Database:** SQLite with 47 tables, 50 migrations
**Deployment:** Docker Compose (production hardened) or Node.js standalone
**Auth:** Session-based + API keys, RBAC (viewer/operator/admin), Google OAuth
**Real-time:** SSE + WebSocket
**Agent Protocol:** Framework adapters (generic, openclaw, crewai, langgraph, autogen)

### Key Directories
```
src/app/              Next.js pages + API routes (App Router, 47+ route files)
src/components/       UI panels (32 panels across dashboard tabs)
src/lib/              Core logic: db.ts, auth.ts, migrations.ts, websocket.ts
.data/                SQLite database (gitignored)
scripts/              Install, deploy, production-start
docs/                 All documentation (this file, LAUNCH-RUNBOOK.md, etc.)
```

### What Already Exists (relevant to billing)
- `/api/tokens` — Token usage tracking per agent (cost estimation, no billing)
- `/api/integrations` — Provider subscription detection (Anthropic, OpenAI)
- `subscription` field in settings (plan override, codex plan)
- Dashboard displays subscription label and price (cosmetic, not billing)
- Stripe secret key scanner exists in `src/lib/secret-scanner.ts`
- No actual Stripe integration, credit system, or payment flow exists

---

## 5. WHAT CLAUDE CODE MUST DO NEXT

### PRIORITY 1: Finish Phase 5C — Unified Billing

Build the full billing infrastructure from the PropControl schema spec. See detailed instructions in Section 6 below.

1. **Database schema** — Add billing/credit tables to existing SQLite schema (adapted from PropControl's PostgreSQL schema — see migration guidance)
2. **Stripe webhook handler** — New `/api/stripe/webhook` route
3. **Credit purchase flow** — API routes for creating purchase orders, Stripe Checkout sessions
4. **Usage metering middleware** — Wrap expensive provider calls in billing middleware
5. **UI panels** — Credit balance widget, buy credits page, transaction history, admin billing dashboard
6. **Admin tooling** — Webhook event viewer, manual credit adjustments, margin dashboard

### PRIORITY 2: Phase 6 — Claude OS Feature Port

After billing is done, port Claude OS concepts as new Mission Control panels. See `CLAUDE_OS_INTEGRATION_PLAN.md`. CRITICAL RULE: **Claude OS stays separate, Mission Control stays Next.js, concepts only not code merge.**

---

## 6. DETAILED BILLING IMPLEMENTATION INSTRUCTIONS

### 6.1 Architecture Decision: SQLite (not PostgreSQL)

The PropControl billing schema is designed for PostgreSQL/Supabase. Mission Control uses SQLite. **Adapt, don't migrate.** Key differences:

| PropControl (PG) | Mission Control (SQLite) | Adaptation |
|-----------------|------------------------|------------|
| `uuid` primary keys | `INTEGER PRIMARY KEY AUTOINCREMENT` | Use autoincrement IDs with UUID stored as TEXT where needed |
| `timestamptz` | `BIGINT` (Unix epoch) | Use existing timestamp pattern |
| `JSONB` | `TEXT` (store JSON strings) | Same as existing schema |
| `numeric(18,6)` | `REAL` | Sufficient for credit values |
| `gen_random_uuid()` | Use `crypto.randomUUID()` at application layer | Generate UUIDs in TS code |
| Row-level security (RLS) | `workspace_id` filtering on every query | Apply workspace_id filter pattern from audit |
| `security definer` RPC functions | Application-layer functions in `src/lib/billing.ts` | Implement as TS functions with proper auth |

### 6.2 Schema Tables to Add (SQLite-adapted)

Create a new migration file `src/lib/migrations/051-billing.ts` with these tables:

**`credit_packages`** — Prepaid credit packs users can purchase
```sql
CREATE TABLE IF NOT EXISTS credit_packages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,        -- e.g. 'starter_1000'
  name TEXT NOT NULL,               -- e.g. 'Starter'
  price_usd REAL NOT NULL,          -- e.g. 10.00
  credits_granted REAL NOT NULL,    -- e.g. 1000
  is_active INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 100,
  created_at BIGINT NOT NULL DEFAULT (unixepoch()),
  updated_at BIGINT NOT NULL DEFAULT (unixepoch())
);
```

**`credit_purchase_orders`** — Internal order tracking before Stripe payment
```sql
CREATE TABLE IF NOT EXISTS credit_purchase_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  workspace_id INTEGER NOT NULL REFERENCES workspaces(id),
  package_id INTEGER NOT NULL REFERENCES credit_packages(id),
  package_code TEXT NOT NULL,
  package_name TEXT NOT NULL,
  price_usd REAL NOT NULL,
  credits_to_grant REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'usd',
  status TEXT NOT NULL DEFAULT 'created',
  stripe_checkout_session_id TEXT UNIQUE,
  stripe_payment_intent_id TEXT UNIQUE,
  stripe_invoice_id TEXT UNIQUE,
  stripe_charge_id TEXT,
  client_reference_id TEXT NOT NULL UNIQUE,
  request_idempotency_key TEXT NOT NULL UNIQUE,
  paid_at BIGINT,
  created_at BIGINT NOT NULL DEFAULT (unixepoch()),
  updated_at BIGINT NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_user_workspace
  ON credit_purchase_orders(user_id, workspace_id, created_at DESC);
```

**`credit_ledger`** — Immutable record of every credit movement
```sql
CREATE TABLE IF NOT EXISTS credit_ledger (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  workspace_id INTEGER NOT NULL,
  transaction_type TEXT NOT NULL,  -- 'deposit', 'deduction', 'refund', 'adjustment', 'reversal', 'reserve', 'release'
  amount REAL NOT NULL,
  reference_type TEXT NOT NULL,
  reference_id TEXT NOT NULL,
  description TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at BIGINT NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_credit_ledger_workspace ON credit_ledger(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_ledger_user ON credit_ledger(user_id, created_at DESC);
```

**`stripe_webhook_events`** — Webhook deduplication and audit
```sql
CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  stripe_event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  livemode INTEGER NOT NULL DEFAULT 0,
  api_version TEXT,
  object_id TEXT,
  processing_status TEXT NOT NULL DEFAULT 'received',
  processing_attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  payload_json TEXT NOT NULL DEFAULT '{}',
  received_at BIGINT NOT NULL DEFAULT (unixepoch()),
  processed_at BIGINT
);
```

**`api_usage_logs`** — Raw billable provider usage
```sql
CREATE TABLE IF NOT EXISTS api_usage_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  workspace_id INTEGER NOT NULL,
  app_feature TEXT NOT NULL,
  workflow_name TEXT,
  provider_used TEXT NOT NULL,
  model_name TEXT,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  request_units REAL NOT NULL DEFAULT 0,
  is_successful INTEGER NOT NULL DEFAULT 1,
  wholesale_cost REAL NOT NULL,
  retail_cost REAL NOT NULL,
  external_request_id TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at BIGINT NOT NULL DEFAULT (unixepoch())
);
CREATE INDEX IF NOT EXISTS idx_usage_logs_workspace ON api_usage_logs(workspace_id, created_at DESC);
```

**`pricing_configs`** — Provider cost and markup configuration
```sql
CREATE TABLE IF NOT EXISTS pricing_configs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider TEXT NOT NULL,
  model_name TEXT,
  cost_per_1k_input REAL NOT NULL DEFAULT 0,
  cost_per_1k_output REAL NOT NULL DEFAULT 0,
  flat_fee_per_request REAL NOT NULL DEFAULT 0,
  markup_multiplier REAL NOT NULL DEFAULT 2.5,
  is_active INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  created_at BIGINT NOT NULL DEFAULT (unixepoch()),
  updated_at BIGINT NOT NULL DEFAULT (unixepoch())
);
```

**Users table migration** — Add credit columns to existing `users` table:
```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS available_credits REAL NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS auto_reload_enabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS auto_reload_amount REAL NOT NULL DEFAULT 10.00;
ALTER TABLE users ADD COLUMN IF NOT EXISTS low_balance_threshold REAL NOT NULL DEFAULT 2.00;
```

### 6.3 Seed Data

Insert default credit packages:
```sql
INSERT OR IGNORE INTO credit_packages (code, name, price_usd, credits_granted, is_active, sort_order)
VALUES
  ('starter_1000', 'Starter', 10.00, 1000, 1, 10),
  ('growth_2750', 'Growth', 25.00, 2750, 1, 20),
  ('pro_6000', 'Pro', 50.00, 6000, 1, 30);
```

Seed initial pricing configs for major providers (Anthropic Claude, OpenAI GPT, Google Gemini).

### 6.4 Core Billing Functions (Application Layer)

Implement in `src/lib/billing.ts`:

```typescript
// depositCredits — the ONLY way to add credits
// MUST: write to credit_ledger, update users.available_credits atomically
// MUST: use idempotency_key to prevent double-grants
// NEVER grant from success redirect; only from verified Stripe webhook
function depositCredits(
  db: Database,
  userId: number,
  workspaceId: number,
  amount: number,
  referenceType: string,
  referenceId: string,
  description: string,
  idempotencyKey: string,
  metadata?: Record<string, unknown>
): boolean

// deductCredits — the ONLY way to subtract credits
// MUST: check balance exists, write ledger entry, atomic deduction
// MUST: use idempotency_key
function deductCredits(
  db: Database,
  userId: number,
  workspaceId: number,
  amount: number,
  referenceType: string,
  referenceId: string,
  description: string,
  idempotencyKey: string,
  metadata?: Record<string, unknown>
): boolean

// recalculateUserBalance — derive from ledger (reconciliation)
function recalculateUserBalance(db: Database, workspaceId: number): number

// getCreditBalance — fast read from users table
function getCreditBalance(db: Database, userId: number, workspaceId: number): number
```

### 6.5 API Routes to Create

**`POST /api/stripe/webhook`** — Stripe webhook endpoint
- Verify signature from raw request body using `stripe.webhooks.constructEvent()`
- Record event in `stripe_webhook_events` (dedup by stripe_event_id)
- On `checkout.session.completed`:
  1. Find matching `credit_purchase_orders` by stripe_checkout_session_id
  2. Mark order as 'paid'
  3. Call `depositCredits()` with idempotency key = stripe event ID
  4. Mark webhook as 'processed'
- Return 200 on success, 500 on failure (Stripe will retry)

**`POST /api/billing/purchase`** — Create credit purchase
- Auth required (requireAuth)
- Validate credit package exists and is active
- Create `credit_purchase_orders` row
- Create Stripe Checkout Session with metadata (purchase_order_id, user_id, credits_to_grant)
- Return checkout URL

**`GET /api/billing/balance`** — Get current credit balance
- Auth required
- Return available_credits, auto_reload settings, low_balance_threshold
- Include recent transaction history from credit_ledger

**`GET /api/billing/usage`** — Usage history
- Auth required
- Return paginated api_usage_logs, grouped by feature/provider
- Support date range filtering

**`GET /api/billing/packages`** — Available credit packages
- Returns active credit_packages
- No auth required (public listing)

**`POST /api/billing/auto-reload`** — Configure auto-reload
- Update user's auto_reload_enabled and auto_reload_amount
- Future: trigger Stripe billing portal session

**Admin routes (super-admin only):**
- `GET /api/billing/admin/webhooks` — Webhook event viewer
- `POST /api/billing/admin/adjust` — Manual credit adjustment (writes ledger)
- `GET /api/billing/admin/margins` — Margin by feature/provider

### 6.6 Billing Middleware for Provider Calls

Wrap all expensive provider calls (Gemini, RentCast, Places, Street View, etc.):

```typescript
// src/lib/billing-middleware.ts
async function billableAction(
  req: NextRequest,
  feature: string,
  provider: string,
  estimatedCredits: number,
  action: () => Promise<ProviderResult>
): Promise<ProviderResult> {
  const auth = await requireAuth(req);
  const balance = getCreditBalance(db, auth.user.id, auth.user.workspace_id);
  if (balance < estimatedCredits) {
    throw new InsufficientBalanceError(balance, estimatedCredits);
  }
  const result = await action();
  if (result.success) {
    const actualCost = calculateRetailCost(provider, result);
    deductCredits(db, auth.user.id, auth.user.workspace_id, actualCost, 'usage', ...);
  }
  // Write api_usage_logs regardless of outcome
  return result;
}
```

### 6.7 UI Components to Build

1. **CreditBalanceWidget** — Top bar widget showing current balance, low-balance warning
2. **BuyCreditsPage** — Package cards (Starter/Growth/Pro), Stripe Checkout integration
3. **TransactionHistory** — Ledger entries, filterable by type
4. **UsageHistory** — API usage logs with cost breakdown
5. **LowBalanceModal** — Auto-show when balance < threshold
6. **EstimateCostLabel** — Show estimated credits before expensive actions
7. **AdminBillingDashboard** — Webhook events, manual adjustments, margin viewer

### 6.8 Golden Rules (NEVER BREAK)

1. **Never grant credits from frontend success redirect** — only from verified Stripe webhook
2. **Never process the same Stripe event twice** — dedup by stripe_event_id in stripe_webhook_events
3. **Never update balance without an immutable ledger row** — every balance change goes through credit_ledger
4. **Never trust event order** — re-check internal purchase order state before granting
5. **Always use idempotency keys** — every credit operation has a unique idempotency_key
6. **Never bypass the ledger from application code** — depositCredits/deductCredits are the only mutation paths

### 6.9 Environment Variables Needed

```
STRIPE_SECRET_KEY=sk_live_...       # Production Stripe secret
STRIPE_WEBHOOK_SECRET=whsec_...     # Stripe webhook signing secret
STRIPE_PRICE_ID_STARTER=price_...   # Stripe price IDs for each package
STRIPE_PRICE_ID_GROWTH=price_...
STRIPE_PRICE_ID_PRO=price_...
```

### 6.10 Testing Checklist

- [ ] Duplicate webhook replay test (send same event twice)
- [ ] Success redirect with missing webhook test (no webhook arrives, no credits granted)
- [ ] Duplicate deduction test (same idempotency key, second call is no-op)
- [ ] Rapid repeated click test (multiple purchase attempts)
- [ ] Insufficient balance test (action denied when credits < cost)
- [ ] Balance recalculation from ledger (matches users.available_credits)
- [ ] Admin manual adjustment (ledger entry created, balance updated)
- [ ] Webhook failure recovery (retry mechanism works)

---

## 7. PRODUCTION BLOCKERS

### Blockers (must resolve before Phase 5C deployment)

1. **Stripe integration** — Requires Stripe account, API keys, webhook endpoint configuration
2. **Database migration** — 7 new tables + users table alterations. Must be backwards-compatible with existing data.
3. **Existing multi-tenant gaps** — Phase 5B (`61c264f`) patched 3 leaks. Review `multitenant-audit.md` for remaining ⚠️ items. The `/api/audit`, `/api/skills`, and `/api/sessions/transcript` scope issues were identified but may need wallet-aware billing.
4. **PostgreSQL migration path** — If PropControl's billing depends on PostgreSQL features (RLS, UUID), the SQLite layer needs careful adaptation. See `postgres-migration.md` for the full migration audit.

### Non-blockers (can ship after)

- Auto-reload / off-session billing
- Swarm-specific tables (swarm_runs, swarm_run_steps, swarm_leads)
- Premium variant pricing (standard/premium/skipped for V1)
- Messaging cost metering (Telegram/SMS)

---

## 8. LAUNCH READINESS CHECKLIST

### Code
- [ ] All billing API routes implemented and tested
- [ ] Stripe webhook handler verified with Stripe CLI test events
- [ ] Credit purchase flow works end-to-end in Stripe test mode
- [ ] Usage metering wraps all expensive provider calls
- [ ] Billing middleware rejects actions when balance is insufficient
- [ ] Admin billing dashboard functional

### Database
- [ ] Migration 051 runs cleanly on existing SQLite databases
- [ ] Seed data (credit_packages, pricing_configs) inserts without conflicts
- [ ] All new tables have proper workspace_id scoping
- [ ] Indexes created for performance

### Security
- [ ] Stripe webhook signature verification is correct
- [ ] Credit purchase orders are workspace-scoped (can't buy credits for another workspace)
- [ ] Admin billing routes require super-admin role
- [ ] No credits can be granted without a verified webhook
- [ ] Idempotency keys prevent race conditions under load

### Monitoring
- [ ] Failed webhooks alert (webhook events with status='failed' for >1 hour)
- [ ] Stuck purchase orders alert (status='created' for >30 min without completion)
- [ ] Impossible balance alert (available_credits < 0 or sum(ledger) !== available_credits)
- [ ] Abnormal spend alert (workspace spending > 10x daily average)

### Documentation
- [ ] API documentation updated (billing routes added to OpenAPI spec)
- [ ] User-facing docs: how to buy credits, what credits are used for
- [ ] Admin docs: webhook event viewer, manual adjustments

---

## 9. KEY REFERENCE FILES

| File | Purpose |
|------|---------|
| `docs/LAUNCH-RUNBOOK.md` | Production deployment procedures |
| `docs/multitenant-audit.md` | Workspace isolation audit — critical for billing scoping |
| `docs/postgres-migration.md` | SQLite→PostgreSQL migration audit (reference for billing schema adaptation) |
| `docs/performance-audit.md` | API performance analysis |
| `DEPLOYMENT-PREP.md` | Environment variables, smoke tests, rollback plan |
| `CLAUDE.md` | Project conventions, setup instructions |
| `docs/HANDOFF_TO_CLAUDE_CODE.md` | **This file** |
| `docs/CLAUDE_OS_INTEGRATION_PLAN.md` | Claude OS concepts to port (Phase 6) |
| `docs/BILLION_DOLLAR_POSITIONING.md` | Product positioning and pricing |
| `docs/PHASE_HISTORY.md` | Complete development history |

---

*Created by Hermes Agent, 2026-05-22, commit `61c264f` — ready for Claude Code Phase 5C billing implementation.*
