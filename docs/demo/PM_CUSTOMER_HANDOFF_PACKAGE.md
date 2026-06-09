# Property Management — Customer Handoff Package

## Value proposition
Mission Control is the **Real Estate Execution Platform**, starting with **property operations**. Install an AI workforce to triage maintenance, coordinate vendors, route owner approvals, and **prove every action with replay**.

## Demo script
See `PROPERTY_MANAGEMENT_LIVE_DEMO_SCRIPT.md` (15-min) — pre-seed via **Demo Mode** on `/app/maintenance`.

## Feature list (live today)
- Account / login / email verification / onboarding wizard
- Install Property Management Workforce + auto Org Chart
- Maintenance: request → AI triage → work order → vendor match → owner-approval gate → dispatch (live or dry-run)
- Owner Approval Inbox (approve/deny/request-info + audit trail)
- Communications (SMS/email, dry-run safe, log + templates)
- Proof packages + Workforce Replay (screen-recording of every workflow)
- Self-Driving Kanban 2.0 (PM templates) · Flight Deck control tower · Agent Activity
- Billing credit ledger · multi-tenant workspaces · team invites

## Walkthroughs
- **Maintenance:** `/app/maintenance` → run → triage/vendor/cost → (over threshold) owner approval.
- **Owner approval:** `/app/approvals` → approve → vendor dispatched (live/dry-run) → proof.
- **Proof/replay:** every run records a `mission_replays` mission → `/app/replay` plays it back; work order + comms log = the proof package.

## Setup checklist
1. Create account + verify email. 2. Install PM workforce. 3. (For live sends) add Twilio + email creds (LIVE_COMMS_SETUP.md). 4. Invite team. 5. Run a maintenance request.

## Pricing / billing
Transparent credit ledger with a 2.5× markup shown per action; autoreload. **Payment capture (Stripe) is a follow-up** — ledger/estimates work today.

## FAQ
- *Does anything send without me?* No — owner approval gates spend; comms need consent; no auto-send of production/billing/destructive actions.
- *What if I haven't connected Twilio?* Everything runs in dry-run with full proof/replay; flip to live by adding creds.

## Known limitations (honest)
- Live SMS/email require your Twilio/email credentials (dry-run until then).
- Stripe payment capture not yet wired.
- Production deploy not yet verified against a live host.
- Leasing + standalone vendor flows are fast-follows (maintenance is the wedge).
