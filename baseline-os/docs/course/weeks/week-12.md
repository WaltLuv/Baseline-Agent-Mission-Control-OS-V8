# Week 12 — Capstone & Ship Day

> **Outcome:** You ship a custom agent surface on top of Baseline Automations that solves a real problem in your business. Live demo, 90-second recorded walkthrough, deployed.

## Why this week matters

Everything before this was scaffolding. This week is what people will see when you say "I built an Baseline Automations." This is your portfolio piece.

You will:
1. **Pick** one of the four capstone tracks (see `capstone.md`)
2. **Build** it inside the existing repo as a new route + endpoint + persona
3. **Document** it (one-page README in your fork)
4. **Demo** it live in week 12's session

## Pre-class reading

- Re-read [`capstone.md`](../capstone.md) cover-to-cover
- Skim 2-3 weeks of past capstones from the cohort archive (cohort+ tier)

## The 4 tracks

| Track | Build | Best for |
|---|---|---|
| **Operator** | A custom dashboard for your industry (real estate ops, agency, e-commerce, freelance) | People who want this OS to *run their business* |
| **Creator** | A content production pipeline (script → voice → video → publish) | YouTubers, podcasters, agency owners |
| **Specialist** | A new agent specialized for a niche your existing agents can't serve | Domain experts (legal, medical, scientific) |
| **Infrastructure** | A new memory layer, new bus, new orchestration pattern, new skill | The "I want to build OS plumbing" track |

## Live lecture outline (60 min)

**0:00 — Demo expectations (10 min)** — 90 seconds, screen-recorded, voiced. Show the problem you started with, then your solution.

**0:10 — Architecture sketch (15 min)** — Bring your sketch. We'll critique together. Where does data flow? Which existing endpoints do you reuse? What's new?

**0:25 — Common mistakes (15 min)**
- Building a *whole new app* instead of a route in the existing repo
- Skipping the system prompt (your persona is generic = your output is generic)
- Forgetting to add the new endpoint to `SHARED_SKILLS_NOTE` so other agents know it exists
- Building for everyone instead of yourself

**0:40 — Ship-day checklist (20 min)** — Walk through the deliverable list below

## Hands-on lab (extended — the whole week)

This week is *all* lab. Allocate 8-12 hours.

### Day 1 — Architecture (2 hours)

- Pick your track
- Sketch the architecture on paper. Where's the new route? What endpoints? What persona?
- Post your sketch in `#baseline-agents` for early feedback

### Day 2-4 — Build (6 hours)

- New route at `src/routes/<your-feature>.tsx`
- New endpoint(s) at `vite.config.ts` (look at existing endpoints as templates)
- New persona at `~/.hermes/pantheon/personas/<your-id>.yaml` if needed
- New skill at `~/.claude-os/skills/personal/<your-skill>/SKILL.md` if needed

### Day 5 — Polish (2 hours)

- Hook into sidebar (`src/components/app-sidebar.tsx`)
- Add `SHARED_SKILLS_NOTE` mention so other agents can call your new endpoint
- Write the one-page README

### Day 6 — Demo (2 hours)

- Record 90-sec demo with QuickTime or OBS
- Upload to YouTube unlisted
- Post link in `#baseline-agents`

## Self-study

This is **your work this week.** Self-study is the build.

## Deliverable

- ✅ New route returning 200
- ✅ At least one new `/__*` endpoint
- ✅ One-page README explaining the problem + solution
- ✅ 90-sec demo video (YouTube unlisted link is fine)
- ✅ Optional: PR to the main `baseline-agent-os` repo if you want your feature merged upstream

## Grading rubric (cohort+)

| Dimension | Weight | What we score |
|---|---|---|
| Originality | 25% | Did this solve a real problem? Or rebuild what already exists? |
| Technical depth | 25% | Architecture quality, code quality, system prompt quality |
| Documentation | 20% | Can someone else use this from your README? |
| Demo quality | 20% | Is the 90 seconds clear? Compelling? |
| Reusability | 10% | Could another student adopt your code? |

70%+ = pass. 90%+ = featured in next cohort.

## After ship day

- All capstones archived in `docs/course/capstones/<cohort>/`
- Top 3 are showcased on the course homepage
- Authors get invited as TAs for the next cohort

## You are now operating

You're not "doing AI." You're not "using AI." You're *operating an Baseline Automations*.

That's the bar. Welcome to the club.
