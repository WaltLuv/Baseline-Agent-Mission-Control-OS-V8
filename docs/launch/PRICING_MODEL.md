# Mission Control — Pricing Model (single source of truth)

**Model: usage-based credits.** There is **no per-agent seat fee** and nothing is a flat
monthly subscription. Customers buy credits; every cost-incurring action debits credits.

## The unit
- **1 credit = $0.01** (`CREDIT_USD_VALUE`, `src/lib/credits-config.ts`).
- **2.5× markup** on raw provider cost → retail (`DEFAULT_MARKUP_MULTIPLIER`, Walt's standing rule).
- Source of truth for rates: `pricing_configs` + `credit_feature_pricing` tables (seeded in `pricing-seeds.ts`). Do NOT hardcode prices elsewhere.

## What gets charged (everything the workforce does)
Metered per `pricing_configs` (`credits_required` per action). Examples (live seed):
| Action | Provider/model | Credits | ≈ USD |
|---|---|---|---|
| LLM inference | Claude Sonnet | 8 | $0.08 |
| LLM inference | Claude Opus | 38 | $0.38 |
| LLM inference | Claude Haiku | 3 | $0.03 |
| LLM inference | GPT-4o | 7 | $0.07 |
| LLM inference | Gemini 2.5 Flash | 1 | $0.01 |
| Voice (TTS) | ElevenLabs | 13 | $0.13 |
| Transcription | Groq Whisper | 2 | $0.02 |
| Image gen | fal | 10 | $0.10 |
| SMS | Twilio | 1 | $0.01 |
| Places lookup | Google | 10 | $0.10 |
| Rent estimate | RentCast | 1 | $0.01 |
| default action | — | 13 | $0.13 |

This covers **skills, AI employees, tool usage, MCP usage, CLI usage, voice/SMS, and every other action** — they all resolve to an LLM/tool call that has a credit rate. An "employee" is just a role that runs these actions; it costs nothing to add and only consumes credits while working.

## Credit packages (launch prices)
| Package | Price | Credits |
|---|---|---|
| Starter | $10 | 1,000 |
| Power | $25 | 2,750 (2,500 + 250 bonus) |
| Pro | $50 | 6,000 (5,500 + 500 bonus) |
| Enterprise | $200 | 25,000 (22,500 + 2,500 bonus) |

## How surfaces should display price (consistency rule)
- **Personas / employees:** "Usage-based · credits · no seat fee" (NOT a $/mo number). ✅ fixed.
- **Skills / marketplace:** show the per-run credit cost from the pricing table.
- **Tools / MCP / CLI:** charged at the underlying action's credit rate.
- Never invent dollar amounts in the UI — read the credit rate from the pricing tables.

## Correction (2026-06-09)
The personas page briefly showed invented $249/$129/$79 **monthly** prices. That was wrong:
not derived from the model, not wired to Stripe. Removed — replaced with the real
usage-based credit model above. Stripe charges only for **credit-package purchases**
(`/api/stripe/checkout`), not per-agent seat fees.

---

## Canonical Provider-Cost Catalog (added 2026-06-11)

**Root cause of the prior revenue risk:** model prices were hardcoded in several
places (`token-cost-calculator`, `token-pricing`, `pricing-seeds`, migration
seeds, `models.ts`) and tied to deprecated models. Stale rates + duplicated
tables meant provider cost could drift above the credits charged.

**Fix:** one canonical source — `src/lib/billing/provider-cost-catalog.ts`.
All credit math derives from it; `token-cost-calculator` now builds its rate
table from the catalog (no separate price list).

### Provider-cost source list (verify before launch, recurring)
- OpenAI — https://openai.com/api/pricing/
- Anthropic — https://www.anthropic.com/pricing#anthropic-api (incl. cache-write / cache-hit)
- Google Gemini — https://ai.google.dev/gemini-api/docs/pricing
- Twilio SMS — https://www.twilio.com/en-us/sms/pricing/us ; Voice — /voice/pricing/us
- ElevenLabs — https://elevenlabs.io/pricing

**Pricing verification date:** `verified` field on every catalog row (currently
2026-06-11). These are list prices to best knowledge and MUST be re-verified
against the live pages before go-live. The margin guard is the backstop.

### Markup formula
```
customer_credits = ceil( provider_cost_usd × SAFETY_BUFFER(1.15) × MARKUP(2.5) / 0.01 )
customer_credits = max(customer_credits, MIN_CHARGE_CREDITS(1))   # round UP, never down
1 credit = $0.01
```
Cost includes: fresh + cached input tokens, **output tokens**, and tool/SMS/
voice/image/search/file/computer-use costs. Unknown models price at the
**most-expensive current model** so they never under-charge.

### Margin-guard rules
- Target gross margin = **60%** (= 1 − 1/markup at 2.5×).
- `assertMarginSafe()` throws `MarginViolationError` for any charge below target.
- Tests (`src/lib/billing/__tests__/credit-pricing.test.ts`) prove every
  workflow is priced above provider cost and ≥ target margin.

### Workflow pricing
Mission Control prices **workflows**, not models. `WORKFLOW_PROFILES` estimates
the work (model + tokens + tools) per workflow; the price is derived from the
catalog — never hand-set. See `workflowMarginTable()`.

### Deprecated-model policy
Deprecated families (GPT-3.5/4/4o, Claude 2/3/3.5, Gemini 1.x/pro, Llama/
Mixtral/PaLM, o1) are: absent from the catalog, not selectable by customers,
not used in seeded defaults or new agent creation, and not used in pricing.
Enforced by `src/lib/models/__tests__/model-catalog-canonical.test.ts`.

### Customer-facing vs internal
- Customers (viewer) see workflow outcomes + friendly tier labels only —
  `/api/models` returns `view:'customer'` with no provider/slug internals.
- Operator/admin (and Baseline OS) see full model/provider/cost detail
  (`view:'advanced'`).
