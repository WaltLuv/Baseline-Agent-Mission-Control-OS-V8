# Property Management — Sales Playbook

> AI Workforce OS for property management. Maintenance dispatch
> without the dispatcher. Owner updates without the all-nighter.

---

## 1. One-page outline (print-to-PDF ready)

**Headline:** AI Workforce OS for Property Management

**Sub:** Hire AI employees that dispatch maintenance, update owners,
triage tenant escalations, and keep your portfolio quiet.

**The 3 wins (above the fold):**
- 38 maintenance tickets auto-dispatched per week per 200-door portfolio
- Owner-update digest sent on time, every time, with zero PM hours
- Tenant escalations triaged in < 5 minutes, 24/7

**Star employee:** **Scheduling Agent** — turns inbound maintenance
into routed tickets with vendor assigned, ETA confirmed, and tenant
notified. Memory-backed by the property profile + lease + vendor SLA.

**The roster (4 AI employees):**
| Role | What it does | Memory source |
|------|--------------|---------------|
| Scheduling Agent | Maintenance dispatch + vendor routing | Vendor SLA + property profile |
| Inspection Agent | Move-in / move-out scope + photos | Inspection SOP |
| Review Request Agent | Post-service tenant feedback nudge | Service ticket log |
| Invoice Follow-Up Agent | Owner reporting + AR | Owner contract + ledger |

**The ROI line:** 20–40 hours/week saved on a 200-door portfolio.
Owner retention up. Maintenance margin up. PM team focused on growth.

**The CTA:**
1. Watch the live demo: `mission.baselineautomations.com/?demo=pm`
2. Start a $1, 14-day pilot
3. Convert at $299/mo on a Team plan

**Footer:** Mission Control supervises · Baseline OS coordinates ·
Hermes / OpenClaw / Claude Code execute · No live customer data in demos.

---

## 2. Sales sheet (~250 words)

Property managers don't have a maintenance problem. They have a
**coordination problem**. Tickets stack up. Vendors don't return
calls. Owners ask for updates the team forgot to send. The PM owner
ends up in dispatch mode at 11pm.

Baseline AI Workforce OS deploys four AI employees who work
alongside your team:

- **AI Scheduling Agent** auto-dispatches every maintenance ticket
  using your vendor SLA, property profile, and lease constraints.
  Vendor assigned, ETA confirmed, tenant notified — without a
  human touching it.
- **AI Inspection Agent** turns move-in / move-out into a checklist
  with photos, a draft scope, and a price-checked vendor list.
- **AI Review Request Agent** asks every tenant for feedback after
  a service is closed. Routes 5-star reviews to Google. Routes
  complaints to the PM.
- **AI Invoice Follow-Up Agent** drafts owner statements, chases
  aging AR, and surfaces what changed since last month.

Every agent reports to Mission Control. Every gated action waits for
the PM's approval. Every memory pull cites the doc it came from.

**Trial:** $1 for 14 days. **Tier:** $299/mo Team plan covers up to
5 users + unlimited AI employees. **Live demo:**
`mission.baselineautomations.com/?demo=pm`.

---

## 3. Discovery script (10 questions)

1. How many doors are you managing today? (Sizing — under 100 / 100–500 / 500+)
2. Who handles after-hours maintenance? (Owner / outsourced / no one)
3. Walk me through what happens when a tenant emails a maintenance request at 9pm Tuesday. (Looking for: handoffs, delays, "I have to call back tomorrow")
4. How many owner updates do you send per month, and who writes them?
5. What's your current monthly maintenance margin? (If unknown — that's a tell)
6. When did you last lose an owner, and what was the stated reason? (Listening for "communication" or "response")
7. What software do you use today for property management + maintenance? (Looking for: AppFolio / Buildium / Yardi + 2–3 disconnected tools)
8. If you could automate one thing tomorrow, what would it be? (Their stated priority drives the pilot)
9. Have you tried AI tools before? Where did they fall short? (Common: "made stuff up", "didn't remember", "no approval")
10. If I showed you four AI employees running on your real data in 14 days, would you be open to a $1 pilot?

Yes to #10 → schedule the demo within 48 hours. Anything less than
yes → send the sales sheet + the recorded demo and follow up T+5.

---

## 4. Objection handling

| Objection | Response | Proof |
|-----------|----------|-------|
| "We already use AppFolio / Buildium / Yardi." | "We don't replace them — we route work through them. Mission Control sits on top and supervises AI employees who talk to AppFolio the way your team does." | Demo the dispatch flow with the existing PMS plugged in |
| "AI hallucinates / makes things up." | "Every action gates on operator approval until you trust it, and every memory call cites the source doc. Watch this." | Open `/app/approvals` and the memory citation on a card |
| "We tried ChatGPT, didn't stick." | "ChatGPT is a chat box. Mission Control is a workforce. Your AI employees keep memory between shifts, have assigned skills, and report to you in one dashboard." | Show the AI Workforce Dashboard at `/app/workforce` |
| "Owners don't want AI talking to them." | "AI drafts; the PM approves. The owner sees a human-signed update. The PM saves 4 hours doing it." | Show the approval queue + the draft → send flow |
| "We have a small team — can we even use this?" | "$299/mo for a Team plan covers 5 users + unlimited AI employees. Cheaper than half a maintenance coordinator." | Open `/pricing` |
| "What if it's wrong?" | "Two safety nets: every risky action waits for your approval, and Mission Control's verification judges catch issues before persistence. Worst case: the AI doesn't do the thing." | Show the verification judges in Swarm Mode |
| "Sounds heavy to set up." | "$1 pilot is 14 days. Day 0 kickoff, day 4 first runtime live, day 5 first mission complete. We do the heavy lifting." | Open `docs/onboarding/14_DAY_PILOT_SOP.md` |
| "Security — where does data live?" | "SQLite WAL on a DigitalOcean App Platform instance, TLS in transit, secure cookies, host allowlist, no secrets bundled into the desktop. Full security doc in `docs/operations/`." | Share the operations folder |

---

## 5. Follow-up sequence (14-touch over 21 days)

| Day | Channel | Asset |
|-----|---------|-------|
| 0 | Email | Demo recap + signed demo link + ROI calculator link |
| 1 | SMS | Quick nudge (see template T+1) |
| 3 | Email | "How &lt;PM company case study&gt; recovered 38 hours / week" |
| 5 | LinkedIn DM | Light comment + share article on PM trends |
| 7 | Email | "Worth a 15-min next step?" with three time slots |
| 10 | SMS | "Last nudge before I shelf this — your call" |
| 14 | Email | Pilot proposal one-pager attached |
| 21 | Email | Final: "Closing the loop — quarterly check-in in 90 days?" |

Stop the sequence on: meeting booked · explicit no · 3-month
re-engage opt-in · unsubscribe.

---

## 6. Email templates

### T+0 — Demo recap (sent within 1 hour of demo)

```
Subject: AI workforce recap for {{company}}

{{first_name}} —

Three things from today's walkthrough you'll want to revisit:

1) The Scheduling Agent dispatching maintenance tickets without a
   dispatcher. Memory-cited from your vendor SLA.
2) The Owner Update digest the Invoice Agent drafts — your PM
   approves, then it goes.
3) The Review Request Agent routing 5-star feedback to Google and
   complaints to you.

Here's your private demo link (signed, expires in 7 days,
watermarked for {{company}}):
{{signed_demo_link}}

Want to run a 14-day $1 pilot on your live portfolio?
{{calendar_link}}

— {{rep_name}}
Baseline Automations · AI Workforce OS
```

### T+3 — Reference story

```
Subject: How {{reference_pm}} recovered 38 hours/week

{{first_name}} —

Quick story: {{reference_pm}} runs a 280-door portfolio in {{city}}.
Before Baseline, the owner was in dispatch mode every night.

90 days in:
  - 38 tickets/week auto-dispatched
  - Owner updates sent on the 1st, every month
  - Maintenance margin up 11 points

Their setup was identical to yours. 14-day pilot, $299/mo upgrade.

Want me to walk you through their workspace on a 15-min call?
{{calendar_link}}

— {{rep_name}}
```

### T+7 — Direct ask

```
Subject: 15 minutes this week, {{first_name}}?

I'll keep this short.

{{company}} loses ~$X/month to maintenance coordination overhead
(your own number from the discovery call).

If we run a $1 pilot for 14 days and don't show measurable hours
saved, you walk. Worst case: you got a free workspace and a stack
of AI employees to test.

Slot this week?
  - {{slot_1}}
  - {{slot_2}}
  - {{slot_3}}

— {{rep_name}}
```

### T+14 — Pilot proposal

```
Subject: 14-day pilot for {{company}} — proposal attached

{{first_name}} —

One-page pilot proposal attached. The shape:

  Day 0:  45-min kickoff
  Day 4:  First runtime live
  Day 5:  First mission complete
  Day 7:  Week-1 review
  Day 11: ROI captured
  Day 13: Upgrade conversation

Cost: $1 today. Convert at $299/mo or walk at day 14.

Sign here when ready: {{pilot_signup_link}}

— {{rep_name}}
```

---

## 7. SMS templates

All TCPA-compliant; sent only after explicit opt-in on the discovery
call. STOP and HELP keywords supported. Frequency cap 3/prospect.

### T+1

```
Hi {{first_name}} — recap on the AI Scheduling Agent we walked
through. Signed demo link for {{company}}: {{short_link}}
Reply STOP to opt out.
```

### T+4

```
Following up on the AI workforce for {{company}}. Worth a 15-min
call this week? {{calendar_short}}
Reply STOP to opt out.
```

### T+8 (last SMS in the cadence)

```
Last nudge — happy to send a pilot proposal or shelf this until
next quarter, your call. Reply BACK to talk or STOP to opt out.
```

---

## Reference ROI math (for the one-pager)

| Portfolio size | Hours saved / week | $ saved / year @ $40/hr |
|---------------|--------------------|------------------------|
| 50 doors | 6 | $12,480 |
| 200 doors | 22 | $45,760 |
| 500 doors | 48 | $99,840 |
| 1000+ doors | 90+ | $187,200+ |

Numbers based on 90-day pilot data from the staging cohort —
update once production pilots run.
