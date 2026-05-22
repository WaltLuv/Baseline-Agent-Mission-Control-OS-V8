# Billion-Dollar PropControl Strategy Summary

> Source: `docs/source/PropControl_Billion_Dollar_Strategy.pdf`

This document is a comprehensive markdown summary of the PropControl Billion-Dollar Billing, Credits, Pricing, and Schema Master Build Package — the unified founder package for usage-based billing, Stripe credit top-ups, Supabase ledger architecture, complete schema appendix, swarm governance, messaging costs, and production rollout.

---

## 1. Executive Strategy & Product Positioning

### Core Commercial Model

PropControl operates on a **three-layer revenue architecture**:

| Layer | What It Covers | Revenue Logic |
|-------|---------------|---------------|
| **Growth / Pro / Team** (subscription) | Platform access, CRM, saved properties, dashboards, workflows, seats, support | Predictable MRR — the recurring base |
| **Credit Packs** (prepaid) | Prepaid credits for AI, data, messages, vision, swarms | Usage revenue and margin protection |
| **Premium Variants** (upsell) | Heavier reasoning, bigger swarms, richer exports, larger image/vision jobs | Upsell path from standard workflows |

### Why This Model

- **Protects recurring revenue** — base subscriptions cover platform access
- **Prevents margin bleed** — expensive providers (Gemini, Google Places, Street View, RentCast, Twilio, Telegram bot, vision workflows) are paid for by the users who consume them
- **Scales with usage** — heavy users pay proportionally more, light users aren't penalized
- **Enables premium upsells** — standard → premium variants for power users

### Core Rules

- **Charge by workflow outcome**, not by raw provider calls or token math
- **Keep all provider costs configurable** in database pricing tables — change pricing without redeploying
- **Use standard, premium, and swarm-enriched variants** where cost profiles differ materially
- **Apply minimum batch charges** for expensive workflows (swarms, bulk analysis)
- **Show estimated credit usage** before expensive runs and low-balance warnings before users hit zero
- **Market Swarm and Vendor Swarm are premium** — not included in subscription
- **Telegram bot and Twilio SMS are separately metered** — costs distinct from model inference
- **Never grant credits from the frontend** — only after verified Stripe webhook + durable ledger write

---

## 2. Pricing Philosophy

### Pricing Principle

> Price by **action outcome**, not by exposed token math.

- Internally: calculate wholesale cost across providers, apply markup, convert to credits
- Externally: users see simple action-based pricing like `Visual SOW: 18 credits`, never internal provider math
- Default retail basis: **1 credit = $0.01** (tuned later based on real cost logs, margin by feature, provider cost drift)

### Markup Strategy

- Default markup: **2.5x** across most providers
- Telegram bot: **2.0x–2.5x** (bot-specific operating cost and AI overhead)
- Export rendering: **2.0x–2.5x** (PDF/report packaging jobs)
- All markup stored in `pricing_configs` table — adjustable without code changes

### Minimum Charges

| Feature | Minimum |
|---------|---------|
| Bulk Property Analysis | 25 credits minimum batch charge |
| Market Swarm | 40 credits minimum |
| Vendor Swarm | 40 credits minimum (estimated credits shown before launch) |
| All other features | Feature-specific minimum equals charge unit |

### Pricing Guardrails

- Bulk Property Analysis: 25-credit minimum batch charge
- Swarm runs: show estimated credits before launch
- Premium variants only trigger when stronger models, larger result caps, richer exports, or heavier vision generation are used
- Users never see token math — only action-level credit prices

---

## 3. Revenue Architecture

### Feature Pricing Table (Complete)

The full PropControl usage-based pricing table covers **8 feature families** across **standard and premium variants**:

#### Core Analysis (`core_analysis`)

| Feature | Variant | Unit | Credits | Retail | Notes |
|---------|---------|------|---------|--------|-------|
| Rent Estimate | standard | per property | 8 | $0.08 | Single-property rent estimate with light AI formatting |
| Appraisal Report | standard | per report | 35 | $0.35 | Standard valuation-style narrative report |
| Appraisal Report | premium | per report | 50 | $0.50 | Heavier reasoning or map-enriched version |
| Comps Explorer Run | standard | per run | 12 | $0.12 | Charge only on executed run or refresh |
| AI Underwriting | standard | per report | 20 | $0.20 | Deal summary, risk/reward, scenario analysis |
| AI Underwriting | premium | per report | 30 | $0.30 | Advanced reasoning or deeper scenario set |
| Bulk Property Analysis | standard | per property | 6 | $0.06 | 25-credit batch minimum required |
| Bulk Property Analysis | swarm-enriched | per property | 9 | $0.09 | When map/swarm enrichment is included |
| Export / Report | standard | per export | 5 | $0.05 | Standard PDF/CSV/XLSX |
| Export / Report | premium_investor_packet | per export | 10 | $0.10 | Branded investor packet |

#### PM Workflows (`pm_workflows`)

| Feature | Variant | Unit | Credits | Retail | Notes |
|---------|---------|------|---------|--------|-------|
| Service SOW + Owner Approval Email Generator | standard | per package | 14 | $0.14 | Scope of work + owner-facing approval email |
| AI Scripts Generator | standard | per script set | 10 | $0.10 | Leasing, owner, vendor, PM, or sales scripts |
| Voice-to-Text SOW Generator | standard | per converted output | 12 | $0.12 | Audio → transcript → structured SOW |
| Rehab Studio SOW + ARV + ROI Generator | standard | per report | 30 | $0.30 | Combines SOW, investment math, narrative |

#### Vision & Rehab (`vision_rehab`)

| Feature | Variant | Unit | Credits | Retail | Notes |
|---------|---------|------|---------|--------|-------|
| Visual SOW Generator | standard | per visual run | 18 | $0.18 | Vision-assisted scope generation |
| Visual SOW Generator | premium | per visual run | 25 | $0.25 | Higher image count or stronger reasoning |
| Deep Rehab Analyzer + Before/After Photos Generator | standard | per project | 45 | $0.45 | Heavy vision + image generation workflow |
| AI Interior Design Generator | standard | per room | 16 | $0.16 | Per-room or concept |
| AI Interior Design Generator | premium_3_room_pack | per pack | 40 | $0.40 | Three-room pack for better UX |
| Premium Rehab Design Pack | premium | per pack | 50 | $0.50 | Expanded before/after and design concept package |

#### Swarms (`swarms`)

| Feature | Variant | Unit | Credits | Retail | Notes |
|---------|---------|------|---------|--------|-------|
| Market Swarm Run | standard | per run | 40 | $0.40 | Base neighborhood / market lead sweep |
| Market Swarm Run | premium | per run | 60 | $0.60 | Larger radius, more results, richer enrichment |
| Vendor Swarm Run | standard | per run | 30 | $0.30 | Base vendor discovery sweep |
| Vendor Swarm Run | premium | per run | 50 | $0.50 | Higher result cap, more enrichment |

#### Messaging & Bot (`messaging_bot`)

| Feature | Variant | Unit | Credits | Retail | Notes |
|---------|---------|------|---------|--------|-------|
| Telegram Bot Usage | standard_turn | per turn | 3 | $0.03 | Standard bot turn replacing Alex AI |
| Telegram Bot Usage | premium_turn | per turn | 5 | $0.05 | Longer reasoning or premium workflow turn |
| SMS Send via Twilio | standard_outbound | per message | 2 | $0.02 | Outbound SMS baseline |
| SMS Conversation Follow-up Pack | standard_pack | per 5-msg sequence | 10 | $0.10 | Workflow pack pricing |
| SMS + AI Reply Assist | standard_assisted_message | per message | 4 | $0.04 | AI drafting, classification, assisted response |

#### Seed Tables

Two seed tables are defined as the starting point for database-driven pricing:

- **`credit_feature_pricing`** — maps each feature + variant to credits, charge unit, and minimum charge (30+ rows covering all features above)
- **`pricing_configs`** — maps each provider to cost basis and markup (12 providers: Gemini text, Gemini vision, Google Places, Google Street View, Google Geocoding, RentCast, Twilio SMS, Telegram Bot, Voice Transcription, Image Generation, Export Rendering)

---

## 4. Purchase Flow & Webhook Architecture

### 10-Step Purchase Sequence

1. User selects credit package from Buy Credits UI
2. Backend creates `credit_purchase_orders` row (before Stripe Checkout)
3. Backend creates Stripe Checkout Session with metadata (`purchase_order_id`, `user_id`, `package_id`, `credits_to_grant`)
4. User completes payment in Stripe Checkout
5. Stripe sends webhook to raw-body webhook endpoint
6. Webhook verifies Stripe signature, persists `stripe_webhook_events`, dedupes by `stripe_event_id`
7. Webhook calls `deposit_credits(...)` using idempotency key tied to Stripe event
8. `credit_ledger` receives deposit row; `users.available_credits` incremented atomically
9. Purchase order marked `paid`; payment method saved for future off-session auto-reload
10. Frontend refreshes balance and transaction history from database state

### Webhook Rules

- **Never** grant credits from the frontend success redirect
- **Never** process a Stripe event twice
- **Never** update balance without a ledger row
- Use both success and async success webhook events for fulfillment

### Auto-Reload (Phase 2)

- User must opt in and have a stored payment method
- Package-based reload amounts (not arbitrary)
- Cooldown windows and recent-attempt checks to prevent duplicate reloads
- Log all reload attempts, failures, and resulting credit grants
- Notify user on failure — do not loop retries blindly
- **Enable only after core billing flows are stable**

---

## 5. Platform Vision

### Database as Source of Truth

> Stripe is only the money movement trigger; all durable state lives in Supabase/Postgres.

The database is the authoritative record for:
- Balances and credit ledgers
- Purchase orders and webhook state
- API usage logs and swarm tracking
- Pricing configurations (changeable without redeploy)

### Billing Middleware

All premium features pass through **one shared billing middleware** that:

1. Identifies authenticated user + feature/variant
2. Loads active pricing configs
3. Estimates credits and blocks early if insufficient
4. Reserves estimated credits for expensive workflows
5. Executes provider calls
6. Captures raw usage metrics (tokens, request units, images, SMS segments, minutes)
7. Calculates wholesale cost from `pricing_configs`
8. Applies markup and derives retail charge
9. Inserts `api_usage_logs` rows
10. Deducts credits atomically or finalizes reserved credits
11. Triggers low-balance and auto-reload logic
12. Returns results with user-friendly action descriptions

### Reserve-Then-Settle

Used for:
- Market Swarm
- Vendor Swarm
- Deep Rehab Analyzer + Before/After Photos Generator
- Large Bulk Property Analysis runs
- Large image-heavy Visual SOW or Interior Design workflows

### Metadata Conventions by Feature Type

| Feature Type | Metadata Fields |
|-------------|----------------|
| SMS | `message_segments`, `destination_country`, `sender_type`, `carrier_fee_estimate` |
| Telegram bot | `turn_length`, `conversation_id`, `intent_type` |
| Voice-to-text | `audio_minutes`, `transcript_length`, `transcript_confidence` |
| Vision / design | `images_processed`, `images_generated`, `vision_mode`, `generation_variant` |
| Rehab / investment | `property_value_inputs`, `arv_estimate`, `roi_estimate`, `rehab_scope_size` |
| Swarms | `places_requests`, `street_view_requests`, `geocode_requests`, `leads_found`, `qualified_leads`, `cost_breakdown_json` |

---

## 6. Ledger & RPC Functions

### Core Functions

| Function | Purpose |
|----------|---------|
| `deposit_credits(...)` | Atomic credit deposit with idempotency key and ledger-first write (called by Stripe webhook) |
| `deduct_credits(...)` | Atomic deduction after usage logging — lock row, check balance, insert ledger row, decrement |
| `recalculate_user_credit_balance(...)` | Admin/repair tool — rebuilds cached balance from ledger sum |
| `mark_stripe_webhook_processed(...)` | Updates webhook state, attempts, and error details |
| `reserve_credits_for_workflow(...)` (recommended) | Reserve estimated credits before expensive workflows |
| `finalize_reserved_credits(...)` (recommended) | Settle actual charge after completion, release unused reserve |

### Ledger Rules

- **Never mutate historical ledger rows** — corrections are new rows using `refund`, `reversal`, or `adjustment` types
- **Never trust frontend balance alone** — `users.available_credits` is a cache; the ledger is the truth
- **Every credit movement** must carry `reference_type`, `reference_id`, `description`, `metadata_json`, and `idempotency_key`
- **Refunds or disputes** create reversing ledger rows and may drive accounts negative if credits were already consumed

---

## 7. Frontend UX & Admin Operations

### User Experience Requirements

- Credit balance widget in dashboard header and billing page
- Buy Credits page with active packages, Stripe Checkout, and success/cancel states
- Transaction history UI backed by `credit_ledger` (deposits + deductions)
- Usage history filters by feature family and variant
- Estimated credit cost shown before expensive actions
- Low-balance warning when below threshold
- Insufficient-credits modal before expensive runs
- Auto-reload settings page with opt-in, threshold, and package amount selection

### Admin / Ops Requirements

- Admin billing dashboard: balances, ledger, purchase orders, usage logs, webhook history, failed workflows
- Manual credit adjustment tool and balance recalculation action
- Revenue by feature, margin by feature, cost by provider, cost by swarm type, cost-per-lead reporting
- Top users by SMS burn, Telegram bot burn, image/vision burn, swarm burn
- Pricing config updates without redeploy

### Observability & Alerts

- Alert on failed Stripe webhooks
- Alert on stuck purchase orders in `checkout_open` state
- Alert on deduction failures or impossible balances
- Alert on abnormal provider cost spikes and high-cost workflow failures
- Daily/weekly reporting: credits sold, credits consumed, wholesale cost, revenue, gross margin by feature

---

## 8. QA Requirements

| Test Area | Specific Tests |
|-----------|--------------|
| Purchase flow | Successful purchase; duplicate webhook replay; success redirect without webhook |
| Deductions | Insufficient balance; duplicate deduction prevention |
| Race conditions | Rapid repeated click / multi-tab race-condition |
| Messaging | SMS single send and pack deduction; Telegram standard and premium turn deduction |
| Vision/Design | Visual SOW, Deep Rehab, Interior Design deduction tests |
| Voice/Rehab | Voice-to-Text SOW and Rehab Studio deduction tests |
| Swarms | Market Swarm and Vendor Swarm standard/premium deduction; reserve-then-settle correctness |
| Repair | Ledger recalculation repair test |

---

## 9. Built vs Specified vs Still-Needs-QA

| Area | Status | What Still Needs to Happen |
|------|--------|--------------------------|
| Billing model + credit packs | SPECIFIED | Finalize production values and ship |
| Database schema + functions | SPECIFIED | Run migrations in staging and production |
| Stripe checkout purchase flow | SPECIFIED | Build endpoint and test end-to-end |
| Webhook idempotency + atomic deposit | SPECIFIED | Implement webhook route and retry handling |
| Transaction history UI | SPECIFIED | Build frontend screen and verify correctness |
| Low balance warning | SPECIFIED | Wire frontend threshold logic |
| Auto-reload | SPECIFIED (phase 2) | Implement only after core billing proves stable |
| Swarm governance + reserve/settle | SPECIFIED | Implement workflow reservations/finalization |
| SMS / Telegram pricing and logging | SPECIFIED | Implement provider-specific logging and tests |
| Admin dashboard + observability | SPECIFIED | Build internal tools and alerts |

---

## 10. Build Order for the Agent

1. Run schema migration in staging
2. Seed `pricing_configs`, `credit_packages`, and `credit_feature_pricing`
3. Implement `deposit_credits` and `deduct_credits` integrations
4. Build purchase order creation endpoint and Stripe Checkout endpoint
5. Build raw-body Stripe webhook endpoint with idempotency and ledger deposit
6. Ship billing page, balance widget, and transaction history UI
7. Wrap Rent Estimate, Appraisal Report, Comps Explorer, AI Underwriting, Export / Report in billing middleware
8. Wrap Service SOW, Visual SOW, Telegram Bot Usage, SMS usage
9. Wrap Voice-to-Text, Rehab Studio, Deep Rehab Analyzer, Interior Design features
10. Wrap Market Swarm and Vendor Swarm using reserve-then-settle
11. Add admin dashboard, alerts, and margin reporting
12. Enable auto-reload only after full billing system is stable
13. Run staging QA, soft launch, review margins, then broaden release

---

## 11. Implementation Brief for Emergent AI Agent

> Build PropControl using this document as the single source of truth.

- **Commercial model**: Keep Growth / Pro / Team as base subscriptions; use prepaid credits for all premium AI, data, messaging, vision, and swarm usage
- **Credit table**: Use the default credit table as starting retail pricing; keep provider pricing configurable in database tables
- **Source of truth**: Supabase/Postgres — Stripe Checkout handles credit purchases; verified Stripe webhooks trigger atomic `deposit_credits()` ledger writes
- **Never** grant credits from the frontend success redirect
- **Every premium feature** must pass through one shared billing middleware
- **Market Swarm and Vendor Swarm** must be credit-gated and cost-governed
- **Use reserve-then-settle** for large swarm and image-heavy workflows
- **Log provider usage** in `api_usage_logs` and swarm child tables
- **Build user-facing** balance, transaction history, low-balance warnings, and action-cost labels
- **Build admin tools** for ledger review, webhook review, pricing updates, and balance repair
- **Auto-reload is phase 2** — only after core billing is stable
- **Do not deviate** from schema, ledger rules, or webhook rules without explicit founder approval
