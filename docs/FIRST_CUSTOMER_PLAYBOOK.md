# First Customer Playbook

> Sales → Activation → First Value → Retention.
> This is the journey we're building for. Every step has an owner and a verifiable outcome.

## The journey, one line per phase

```
Landing page
   │
   ▼
Demo (booked or self-serve)
   │
   ▼
Signup
   │
   ▼
Onboarding (workspace + AI employees + skills + starter task auto-provisioned)
   │
   ▼
Activation Hub /app/activate (3 steps: ✓ system installed · connect runtime · invite team)
   │
   ▼
First runtime heartbeat (real value)
   │
   ▼
First task completed by their AI workforce
   │
   ▼
Paid customer (Stripe checkout → live subscription)
   │
   ▼
Week 2: 2nd workspace / 2nd system installed
   │
   ▼
Month 2: invited 1+ teammate, runs 10+ tasks/week → retained
```

## Phase 1 — Landing page → Demo

**Owner:** Marketing.
**Goal:** Visitor understands what Mission Control does within 10 seconds of landing.
**Verifiable outcome:** Click on "Get Started" (signup) or "See it work" (demo).

The homepage already does this — hero is clear, the value prop is "AI workforce that supervises Claude / Codex / Hermes / OpenClaw."

Demo path: route to `/marketplace` or `/pricing` for a self-serve walkthrough.

## Phase 2 — Signup

**Owner:** Product.
**Goal:** Account in under 60 seconds, with a real workspace assigned.
**Verifiable outcome:** A row in `users` + `workspaces` + `workspace_memberships`.

Routes used: `POST /api/auth/signup` → creates the user + a workspace named after the company + the user's first-admin membership.

The signup form requires: email, password, full_name, company_name, business_type. The business_type drives Phase 3 templating.

## Phase 3 — Onboarding (auto-provisioning, before customer touches anything)

**Owner:** Product.
**Goal:** When the customer lands on `/app/activate`, their AI workforce is **already pre-configured** for their business.

When the customer submits the onboarding form, behind the scenes Mission Control:
- Hires 3 AI employees for their business type (lib/business-templates.ts).
- Installs 4 starter skills matched to their industry.
- Seeds a starter task that proves AI is doing real work in <5 minutes.
- Sets workspace defaults: hours, currency, ROI target.

**Why:** A customer should NEVER stare at an empty dashboard. They open Mission Control and find their workforce already at desks.

## Phase 4 — Activation Hub `/app/activate`

**Owner:** Customer Success.
**Goal:** Customer connects a runtime + invites a teammate within their first session.

The Activation Hub is a 3-step UI that survives any time the customer abandons it (steps persist):

1. ✓ **System installed** — already done at signup, shown for confirmation + employee/skill count.
2. **Connect a runtime** — one-click API key + paste-able command. Polls for first heartbeat → flips green.
3. **Invite team** — single-email invite form with role picker.

**Verifiable outcomes:**
- Runtime connected: row in `agents` with `last_heartbeat_at` within the last 90 seconds.
- Team invited: row in `workspace_invites` with `accepted_at` NULL but no `revoked_at`.

## Phase 5 — First task completed

**Owner:** Customer Success.
**Goal:** Customer sees an AI-completed task within 1 hour of signup.

The starter task seeded in Phase 3 is small but real. As soon as the runtime connects (Phase 4), it auto-picks up the task. The customer gets:

- A push to their Mission Control dashboard.
- A Resend email summarizing what was done.

If the customer skipped runtime connection, the task sits in queue and the Activation Hub still says "Step 2 not done." That's intentional.

## Phase 6 — Conversion to paid

**Owner:** Sales + Product.
**Goal:** Customer enters card details on `/pricing` and Stripe Live processes the charge.

Stripe Live is wired (iteration 6). `cs_live_*` sessions are created for Starter ($499/mo) and Growth ($1,499/mo) plans, with annual variants. The webhook (`/api/stripe/webhook`) credits the workspace ledger idempotently on `checkout.session.completed`.

**Verifiable outcomes:**
- Real Stripe charge succeeds (`charges_enabled` + `amount_total` match plan).
- Workspace flips to `subscription_status = 'active'`.
- Customer's ledger shows monthly credits deposited.

## Phase 7 — Week 2 expansion

**Owner:** Customer Success.
**Goal:** Customer installs a second system OR opens a second workspace.

Trigger automation:
- Day 4 email: "Did you see the [starter system] run yesterday? Here are 2 more your business type uses."
- Day 7 email: "How are things? Reply with what's broken."
- Day 14 in-app prompt: "Try installing a second system — takes 90 seconds."

## Phase 8 — Month 2 retention

**Owner:** Customer Success.
**Goal:** ≥ 10 tasks/week run, ≥ 1 teammate active.

Health signals to monitor:
- `tasks.created` rolling 7d → ideal ≥ 10/week per active customer.
- Distinct active users on the workspace → ideal ≥ 2.
- Runtime heartbeat continuity → ideal ≥ 95% uptime over 30 days.

Negative signals that trigger a Success outreach:
- Runtime stopped heartbeating for > 48h → email + Slack ping.
- Zero tasks created in 7 days → personal email asking "what's blocking you?"
- Invite sent but unaccepted after 5 days → resend.

## Phase 9 — Reference customer

**Owner:** Sales.
**Goal:** Month 3 — customer becomes a logo on the homepage + a quotable testimonial.

## Counter-incentives (what NOT to do)

- **Don't dump customers into the raw dashboard at signup.** The Activation Hub MUST be the first thing they see.
- **Don't gate the starter task behind a runtime.** Queue it regardless; the runtime connection unblocks execution.
- **Don't ship a "test mode" billing banner once Stripe is live.** Live-mode flag drives this.
- **Don't add another panel "while we're in there."** Each new panel adds confusion. New surfaces only if they kill a friction point that's blocking ≥ 3 customers.

## Sales handoff to Customer Success

When sales closes a deal, before the kickoff call Customer Success has:

1. The customer's signed-up workspace + assigned admin email.
2. A Stripe `customer_id` linked to the workspace.
3. A pre-filled activation checklist matching their business type.
4. A 14-day plan template (see FIRST_14_DAY_ACTIVATION_PLAN.md).

Customer Success runs the kickoff call (30 min) with the customer's screen shared, walking them through the Activation Hub live. By end of call: runtime connected, teammate invited, first task running.

## Metrics that matter

| Metric | Target | Source |
| ------ | ------ | ------ |
| Signup → first runtime connected | 60% within first session | `/api/agents` last_heartbeat_at < 1h after signup |
| Signup → first invited teammate | 40% within first day | `workspace_invites` table |
| Signup → first paid subscription | 25% within 14 days | `stripe.customers` + `stripe.subscriptions` |
| Week 2 retention (logged-in) | 70% | `sessions` table |
| Month 2 retention (tasks ≥ 10/wk) | 50% | `tasks` table aggregate |

Do not chase these numbers by adding features. Chase them by removing friction.
