# Revenue Architecture — Mission Control + Baseline OS

**Principle:** ONE billing engine, TWO pricing narratives.
- **Mission Control** → **outcome-focused** (workflows, portfolio tiers). Customers buy *work completed*, not "AI employees."
- **Baseline OS** → **power-user** (credits, models, providers exposed). Builder product.
- **Internal truth (both):** usage-based **credits** with a **2.5× markup**. Source of truth: `src/lib/credits-config.ts` + `pricing_configs` / `credit_feature_pricing` tables.

---
## 1. Credit model
1 credit = **$0.01** (`getCreditUsdValue`, env `CREDIT_USD_VALUE`). Every cost-incurring action debits the workspace credit ledger (`billing.ts`). Credits are the universal unit behind every narrative.

## 2. Markup model
`applyMarkup(rawCost, 2.5)` — provider wholesale → retail (`DEFAULT_MARKUP_MULTIPLIER`, env-overridable). One place only; never hardcode 2.5 elsewhere. Margin = retail − wholesale ≈ **60%** of retail at 2.5×.

## 3. Stripe flow
`/api/stripe/checkout` → live Checkout **subscription/credit-package** session (price IDs from env). `/api/stripe/webhook` → signature-verified (`STRIPE_WEBHOOK_SECRET`) → on `checkout.session.completed` credits the workspace ledger. **Stripe charges ONLY for credit purchases / plans — never per-agent seat fees.**

## 4. Credit purchases
`credit_packages`: Starter $10/1,000 · Power $25/2,750 · Pro $50/6,000 · Enterprise $200/25,000. (These are the *internal* credit SKUs; MC surfaces them as outcome tiers — §“Narratives”.)

## 5. Auto reload
`/api/billing/autoreload` — when balance < threshold, re-purchase a package automatically (keeps the workforce running). Customer-facing toggle; honest, opt-in.

## 6. Enterprise invoicing
Enterprise tier → invoice/PO path (`/api/billing/purchase-order`) instead of self-serve Checkout. Net terms; credits granted on payment.

## 7. Marketplace purchases
`/api/marketplace/purchase` — skills / agent teams / workflow packages. Charged in credits (or a one-time credit price). Some items free (lead-gen). **Inconsistency:** library/gstack show `$priceUsd` + "Free" — should be credit-denominated (see map).

## 8. Skill purchases
Skills debit credits per run (`credit_feature_pricing`) and/or a one-time install price. Customer sees the *skill*, not the model behind it.

## 9. Voice costs
TTS (ElevenLabs) 13 cr/gen · transcription (Groq Whisper) 2 cr · Telegram/voice turn 1 cr. Rolls up into "Voice Intake / VoiceOps" workflow estimates for MC customers.

## 10. SMS costs
Twilio `sms_outbound` = 1 cr ($0.01 retail / $0.07 wholesale… see table). Rolls into "Tenant Communication / Vendor Dispatch" workflow estimates.

## 11. Provider costs (INTERNAL ONLY — do not show MC customers)
`pricing_configs`: Sonnet 8cr · Opus 38cr · Haiku 3cr · GPT-4o 7cr · Gemini Flash 1cr · image 10cr · places 10cr · rent-estimate 1cr · default 13cr. **Baseline OS may expose these; Mission Control must NOT** — PMs don't care which model ran.

## 12. Margin projections
At 2.5× markup, gross margin ≈ 60% of credit revenue before fixed costs. A PM running ~2,000 maintenance/vendor/owner actions/mo ≈ Growth/Pro tier; provider COGS ≈ 40% of credit spend. Auto-reload smooths revenue; Enterprise invoicing lifts ARPU + retention.

---
## Question matrix
| Question | Answer |
|---|---|
| What generates revenue? | Credit-package purchases + Enterprise invoices + paid marketplace items. |
| What consumes credits? | Every action: LLM tokens, tool/MCP/CLI calls, voice/SMS, image, places, skill runs, agent tasks. |
| What is free? | Adding agents/employees (no seat fee), browsing catalog, the simulation console, viewing proof/replay, onboarding. |
| What is paid? | Execution (credits) + credit packages + premium marketplace packages + Enterprise. |
| What is subsidized? | Demo Mode (dry-run, no real provider spend), free marketplace lead-gen items. |
| Customer-facing? | MC: workflow tiers + outcome estimates. Baseline OS: credits + packages. |
| Internal-only? | Provider/model credit rates, wholesale costs, the 2.5× markup mechanics. |

---
## Pricing narratives (shared engine, different surface)
**Mission Control (outcome tiers — by portfolio, NOT credits/models):**
| Tier | For | (maps to credits internally) |
|---|---|---|
| Starter | Small portfolio operators | Starter pack |
| Growth | Growing management companies | Power pack |
| Professional | Multi-property teams | Pro pack |
| Enterprise | Regional operators | Enterprise / invoice |

MC workflow estimates (show these, not model credits): Maintenance Request · Owner Approval · Vendor Dispatch · Inspection Review · Tenant Communication · Market Swarm Research · Voice Intake — each with an *estimated credit usage range* derived from its action chain.

**Baseline OS (power-user):** credits, packages, provider/model rates, Graphify/Agent Factory/Creative OS usage — full transparency for builders.

---
## UI pricing-language INCONSISTENCY MAP (to reconcile)
| Location | Issue | Fix |
|---|---|---|
| `src/app/app/personas/page.tsx` | ✅ FIXED — was invented $/mo; now "Usage-based · credits · no seat fee". | done |
| `src/app/pricing/page.tsx` | Uses credit-pack names (Starter/Power/Pro) — credit-centric. | MC should present **outcome tiers** (Starter/Growth/Professional/Enterprise) mapped to packs. |
| `src/components/panels/provider-matrix-panel.tsx` | Exposes provider/model + credit costs. | Operator/Baseline-OS only — hide from MC customer view. |
| `src/components/panels/token-dashboard-panel.tsx` | Shows model token credits. | Keep internal/operator; not a customer sales surface. |
| `src/app/app/library/page.tsx`, `gstack-import-panel.tsx` | "Free" / `$priceUsd` dollar labels on skills. | Denominate in **credits**; reframe "Free" as "included". |
| `src/app/marketplace/page.tsx`, `page.tsx` (homepage) | Stray "/mo" language. | Audit + align to credits/outcome tiers (no monthly seat language). |
| `billing-panel.tsx` | Shows credits + model detail. | Fine as operator billing; ensure customer view rolls up to workflows. |

**Next reconciliation pass (not done here — audit only):** build MC outcome-tier pricing page + workflow credit estimates; gate provider/model rate displays to Baseline OS / operator role; convert marketplace $ labels to credits.

---

## Single source of truth for cost (added 2026-06-11)

Provider costs are centralized in `src/lib/billing/provider-cost-catalog.ts`
and credit/margin math in `src/lib/billing/credit-pricing.ts`. No module
hardcodes model prices anymore. See `docs/launch/PRICING_MODEL.md` for the
source list, verification date, markup formula, margin guard, workflow pricing,
and deprecated-model policy. Revenue-safety tests live in
`src/lib/billing/__tests__/credit-pricing.test.ts`.
