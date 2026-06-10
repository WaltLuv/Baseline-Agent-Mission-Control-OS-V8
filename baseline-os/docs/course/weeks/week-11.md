# Week 11 — WACRM + NotebookLM + Browser-Use

> **Outcome:** Three execution surfaces wired and working. Pick which one fits the next real task you have.

## Why this week matters

These three turn your dashboard from "AI thinking" to "AI doing":

| Surface | Drives | Best for |
|---|---|---|
| **WACRM** | Real WhatsApp business inbox | Customer-facing chat ops |
| **NotebookLM** | Your real Google notebooks | Cited research over your own sources |
| **Browser-Use** | A real Chromium | Multi-step web automation no API exists for |

## Pre-class reading (~30 min)

- The full WACRM README in [`/tmp/agent-os-repos/wacrm`](https://github.com/WaltLuv/wacrm)
- The notebooklm-py CLI help: `notebooklm --help`
- The browser-use Python harness: https://github.com/WaltLuv/Ai-agent-harness-browser-use

## Live lecture outline (60 min)

**0:00 — When to use which (15 min)** — Decision tree:
- Chat with humans? → WACRM
- Need citations from *your* sources? → NotebookLM
- Need to drive a website that has no API? → Browser-Use

**0:15 — NotebookLM auth via Chrome cookies (15 min)** — Walk through `notebooklm login --browser-cookies chrome --include-domains=all`. Why we use this instead of fresh login. Cookie refresh via launchd.

**0:30 — WACRM as a separate Next.js app (15 min)** — The dashboard `/wacrm` page is a *launcher* for the real WACRM at `localhost:3000`. Walk through the Supabase + WhatsApp Business API setup.

**0:45 — Browser-Use harness (15 min)** — When the Python service is running on :8000, `/__browser_use` proxies. When it's not, the endpoint returns setup instructions.

## Hands-on lab (3 hours)

### Step 1 — NotebookLM (45 min)

```bash
# 1. Reinstall on Python 3.12 if you're on 3.13+ (rookiepy needs <3.13)
pipx install --python python3.12 "notebooklm-py[browser]"
pipx inject notebooklm-py rookiepy
~/.local/pipx/venvs/notebooklm-py/bin/playwright install chromium

# 2. Auth from your Chrome session (you must already be logged in to NLM in Chrome)
notebooklm login --browser-cookies chrome --include-domains=all

# 3. Verify
notebooklm list
```

In dashboard: `/agents/notebooklm` should now show your notebooks. Pick one → ask: "Summarize the most actionable insight from this notebook in 3 sentences."

### Step 2 — WACRM (60 min)

```bash
git clone https://github.com/WaltLuv/wacrm.git ~/code/wacrm
cd ~/code/wacrm
npm install
cp .env.local.example .env.local
# fill in Supabase + Meta WhatsApp credentials
npm run dev   # → http://localhost:3000
```

In dashboard: `/wacrm` should now show "CRM dev server live". Dispatch a quick task: "Triage today's WhatsApp inbox."

### Step 3 — Browser-Use (60 min)

```bash
pipx install browser-use
playwright install chromium
export OPENAI_API_KEY=<your key>
python -m browser_use.server --port 8000
```

In dashboard: `/browser` → drop a task: "Open hackernews, summarize the top 5 stories." Watch a Chromium window pop up and execute.

### Step 4 — Compose (15 min)

Pick *one task you have right now* that touches all three:
- Research a competitor's pricing (NotebookLM if you have it indexed, or Browser-Use on their site)
- Compose a WhatsApp broadcast to your warm leads (WACRM)
- Schedule the broadcast via Hermes cron (week 9 loop)

## Self-study (2 hours)

- Read the WACRM `agents.md` — note the structure of the multi-agent inbox handlers
- Read `notebooklm cookies inspect` output. Understand which Google cookies actually do the auth work.

## Deliverable

- ✅ NotebookLM returning real cited answers from your notebooks
- ✅ WACRM dev server live + one dispatch executed
- ✅ One Browser-Use task with a visible result
- ✅ A 1-paragraph cross-surface workflow doc in `docs/journal/`

## Common issues

- **NotebookLM "Authentication expired"** → tokens cycle; re-run `notebooklm login --browser-cookies chrome --include-domains=all`. Better: install the launchd refresh job from `~/Library/LaunchAgents/com.baseline.notebooklm-refresh.plist`.
- **WACRM 500 on Supabase** → schema not migrated. Run `npm run db:reset` in the wacrm directory.
- **Browser-Use Python service won't start** → check Python version: requires 3.10+, recommends 3.11.
