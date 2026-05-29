# Baseline Sales Playbooks

> One playbook per launch vertical. Every playbook ships:
> 1. One-page outline (print-to-PDF ready)
> 2. Sales sheet
> 3. Discovery script
> 4. Objection handling
> 5. Follow-up sequence
> 6. Email templates
> 7. SMS templates

| Vertical | Playbook | ICP buyer | Primary trigger |
|----------|----------|-----------|-----------------|
| Property Management | [property-management.md](./property-management.md) | Director of Operations / PM company owner | Tenant maintenance + owner reporting workload |
| General Contractor | [general-contractor.md](./general-contractor.md) | Owner / GM | Bid pipeline + sub coordination overhead |
| Home Services | [home-services.md](./home-services.md) | Owner / Operations lead | Missed calls + same-day dispatch |
| Real Estate | [real-estate.md](./real-estate.md) | Team lead / brokerage operations | Lead response time + transaction coordination |
| Mortgage | [mortgage.md](./mortgage.md) | Branch manager / Ops director | Doc collection cycle + closing chaos |
| CPA / Accounting | [cpa.md](./cpa.md) | Managing partner / Operations | Tax-season missing-doc chase |
| Law Firm | [law-firm.md](./law-firm.md) | Managing partner / Office admin | Intake conflict checks + matter updates |
| Marketing Agency | [marketing-agency.md](./marketing-agency.md) | Agency owner / Head of delivery | Reporting + content + follow-up bottleneck |
| AI Agency | [ai-agency.md](./ai-agency.md) | Founder / Head of delivery | Multi-client AI workforce deployment |

All 9 launch verticals ship with a complete sales playbook. The
Cigar Retail demo template is supported in the product but does not
have a dedicated sales playbook yet — it is a $0 acquisition lure,
not a paid ICP.

## How to use a playbook

1. **Discovery call**: open the playbook, follow the discovery script.
2. **Demo**: open `/app/share?vertical=<id>&prospect=<name>` and send.
3. **Follow-up**: trigger sequence on day 0; queue templates.
4. **Pilot**: hand off to `docs/onboarding/14_DAY_PILOT_SOP.md`.

## Shared assets

- ROI calculator: `/roi-calculator`
- Demo home: `/`
- Marketplace: `/marketplace`
- Demo expired fallback: `/demo/expired`

## Cross-vertical email patterns

| Touch | Subject pattern | Body shape |
|-------|----------------|------------|
| T+0 (post-demo) | "Recap + your AI workforce for &lt;company&gt;" | 3-bullet recap + signed demo link |
| T+2 | "Quick follow-up — did the &lt;vertical-specific&gt; angle resonate?" | One-line nudge + calendar link |
| T+5 | "Case study — how &lt;reference&gt; saved &lt;metric&gt;" | Story + soft ask |
| T+10 | "Closing the loop on &lt;company&gt;" | Final ask + alternative path |

## Cross-vertical SMS patterns

| Touch | Copy |
|-------|------|
| T+1 | "Hi &lt;name&gt; — quick recap on the AI &lt;role&gt; we walked through. Want the signed demo link for your team?" |
| T+4 | "Following up on the AI workforce for &lt;company&gt;. Worth a 15-min next step?" |
| T+8 | "Last nudge — happy to send a pilot proposal or shelf this until next quarter, your call." |

All SMS templates are TCPA-compliant: every cadence ends with STOP /
HELP keywords supported, no SMS without prior opt-in, frequency cap
3 per prospect.
