# Baseline Agent Gateway

A FastMCP backend service that bridges Mission Control with the CLI coding agents
(Claude Code, Codex, OpenCode/OpenClaw, Hermes) running on operator infrastructure.

**This is not a dashboard.** It is a backend service. Mission Control supervises;
this gateway is the shared MCP tool bus that the agents call into.

```
Mission Control                ← supervision, telemetry, UI
       │
       ▼  HTTP / MC_API_KEY
Baseline Agent Gateway (this)  ← FastMCP server · this service
       │
       ▼  subprocess
┌──────┴───────┬────────────┬──────────────┬─────────────┐
│ claude       │ codex      │ opencode     │ hermes      │
│ Code CLI     │ exec CLI   │ run CLI      │ delegate    │
└──────────────┴────────────┴──────────────┴─────────────┘
       │
       ▼  per-task git worktree
   /var/lib/agent-gateway/worktrees/<task_id>/
```

## What it gives you

Nine MCP tools, callable from any MCP-compatible client (Claude Code, Codex with
MCP wrapper, OpenCode with MCP provider, Hermes, custom scripts):

| Tool | Purpose |
|---|---|
| `claude_run_task`       | Run Claude Code (`claude -p ...`) on a bounded task |
| `codex_run_task`        | Run OpenAI Codex (`codex exec ...`) on a bounded task |
| `opencode_run_task`     | Run OpenCode/OpenClaw on a bounded task |
| `hermes_delegate_task`  | Hand a task to a Hermes agent via HTTP |
| `route_task`            | Pick the right agent automatically from task heuristics |
| `agent_review_code`     | Run a code-review pass on a diff or working tree |
| `agent_build_feature`   | End-to-end feature build (plan → implement → review) |
| `agent_status`          | Poll a long-running task |
| `agent_logs`            | Tail stdout / stderr for a task |

Every tool returns a `task_id`. Tasks persist to SQLite (`tasks.db`) with full
status, cost, model, exit code, and log paths.

## Quick start

### 1 · Install on the machine that holds your CLI agents

The CLIs (`claude`, `codex`, `opencode`, etc.) must be on `PATH`. The gateway
itself is pure Python.

```bash
git clone <repo>
cd repo/services/agent-gateway
python -m venv .venv && source .venv/bin/activate
pip install -e .

# Verify the agents this gateway can see
agent-gateway --doctor
```

### 2 · Configure

```bash
cp .env.example .env
# Edit:
#   MC_URL=https://<your-app>.emergent.host
#   MC_API_KEY=<the API_KEY from Mission Control's env>
#   GATEWAY_WORKSPACE_ID=1
#   GATEWAY_DATA_DIR=/var/lib/agent-gateway
#   ENABLED_AGENTS=claude,codex,opencode,hermes
```

### 3 · Run

```bash
agent-gateway                    # default: http://127.0.0.1:8765/mcp
# or
agent-gateway --port 8765 --host 0.0.0.0
```

The gateway registers itself with Mission Control as a runtime named
`agent-gateway-<host>` and heartbeats every 15s. Mission Control sees it under
**Runtime Registry → agent-gateway**.

### 4 · Connect from an MCP client (example: from Claude Code)

```jsonc
// ~/.config/claude/mcp_servers.json
{
  "agent-gateway": {
    "transport": "http",
    "url": "http://127.0.0.1:8765/mcp"
  }
}
```

Then from inside Claude Code: `> use codex_run_task to add tests for /src/auth`.

### 4b · Mission Control HTTP control plane

In addition to the FastMCP protocol at `/mcp`, the gateway exposes a small
JSON API on the same host/port so Mission Control's UI (and external monitors)
can introspect state without speaking MCP:

| Method | Path | Purpose | Auth |
|---|---|---|---|
| GET | `/health`            | Liveness + identity + agent inventory | Open |
| GET | `/v1/agents`         | Enabled agents + advertised tool names | Open |
| GET | `/v1/tasks?limit=&agent=` | Recent task rows | `MC_API_KEY` |
| GET | `/v1/tasks/{task_id}`| Single task row | `MC_API_KEY` |
| GET | `/v1/logs/{task_id}?stream=stdout&tail_bytes=16384` | Tail logs | `MC_API_KEY` |
| POST | `/v1/bootstrap`     | Force telemetry register/heartbeat (idempotent) | Open |

Mission Control proxies these as `/api/agent-gateway/{health,tasks,logs/...}`
so operators access them through the same domain + session/cookie they already
use. Set on the Mission Control host:

```bash
AGENT_GATEWAY_URL=http://127.0.0.1:8765
AGENT_GATEWAY_API_KEY=<same value as gateway's MC_API_KEY>
```

### 5 · Run as a service (systemd, prod)

```ini
# /etc/systemd/system/agent-gateway.service
[Unit]
Description=Baseline Agent Gateway (FastMCP)
After=network-online.target

[Service]
Type=simple
User=mc
WorkingDirectory=/opt/baseline/agent-gateway
EnvironmentFile=/opt/baseline/agent-gateway/.env
ExecStart=/opt/baseline/agent-gateway/.venv/bin/agent-gateway
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

## Permission & cost controls

`config.py` reads these env vars to keep the gateway tightly bounded:

| Env var | Default | Purpose |
|---|---|---|
| `ENABLED_AGENTS` | `claude,codex,opencode,hermes` | Disable a worker by removing it |
| `CLAUDE_ALLOWED_TOOLS` | `Read,Write,Edit,Bash` | Forwarded to `claude --allowedTools` |
| `CLAUDE_MAX_TURNS` | `12` | Hard cap |
| `CODEX_FULL_AUTO` | `1` | `codex exec --full-auto` vs interactive |
| `CODEX_MODEL` | (unset) | Override default |
| `OPENCODE_MODEL` | (unset) | Override default |
| `TASK_MAX_RUNTIME_SECS` | `1800` | Kill a task after this many seconds |
| `WORKTREE_BASE_REPO` | (required for git isolation) | Absolute path to the source git repo |
| `MC_REPORT_INTERVAL_SECS` | `15` | Telemetry heartbeat cadence |

## Data layout

```
$GATEWAY_DATA_DIR/
├── tasks.db                  SQLite: task_id, agent, status, exit_code, cost
├── worktrees/<task_id>/      ephemeral git worktrees per task
└── logs/<task_id>.stdout     full stdout
    logs/<task_id>.stderr     full stderr
    logs/<task_id>.meta.json  envelope: timing, exit, model, prompt
```

## Tests

```bash
pip install -e ".[dev]"
pytest -q
```

The included tests cover routing heuristics, the SQLite task store, and the
telemetry batcher — they run without any CLI agent installed.

## Security model

- Gateway has **no public surface**. Bind to `127.0.0.1:8765` unless on a private
  LAN behind a firewall.
- All MC communication uses `Authorization: Bearer <MC_API_KEY>`; the key is
  workspace-scoped on the Mission Control side.
- Worktrees are mode `0700`, owned by the gateway user.
- Subprocesses inherit only the env vars listed in `WORKER_ENV_ALLOWLIST`
  (default: `HOME`, `PATH`, `LANG`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`).
  Mission Control session secrets are never exported into worker processes.

## What this is NOT

- Not a CrewAI/LangGraph/AutoGen clone — no in-process planning DAG, no
  multi-agent chat.
- Not a Mission Control feature — it's a separate service that MC observes via
  the runtime registry.
- Not a binary distribution — operators install it where their CLI agents live
  (Mac, VPS, build server).
