# PM Demo — Go / No-Go

**Generated:** 2026-06-09 · Grounded in code + tests + live route-health. No assumptions.
🟢 GREEN demo-ready · 🟡 YELLOW works w/ caveat · 🔴 RED blocker.

| Area | Grade | Basis |
|---|---|---|
| **Login** | 🟢 | `/login` + `/api/auth/*`; route-health `/app/*` → 307→login when unauth (correct). |
| **Setup / onboarding** | 🟢 | `/setup`, `/onboarding` wizard; admin via `/setup` or AUTH_PASS. |
| **Workforce Install** | 🟢 | `property-management` template + `/app/activate` → auto org-gen + replay. |
| **Maintenance Flow** | 🟢 | `/app/maintenance` + `/api/maintenance`; triage→WO→vendor→gate→dispatch; 6 flow tests green. |
| **Owner Approval** | 🟢 | `/app/approvals`; approve→dispatch, deny→blocked, info, audit trail; tested. |
| **Comms** | 🟡 | `/app/comms` + checklist; **dry-run green out of the box**; **live** needs Twilio/email creds (external — by design, not a blocker). |
| **Proof** | 🟢 | work order + comms log + owner-approval + replay proof events. |
| **Replay** | 🟢 | `/app/replay` + `/api/replay`; maintenance emits a full mission. |
| **Agent Activity** | 🟢 | embedded on Maintenance (+ org-chart/gemini/orchestration/hermes). |
| **Billing** | 🟡 | `/api/billing/overview` ledger/markup/autoreload live; **Stripe payment wiring** pending (not needed for demo). |
| **Flight Deck** | 🟡 | real Runtime Registry status; cost/approval/deploy + V2 redesign pending (not on the demo critical path). |
| **Customer Handoff** | 🟢 | one-click **Demo Mode** seeds a populated workspace; live demo script in `docs/demo/PROPERTY_MANAGEMENT_LIVE_DEMO_SCRIPT.md`. |

## Verdict: **GO for demo.**
- 9 GREEN, 3 YELLOW, 0 RED. Every YELLOW is "works in dry-run / needs an external credential or a non-critical-path polish," not a blocker.
- The maintenance → approval → dispatch → proof → replay → activity wedge is fully demonstrable today (dry-run), and live with creds.

## Pre-demo checklist
1. Seed admin + log in. 2. Install PM workforce once. 3. Click **Demo Mode — seed data**. 4. (Optional, for live sends) add Twilio + email creds on `/app/comms`; confirm checklist shows `live`. 5. Walk the 15-min script.

## Not-go conditions (none currently)
- A RED in Login / Maintenance Flow / Owner Approval / Proof / Replay would be a no-go. All are GREEN.
