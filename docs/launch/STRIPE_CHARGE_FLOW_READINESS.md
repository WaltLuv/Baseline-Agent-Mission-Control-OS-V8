# Stripe Charge-Flow Readiness — Mission Control

**Date:** 2026-06-09 · **Verdict:** code COMPLETE · config INCOMPLETE (no real money can move until config + a public URL exist).

## What's already built (✅ code complete)
- `src/lib/stripe-client.ts` — `getStripeClient()` (live when `STRIPE_SECRET_KEY` set), `isLiveStripeMode()`, `getWebhookSecret()`. Stripe SDK installed (apiVersion 2025-03-31.basil).
- `POST /api/stripe/checkout` — creates a real Stripe **Checkout subscription session** (`mode: subscription`, price + quantity, `customer_email`); test mode short-circuits to instant credits.
- `POST /api/stripe/webhook` — **verifies the Stripe-Signature** against `STRIPE_WEBHOOK_SECRET`; handles `checkout.session.completed` / `async_payment_succeeded`; rejects unsigned/invalid (400). (Legacy unsigned handler was removed.)
- Billing ledger + credits + markup + autoreload already live (`/api/billing/*`).

## What's still needed (🟡 config — no code changes)
1. **Webhook secret:** set `STRIPE_WEBHOOK_SECRET=whsec_…` (from the Stripe dashboard webhook endpoint). Until set, live webhooks are rejected ("live mode not configured").
2. **Price IDs:** create live Prices in Stripe and set `STRIPE_PRICE_STARTER_MONTHLY/ANNUAL` and `STRIPE_PRICE_GROWTH_MONTHLY/ANNUAL`. Checkout can't build line items without them.
3. **Registered webhook endpoint:** in the Stripe dashboard, point a webhook at `https://<your-domain>/api/stripe/webhook` for `checkout.session.completed` + `*_payment_succeeded` → requires a **public production URL** (depends on the deploy blocker).
4. **Key rotation (blocking for paid prod):** the `sk_live` key was exposed in git history — rotate before charging real customers.

## Local status
- `STRIPE_SECRET_KEY` + `STRIPE_PUBLISHABLE_KEY` present (live, validated read-only). `STRIPE_WEBHOOK_SECRET` + `STRIPE_PRICE_*` **unset** → checkout/webhook not exercisable end-to-end locally without a tunnel.

## To go live (order)
1. Create live Prices → set 4 `STRIPE_PRICE_*` env vars.
2. Deploy to a public URL (deploy blocker).
3. Register the webhook endpoint → set `STRIPE_WEBHOOK_SECRET`.
4. Rotate the exposed `sk_live` key, revoke the old one.
5. Run one real test purchase end-to-end → confirm `checkout.session.completed` credits the workspace.

**Bottom line:** the charge flow is implemented and signature-secure; it needs **Prices + webhook secret + a public endpoint + key rotation** — all configuration/ops, not engineering.
