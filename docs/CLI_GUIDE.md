# Mission Control CLI (`mc`)

The Mission Control CLI is the **command-line control surface for Baseline
OS**. It is not an autonomous coding agent — it does not write code, ship
features, or run tests for you. It inspects and operates the Mission
Control deployment that already runs in your environment.

Use it to:

- log in to a Mission Control deployment (local, staging, production)
- list, connect, and diagnose runtimes (Hermes, OpenClaw / OpenCode, Claude
  Code, Codex)
- operate the FastMCP Agent Gateway
- manage workspaces, team invites, employees, skills
- inspect billing state
- audit deployment health and Flight Deck release status

## How it differs from Claude Code CLI

| Tool                    | Purpose                                      | Acts on                          |
| ----------------------- | -------------------------------------------- | -------------------------------- |
| **Claude Code CLI**     | Autonomous coding worker (writes code)       | Files in a repo                  |
| **Codex CLI**           | Autonomous coding worker (writes code)       | Files in a repo                  |
| **OpenClaw / OpenCode** | Execution runtime that runs coding workers   | The runtime itself               |
| **Hermes**              | Orchestration / execution runtime            | Tasks and pipelines              |
| **Mission Control CLI** | Operator control plane                       | Mission Control + runtimes above |

Mission Control CLI **supervises** the workers; the workers do the work.

## Install / run

The CLI ships with the Mission Control repo. There is nothing to
`npm install` separately.

```bash
# From a clone of the Mission Control repo
pnpm run mc -- <group> <action> [--flags]

# Or directly:
node /path/to/mission-control/scripts/mc-cli.cjs <group> <action> [--flags]
```

Add a shell alias for convenience:

```bash
alias mc="pnpm run mc --"
```

## Auth setup

There are three ways to authenticate:

1. **Session login** (`mc login`) — writes a session cookie to
   `~/.mission-control/profiles/default.json`.
2. **API key** (`MC_API_KEY` env var or `--api-key`) — preferred for
   automation, CI, and runtime daemons. Mint a key from the Mission Control
   UI under **Settings → Runtime API Keys**.
3. **Hybrid** — both can be present; the API key takes precedence.

```bash
# 1. Point the CLI at your Mission Control deployment
mc config set-url --url https://mc.example.com

# 2a. Either log in as an operator user
mc login --username admin --password 'YOUR_PASSWORD'

# 2b. ...or save a runtime API key
mc config set-key --key mca_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# 3. Verify
mc whoami --json
mc version
```

## Environment variables

| Variable        | Meaning                                                |
| --------------- | ------------------------------------------------------ |
| `MC_URL`        | Base URL of Mission Control (default `http://127.0.0.1:3000`) |
| `MC_API_KEY`    | Operator or runtime API key                            |
| `MC_COOKIE`     | Session cookie (set automatically by `mc login`)       |
| `MC_WORKSPACE`  | Active workspace id (overridable per-command)          |

Profile files are stored at `~/.mission-control/profiles/<name>.json`.
Multiple profiles are supported via `--profile <name>`.

## Command reference

> Each command supports `--json` for machine-readable output and `--help`
> for the global help text. Non-zero exit codes are emitted on failure:
> `2` usage, `3` auth, `4` forbidden, `5` network, `6` server.

### Auth / connection — `working`

```bash
mc login --username <u> --password <p>
mc logout
mc whoami
mc status health
mc config set-url --url https://mc.example.com
mc config set-key --key mca_...
mc config set-workspace --workspace ws_demo
mc config current
mc config profiles
mc version
```

### Runtimes — `working`

```bash
mc runtime list                                # all registered runtimes
mc runtime connect claude                      # print the connect command + probe handshake
mc runtime connect hermes --workspace ws_demo
mc runtime heartbeat                           # hit /api/runtime/heartbeat
mc runtime logs --kind claude
mc runtime doctor                              # full mission control + gateway diagnostic
```

Connecting Claude / Codex / Hermes / OpenClaw uses the in-repo helper
`scripts/connect-runtime.mjs` — `mc runtime connect <kind>` prints the
exact env-bootstrapped command to run for that runtime.

### Agent gateway — `working`

```bash
mc gateway health
mc gateway agents
mc gateway tasks
mc gateway task --id <task_id>
mc gateway logs --id <task_id>
mc gateway route-task --runtime claude --prompt "Summarize Q3"
```

### Workspaces — `working`

```bash
mc workspace list
mc workspace use --id ws_demo
mc workspace current
mc workspace get --id ws_demo
```

### Team / invites — `working`

```bash
mc team list --workspace ws_demo
mc team invites --workspace ws_demo
mc team invite --workspace ws_demo --email operator@example.com --role operator
mc team revoke --workspace ws_demo --invite-id inv_abc
```

### Employees — `working` (install command is `planned`)

```bash
mc employee list
mc employee inspect --id 5
mc employee status
mc employee remove --id 5
# install is stubbed — use the Marketplace UI
```

### Skills — `working` (install command is `planned`)

```bash
mc skill list
mc skill inspect --slug crm.lead.qualify
mc skill remove --slug crm.lead.qualify
# install is stubbed — use the Marketplace UI
```

### Billing — `working` (read-only)

```bash
mc billing status
mc billing credits
mc billing usage --timeframe month
mc billing ledger
```

### Deployment — `working` (`preflight` / `rollback` are `planned`)

```bash
mc deploy health
mc deploy check
mc deploy env-check
# preflight + rollback are stubbed — call /app/scripts/preflight-production.sh directly
```

### Flight Deck — `working`

```bash
mc flightdeck status
mc flightdeck downloads          # lists available + pending platform artifacts
mc flightdeck doctor             # full release-status diagnostic
mc flightdeck release            # prints the CI tag command to cut a release
```

### Other (legacy) groups

The existing groups are preserved:

`agents`, `tasks`, `sessions`, `connect`, `tokens`, `skills`, `cron`,
`workflows`, `events`, `export`, `raw`.

See `mc --help` for full lists.

## Common workflows

### Customer Zero — bring up Mission Control + runtimes from cold

```bash
mc config set-url --url http://127.0.0.1:3000
mc login --username admin --password admin12345
mc status health --json
mc runtime list
mc runtime doctor
mc flightdeck downloads
```

### Operator — invite a teammate

```bash
mc workspace use --id ws_demo
mc team invite --email new-operator@example.com --role operator
mc team invites
```

### Runtime daemon — register from a fresh box

```bash
export MC_URL=https://mc.example.com
export MC_API_KEY=mca_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
mc runtime connect claude            # prints the bootstrap command
node scripts/connect-runtime.mjs --runtime claude
mc runtime list --json
```

### CI — confirm gateway is healthy before a deploy

```bash
mc deploy health --json
mc gateway health --json
mc flightdeck doctor --json
```

## Output format

- Default: human-readable, one block per response.
- `--json`: pretty-printed JSON object; for streams (`mc events watch
  --json`), NDJSON (one JSON object per line).

## Exit codes

| Code | Meaning              |
| ---- | -------------------- |
| 0    | OK                   |
| 2    | Usage error          |
| 3    | Unauthorized (401)   |
| 4    | Forbidden (403)      |
| 5    | Network / timeout    |
| 6    | Server error (5xx)   |

## Troubleshooting

| Symptom                                 | Fix                                                            |
| --------------------------------------- | -------------------------------------------------------------- |
| `Unauthorized` on every command         | Run `mc login` or `mc config set-key --key mca_...`            |
| `Mission Control unreachable`           | Check `mc config current` — is `--url` pointing at the right deployment? |
| `mc runtime list` returns 401           | Use an operator session — runtime API keys can list runtimes once permissions are set in the Runtime API Keys panel |
| `mc flightdeck downloads` shows nothing | The CI release workflow hasn't run yet — push a `flight-deck-v*` tag, or build locally per the `/flight-deck` page |

## Implementation status reference

The CLI tells you the truth about every command. Allowed statuses:

- **working** — command hits a real backend route
- **stubbed** — command exists in CLI but the backend route is `planned`
- **planned** — the entire surface is not built yet

Never trust a green "OK" from a stubbed command — check the response body;
stubbed commands return `{ "status": "planned", "message": "..." }`.

---

## Boundary

The Mission Control CLI does not, and will not:

- write code or refactor files
- run a Claude Code / Codex / OpenClaw worker loop itself
- execute autonomous tasks without an explicit `mc gateway route-task`
- bypass workspace or role permissions

If you need autonomous coding, use Claude Code CLI or Codex CLI directly
on the box, and let Mission Control supervise them via `mc runtime
connect <kind>`.
