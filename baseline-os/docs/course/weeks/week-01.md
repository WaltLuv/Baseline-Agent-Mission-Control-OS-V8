# Week 1 — The Dashboard & The Sidecar

> **Outcome:** By the end of this week your localhost dashboard at `http://localhost:8081` is running, every route returns 200, and you've had your first conversation with Gemini through it.

---

## Why this week matters

Most AI courses start with "open ChatGPT." We start with **a server you own**, **a UI you can read**, and **eight agents that report to you**. The difference between an AI user and an AI operator is whether you can name the components when something breaks.

You're not just installing software this week. You're installing a mental model: **client (the React dashboard) talks to a sidecar (the vite middleware) which routes to the agents (OpenRouter + local Ollama + the NotebookLM CLI + …)**.

---

## Pre-class reading (~20 min)

- The README of [`baseline-agent-os`](../../../README.md) — focus on the architecture diagram.
- The 50-line intro of [`vite.config.ts`](../../../vite.config.ts) — note how Vite's `configureServer` hook becomes our backend.

## Live lecture outline (60 min)

**0:00 — Why localhost wins (10 min)**
- Sovereign data: your prompts, conversations, memories, and outputs all stay on your machine.
- Composability: a localhost dashboard is just files — you can fork, customize, deploy.
- Cost ceiling: no per-seat SaaS fees. The only cost is the API calls you choose to make.

**0:10 — The architecture (15 min)**

```
┌────────────────────────────────────────────────────────────┐
│  Browser (React + TanStack Router)                         │
│  http://localhost:8081                                     │
└──────────────────────────┬─────────────────────────────────┘
                           │ fetch('/__ai_chat')
                           ▼
┌────────────────────────────────────────────────────────────┐
│  Vite Dev Server (Node) — same process                     │
│  configureServer hook adds 40+ /__* middleware endpoints   │
└──────┬──────────────────────────┬─────────────────────────┬┘
       │                          │                         │
       ▼                          ▼                         ▼
  OpenRouter API           Ollama (local)           notebooklm-py CLI
  (cloud LLMs)             (Gemma 4 31B)            (Chrome cookies)
```

The dashboard ships everything in one Bun process. There is no separate backend deployment.

**0:25 — The 8 agents in one slide (10 min)**

| Agent | Best at | Where it runs |
|---|---|---|
| **Gemini** | Long-context orchestration, image/video plans, math | OpenRouter (cloud) |
| **Claude (Opus 4.7)** | Architecture decisions, careful reasoning | OpenRouter or via Claude Code CLI |
| **Hermes** | Long-running tasks, persona-driven work | Local Hermes agent on your machine |
| **OpenClaw** | Multi-channel chat operations | Local gateway, currently scaffolded |
| **Codex** | Coding tasks | OpenAI Codex CLI |
| **Gemma 4** | Free + private inference, prototyping | **Local Ollama** |
| **NotebookLM** | Cited research over your own sources | notebooklm-py CLI |
| **ClaudeClaw** | Claude Code delivered to Telegram | Local claude CLI piped to TG bot |

**0:35 — A tour of the sidebar (15 min)**

Walk through the live sidebar:
- Primary nav: Home / Skills / Library / Memory / Notion / Pinecone / Activity
- Personal: Goals / Journal / Notebook / Prompts / Guide / Kanban / SEO / Studio
- Tools: Higgsfield / HyperEdit / CLI-Anything / Understand / WACRM / AION UI / Maestro / Browser-Use / Triad Council
- Agents: 8 cards

For each section, explain: *what data drives it, where the data lives, who can write to it.*

**0:50 — Q&A buffer (10 min)**

---

## Hands-on lab (2 hours)

### Step 1 — Setup (40 min)

```bash
# install bun if you don't have it
curl -fsSL https://bun.sh/install | bash

# clone + install
git clone https://github.com/WaltLuv/baseline-agent-os.git ~/code/baseline-agent-os
cd ~/code/baseline-agent-os
bun install

# fill in keys — at minimum, OPENROUTER_API_KEY is required
cp .env.local.example .env.local
$EDITOR .env.local

# run
bun run dev
```

Open `http://localhost:8081`. Confirm the sidebar renders.

### Step 2 — Verify every route returns 200 (30 min)

Run this in a second terminal:

```bash
ROUTES=(
  "" "skills" "library" "memory" "notion" "pinecone" "activity"
  "goals" "journal" "notebook" "prompts" "guide" "kanban" "seo" "studio"
  "higgsfield" "hyperedit" "cli" "understand" "wacrm" "aion-ui" "maestro" "browser" "triad"
  "agents/hermes" "agents/openclaw" "agents/gemini" "agents/free-claude"
  "agents/codex" "claudeclaw" "agents/notebooklm" "agents/antigravity" "agents/ruflo"
)
for r in "${ROUTES[@]}"; do
  code=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:8081/$r")
  echo "  /$r → $code"
done
```

Every line should say 200. If anything is 404 or 500, screenshot it and ask in `#baseline-agents`.

### Step 3 — First conversation (30 min)

1. Click on **Gemini** in the sidebar (`/agents/gemini`)
2. In the chat panel, paste:

   > In one paragraph, explain to me what role you play inside Baseline Automations and what makes you different from the other agents on this dashboard.

3. Save the response in a new note at `docs/journal/week-01-first-conversation.md`.

### Step 4 — Read the sidecar (20 min)

Open `vite.config.ts`. Find these by line number:
- The `configureServer` hook (search for `configureServer`)
- The `/__ai_chat` middleware
- The `AGENT_CONFIG` object (~line 2533)
- The `SHARED_SKILLS_NOTE` constant

You don't need to understand every line. You need to know **where the agent personalities live in code**.

---

## Self-study (2 hours)

- Read [`vite.config.ts`](../../../vite.config.ts) from line 1 to line 200. Make notes on anything confusing.
- Watch your dashboard while you go about your day. Notice when you instinctively want to open a different tool — that's a candidate feature for week 12 capstone.

---

## Office-hours discussion prompts

1. Did any route return non-200? What did the error look like?
2. What did Gemini say it was best at? Did its answer match the agent matrix above?
3. What's *missing* from the sidebar that you'd want for your work?

---

## Deliverable (what you ship by end of week)

- ✅ Screenshot of all 30+ routes returning 200
- ✅ Gemini's intro paragraph saved to your local repo
- ✅ One question logged in `#baseline-agents` about something in the codebase you don't understand yet

---

## Common issues

- **`bun: command not found`** → close + reopen your terminal after the install script
- **`OPENROUTER_API_KEY` missing** → required even for Hermes since Hermes proxies through it
- **Port 8081 already in use** → set `PORT=8090 bun run dev` and update `vite.config.ts` if needed
- **Skills not showing in `/library`** → run `bun run scripts/install-skills.ts` once
