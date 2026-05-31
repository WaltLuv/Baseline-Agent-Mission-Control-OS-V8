# Test Credentials — Mission Control v3.0

> Local dev / Emergent sandbox only. Not for production.

## Admin (local AUTH_USER / AUTH_PASS path)
- **Username:** `admin`
- **Password:** `admin12345`
- **Role:** `admin`
- **Workspace ID:** `1`
- **Tenant ID:** `1`

Configured in `/app/.env`:
```
AUTH_USER=admin
AUTH_PASS=admin12345
NEXT_PUBLIC_GATEWAY_OPTIONAL=true
```

## API Key (auto-generated, headless access)
Stored in `/app/.data/.auto-generated` after the first DB init.
Use via `x-api-key` header for programmatic API calls.

## Stripe
**Mock / test mode** — no live keys configured.
`src/app/api/stripe/checkout/route.ts` returns a mock session when `STRIPE_SECRET_KEY` is unset.

## Google Sign-In
**Credentials configured** in `/app/.env` (popup/GIS flow via `POST /api/auth/google`).
- `GOOGLE_CLIENT_ID` / `NEXT_PUBLIC_GOOGLE_CLIENT_ID` = `271101705254-75q3pv36d1v7ogasnr9ccd8g7slldb2b.apps.googleusercontent.com`
- `GOOGLE_CLIENT_SECRET` = `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` (reserved for future server-side OAuth-code flow)
- `GOOGLE_REDIRECT_URI` = `https://baseline-agents.com/api/auth/google/callback`
- GCP Console **Authorized JavaScript origins** must include `https://baseline-agents.com` for the popup flow to work.

Local fallback: use `AUTH_USER` / `AUTH_PASS` above.

## OpenClaw runtime (verified live)
- External runtime URL: `https://keen-matsumoto-2.preview.emergentagent.com`
- WebSocket: `wss://keen-matsumoto-2.preview.emergentagent.com/api/openclaw/ws`
- Gateway token: `aee22098773e796a3fdf9bf1f3660a0635a08fdf7f3241add58714ceb549fd16`
- Connector script: `/app/scripts/connect-runtime.mjs` — now supports BOTH `MC_SESSION` (cookie) AND `MC_API_KEY` (header `x-api-key`).
- Verified registered: agent `openclaw-prod-1` (id=48, workspace_id=1) on 2026-05-30.

## FastMCP Agent Gateway (Feb 2026 pass)
- Local control plane: `http://127.0.0.1:8765`
- `/health` (open), `/v1/agents` (open), `/v1/tasks`, `/v1/tasks/{id}`, `/v1/logs/{id}` (gated by `MC_API_KEY`)
- Mission Control proxy: `/api/agent-gateway/{health,tasks,tasks/[id],logs/[id]}`
- Mission Control env:
  ```
  AGENT_GATEWAY_URL=http://127.0.0.1:8765
  AGENT_GATEWAY_API_KEY=<same value as gateway's MC_API_KEY>
  ```
- Install: `python3 -m venv /opt/agent-gateway-venv && /opt/agent-gateway-venv/bin/pip install -e /app/services/agent-gateway`
- Run: `/opt/agent-gateway-venv/bin/agent-gateway --host 127.0.0.1 --port 8765`
- Supervisor template: `/app/scripts/supervisor.agent-gateway.conf`

## Runtime API keys (preferred for daemons)
- Mint: `POST /api/agents/{id}/keys { name, scopes, expires_in_days }` → returns `api_key: "mca_<48 hex>"` ONCE.
- Use: connect-runtime.mjs reads `MC_API_KEY` env and sends both `x-api-key:` and `Authorization: Bearer`.
- Verified live this pass: agent id 92 (`runtime-test-1`) registered + heartbeated using ONLY the API key, no cookie.

## Quick login (cookie session)
```
curl -c /tmp/cookies.txt -X POST http://127.0.0.1:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"admin12345"}'
```

## Example: charge tokens (verifies the billing pipeline)
```
curl -b /tmp/cookies.txt -X POST http://127.0.0.1:3000/api/tokens \
  -H 'Content-Type: application/json' \
  -d '{"model":"anthropic/claude-sonnet-4","sessionId":"agent:chat",
       "inputTokens":10000,"outputTokens":5000,
       "provider":"openrouter","agentId":1,"idempotencyKey":"test-001"}'
```

## 2026-05-31 — Customer Zero Browser Pass (browser-proven)
- Customer Zero (workspace 338): `cz-1780200960@example.com` / `ChangeMe!1234ABC`
- Teammate Zero (operator, workspace 338): `teammate-cz3@example.com` / `TeammatePass!1234`
- 4 runtime agents in workspace 338: `cz-hermes` (100), `cz-openclaw` (101), `cz-claude` (102), `cz-codex` (103) — each has at least one minted API key
- Gateway running locally: `127.0.0.1:8765`, agent_gateway venv at `/opt/agent-gateway-venv`
- Supervisor: `nextjs` now runs `node /app/.next/standalone/server.js` (not `next start` — which silently broke under `output: standalone`)
- Standalone runtime symlinks: `/app/.next/standalone/{.data,.env,.next/static}` → `/app/{.data,.env,.next/static}`
