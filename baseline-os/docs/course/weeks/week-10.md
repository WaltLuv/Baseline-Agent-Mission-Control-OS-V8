# Week 10 — Higgsfield Movie Studio

> **Outcome:** You've shipped a real 8-second campaign video — generated through the Higgsfield MCP, orchestrated by Gemini, with the asset stored in your `/higgsfield` gallery.

## Why this week matters

This is where Baseline Automations stops being a productivity dashboard and becomes a *creative studio*. Higgsfield gives you Soul (face-locked portraits), Seedance (motion), Kling (cinematic), Marketing Studio (product ads), Nano Banana (edit/variation) — 20+ models, one MCP, one orchestrator (Gemini).

## Pre-class reading (~30 min)

- The 4 Higgsfield skills in `~/.claude-os/skills/higgsfield-supercomputer/`
- `src/routes/higgsfield.tsx` — gallery + MCP card

## Live lecture outline (60 min)

**0:00 — The Higgsfield catalog (15 min)** — Walk through Soul vs Seedance vs Kling vs Marketing Studio. When to pick which.

**0:15 — Gemini as orchestrator (15 min)** — Why Gemini wins this lane: 1M context for long shot lists, fast iteration, strong at decomposition.

**0:30 — Live shoot — Liquid Death style (20 min)** — Brief: "Cinematic 8s product reveal for a fictional energy drink." Watch Gemini decompose into shot list → assign each shot a model → output CLI commands.

**0:50 — The MCP connection (10 min)** — Device flow OAuth via the dashboard. KEY OK badge. Authorize via Higgsfield's device URL.

## Hands-on lab (2 hours)

### Step 1 — Connect Higgsfield MCP (20 min)

In `/higgsfield`, right panel:
1. MCP card → click "Authorize device" → sign in at higgsfield.ai
2. Verify KEY OK badge

### Step 2 — Brief (30 min)

Write your own brief. Real product, real positioning. Examples:
- "A 6-second teaser for the PropControl SaaS launch."
- "Hook reel for an Ops Over Hype YouTube short on vendor accountability."
- "Product registration shot for FIFA WC26 Toronto ticket sale."

The brief should include: subject, vibe, aspect ratio, length.

### Step 3 — Orchestrate (45 min)

`/higgsfield` → pick **Gemini** (Lead Orchestrator) → paste brief → "Orchestrate the Shoot"

You'll get back a runnable plan: shot list, per-shot model routing, CLI commands.

### Step 4 — Execute one shot (25 min)

Pick the most important shot from the plan. Run the CLI command:

```bash
higgsfield generate image --model nano_banana_2 --prompt "..." --aspect 9:16
```

(Use whichever model Gemini recommended.)

Asset will appear in your Studio Gallery on `/higgsfield`.

## Self-study (2 hours)

- Browse the Higgsfield model catalog at higgsfield.ai/models. Note which models you'd reach for in your real work.
- Study one Marketing Studio campaign on Higgsfield's homepage. Reverse-engineer the shot list.

## Deliverable

- ✅ One real asset in your `/higgsfield` gallery
- ✅ Gemini's orchestration plan saved
- ✅ A 2-sentence reflection: "If I had unlimited Higgsfield credits, what would I create weekly?"

## Common issues

- **OAuth device flow gives 403** → make sure you're using the device code from `/__higgsfield_status`, not a stale one
- **`higgsfield: command not found`** → `npm install -g @higgsfield/cli && higgsfield auth login`
- **Gemini hallucinates models that don't exist** → restart the dashboard so the system prompt picks up the current Higgsfield catalog
