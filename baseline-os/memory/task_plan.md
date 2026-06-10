# Task Plan — Claude OS Agent Dashboard (APPROVED BLUEPRINT)

## ✅ BLUEPRINT CONFIRMED

### North Star
A beautiful, dopamine-inducing Claude OS dashboard at `localhost:8081` with:
- Claude Code, OpenClaw, and Hermes connected with live data
- 🎤 Voice input (Web Speech API, no API keys) on EVERY chat box
- 📝 Goals section (checkboxes, voice, Obsidian vault sync)
- 📔 Journal section (daily files, voice, Obsidian vault sync)
- 🔧 Config-file-first architecture (zero hardcoded paths)
- 🚀 One-command install that works on anyone's machine
- 📖 Beautiful community guide page in dashboard + saved to Obsidian

### Data Schema (Input → Output)
```
Input:
  ~/.claude/projects/**/*.jsonl     → Claude Code sessions
  ~/.openclaw/openclaw.json         → OpenClaw config
  ~/.hermes/config.yaml             → Hermes config
  ~/.claude-os/config.json          → User config (vault path, rate, etc.)
  ~/.claude-os/goals/goals.json     → Goals data
  ~/.claude-os/journal/{date}.md    → Journal entries

Output:
  src/data/live-data.json           → Aggregated dashboard data
  {vault}/Baseline Automations/Goals/         → Goals as markdown checkboxes
  {vault}/Baseline Automations/Journal/       → Journal entries (one file/day)
  {vault}/Baseline Automations/Chats/         → Chat logs (one file/day)
  {vault}/Baseline Automations/Guide.md       → Community guide
```

### Behavioral Rules
- Beautiful UI: Midnight Aubergine palette, dopamine-inducing, not noisy
- Simple language throughout (emojis welcome)
- Every chat box has a microphone button
- Voice uses Web Speech API (browser built-in, no API keys)
- Obsidian writes happen via sidecar endpoints (never from frontend directly)
- Config-first: vault path, hourly rate, agent paths all from ~/.claude-os/config.json
- Community-shareable: works on fresh machine with one command

## Phases & Checklist

### PHASE B — BLUEPRINT ✅ DONE

### PHASE L — LINK ⏳
- [x] Bun v1.3.14 installed
- [x] Source copied to ~/code/claude-os
- [ ] `bun install` (deps)
- [ ] Probe ~/.claude/projects/ (Claude Code sessions)
- [ ] Read ~/.openclaw/openclaw.json
- [ ] Read ~/.hermes/config.yaml
- [ ] Verify Web Speech API available in browser target

### PHASE A — ARCHITECT (A.N.T.) ⏳
Layer A — Architecture SOPs (what each piece does)
- [ ] SOP: Voice Input Component
- [ ] SOP: Obsidian Vault Sync
- [ ] SOP: Goals Module
- [ ] SOP: Journal Module
- [ ] SOP: Config System
- [ ] SOP: Setup Wizard Enhancement
- [ ] SOP: Community Guide Page

Layer N — Navigation (routing + data flow)
- [ ] New routes: /goals, /journal, /guide
- [ ] Sidebar updated with new nav items
- [ ] Sidecar endpoints for Obsidian write

Layer T — Tools (execution scripts)
- [ ] src/components/voice-input.tsx
- [ ] src/lib/obsidian-sync.ts
- [ ] src/lib/config.ts
- [ ] src/routes/goals.tsx
- [ ] src/routes/journal.tsx
- [ ] src/routes/guide.tsx
- [ ] vite.config.ts (new sidecar endpoints)
- [ ] scripts/aggregate.ts (config-first updates)

### PHASE S — STYLIZE ⏳
- [ ] Voice button: animated mic, pulse on active, Midnight Aubergine palette
- [ ] Goals: beautiful checkbox cards with progress bars
- [ ] Journal: warm paper-like feel, daily prompt
- [ ] Guide: hero page, emojis, step-by-step visual flow
- [ ] Full dashboard cohesion check

### PHASE T — TRIGGER ⏳
- [ ] bun run dev starts everything (Vite + sidecar)
- [ ] Dream cron installed (7am daily)
- [ ] One-command install script documented
- [ ] CLAUDE.md updated as Project Constitution
