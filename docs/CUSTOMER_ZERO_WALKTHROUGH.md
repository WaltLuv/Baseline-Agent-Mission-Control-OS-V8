# Customer Zero Walkthrough — Mission Control v3.0

> **Audience:** Walter narrating live to a prospect (property-management operator).
> **Duration:** 9 minutes, 30 seconds (target ≤ 10 min).
> **Goal:** Show "AI workforce installed, working, supervised" in one session — no setup ceremony, no jargon detour.
> **Phase 5 mandate:** This script depends on the Property Management Workforce installer.
> Other vertical installers are visible but marked "coming soon".
> Daily Brief and ROI dashboards are **explicitly out of scope** for this walkthrough.

---

## 0 · Setup before recording (30 seconds, OFF-CAMERA)

1. Clean workspace state:
   ```bash
   export PATH=/app/.node22/bin:$PATH
   node -e "
   const D=require('better-sqlite3'); const db=new D('/app/.next/standalone/.data/mission-control.db');
   db.prepare(\"DELETE FROM agents WHERE source='workforce-template:property-management'\").run();
   db.prepare(\"DELETE FROM tasks WHERE metadata LIKE '%workforce_template%property-management%'\").run();
   db.prepare(\"DELETE FROM settings WHERE key LIKE 'ws.%.workforce.%'\").run();
   db.prepare(\"DELETE FROM audit_log WHERE target_type='workforce_template'\").run();
   db.prepare(\"DELETE FROM activities WHERE entity_type='workforce_template'\").run();
   "
   ```
2. Browser at 1920×1080, signed-out, dark theme, dock hidden.
3. Pre-fill the signup form with a real-feeling fake operator: **"Sam Rivera · Coastal PM Group · sam@coastalpm.test"**.
4. Recording tool armed (Loom / OBS / QuickTime), audio levelled.

---

## ACT 1 · The hook (00:00 – 00:45) — "What does this actually do?"

### Screen 01 · Landing page (or `/pricing`)

**Walter says:**
> "If you run property management, you probably have a maintenance inbox, a rent chase spreadsheet, a vendor folder, an owner statement deadline, and inspections you keep forgetting. Mission Control is an AI workforce that handles all five — and you supervise it from one screen.
>
> I'll spin one up live. No demo data. Real install. 60 seconds."

**What the prospect should notice:** Confidence. No "let me onboard you for 30 minutes" — Walter just starts.

**Pause point:** 2 seconds on the landing hero, then click "Get started".

---

## ACT 2 · Signup → Onboarding → Hub (00:45 – 02:15)

### Screen 02 · `/signup`

**Action:** Fill `full_name=Sam Rivera`, `company_name=Coastal PM Group`, `business_type=Property Management`, email + 12-char password.
- Click **Create workspace**.

**Walter says (voice-over while typing):**
> "Standard signup — name, company, password. Notice the business-type selector — that's how Mission Control knows which workforce template to pre-stage for you."

### Screen 03 · `/onboarding`

**Action:** Three short steps, ~20 seconds total. Walter clicks **Activate Workforce →** on the final step.

**Walter says:**
> "Three onboarding questions, then it drops me into the Activation Hub. Three steps. That's the entire setup."

### Screen 04 · `/app/activate` — the **Activation Hub**

**What the prospect should notice:**
- "Three steps to activate **Coastal PM Group**." headline (workspace name personalised).
- Progress strip: 0 of 3 complete.
- Step 1 active: "Install your first system".

**Pause point:** 1.5 seconds on the hub before scrolling to the catalog.

**Proof moment #1:** Real product, real account, no canned demo.

---

## ACT 3 · The 60-second workforce install (02:15 – 03:45) — **THE MONEY SHOT**

### Screen 05 · Workforce catalog

**What the prospect should notice:**
- 8 vertical cards.
- **Property Management** has a green **Ready** badge.
- 7 others — General Contractor, Home Services, Real Estate, Mortgage, CPA, Law Firm, Agency — say "Coming soon".
- Selected card preview: *"A six-person AI workforce that triages maintenance, drafts tenant replies, chases rent, and flags vendor risk before it costs you a unit. 6 AI employees · 12 workflows · 11 tools · ~60s"*

**Walter says:**
> "This is the catalog. Property Management is shipping today. The other seven are coming. Pick yours, hit install, and you have a workforce. Watch."

### Screen 06 · Approval policy preview (1.5 s pause)

**What the prospect should notice:** The amber and red lines:
- **Needs your approval:** late rent notices, vendor payment authorizations, lease signing, owner financial statements, compliance communication
- **Always blocked:** deleting tenant data, exposing secrets, unauthorized payments, cancelling a lease without sign-off

**Walter says:**
> "Before I install — see this? Right out of the box, this thing knows what it's allowed to do on its own, what needs my approval, and what is *never* allowed. That's the supervision layer talking."

**Proof moment #2:** Approval policy is data, not theatre — every workflow carries `approval_policy: low|medium|high|blocked`.

### Screen 07 · Click **Install Property Management Workforce →**

**What the prospect should notice:**
- Cosmetic 8-second progress strip: *"Provisioning Property Management workforce… 27%… 64%… 91%… 100%"*.
- Behind the scenes the API completed in **24 ms**. The strip exists so the install *feels* like 6 people being onboarded — not a JSON POST.

**Walter says (during the strip):**
> "Six AI employees getting their roles, twelve starter workflows getting queued, eleven tools wired up, approval rules locked in. All in your workspace. Nothing shared, nothing copied from a demo tenant."

### Screen 07.5 · Daily Brief Email Preview (the inbox beat)

**Action:** From `/app/overview`, scroll to the Daily Brief panel → click **Preview email** in the footer. The modal opens with the rendered HTML email inside an iframe.

**Walter says (while hovering the email):**
> "And every morning — 7 AM, your timezone — this lands in your inbox. Subject line tells you the headline. Critical stuff at the top in red. Then the numbers. Then what needs your eye. You can reply from your phone."

**What the prospect should notice:**
- It's a real email, not a screenshot of an email.
- The "Status: clean." / "Status: 2 items need your eye." line at the bottom feels like a daily standup summary.

**Why this beat matters:** Converts the abstract "we have a daily brief" claim into a concrete artifact the prospect can mentally forward to their boss. Costs 8 seconds of demo time, removes a major sales objection ("do I have to log in every morning?").

### Screen 08 · Installed state — **the persona roster**

**What the prospect should notice:**
- Green ribbon: *"6 AI employees provisioned · 12 starter workflows queued · 11 tools tracked"*.
- Six persona cards in a 2-column grid:

| Name | Role |
|------|------|
| **Tessa Reyes** | Tenant Relations Lead |
| **Marcus Doyle** | Maintenance Dispatcher |
| **Rena Patel** | Leasing Coordinator |
| **Owen Whitfield** | Owner Relations |
| **Vince Cardella** | Vendor Coordinator |
| **Quinn Hartley** | Inspections & Compliance |

- Four deep-link buttons: **See the 12 queued tasks →**, **Connected Tools**, **Approval queue**, **Agent roster**.

**Walter says:**
> "Tessa handles tenants. Marcus dispatches maintenance. Rena runs leasing. Owen handles owners. Vince watches vendors. Quinn runs inspections. Six teammates, each with their own job, all under your supervision."

**Pause point:** 3 full seconds on the persona grid. Let the prospect *read every name*.

**Proof moment #3:** Real personas, real DB rows. (Off-camera reference: `agents` table, `source='workforce-template:property-management'`, `content_hash` unique per persona.)

---

## ACT 4 · "What did they queue up for me?" (03:45 – 05:30)

### Screen 09 · Click **See the 12 queued tasks →** → `/app/tasks`

**What the prospect should notice:**
- 12 tasks visible, every one in the `inbox` column.
- Each task has the workflow title from the spec:
  1. Maintenance intake (high)
  2. Rent collection cascade (high)
  3. Lease renewal 60 / 30 / 14 (medium)
  4. Move-in workflow (medium)
  5. Move-out workflow (medium)
  6. Inspection scheduling (low)
  7. Vendor insurance / COI expiry monitor (high)
  8. Owner statements (high)
  9. Listing refresh on vacancy (medium)
  10. **After-hours emergency routing (critical)** ← red badge
  11. Application processing (medium)
  12. Vendor performance tracking (low)

**Walter says (slow, deliberate, scan-the-list pace):**
> "Twelve real tasks. Not made up. These are the workflows every PM shop runs every week. Maintenance intake. Rent cascade. Lease renewal. Move-in. Move-out. Inspection scheduling. COI watch. Owner statements. Listing refresh. After-hours emergency. Application. Vendor performance.
>
> Critical-flagged one right there — the after-hours emergency routing. That one wakes me up at 2 AM only if a vendor can't be reached. Tessa handles the tenant safety check while I'm getting dressed."

**Pause point:** 4 seconds on the kanban so the prospect can count.

**Proof moment #4:** The 12 workflows match the spec exactly. Each task's `metadata` contains `workforce_workflow_slug` + `approval_policy` + `proof_expectation` + `success_criteria`.

### Screen 10 · Click one task — **Rent collection cascade**

**What the prospect should notice:**
- Task detail shows: description, owner persona (Tessa Reyes), approval policy (HIGH), proof expectation, success criteria.
- Audit trail panel: "Task created via workforce-template install · 6:03 AM · by sam@coastalpm.test".

**Walter says:**
> "Every task knows who owns it, what counts as proof, and what 'done' looks like. That isn't decoration — Marcus literally won't close a maintenance intake without pasting the vendor's ETA confirmation as the proof URL. Mission Control rejects it otherwise."

---

## ACT 5 · "Who's allowed to do what?" (05:30 – 06:30)

### Screen 11 · Click **Approval queue** deep link → `/app/tool-executions?status=pending_approval`

**What the prospect should notice:**
- Approval queue is empty today (nothing has run yet), but the page has filter chips for the 4 risk tiers: LOW, MEDIUM, HIGH, BLOCKED.
- Side panel: "Approval matrix" lists which actions auto-run vs need a human.

**Walter says:**
> "When the workforce wants to send a late-rent notice or authorise a vendor payment, *I* see it here first. Auto-runs the safe stuff. Asks me for the legal-and-financial stuff. Never does the dangerous stuff at all."

**Proof moment #5:** Supervision is the product. Not the workflows. Not the agents. The matrix.

### Screen 12 · Click **Connected Tools** deep link

**What the prospect should notice:**
- 11 tools listed — `mc`, `gh`, `notion-q`, `resend` installed; `vendor-cli`, `docusign-cli`, `calendar`, `listing-feed`, `inspection-cli`, `screening-cli`, `owner-statement-cli` shown with "needs connect" or "available" pills.

**Walter says:**
> "Same idea — the tools the workforce can call are all listed. The four green ones already work. The yellow ones — vendor dispatch, DocuSign, calendar, listing syndication — you connect those to your existing Buildium / AppFolio / Yardi stack. We don't replace those. We sit on top."

---

## ACT 6 · The 60-second close (06:30 – 09:00)

### Screen 13 · Back to `/app/activate` — Activation Hub showing Step 1 ✓

**What the prospect should notice:**
- Step 1: ✓ **Install your first system** ("Workforce installed · starter tasks queued")
- Step 2 active: **Connect a runtime** ("Plug Claude / Codex / OpenClaw / Hermes into Mission Control with one command")
- Step 3 pending: **Invite your team**
- Progress: 1 of 3 complete.

**Walter says:**
> "Step one is done. Two more — connect a runtime so the workforce actually executes work, then invite your team so the whole shop sees the same supervision plane. Both about 60 seconds each."

### Screen 14 · Step 2 → Click **Generate API key + command**

**What the prospect should notice:**
- A `connect-runtime.mjs` one-liner is generated with `MC_URL` + `MC_API_KEY` + `RUNTIME_TYPE` pre-filled.
- Copy button. Single command. No SSH ceremony.

**Walter says:**
> "Paste this on the box where Claude / Codex / OpenClaw / Hermes is going to run. That's it. Mission Control will see it heartbeat in real time."

### Screen 15 · Step 3 → invite teammate

**Action:** Type `partner@coastalpm.test`, role `operator`, send.

**Walter says:**
> "And bring your partner in as an operator so you're not running this alone."

### Screen 16 · `/app/overview` — Mission Control proper

**What the prospect should notice (call out by name):**
- Executive Briefing card at the top: "Quiet morning. Workforce ready."
- 6 AI Employee cards on the squad panel — Tessa, Marcus, Rena, Owen, Vince, Quinn — with operational style + trust pills.
- Activity Feed: "Installed Property Management workforce — 6 AI employees, 12 starter workflows queued"
- The "Mission Control · supervises · Baseline OS · directs · AI Workforce" identity strip at the top.

**Walter says:**
> "Same workspace I just signed up to ninety seconds ago. Six AI employees. Twelve queued tasks. One supervision plane. The thing I keep saying — Mission Control isn't the product. The workforce is the product. Mission Control is how I sleep at night while it runs."

---

## ACT 7 · The CTA (09:00 – 09:30)

### Screen 17 · Back to landing or `/pricing`

**Walter says:**
> "Sixty seconds to install. Six minutes to walk you through it. Property Management is live today. General Contractor, Home Services, Real Estate, Mortgage, CPA, Law, Agency — all rolling out in the next ninety days.
>
> If you want me to spin one up for your shop, hit the button. I'll install it on a real account, paste you the credentials, and you can break it for a week before you decide."

**On-screen CTA:** *Install my workforce →* (links to `/signup?utm=walkthrough`)

---

## Screenshot storyboard reference

| # | Screen | Path / data-testid | Why it matters |
|---|--------|-------------------|----------------|
| 01 | Landing hero | `/` | The promise. |
| 02 | Signup | `/signup` | Real account. |
| 03 | Onboarding | `/onboarding` | Three questions, no maze. |
| 04 | Activation Hub | `/app/activate` `data-testid=activation-hub` | Personalised + 3 steps. |
| 05 | Workforce catalog | `data-testid=workforce-catalog` | 8 cards, 1 ready, 7 coming soon. |
| 06 | Approval preview | `data-testid=workforce-preview-property-management` | Trust before install. |
| 07 | Progress strip | `data-testid=workforce-progress` | Feels like a hire. |
| 08 | Installed roster | `data-testid=workforce-installed` | 6 named personas. |
| 09 | Tasks board | `/app/tasks` | 12 inbox tasks visible. |
| 10 | Task detail | `/app/tasks/...` | Proof + criteria + audit. |
| 11 | Approval queue | `/app/tool-executions?status=pending_approval` | Supervision matrix. |
| 12 | Connected Tools | `/app/tool-executions` (Tools tab) | 11 tools, 4 ready. |
| 13 | Hub Step 1 ✓ | `data-testid=activation-step-system` `data-state=done` | Proof the install stuck. |
| 14 | Runtime connect | RuntimeConnectWizard | One-line install command. |
| 15 | Invite teammate | InviteTeamStep | The shop sees the same plane. |
| 16 | Mission Control overview | `/app/overview` | All 6 personas in the squad. |
| 17 | CTA | `/pricing` or `/signup` | Convert. |

---

## What Walter must NOT do during the walkthrough

- **Don't open the Daily Brief** — it isn't built yet.
- **Don't open the ROI page** — `/roi-calculator` exists but the "Show your boss" dashboard isn't built yet.
- **Don't promise any vertical other than Property Management** — show the "coming soon" cards but don't quote a date.
- **Don't show the developer-facing surfaces** (Workforce Credits panel, Token Dashboard, Margin widget) — those are admin tools and they distract from the workforce narrative.
- **Don't say the word "agent"** — say "AI employee" every time.

---

## Recording checklist

- [ ] Workspace state cleaned (Act 0 script run).
- [ ] Browser: 1920×1080, dark theme, dock hidden, no extensions visible.
- [ ] Bookmarks bar hidden.
- [ ] Microphone at -12 dB, post-EQ on.
- [ ] Cursor highlight ON, key-cast ON.
- [ ] Time check: ≤ 10:00.
- [ ] One take. If a step fails, restart the recording — don't edit around it.

---

## Proof points (the 5 things a prospect leaves remembering)

1. **60-second install.** Not a 30-minute onboarding.
2. **6 named AI employees.** Not "agents", not "bots".
3. **12 real workflows.** Not vapor.
4. **An approval matrix.** Mission Control supervises; nothing dangerous runs without a human.
5. **It's their workspace.** Not a sandbox tour.

— end —
