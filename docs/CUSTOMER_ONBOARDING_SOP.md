# Customer Onboarding — Standard Operating Procedure

> Repeatable steps for the Customer Success team. Goal: every new customer reaches "first task complete" within their first session.

## Pre-call checklist (Customer Success owns)

| # | Task | Where | Done? |
| - | ---- | ----- | :---: |
| 1 | Confirm signup row exists in `users` table | `/app/team` (admin view) or `mc agent list --json` | ☐ |
| 2 | Confirm workspace assigned + business_type set | `/app/team` → workspace row | ☐ |
| 3 | Verify Stripe customer linked (if paid) | Stripe Dashboard → Customers, filter by email | ☐ |
| 4 | Pull business-type-specific starter system | `src/lib/business-templates.ts` row matching `business_type` | ☐ |
| 5 | Have RUNTIME_SETUP_GUIDE.md open in browser | `docs/RUNTIME_SETUP_GUIDE.md` | ☐ |
| 6 | Have FLIGHT_DECK_CUSTOMER_GUIDE.md tab ready | `docs/FLIGHT_DECK_CUSTOMER_GUIDE.md` | ☐ |

## The kickoff call — 30 minutes, screen-shared

### Minute 0–5 — Welcome + context check

- Confirm the customer's name, role, what they want to automate today.
- Confirm their stack: do they already use Claude Code or Codex? Do they have a server / VPS?

If they don't have any AI runtime yet, **pause and recommend Claude Code** (easiest install).

### Minute 5–10 — Walk them to `/app/activate`

- Have them sign in. The Activation Hub is what they see post-signup.
- Confirm "Step 1: System installed" shows their AI employees + skills (already auto-provisioned).
- Show them the starter task in `/app/tasks?status=queued`.

### Minute 10–20 — Runtime connection live

- Click "Connect a runtime" → pick the runtime they confirmed in minute 5–10.
- Click "Generate API key + command."
- **CRITICAL:** Have them paste the command on their box. Watch the wizard turn green.
- If green within 60 seconds: ✅ first runtime connected.
- If not green after 90 seconds: troubleshoot live (see troubleshooting tree below).

### Minute 20–25 — Invite their teammate

- Step 3 of the Activation Hub.
- Have them invite ONE teammate (typically their COO or ops lead).
- Confirm the invite email arrived in the teammate's inbox (open Slack/email).

### Minute 25–30 — First task running

- The starter task auto-picked up by the runtime should now be executing.
- Show them `/app/tasks/[id]` so they can see logs in real-time.
- Open Mission Control's main overview (`/app/overview`). Walk them through:
  - Where to create new tasks.
  - Where to see runtime status.
  - Where to install a second system from the marketplace.

End with: "I'll check in tomorrow. If anything's stuck, reply to my email."

## Troubleshooting tree (live)

### Runtime not heartbeating after 90 seconds

1. Run `mc runtime doctor --json` on the customer's box. The output names the failing check.
2. Most common: `MC_URL` typo (missing `https://`).
3. Second most common: customer's firewall blocks outbound. Have them try `curl -I $MC_URL/api/status?action=health`. Should return 200.
4. Last resort: mint a fresh key (the wizard supports re-running). The old key isn't revoked but the new one is unmistakably valid.

### Starter task didn't auto-execute

1. Confirm at least one runtime is `last_heartbeat_at < 60s`.
2. Confirm `agents.status = 'active'` on the runtime row.
3. Check `/api/tasks/queue?agent=<runtime-name>` returns the task. If empty, the task is mis-assigned.
4. Re-assign manually: `mc task update --id <task-id> --body '{"assigned_to":"<runtime-name>"}' --yes`.

### Invite email never arrived

1. Confirm `MC_RESEND_API_KEY` is set: `mc deploy env-check`.
2. Check Resend dashboard at `resend.com/emails` for the most recent send.
3. If it shows `bounced`: the address is invalid. Have them paste the correct one.
4. If it shows `delivered`: the customer's email provider is hiding it. Have them check spam.

### Customer wants to skip something

That's fine. The Activation Hub persists; they can come back to `/app/activate` later. Don't push.

## Day 1–14 follow-up cadence

| Day | Trigger | Owner | Action |
| --- | ------- | ----- | ------ |
| 1 | Day after kickoff | CS | "How's the starter task doing?" email |
| 3 | If no 2nd task created | CS | "Need help installing another system?" |
| 5 | If invited teammate not accepted | CS | Resend invite + Slack DM |
| 7 | Always | CS | "One-week check-in. What's working / what's not?" |
| 10 | If usage stalls | Sales | Phone call. Ask: do we have product-market fit for them? |
| 14 | Always | CS | Convert to retainer plan if not already on annual |

## Escalation paths

- **Technical bug** (Mission Control side): file an issue in `mission-control` repo with `customer/<workspace-id>` label.
- **Stripe billing problem:** check Stripe Dashboard first. If unclear, email `support@stripe.com` quoting `customer_id`.
- **Resend deliverability:** check `resend.com/domains` for DNS health. If domain unverified, fix DNS first.
- **Runtime daemon misbehavior:** customer-side; help them set up `systemd` / `supervisor` for restart-resiliency.

## What Customer Success owns vs. doesn't

CS owns:
- Activation Hub completion.
- First task running.
- Email cadence days 1–14.
- Health signals review (weekly).

CS does NOT own:
- Mission Control code changes (file a ticket).
- Pricing negotiation (Sales).
- Custom integrations (Engineering, retainer-only).

## Definition of "successfully onboarded"

A customer is considered successfully onboarded when ALL of:
- 1+ runtime heartbeat in the last hour.
- 1+ teammate invited (accepted or pending).
- 1+ completed task (not just queued).
- Stripe subscription `active`.

Track this as the "Activated" cohort metric. Target: 60% of signups within 7 days.
