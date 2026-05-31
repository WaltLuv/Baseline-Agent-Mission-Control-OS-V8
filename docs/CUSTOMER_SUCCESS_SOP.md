# Customer Success — Standard Operating Procedure

> Post-onboarding. How we keep customers running, paying, and growing.

## North star

A customer who runs Mission Control daily for 60 days is unlikely to churn. Everything in this SOP optimizes for **daily active use** in the first 60 days.

## The Customer Success week (cadence)

| Day | Activity | Trigger / source | Time |
| --- | -------- | ---------------- | ---- |
| Monday | Health pull for all "Activated" customers | `mc tokens stats --timeframe week --json` | 30 min |
| Monday | Outreach to any customer whose health dropped | Slack DM, then email if no response in 24h | as needed |
| Wed | Group office hours (optional Zoom) | Calendar invite to all customers | 30 min |
| Thu | Check Resend deliverability + Stripe failed payments | `resend.com/emails` + Stripe Dashboard | 15 min |
| Fri | Friday retro: who got value this week? | Notes in `/app/notes` | 30 min |

## Health signals (read-only — no new dashboards required)

The CLI surfaces everything you need:

```bash
# Per-customer health
mc workspace use --id <ws_id>
mc dashboard --json | jq '.summary'
mc tokens stats --timeframe week --json
mc agent list --json | jq '.data.agents[] | {name, last_heartbeat_at}'
mc task list --status open --limit 5 --json

# Per-customer billing
mc billing usage --timeframe month --json
```

If you prefer a UI: every signal above is also in `/app/overview` for the customer's workspace.

## Customer health states

| State | Definition | Action |
| ----- | ---------- | ------ |
| 🟢 **Thriving** | ≥ 10 tasks/wk · 2+ runtimes · ≥ 2 active users | Quarterly check-in. Push for case study. |
| 🟡 **Light use** | 1–9 tasks/wk · 1 runtime · 1 user | Personal email asking what they wish was working better. |
| 🟠 **Stalled** | 0 tasks/wk past 14 days | Call. Don't email. Find out if PMF is real for them. |
| 🔴 **At risk** | Runtime down > 48h OR billing past_due | Immediate ticket → engineering + finance. |

## The "Hero conversation"

Every quarter, schedule a 20-minute "hero conversation" with each 🟢 customer. Two questions:

1. "What would you tell a friend who's evaluating Mission Control?"
2. "What's the one thing you wish we'd build next?"

Capture answers verbatim in `/app/notes`. These quotes drive:
- Marketing testimonials.
- Roadmap prioritization.
- Sales objection-handling scripts.

## Churn protocol

When a customer cancels:

1. **Within 1 hour** — email asking for a 15-min exit call. Subject: "One last ask before you go."
2. **In the call** — exactly two questions:
   - "What were you hoping Mission Control would solve that it didn't?"
   - "What would you have to see to come back?"
3. **Within 24 hours of call** — write a one-page note: customer name, plan, MRR, reason, "what would bring them back." File in `/app/notes/churn-{date}.md`.
4. **Friday retro** — review the week's churn notes as a team. Look for patterns. Three customers citing the same reason = next priority.

## Renewals

| Plan | Renewal trigger | Owner |
| ---- | --------------- | ----- |
| Monthly | Auto-renew via Stripe; no action unless payment fails | Stripe |
| Annual | 60 days pre-renewal: schedule a 30-min "year in review" call | CS lead |

In the annual renewal call:
- Walk through their tasks, runtimes, and outcomes from the year.
- Propose plan changes (Starter → Growth upgrade if usage warrants).
- Lock in next year's contract.

## Customer-facing pricing language (canonical)

When a customer asks "what do I get for $499?", use this script:

> Mission Control runs your AI workforce. The Starter plan gives you 3 AI employees, 1 workspace, and roughly 5,000 credits per month. A credit is the underlying token cost for AI work — about half a cent each, abstracted so you don't have to track GPT vs Claude vs OpenAI pricing.

> 5,000 credits is enough for about 150 substantial AI tasks per month — things like vendor follow-ups, leasing inquiries, document review. The exact count depends on task length.

> If you blow through credits, we don't shut you off. We email you with a one-click top-up.

If they ask about Growth:

> Growth is $1,499/month. You get 15 AI employees, 5 workspaces, 25,000 credits. Most customers move to Growth when they want to run multiple business lines (e.g., property management + a contracting arm) on the same login.

If they ask "is there a free trial?":

> Not currently. We do offer monthly with no setup fee — you can cancel any time and we'll refund the unused portion at the monthly rate.

## What CS escalates to Engineering

| Symptom | Severity | Channel |
| ------- | -------- | ------- |
| Runtime heartbeat broken for > 3 customers | P0 | #incidents Slack |
| Stripe webhook returning 5xx | P0 | #incidents Slack |
| Resend deliverability < 95% | P1 | #ops Slack |
| Customer-reported UX bug | P2 | GitHub issue |
| Feature request | P3 | Roadmap doc — review monthly |

## Notes hygiene

Every customer call gets a one-page note in `/app/notes/{customer-slug}-{date}.md`:

```
# Customer · Acme Property Management · 2026-06-15
- Plan: Growth annual
- ARR: $14,388
- Health: 🟢
- Last heartbeat: 14s ago
- Active runtimes: claude-prod, hermes-prod

## Topics
- Frustrated with leasing follow-up template — too templated.
- Asked: any plans for SMS as a runtime?
- Will install a 2nd workspace for the contracting subsidiary next week.

## Follow-ups
- [me] Send leasing template tweak guide by Friday.
- [me] Schedule check-in for July 1.
```

Searchable in the customer's workspace knowledge vault: `mc knowledge search --q "Acme"`.

## When a customer asks "can I talk to the founder?"

Yes. The founder owns 🟢 customer relationships personally. Schedule a 15-min Zoom. Don't gate.
