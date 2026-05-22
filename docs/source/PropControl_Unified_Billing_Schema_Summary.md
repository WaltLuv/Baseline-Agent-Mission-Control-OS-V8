# PropControl Unified Billing Schema Summary

> Source: `docs/source/PropControl_Unified_Billing_Schema_Master_Package.pdf`

This document is a complete markdown summary of the PropControl Unified Billing, Credits, and Schema Master Build Package — the founder-ready source of truth for subscriptions, prepaid credits, Stripe, usage metering, Market Swarm, Vendor Swarm, and the full production database schema appendix.

---

## 1. Pricing Model

### Business Model

- **Base subscription tiers** (Growth, Pro, Team) cover platform access: dashboard, CRM, workflows, saved properties, team controls, notifications, and standard app usage.
- **Prepaid credits** are charged for all premium AI, data, and lead-gen actions.
- Features like Alex A.I., Neural Predictor, Visual SOW, RentCast pulls, Market Swarm, Vendor Swarm, Street View qualification, Places discovery, bulk work order analysis, appraisal generation, and exports are **credit-gated**.

### Rules

| Rule | Detail |
|------|--------|
| **Do not switch to credits only** | Keep subscription plans for platform access; layer credits on top |
| **Do not use Stripe as balance SoT** | Stripe confirms money movement; the database controls balances, ledgers, purchase orders, usage logs, swarm tracking, and webhook state |
| **Do not expose raw provider pricing** | Convert blended workflow cost into simple action-based credits |
| **Do not grant credits from success page** | Credits granted only after verified Stripe webhook inserts idempotent deposit ledger entry |

### Credit Packs (Launch)

| Price | Credits | Code |
|-------|---------|------|
| $10 | 1,000 | `starter_1000` |
| $25 | 2,750 | `growth_2750` |
| $50 | 6,000 | `pro_6000` |

### Pricing Principle

Price by **action outcome**, not by exposed token math. Internally calculate wholesale cost across providers, apply markup, then convert to credits. Externally users see simple actions like `Market Swarm Scan - 120 credits`.

---

## 2. Production Build Sequence

| Phase | Focus | Key Deliverables |
|-------|-------|-----------------|
| **1 — Economics & Governance** | Feature classification | Finalize included vs credit-gated features; feature pricing matrix; hard limits for swarms |
| **2 — Database Foundation** | Schema & security | Run unified schema migration; seed `pricing_configs` and `credit_packages`; verify RLS and service-role paths |
| **3 — Stripe Purchase Flow** | Payment integration | Create `credit_purchase_orders` before Stripe sessions; webhook-only credit grant via `deposit_credits()`; success/cancel screens (never client-side credit grants) |
| **4 — Usage Metering** | Billing middleware | Wrap all billable providers behind server-side middleware; write `api_usage_logs`; atomic credit deduction; reserve-then-settle for expensive workflows |
| **5 — UX & Admin Tooling** | User/admin interfaces | Balance widget, usage history, buy-credits page, low-balance modal, auto-reload settings, admin billing dashboard, webhook event viewer, manual adjustments |
| **6 — Launch Controls** | QA & monitoring | Alerts for failed webhooks, duplicate events, stuck POs, impossible balances, missing deductions, abnormal swarm spend; soft launch then open wider |

---

## 3. Schema Tables (Appendix A)

### `users` (modified)

| Column | Type | Purpose |
|--------|------|---------|
| `stripe_customer_id` | `text` | Stripe customer linkage |
| `stripe_payment_method_id` | `text` | Stored payment method for auto-reload |
| `available_credits` | `numeric(18,6)` | Cached balance; fast UI reads only (ledger is SoT) |
| `auto_reload_enabled` | `boolean` | Auto-reload toggle |
| `auto_reload_amount` | `numeric(10,2)` | Default: 10.00 |
| `low_balance_threshold` | `numeric(10,2)` | Default: 2.00 |

### `pricing_configs`

| Column | Type | Purpose |
|--------|------|---------|
| `id` | `uuid` | Primary key |
| `provider` | `text` | Provider name |
| `model_name` | `text` | Model/SKU identifier |
| `cost_per_1k_input` | `numeric(18,8)` | Input token cost |
| `cost_per_1k_output` | `numeric(18,8)` | Output token cost |
| `flat_fee_per_request` | `numeric(18,8)` | Flat per-request fee |
| `markup_multiplier` | `numeric(8,4)` | Default: 2.5 |
| `is_active` | `boolean` | Active/retired toggle |
| `notes` | `text` | Notes |
| `created_at` / `updated_at` | `timestamptz` | Timestamps |

### `credit_packages`

| Column | Type | Purpose |
|--------|------|---------|
| `id` | `uuid` | Primary key |
| `code` | `text` (unique) | Package identifier |
| `name` | `text` | Display name |
| `price_usd` | `numeric(10,2)` | Price in USD |
| `credits_granted` | `numeric(18,6)` | Credits given |
| `is_active` | `boolean` | Active toggle |
| `sort_order` | `integer` | Display order |

### `credit_purchase_orders`

| Column | Type | Purpose |
|--------|------|---------|
| `id` | `uuid` | Primary key |
| `user_id` | `uuid` | FK to `users` |
| `package_id` | `uuid` | FK to `credit_packages` |
| `package_code` / `package_name` | `text` | Package snapshot |
| `price_usd` / `credits_to_grant` / `currency` | `numeric` / `text` | Order details |
| `status` | `text` | `created` \| `checkout_open` \| `paid` \| `failed` \| `canceled` \| `refunded` |
| `stripe_checkout_session_id` | `text` (unique) | Stripe session ID |
| `stripe_payment_intent_id` | `text` (unique) | Stripe PI ID |
| `stripe_invoice_id` | `text` (unique) | Stripe invoice ID |
| `stripe_charge_id` | `text` | Stripe charge ID |
| `client_reference_id` | `text` (unique) | Client ref |
| `request_idempotency_key` | `text` (unique) | Idempotency key |
| `paid_at` | `timestamptz` | Payment timestamp |
| `created_at` / `updated_at` | `timestamptz` | Timestamps |

### `api_usage_logs`

| Column | Type | Purpose |
|--------|------|---------|
| `id` | `uuid` | Primary key |
| `user_id` | `uuid` | FK to `users` |
| `app_feature` | `text` | Feature identifier |
| `workflow_name` | `text` | Workflow label |
| `provider_used` | `text` | Provider name |
| `model_name` | `text` | Model used |
| `input_tokens` / `output_tokens` | `integer` | Token counts |
| `request_units` | `numeric(18,6)` | Request units |
| `is_successful` | `boolean` | Request success |
| `wholesale_cost` / `retail_cost` | `numeric(18,8)` | Cost tracking |
| `metadata_json` | `jsonb` | Extensible metadata |

### `credit_ledger`

| Column | Type | Purpose |
|--------|------|---------|
| `id` | `uuid` | Primary key |
| `user_id` | `uuid` | FK to `users` |
| `transaction_type` | `text` | `deposit` \| `deduction` \| `refund` \| `adjustment` \| `reversal` \| `reserve` \| `release` |
| `amount` | `numeric(18,6)` | Signed amount (non-zero) |
| `reference_type` / `reference_id` | `text` | Reference info |
| `description` | `text` | Human-readable description |
| `metadata_json` | `jsonb` | Extensible metadata |
| `idempotency_key` | `text` (unique) | Dedup key |
| `created_at` | `timestamptz` | Creation timestamp |

### `stripe_webhook_events`

| Column | Type | Purpose |
|--------|------|---------|
| `stripe_event_id` | `text` | Primary key (Stripe event ID) |
| `event_type` | `text` | Stripe event type |
| `livemode` | `boolean` | Live/test mode |
| `api_version` | `text` | Stripe API version |
| `object_id` | `text` | Stripe object ID |
| `processing_status` | `text` | `received` \| `processing` \| `processed` \| `failed` \| `ignored` |
| `processing_attempts` | `integer` | Retry count |
| `last_error` | `text` | Last error detail |
| `payload_json` | `jsonb` | Full webhook payload |
| `received_at` / `processed_at` | `timestamptz` | Timestamps |

### `swarm_runs`

| Column | Type | Purpose |
|--------|------|---------|
| `id` | `uuid` | Primary key |
| `user_id` | `uuid` | FK to `users` |
| `swarm_type` | `text` | `market_swarm` \| `vendor_swarm` |
| `status` | `text` | `queued` \| `running` \| `completed` \| `failed` \| `canceled` |
| `batch_size` | `integer` | Number of targets |
| `search_radius_miles` | `numeric(10,2)` | Search radius |
| `result_cap` | `integer` | Max results |
| `estimated_wholesale_cost` / `actual_wholesale_cost` | `numeric(18,8)` | Cost tracking |
| `estimated_retail_cost` / `actual_retail_cost` | `numeric(18,8)` | Cost tracking |
| `credits_reserved` / `credits_finalized` | `numeric(18,6)` | Reserve-then-settle |
| `leads_found` / `qualified_leads` | `integer` | Lead counts |
| `metadata_json` | `jsonb` | Extensible metadata |
| `created_at` / `updated_at` / `completed_at` | `timestamptz` | Timestamps |

### `swarm_run_steps`

| Column | Type | Purpose |
|--------|------|---------|
| `id` | `uuid` | Primary key |
| `swarm_run_id` | `uuid` | FK to `swarm_runs` |
| `step_name` | `text` | Step label |
| `provider_used` / `model_name` | `text` | Provider and model |
| `status` | `text` | `queued` \| `running` \| `completed` \| `failed` \| `skipped` |
| `input_tokens` / `output_tokens` | `integer` | Token counts |
| `request_units` | `numeric(18,6)` | Request units |
| `wholesale_cost` / `retail_cost` | `numeric(18,8)` | Cost tracking |
| `metadata_json` | `jsonb` | Extensible metadata |

### `swarm_leads`

| Column | Type | Purpose |
|--------|------|---------|
| `id` | `uuid` | Primary key |
| `swarm_run_id` | `uuid` | FK to `swarm_runs` |
| `lead_type` / `name` / `business_name` / `address` / `city` / `state` / `postal_code` / `phone` / `email` | `text` | Lead details |
| `source_provider` | `text` | Origin provider |
| `status` | `text` | `new` \| `qualified` \| `rejected` \| `contacted` \| `archived` |
| `score` | `numeric(10,2)` | Lead score |
| `metadata_json` | `jsonb` | Extensible metadata |

### Row-Level Security (RLS)

All tables except `users` have RLS enabled. Key policies:

- `credit_packages`: SELECT only when `is_active = true`
- `credit_ledger`: SELECT own records (`auth.uid() = user_id`)
- `api_usage_logs`: SELECT own records
- `credit_purchase_orders`: SELECT own records
- `swarm_runs`: SELECT own records
- `swarm_run_steps`: SELECT via join to `swarm_runs` on `user_id`
- `swarm_leads`: SELECT via join to `swarm_runs` on `user_id`

---

## 4. Stripe Webhook Flow

1. **User selects credit pack** on Buy Credits UI
2. **Backend creates** `credit_purchase_orders` row first
3. **Backend creates** Stripe Checkout Session with `purchase_order_id`, `user_id`, `credits_to_grant`, and package metadata
4. **User pays** in Stripe Checkout
5. **Stripe sends** `checkout.session.completed` or async success event
6. **Webhook verifies** signature from raw request body
7. **Webhook writes** `stripe_webhook_events` row (deduped by `stripe_event_id`)
8. **Webhook marks** event as `processing`, then calls `deposit_credits()` with idempotency key tied to Stripe event
9. **Webhook marks** purchase order `paid`, stores Stripe identifiers, optionally saves payment method for auto-reload, marks webhook `processed`
10. **Frontend reads** updated balance from `users.available_credits` and history from `credit_ledger`

### Inviolable Rules

- **Never** grant credits from the success redirect
- **Never** process the same Stripe event twice
- **Never** update balance without an immutable ledger row
- **Never** trust event order — always re-check internal order state

---

## 5. Credit Ledger Rules

- **Ledger-first**: Every balance movement gets a row in `credit_ledger`
- **Idempotency**: Each transaction has a unique `idempotency_key` preventing duplicate grants
- **Immutability**: Never mutate historical ledger rows; corrections must be new rows using `refund`, `reversal`, or `adjustment` types
- **Balance cache**: `users.available_credits` is a fast-read cache only; the ledger is the source of truth
- **Atomicity**: Both `deposit_credits()` and `deduct_credits()` use `FOR UPDATE` row locking
- **Non-zero constraint**: Ledger amounts cannot be zero (`chk_credit_ledger_nonzero_amount`)
- **Reference integrity**: Every credit movement must carry `reference_type`, `reference_id`, `description`, `metadata_json`, and `idempotency_key`

---

## 6. RPC / Database Functions (Appendix B)

### `deposit_credits(p_user_id, p_amount, p_reference_type, p_reference_id, p_description, p_idempotency_key, p_metadata_json)`

- **Returns**: `boolean`
- **Purpose**: Atomic credit deposit with idempotency
- **Behavior**: Validates positive amount, checks for existing ledger entry by idempotency key, locks user row, inserts `deposit` ledger row, increments `available_credits`
- **Called by**: Stripe webhook handler

### `deduct_credits(p_user_id, p_amount, p_reference_type, p_reference_id, p_description, p_idempotency_key, p_metadata_json)`

- **Returns**: `boolean`
- **Purpose**: Atomic credit deduction after successful usage
- **Behavior**: Validates positive amount, checks idempotency, locks user row, checks sufficient balance (returns `false` if insufficient), inserts `deduction` ledger row with negative amount, decrements `available_credits`

### `recalculate_user_credit_balance(p_user_id)`

- **Returns**: `numeric` (the recalculated balance)
- **Purpose**: Admin/repair tool to rebuild cached balance from ledger
- **Behavior**: Sums all `credit_ledger.amount` for the user and writes the total to `users.available_credits`

### `mark_stripe_webhook_processed(p_stripe_event_id, p_status, p_last_error)`

- **Returns**: `void`
- **Purpose**: Updates webhook processing state
- **Behavior**: Increments `processing_attempts`, sets `processing_status`, optionally records error, sets `processed_at` timestamp when status is `processed`

### Recommended Swarm Functions (not yet implemented)

- `reserve_credits_for_workflow(...)` — Reserve estimated credits before expensive workflows
- `finalize_reserved_credits(...)` — Settle actual charge after completion, release unused reserve

---

## 7. Usage Metering & Billing Middleware

Every premium action passes through a **single server-side billing wrapper** that:

1. Identifies user, feature, and workflow
2. Loads active `pricing_configs`
3. Checks balance and blocks early if insufficient
4. Executes provider calls
5. Computes wholesale and retail cost
6. Writes `api_usage_logs`
7. Deducts credits atomically (or reserves for expensive workflows)
8. Evaluates low-balance and auto-reload logic

### Swarm Cost Governance

- Market Swarm and Vendor Swarm are **premium credit-gated** lead-gen workflows
- Each run has a parent `swarm_runs` record and child `swarm_run_steps` records
- Track: Places requests, Street View requests, geocoding requests, leads found, qualified leads, blended cost per run
- **Safeguards**: Preview mode, per-run max results, hard stop limits, daily/monthly spend caps, reserve-then-settle for long runs, estimated credit warnings before execution

### Recommended Swarm Safeguards

- Default preview mode before full lead-gen run
- Per-run max results and hard stop limits
- Daily and monthly spend caps by user and workspace
- Reserve-then-settle credit option for multi-step workflows

---

## 8. QA Checklist

| Test | Purpose |
|------|---------|
| Duplicate webhook replay | Verify idempotency prevents double grants |
| Success redirect with missing webhook | Ensure UI doesn't proceed on phantom credits |
| Duplicate deduction | Prevent double-charging |
| Rapid repeated click | Race-condition protection |
| Insufficient balance | Block actions when balance too low |
| Swarm large-batch cost control | Verify caps and estimates work |
| Balance recalc from ledger | Verify `recalculate_user_credit_balance()` corrects drift |

---

## 9. UI Requirements

### User-Facing

- Dashboard credit balance widget
- Buy Credits page with package cards
- Transaction and usage history
- Low-balance banner and insufficient-balance modal
- Estimated action cost labels for expensive runs
- Auto-reload preferences (phase 2)

### Admin / Founder

- Balance viewer, ledger viewer, usage viewer, purchase orders, webhook log
- Failed webhook retry flow
- Manual adjustment tool and balance recalculation action
- Margin dashboard by feature, provider, and swarm type

---

## 10. Alert Rules

| Alert Condition | Severity |
|----------------|----------|
| Failed Stripe webhooks | High |
| Duplicate events | High |
| Stuck purchase orders (`checkout_open` state) | Medium |
| Impossible balances | Critical |
| Missing deductions | Critical |
| Abnormal swarm spend | High |
| Daily/weekly margin drift | Medium |

---

## 11. Implementation Notes (Appendix C)

1. **Use Appendix A schema as the single source of truth** — do not deviate without explicit founder approval
2. **Use Appendix B functions as the only allowed balance mutation paths** — do not bypass the ledger from application code
3. **Do not let Stripe success URLs update balance** — webhook-only is the rule
4. **Implement webhook verification using the raw request body**
5. **Treat Market Swarm and Vendor Swarm as premium credit-gated workflows** with parent-child cost tracking
6. **Do not use Stripe as the balance source of truth** — database controls balances
7. **Do not expose raw provider pricing to users** — action-based credits only
8. **Seed `credit_packages` with three packs**: Starter ($10/1000), Growth ($25/2750), Pro ($50/6000)
