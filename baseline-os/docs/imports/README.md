# Imports — agent-os-pack 5 + ClaudeOS [Hermes] V2.3

This folder captures the documentation + reference content from two external
agent-OS distributions that we audited and imported (or noted as already-covered)
in the marathon session.

## What was imported

### `agent-os-pack-5/` (11 markdown docs)

Setup and user-facing docs from `/Users/walt/Downloads/agent-os-pack 5`:

| File | Purpose |
|---|---|
| `01-install.md` | Node 22+ install path + first-run flow |
| `02-connect-agents.md` | Wiring Claude / Codex / Gemini / Hermes / OpenClaw |
| `03-design-system.md` | Midnight Aubergine palette + token reference |
| `04-workspace-pattern.md` | The "one folder per project" convention |
| `05-travel-mode.md` | Running offline / on the road |
| `06-troubleshooting.md` | Common breakages and fixes |
| `AGENTS.md`, `BUILD-YOUR-OWN.md`, `NOTEBOOK-SETUP.md`, `SEO-SETUP.md` | Topic deep-dives |

The pack's `source/` is a parallel Next.js dashboard with the same routes our
Baseline OS already has (Hermes, OpenClaw, Codex, Gemini, Antigravity,
Free Claude, Journal, Guide, Kanban, Memory, Goals, SEO, Studio, Video,
Notebook). Importing the source 1:1 would duplicate or regress what we ship;
the docs are the standalone value.

### `claude-os-hermes-v2.3/` (3 docs + personas)

- `CHANGELOG.md` — V2.3's headline feature is a **Documents Gallery**. We
  already shipped the equivalent in this session as `/documents` + the
  Jack-Roberts install prompt at `docs/hermes/install-prompt.md`. The V2.3
  version has a few polish bits we haven't matched yet (soft-delete to
  `.trash/` with Undo toast, recency grouping, install-prompt modal) — easy
  next iteration if you want them.
- `CLAUDE.md`, `README.md` — project context for reference.
- Hermes pantheon personas mirrored to `~/.claude-os/imports/v2.3/personas/`
  for later cross-reference with the live pantheon at `~/.hermes/pantheon/`.

## What is already in Baseline OS (no import needed)

Cross-referenced both packs against our current routes:

- ✅ Mission Control · Flight Deck · Runtime Registry — Baseline OS Phase 1
- ✅ Goals · Journal · Notebook · Memory · Pinecone — pages exist
- ✅ Studio · HyperEdit · Higgsfield — built and live
- ✅ Documents — shipped this session from Jack Roberts playbook
- ✅ Agentic OS overview (Dreaming / Goals / Pantheon / Cost) — shipped this session
- ✅ Voice agents (Hermes + ClaudeClaw + OpenClaw via FullChat) — shipped this session
- ✅ Specialist Team tab on ClaudeClaw — shipped this session
- ✅ Persistent per-agent memory — shipped this session

## What's optional follow-up

If you want a tighter match to V2.3's Documents Gallery polish:
- Soft-delete to `~/Hermes/.trash/` with an 8-second Undo toast
- Recency grouping (Today / Yesterday / This Week / Earlier) when >6 docs
- Install-prompt MODAL on the Documents page (we have the .md doc; a UI
  modal version is a quick wrap)

Those are small UX wins, not architectural changes. Easy session of work
whenever you ask for them.
