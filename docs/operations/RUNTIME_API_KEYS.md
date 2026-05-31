# Mission Control Runtime API Keys

This is the operator guide for connecting external runtimes (Hermes, OpenClaw,
Claude Code, Codex, the FastMCP Agent Gateway) to Mission Control **without
ever pasting a browser cookie**.

Cookies expire, get invalidated on logout, and don't survive container
restarts. Use an API key for any unattended daemon.

---

## 1. Three kinds of keys

| Kind | Scope | Source | When to use |
|---|---|---|---|
| **Agent API key** (`mca_…`) | One agent, workspace-scoped | `POST /api/agents/{id}/keys` | Production daemons (Hermes, OpenClaw) — least privilege |
| **Workspace API key** (`API_KEY` env) | Whole workspace, admin role | Set `API_KEY` in MC `.env` | Single-tenant operator hosts |
| **Session cookie** | Per-user, browser session | Sign in to MC | Manual testing only |

Always prefer agent-scoped keys for daemons. The global `API_KEY` should be
reserved for break-glass scenarios.

---

## 2. Minting an agent API key

```bash
# 1. Authenticate against MC (cookie-based, one-time interactive)
COOKIE="<value of mc-session>"

# 2. Find the agent id (or use its name in the URL — both work)
curl -s -H "Cookie: mc-session=$COOKIE" \
  https://mission.example.com/api/agents \
  | jq '.agents[] | select(.name == "hermes-prod-1") | .id'

# 3. Mint a key (scopes default to viewer + agent:self)
curl -sX POST \
  -H "Cookie: mc-session=$COOKIE" \
  -H "Content-Type: application/json" \
  -d '{"name":"hermes-prod-1-vps","scopes":["operator","agent:self","agent:heartbeat"],"expires_in_days":365}' \
  https://mission.example.com/api/agents/hermes-prod-1/keys
```

Response:

```json
{
  "key": {"id": 7, "key_prefix": "mca_4c8a3f12", "scopes": ["operator", "agent:self", "agent:heartbeat"]},
  "api_key": "mca_4c8a3f12<48 more hex chars>"
}
```

**`api_key` is shown ONCE.** Copy it to the runtime host immediately.

To revoke:

```bash
curl -sX DELETE -H "Cookie: mc-session=$COOKIE" \
  -H "Content-Type: application/json" \
  -d '{"key_id": 7}' \
  https://mission.example.com/api/agents/hermes-prod-1/keys
```

---

## 3. Connecting a runtime with `MC_API_KEY`

```bash
MC_URL=https://mission.example.com \
MC_API_KEY=mca_4c8a3f12...  \
RUNTIME_NAME=hermes-prod-1 \
RUNTIME_TYPE=hermes \
RUNTIME_URL=http://127.0.0.1:18789 \
RUNTIME_CAPABILITIES=delegate,execute \
node /app/scripts/connect-runtime.mjs
```

Expected output:

```
[connect-runtime] registered name=hermes-prod-1 runtime_type=hermes agent_id=55 new=false auth=api-key
[connect-runtime] heartbeat ok @ 2026-02-14T03:11:54.812Z  probe=alive  auth=api-key
[connect-runtime] heartbeating every 30000ms — auth=api-key — Ctrl+C to stop
```

### systemd unit (production)

```ini
# /etc/systemd/system/mc-connector-hermes.service
[Unit]
Description=Mission Control connector — hermes-prod-1
After=network-online.target hermes.service

[Service]
Type=simple
EnvironmentFile=/etc/mission-control/hermes.env  # MC_URL, MC_API_KEY, RUNTIME_*
ExecStart=/usr/bin/node /opt/baseline/scripts/connect-runtime.mjs
Restart=always
RestartSec=10
User=mc

[Install]
WantedBy=multi-user.target
```

Set restrictive permissions:

```bash
sudo chmod 600 /etc/mission-control/hermes.env
sudo chown mc:mc /etc/mission-control/hermes.env
```

---

## 4. Verifying the connection

From any browser session on Mission Control:

```
Runtime Registry → look for hermes-prod-1
  connection_status: connected
  last_heartbeat_at: <unix>
  seconds_since_heartbeat: <30
```

Or curl:

```bash
curl -s -H "x-api-key: $MC_API_KEY" \
  https://mission.example.com/api/agent-runtimes \
  | jq '.registered[] | select(.name == "hermes-prod-1")'
```

---

## 5. Connecting the FastMCP Agent Gateway

The gateway uses the same API key plumbing — set `MC_API_KEY` in its `.env`:

```bash
# /opt/baseline/agent-gateway/.env
MC_URL=https://mission.example.com
MC_API_KEY=mca_4c8a3f12...
GATEWAY_WORKSPACE_ID=1
ENABLED_AGENTS=claude,codex,opencode,hermes
```

Then start it (`agent-gateway` from the `baseline-agent-gateway` package).
It registers itself as `agent-gateway-<hostname>` and heartbeats every
`MC_REPORT_INTERVAL_SECS` (default 15s) by re-handshaking the registry.

Health probe (no auth required):

```bash
curl -s http://127.0.0.1:8765/health
```

From Mission Control:

```bash
curl -s -H "x-api-key: $MC_API_KEY" \
  https://mission.example.com/api/agent-gateway/health
```

---

## 6. Common failures

| Symptom | Root cause | Fix |
|---|---|---|
| `register failed: 401` | Wrong key or revoked | Mint a new agent key, paste it into env, re-run |
| `register failed: 403` | Scopes too narrow | Re-mint with `operator` + `agent:self` + `agent:heartbeat` |
| `heartbeat ok` but registry shows `disconnected` | Wrong workspace_id | The user that minted the key must be in the same workspace as the agent record |
| Connector exits cleanly then disconnects after a restart | Cookie auth in env | Replace `MC_SESSION` with `MC_API_KEY` and use an agent key |

---

## 7. Security defaults

- Keys are stored as `sha256(rawKey)` in `agent_api_keys.key_hash`. The plaintext is only ever returned at mint time and never logged.
- Each use bumps `last_used_at` (visible in the Admin → API Keys panel).
- Revocation is single-row `UPDATE`, takes effect on the next request.
- The connector mirrors the key onto both `x-api-key` and `Authorization: Bearer` so it survives strip-headers proxies.
- The proxy gate in `src/proxy.ts` recognises any `mca_<48 hex>` prefix and forwards it to route auth without leaking it cross-route.
