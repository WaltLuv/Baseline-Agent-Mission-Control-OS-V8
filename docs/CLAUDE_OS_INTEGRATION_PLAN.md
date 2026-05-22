# CLAUDE OS INTEGRATION PLAN — Mission Control V2

**Date:** 2026-05-22
**Phase:** 6 (Planned — starts after Phase 5C billing)
**Scope:** Port Claude OS concepts into Mission Control panels

---

## GOLDEN RULES

1. **Claude OS stays separate** — Claude OS is its own codebase/platform. No code merges.
2. **Mission Control stays Next.js** — All implementations use the existing Next.js 16 stack.
3. **Concepts only, not code** — We port ideas, UX patterns, and data visualizations — not Claude OS source code.
4. **SQLite, not PostgreSQL** — All data stays in the existing SQLite schema. Adapt patterns, not databases.

---

## WHAT IS CLAUDE OS?

Claude OS is a conceptual framework for managing AI agents at scale, inspired by human organizational systems. It introduces advanced observability, optimization, and agent management paradigms that go beyond basic fleet monitoring. Mission Control V2 will selectively adopt the most valuable concepts and reimplement them as native Next.js panels.

---

## CLAUDE OS CONCEPTS TO PORT

### 1. Daily Optimization / Dream Panel

**Claude OS Concept:** An overnight optimization cycle where agents review their performance, identify bottlenecks, generate improvement suggestions, and auto-apply low-risk optimizations. "Dream" refers to agents processing their day's experiences while offline.

**Mission Control Implementation:**
- **New Panel:** `DreamPanel` in the dashboard
- **Data Source:** Token usage logs (`/api/tokens`), task outcomes (`/api/tasks/outcomes`), quality reviews (`/api/quality-review`)
- **Features:**
  - Auto-generated daily summary: "Your agents used X tokens across Y tasks. Z tasks were completed under budget. W tasks exceeded estimates."
  - Bottleneck identification: agents with highest cost-per-completed-task, longest average task duration, most failed tasks
  - Optimization suggestions: "Agent Aegis has 3 quality reviews pending — consider reassigning review tasks" or "Scout's average task cost dropped 12% this week"
  - Auto-apply toggle: for low-risk changes (e.g., model-tier adjustments, task reassignments based on performance patterns)
- **API:** New `/api/optimization/daily` endpoint that aggregates previous 24h data and generates narrative summary
- **Refresh:** Manual trigger + daily cron-generated report

**Why It Matters:** Gives customers actionable insights instead of raw metrics. Turns a dashboard into an advisor.

---

### 2. Fleet Health Score

**Claude OS Concept:** A single composite health metric (0-100) that summarizes the overall state of the agent fleet, combining uptime, task success rate, cost efficiency, trust score, and responsiveness.

**Mission Control Implementation:**
- **Widget:** Fleet Health Score in the dashboard header (alongside existing metric cards)
- **Calculation (weighted):**
  - Agent Uptime (25%): % of agents online vs total
  - Task Success Rate (25%): % of tasks completed (done) vs failed/blocked
  - Cost Efficiency (20%): Current cost vs 7-day rolling average
  - Trust Score Avg (15%): Average from `agent_trust_scores` table
  - Response Latency (15%): Average task assignment → start time
- **Color Coding:** 🟢 80-100, 🟡 60-79, 🔴 <60
- **API Extend:** New `/api/fleet-health` endpoint
- **Historical Trend:** Sparkline showing 7-day trend

**Why It Matters:** One number tells operators if their fleet is healthy. Eliminates panel-hopping for overall status.

---

### 3. Skills ROI

**Claude OS Concept:** Track which installed skills actually deliver value — how many tasks they enable, how much time/cost they save, and which skills are dead weight.

**Mission Control Implementation:**
- **New Tab:** "Skills ROI" in the existing Skills panel (`src/components/panels/skills-panel.tsx`)
- **Data Sources:**
  - Skills inventory (`/api/skills`)
  - Task assignments and completions (`/api/tasks`)
  - Token costs (`/api/tokens`)
- **Per-Skill Metrics:**
  - Tasks utilizing this skill (traced via task metadata/tags)
  - Cost savings: estimated tokens saved vs baseline (pre-skill installation cost)
  - Usage frequency: calls per day/week
  - Last used: timestamp of most recent skill utilization
  - ROI Score: (value delivered - maintenance cost) / maintenance cost
- **Recommendations:**
  - "Skill X hasn't been used in 14 days — consider removing"
  - "Skill Y saved ~$42 in estimated token costs this week"
- **API:** Extend `/api/skills` with `usage_stats` query parameter

**Why It Matters:** Skills installation is easy but cleanup is hard. This prevents skill bloat and proves value.

---

### 4. Agent Personas / Pantheon

**Claude OS Concept:** Agents develop distinct operational personalities over time based on their work patterns. The "Pantheon" is a visual mapping of agent archetypes (e.g., "The Finisher", "The Explorer", "The Guardian") with behavioral insights.

**Mission Control Implementation:**
- **New Panel:** `PantheonPanel` (new dashboard tab or section within Agents panel)
- **Data-Driven Archetype Classification (computed from actual behavior):**
  - **The Finisher:** High completion rate, low time-per-task, few quality review rejections
  - **The Explorer:** High research activity, diverse task types, strong memory utilization
  - **The Guardian:** Fewest security events, high trust score, consistent quality reviews
  - **The Collaborator:** Most cross-agent communication, high subscription count
  - **The Sprinter:** Burst working pattern (many tasks in short windows)
  - **The Marathoner:** Consistent steady throughput over long periods
- **Visual Elements:**
  - Radar/spider chart showing each agent's behavioral profile
  - Pantheon grid — cards with agent name, archetype icon, key stats
  - "Archetype shift" detection: when an agent's primary archetype changes
- **API:** New `/api/agents/archetypes` — computes archetype from agent_trust_scores, task metrics, communication patterns
- **Storage:** Cache computed archetypes in a new `agent_archetypes` table for fast reads

**Why It Matters:** Turns a flat agent list into a living team with roles and identities. Operators understand their workforce at a glance.

---

### 5. Memory Graph Upgrade

**Claude OS Concept:** Upgrade the existing memory browser from a flat file browser into a true knowledge graph with relationship detection, importance scoring, and automated pruning.

**Mission Control Implementation:**
- **Current State:** `MemoryBrowserPanel` shows memory files in a directory-like tree with basic search
- **Upgrades:**
  - **Relationship Detection:** Cross-reference memory files to find connections (shared entities, temporal links, topic overlap). Render as a force-directed graph (replacing the current flat tree).
  - **Importance Scoring:** Score each memory node by:
    - Reference count (how many other memories link to it)
    - Recency (newer = higher weight)
    - Task association (memories tied to completed tasks get bonus)
    - Agent access frequency
  - **Automated Pruning Suggestions:** Flag memories that are:
    - Stale (not accessed in >30 days)
    - Low-importance (score < threshold)
    - Duplicated (near-duplicate detection via text similarity)
  - **Knowledge Health Score:** Graph-level metric (density, average path length, orphan ratio)
- **API Changes:**
  - `/api/memory/graph` — return nodes, edges, scores (enhance existing endpoint)
  - `/api/memory/pruning` — return recommended prunes
  - New `memory_importance` table for caching computed scores
- **UI:** D3.js or recharts force-directed graph visualization

**Why It Matters:** Memory is Mission Control's unique differentiator. A real knowledge graph makes it actionable instead of archival.

---

### 6. Agent Discovery Scanner

**Claude OS Concept:** Automatically scan the local environment, connected services, and running processes to discover potential new agents that could be onboarded to the fleet.

**Mission Control Implementation:**
- **New Panel:** `DiscoveryPanel` in the Integrations/Gateway tab
- **Detection Methods:**
  1. **Process Scanner:** Scan running processes for known AI agent signatures (Claude Code, Codex, Ollama models, OpenClaw instances, custom agent processes)
  2. **Config Scanner:** Check common config paths (`~/.claude/`, `~/.openclaw/`, `~/.codex/`) for agent configs
  3. **Port Scanner:** Detect services on known agent ports (18789 for gateway, custom model serving ports)
  4. **Network Discovery:** Scan local network for MCP servers, API endpoints, agent registries
  5. **CLI/Editor Integration:** Detect Claude Code, Codex, or other agent instances in editor sessions
- **UI Elements:**
  - "Discovered" list: agents found but not yet registered
  - One-click onboarding: "Add to Fleet" button pre-fills registration
  - "Already Registered" indicator for known agents
  - Discovery scan history with timestamps
- **API:** New `/api/discovery/scan` endpoint — returns discovered agents with registration status
- **Security:** Discovery results are informational only. Registration still requires explicit approval and workspace assignment.

**Why It Matters:** Reduces onboarding friction. Agents should be discoverable, not manually configured.

---

## IMPLEMENTATION ORDER (RECOMMENDED)

| Order | Feature | Complexity | Dependencies |
|-------|---------|-----------|-------------|
| 1 | Fleet Health Score | Low | Existing agent/task data |
| 2 | Agent Discovery Scanner | Medium | Process/port scanning |
| 3 | Dream Panel | Medium | Aggregation of multiple data sources |
| 4 | Skills ROI | Medium | Skills + task correlation |
| 5 | Memory Graph Upgrade | High | D3/graph visualization, scoring algorithm |
| 6 | Pantheon (Agent Personas) | High | Behavioral analysis, classification logic |

---

## DATA MODEL CHANGES

New tables needed for Claude OS features (SQLite):

```sql
-- Fleet health caching
CREATE TABLE IF NOT EXISTS fleet_health_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace_id INTEGER NOT NULL,
  health_score REAL NOT NULL,
  uptime_score REAL,
  success_rate REAL,
  cost_efficiency REAL,
  trust_avg REAL,
  latency_avg REAL,
  created_at BIGINT NOT NULL DEFAULT (unixepoch())
);

-- Agent archetype classification
CREATE TABLE IF NOT EXISTS agent_archetypes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_name TEXT NOT NULL,
  workspace_id INTEGER NOT NULL,
  archetype TEXT NOT NULL,  -- 'finisher', 'explorer', 'guardian', 'collaborator', 'sprinter', 'marathoner'
  confidence REAL NOT NULL,
  profile_json TEXT NOT NULL DEFAULT '{}',
  computed_at BIGINT NOT NULL DEFAULT (unixepoch()),
  UNIQUE(agent_name, workspace_id)
);

-- Memory importance scores
CREATE TABLE IF NOT EXISTS memory_importance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace_id INTEGER NOT NULL,
  memory_path TEXT NOT NULL,
  importance_score REAL NOT NULL,
  reference_count INTEGER NOT NULL DEFAULT 0,
  last_accessed BIGINT,
  last_computed BIGINT NOT NULL DEFAULT (unixepoch()),
  UNIQUE(workspace_id, memory_path)
);

-- Discovery scan results
CREATE TABLE IF NOT EXISTS discovery_scans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workspace_id INTEGER NOT NULL,
  results_json TEXT NOT NULL DEFAULT '[]',
  scan_method TEXT NOT NULL,  -- 'process', 'config', 'port', 'network', 'all'
  status TEXT NOT NULL DEFAULT 'completed',
  created_at BIGINT NOT NULL DEFAULT (unixepoch())
);
```

---

## WHAT WE ARE NOT PORTING

These Claude OS concepts are explicitly **excluded** from the integration plan:

- **Full agent self-modification** — Mission Control agents don't auto-modify their own configs
- **Multi-agent consensus mechanisms** — Voting/debate between agents (out of scope)
- **Autonomous agent spawning** — Agents can't create new agents without human approval
- **Natural language task routing** — Task assignment stays explicit (no AI auto-dispatch)
- **Claude OS plugin system** — Mission Control has its own skill system; no need to duplicate

---

## SUCCESS CRITERIA

Phase 6 is complete when:
- [ ] Fleet Health Score appears on every dashboard view with accurate calculation
- [ ] Dream Panel produces daily summaries with actionable insights
- [ ] Skills ROI tab shows per-skill metrics and cleanup recommendations
- [ ] Pantheon Panel classifies agents into archetypes with visual profiles
- [ ] Memory Graph renders as an interactive knowledge graph (not flat tree)
- [ ] Agent Discovery Scanner finds running agent instances with one-click onboarding
- [ ] All new panels have proper workspace_id scoping (multi-tenant safe)
- [ ] Performance: each new API endpoint responds in <500ms
- [ ] TypeScript clean — `pnpm typecheck` passes

---

*Created by Hermes Agent, 2026-05-22. Concepts sourced from Claude OS framework; implementation is 100% native Mission Control.*
