# Customer Zero — Acceptance (Property Management)

**Generated:** 2026-06-09 · **Persona:** a property-management company, no developer help.
**Pass bar:** all 15 steps reliable, workspace-scoped, no fake states.
Status: ✅ works · 🟡 works with setup-needed / not yet live-executing · ❌ missing/broken.
*This is grounded in code inspection, not assumption. Each 🟡/❌ is a tracked failure.*

| # | Step | Status | Evidence / gap |
|---|---|---|---|
| 1 | Create an account | ✅ | `/signup` page + `/api/auth/signup`; email verification (`/verify-email`, resend). |
| 2 | Log in | ✅ | `/login` + `/api/auth/login`/`logout`/`me`; forgot/reset password. |
| 3 | Install PM Workforce | ✅ | `property-management` template (`from-template.ts`) + `/app/activate` + `/api/workforce/install` (auto org-gen + replay). |
| 4 | Generate Org Chart | ✅ | `/api/org-chart/generate`; install auto-generates; Org Chart V2 panel. |
| 5 | Connect communications | ✅ | **F1 shipped:** `/app/comms` + `/api/comms` — SMS (Twilio) + email (Resend/SMTP) connect, test-connection, dry-run-safe send, comms log, templates. Honest setup-needed when creds absent; never fakes a send. |
| 6 | Run a maintenance workflow | ✅ | **F2 shipped:** `/app/maintenance` + `/api/maintenance` — request→triage→work order→vendor match→owner-approval gate→dispatch (live when comms connected, else honest dry-run). Emits proof + replay + Agent Activity. |
| 7 | Run a leasing workflow | 🟡 | Closest is `re-new-lead`. **Gap (F3, fast-follow):** standalone PM leasing flow (inquiry→application→screening→lease). |
| 8 | Run a vendor workflow | 🟡 | Vendor match + dispatch now live inside maintenance (F2). **Gap (F4, fast-follow):** standalone vendor onboard→dispatch→invoice→close. |
| 9 | Run an owner approval workflow | ✅ | **F5 shipped:** `/app/approvals` Owner Approval Inbox — pending approvals with work-order/vendor/tenant/property context, cost vs threshold, approve/deny/request-info, audit trail, proof+replay links. Approving triggers dispatch. |
| 10 | View Agent Activity | ✅ | `<AgentActivity>` on org-chart/gemini/orchestration/hermes/video panels. |
| 11 | View Proof | ✅ | Proof drawer + replay proof events + Hermes exec/approval logs. |
| 12 | View Replay | ✅ | `/app/replay` + `/api/replay`; install/factory/gemini/orchestration emit. |
| 13 | Understand billing | ✅ | `/api/billing/overview` (balance/ledger/subscription) + margin/autoreload/purchase-order; 2.5× markup. |
| 14 | Invite team members | ✅ | `/api/workspaces/[id]/invites` + `/api/invites/[token]` accept. |
| 15 | Complete onboarding w/o dev | ✅ | `/onboarding` wizard + runtime-setup modal; `onboarding-api.spec.ts`. |

## Tracked failures
- **F1 (5)** ✅ FIXED — `/app/comms` + `/api/comms`, never fakes a send (dry-run + exact blocker).
- **F2 (6)** ✅ FIXED — `/app/maintenance` + `/api/maintenance`, live-or-dry-run with proof + replay + Agent Activity.
- **F5 (9)** ✅ FIXED — `/app/approvals` Owner Approval Inbox; approve triggers dispatch; audit trail.
- **F3 (7)** 🟡 fast-follow — standalone PM leasing workflow.
- **F4 (8)** 🟡 fast-follow — standalone vendor onboard/invoice flow.

## Proof paths (validated by `pm-critical-path.test.ts`, 11 flow assertions)
- High-cost request → `awaiting_approval` work order + pending owner approval + dry-run tenant/owner comms + replay id.
- Low-cost request → immediate `dry_run_dispatch`.
- Approve → `dry_run_dispatch` (live `dispatched` with creds) + audit `approved`. Deny → work order `blocked`. Double-decide rejected.
- Comms with no creds → `dry_run` (never fake `sent`); no-consent → `blocked`; `testConnection` reports exact missing creds.

## Loop
Current: **12 ✅ / 2 🟡 (F3/F4 fast-follow) / 0 ❌.** Core demo flow (steps 1–6, 9–15) is green. F3/F4 ship post-first-customer.
