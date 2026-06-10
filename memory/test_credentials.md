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

## API Key (headless access + Baseline OS sync)
Configured in `/app/.env` as `API_KEY` and mirrored in `/app/baseline-os/.env.local` as `MC_API_KEY`:
```
mc_live_eba04a5e7773dc6901cb2699750c4c738ffd85ad5c33ac15
```
Use via `x-api-key` header for programmatic API calls.

## Baseline OS ↔ Mission Control sync (June 2026)
- Baseline OS console: `http://127.0.0.1:4173` (internal, started by `/app/baseline-os/launch.sh`)
- Sync loop: `mc sync push --json` every 45s (process name `baseline-os-sync-loop`, auto-started with the frontend)
- Verify: `cd /app/baseline-os && bun run scripts/mc.ts sync doctor` (bun at `/app/.bun/bin/bun`)
- MC runtime registry: `GET /api/runtime/handshake` with the `x-api-key` above

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
- External runtime URL: `https://mission-control-v8.preview.emergentagent.com`
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

## 2026-06-01 — Activation Stabilization Pass

### Customer-Zero accounts (fresh signups via /api/auth/signup)
Pattern for new test accounts:
```
POST /api/auth/signup
{
  "email": "cz_<ts>@acme.test",
  "password": "CustomerZeroPass42!!",
  "full_name": "Customer Zero",
  "company_name": "ZeroCo <ts>",
  "business_type": "pm"   // any of pm | gc | hs | bpo | re | cpa | mkt | law
}
```
The signup transaction now also seeds a default `General` project so the wizard's first `/api/tasks` call no longer 500s on a new workspace.

### Notable workspaces created during testing-agent iteration 7
- ids 5, 7, 9, 11, 13 — `cz-iter7-<ts>@example.com` / `CustomerZeroPass42!!`
- One teammate invite per workspace: `teammate-iter7@example.com` (operator role)


## 2026-05-31 — Customer Zero Browser Pass (browser-proven)
- Customer Zero (workspace 338): `cz-1780200960@example.com` / `ChangeMe!1234ABC`
- Teammate Zero (operator, workspace 338): `teammate-cz3@example.com` / `TeammatePass!1234`
- 4 runtime agents in workspace 338: `cz-hermes` (100), `cz-openclaw` (101), `cz-claude` (102), `cz-codex` (103) — each has at least one minted API key
- Gateway running locally: `127.0.0.1:8765`, agent_gateway venv at `/opt/agent-gateway-venv`
- Supervisor: `nextjs` now runs `node /app/.next/standalone/server.js` (not `next start` — which silently broke under `output: standalone`)
- Standalone runtime symlinks: `/app/.next/standalone/{.data,.env,.next/static}` → `/app/{.data,.env,.next/static}`

## 2026-05-31 — Customer Zero Production Pass (iteration_5)
- **Customer Zero (workspace 3)**: `cz-prod-1780220227@example.com` / `ChangeMe!1234ABC` (role=admin)
- Browser-proven signup → onboarding redirect succeeded.
- Workspace ID: 3, User ID: 3.
- **Teammate invite (operator)**: `teammate-cz-prod@example.com` — invite id=1 generated; accept_url returned by `/api/workspaces/3/invites`. email_status=`not_sent`, email_provider=`resend`.
- Earlier curl-only signup: `cz-prod-1780220167@example.com` / `ChangeMe!1234ABC` (workspace 2).


## 2026-05-31 — Email pipeline LIVE (iter 6)
- Resend verified domain: `baseline-agents.com` (us-east-1, status: verified)
- `MC_EMAIL_FROM=Baseline OS <onboarding@baseline-agents.com>` set in /app/.env
- Proven delivery: `POST /api/auth/forgot-password` → Resend → DELIVERED to `newmoney2217+mc1780224624@gmail.com` (Resend id 10:50:24 UTC 2026-05-31)
- Standalone env loader: `scripts/load-env.cjs` + supervisor start script now exports /app/.env into process.env at startup. Next.js standalone does not parse .env at runtime — without this, every env update after `yarn build` is invisible.

## 2026-05-31 — Stripe live (partial, iter 6)
- `STRIPE_PUBLISHABLE_KEY=[REDACTED_STRIPE_PUBLISHABLE]...` (wired)
- `STRIPE_WEBHOOK_SECRET=whsec_PIIdSKTcABY8VhpZlvMyUnr8i6f8btO4` (verified — signed HMAC accepted by /api/webhooks/stripe → 200)
- `STRIPE_WEBHOOK_ENDPOINT_ID=we_1TcfbtAu5pCrx2N64UDukzfQ`
- `NEXT_PUBLIC_STRIPE_LIVE_MODE=true`
- BLOCKED: pasted `mk_1Tcdsr...` is not a Stripe key (Stripe API: Invalid API Key). Need `sk_live_*` or `rk_live_*`.

## 2026-05-31 — Stripe Live LIVE (iter 6 close)
- `STRIPE_SECRET_KEY=[REDACTED_STRIPE_SECRET__rotate_and_store_in_.env.local]...` — validated against Stripe API. Account: acct_1TcdsmAu5pCrx2N6 (PropControl). Charges enabled, payouts enabled.
- 4 Live prices created (idempotent):
  - STARTER_MONTHLY: price_1Td7tZAu5pCrx2N6Lfe0kerY ($499/mo)
  - STARTER_ANNUAL:  price_1Td7taAu5pCrx2N6auRUz2go ($4788/yr)
  - GROWTH_MONTHLY:  price_1Td7taAu5pCrx2N69yh29yM1 ($1499/mo)
  - GROWTH_ANNUAL:   price_1Td7taAu5pCrx2N6oHGVexar ($14388/yr)
- 2 Live checkout sessions created end-to-end:
  - cs_live_a101JmMoV9dsbLMTvEHgpDz3kz2AXf2nUIDy9qACvBy2NPB87rHuLpurGV ($499)
  - cs_live_a1bWYVOmyC1i1X20at88PGiHcVsSR7t6HVvWXsNCi2xF1Mf8V4s7tGMotD ($14388)
- NEXT_PUBLIC_APP_URL=https://baseline-agents.com (required by Stripe for success/cancel URLs)
- Checkout route accepts: {plan: starter|growth, billingCycle: monthly|annual, userEmail, workspaceName}



## Customer Zero Activation Pass (created via /signup E2E on 2026-01)
Created during iteration_6 testing of the 3-step Activation Hub.

| Email | Password | Company | Business | Workspace |
|---|---|---|---|---|
| `cz-activation-1780234141@example.com` | `Password12345!` | CZ Activation Co | ai-agency | (default) |
| `cz-activation-1780234199@example.com` | `Password12345!` | CZ Activation Co | ai-agency | (default) |
| `cz-activation-1780234289@example.com` | `Password12345!` | CZ Activation Co | ai-agency | CZ Activation Workspace |

Flow verified end-to-end:
1. `POST /api/auth/signup` (full_name, email, company_name, business_type=`ai-agency`, password ≥12 chars)
2. Redirects to `/onboarding` (NOT `/app/overview`)
3. Onboarding 3 steps → `Launch AI Workforce` → `Activate Workforce →` button
4. Lands on `/app/activate?source=onboarding` with progress = 1/3, step `system=done`, `runtime=active`, `invite=pending`

## Phase 5D · AUTH_SECRET populated (Feb 2026)
- /app/.env line 29: `AUTH_SECRET=<32-byte random hex>`
- Required for: HMAC token verification on `/api/approvals/email-link`
  (Day-2 email-action approval prep).
- Generated locally via `openssl rand -hex 32`. Production deployment
  pipeline auto-rotates secrets; the value committed to /app/.env here
  is the preview-only value and is safe to overwrite on deploy.
