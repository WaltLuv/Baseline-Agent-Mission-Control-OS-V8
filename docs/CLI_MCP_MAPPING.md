# Mission Control CLI ↔ MCP Mapping

> Every operator CLI verb maps to one or more MCP tools (and the HTTP route
> behind them). This is the contract.

## Principle

- **MCP tools** are for agents (Claude Code, Codex, OpenClaw, Hermes) to call.
- **CLI verbs** are for humans operating Mission Control from a terminal.
- Both layers hit the same HTTP routes — there is **one source of truth**.

The CLI is intentionally narrower than MCP: it exposes the operator-useful
slice and gates destructive verbs behind `--yes`. Agents calling MCP get
the full surface because they're already inside a workspace-scoped session.

## Mapping table

| CLI verb | MCP tool(s) | HTTP route | Destructive |
| -------- | ----------- | ---------- | :---------: |
| `mc health` | `mc_health` | `GET /api/status?action=health` | no |
| `mc status` / `mc status health` | `mc_health` | `GET /api/status?action=health` | no |
| `mc status overview` | `mc_status` | `GET /api/status?action=overview` | no |
| `mc dashboard` / `mc status dashboard` | `mc_dashboard` | `GET /api/status?action=dashboard` | no |
| `mc agent list` / `mc employee list` | `mc_list_agents` | `GET /api/agents` | no |
| `mc agent get --id` | `mc_get_agent` | `GET /api/agents/:id` | no |
| `mc agent heartbeat --id` | `mc_heartbeat` | `POST /api/agents/:id/heartbeat` | no |
| `mc agent wake --id` | `mc_wake_agent` | `POST /api/agents/:id/wake` | no |
| `mc agent diagnostics --id` | `mc_agent_diagnostics` | `GET /api/agents/:id/diagnostics` | no |
| `mc agent attribution --id` | `mc_agent_attribution` | `GET /api/agents/:id/attribution` | no |
| `mc agent costs` | `mc_agent_costs` | `GET /api/tokens?action=agent-costs` | no |
| `mc task list` | `mc_list_tasks` | `GET /api/tasks` | no |
| `mc task get --id` | `mc_get_task` | `GET /api/tasks/:id` | no |
| `mc task create --title` | `mc_create_task` | `POST /api/tasks` | no |
| `mc task update --id --body` | `mc_update_task` | `PUT /api/tasks/:id` | no |
| `mc task comment --id --content` | `mc_add_comment` | `POST /api/tasks/:id/comments` | no |
| `mc task broadcast --id --message` | `mc_broadcast_task` | `POST /api/tasks/:id/broadcast` | no |
| `mc queue poll --agent` | `mc_poll_task_queue` | `GET /api/tasks/queue` | no |
| `mc run list` | `mc_list_runs` | `GET /api/v1/runs` | no |
| `mc run get --run-id` | `mc_get_run` | `GET /api/v1/runs/:id` | no |
| `mc run create --body` | `mc_create_run` | `POST /api/v1/runs` | no |
| `mc run update --run-id` | `mc_update_run` | `PUT /api/v1/runs/:id` | no |
| `mc run provenance --run-id` | `mc_run_provenance` | `GET /api/v1/runs/:id/provenance` | no |
| `mc eval attach --run-id` | `mc_attach_eval` | `POST /api/v1/runs/:id/eval` | no |
| `mc eval leaderboard` | `mc_eval_leaderboard` | `GET /api/v1/evals/leaderboard` | no |
| `mc session list` | `mc_list_sessions` | `GET /api/sessions` | no |
| `mc session continue --kind --id --prompt` | `mc_continue_session` | `POST /api/sessions/continue` | no |
| `mc session control --id --action --yes` | `mc_control_session` | `POST /api/sessions/:id/control` | **yes** |
| `mc session transcript --kind --id` | `mc_session_transcript` | `GET /api/sessions/transcript` | no |
| `mc skill list` | `mc_list_skills` | `GET /api/skills` | no |
| `mc skill read --slug` | `mc_read_skill` | `GET /api/skills?mode=content` | no |
| `mc soul read --id` | `mc_read_soul` | `GET /api/agents/:id/soul` | no |
| `mc soul write --id --yes` | `mc_write_soul` | `PUT /api/agents/:id/soul` | **yes** |
| `mc soul templates --id` | `mc_list_soul_templates` | `PATCH /api/agents/:id/soul` | no |
| `mc memory read --id` | `mc_read_memory` | `GET /api/agents/:id/memory` | no |
| `mc memory write --id --content --yes` | `mc_write_memory` | `PUT /api/agents/:id/memory` | **yes** |
| `mc memory clear --id --yes` | `mc_clear_memory` | `DELETE /api/agents/:id/memory` | **yes** |
| `mc knowledge search --q` | `mc_search_knowledge` | `GET /api/memory/search` | no |
| `mc knowledge read-file --path` | `mc_read_knowledge_file` | `GET /api/memory?action=content` | no |
| `mc knowledge write-file --path --file --yes` | `mc_write_knowledge_file` | `PUT /api/memory` | **yes** |
| `mc knowledge health` | `mc_knowledge_health` | `GET /api/memory/health` | no |
| `mc knowledge gaps` | `mc_knowledge_gaps` | `POST /api/memory/process` | no |
| `mc knowledge consolidate --yes` | `mc_knowledge_consolidate` | `POST /api/memory/process` | **yes** |
| `mc knowledge rebuild-index --yes` | `mc_rebuild_search_index` | `POST /api/memory/search` | **yes** |
| `mc connect list` | `mc_list_connections` | `GET /api/connect` | no |
| `mc connect register --tool-name --agent-name` | `mc_register_connection` | `POST /api/connect` | no |
| `mc tokens stats --timeframe` | `mc_token_stats` | `GET /api/tokens` | no |
| `mc tokens by-agent --days` | `mc_costs_by_agent` | `GET /api/tokens/by-agent` | no |
| `mc cron list` | `mc_list_cron` | `GET /api/cron` | no |

### CLI verbs without a 1:1 MCP tool

These are operator-only (no agent use case) — they exist only in CLI:

| CLI verb | HTTP route | Reason MCP-excluded |
| -------- | ---------- | ------------------- |
| `mc login` / `mc logout` / `mc whoami` | `/api/auth/*` | Agent auth is via API key, not session login. |
| `mc config *` | local profile file | Local-only state. |
| `mc workspace *` | `/api/workspaces/*` | Workspace mgmt is operator concern. |
| `mc team *` | `/api/workspaces/:id/{members,invites}` | Operator concern. |
| `mc runtime list/connect/doctor` | `/api/agent-runtimes`, `/api/runtime/handshake` | Mostly operator + runtime daemon. |
| `mc gateway *` | `/api/agent-gateway/*` | Operator concern. |
| `mc flightdeck *` | `/api/flight-deck/*` | Operator concern. |
| `mc deploy *` | `/api/status?action=health` + local env | Operator concern. |
| `mc billing *` | `/api/billing/*` | Operator concern. |

## Safety contract

Any CLI verb in the **Destructive** column **must** be invoked with `--yes`
to actually mutate state. Without `--yes`, the CLI exits with a non-zero
code and prints what *would* have happened. This applies even when an API
key with operator scope is loaded.

Example:

```bash
$ mc memory clear --id 5
ERROR: refusing to clear agent 5 memory without --yes
       this operation is destructive; re-run with --yes to confirm

$ mc memory clear --id 5 --yes
OK 200 DELETE http://127.0.0.1:3000/api/agents/5/memory
```

## CLI to HTTP audit trail

Every CLI call is logged server-side at the HTTP layer via the existing
audit middleware (`logAuditEvent` in `src/lib/audit.ts`). The CLI itself
prints the verb, route, and exit code to stderr so a `2>&1 | tee` audit log
is one keystroke away.
