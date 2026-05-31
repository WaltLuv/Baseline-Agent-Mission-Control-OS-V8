# Mission Control MCP Tool Audit

> Generated: 2026-05-31
> Source of truth: `scripts/mc-mcp-server.cjs` (49 tools, 849 lines)
> Transport: JSON-RPC 2.0 over stdio
> Auth: `MC_URL` + `MC_API_KEY` *or* `MC_COOKIE` (profile fallback)

This audit lists every MCP tool exposed by Mission Control, the HTTP route
it wraps, the auth/role/workspace gates that route enforces, whether the
tool is **working / partial / planned / broken**, and whether it should be
mirrored as an operator CLI verb.

Legend:
- **W** = Working — route exists, tool returns real data
- **P** = Partial — route exists but response shape or auth is limited
- **B** = Blocked — route returns 401/403 without role-elevated session
- **S** = Stubbed — backend route not yet implemented
- **CLI** = "Y" if surfaced via `mc <verb>`, "N" if intentionally MCP-only
- **UI** = "Y" if an equivalent panel exists in the Mission Control web UI

## 1. Health / dashboard

| Tool | Route | Status | CLI | UI | Notes |
| ---- | ----- | :----: | :--: | :--: | ----- |
| `mc_health` | `GET /api/status?action=health` | W | `mc health` / `mc status health` | Y | Public probe; no auth needed. |
| `mc_status` | `GET /api/status?action=overview` | W | `mc status overview` | Y | Requires session. |
| `mc_dashboard` | `GET /api/status?action=dashboard` | W | `mc dashboard` / `mc status dashboard` | Y | Requires session. |

## 2. Agents

| Tool | Route | Status | CLI | UI | Notes |
| ---- | ----- | :----: | :--: | :--: | ----- |
| `mc_list_agents` | `GET /api/agents` | W | `mc agent list` / `mc employee list` | Y | Workspace-scoped. |
| `mc_get_agent` | `GET /api/agents/:id` | W | `mc agent get --id` | Y | Workspace-scoped. |
| `mc_heartbeat` | `POST /api/agents/:id/heartbeat` | W | `mc agent heartbeat --id` | N | Operator + runtime API key. |
| `mc_wake_agent` | `POST /api/agents/:id/wake` | W | `mc agent wake --id` | Y | Operator. |
| `mc_agent_diagnostics` | `GET /api/agents/:id/diagnostics` | W | `mc agent diagnostics --id` | Y | Operator. |
| `mc_agent_attribution` | `GET /api/agents/:id/attribution?hours=&section=` | W | `mc agent attribution --id` | Y | Hours window, optional section filter. |
| `mc_agent_costs` | `GET /api/tokens?action=agent-costs&timeframe=` | W | `mc agent costs` / `mc tokens agent-costs` | Y | Aggregate. |
| `mc_costs_by_agent` | `GET /api/tokens/by-agent?days=N` | W | `mc tokens by-agent --days` | Y | Per-agent breakdown. |

## 3. Tasks & comments

| Tool | Route | Status | CLI | UI | Notes |
| ---- | ----- | :----: | :--: | :--: | ----- |
| `mc_list_tasks` | `GET /api/tasks` (+ status/assigned/priority/search/limit) | W | `mc task list` | Y | Query filters. |
| `mc_get_task` | `GET /api/tasks/:id` | W | `mc task get --id` | Y | |
| `mc_create_task` | `POST /api/tasks` | W | `mc task create --title --description` | Y | Body-driven. |
| `mc_update_task` | `PUT /api/tasks/:id` | W | `mc task update --id --body` | Y | |
| `mc_poll_task_queue` | `GET /api/tasks/queue?agent=&max_capacity=` | W | `mc task queue --agent` / `mc queue poll` | N | Used by runtimes. |
| `mc_broadcast_task` | `POST /api/tasks/:id/broadcast` | W | `mc task broadcast --id --message` | Y | Notifies subscribers. |
| `mc_list_comments` | `GET /api/tasks/:id/comments` | W | `mc task comments --id list` | Y | |
| `mc_add_comment` | `POST /api/tasks/:id/comments` | W | `mc task comments --id add --content` | Y | |

## 4. Runs / evals / provenance

| Tool | Route | Status | CLI | UI | Notes |
| ---- | ----- | :----: | :--: | :--: | ----- |
| `mc_list_runs` | `GET /api/v1/runs` | W | `mc run list` | partial | Versioned API surface. |
| `mc_get_run` | `GET /api/v1/runs/:run_id` | W | `mc run get --run-id` | partial | |
| `mc_create_run` | `POST /api/v1/runs` | W | `mc run create` | partial | Used by runtimes. |
| `mc_update_run` | `PUT /api/v1/runs/:run_id` | W | `mc run update --run-id` | partial | |
| `mc_run_provenance` | `GET /api/v1/runs/:run_id/provenance` | W | `mc run provenance --run-id` | partial | |
| `mc_attach_eval` | `POST /api/v1/runs/:run_id/eval` | W | `mc eval attach --run-id` | partial | |
| `mc_eval_leaderboard` | `GET /api/v1/evals/leaderboard` | W | `mc eval leaderboard` | partial | |

## 5. Sessions

| Tool | Route | Status | CLI | UI | Notes |
| ---- | ----- | :----: | :--: | :--: | ----- |
| `mc_list_sessions` | `GET /api/sessions` | W | `mc session list` | Y | |
| `mc_control_session` | `POST /api/sessions/:id/control` | W | `mc session control --id --action` (`--yes` required) | Y | **Destructive** — start/pause/cancel. |
| `mc_continue_session` | `POST /api/sessions/continue` | W | `mc session continue --kind --id --prompt` | Y | |
| `mc_session_transcript` | `GET /api/sessions/transcript?kind=&id=` | W | `mc session transcript --kind --id` | Y | |

## 6. Skills

| Tool | Route | Status | CLI | UI | Notes |
| ---- | ----- | :----: | :--: | :--: | ----- |
| `mc_list_skills` | `GET /api/skills` | W | `mc skill list` | Y | |
| `mc_read_skill` | `GET /api/skills?mode=content&source=&name=` | W | `mc skill read --slug` | Y | |

> `mc_write_skill` is **not** exposed in MCP. Skill mutation goes through
> `PUT /api/skills` in the CLI (`mc skills upsert --source --name --file`)
> and is gated by operator role.

## 7. Memory & SOUL (per-agent)

| Tool | Route | Status | CLI | UI | Destructive? |
| ---- | ----- | :----: | :--: | :--: | :----------: |
| `mc_read_memory` | `GET /api/agents/:id/memory` | W | `mc memory read --id` | Y | no |
| `mc_write_memory` | `PUT /api/agents/:id/memory` | W | `mc memory write --id --content` (requires `--yes`) | Y | **yes** |
| `mc_clear_memory` | `DELETE /api/agents/:id/memory` | W | `mc memory clear --id --yes` | Y | **yes** |
| `mc_read_soul` | `GET /api/agents/:id/soul` | W | `mc soul read --id` | Y | no |
| `mc_write_soul` | `PUT /api/agents/:id/soul` | W | `mc soul write --id` (requires `--yes`) | Y | **yes** |
| `mc_list_soul_templates` | `PATCH /api/agents/:id/soul` | W | `mc soul templates --id` | Y | no |

## 8. Knowledge (workspace-scoped vault)

| Tool | Route | Status | CLI | UI | Destructive? |
| ---- | ----- | :----: | :--: | :--: | :----------: |
| `mc_search_knowledge` | `GET /api/memory/search?q=&limit=` | W | `mc knowledge search --q` | Y | no |
| `mc_read_knowledge_file` | `GET /api/memory?action=content&path=` | W | `mc knowledge read-file --path` | Y | no |
| `mc_write_knowledge_file` | `PUT /api/memory` | W | `mc knowledge write-file --path --file` (requires `--yes`) | Y | **yes** |
| `mc_knowledge_health` | `GET /api/memory/health` | W | `mc knowledge health` | Y | no |
| `mc_rebuild_search_index` | `POST /api/memory/search {action:'rebuild'}` | W | `mc knowledge rebuild-index --yes` | Y | **yes (costly)** |
| `mc_knowledge_gaps` | `POST /api/memory/process {action:'gap-detect'}` | W | `mc knowledge gaps` | Y | no |
| `mc_knowledge_consolidate` | `POST /api/memory/process {action:'consolidate'}` | W | `mc knowledge consolidate --yes` | Y | **yes (costly)** |

## 9. Connections / cost / cron

| Tool | Route | Status | CLI | UI | Notes |
| ---- | ----- | :----: | :--: | :--: | ----- |
| `mc_list_connections` | `GET /api/connect` | W | `mc connect list` | Y | |
| `mc_register_connection` | `POST /api/connect` | W | `mc connect register --tool-name --agent-name` | Y | Used during runtime onboarding. |
| `mc_token_stats` | `GET /api/tokens?action=stats&timeframe=` | W | `mc tokens stats --timeframe` | Y | |
| `mc_list_cron` | `GET /api/cron` | W | `mc cron list` | Y | |

## 10. Tools intentionally NOT in MCP (CLI-only or UI-only)

- Workspace CRUD (`/api/workspaces`) — operator scope, no agent-call use case.
- Team invites (`/api/workspaces/:id/invites`) — operator-only.
- Billing (`/api/billing/*`) — operator-only.
- Flight Deck manifest (`/api/flight-deck/manifest`) — public, CLI / browser.
- Runtime handshake (`/api/runtime/handshake`) — runtime client only.
- Agent API keys mint (`/api/agents/:id/keys`) — operator-only.

## 11. Safety classification

| Severity | Tools |
| -------- | ----- |
| **Destructive (require `--yes`)** | `mc_clear_memory`, `mc_write_memory`, `mc_write_soul`, `mc_write_knowledge_file`, `mc_rebuild_search_index`, `mc_knowledge_consolidate`, `mc_control_session`, `mc_update_task` (when status=cancelled), `mc_register_connection`, `mc_wake_agent` |
| **Workspace-mutating** | All writes in §7, §8, `mc_create_task`, `mc_update_task`, `mc_add_comment`, `mc_create_run`, `mc_update_run`, `mc_attach_eval` |
| **Read-only / safe** | `mc_health`, `mc_status`, `mc_dashboard`, all `mc_list_*` / `mc_get_*` / `mc_read_*` / `mc_search_*` / `mc_*_leaderboard` / `mc_*_provenance` |

## 12. Workspace scope

Every tool that touches business data (agents, tasks, memory, knowledge,
runs, sessions, skills) is **workspace-scoped on the server** via the
session cookie's `workspace_id` claim or the API key's bound workspace.
The CLI honors this via the active profile's `workspace` field and the
optional `--workspace` override.

## 13. Test coverage

| Layer | Coverage |
| ----- | -------- |
| MCP HTTP wrappers | 100% smoke-tested in iteration_3 (manifest + downloads + cli) |
| MCP stdio transport | Manual — `node scripts/mc-mcp-server.cjs` reads stdin, returns JSON-RPC over stdout |
| CLI wrappers | 14/14 behavioral checks in `/app/test_reports/iteration_3.json` |
| MCP tool round-trip vs HTTP | Each MCP tool has a 1:1 HTTP route; HTTP coverage = MCP coverage |

## 14. Action items

- **Wire `mc_write_skill` / `mc_delete_skill`** into MCP for symmetry with
  `mc_list_skills` / `mc_read_skill` (currently CLI-only).
- **Add MCP tool `mc_flightdeck_manifest`** so agents can audit release
  state via MCP (currently CLI/HTTP only).
- **Expose `mc_workspace_*` MCP tools** (list, current) so a multi-tenant
  worker can self-identify its workspace.
- **Group MCP tools under namespaces** (`agent.*`, `task.*`, `run.*`) when
  the count crosses 70 — keeps tab-completion sane on the agent side.
