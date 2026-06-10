# Baseline Automations — The Course

> **Build, run, and live inside your own AI operations center.**
> 12 weeks · self-paced or cohort-based · ships every student with a production-grade multi-agent dashboard running on their own machine.

---

## Who this is for

You'll get the most out of this course if you are:

- **An operator** who wants AI to actually *run* their business — not just chat
- **A solo founder** who can't afford a 10-person team but wants 10-person output
- **A creator** building a YouTube/podcast/agency empire and tired of switching tabs between 12 tools
- **A developer** who's tired of one-off agent toys and wants the architecture behind a real OS
- **A property manager / agency owner / consultant** whose work is "knowledge work that scales linearly with my time" — until now

You don't need to be a senior engineer. You do need to be comfortable in a terminal, willing to read errors, and curious enough to debug.

---

## What you'll build

By the end of week 12 you will own:

- A **localhost dashboard** at `http://localhost:8081` with 50+ routes, 40+ backend endpoints, 230+ shared skills
- **8 specialist agents** wired together by a shared message bus, shared memory, and shared skill library
- **3 memory brains** (file-based Obsidian + cloud-native Notion + vector-native Pinecone) that every agent reads and writes
- A **Telegram bot** that pipes the actual `claude` CLI to your phone (ClaudeClaw bridge)
- A **NotebookLM bridge** that returns cited answers from your real Google notebooks
- A **Triad council** (Opus → DeepSeek → GPT) for high-stakes decisions
- A **movie studio** that turns one brief into a shot list, generates each shot through Higgsfield, and stores it as a reusable gallery
- A **WhatsApp CRM** (WACRM) operated by your choice of OpenClaw or Hermes
- **Browser automation** any agent can call
- A **capstone project** of your own design, deployed end-to-end

---

## Course shape

| Phase | Weeks | Focus | Outcome |
|---|---|---|---|
| **I · Foundation** | 1–3 | The dashboard, the agents, the memory layers | You can talk to every agent and know which to pick when |
| **II · Memory & Skills** | 4–6 | 3-brain memory, 230-skill library, Karpathy guidelines | Your agents recall everything across sessions |
| **III · Multi-agent orchestration** | 7–9 | Maestro bus, Triad council, Hermes MCP Loop | Agents hand work to each other autonomously |
| **IV · Creative + commercial** | 10–11 | Higgsfield studio, WACRM, NotebookLM, HyperEdit | You ship real content + close real deals |
| **V · Capstone** | 12 | Build, deploy, present | A custom agent surface on top of the OS |

Each week is **~5 hours**: 1 hour live lecture, 2 hours hands-on lab, 2 hours self-study + office hours.

---

## Per-week deep dives

| Week | Title | What you build that week |
|---|---|---|
| 1 | [The Dashboard & The Sidecar](weeks/week-01.md) | Clone + run Baseline Automations locally; first conversation with Gemini |
| 2 | [The 8 Agents](weeks/week-02.md) | Pick the right agent for the job; understand each one's strengths |
| 3 | [System Prompts as Constitution](weeks/week-03.md) | Edit a persona; ship Slim Charles + Saul; understand the SHARED_SKILLS_NOTE |
| 4 | [Three Brains: Obsidian, Notion, Pinecone](weeks/week-04.md) | Wire all three; query each from chat |
| 5 | [The 230-Skill Library](weeks/week-05.md) | Install your own skill, dedupe, surface in `/library` |
| 6 | [Karpathy + Andrej's Four Principles](weeks/week-06.md) | Hardcode discipline into every agent |
| 7 | [Maestro: the Cross-Agent Bus](weeks/week-07.md) | Run /standup, watch agents talk to each other |
| 8 | [The Triad Council](weeks/week-08.md) | Opus → DeepSeek → GPT high-stakes decisions |
| 9 | [The Hermes MCP Loop](weeks/week-09.md) | Claude Desktop → Hermes MCP → Hermes Agent on your machine |
| 10 | [Higgsfield Movie Studio](weeks/week-10.md) | Ship a real campaign end-to-end |
| 11 | [WACRM + NotebookLM + Browser-Use](weeks/week-11.md) | Three real-world execution surfaces |
| 12 | [Capstone & Ship Day](weeks/week-12.md) | Your custom agent surface, deployed |

Also see:
- 📅 [Full syllabus (printable)](SYLLABUS.md)
- ⚡ [2-Day Workshop Intensive](workshop-weekend.md) — if you don't have 12 weeks
- 👩‍🏫 [Instructor Guide](instructor-guide.md) — if you're teaching this
- 📓 [Student Handbook](student-handbook.md) — week-zero setup, what you need, FAQ
- 🎓 [Capstone Project Spec](capstone.md) — final project + rubric

---

## What makes this course different

**Most AI courses teach you to prompt.** This one teaches you to **architect**.

- We don't paste system prompts into ChatGPT and call it engineering.
- We design 3-layer memory systems that survive context resets.
- We wire 8 agents to a shared bus and watch them negotiate.
- We make peace with the Hermes MCP Loop: the brain (Claude) delegates to the bridge (Hermes MCP) which calls the hands (Hermes Agent) on your actual hardware.
- We treat skills like Unix utilities — composable, deduped by content hash, callable by name.
- We use Karpathy's "Four Principles" as a constitution and bake them into every system prompt.

**Most AI courses end with a chatbot demo.** This course ends with **a localhost dashboard you run every day**.

---

## Pricing & delivery models

| Format | Price | Cohort | Live? |
|---|---|---|---|
| **Self-paced** | $497 | Solo | No (course + Discord) |
| **Cohort** | $1,997 | 30 students | Weekly live calls (90 min × 12) |
| **Workshop weekend** | $997 | 50 students | Sat–Sun intensive, 14 hours total |
| **Private / corporate** | from $25k | Up to 10 seats | Custom + on-site available |

All tiers include:
- Full source access to Baseline Automations (this repo)
- Lifetime updates to course materials
- Access to the `#baseline-agents` Discord
- Office hours: weekly 1-hour group call (cohort+ only)

---

## Prerequisites

**Hardware:**
- macOS 14+, Linux, or Windows + WSL2
- 16 GB RAM minimum (32 GB recommended for the local Gemma 4 31B and Higgsfield workflows)
- 100 GB free disk (the Ollama models alone are ~20 GB; Chromium is another 90 MB)

**Software the course will install for you:**
- Bun (instead of node)
- Ollama (for local Gemma 4)
- Python 3.12 + pipx (for notebooklm-py)
- `gh` CLI (for the skill installer's private-repo pulls)
- Claude Code CLI + Codex CLI + Gemini CLI

**API budgets you'll burn through during the course:**
- OpenRouter: ~$30 for all 12 weeks (Triad runs are the most expensive)
- ElevenLabs: free tier covers 100% of the course
- Higgsfield: ~150 credits (their basic plan ships with this)
- Pinecone: free tier (1M vectors, plenty)
- Everything else (Notion, Google, FAL.ai, etc.): free tier

Total ~$30 in API spend across the entire course.

---

## How to enroll / start now

If you're holding a copy of this repo, you're already enrolled. The course is **the repo + the docs**.

```bash
# Self-paced, right now:
git clone https://github.com/WaltLuv/baseline-agent-os.git ~/code/baseline-agent-os
cd ~/code/baseline-agent-os
open docs/course/weeks/week-01.md     # start here

# Cohort or workshop enrollment:
# Contact: baseline@your-domain.example
```

---

## The promise

After 12 weeks you will no longer wonder *"what should I use AI for?"*

You will instead wonder *"what's the next agent I should add to my OS?"* — because the OS is yours, the agents work, and you've shipped something real on top of it.

That's the bar.

— Walter Thornton · Baseline Automations
