# 14-Day Pilot Standard Operating Procedure

> Every paid pilot follows this exact 14-day arc. The goal is one
> measurable business outcome by day 14, not a tour of every panel.
> If we can't show ROI by day 14, we don't ask for the upgrade.

---

## Pilot fundamentals

| Item | Value |
|------|-------|
| Length | 14 calendar days |
| Price | $1 — credit-card-on-file (sets up the upgrade path) |
| Headcount | 1 operator, up to 3 AI employees |
| Verticals | one of the 9 launch verticals |
| Success metric | one operator-chosen primary KPI (hours saved OR $ recovered OR conversion lift) |
| Exit | upgrade to paid plan, downgrade to free demo, or off-board cleanly |

---

## Day-by-day cadence

| Day | Owner | Step | Touchpoint | Output |
|-----|-------|------|-----------|--------|
| 0 | Sales | **Kickoff call (45 min)** | live video | signed pilot agreement, primary KPI chosen, vertical chosen |
| 1 | Customer Success | **Data collection** | async checklist | tools list, SOPs uploaded, sample data shared |
| 2 | CS | **Memory setup** | live (30 min) | Obsidian / Notion connected, top 10 docs indexed |
| 3 | CS | **Workflow mapping** | live (60 min) | 3 candidate workflows scoped, picked one for week-1 mission |
| 4 | CS | **Runtime onboarding** | live (45 min) | Hermes / OpenClaw / Claude Code installed; harness passes |
| 5 | Operator | **First mission launched** | async | Swarm Mode run completes; verification judges green |
| 6 | Operator | **Operator works alongside AI** | async | first daily standup digest sent |
| 7 | CS | **Week-1 review (30 min)** | live | 3 wins / 1 blocker / 1 ask documented |
| 8–10 | Operator | **Productive use** | async | AI workforce runs every business day |
| 11 | CS | **ROI capture call (30 min)** | live | hours-saved + $-impact baseline measured; case study draft started |
| 12 | CS | **Approval & escalation review** | live (30 min) | every approval-gated action logged & reviewed |
| 13 | Sales + CS | **ROI review + upgrade conversation** | live (45 min) | conversion decision, plan tier chosen, invoice issued OR off-board scheduled |
| 14 | Sales | **Pilot close** | async | converted to paid OR off-boarded with clean shutdown |

---

## Day 0 — Kickoff (45 minutes)

**Pre-call:** customer signed the pilot agreement and provided
billing details for the $1 setup.

**Agenda:**

1. (5 min) Welcome + remind them what a 14-day pilot looks like.
2. (10 min) Pick the **primary KPI**. Only one. Choose from:
   - Hours saved per week by a specific person/role
   - $ recovered from a specific revenue leak (e.g. aging AR)
   - Conversion lift on a specific funnel (e.g. lead → booked)
   - Cycle time on a specific workflow (e.g. estimate → sent)
3. (10 min) Pick the **vertical template** (PM / GC / Home Services /
   Real Estate / Mortgage / CPA / Law / Marketing Agency / AI Agency).
4. (10 min) Walk through the guided demo for that vertical so they
   see the AI workforce they're about to deploy.
5. (10 min) Schedule the next four sessions (days 2, 4, 7, 11, 13).
   Send calendar invites before the call ends.

**Artifacts produced:**
- Pilot ticket in `pilots/<customer-id>.md` (see template at the bottom of this doc)
- Calendar invites sent
- Slack / WhatsApp channel created (`#pilot-<customer-slug>`)

---

## Day 1 — Data collection (async)

Send the customer this single checklist. Don't move on until every
box is checked.

- [ ] Company name, primary domain, billing email
- [ ] Tools list: CRM, calendar, voice, payments, docs/wiki
- [ ] 3 SOPs uploaded (PDF or doc link)
- [ ] Sample dataset (50 rows minimum) for the primary workflow
- [ ] Compliance constraints (HIPAA / GLBA / PCI / state regs / TCPA / CAN-SPAM)
- [ ] Approval policy: which actions require human sign-off
- [ ] Hours/week the operator can invest in week 1

This is gated. No data → no memory setup. No memory setup → no
mission.

---

## Day 2 — Memory setup (30 minutes live)

1. Connect the source — Notion or Obsidian (both work).
2. Index the top 10 docs the customer says drive their decisions.
3. Verify a query: ask Mission Control to recall something only the
   docs would know. Confirm citation shows in the response.
4. Document any documents the customer **refuses** to share (legal,
   HR, PII). Note them as out-of-scope.

Acceptance: a memory citation renders inside an AI employee card on
the customer's workspace.

---

## Day 3 — Workflow mapping (60 minutes live)

Whiteboard exercise:

1. List every recurring task the operator touches each day.
2. Mark each one with:
   - **A** — should be automated
   - **S** — should be supervised by AI but human-decides
   - **H** — human only
3. From the **A** list, pick **3 candidate workflows** scored by:
   - frequency × time-saved × reversibility
4. Pick **one** for the week-1 mission. The other two land in the
   week-2 backlog.

Acceptance: one workflow named, scoped to ≤ 5 steps, owned by ≤ 2
AI employees.

---

## Day 4 — Runtime onboarding (45 minutes live)

1. Install whichever runtime is appropriate:
   - Hermes — strategy + memory recall
   - OpenClaw / OpenCode — execution
   - Claude Code — implementation
2. Run `./scripts/runtime-validate.sh --runtime <id>` against the
   customer's Mission Control instance.
3. All 5 stages must PASS. If they don't, fix the runtime config
   (not Mission Control) and re-run.
4. Confirm the Runtime Validation panel shows a green band.

Acceptance: runtime validation harness prints `PASS` for every stage.

---

## Day 5 — First mission (async)

Operator runs Swarm Mode in `/app/workflows/swarm` with a mission
matching the week-1 workflow. Verification judges must return PASS
before the run is allowed to persist.

If judges return `attention`:
- review the flagged item with the operator
- approve or revise
- re-run

Acceptance: one persisted run with judges all green.

---

## Day 6 — Operator works alongside AI (async)

Operator uses Mission Control daily. Daily standup digest goes to
their inbox at 7am local. CS monitors via `/app/runtime-validation`
and the activity feed.

CS pings the operator if:
- no heartbeat in 24 hours
- approval queue grows past 5 pending items
- any agent shows `needs-attention` for > 2 hours

---

## Day 7 — Week-1 review (30 minutes live)

Run through:

1. **3 wins** the AI workforce delivered this week (with $ or hours).
2. **1 blocker** that stopped them from getting a 4th win.
3. **1 ask** — what feature, integration, or skill they need next.

Update the pilot ticket. Adjust the week-2 backlog if needed.

---

## Day 8–10 — Productive use (async)

CS touches the channel every 24 hours, lightweight. Operator drives.

---

## Day 11 — ROI capture (30 minutes live)

Numbers, not vibes:

| Metric | Baseline (pre-pilot) | Pilot result | Delta |
|--------|---------------------|--------------|-------|
| Hours / week on the workflow | X | Y | Z saved |
| $ recovered (AR / no-shows / leakage) | X | Y | +Z |
| Conversion (leads → booked, etc.) | X% | Y% | +Z pts |
| Cycle time | X days | Y days | -Z days |

Start the case study draft (1 paragraph + 3 bullets).

---

## Day 12 — Approval & escalation review (30 minutes live)

Open `/app/approvals` and walk the operator through every gated
action since day 5. Confirm:

- they understood why each one paused
- the approval decision was correct in hindsight
- no action ran without their approval that should have paused

This is the trust transfer. The pilot doesn't convert unless the
operator trusts the supervision layer.

---

## Day 13 — ROI review + upgrade (45 minutes live)

Open the ROI capture from day 11 + the wins from day 7. Present the
upgrade options:

| Tier | Monthly | Best for |
|------|---------|----------|
| Operator | $99 | 1 user, up to 5 AI employees, 1 runtime |
| Team | $299 | up to 5 users, unlimited AI employees, 2 runtimes |
| Workspace | $799 | up to 25 users, all runtimes, priority support |

Ask the close question: **"Based on the ROI you captured, which tier
matches what you need next month?"**

Outcomes:

- **Convert → upgrade** — invoice issued, billing flipped from $1
  pilot to paid plan, kickoff next week's expansion.
- **Convert → wait** — keep at pilot tier for $99/mo until they
  expand. Re-engage in 14 days.
- **No convert** — schedule day-14 clean shutdown. Get a
  one-paragraph testimonial if possible.

---

## Day 14 — Pilot close (async)

If converted:
- email confirmation of plan tier + first month's invoice
- schedule expansion call (next workflow live by day +14)
- enable the customer in `/pilots` as "converted"

If off-boarded:
- Disable the workspace (read-only for 30 days, then purge)
- Export their memory + workflow definitions and email to them
- Send a 4-question exit survey

---

## Pilot ticket template — copy to `pilots/<customer-id>.md`

```markdown
# Pilot — <Customer Name>
Started: YYYY-MM-DD
Vertical: <pm|gc|home-services|real-estate|mortgage|cpa|law-firm|marketing-agency|ai-agency>
Primary KPI: <hours-saved | dollars-recovered | conversion-lift | cycle-time>
Owner: <CS name>
Sales: <Sales name>

## Day 0 — Kickoff
- KPI: …
- Workflow shortlist: 1) … 2) … 3) …

## Day 1 — Data
- Tools: …
- SOPs uploaded: …
- Compliance: …

## Day 2 — Memory
- Source: Notion | Obsidian
- Indexed docs: <count>
- First citation: <link>

## Day 3 — Workflow mapping
- Week-1 mission: …
- Week-2 backlog: …

## Day 4 — Runtime
- Runtime: hermes | openclaw | claude
- Harness output: PASS / FAIL (paste log)

## Day 5 — First mission
- Mission link: /app/workflows/swarm/<run-id>
- Judge verdicts: pass / attention / fail
- Deliverables: …

## Day 7 — Week-1 review
- Wins: 1) … 2) … 3) …
- Blocker: …
- Ask: …

## Day 11 — ROI capture
- Hours saved/week: …
- $ recovered: …
- Conversion lift: …

## Day 13 — Upgrade conversation
- Tier offered: …
- Decision: convert | wait | no-convert
- Notes: …

## Day 14 — Close
- Outcome: …
- Next milestone: …
```

---

## Pilot health flags (early warning)

CS reviews these every morning across the active pilot cohort:

| Flag | Trigger | Action |
|------|---------|--------|
| 🟡 Quiet | no operator activity > 24h | Slack ping the operator |
| 🟡 Memory drift | citations missing on 2+ employee cards | Re-index a doc on a live call |
| 🟠 Stalled | week-1 mission not launched by day 6 | Sales joins the next call |
| 🔴 Lost trust | operator rejects 2+ approvals in a row | Pause AI workforce, schedule trust-rebuild call |
| 🔴 Runtime down | heartbeat absent > 4h | Runtime install call, re-run harness |

A pilot ends week-1 with **two or more 🔴 flags** → CS escalates to
sales for a re-scope. Don't try to convert a broken pilot.

---

## Conversion benchmarks (internal)

These are targets, not promises:

- 80% of pilots complete the 14 days (don't abandon).
- 60% of completed pilots convert to a paid plan.
- 70% of conversions choose **Team** ($299) on first upgrade.
- < 14 days median from kickoff to first measurable win.

If we drop below 50% conversion for two consecutive cohorts, the
SOP gets a hard review. The number to watch is **time to first
measurable win**. Below 7 days → conversion stays high. Above 10
days → conversion collapses.
