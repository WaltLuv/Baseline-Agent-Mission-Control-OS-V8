# Production Deploy Checklist — Mission Control

**Stack:** Next.js 16 standalone · better-sqlite3 · pnpm. **Run:** `node .next/standalone/server.js`.

## Environment / secrets (set in prod env, never committed)
- [ ] `AUTH_SECRET`, `API_KEY` (auto-generated on first run; set explicitly in prod)
- [ ] `MISSION_CONTROL_DATA_DIR` (persistent volume for the SQLite DB)
- [ ] `AUTH_USER` / `AUTH_PASS_B64` (headless admin seed) OR create admin via `/setup`
- [ ] `MC_COOKIE_SECURE=true`, `MC_ALLOWED_HOSTS=<your-domain>` (no wildcards)
- [ ] Comms (live): `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER`, `RESEND_API_KEY`+`RESEND_FROM` — see LIVE_COMMS_SETUP.md
- [ ] Stripe (billing payments): **not yet wired** — ledger works; payment capture = follow-up

## Database
- [ ] Persistent volume mounted at `MISSION_CONTROL_DATA_DIR`
- [ ] Migrations run automatically on boot (forward-only, 076 applied); verify "migrations applied" log
- [ ] Backups: schedule a periodic copy of `<DATA_DIR>/mission-control.db`

## Email verification
- [ ] Verify signup → /verify-email flow with a real email provider (Resend/SMTP)

## Domain / SSL / serving
- [ ] Domain + TLS (platform-managed or reverse proxy)
- [ ] `NEXT_PUBLIC_GATEWAY_OPTIONAL=true` for standalone without gateway
- [ ] Health check: `GET /api/health` (200)

## Rollback / logging / monitoring
- [ ] Tag each release; rollback = redeploy previous image + restore DB backup
- [ ] App logs shipped to your platform's log drain
- [ ] Uptime monitor on `/api/health`

## Smoke tests (post-deploy)
- [ ] `/` → 200 · `/login` → 200 · `/api/health` → 200
- [ ] Signup → verify → login → install PM workforce → run a maintenance request → approve → see proof/replay
- [ ] Auth: unauthenticated `/api/*` → 401; `/app/*` → redirect to login

## Status
Builds clean (standalone). **Not yet executed against a real host** — Deployment grade = YELLOW until a verified prod deploy + smoke pass.
