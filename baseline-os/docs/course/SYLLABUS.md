# Baseline Automations — Full Syllabus

> Printable single-page reference. Each row corresponds to a per-week lesson plan in `weeks/`.

---

## Course-wide learning outcomes

By course end, every student can:

1. **Architect** a multi-agent system from primitives (chat endpoint + system prompt + skill library + memory layer) instead of gluing together SaaS products.
2. **Pick the right agent** for any task — and know why the wrong one is wrong.
3. **Compose memory layers** (file / structured cloud / vector) and reason about which one a piece of state belongs to.
4. **Orchestrate** specialists through a shared message bus instead of stuffing everything into one mega-prompt.
5. **Run the Triad council** for high-stakes decisions and explain why architectural diversity beats single-model "thinking harder."
6. **Ship a custom surface** on top of Baseline Automations: new route, new endpoint, new agent, new persona, new skill.
7. **Operate the dashboard daily** — not as a demo but as their primary AI command center.

---

## Weekly schedule

### Phase I — Foundation (Weeks 1–3)

| # | Title | Live (1h) | Lab (2h) | Self-study (2h) | Ships |
|---|---|---|---|---|---|
| 1 | The Dashboard & The Sidecar | Architecture overview · client/server boundary · vite middleware as sidecar | Clone repo, run `bun run dev`, verify all routes 200 | Read `vite.config.ts` top 200 lines | Local dashboard live |
| 2 | The 8 Agents | When to pick Gemini vs Hermes vs Claude vs Gemma · sidebar tour | Send same task to 4 agents, compare outputs | Decision matrix exercise | Comparative agent reflection (1 page) |
| 3 | System Prompts as Constitution | Anatomy of `AGENT_CONFIG` · the `SHARED_SKILLS_NOTE` · personas as YAML | Modify Slim Charles, add a personal persona | Karpathy's Four Principles essay | One custom persona on disk + visible in Hermes pantheon |

### Phase II — Memory & Skills (Weeks 4–6)

| # | Title | Live (1h) | Lab (2h) | Self-study (2h) | Ships |
|---|---|---|---|---|---|
| 4 | Three Brains | The 3-brain model · Obsidian vs Notion vs Pinecone · 1M token context isn't memory | Wire all three; query each from /memory | Read Pinecone semantic search article | All 3 brains connected, 5 test entries each |
| 5 | The 230-Skill Library | `~/.claude-os/skills/` · SKILL_INDEX.json · content-hash dedup · install-skills.ts | Author your first skill, install it, see it in `/library` | Browse 10 library skills, write a 1-page review of best/worst | One personal skill shipped + indexed |
| 6 | Karpathy's Four Principles | Think before coding · simplicity · surgical changes · goal-driven execution | Audit your custom persona against the four principles, refactor | Read full karpathy-guidelines SKILL.md | Refactored persona with explicit Karpathy compliance |

### Phase III — Multi-agent orchestration (Weeks 7–9)

| # | Title | Live (1h) | Lab (2h) | Self-study (2h) | Ships |
|---|---|---|---|---|---|
| 7 | Maestro: Cross-Agent Bus | `/__agent_message` log · /standup pattern · the cross-agent hive mind | Run a /standup on a real business question, watch the log | Read maestro source 150 lines | First multi-agent standup transcript |
| 8 | The Triad Council | Why architectural diversity matters · Opus + DeepSeek + GPT · cost analysis | Run Triad on a high-stakes decision you have right now | Read the four model cards: Opus 4.7, DeepSeek V4, GPT-5 | One Triad artifact saved to Studio history |
| 9 | The Hermes MCP Loop | Claude Desktop ↔ Hermes MCP ↔ Hermes Agent · OAuth device flow · cloudflared tunnel | Install hermes-mcp, mint OAuth, connect Claude Desktop | Read Hermes MCP threat model | Loop verified end-to-end with the canonical test prompt |

### Phase IV — Creative + commercial (Weeks 10–11)

| # | Title | Live (1h) | Lab (2h) | Self-study (2h) | Ships |
|---|---|---|---|---|---|
| 10 | Higgsfield Movie Studio | MCP connection · 4 skills · 20+ models · Soul Characters · Marketing Studio | Generate a real 8-second campaign clip with Gemini orchestrating | Read 03-DESIGN-SYSTEM (Midnight Aubergine) | One real video clip in your `/higgsfield` gallery |
| 11 | WACRM + NotebookLM + Browser-Use | Three execution surfaces · when to pick which | Hook NotebookLM via Chrome cookies, ask a cited research question · run one browser-use task | Read notebooklm-py auth model | Real cited answer in `/agents/notebooklm` + one browser-use run logged |

### Phase V — Capstone (Week 12)

| # | Title | Live (1h) | Lab (2h) | Self-study (2h) | Ships |
|---|---|---|---|---|---|
| 12 | Capstone & Ship Day | Presentations · live Q&A · post-mortem | Final polish + record 90-sec demo video | Write your project README | Capstone shipped to your fork of the OS |

---

## Grading & assessment (cohort + corporate tiers)

| Component | Weight | What we evaluate |
|---|---|---|
| Weekly lab deliverables (10×) | 50% | Did it ship? Does it work? Is it your own? |
| Mid-course mini-project (week 6) | 15% | A custom skill that you actually use weekly |
| Triad council artifact (week 8) | 5% | Quality of the brief, quality of the synthesized output |
| Capstone project | 30% | Originality · technical depth · documentation · demo |

Pass = 70%. There's a 1-week grace period for every weekly deliverable.

---

## Time commitment (honest)

- **Self-paced students:** budget ~7 hours/week for 12 weeks ≈ **80 hours total**.
- **Cohort students:** the live call adds 90 min/week but accelerates retention. Net time about the same.
- **Workshop weekend:** 14 hours over Sat–Sun gets you ~30% of the depth. Ideal if you already operate at a senior level.

If you skip the labs, you'll learn 20% of what you would have. Don't skip the labs.

---

## Reading list (pre-course optional, in order of utility)

1. **Karpathy's tweet** that became the `karpathy-guidelines` skill — the four principles in 280 chars
2. **Claude Code internals**: any of the official Anthropic engineering posts on Claude Code
3. **MCP spec overview**: https://spec.modelcontextprotocol.io
4. **Notion API docs** (the "Integrations" section, not the page CRUD docs)
5. **Pinecone serverless guide** (specifically the multilingual-e5-large embedding model docs)
6. **Adam Curtis on systems** — any HyperNormalisation analysis essay. Sets the framing.

---

## Office hours & community

- **Discord**: `#baseline-agents` (auto-invite included with enrollment)
- **Weekly group call** (cohort+): Wednesdays 4pm ET, recorded
- **1:1 mentor sessions** (corporate tier): 30 min/student/week

---

## Refund policy

- **Self-paced**: 14-day no-questions refund (the course is the repo; you keep nothing if you refund)
- **Cohort**: refund up through Week 2 (after that, you've eaten 16% of the live calls)
- **Workshop**: refund up to 72 hours before kickoff
- **Corporate**: per contract

---

## Instructor

**Walter Thornton** built Baseline Automations to run his own property management ops, three YouTube channels, and PropControl (SaaS). The course is his playbook.

Cohort co-instructors and TAs rotate from the `#baseline-agents` Discord — students who shipped strong capstones in prior cohorts.
