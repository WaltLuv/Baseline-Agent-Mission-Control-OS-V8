# Capstone Project Spec

> **Build a custom agent surface on top of Baseline Automations that solves a real problem in your business.**

---

## What "shipped" means

A passing capstone has:

1. **A new route** at `src/routes/<your-feature>.tsx` returning 200
2. **At least one new backend endpoint** at `vite.config.ts` (`/__your_endpoint`)
3. **A custom persona, skill, or sub-agent** if it makes sense for your project
4. **A one-page README** in your fork explaining the problem + solution
5. **A 90-second demo video** (YouTube unlisted is fine)
6. **Integration into existing OS** — sidebar entry, system prompt mention, or both

The thing must *work end-to-end* when someone clones your fork. No "TODO" placeholders.

---

## Four tracks

### Track 1 — Operator

> Build a custom dashboard for *your* industry that turns the OS into your daily command center.

Examples from past cohorts:
- **Property management ops** — turn tracker + vendor scorecard + tenant comms
- **Agency client ops** — per-client retainers + delivery status + content pipeline
- **E-commerce ops** — Shopify orders + Stripe disputes + fulfillment SLAs
- **Freelance ops** — client list + project status + invoice tracker

What to build:
- 1 new route at `/<your-industry>` with the operational view
- 1+ backend endpoint that pulls real data (API, DB, file)
- A custom persona that operates this domain in your voice
- Hook to existing Maestro bus so other agents can dispatch tasks to this surface

**Best for:** people who already operate a business and want this OS to *run it*.

---

### Track 2 — Creator

> Build a content production pipeline: script → voice → video → publish, end-to-end, automated.

Examples:
- **YouTube studio** — script in Studio → ElevenLabs voice → Higgsfield B-roll → upload via Browser-Use
- **Podcast factory** — NotebookLM extract from research → script → TTS → publish
- **Twitter thread machine** — Triad-generated brief → Gemini formats → schedule via Buffer API
- **LinkedIn newsletter** — weekly brief → editor agent → preview → publish

What to build:
- 1 new route showing your pipeline visually (status per stage)
- Endpoints that chain the existing creative endpoints (`/__tts`, `/__higgsfield_*`, `/__notebooklm_query`)
- One "ship a piece of content" button that runs the whole chain

**Best for:** YouTubers, podcasters, agencies, anyone making content at volume.

---

### Track 3 — Specialist

> Build a new agent specialized for a niche the existing agents can't serve.

Examples:
- **Legal contract reviewer** — uploads PDF → identifies risk clauses → drafts redlines
- **Medical literature scout** — Pinecone-indexed papers → queries with citations
- **Financial deal modeler** — DCF + comps + scenario analysis as an agent
- **Architecture critic** — uploads diagrams → review against your principles

What to build:
- 1 new route `/agents/<your-agent>` mirroring the existing agent page pattern
- A custom system prompt with sharp domain expertise
- Skills specific to the niche, installed via `install-skills.ts`
- Integration with shared memory (Pinecone for domain docs, Notion for shared workspace)

**Best for:** domain experts (legal, medical, scientific, financial) who want to encode their expertise.

---

### Track 4 — Infrastructure

> Build new OS plumbing: a new memory layer, new bus, new orchestration primitive, new skill manager.

Examples:
- **A 4th memory brain** — e.g. ChromaDB local vector store as an offline alternative to Pinecone
- **A new bus** — replace Maestro JSONL with Redis pub/sub for real multi-machine
- **A capability discoverer** — agent that introspects its own endpoint surface
- **An audit log** — every agent call logged with cost, latency, output snapshot

What to build:
- New endpoints + storage layer
- Migration story for existing users (how do they adopt your new plumbing?)
- Demonstrable performance / capability win over existing primitive

**Best for:** engineers who want to push the OS architecture forward.

---

## Scope guardrails

| If your capstone is... | It's probably... |
|---|---|
| A full new app outside this repo | Too big — keep it in the OS |
| 50+ files of changes | Too big — narrow it |
| 1 file change + a README | Too small — go deeper |
| 5-15 file changes, 1 new route, 1 new endpoint, 1 persona | Right-sized |

Past capstones average **~800 lines of code** plus README + demo. Use that as your north star.

---

## Timeline

If you're doing the full 12 weeks:

| Day | Activity |
|---|---|
| Week 11, end of week | Pick your track, draft a one-paragraph proposal |
| Week 12, day 1 | Architecture sketch, post in `#capstones` for early feedback |
| Week 12, day 2-4 | Build |
| Week 12, day 5 | Polish + write README |
| Week 12, day 6 | Record demo + ship |
| Week 12, demo day | Present in live session |

If you're doing self-paced or workshop, allocate ~30 days post-coursework.

---

## Architecture sketch template

Post this in `#capstones` for early-feedback:

```markdown
# <Your project name>

## Problem
<2-3 sentences. What real thing is broken in your work?>

## Solution shape
<1 paragraph. What's the experience? Who uses it? What does success look like?>

## Architecture
- New route: src/routes/<name>.tsx — does X
- New endpoint(s):
  - /__yourthing_status — GET, returns ...
  - /__yourthing_run — POST, accepts { ... }, returns ...
- New persona: ~/.hermes/pantheon/personas/<name>.yaml — handles Y
- Memory: reads/writes to <Pinecone | Notion | Obsidian>
- Hooks to existing surface: <Maestro / Triad / Studio / etc.>

## Track
Operator | Creator | Specialist | Infrastructure

## 90-second demo plan
1. Show the problem (10 sec)
2. Walk through the new route (30 sec)
3. Run the endpoint live (30 sec)
4. Show the integration with rest of OS (15 sec)
5. Outro (5 sec)
```

---

## Grading rubric (cohort+ tiers)

| Dimension | Weight | What we score |
|---|---|---|
| **Originality** | 25% | Did this solve a real problem? Or rebuild what already exists? |
| **Technical depth** | 25% | Architecture quality, system prompt quality, code quality, type safety |
| **Documentation** | 20% | Can someone else clone your fork and use it from the README? |
| **Demo quality** | 20% | Is the 90 seconds clear? Compelling? Hooks → solution → CTA structure? |
| **Reusability** | 10% | Could another student adopt your code? Is the API on your endpoint clean? |

Pass = 70%. **90%+** = featured on the course homepage, author invited to TA next cohort.

---

## What "great" looks like

The best capstones from past cohorts have these traits:

1. **Solves a problem the student actually has** — you can hear it in the demo. They sound *relieved.*
2. **Reuses existing OS primitives** — they're not reinventing memory or chat. They're composing existing endpoints into a new shape.
3. **Has opinion** — the system prompt is sharp. The UI is opinionated. It's not "neutral assistant for everyone."
4. **Documents the *why*** — README explains the problem before the solution.
5. **Demos with a real example** — not synthetic Lorem Ipsum. Real data, real output.

---

## What "not great" looks like

Common patterns we mark down:

- **Generic chatbot wrapper** — "I made a chatbot for X" with no architectural depth
- **All scaffolding, no shipped feature** — folder structure exists, endpoints return 501
- **Demo with `console.log("WORKS!")`** — the actual functionality isn't visible
- **README is 3 sentences** — not enough for someone else to use it
- **Re-implements something the OS already has** — "I built a new memory layer" when we have three
- **Built outside the OS** — your new thing should *augment*, not *replace*

---

## After ship day

- **Capstone gets archived** at `docs/course/capstones/<cohort>/<author>.md`
- **Top 3 capstones per cohort** get featured on the course homepage
- **Authors who scored 90%+** are invited as TAs
- **Optional:** open a PR upstream to merge your capstone as a core feature of `baseline-agent-os`

---

## Inspiration

Read 3 past capstones before starting yours:
- `docs/course/capstones/2026-spring/sarah-vendor-scorecard.md`
- `docs/course/capstones/2026-spring/marcus-podcast-factory.md`
- `docs/course/capstones/2026-summer/priya-legal-redliner.md`

(Once the first cohort ships, this directory will populate.)

---

## You've got this

Your capstone is the **proof** you're an operator now, not just a course-taker.

It doesn't have to be beautiful. It doesn't have to be clever. It has to **work** and it has to **be yours.**

Ship it.
