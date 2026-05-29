# Mission Control v3 — Production Launch Checklist

> One page. One pass. Walks an operator from "we built it" to "we run it."

---

## 0. Prerequisites
- [ ] Domain owned and DNS access available
- [ ] DigitalOcean account with billing enabled
- [ ] GitHub repository admin access (for secrets)
- [ ] Stripe account (live mode) **or** decision to launch in mock billing

---

## 1. Secrets (generate locally, never commit)

```bash
# Strong random values — copy each into the DO App env later
openssl rand -hex 32         # AUTH_SECRET
openssl rand -hex 32         # SHARE_SIGNING_SECRET
openssl rand -hex 16         # API_KEY
openssl rand -base64 32 | tr -dc 'A-Za-z0-9' | head -c 32   # AUTH_PASS
```

| Secret | Where it goes | Notes |
|--------|---------------|-------|
| `AUTH_USER` | DO App env | Default `admin` |
| `AUTH_PASS` | DO App env | 32+ chars, no quotes |
| `AUTH_SECRET` | DO App env | Used to sign sessions |
| `API_KEY` | DO App env | Headless API access |
| `SHARE_SIGNING_SECRET` | DO App env | HMAC for demo-share tokens |
| `STRIPE_SECRET_KEY` | DO App env | `sk_live_...` for real billing |
| `STRIPE_WEBHOOK_SECRET` | DO App env | `whsec_...` from Stripe → Webhooks |
| `DIGITALOCEAN_ACCESS_TOKEN` | GitHub repo Secrets | Used by deploy workflow |
| `DIGITALOCEAN_APP_ID` | GitHub repo Secrets | After first `doctl apps create` |
| `MC_HOST` | GitHub repo Secrets + DO env | e.g. `mission.example.com` |
| `MC_DOMAIN_ZONE` | DO App env | e.g. `example.com` |

---

## 2. Production env lockdown

`.do/app.yaml` already sets these — verify they remain non-empty:

| Variable | Value | Why |
|----------|-------|-----|
| `NODE_ENV` | `production` | Strict CSP + cookie defaults |
| `MC_ALLOWED_HOSTS` | `<your domain>` | Host allowlist enforced (no wildcards in prod) |
| `MC_COOKIE_SECURE` | `1` | Cookies marked `Secure` |
| `MC_COOKIE_SAMESITE` | `strict` | CSRF defense |
| `MC_ENABLE_HSTS` | `1` | HSTS preload |
| `MC_ALLOW_ANY_HOST` | **unset** | Must not be set — fails preflight if present |
| `OPENCLAW_GATEWAY_HOST` | `127.0.0.1` | Gateway must remain local — never publicly exposed |

Run the preflight before the first deploy:

```bash
./scripts/preflight-production.sh .env.production
```

---

## 3. First deploy

```bash
# 1. Build + publish the image (CI does this on push to main)
git push origin main         # triggers Quality Gate → Docker Publish

# 2. Create the DO app (only the first time)
doctl apps create --spec .do/app.yaml

# 3. Capture the App ID and put it in GitHub repo secrets as DIGITALOCEAN_APP_ID

# 4. Subsequent deploys are automatic on push to main
```

After deploy completes:

- [ ] `curl https://<MC_HOST>/api/status?action=health` returns `200`
- [ ] Browser login at `/login` with `AUTH_USER`/`AUTH_PASS`
- [ ] `/marketplace` and `/roi-calculator` reachable unauthenticated
- [ ] Mint a demo share link → open in incognito → Guided Demo opens

---

## 4. Stripe in production

- [ ] In Stripe Dashboard → Webhooks: add `https://<MC_HOST>/api/stripe/webhook`
- [ ] Subscribe events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`
- [ ] Copy webhook signing secret to DO env as `STRIPE_WEBHOOK_SECRET`
- [ ] Run one real $1 token-pack purchase end-to-end — verify ledger credit
- [ ] Verify replay-safe idempotency (re-send the webhook → no double credit)

---

## 5. Backups

DigitalOcean App Platform volumes are not auto-snapshotted. We back up the
SQLite DB out of the running container.

- [ ] Cron a daily backup runner (see `docs/operations/BACKUP_RESTORE.md`)
- [ ] Verify a restore on a staging app at least once before launch

---

## 6. Monitoring

- [ ] DO Alerting: `DEPLOYMENT_FAILED`, `DEPLOYMENT_LIVE`, `DOMAIN_FAILED` (set in `.do/app.yaml`)
- [ ] Bookmark `/api/status?action=health` and the Mission Control
      **System Monitor** panel
- [ ] First week: tail logs daily via `doctl apps logs <APP_ID> --follow --type=run`

---

## 7. Runtime validation

For each runtime your AI workforce uses, run the harness once after launch:

```bash
# Hermes
./scripts/runtime-validate.sh --runtime hermes --base-url https://<MC_HOST>

# OpenClaw / OpenCode
./scripts/runtime-validate.sh --runtime openclaw --base-url https://<MC_HOST>

# Claude Code
./scripts/runtime-validate.sh --runtime claude --base-url https://<MC_HOST>
```

The harness exercises **registration → heartbeat → task update → billing
report → telemetry** and prints PASS/FAIL per stage.

See `docs/operations/RUNTIME_VALIDATION.md` for the full integration spec.

---

## 8. Rollback

Production deploys are blue-green within the DO app. If health-check fails
the workflow auto-rolls back. Manual rollback:

```bash
doctl apps list-deployments <APP_ID>
doctl apps create-deployment <APP_ID> --force-rebuild=false \
     --image-tag sha-<previous-good>
```

Detail: `docs/operations/ROLLBACK.md`.

---

## 9. Launch readiness

Mission Control is launch-ready when:

- [ ] All checkboxes above are ticked
- [ ] `pnpm test` is 100% green on the deploy SHA
- [ ] One **real** demo share link has been opened end-to-end by a stranger
      (incognito, no cookies) — confirms the watermark + guest cookie flow
      works on the production domain
- [ ] One **real** Stripe purchase has been settled and reconciled

Ship it.
