# Baseline Automations — Weekend Intensive

> **2 days · ~14 hours total · Get ~30% of the depth, 100% of the foundation.**
> Best for: senior operators, technical founders, people who've already shipped AI-augmented work and want the architecture, not the basics.

---

## Who this is for

- You've already used Claude Code, Cursor, or built with an LLM API
- You can read TypeScript / Bash without flinching
- You have a real business or product you want to integrate with — not just curiosity
- You can dedicate Saturday + Sunday with no distractions

If you need more handholding than this, take the full 12-week course instead. The intensive is fast.

---

## Pre-workshop (the week before)

Without these done before Saturday morning, the workshop is wasted time.

| Task | Time | How |
|---|---|---|
| Install Bun, Node 20+, Python 3.12 via brew | 30 min | `brew install bun python@3.12 ollama gh` |
| Clone + boot the OS | 30 min | Follow Week 1 lab steps 1-2 |
| Read the [README](README.md) + [SYLLABUS](SYLLABUS.md) | 1 hr | Just the prose, not the per-week files |
| Top up OpenRouter to $20 | 5 min | We burn ~$5 over the weekend |
| Create Pinecone serverless index (free tier) | 10 min | https://app.pinecone.io |
| Share one Notion page with the integration | 5 min | Notion → Share → Add connections |

**You should land Saturday morning with a green dashboard at `http://localhost:8081`.**

---

## Saturday — Foundation + Memory (7 hours)

### Block 1 — 9:00am · The Architecture (90 min)

Combines **Weeks 1-2**.

- The 3-tier model (browser → vite sidecar → agents)
- 8-agent tour with `/__vitals` open in a second window
- The "Four-agent shootout" exercise — same task, four agents, scored side-by-side

**Outcome:** You can pick an agent on instinct.

### Coffee break (15 min)

### Block 2 — 10:45am · System Prompts as Constitution (90 min)

Compressed **Week 3**.

- The 6-layer anatomy
- Walk through `AGENT_CONFIG` + `SHARED_SKILLS_NOTE`
- **Live build: your own persona** in `~/.hermes/pantheon/personas/`
- Test it via the dashboard or curl

**Outcome:** One working custom persona on disk by lunch.

### Lunch (60 min)

### Block 3 — 1:15pm · The 3 Brains (90 min)

Compressed **Weeks 4-5**.

- Decision tree: Obsidian vs Notion vs Pinecone
- Wire all three live: Pinecone index, Notion root page, Obsidian path
- Seed 5 memories in each, query each from the dashboard
- Watch them all appear in the `/memory` 3D graph

**Outcome:** All three memory layers green; you can name the routing rule.

### Coffee break (15 min)

### Block 4 — 3:00pm · Karpathy + The Library (90 min)

Compressed **Weeks 5-6**.

- The four principles (think before / simplicity / surgical / goal-driven)
- Refactor your persona to be Karpathy-compliant
- Write your first skill (yours, real, useful), run the installer, see it in `/library`

**Outcome:** Skill #231 (yours) live.

### Break (30 min)

### Block 5 — 5:00pm · Multi-agent: Maestro (90 min)

Compressed **Week 7**.

- The shared message bus at `/__agent_message`
- Run a real /standup on a real decision (cohort vote on which decision)
- 3-step hand-off chain by hand

**Outcome:** Your first multi-agent transcript saved to journal.

### Dinner — homework: pre-read Week 8 + Week 9

---

## Sunday — Orchestration + Ship (7 hours)

### Block 1 — 9:00am · The Triad Council (90 min)

Compressed **Week 8**.

- Why architectural diversity beats single-model
- Run the Triad on each student's real decision
- Compare with single-model baseline

**Outcome:** Real Triad artifact saved.

### Coffee break (15 min)

### Block 2 — 10:45am · The Hermes MCP Loop (2 hours — longest block)

Compressed **Week 9**. The hardest setup of the course; budget extra time.

- Whiteboard the 3-layer architecture
- Live setup in pairs (one student types, partner debugs)
- All 8 steps: install → mint → tunnel → env → doctor → serve → connect → test
- Test prompt verified end-to-end

**Outcome:** Claude Desktop ↔ Hermes loop live for every student.

### Lunch (60 min)

### Block 3 — 1:45pm · Higgsfield + NotebookLM (90 min)

Compressed **Weeks 10-11** (Higgsfield + NotebookLM only; Browser-Use deferred).

- Higgsfield MCP device-flow auth
- Run one real 8-second campaign brief through Gemini
- NotebookLM via Chrome cookies; ask one cited research question

**Outcome:** One real Higgsfield asset + one real NotebookLM cited answer.

### Coffee break (15 min)

### Block 4 — 3:30pm · Architecture sketch for your custom surface (60 min)

Mini **Week 12**.

- Pick one of the 4 capstone tracks
- Draw your architecture on paper
- Pair-critique with one other student
- Identify exactly which files you'd touch in the repo

**Outcome:** A blueprint for the thing you'll build over the next 30 days.

### Block 5 — 4:45pm · Ship-day commitments + show-and-tell (75 min)

- Each student commits to a 30-day capstone target
- Show your custom persona, your custom skill, your architecture sketch
- Group critique of one student's plan in depth

**Outcome:** Public commitment + community accountability.

### 6:00pm · Wrap

---

## What you'll have by Sunday evening

- ✅ Green dashboard at `localhost:8081`
- ✅ One custom Hermes persona, Karpathy-compliant
- ✅ All 3 memory brains wired and queryable
- ✅ One custom skill in the library
- ✅ One Maestro transcript saved
- ✅ One Triad artifact saved
- ✅ Hermes MCP Loop live
- ✅ One Higgsfield asset
- ✅ One NotebookLM cited answer
- ✅ A 30-day capstone plan

## What you skip vs the full course

- Most of the *self-study* depth (you'll fill this in over your 30-day capstone)
- Week 11's Browser-Use harness
- Week 12's full capstone ship day (you do this on your own time)

## Workshop logistics

- **Cohort size:** capped at 20 (smaller = more 1:1 time)
- **Format:** in-person (single city per workshop) OR remote with cameras-on
- **Materials:** included — fork of the repo, all course docs, Discord lifetime access
- **What to bring:** laptop ≥16 GB RAM, $20 OpenRouter credits, your real decision for the Triad

## Pricing

- **Standard workshop weekend:** $997
- **Bring a teammate:** $1,597 for 2 (saves $397)
- **Private corporate weekend:** from $25k (up to 10 seats, custom curriculum)

Refund up to 72 hours before kickoff.
