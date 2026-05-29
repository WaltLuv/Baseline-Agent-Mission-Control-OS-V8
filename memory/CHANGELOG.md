# Mission Control — Changelog

Append-only log of significant deliveries. PRD.md holds the durable product spec; this file holds the timeline.

---

## 2026-05-29 · Revenue-Readiness Stack

**Goal:** make the launch + sales materials complete and usable. A new operator should be able to read one quickstart, pick a vertical, mint a signed demo, run discovery, and propose a 14-day pilot without consulting anyone else.

### Sales — docs hardened
- `docs/sales/cpa.md`, `law-firm.md`, `ai-agency.md` — "SOC 2 path active" → "SOC 2 path in progress" (compliance overclaim → honest)
- `docs/sales/README.md` — Marketing Agency row added to vertical index; backlog note removed

### Sales — new assets
- `docs/sales/marketing-agency.md` — full 7-asset playbook for marketing / creative / growth / ads / content / social agencies. Roster: AI Campaign Operator, Content Calendar Manager, Client Success Assistant, Reporting Analyst, Lead Follow-Up Agent. Tiered $299 / $799 per-client math included.
- `docs/sales/SALES_OPERATOR_QUICKSTART.md` — single-document operator guide (22 sections): 60-sec pitch · ICP · $1 offer · vertical-to-pitch lookup · demo flow · AI-employee language · Mission Control / Baseline OS / memory / approvals / ROI / objections · close question · follow-up cadence · post-no-response · post-demo-watched · post-pilot-proposed · daily routine · pre-call checklist · escalation matrix.

### Operations — verification corrected
- `docs/operations/PRODUCTION_VERIFICATION_CHECKLIST.md` — T8.1 corrected from non-existent `/api/marketplace/bundles` to actual `/api/marketplace/catalog`; T9.1 corrected from 404 `/docs/getting-started` to valid `/docs`, `/onboarding`, `/app/help`, `/app/docs`.

### Operations — readiness proven
- `docs/operations/PRODUCTION_READINESS_REPORT.md` — tier-by-tier dry-run against preview environment. Vitest 1214/1214. Typecheck clean. 9/9 verticals mint signed demo links. Hermes + OpenClaw + Claude Code runtime harnesses all PASS. Remaining work flagged as operator-provisioning (DO deploy, Stripe live webhook, Flight Deck install) — not engineering.
- `docs/operations/proofs/runtime-validation-preview-2026-05-29.txt` — proof artifact, 3 runtimes × 6 stages, all PASS.

### Codebase
- No product code changed in this pass. This was strictly docs + sales enablement.

### Result
All 9 launch verticals shipping with complete playbooks (PM · GC · Home Services · Real Estate · Mortgage · CPA · Law Firm · Marketing Agency · AI Agency). Production verification checklist validated end-to-end. A new sales operator can open `SALES_OPERATOR_QUICKSTART.md`, follow it linearly, and close pilots without coaching.
