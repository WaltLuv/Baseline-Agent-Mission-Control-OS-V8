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
- Connector script: `/app/scripts/connect-runtime.mjs` (requires `MC_SESSION` cookie from admin login)
- Verified registered: agent `openclaw-prod-1` (id=48, workspace_id=1) on 2026-05-30.

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
