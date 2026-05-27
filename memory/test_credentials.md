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
**Skipped** for this iteration (user choice).
Use local `AUTH_USER` / `AUTH_PASS` path above.

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
