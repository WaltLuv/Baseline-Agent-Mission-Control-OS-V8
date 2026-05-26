# Billing Overhaul — Token Monetization Fix

## What was broken
- `creditsRequired = 0` when no pricing config found → users charged free
- No markup applied to provider costs → you paid LLMs, made $0
- `pricing_configs` table never seeded

## What is fixed
1. `token-cost-calculator.ts` — Real provider rates × 2.5x markup → retail credits
2. `pricing-seeds.ts` — 14 providers, 4 credit packages, 12 feature-level prices
3. `billing.ts` — 3 cost modes (token/custom/config). Dual safety fallbacks. **Never charges zero.**
4. Migration 031 — Seeds configs, adds missing DB columns
5. `/api/billing/margin` — Wholesale vs retail profit tracking
6. `seed-billing-data.ts` — Seeding script

## Revenue Flow
Agent consumes tokens → `calculateTokenCosts()` (wholesale) → `getPricingConfig()` (2.5x markup) → `credits charged` → margin tracked

## Install
1. `pnpm tsx scripts/seed-billing-data.ts` after migrations
2. Deploy updated code
