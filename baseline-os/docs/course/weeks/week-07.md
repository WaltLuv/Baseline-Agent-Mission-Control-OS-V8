# Week 7 — Maestro: The Cross-Agent Bus

> **Outcome:** You've run a multi-agent /standup, watched 4+ agents respond in turn, and understand when one agent should hand work to another vs. just doing it itself.

## Why this week matters

Up to this point we've treated agents as solo operators. But a real OS is a *fleet* — agents that hand work to each other. Maestro is the message bus that makes that possible. It's the simplest possible cross-agent communication primitive: a JSONL append-only log at `~/.claude-os/maestro/messages.jsonl`.

## Pre-class reading (~20 min)

- `/__agent_message` middleware in `vite.config.ts`
- The Maestro page (`src/routes/maestro.tsx`) — the UI is just a renderer over the log

## Live lecture outline (60 min)

**0:00 — Why a bus, not direct calls (15 min)** — Decoupling. The sender doesn't need to know if the recipient is online. Async by default. Audit-friendly.

**0:15 — The /standup pattern (15 min)** — Adopted from `claudeclaw-os`. Pick N agents, give them a topic, each chimes in once in their role. The cross-pollination is the magic.

**0:30 — Live standup demo (15 min)** — On `/claudeclaw` → War Room tab → topic: "Should we focus on PropControl growth or launching Black Operators YouTube?" Pick Gemini + OpenClaw + Hermes + Studio. Watch them disagree productively.

**0:45 — When to hand off vs do it yourself (15 min)** — Heuristics:
- Different *modality* (text → image) → hand off to specialist
- Different *time horizon* (short → long-running) → hand off to Hermes
- Same modality, same horizon → do it yourself

## Hands-on lab (2 hours)

### Step 1 — Send a manual message (15 min)

```bash
curl -X POST http://localhost:8081/__agent_message \
  -H "Content-Type: application/json" \
  -d '{"from":"gemini","to":"hermes-mcp","subject":"Test","body":"Hello from Gemini"}'
```

Open `/maestro` — see your message. Click the agent badge to verify the flow.

### Step 2 — Real-business /standup (60 min)

Pick a real decision you're facing. Topic must be concrete, not philosophical.

**Bad topic:** "How do I grow my business?"
**Good topic:** "We have $5k discretionary spend this month. Do we invest in (a) a YouTube editor, (b) a Pinecone Pro plan, or (c) a Higgsfield team subscription?"

Run /standup with 5 agents. Save the transcript to `docs/journal/week-07-standup.md`.

### Step 3 — Hand-off chain (45 min)

Build a 3-step chain:
1. Ask Gemini to **plan** a 3-shot video campaign (text only)
2. Manually post a Maestro message from Gemini → OpenClaw asking it to "operationalize this — what channels, what timing, what budget"
3. Manually post OpenClaw → Hermes asking to "schedule this as a recurring weekly review"

By the end you should have 3+ entries in your Maestro log forming a coherent chain.

## Self-study (2 hours)

- Read the source of one mature multi-agent framework (e.g. CrewAI, AutoGen). Notice it has the same message-bus primitive, more wrappers.
- Sketch the "agent org chart" for *your* business. Who handles what?

## Deliverable

- ✅ Standup transcript saved
- ✅ 3-step Maestro chain visible at `/maestro`
- ✅ Your own agent org chart in `docs/journal/`

## Common issues

- **Standup runs only 1 agent then stops** → an OpenRouter call failed. Check `tail -50 /tmp/baseline-*.log`
- **Messages don't appear in /maestro** → check the file directly: `cat ~/.claude-os/maestro/messages.jsonl`
- **Agents talk past each other** → they need shared context. Reference the parent message in the subject line.
