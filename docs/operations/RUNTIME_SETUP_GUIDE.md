# Runtime Setup Guide

How to connect Hermes, OpenClaw, Claude Code, and Codex to Mission Control —
**without a browser cookie**.

This is the guide a non-developer customer can follow.

---

## What a "runtime" is

A runtime is a process that actually executes AI work — running a CLI agent
(`claude`, `codex`, `opencode`) or a service (`hermes`). Mission Control
**supervises** runtimes; it does not host them.

You can have runtimes in three places:
1. On your laptop (for development / personal use)
2. On a VPS / cloud server (production daemons)
3. In a Docker container alongside Mission Control (single-host deploy)

All three connect to Mission Control the same way: with an **MC_API_KEY**.

---

## Step 1 — Mint an API key in Mission Control

1. Sign in to Mission Control as a workspace **admin**.
2. Pick a runtime to represent (or click **Add runtime** if it doesn't exist):
   - **Hermes** — orchestration / delegation
   - **OpenClaw** — browser & tool agents
   - **Claude Code** — code intelligence (the `claude` CLI)
   - **Codex** — implementation / coding (the `codex` CLI)
3. Open **API keys** for that runtime → **Create**.
4. Set:
   - `name` — what is this key for? (e.g. "vps-1-hermes")
   - `scopes` — leave defaults: `operator`, `agent:self`, `agent:heartbeat`
   - `expires_in_days` — 365 is fine for production
5. **Copy the `mca_…` key** — it's shown once. If you lose it, revoke and re-mint.

---

## Step 2 — Run the connector

The connector is a single 4 KB script. It speaks **registry → heartbeat** and
nothing else. No business logic. No payload. Pure plumbing.

### Quickest test (any machine with Node 18+)

```bash
git clone https://github.com/<your-org>/mission-control.git
cd mission-control

MC_URL=https://your-mission-control.example.com \
MC_API_KEY=mca_your_key_here \
RUNTIME_NAME=hermes-prod-1 \
RUNTIME_TYPE=hermes \
node scripts/connect-runtime.mjs
```

You'll see:

```
[connect-runtime] registered name=hermes-prod-1 runtime_type=hermes agent_id=55 new=false auth=api-key
[connect-runtime] heartbeat ok @ 2026-02-14T03:11:54Z  probe=alive  auth=api-key
[connect-runtime] heartbeating every 30000ms — auth=api-key — Ctrl+C to stop
```

In Mission Control: open `/app/runtime-validation` (or anywhere the runtime
registry is rendered). Your runtime appears within 30s as **connected**.

### Per-runtime hints

| Runtime | `RUNTIME_TYPE` | Probe URL (optional, recommended) |
|---|---|---|
| Hermes | `hermes` | `http://127.0.0.1:7777/health` (or whatever you set `HERMES_URL` to) |
| OpenClaw | `openclaw` | `http://127.0.0.1:18789` |
| Claude Code | `claude` | omit — claude is a CLI, not a server |
| Codex | `codex` | omit — codex is a CLI, not a server |

The probe URL is **optional**. With it set, the connector pings the runtime
before each heartbeat and tells MC if the runtime is dead even though the
connector is alive.

---

## Step 3 — Run as a real service (production)

### systemd (Linux)

```ini
# /etc/systemd/system/mc-connector-hermes.service
[Unit]
Description=Mission Control connector — hermes
After=network-online.target hermes.service

[Service]
Type=simple
EnvironmentFile=/etc/mission-control/hermes.env
ExecStart=/usr/bin/node /opt/baseline/scripts/connect-runtime.mjs
Restart=always
RestartSec=10
User=mc

[Install]
WantedBy=multi-user.target
```

Where `/etc/mission-control/hermes.env` contains (chmod 600):

```
MC_URL=https://your-mission-control.example.com
MC_API_KEY=mca_your_key_here
RUNTIME_NAME=hermes-prod-1
RUNTIME_TYPE=hermes
RUNTIME_URL=http://127.0.0.1:7777/health
```

Then:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now mc-connector-hermes.service
sudo systemctl status mc-connector-hermes.service
```

### Docker / Docker Compose

```yaml
mc-connector:
  image: node:22-alpine
  restart: unless-stopped
  command: node /scripts/connect-runtime.mjs
  volumes:
    - ./scripts/connect-runtime.mjs:/scripts/connect-runtime.mjs:ro
  environment:
    MC_URL: https://your-mission-control.example.com
    MC_API_KEY: ${MC_API_KEY}
    RUNTIME_NAME: hermes-prod-1
    RUNTIME_TYPE: hermes
```

---

## Step 4 — Verify in Mission Control

Open `/app/runtime-validation`. You should see:

```
hermes-prod-1
runtime_type: hermes
connection_status: connected
last_heartbeat_at: <Unix timestamp ≤30s ago>
seconds_since_heartbeat: <number ≤30>
```

Or via API:

```bash
curl -s -H "x-api-key: $MC_API_KEY" \
  https://your-mission-control.example.com/api/agent-runtimes \
  | jq '.registered[] | select(.name == "hermes-prod-1")'
```

---

## Step 5 — Survive restart / refresh

| What happens | What MC sees |
|---|---|
| You refresh the Mission Control page | Runtime stays `connected` — heartbeats are independent |
| You restart the connector | Re-registers on boot (idempotent) → still `connected` |
| You stop the connector for 90s | `connected` → `stale` |
| You stop the connector for 7.5 min | `stale` → `disconnected` |
| You restart it | Back to `connected` within 30s |

---

## Failure matrix

| Symptom | Root cause | Fix |
|---|---|---|
| `register failed: 401` | Wrong key, revoked, or expired | Mint a new key. Don't use the old one. |
| `register failed: 403` | Scopes missing `agent:heartbeat` | Mint with `["operator","agent:self","agent:heartbeat"]` |
| `register failed: 429` | Too many registers in 1 minute from same IP | Slow your boot loop — daemon should register once and heartbeat, not register per heartbeat |
| `heartbeat ok` but registry says `disconnected` | Workspace mismatch | The key was minted by an admin in workspace X but you set `RUNTIME_NAME` to an agent in workspace Y. Use a key minted in the right workspace. |
| Connector keeps registering "new=true" each restart | You renamed `RUNTIME_NAME` between runs | Names are workspace-unique. Keep `RUNTIME_NAME` stable. |
| Auth rejected after a working week | Key expired | Re-mint with longer `expires_in_days` |

---

## Security defaults you don't need to think about

- Keys are stored as `sha256(rawKey)`. The plaintext is shown once, never again.
- The connector sends the key on **both** `x-api-key` and `Authorization: Bearer` headers so strip-headers proxies (Cloudflare, GCP LB) can't break the auth path.
- Revocation is single-row UPDATE — effective on the next request.
- A workspace owner who leaves the company is automatically removed from `agent_api_keys.created_by`; revoke their keys via the UI.
- The connector never logs your key (`${KEY:0:14}…` prefix only).
