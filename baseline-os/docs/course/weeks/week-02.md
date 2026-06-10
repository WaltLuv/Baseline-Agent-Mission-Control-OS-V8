# Week 2 — The 8 Agents

> **Outcome:** You stop asking "which AI should I use?" and start picking by reflex. You've sent the same task to four different agents and have receipts on which one wins for which kind of work.

---

## Why this week matters

In ChatGPT-world there's one model and one chat. In Baseline-Agent-OS-world there are eight, and choosing wrong costs you time, money, and quality. This week we build your **agent reflex**.

The reflex isn't memorized rules. It's an internalized sense of:
- This task is *long-running* → Hermes
- This task is *orchestration across modalities* → Gemini
- This task is *high-stakes architecture* → Triad council
- This task is *expensive iteration* → Gemma 4 local
- This task is *cited research* → NotebookLM
- This task is *coding* → Codex or Claude Code (ClaudeClaw)
- This task is *visual* → Higgsfield (driven by Gemini)

---

## Pre-class reading (~30 min)

- `vite.config.ts` from `AGENT_CONFIG` line through `SHARED_SKILLS_NOTE` close.
- The "Lead Orchestrator" badge logic on [`agents.gemini.tsx`](../../../src/routes/agents.gemini.tsx).
- The 4 cards on the home page that surface vital agent status.

## Live lecture outline (60 min)

**0:00 — The agent matrix (15 min)** — A whiteboard pass through each agent's strengths and constraints. Watch the live `/__vitals` endpoint while you talk.

**0:15 — Routing decisions (15 min)** — Concrete examples:
- "Generate a podcast script + voice it" → Studio (text) + ElevenLabs via `/__tts` (audio).
- "Plan a 4-shot Higgsfield campaign and produce CLI commands" → Gemini.
- "Pipe an answer through to my phone via Telegram" → ClaudeClaw.
- "Find every PropControl page in Notion that mentions vendor X" → NotebookLM or Notion search depending on whether you need citations.

**0:30 — Cost vs latency vs quality (15 min)** — The three-axis decision graph. Gemma 4 wins on cost. Opus wins on quality. Gemini wins on latency + context window. Show the OpenRouter price page.
-**0:45 — Hands-on agent tour (15 min)** — Walk through each agent page live, point out the unique tabs (Goal Mode on Hermes, War Room on ClaudeClaw, Studio on every agent).

---

## Hands-on lab (2 hours)

### The "Four-agent shootout"

Pick **one real task you have right now**. Examples:
- "Write a 3-paragraph cold email to a potential PropControl customer"
- "Architect a database schema for a tenant maintenance request system"
- "Generate 5 YouTube video concepts about creative finance"

Send it to four different agents:

| Agent | Submit via | Note |
|---|---|---|
| Gemini | `/agents/gemini` chat | Fastest, longest context |
| Claude Sonnet 4.6 (OpenClaw default) | `/agents/openclaw` chat | Solid all-rounder |
| Gemma 4 (local) | `/agents/free-claude` chat | $0 cost, slower |
| Triad council | `/triad` page | Opus + DeepSeek + GPT, ~$0.50/run |

For each output, score it 1–10 on:
- Quality
- Time-to-result
- Cost (estimate from OpenRouter dashboard)
- Would-you-use-this-output?

Save results in `docs/journal/week-02-shootout.md`.

### Bonus — try the wrong agent on purpose

Send Claude Code's job (write code) to Gemini. Send a one-line research lookup to the Triad. Notice the friction. That friction is the data you're training your reflex on.

---

## Self-study (2 hours)

- Read `src/components/agent-workspace.tsx` and `src/components/studio-toolbox.tsx` — these are the two reusable components every agent surface uses.
- Watch your own behavior for the next 3 days. When you reach for an agent, ask: "Which one am I picking, and why?" Log answers in your journal.

---

## Office-hours discussion prompts

1. Which agent surprised you with quality you didn't expect?
2. Which one was disappointing?
3. Where did the Triad win that no single model could match?

---

## Deliverable

- ✅ One-page comparison report: same task across 4 agents, scored
- ✅ One paragraph explaining when you'll pick each agent going forward
- ✅ Updated `docs/journal/week-02-shootout.md` shared in `#baseline-agents`

---

## Common issues

- **Triad returns "Insufficient credits"** → top up OpenRouter; Opus is the expensive call
- **Gemma 4 31B is slow on a 16 GB Mac** → drop to `gemma4:e4b` (9.6 GB, runs on 8 GB RAM)
- **Hermes shows offline** → that's expected this week; we wire Hermes properly in week 9
