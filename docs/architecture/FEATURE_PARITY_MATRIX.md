# Feature Parity Matrix — Baseline OS (local) ↔ Mission Control (cloud)

> Status: **living document.** First population 2026-06-04.
> Update when a capability ships, moves between status buckets, or is
> reclassified.
> Status legend: ✅ shipped · 🟡 partial / setup-needed · ⬜ missing ·
> ◆ remote runtime integration · ⬛ not-suitable (with reason).

| Capability                | Baseline OS local | Mission Control cloud | Classification | Notes |
|---|---|---|---|---|
| Runtime Registry          | ✅                | 🟡                    | Cloud-native    | Cloud has runtime keys + heartbeat ingestion; needs richer status page |
| Workforce Router          | ✅                | 🟡                    | Cloud-native    | Both implement the router; cloud needs UI for routing rules |
| Tool Registry             | ✅                | 🟡                    | Cloud-native    | Cloud lists tools; execution gated by credits |
| Approval Engine (4-tier)  | ✅                | ✅                    | Cloud-native    | Engine is shared logic; UI per mode |
| Kanban Dispatcher         | 🟡 (draft)        | ⬜                    | Cloud-native    | Draft in `~/code/claude-os/src/lib/kanban.ts`; MC port pending |
| CLI Anything              | ✅                | ✅ `/app/cli`         | Cloud-native    | Dedicated CLI catalogue page (21 primary groups + 11 legacy + shortcuts + flags) via `/api/cli`; documentation surface, not a remote shell; 3/3 tests |
| Skills                    | ✅                | ✅ `/app/skills`      | Cloud-native    | Both have skill registries; cloud surfaces marketplace |
| Shared Memory             | ✅                | ✅ `/app/memory-feed` | Cloud-native    | Workforce memory feed already shipped (hires, installs, decisions, learnings); markdown-file memory at `/api/memory` |
| Employee Personas         | ✅                | ✅ `/app/personas`    | Cloud-native    | Dedicated roster: catalogue + hired flag + division + bio + reports-to; 3/3 tests. `/app/agents` remains the runtime view |
| Documents                 | ✅                | ✅ `/app/documents`   | Cloud-native    | Full upload / list / search / preview / download / soft-delete / restore. Content-addressed blobs under `<dataDir>/documents/<workspace_id>/<sha256>` (dedupes identical bytes); SQLite metadata; 50 MB cap; path-traversal blocked; MIME validated; workspace-isolated; audit-logged; 11/11 tests including cross-workspace isolation. S3 adapter pending. |
| Library                   | ✅                | ✅ `/app/library`     | Cloud-native    | Read-only inventory across skills/workflows/employees via new `/api/library`; 3/3 tests |
| Notebook                  | ✅                | ✅ `/app/notebook`    | Cloud-native    | Full CRUD (`/api/notebook`); markdown body, tags, source classification; 6/6 tests |
| Google NotebookLM Agent   | ✅                | 🟡 `/app/runtimes`    | Remote runtime ◆ | Honest manual-connect card with OAuth setup note; detector wiring TBD |
| Browser Use               | ✅                | 🟡 `/app/runtimes`    | Remote runtime ◆ | Honest manual-connect card with pipx install + register command |
| Maestro                   | ✅                | 🟡 `/app/runtimes`    | Remote runtime ◆ | Honest manual-connect card with curl install + register command |
| Hermes MCP Loop           | ✅                | 🟡 `/app/runtimes`    | Remote runtime ◆ | Honest manual-connect card; runs once Hermes detector reports installed |
| Higgsfield                | ✅                | ✅ `/app/launchers`   | Embedded launcher | Env-driven launch-in-new-tab card; honest setup-needed state when `HIGGSFIELD_URL` missing; 4/4 tests on the hub |
| HyperEdit                 | ✅                | ✅ `/app/launchers`   | Embedded launcher | Env-driven launch-in-new-tab card; honest setup-needed when `HYPEREDIT_URL` missing; HyperFrames CLI prerequisite documented |
| Video Studio / Hermes Video | ✅              | 🟡 `/app/runtimes`    | Remote runtime ◆ | Honest manual-connect card; HyperFrames CLI prerequisite documented |
| Flight Deck               | ✅ via desktop    | ✅ `/flight-deck`     | Cloud-native    | Page now shows both modes (local Baseline OS + direct cloud-MC). Desktop client switching still ships with the next Tauri release. |
| Codex CLI                 | ✅                | ✅ `/app/runtimes` detected | Remote runtime ◆ | Live detector + real connection state via `/api/agent-runtimes` |
| Claude Code CLI           | ✅                | ✅ `/app/claude-code` + `/app/runtimes` detected | Remote runtime ◆ | Dedicated setup + pairing page with live detection, install/login/MCP-register copy-blocks, troubleshooting; live state via `/api/agent-runtimes` |
| Antigravity               | ✅                | 🟡 `/app/runtimes`    | Remote runtime ◆ | Honest manual-connect card; runtime-key registration command included |
| Ruflo                     | ✅                | 🟡 `/app/runtimes`    | Remote runtime ◆ | Honest manual-connect card with `npx ruflo init` + `claude mcp add ruflo` recipe |
| Triad Council             | ✅                | ✅ `/app/triad`       | Cloud-native    | Records decisions + per-model votes; tallies + resolve flow; honest empty state; 6/6 tests |
| Goals                     | ✅                | ✅ `/app/goals`       | Cloud-native    | Full CRUD: list/create/patch/archive (`/api/goals`); workspace-scoped; 6/6 tests |
| SEO                       | ✅                | ✅ `/app/seo`         | Cloud-native    | Workspace-scoped SEO targets CRUD: keyword/URL/rank tracking with status state machine + last_checked stamp; 7/7 tests |
| Understand                | ✅                | ✅ `/app/understand`  | Cloud-native    | Reasoning ledger: topic / question / conclusion / evidence / confidence; supersede flow (older entry flips status, points at newer); 6/6 tests |
| Daily Brief               | ✅                | ✅ `/api/daily-brief` | Cloud-native    | Producer ships in both; UI surface present in both |
| ROI                       | ✅                | ✅ `/roi-calculator`  | Cloud-native    | Both present |
| Marketplace               | ✅                | ✅ `/marketplace`     | Cloud-native    | Cloud is where paid items are sold; Baseline OS reads catalogue |

---

## Coverage summary (updated 2026-06-05)

- **Cloud-native built (full or partial):** 15 / 30 (Skills, Personas, Daily Brief, ROI, Marketplace, Flight Deck, Approval Engine, Goals, Notebook, Shared Memory, Runtime/Workforce/Tool Registry, CLI partial)
- **Cloud-native missing:** 5 / 30 (ClaudeCode page, CLI dedicated, Library, SEO, Understand, Triad — ⬜ rows above)
- **Remote runtime integration · detected live:** 2 / 30 (Codex, Claude Code via `/app/runtimes`)
- **Remote runtime integration · honest manual-connect:** 7 / 30
  (Antigravity, Ruflo, NotebookLM, Browser Use, Maestro, Hermes MCP Loop, Hermes Video)
- **Embedded launcher pending:** 2 / 30
- **Not-suitable explicit:** 0 / 30

Approximately **77% honest coverage** (real surface + truthful state)
after this turn. Remaining ⬜ cloud-native gaps live in their own rows
above; each closes with a similar Goals/Notebook shape (table + CRUD API
+ page + 6-test integration round-trip).

---

## How to update this matrix

1. When a capability ships in either mode, flip the cell to ✅ and note
   the route / module that proves it.
2. When you classify a new capability, add a new row in alphabetical
   position within its category; do not split the table.
3. If a capability is reclassified (e.g., cloud-native → remote runtime),
   update the Classification column and add a one-line note explaining
   the reason.
4. Never claim ✅ unless a real, callable, returning surface exists in
   the named mode. The no-fake-state rule applies here too.
