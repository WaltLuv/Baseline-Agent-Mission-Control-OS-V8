# Week 3 — System Prompts as Constitution

> **Outcome:** You can read any system prompt in the codebase, write your own from scratch, and ship a working custom persona (yours or a teammate's) live in the Hermes pantheon by end of week.

---

## Why this week matters

A system prompt is the **constitution** of an agent. It defines:
- Identity (who is this thing?)
- Capabilities (what tools does it know it has?)
- Constraints (what won't it do?)
- Routing rules (when does it hand off?)

When you understand the system prompt, you understand the agent's whole personality. When you can write a good one, you can spawn new agents on demand.

---

## Pre-class reading (~40 min)

Read these three files in order:

1. **`vite.config.ts`** — search for `const AGENT_CONFIG`. Read every entry.
2. **`vite.config.ts`** — search for `SHARED_SKILLS_NOTE`. Notice how it's appended to *every* agent's prompt.
3. **`~/.hermes/pantheon/personas/slim-charles.yaml`** — the canonical persona file. Open it.

Optional but valuable: read [Andrej Karpathy's tweet](https://x.com/karpathy/status/2015883857489522876) — it's the basis for the `karpathy-guidelines` skill we'll install next week.

---

## Live lecture outline (60 min)

**0:00 — Anatomy of a system prompt (15 min)**

A good system prompt has six layers, top to bottom:

```
1. Identity        — "You are X."
2. Mission         — "Your job is to Y."
3. Capabilities    — "You can call /__pinecone_query, /__notebooklm_query…"
4. Routing rules   — "When the user asks A, hand off to B."
5. Constraints     — "Never write to production without explicit approval."
6. Style           — "Concise. No fluff. End with the next concrete action."
```

We'll walk through Slim Charles' prompt and label each layer.

**0:15 — The SHARED_SKILLS_NOTE (15 min)**

This is the global suffix appended to every agent's prompt. It tells every agent:
- "You have 230 skills at `~/.claude-os/skills/`."
- "You have three memory brains: Obsidian, Notion, Pinecone."
- "You can post to peers via `/__agent_message`."
- "You can drive Chromium via `/__browser_use`."

Why this matters: you don't have to repeat capability docs in every agent's prompt. Edit one constant, every agent gains the capability.

**0:30 — Personas vs system prompts (15 min)**

The dashboard has two layers:
1. **Agent system prompts** in `AGENT_CONFIG` — these are the dashboard's agent identities.
2. **Hermes pantheon personas** in `~/.hermes/pantheon/personas/` — these are *Hermes-side* sub-identities that Hermes spawns based on summon phrases ("Better call Saul" → Saul persona).

The two interact: when Hermes is asked something, it picks a persona, then the persona's `system_prompt` (its YAML) overrides Hermes' default behavior.

**0:45 — Live demo: editing Slim Charles (15 min)**

Open the YAML. Modify the `system_prompt` to add a new behavior. Save. Restart Hermes. Verify the new behavior fires. Then revert.

---

## Hands-on lab (2 hours)

### Build your own persona

Create `~/.hermes/pantheon/personas/<your-name>.yaml`:

```yaml
id: <your-id>
name: <Your Name>
job: <One-line job description>
description: >-
  <2-3 sentences. Who you are, what you do, what you specialize in.>
avatar: assets/<your-id>.png   # we'll generate this in week 10
model:
  provider: openrouter
  name: anthropic/claude-sonnet-4-6   # or whatever you prefer
behavior:
  tone: <3 adjectives>
  system_prompt: >-
    You are <Your Name>. <Identity, mission, capabilities, routing,
    constraints, style — the six layers from lecture.>
knowledge_base:
  path: ~/.claude-os/skills
  index: ~/.claude-os/skills/SKILL_INDEX.json
skills:
  - <pick 3-5 from the 230 in the library>
tools:
  - file
  - memory
  - web
summon_phrases:
  - <Your Name>
  - <2-3 ways someone would ask for you specifically>
```

**Rules:**
1. The system_prompt must hit all 6 layers from lecture.
2. The `summon_phrases` must be unique — pick something nobody else would say.
3. The persona must be *useful* — solve a real problem you have.

### Test it

```bash
# Restart Hermes if it's running, then in the dashboard:
# Open /agents/hermes → Studio tab → invoke your persona by its summon phrase

# Or via curl:
curl -X POST http://localhost:8081/__hermes_chat \
  -H "Content-Type: application/json" \
  -d '{"prompt":"<your summon phrase>: do X","persona":"<your-id>"}'
```

You should see your persona's voice show up in the response, not Hermes' default voice.

### Stretch — modify the SHARED_SKILLS_NOTE

In `vite.config.ts`, find `SHARED_SKILLS_NOTE` and add one new sentence — for example, a routing rule that's specific to your work ("When the user mentions vendor management, prefer the propcontrol skills.").

Restart the dev server. Test on a fresh chat. Notice every agent now applies the rule.

---

## Self-study (2 hours)

- Read 3 random YAML personas in `~/.hermes/pantheon/personas/` (e.g. `saul.yaml`, `mercury.yaml`, `philosopher.yaml`). Note what makes each voice distinct.
- Read [`agents.gemini.tsx`](../../../src/routes/agents.gemini.tsx) — see how the persona / system prompt drives the UI badge ("Lead Orchestrator", model card, capabilities list).

---

## Office-hours discussion prompts

1. Show your persona to one other student. Can they describe in one sentence what it specializes in just from reading the YAML?
2. What was the hardest layer of the system prompt to write?
3. If you could edit the `SHARED_SKILLS_NOTE` for the whole class, what one sentence would you add?

---

## Deliverable

- ✅ One new persona YAML in `~/.hermes/pantheon/personas/`
- ✅ Persona responds when summoned (screenshot or transcript)
- ✅ A 1-page reflection: "What I learned about my own work by trying to encode it as a system prompt"

---

## Common issues

- **Persona doesn't fire on the summon phrase** → check that the summon phrase is unique enough; also check `~/.hermes/pantheon/personas/_index.yaml` if it exists
- **Model returns "model not found"** → use `anthropic/claude-sonnet-4-6` (proven), not custom IDs
- **Persona voice "blends" with Hermes default** → your system_prompt is too generic. Make it more specific.
