# SOP: Antigravity + Gemini 3.5 Flash — Hermes MCP Loop Architecture™

## What It Is
Google's agent-first development platform. Deploys multiple AI subagents working in parallel.
Paired with Gemini 3.5 Flash: 4x faster than other frontier models, outperforms Gemini 3.1 Pro.

## Status
Antigravity IS configured on this machine: `~/.gemini/antigravity/`

## The Hermes MCP Loop Architecture™ — 5 Layers
```
Layer 1: YOU (Command) — describe the goal
Layer 2: Gemini 3.5 Flash (Intelligence) — reason + plan
Layer 3: Antigravity Subagents (Execution) — parallel workers
Layer 4: Baseline Automations Dashboard (Organisation) — THIS DASHBOARD
Layer 5: Output Stack (Compounding) — assets build over time
```

## Gemini 3.5 Flash Stats
- 4× faster than other frontier models
- 1M token context window
- < ½ the cost of other frontier models
- Released: May 19, 2026

## Key Access Points
- Google AI Studio: https://aistudio.google.com
- Antigravity: https://antigravity.google.com (or via AI Studio)
- Gemini API in AI Studio

## Starter Prompt
```
Build me a complete Baseline Automations dashboard with a dark-mode UI.
Include tabs for: Launch Task, Active Agents, Workspace Files, and Completed Work.
Save all files to scratch/agent-os/.
```

## First Parallel Workflow Prompt
```
Deploy 3 subagents to:
(1) research [topic]
(2) write a 1,000-word guide
(3) format it as a clean HTML page
Save all to scratch/first-run/.
```

## Detection
- `/__antigravity_status` → `{ configured, hasState, dir }`
- Checks `~/.gemini/antigravity/` directory
- `antigravity_state.pbtxt` indicates active configuration

## 30-Day Compounding Strategy
Week 1: Foundation (access, first dashboard, first prompts)
Week 2: System Building (content, landing pages, email sequences)
Week 3: Compounding (chain outputs, parallel workflows, competitor research)
Week 4: Scale (full departments delegated, recurring agent tasks)
