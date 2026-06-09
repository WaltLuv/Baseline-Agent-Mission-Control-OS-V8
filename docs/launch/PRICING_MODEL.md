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
