# First 14 Days — Customer Activation Plan

> A repeatable, day-by-day plan that takes a new signup from "just paid" to "actively using" within 14 days.
> Customer Success runs this against every Starter + Growth customer.

## Outcome targets (verifiable at day 14)

| Target | How we verify |
| ------ | -------------- |
| 1+ runtime heartbeating in last 24h | `mc runtime list --json` |
| 1+ teammate invited (accepted preferred) | `/api/workspaces/<id>/invites` |
| 5+ tasks completed (not just queued) | `mc task list --status completed --json` |
| 2+ skills installed beyond the starter set | `mc skill list --json` |
| Logged in on at least 5 distinct days | `sessions` table |

A customer hitting 4 of 5 by day 14 is "Activated." Below that we trigger personal outreach.

---

## Day 0 — Signup

**Triggers automatically.** No CS action required unless something fails.

What happens:
- Workspace created.
- 3 AI employees provisioned (matches business_type from signup form).
- 4 starter skills installed.
- 1 starter task seeded.
- `/app/activate` becomes the customer's landing page.
- Welcome email sent via Resend.

**Day 0 email** (Resend template `welcome.html`):
> Subject: You're in. Here's what I set up for you.
> Body: Walks them through the 3 Activation Hub steps. Includes the kickoff-call booking link.

## Day 1 — Kickoff call

**CS action:** 30-min screen-share. See `CUSTOMER_ONBOARDING_SOP.md` for the script.

By end of call, ALL of:
- Runtime connected.
- 1 teammate invited.
- 1 task auto-running.

If any of those didn't happen, follow up within 24h.

## Day 2 — "It worked" check

**CS action:** Reply to the customer with the actual outcome of their starter task.

Template:
> Subject: Your AI just shipped its first work
> Body: Specific summary of what the starter task did. Include a screenshot link. End with: "Want me to set up the next one?"

This is the most important email of the entire 14-day journey.

## Day 3 — Second system install nudge

**Customer action (we email):** Install a 2nd system from the marketplace.

Template:
> Subject: One more, takes 90 seconds
> Body: "Most {business_type} customers install [system 2 name] next. It handles [outcome]. Click here to install."
> CTA: deep-link to `/app/marketplace?suggested=<slug>`.

## Day 4 — Teammate adoption check

**CS action:** If the invited teammate hasn't accepted by end of day 4:
- Resend the invite via `/app/team`.
- DM the customer: "Want me to call your COO directly?"

## Day 5–6 — Quiet observation

**CS action:** None directly to the customer. We're watching the metrics:
- Tasks/day count.
- Runtime uptime.
- Login frequency.

If anything drops to zero for 48h, jump to Day 7 protocol.

## Day 7 — One-week check-in

**CS action:** Personal email or Slack DM.

Template:
> Subject: One week in — what's working / what's not?
> Body: 2 questions only.
>   1. What's been the most useful thing the AI workforce has done this week?
>   2. What's the most frustrating thing about Mission Control so far?
> Sign off: "Your honest answers shape what we build next."

DO NOT include a CTA. This email is a listening post, not a sales pitch.

## Day 8–9 — Apply what they said

If the Day 7 reply surfaced friction, fix it (or schedule a fix). Email back within 24h with what you're doing.

## Day 10 — Marketplace push

**Customer action (we email):** Browse the full skill marketplace.

Template:
> Subject: Three skills I'd add to your workspace next
> Body: Recommend 3 specific skills with business reasons. Tailor based on business_type. Include 1-click install links.

## Day 11 — Billing transparency email

**Customer action (we email):** Review their usage so far.

Template:
> Subject: Your first 10 days, by the numbers
> Body: actual stats — tasks completed, credits used, time saved (rough estimate). End with one specific action they could take to compound the value.

This email pays for itself in retention.

## Day 12–13 — Power-user features

**CS action:** Introduce ONE power feature based on their usage pattern:
- Heavy task volume → introduce CLI for scripting (`docs/CLI_GUIDE.md`).
- Multi-runtime → introduce gateway routing (`mc gateway route-task`).
- Heavy knowledge use → introduce `mc knowledge consolidate`.

ONE feature only. Don't dump the manual on them.

## Day 14 — Two-week review

**CS action:** 20-min Zoom or async video summary.

Agenda:
- Health snapshot (runtime uptime, tasks/wk, teammate adoption).
- Two questions, same as Day 7 ("most useful" / "most frustrating").
- Renewal conversation if applicable.
- Set the next 30-day goal together.

After Day 14, the customer enters the regular CS cadence (see `CUSTOMER_SUCCESS_SOP.md`).

---

## Activation states (track per customer)

| State | Definition | What CS does |
| ----- | ---------- | ------------ |
| **🟢 On track** | Hitting targets on schedule | Stay on cadence. Send appreciation note at Day 14. |
| **🟡 Slow** | 1–2 targets missed by Day 7 | Personal outreach. Identify blocker. |
| **🟠 Stalled** | 3+ targets missed by Day 7 | Phone call. Find out if PMF is real for them. Sometimes the answer is "no, refund them." |
| **🔴 Churning** | Cancellation initiated within 14 days | Immediate exit call. Follow `CUSTOMER_SUCCESS_SOP.md` → Churn protocol. |

## Refund policy in first 14 days

If a customer wants out within their first 14 days, refund 100%. No questions. Note the reason in `/app/notes/refund-{date}.md` and discuss at Friday retro.

This is the **cheapest** customer feedback you'll ever get.

---

## What this plan is NOT

- Not a drip email campaign with auto-templates. Every email is personal.
- Not a feature push. Each touchpoint asks "is what you already have working?" before introducing more.
- Not a sales cycle. Customer Success owns this; Sales gets handed back the warm relationship at Month 2 for expansion conversations.

## CSV / spreadsheet view

For high-volume CS work, export the cohort:

```bash
mc export tasks --since "$(date -d '14 days ago' +%Y-%m-%d)" --format csv > /tmp/cohort-tasks.csv
mc export activities --since "$(date -d '14 days ago' +%Y-%m-%d)" --format csv > /tmp/cohort-activity.csv
```

Pivot in your spreadsheet of choice. Customers with `task_count = 0` are the urgent list.
