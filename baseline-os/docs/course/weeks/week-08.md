# Week 8 — The Triad Council

> **Outcome:** You've run the Triad on a high-stakes decision you actually have, you know what it costs, and you can articulate exactly when to use it vs single-model.

## Why this week matters

When the cost of being wrong is high, one model isn't enough. The Triad is **architectural diversity** as a quality multiplier:

- **Conductor (Opus 4.7)** — interrogates, briefs, validates
- **Worker (DeepSeek V4)** — grinds 3 angles in parallel
- **Critic (GPT-5.5)** — tears each draft apart from a *different architecture*

The Critic must come from a different model family. Same architecture = same blind spots = pointless review.

## Pre-class reading (~30 min)

- `/__triad_run` middleware in `vite.config.ts`
- `src/routes/triad.tsx` — the 4-phase UI
- Optional: Reflexion paper (Shinn et al.) — the academic basis for self-critique loops

## Live lecture outline (60 min)

**0:00 — Why diversity > thinking harder (15 min)** — Single-model "deep thinking" hits the same blind spots in slower iteration. Three families fix that.

**0:15 — The 4 phases live (20 min)** — Run a Triad on a fake decision. Watch each phase fire.

**0:35 — Cost analysis (10 min)** — A Triad run is ~$0.30-$0.80 (Opus is the expensive part). Compare to a senior consultant's hour. Cost-effective for any decision worth >$1000.

**0:45 — When NOT to use it (15 min)**
- Casual exploration → use Gemini
- Coding → use Codex/Claude
- Already-clear decisions → don't overthink
- Cost-sensitive iteration → use Gemma 4 local

## Hands-on lab (2 hours)

### Pick a real decision (30 min)

Examples (real ones from past cohorts):
- "Should I integrate Stripe Subscriptions or Stripe Checkout for PropControl?"
- "Hire a YouTube editor or train an AI editor pipeline?"
- "Move my agency from Notion to Linear or stay on Notion?"

Write the brief in clear, opinionated language. Mention constraints, your gut, and what you'd do without the Triad.

### Run the Triad (45 min)

`/triad` → paste brief → "Convene the Triad" → wait 60-90s.

Save the final artifact to `docs/journal/week-08-triad.md`.

### Compare with single-model (45 min)

Same brief → Opus alone (via Gemini in dashboard) and via the Triad. Compare:
- Did Opus alone surface the same risks?
- Did the Critic catch anything Opus missed?
- Was the Final synthesis better than any individual draft?

## Self-study (2 hours)

- Read the model cards for Opus 4.7, DeepSeek V4, GPT-5.5. Note their different training emphasis.
- Write a 1-page "Triad cost-benefit cheat sheet": when is the $0.50 worth it for *your* work?

## Deliverable

- ✅ One Triad artifact in `docs/journal/`
- ✅ Comparison notes (single-model vs Triad)
- ✅ Personal Triad cheat sheet

## Common issues

- **"Insufficient credits"** → Opus is expensive. Top up OpenRouter ($10 covers ~20 runs).
- **Critic agrees with everything (no real critique)** → the model temperature or prompt isn't pushing back hard enough. The codebase intentionally uses sharper Critic prompts; if you've forked, restore them.
- **Triad takes >3 min** → DeepSeek can be slow at peak; this is fine.
