# Sales Operator Quickstart

> One document. Read it once, and you can sell Baseline AI Workforce OS.
> Open this on your first call. Open this on your hundredth call.
> Everything you need to demo, propose, close, and follow up.

---

## 0. The 60-second pitch (memorise this)

> "Baseline is an AI Workforce OS. You hire AI employees — like an
> intake receptionist, a dispatcher, a transaction coordinator — and
> they work alongside your team 24/7. Mission Control supervises
> them. Every action they take cites the document it came from, and
> the risky ones wait for your approval. We deploy them in a day,
> show ROI in two weeks, and you decide whether to keep them."

If a prospect cuts you off and says "AI assistant," correct them
once: **"AI employees, not assistants. They have roles, memory, and
approval gates."** Then keep going.

---

## 1. What we sell

We sell an **AI Workforce Operating System** — not an agent, not a
chatbot, not a tool.

The product breaks into three layers; remember the order:

| Layer | Role | Belongs to |
|-------|------|-----------|
| **Mission Control** | Supervises the AI workforce | The operator (you / your customer) |
| **Baseline OS** | Coordinates departments, skills, memory, approvals | Baseline (us) |
| **Hermes / OpenClaw / Claude Code** | Execute the actual work | Runtime providers (us) |

When asked "is this LangChain / CrewAI / AutoGen?" — answer:
**"No. Those are execution frameworks. We're the supervision +
orchestration layer above them. CrewAI is welcome to run inside an
OpenClaw-equivalent slot."**

---

## 2. Who we sell to

The first-class ICPs (in priority order):

1. **Property managers** — 100-1000 doors, communication-heavy
2. **General contractors** — bid + sub coordination overhead
3. **Home services** — missed calls, same-day dispatch
4. **Real estate teams** — lead response + transaction coordination
5. **Mortgage brokers** — doc chase + closing chaos
6. **CPA / accounting firms** — tax-season pressure
7. **Law firms** — intake + conflict checks + matter updates
8. **Marketing agencies** — reporting + content + follow-up
9. **AI agencies** — multi-client AI workforce delivery

If a prospect doesn't fit one of these — ask one question:
"What's the workflow that breaks every week, and what does it cost
when it breaks?" If they can answer in dollars, we can pilot. If
they can't, send them to `/roi-calculator` and re-engage in 30 days.

---

## 3. The first offer

There is exactly one. Memorise it.

> **$1 today. 14-day pilot. One operator, up to three AI employees.
> Day 13 we measure ROI. Day 14 you either upgrade or off-board
> cleanly. No commitment.**

The $1 isn't revenue. It's the credit-card-on-file signal. It tells
the prospect they're a customer, not a freebie hunter. It tells us
they have buying authority.

Convert tiers:
| Tier | Monthly | Best for |
|------|---------|----------|
| Operator | $99 | 1 user, up to 5 AI employees, 1 runtime |
| Team | $299 | up to 5 users, unlimited employees, 2 runtimes |
| Workspace | $799 | up to 25 users, all runtimes, priority support |

---

## 4. Which vertical to start with

Use this table on every discovery call. Pick **before** the demo.

| If the prospect says… | Start with vertical |
|----------------------|---------------------|
| "We manage rentals" | `pm` |
| "We build / remodel / renovate" | `gc` |
| "Plumbing / HVAC / electrical / locksmith / cleaning" | `home-services` |
| "Real estate team / brokerage" | `real-estate` |
| "Mortgage broker / lender / LO" | `mortgage` |
| "CPA / accountant / bookkeeper" | `cpa` |
| "Lawyer / attorney / law firm" | `law-firm` |
| "Agency, ads, content, social, growth, creative" | `marketing-agency` |
| "We sell AI services to clients" | `ai-agency` |
| **Anything else** | Pick the closest, ask their primary workflow |

---

## 5. How to choose the right demo link

Two paths. **Always send a signed link** — never a raw URL.

### Fast path (during a live call)

1. Go to `/app/share` while you're on the call.
2. Pick the vertical from the dropdown.
3. Type the prospect's company name in **Prospect**.
4. Click **Mint signed link**.
5. Copy and paste it into the chat / email immediately.

The link is HMAC-signed, expires in 7 days by default, and the
watermark says `DEMO WORKSPACE FOR <PROSPECT> · BASELINE OS · NO LIVE
CUSTOMER DATA`. Prospects can open it without signing up.

### Slow path (post-call)

Use the same `/app/share` flow but set a 24-hour TTL and add a tour
flag. Paste into the T+0 email template (section 11).

### Direct demo link (cold outbound)

`https://mission.baselineautomations.com/?demo=<vertical>` —
no signature. Use this only in cold outbound or social posts. The
watermark says **DEMO** but no prospect name.

---

## 6. How to run discovery

Open the vertical-specific playbook in `/app/docs/sales/<vertical>.md`,
section 3. Use the 10 questions in order. Don't ad-lib.

Three things to actively listen for:

1. **A number** — hours, dollars, percent. If they can't give a
   number, the pain isn't bad enough to pilot.
2. **A specific workflow** — "the last project that broke," "the
   last lead I lost," "the last closing that slipped." Specifics
   are gold; vague pain is a tire-kicker.
3. **A budget signal** — when they say what they pay for staffing,
   software, or the current bad solution, the offer math gets easy.

Discovery is 25 minutes. Not 45. Not 10. Pick **one** primary KPI
together — hours, dollars, conversion, or cycle time — and lock it.
You can't measure four things; you can measure one.

---

## 7. How to send the 60-second demo

When the discovery call ends, screen-share, walk this exact path:

1. Open `mission.baselineautomations.com` — **show the homepage**:
   "This is the marketing site, but watch what happens when I
   click `Book a Demo`."
2. Click **Book a Demo** → opens guided demo.
3. The vertical they picked auto-loads. Walk **3 panels** only:
   - The AI Workforce Dashboard at `/app/workforce` — "Here are
     the 4 AI employees on your team."
   - The Swarm Mode panel at `/app/workflows/swarm` — "Here's
     one of them running a mission. Verification judge says PASS."
   - The Approvals queue at `/app/approvals` — "Here's how risky
     actions wait for your approval."
4. End on the ROI counter at the top: "This is the hours-saved
   meter from the simulation. Pilots come in within 15% of this
   number on real data."

**Do not show everything.** Three panels. Eight minutes. Then ask
the close question (section 15).

---

## 8. How to pitch AI employees

This is the language win. Use it consistently.

| ❌ Don't say | ✅ Say instead |
|-------------|----------------|
| "AI assistant" | "AI employee" |
| "Bot" | "AI agent" |
| "Tool" | "AI workforce" |
| "Feature" | "Skill" or "role" |
| "Workflow" | "Mission" (when ad-hoc) or "Skill" (when recurring) |
| "Plugin" | "Skill pack" |
| "Onboarding" | "Hire" (when activating an AI employee) |

Every AI employee has:
- A **role** (Intake Receptionist, Doc Collection, etc.)
- A **department** (Front Office, Operations, Compliance)
- A **memory source** (Notion / Obsidian / SQLite / custom)
- An **approval policy** (which actions wait for the human)
- A **runtime** (Hermes / OpenClaw / Claude Code) doing the work

When a prospect asks "what does this AI employee actually do?" —
pick the **star employee** from the playbook outline (section 1)
and answer in one sentence: *"This one [verb] [object] using
[memory source]."*

---

## 9. How to explain Mission Control

> "Mission Control is the operator's command center. It supervises
> the AI workforce — same as a shift manager supervises a team. You
> see who's working on what, what's pending approval, what's
> escalated, and what just shipped. It doesn't do the work itself —
> it makes sure the work is being done right."

If the prospect asks "is this just a dashboard?" answer:
**"It's a dashboard plus the approval gates plus the audit log plus
the memory citation viewer. The dashboard is the surface. The
supervision is the value."**

---

## 10. How to explain Baseline OS

> "Baseline OS is the coordination layer underneath Mission Control.
> It's how AI employees get assigned roles, how skills get installed,
> how memory gets routed, and how missions get orchestrated. You
> don't touch it directly. It's the engine; Mission Control is the
> dashboard."

Most prospects don't need this layer named. Only bring it up if
they ask "what about the underlying system" or they're technical.

---

## 11. How to explain memory

> "Every AI employee has its own memory bank — connected to your
> docs in Notion, Obsidian, your CRM, or a custom database. When an
> AI employee takes an action, it cites the document it pulled from.
> If your vendor SLA says 'plumbing emergencies dispatched within
> 2 hours,' and the AI dispatches a plumber, you'll see a citation
> back to your SLA doc. Memory isn't a brain — it's a citation
> engine."

This kills the "AI hallucinates" objection on the spot. Show one
memory citation card during the demo. Show another in the recap.

---

## 12. How to explain approvals

> "Mission Control gates risky actions. Sending a client a contract.
> Quoting a price. Scheduling something irreversible. You define
> which actions need your approval; the AI drafts them and waits.
> If you're sleeping, it waits. If you're on vacation, it routes to
> your backup. Nothing risky ever ships without a human."

This kills the "what if it's wrong?" objection. Open the approval
queue during the demo. Show one pending approval. Approve it live.

---

## 13. How to explain ROI

Three numbers, one question.

> "If we install [vertical's star employee] on your account and it
> [primary KPI delta], what's the dollar impact for you?"

Then plug the discovery answer into the playbook's ROI math table
(section "Reference ROI math" in every vertical doc). Show them the
number. Don't editorialise.

If they push back on the math: **"These numbers are conservative —
they assume your average ticket, your average response rate, and a
50% close rate on recovered opportunities. Run a 14-day pilot and
we measure your actual numbers, not ours."**

---

## 14. How to handle objections

Six universal objections show up in every vertical. Memorise the
top-line answer; the full table lives in each playbook's section 4.

| Universal objection | Top-line answer |
|---------------------|----------------|
| "We tried AI / ChatGPT — didn't stick." | "Chat box vs. workforce. Different category." |
| "AI hallucinates." | "Memory citations. Every action shows its source doc." |
| "What if it's wrong?" | "Approval gates. Risky actions never auto-send." |
| "We already use [PMS / CRM / practice software]." | "Keep it. Mission Control sits on top and routes through it." |
| "We're too small." | "Smallest teams benefit fastest. The owner is the dispatcher, the closer, and the bookkeeper." |
| "Compliance / data sensitivity." | "Audit log per touch. Memory citations. Workspace isolation. SOC 2 path in progress." |

For vertical-specific objections (e.g. "bar rules," "GLBA," "IRS data,"
"buyers don't text") — open the playbook, section 4.

---

## 15. How to close the 14-day pilot

The exact close question, word for word:

> **"If I showed you four AI employees running on your real data
> in 14 days for $1, would you be open to a pilot?"**

Three responses, three plays:

| Their answer | Your play |
|-------------|-----------|
| **Yes** | Open Stripe checkout for the $1 setup. Schedule day-0 kickoff (45 min) within 48 hours. Send the pilot agreement immediately. |
| **Maybe / "send me info"** | Send the signed demo link + the vertical playbook one-pager. Queue T+3 reference email. |
| **No / not now** | "Understood — what would have to be true for this to be a yes 90 days from now?" Capture the answer. Add to 90-day re-engage. |

When they say yes, **the next step is not another call.** It's the
Stripe checkout link and the pilot agreement. Friction kills.

---

## 16. How to follow up

The follow-up sequence is the same across verticals (cadence in
playbook section 5):

| Day | Channel | What |
|-----|---------|------|
| T+0 | Email | Recap + signed demo link + ROI calc link |
| T+1 | SMS | Quick nudge (if opted in) |
| T+3 | Email | Reference story from a similar customer |
| T+5 | LinkedIn | Light touch (comment on a post, share article) |
| T+7 | Email | "15 minutes this week?" with 3 slots |
| T+10 | SMS | Last SMS in the sequence |
| T+14 | Email | Pilot proposal one-pager |
| T+21 | Email | 90-day re-engage |

Stop the sequence on: meeting booked · explicit no · re-engage
opt-in · unsubscribe.

---

## 17. What to say after no response

After T+21 with no response, send this exact message:

```
Subject: Closing the loop on {{company}}

{{first_name}} —

Going to stop following up here so I'm not noise in your inbox.

Two paths if you ever want to pick it back up:

1) Run the math on your own at:
   https://mission.baselineautomations.com/roi-calculator

2) Reply with "open" anytime and I'll reopen the conversation.

Either way — appreciated you giving the demo a look.

— {{rep_name}}
```

Then queue 90-day re-engage. Don't delete them. Don't pester them.
Most agencies and PM companies buy on quarterly budget cycles.

---

## 18. What to say after demo watched (signed link telemetry)

Mission Control tells you when a signed demo link is opened. When
that happens within 24 hours of you sending it:

```
Subject: Saw you opened the demo — anything stand out?

{{first_name}} —

Saw you walked through {{company}}'s demo workspace. Curious —
which AI employee felt most relevant to your week 1?

If you've got 15, I'd love to scope a $1 pilot specifically
around it. {{calendar_link}}

If not, no worries — happy to send the recorded walkthrough
instead.

— {{rep_name}}
```

This is your highest-converting touch. Open rate doubles when you
reference their own behavior.

---

## 19. What to say after pilot proposed (T+14 sent, no response)

Two-touch close-out.

**Touch 1 (T+16):**

```
Subject: 30-second decision on the pilot — {{company}}

{{first_name}} —

Pilot proposal still sitting?

  - $1 today
  - 14 days
  - One operator, three AI employees on one workflow
  - You measure ROI on day 13

If it's a no, just reply NO and I'll close the loop. If it's a
yes, sign here: {{pilot_signup_link}}.

— {{rep_name}}
```

**Touch 2 (T+19):**

```
Subject: Last note — {{company}}

{{first_name}} —

I'll stop here. If timing changes, the door's open at
{{calendar_link}}.

— {{rep_name}}
```

---

## 20. What to do every day

The daily sales operator routine. ~90 minutes if you stay disciplined.

### Morning (30 min)

- [ ] Check Mission Control's signed-link telemetry — who opened a demo?
- [ ] Reply to anyone who opened in the last 24h (template § 18)
- [ ] Send T+1 SMS to yesterday's demos
- [ ] Send T+3 reference email to anyone hitting T+3 today
- [ ] Send T+7 ask to anyone hitting T+7 today

### Midday (60 min)

- [ ] Two new discovery calls (use playbook § 3)
- [ ] Two demos (use § 7's 60-second script)
- [ ] One pilot proposal sent (use § 15's close path)

### End of day (15 min)

- [ ] Log every call outcome in CRM with the **one number** the
      prospect gave you
- [ ] Update the pilot ticket for any active pilot you're co-running
      (template in `docs/onboarding/14_DAY_PILOT_SOP.md`)
- [ ] Queue tomorrow's T+1, T+3, T+5, T+7, T+10 touches

### Weekly (Friday afternoon, 60 min)

- [ ] Pipeline review: every prospect, current stage, next action
- [ ] Pilot review: every active pilot, primary KPI status, day count
- [ ] Stack-rank top 10 prospects for next week
- [ ] Read 1 vertical playbook end-to-end you didn't open this week

---

## 21. The daily sales checklist (print this)

```
[ ] Demos opened (yesterday)        ____
[ ] Demos sent (today)              ____
[ ] Discovery calls (today)         ____
[ ] Pilots proposed (today)         ____
[ ] $1 pilots converted (today)     ____
[ ] T+1 / T+3 / T+7 sent           ____
[ ] One number captured per call?   Y / N
[ ] CRM updated by 6pm?             Y / N
```

If you score above 7/8 every day for a week, your pipeline will
not be the problem.

---

## 22. The pre-call checklist (60 seconds before every call)

```
[ ] I know which vertical I'm pitching
[ ] I have /app/docs/sales/<vertical>.md open
[ ] I have /app/share open in another tab
[ ] I have the ROI calculator open in a third tab
[ ] I have a fresh signed demo link ready to mint
[ ] I know the star employee for this vertical by heart
[ ] I know the 3 wins from the playbook outline
```

Nothing kills a call faster than fumbling to find the demo.

---

## Appendix A — Shortcuts

| Goal | URL or doc |
|------|-----------|
| Mint a signed demo link | `/app/share` |
| Run discovery on a vertical | `/app/docs/sales/<vertical>.md` § 3 |
| Look up an objection answer | `/app/docs/sales/<vertical>.md` § 4 |
| Send the recap email | `/app/docs/sales/<vertical>.md` § 6 |
| Send the recap SMS | `/app/docs/sales/<vertical>.md` § 7 |
| Look up ROI math | `/app/docs/sales/<vertical>.md` last table |
| Open the ROI calculator | `mission.baselineautomations.com/roi-calculator` |
| Find the pilot agreement template | `/app/docs/onboarding/14_DAY_PILOT_SOP.md` |
| Day-0 kickoff agenda | `/app/docs/onboarding/14_DAY_PILOT_SOP.md` § Day 0 |
| Send pilot ROI capture | `/app/docs/onboarding/14_DAY_PILOT_SOP.md` § Day 11 |

---

## Appendix B — The architecture sentence (memorise)

> **"Mission Control supervises. Baseline OS coordinates.
> Hermes, OpenClaw, and Claude Code execute."**

If you can say this one sentence cleanly, you've already
out-positioned 90% of the AI tooling market. Say it on every demo.
Put it in every recap email. Print it on the back of your laptop.

---

## Appendix C — When to escalate

You don't have to close every deal alone.

| Situation | Escalate to |
|-----------|-------------|
| Prospect asks about SOC 2 / HIPAA / GLBA specifics | Customer Success lead |
| Prospect asks for white-label / OEM | Founder |
| Prospect quotes >$5k/mo budget | Founder, get them on the next demo |
| Prospect mentions VC funding for them | Founder |
| Prospect rejects the $1 pilot but says they'll do $5k/mo | Founder — that's a strategic deal, not a pilot |
| Prospect has 100+ properties / 50+ clients / 50+ employees | Customer Success lead, joint demo |

---

**Final standard:** if you can read this doc, open `/app/share`,
mint a signed link in 30 seconds, send the 60-second demo, run
discovery from the vertical playbook, and propose the $1 pilot
without consulting anyone else — you are launch-ready.

Go sell.
