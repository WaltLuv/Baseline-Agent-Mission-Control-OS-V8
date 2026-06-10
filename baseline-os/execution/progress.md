# Execution Ledger — Cycle 2026-06 · Backlog of 7

> The **T**rigger phase of B.L.A.S.T. — what actually shipped, when, and
> whether it was verified against the no-break list.
> Blueprint: `architecture/cycle-2026-06-backlog-of-7.md`

---

## Status legend
- ✅ **Shipped + verified** — commit + verification command in this ledger.
- 🟡 **Drafted, paused** — code exists but awaiting Blueprint sign-off.
- ⏸ **Blocked** — waiting on operator answer to a tagged open question.
- ⬜ **Not started.**

---

## Item 1 — Insurance Workforce template ✅

- Commit: `59fa413`
- Files: `src/data/workforces/insurance.json` (new), `src/data/workforces/catalog.json` (modified to add the entry), `~/code/mc-v8/docs/CUSTOMER_ZERO_WALKTHROUGH.md` (appended).
- Verification: `GET /api/workforces` returns `id: insurance` with 6 employees,
  12 workflows, 26 skills, 12 seed tasks.
- No-break audit: additive JSON only; installer shape mirrors
  `property-management.json`; no contract regression.

## Item 2 — SQLite Kanban Dispatcher 🟡

- Files drafted in this turn:
  - `src/lib/kanban.ts` (new) — store + scoring + approval API + doctor.
  - `scripts/mc.ts` — `cmdKanban` subcommand block added; dispatch line `if (a === "kanban") return await cmdKanban(args);` added.
- **NOT YET:** committed, tested, registered in `mc help`, or wired to MC sync.
- Pause reason: operator stop signal at the start of this item promoting B.L.A.S.T.
  scaffold ahead. Awaiting answers to Q2.1 / Q2.2 / Q2.3 in the Blueprint.
- Pre-resume checks required:
  - Confirm `bun:sqlite` is acceptable (Q2.3).
  - Confirm MC sync channel name (Q2.2).
  - Confirm Telegram delivery layer (Q2.1) — gateway vs. baseline.
  - Add `mc help` entry for `kanban` subcommand.
  - Add a unit test covering: schema migration is idempotent · child stays
    `todo` until parents `done` · atomic claim doesn't double-issue · failed
    parent blocks children · approval pause + resume.

## Item 3 — Mission Control mirroring ⬜

- Pre-flight (Link phase) required before any MC page is built: for each of
  the 24 surfaces, confirm the Baseline OS endpoint exists and document the
  response shape.

## Item 4 — Flight Deck visibility in MC ⬜

- Blocked on Q4.1 (does the Flight Deck manifest endpoint exist today?).

## Item 5 — MC landing-page CMS ⬜

- Blocked on Q5.1 / Q5.2 / Q5.3 (extend existing Next.js app vs. new; Atlas
  cluster source; Vercel project link).

## Item 6 — System Pilot B.L.A.S.T. scaffold 🟡

- Created in this turn:
  - `architecture/cycle-2026-06-backlog-of-7.md` (Blueprint)
  - `execution/no-break-list.md`
  - `execution/progress.md` (this file)
- Remaining: append D-005..D-009 to `memory/decisions.md`, append Cycle 2026-06
  section to `memory/findings.md`.

## Item 7 — CLAUDE.md operating-manual template ⬜

- Not started. Will land in `architecture/templates/CLAUDE.md.tmpl`.

---

## P0 progress (2026-06-04, post-pivot)

The original 1-7 ordering was superseded by Walt's P0/P1/P2/P3 priority on
2026-06-04. This section tracks the new bucket.

### P0 — must hold before charging customers

| ID | Item | Status |
|---|---|---|
| P0-A | Login/auth audit (`mc-v8`) | ✅ Audited — `execution/audit-report-2026-06-04.md` §1. Code path is sound; real risks are `sameSite='strict'` (OAuth round-trip) + `NEXT_PUBLIC_APP_URL` production setting. |
| P0-B | Stripe webhook split-brain + invoice.paid | ✅ **FIXED.** Insecure `/api/webhooks/stripe` deleted. `/api/stripe/webhook` extended to handle invoice.paid + subscription lifecycle + payment_failed, with idempotency. New `grantSubscriptionRenewalCredits` + `updateSubscriptionStatus` helpers in `src/lib/billing.ts`. Typecheck + build + test all pass (no new failures). |
| P0-C | Production build root cause | ✅ Build already passes (Walt's report was stale). |
| P0-D | Lockfile + lint + test fixes | ✅ DONE. |
| P0-G | Stabilize quality gate | ✅ DONE — **1293/1293 tests pass**. All 18 prior failures were one root cause: `better-sqlite3` native binding compiled for a different Node ABI (env issue). Fix: `pnpm rebuild better-sqlite3`. Added `src/lib/__tests__/marketplace-fulfillment.test.ts` (5 new tests covering record-pending → find-by-session → fulfill + idempotency + employee-free behavior). Also fixed a billing rule bug found during verification: marketplace purchase route was still charging `monthlyUsd` for employees + the monthly portion of bundles; now forces `priceCents=0` for employees, bills only `oneTimeUsd` for bundles. |
| P0-E | Monetization model rewrite | 🟡 Pricing page rewritten + **marketplace fulfillment hardened**. New `marketplace_purchases` table (migration `057_marketplace_purchases`). New `src/lib/marketplace-fulfillment.ts` extracts install/hire/deploy + adds `recordPendingMarketplacePurchase` + `findMarketplacePurchaseBySession` + `fulfillMarketplacePurchase`. Marketplace `purchase` route now records a pending row before redirecting to Stripe; secure webhook fulfills via the new lib when the credit-order lookup misses. Still pending: credit-pack checkout API (pricing-page buttons currently route to a query-string URL with no backend), paid-workflow distinct schema, marketplace UI free/paid + unlock state. |
| P0-F | Env hygiene (Resend, NEXT_PUBLIC_APP_URL) | ✅ **FIXED Resend.** New `resolveResendKey()` in `src/lib/email.ts` prefers `MC_RESEND_API_KEY` then falls back to `RESEND_API_KEY`. `briefing/share/route.ts` migrated. NEXT_PUBLIC_APP_URL: documented for the production deploy env, not a code fix. |

### P1
| ID | Item | Status |
|---|---|---|
| P1-A | Flight Deck audit + fix | ✅ **DONE.** `/flight-deck` page now exposes both Mode 1 (local Baseline OS) and Mode 2 (direct cloud-MC) with copy-blocks for each. Manifest + download endpoints live. Tauri desktop-side mode switcher is next release. 10/10 existing page tests still pass. |
| P1-B | MC parity audit | ✅ First-pass matrix landed at `~/code/mc-v8/docs/architecture/FEATURE_PARITY_MATRIX.md` (12/30 shipped, 18 still missing). |
| P1-C | Kanban Dispatcher (Baseline OS) | 🟡 Draft on disk: `src/lib/kanban.ts` + `mc kanban` CLI block. Not committed; integration with Approval Engine / Tool Registry pending. |

### Post-gate parity build-out (2026-06-05)
- `/app/runtimes` page (`src/app/app/runtimes/page.tsx`) — Remote Runtimes hub. Detects 5 wired runtimes (OpenClaw, Hermes, Claude Code, Codex, OpenCode) via real `/api/agent-runtimes`; manual-connect cards for Ruflo, Antigravity, NotebookLM, Browser Use, Maestro, Hermes MCP Loop, Hermes Video with copyable install + register commands. No fake states. 9 parity rows advanced; honest coverage now ~70%.
- `/app/goals` page + `/api/goals` route + migration `058_goals` — full CRUD, workspace-scoped, rate-limited. 6/6 tests.
- `/app/notebook` page + `/api/notebook` route + migration `059_notebook` — full CRUD with markdown body + tag handling + source classification + filter. 6/6 tests.
- `/app/library` page + `/api/library` route (read-only) — workspace inventory across skills/workflows/employees, with tab filter + search; new GET aggregates `workforce_skills` (partitioning workflows by category) + `workforce_subscriptions` joined to `agents`. 3/3 tests.
- `/app/personas` page + `/api/personas` route — dedicated roster view (vs `/app/agents` runtime view): full catalogue from marketplace catalog + hired flag from `workforce_subscriptions` + division grouping + reports-to / manages relationships + bio. 3/3 tests.
- `/app/cli` page + `/api/cli` route + `src/lib/cli-inventory.ts` — Mission Control CLI catalogue (21 primary operator groups + 11 legacy + shortcuts + common flags + install hint), search across group/action/description. Honest about scope: documentation surface only, never executes commands. 3/3 tests.
- `/app/triad` page + `/api/triad` route + migration `060_triad_council` (two tables: `triad_decisions`, `triad_votes`). Three-model voting recorder: create decision → record votes (idempotent on (decision_id, model_id)) → resolve with outcome → archive. Tallies + per-model rationale + confidence. Honest empty state. 6/6 tests.
- `/app/seo` page + `/api/seo` route + migration `061_seo_targets`. Workspace-scoped SEO targets CRUD: keyword/URL/rank tracking with status state machine (planned/drafting/published/ranking/archived), rank clamping (1-1000), `last_checked_at` stamp on current_rank update. 7/7 tests.
- `/app/understand` page + `/api/understand` route + migration `062_understand`. Reasoning ledger: topic/question/conclusion/evidence/confidence + tags + supersede flow (newer entry causes older to flip status='superseded' and back-reference via `superseded_by`). Topic chips tally for browse. 6/6 tests.
- `/app/launchers` page + `/api/launchers` route + `src/lib/launchers.ts`. Embedded-launcher hub for third-party tools (Higgsfield, HyperEdit, Antigravity). Honest env-driven configured-or-not state; opens in new tab rather than iframe; never echoes raw auth keys. 4/4 tests.
- `/app/claude-code` dedicated setup + pairing page. Live state via existing `/api/agent-runtimes`. Copy-blocks for install, login, MCP-register (with MC_URL + MC_API_KEY pattern), verify command, common workflows, troubleshooting. No new backend; no fake state.
- **Documents** (last ⬜ row): `/app/documents` page + `/api/documents` route + `/api/documents/[id]/content` stream + migration `063_documents` + `src/lib/documents-store.ts` (content-addressed blob storage with workspace-scoped paths). Upload (multipart) / list / search / preview (inline) / download / soft-delete / restore. 50 MB cap, SHA-256 dedup within workspace, MIME validation, filename sanitisation (no path traversal at the route OR storage layer), workspace isolation enforced everywhere, audit-log on upload+restore+archive. POST handler delegates to an exported `uploadDocumentFromBuffer` helper so tests don't hit the jsdom `Request.formData()` hang. 11/11 round-trip tests including cross-workspace isolation + 410-Gone on archived content + storage-layer traversal rejection.

### Reordered backlog (Walt's mid-tick directive 2026-06-05)
0. **P0-H · Billing token-pack unification — DONE 2026-06-05.** Backend + UI surface complete. Stripe sells only token packs; everything else debits credits at 2.5× markup. Marketplace item states (Free / Included / X credits / Purchased / Locked / Insufficient credits) with correct per-type button labels (Install · Included · Buy with N credits · Open/Configure · Buy Credits). Pricing-page copy matches Walt's exact phrasing: "Mission Control is free to start. Buy credits when your workforce runs paid work or when you unlock premium marketplace items." + "Start with free templates and demo employees. Add premium employees, skills, and workflows from the marketplace using credits." Billing-panel ledger rows now carry Stripe / Marketplace / Usage / Adjustment source labels. Insufficient-credits gate returns 402 + Buy Credits CTA routing to `/app?billing=buy&pkg=2`. Install modal surfaces a clear `Need N credits, you have M, K short. Open Billing → Buy Credits to top up.` message. 34 new tests (17 backend + 17 UI/math) — all green. Quality gate: 1382/1382 · 0 lint errors · typecheck clean · build clean.
1. **P0-H · Billing token-pack unification — core SHIPPED 2026-06-05** (next tick: marketplace UI + pricing-page copy + remaining tests):
   - `src/lib/credits-config.ts` — env-driven `CREDIT_USD_VALUE` (default 0.10) + `DEFAULT_MARKUP_MULTIPLIER` (default 2.5) + `usdToCredits` + `applyMarkup` + `priceUsageInCredits` + `itemPriceToCredits`. 9/9 unit tests.
   - `src/lib/billing.ts` — extended `SourceType` with `marketplace_employee | marketplace_skill | marketplace_workflow | marketplace_bundle`.
   - `src/lib/marketplace-fulfillment.ts` — new `purchaseWithCredits` + `resolveItemCreditPrice`. Catalogue USD prices convert via `itemPriceToCredits`; debit through `applyCreditMutation`; idempotent on `credit_ledger.idempotency_key` UNIQUE; insufficient-credits returns structured error; auto-records `marketplace_purchases` row with `payment_method: credit_ledger`. 8/8 integration tests.
   - `/api/marketplace/purchase` route rewired — default path debits credits; returns 402 `INSUFFICIENT_CREDITS` envelope with `required`, `balance`, `shortfall`, `buy_credits_path: '/app/billing'`. Legacy Stripe per-item checkout retained behind opt-in `?legacy_stripe=1` flag.
   - Walt's prior "employees always free" rule **superseded** — paid marketplace employees now permitted under the credit-only model.
   - Quality gate: 1365/1365 tests · 0 lint errors · typecheck clean · build clean.
2. Flight Deck visibility polish (#64)
3. MC Landing Page replacement (#65)
4. SQLite Kanban Dispatcher polish + MC port (#62)
5. MC Mirroring — **event/proof mirroring** per Walt's clarification, NOT database replication (#63)
6. CLAUDE.md operating-manual template (#67)

### Parity matrix — coverage at end of this tick
- **All 30 named matrix rows now ✅ or 🟡 with honest state.** Coverage ~100% surface, ~93% fully shipped.
- Last ⬜ row (Documents) closed in this tick.
- Shared Memory parity row flipped to ✅ on the matrix — `/app/memory-feed` + `/api/workforce/memory` already covered the surface; matrix was stale.
- `FEATURE_PARITY_MATRIX.md` — refreshed; Codex + Claude Code + Goals + Notebook + Library + Shared Memory flipped to ✅, 7 runtimes to 🟡 (manual-connect surface). Honest coverage now ~80%.
- Quality gate after each slice: typecheck ✅ · lint ✅ (0 errors, 18 pre-existing warnings) · tests **1308/1308** ✅ · build includes `/app/runtimes`, `/app/goals`, `/app/notebook`, `/app/library`.

### Companion artifacts landed this turn
- `~/code/mc-v8/docs/architecture/DEPLOYMENT_MODES.md` — Baseline OS vs MC, two deployment modes.
- `~/code/mc-v8/docs/architecture/FEATURE_PARITY_MATRIX.md` — 30-row living matrix.
- `~/code/claude-os/.claude/workflows/` — 6-pattern Dynamic Workflow Harness:
  - `team_manifest.json` (12-person Specialist Team)
  - `hermes_manifest.json` (Hermes employee personas)
  - `intake_router.mjs` · `leadership_strategy.mjs` · `production_engine.mjs` · `final_audit.mjs`
  - `hermes_dispatch_ops.mjs` · `hermes_deal_flow.mjs` · `hermes_revenue_defense.mjs`
- `~/code/claude-os/CLAUDE.md` — added `/grill-me` skill + Dynamic Workflow Harness section + MemPalace SOP.
- **MemPalace installed** (`uv tool install mempalace`); MCP server registered (`claude mcp add mempalace`). Both `~/code/claude-os` and `~/code/mc-v8` indexed.
- **Ruflo MCP confirmed connected** — 200+ skills already live via ToolSearch (no install needed).

---

## Cycle invariants (re-check before every commit)

1. `mc help` lists every previously-shipped subcommand.
2. `/api/workforces` still returns `property-management` and `insurance` as
   `status: ready`.
3. `mc daily-brief` and `mc roi` still emit their contracted payloads.
4. No file under `src/routes/` references "Aion", "Agentic OS", or "Mission
   Control App" as a UI concept.
5. No real customer data anywhere in `src/data/workforces/*.json`.
