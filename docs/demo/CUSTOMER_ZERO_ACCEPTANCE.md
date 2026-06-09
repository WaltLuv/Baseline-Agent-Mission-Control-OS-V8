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
| 5 | Connect communications | 🟡 | `/api/integrations` handles AI providers + OAuth/subscription. **Gap:** tenant-facing SMS/email/voice (Twilio/SendGrid) connection flow not first-class. |
| 6 | Run a maintenance workflow | 🟡 | `pm-maintenance` directive (intake→vendor→owner approval) emits replay+proof. **Gap:** live execution needs a paired runtime (honest setup-needed); not yet end-to-end live. |
| 7 | Run a leasing workflow | 🟡 | Closest is `re-new-lead` (RE lead). **Gap:** no PM-specific leasing directive (application→screening→lease). |
| 8 | Run a vendor workflow | 🟡 | Vendor dispatch is a step inside `pm-maintenance`. **Gap:** no standalone vendor onboarding/dispatch/invoice flow. |
| 9 | Run an owner approval workflow | 🟡 | Approval engine + "Owner approval before spend" gate in `pm-maintenance`. **Gap:** no standalone owner-approval inbox/flow surface. |
| 10 | View Agent Activity | ✅ | `<AgentActivity>` on org-chart/gemini/orchestration/hermes/video panels. |
| 11 | View Proof | ✅ | Proof drawer + replay proof events + Hermes exec/approval logs. |
| 12 | View Replay | ✅ | `/app/replay` + `/api/replay`; install/factory/gemini/orchestration emit. |
| 13 | Understand billing | ✅ | `/api/billing/overview` (balance/ledger/subscription) + margin/autoreload/purchase-order; 2.5× markup. |
| 14 | Invite team members | ✅ | `/api/workspaces/[id]/invites` + `/api/invites/[token]` accept. |
| 15 | Complete onboarding w/o dev | ✅ | `/onboarding` wizard + runtime-setup modal; `onboarding-api.spec.ts`. |

## Tracked failures (fix to green)
- **F1 (5):** first-class comms connect (Twilio SMS / email) for tenant + owner messaging.
- **F2 (6):** PM maintenance workflow live-executes (or clearly runs as a supervised simulation with proof) end-to-end without a developer.
- **F3 (7):** add a PM leasing workflow (inquiry → application → screening → lease → move-in).
- **F4 (8):** add a standalone vendor workflow (onboard → dispatch → invoice → close).
- **F5 (9):** owner-approval inbox surface (pending approvals → approve/deny → proof).

## Loop
Run the journey, log failures here, fix, re-run, until all 15 are ✅. Current: **10 ✅ / 5 🟡 / 0 ❌.**
