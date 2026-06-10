# Week 6 — Karpathy's Four Principles

> **Outcome:** You can name the four principles, recognize them in code reviews, and refactor any agent system prompt to be Karpathy-compliant.

## Why this week matters

Andrej Karpathy [observed](https://x.com/karpathy/status/2015883857489522876) that LLMs habitually:
- Make wrong assumptions silently
- Hide their confusion
- Skip surfacing tradeoffs
- Don't push back when they should
- Overcomplicate everything
- Bloat abstractions
- Touch code they don't understand

The `karpathy-guidelines` skill encodes the **four principles** that fix this. Once you bake them into your agents, you stop fighting hallucinations and start trusting outputs.

## Pre-class reading (~30 min)

- `~/.claude-os/skills/andrej-karpathy-skills/karpathy-guidelines/SKILL.md` (full file)
- Read Karpathy's original tweet

## The Four Principles

| # | Principle | What it kills |
|---|---|---|
| 1 | **Think Before Coding** | Wrong silent assumptions, hidden confusion |
| 2 | **Simplicity First** | Bloated abstractions, 1000-line solutions to 100-line problems |
| 3 | **Surgical Changes** | Touching unrelated code, deleting comments you don't understand |
| 4 | **Goal-Driven Execution** | Coding without tests; "I think this works" instead of "I proved it works" |

## Live lecture outline (60 min)

**0:00 — The four in detail (20 min)** — Each principle has a "do" and a "don't" example. Walk through them.

**0:20 — Why generic LLMs fail without these (10 min)** — Demo: same coding task to vanilla agent vs Karpathy-compliant agent. The compliant one asks clarifying questions and proposes a tradeoff.

**0:30 — Baking principles into system prompts (15 min)** — Show how to add "Apply karpathy-guidelines before answering" as a one-line addendum to any agent's system prompt.

**0:45 — Audit our personas (15 min)** — Pull up Slim Charles, Saul, Don Draper. Ask: are these Karpathy-compliant? What's missing?

## Hands-on lab (2 hours)

### Step 1 — Audit your week-3 persona (30 min)

Open your persona YAML. Score each principle 0-2 (0 = absent, 2 = explicitly enforced):

| Principle | Score | Why |
|---|---|---|
| Think Before Coding | | |
| Simplicity First | | |
| Surgical Changes | | |
| Goal-Driven Execution | | |

If you're under 6/8, refactor the system prompt.

### Step 2 — Refactor (60 min)

Add this block to your persona's `system_prompt`:

```
DISCIPLINE (Karpathy 4):
1. THINK BEFORE: If unsure of intent, ask one clarifying question. Surface
   tradeoffs explicitly. Push back if I'm wrong.
2. SIMPLICITY: Smallest workable solution. 100 lines beats 1000. No
   speculative abstractions.
3. SURGICAL: Touch only what the task needs. Don't refactor adjacent code.
   Don't delete comments you don't understand.
4. GOAL-DRIVEN: End with a verifiable success criterion. "Done = X
   measurable thing happened."
```

### Step 3 — Verify (30 min)

Send your persona two tasks:
- An ambiguous one ("Make this faster")
- A clear one ("Reduce the render time of /skills below 200ms")

Notice: a Karpathy-compliant persona asks for clarification on the first, executes surgically on the second.

## Self-study (2 hours)

- Read 3 SKILL.md files from `~/.claude-os/skills/`. Audit them against the four. Note which ones are Karpathy-strong and which aren't.
- Skim Karpathy's GitHub. Pick one of his coding-style posts to add to your reading queue.

## Deliverable

- ✅ Refactored persona YAML with the DISCIPLINE block
- ✅ Audit scorecard (before/after)
- ✅ Two test prompts + transcripts showing the persona pushes back appropriately

## Common issues

- **Persona pushes back on *everything*, even clear tasks** → tune the DISCIPLINE block: "ask one clarifying question *only if intent is ambiguous*"
- **Persona ignores the principles** → make sure the DISCIPLINE block is in `behavior.system_prompt`, not in `description`
