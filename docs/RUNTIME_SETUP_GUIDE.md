# Mission Control Runtime Setup Guide

> Hand this guide to a customer.
> Last updated: 2026-05-31
> Target audience: operators connecting Hermes / OpenClaw / Claude Code /
> Codex to a Mission Control deployment.

## What you're building

```
   ┌─────────────────────────────────────────────────────────────┐
   │                  Mission Control (the OS)                  │
   │  Workspaces · Agents · Tasks · Runs · Evals · Billing      │
   └────────▲───────────────▲───────────────▲──────────────▲────┘
            │               │               │              │
            │ API key       │ API key       │ API key      │ API key
            │               │               │              │
       ┌────┴────┐     ┌────┴─────┐    ┌────┴────┐    ┌───┴───┐
       │ Hermes  │     │ OpenClaw │    │ Claude  │    │ Codex │
       │ runtime │     │ runtime  │    │  Code   │    │       │
       └─────────┘     └──────────┘    └─────────┘    └───────┘
```

Each runtime is a long-lived daemon on some host. It:
1. **Registers** itself with Mission Control (one POST).
2. **Heartbeats** every 30s so Mission Control marks it Online.
3. **Polls the task queue** for work assigned to it.
4. **Executes** the task and reports results back via the same API.

You manage all four from your terminal with the **Mission Control CLI**.

## Prerequisites

| Item | Why |
| ---- | --- |
| Mission Control deployment reachable on a URL | runtimes phone home here |
| **Operator login** (admin or operator role) | needed once to mint API keys |
| The Mission Control source repo on the runtime host *or* the `scripts/connect-runtime.mjs` file copied over | the daemon is one Node script |
| Node 20+ on the runtime host | to run the daemon |

## Step 1 — Point the CLI at Mission Control

On your operator workstation:

```bash
# Set the URL once, persisted to ~/.mission-control/profiles/default.json
mc config set-url --url https://mc.your-domain.com
mc login --username YOUR_OPERATOR --password YOUR_PASSWORD
mc whoami --json   # confirm role: admin or operator
```

## Step 2 — Mint a runtime API key for each runtime

Each runtime gets its **own** API key. This way you can revoke just one
without affecting the others, and the audit log shows which runtime did
what.

```bash
# Mint a key for the Hermes runtime
mc agent mint-key --id <existing_agent_id> \
                  --name "hermes-prod-1" \
                  --scopes runtime \
                  --expires-in-days 90 --yes --json
# Save the returned `api_key` value securely — it's only shown ONCE.
```

If you don't have an existing agent yet, you can let the connector
auto-register one (next step), in which case the workspace-wide
`API_KEY` env var works too — though per-runtime keys are recommended.

## Step 3 — Connect each runtime

On the **runtime host** (could be the same box or a remote VPS):

### Hermes

```bash
export MC_URL=https://mc.your-domain.com
export MC_API_KEY=mca_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
export RUNTIME_NAME=hermes-prod-1
export RUNTIME_TYPE=hermes
export RUNTIME_CAPABILITIES=execute,memory,knowledge

# Run as a daemon (or wrap in systemd / supervisor)
node /path/to/baseline-united-mission-control/scripts/connect-runtime.mjs
# → [connect-runtime] registered name=hermes-prod-1 runtime_type=hermes agent_id=N
# → [connect-runtime] heartbeating every 30000ms
```

### OpenClaw / OpenCode

```bash
export MC_URL=https://mc.your-domain.com
export MC_API_KEY=mca_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
export RUNTIME_NAME=openclaw-prod-1
export RUNTIME_TYPE=openclaw      # or `opencode` if that's the fork in use
export RUNTIME_CAPABILITIES=execute,browser
# Optional: probe the runtime's own HTTP control plane:
export RUNTIME_URL=https://openclaw.your-domain.com/health
export RUNTIME_TOKEN=$OPENCLAW_GATEWAY_TOKEN

node /path/to/baseline-united-mission-control/scripts/connect-runtime.mjs
```

### Claude Code

```bash
export MC_URL=https://mc.your-domain.com
export MC_API_KEY=mca_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
export RUNTIME_NAME=claude-code-prod
export RUNTIME_TYPE=claude
export RUNTIME_CAPABILITIES=execute,code-review,code-edit

node /path/to/baseline-united-mission-control/scripts/connect-runtime.mjs
```

### Codex

```bash
export MC_URL=https://mc.your-domain.com
export MC_API_KEY=mca_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
export RUNTIME_NAME=codex-prod
export RUNTIME_TYPE=codex
export RUNTIME_CAPABILITIES=execute,code-change

node /path/to/baseline-united-mission-control/scripts/connect-runtime.mjs
```

## Step 4 — Verify on the operator workstation

```bash
mc runtime list --json
mc agent list --json | jq '.data.agents[] | {id, name, runtime_type, last_heartbeat_at}'
mc runtime doctor --json
```

Expected: each runtime appears with a recent `last_heartbeat_at`.

## Step 5 — Send a real task end-to-end

```bash
# Assign a code-review task to the connected Claude Code runtime
mc task create \
  --title "Review src/lib/billing.ts" \
  --description "Look for missing idempotency keys." \
  --priority high \
  --assigned-to claude-code-prod --json

# From the runtime host (or your operator workstation), poll the queue:
mc queue poll --agent claude-code-prod --json
# → Task is returned and Mission Control flips status to in_progress.
```

When the runtime finishes, it should `PUT /api/tasks/<id>` with the
result. The mc-cli wrapper is:

```bash
mc task update --id 42 --body '{"status":"completed","outcome":"PR #123 opened"}' --json
```

## Step 6 — Flight Deck (optional desktop terminal)

Operators who don't want to manage URLs in shell rc files can use
**Flight Deck** — a Tauri desktop wrapper that bookmarks Mission Control
deployments.

1. Visit `https://mc.your-domain.com/flight-deck`
2. Download the artifact for your OS (Linux ARM64 ships pre-built;
   macOS / Windows / Linux-x64 require the maintainer to push a
   `flight-deck-v*` tag — see [`docs/CLI_GUIDE.md`](./CLI_GUIDE.md)).
3. Install + launch.
4. Inside Flight Deck, pick your Mission Control URL preset (Emergent /
   DigitalOcean / Localhost / Custom).
5. Sign in once. Settings persist across restarts.

Flight Deck **does not** bundle credentials — auth happens through your
normal Mission Control browser session. The desktop wrapper is purely a
URL bookmark + native window.

## Per-runtime task examples

| Runtime | Example task | What it returns |
| ------- | ------------ | --------------- |
| **Hermes** | `mc task create --title "Update memory: Q3 close summary"` | An updated workspace memory entry. |
| **OpenClaw** | `mc task create --title "Scrape this URL and summarize" --description "https://..."` | A browser-automation transcript + summary. |
| **Claude Code** | `mc task create --title "Refactor src/lib/billing.ts" --priority high` | A diff/PR proposal. |
| **Codex** | `mc task create --title "Generate migration for users.email_normalized column"` | A code change committed to a branch. |

Watch progress live:

```bash
mc events watch --types task,run --json
```

## Operations runbook

### A runtime stopped heartbeating

```bash
mc agent get --id <runtime_id> --json | jq '.data.last_heartbeat_at'
mc runtime doctor --json
# On the runtime host: check the daemon is running and the API key is valid.
```

### Reconnect / restart a runtime

`connect-runtime.mjs` is restart-safe. Just kill the process and start it
again with the same env vars — Mission Control will reuse the agent
record (idempotent on `RUNTIME_NAME`).

### Rotate a runtime API key

```bash
mc agent mint-key --id <id> --name "rotated-$(date +%s)" --scopes runtime --yes --json
# Update the runtime's env to the new key, restart the daemon.
# Revoke the old key in the Mission Control UI under Settings → Runtime API Keys.
```

### Disconnect a runtime cleanly

Stop the daemon. The agent record stays in Mission Control but its
`last_heartbeat_at` ages out. Re-running `connect-runtime.mjs` with the
same `RUNTIME_NAME` reuses the record.

To fully remove:

```bash
mc agent get --id <id> --json
mc raw --method DELETE --path /api/agents/<id> --json
```

## Auth / API key reference

| Variable | Where used | Notes |
| -------- | ---------- | ----- |
| `MC_URL` | every CLI + runtime call | base URL of Mission Control |
| `MC_API_KEY` | runtimes + CLI for automation | preferred over cookies |
| `MC_COOKIE` | CLI (set by `mc login`) | operator-only |
| `MC_WORKSPACE` | CLI (optional) | active workspace id |
| `RUNTIME_NAME` | `connect-runtime.mjs` | unique per runtime daemon |
| `RUNTIME_TYPE` | `connect-runtime.mjs` | one of: `hermes`, `openclaw`, `opencode`, `claude`, `codex` |
| `RUNTIME_URL` | `connect-runtime.mjs` (optional) | external runtime control-plane URL for probing |
| `RUNTIME_TOKEN` | `connect-runtime.mjs` (optional) | bearer for `RUNTIME_URL` probe |
| `HEARTBEAT_MS` | `connect-runtime.mjs` (optional) | default 30000 |

## What's intentionally NOT in this guide

- Configuring the underlying worker (Claude Code / Codex / OpenClaw) is
  the responsibility of that runtime's docs.
- Cluster-level deployment of Mission Control itself — see
  `docs/DEPLOYMENT-PREP.md` and `.github/workflows/deploy-digitalocean.yml`.
- Production signing of Flight Deck installers — see
  `.github/workflows/flight-deck-release.yml` plus Apple Developer ID and
  Windows code-signing certs.

## Verified proof (sandbox iteration 4)

The four-runtime round-trip below was executed end-to-end in the
Mission Control sandbox on 2026-05-31:

```text
[connect-runtime] registered name=proof-claude-runtime   runtime_type=claude   agent_id=2  new=true auth=api-key
[connect-runtime] heartbeat ok @ 2026-05-31T09:09:27Z
[connect-runtime] registered name=proof-hermes-runtime   runtime_type=hermes   agent_id=3  new=true auth=api-key
[connect-runtime] heartbeat ok @ 2026-05-31T09:09:45Z
[connect-runtime] registered name=proof-openclaw-runtime runtime_type=openclaw agent_id=4  new=true auth=api-key
[connect-runtime] heartbeat ok @ 2026-05-31T09:09:50Z
[connect-runtime] registered name=proof-codex-runtime    runtime_type=codex    agent_id=5  new=true auth=api-key
[connect-runtime] heartbeat ok @ 2026-05-31T09:09:55Z
```

Task assigned to `proof-claude-runtime`:

```text
mc task create →  id=1 status=assigned
mc queue poll  →  task=1 reason=assigned → status=in_progress
```

Full transcript: `/app/test_reports/cli_proof_run.log`.
