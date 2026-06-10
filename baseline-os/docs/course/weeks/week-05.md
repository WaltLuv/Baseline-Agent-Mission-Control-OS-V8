# Week 5 — The 230-Skill Library

> **Outcome:** You understand the `~/.claude-os/skills/` library, install your first custom skill, and watch it dedupe + appear in `/library` automatically.

## Why this week matters

A *skill* in Baseline Automations is the smallest reusable unit of agent capability. It's a folder with a `SKILL.md` file. Skills are:
- **Discovered** by `scripts/install-skills.ts`
- **Indexed** in `SKILL_INDEX.json` (hash-deduped — paste the same skill twice, you get it once)
- **Surfaced** to every agent via the `SHARED_SKILLS_NOTE` system prompt suffix
- **Browseable** at `/library`

You have 230 of them already. Today you ship the 231st — yours.

## Pre-class reading (~30 min)

- `scripts/install-skills.ts` (top to bottom; it's ~200 lines, very readable)
- Browse `/library` — pick a category, read 3 SKILL.md files

## Live lecture outline (60 min)

**0:00 — Anatomy of a skill (15 min)**

```markdown
---
name: my-skill
description: One-line "when to use this skill"
category: research
tags: [pinecone, semantic-search, recall]
user_invocable: true
---

# My Skill

## When to use this

When the user asks for X, Y, or Z.

## How to use this

Step 1, Step 2, Step 3.

## Example
```

The frontmatter is what `install-skills.ts` parses. The body is what the agent reads when it invokes the skill.

**0:15 — The installer (15 min)** — Walk through `pullOrClone` → `walk` → `parseFrontmatter` → hash → dedup → write index. Show the `_DUPLICATES.json` log.

**0:30 — Skill categories (15 min)** — How `SKILL_INDEX.json` categorizes them, and how `/library` filters by category.

**0:45 — Karpathy preview (15 min)** — Read the `karpathy-guidelines` skill aloud. Notice it's not a tool — it's a *constitution*. Skills can be tools OR philosophies.

## Hands-on lab (2 hours)

### Build your first skill

Pick something you do weekly and write it as a skill.

Example: a "morning briefing" skill that tells the agent how to summarize your inbox + calendar.

```bash
mkdir -p ~/.claude-os/skills/personal/morning-brief
cat > ~/.claude-os/skills/personal/morning-brief/SKILL.md <<'EOF'
---
name: morning-brief
description: Compose a 3-section morning briefing (email, calendar, top 3 tasks)
category: productivity
tags: [briefing, gmail, calendar, daily]
user_invocable: true
---

# Morning Brief

## When to use this
When the user says "morning brief", "what's on today", or sends `/brief`.

## Output format
Exactly 3 sections:
1. **📧 Email** — top 3 by urgency, with the sender and one-sentence summary
2. **📅 Calendar** — events for the next 12 hours, with conflicts flagged
3. **🎯 Top 3** — extracted from the user's goals (`/__obsidian_write` lookup)

## Rules
- Total length: under 200 words
- No fluff. No "have a great day."
- End with: "Reply with which item to drill into."
EOF
```

### Install it

```bash
cd ~/code/baseline-agent-os
bun run scripts/install-skills.ts
```

Output should say `1 new skill`. Open `/library`, search "morning" — see it.

### Stretch — install someone else's skill

Pick a skill from `forrestchang/andrej-karpathy-skills` (already cloned) — copy any SKILL.md you find interesting into your personal namespace. Rerun installer. Notice it deduplicates if the content hash matches.

## Self-study (2 hours)

- Read 5 random skills from `/library`. Note common patterns.
- Identify 3 more skills *you would write* over the next month. Write them as one-line briefs in `docs/journal/week-05-skill-pipeline.md`.

## Deliverable

- ✅ One custom skill in `~/.claude-os/skills/personal/<your-skill>/SKILL.md`
- ✅ It appears in `/library`
- ✅ The 3-skill pipeline brief

## Common issues

- **Skill doesn't appear in /library** → did you rerun `install-skills.ts`? Did the frontmatter parse cleanly? (Missing `---` close terminator is the #1 bug.)
- **Skill counts as a duplicate** → your content hash matched an existing skill. Either intentional (good — dedup is working) or revise the body.
