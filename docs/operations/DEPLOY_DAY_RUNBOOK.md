# Mission Control v3 — Operator Deploy Day Runbook

> The single page an operator follows to take Mission Control from
> "image built" to "prospects opening signed demo links on the
> production domain." Every step has a verification command. Every
> failure has a rollback.

Estimated wall-clock: **45 minutes**.

---

## ✅ Pre-flight (do this once, before deploy day)

```bash
# 0. Generate every secret you'll need (copy into a password manager)
openssl rand -hex 32         # AUTH_SECRET
openssl rand -hex 32         # SHARE_SIGNING_SECRET
openssl rand -hex 16         # API_KEY
openssl rand -base64 32 | tr -dc 'A-Za-z0-9' | head -c 32   # AUTH_PASS

# 1. Build .env.production locally (NEVER commit)
cat > .env.production <<EOF
AUTH_USER=admin
AUTH_PASS=<paste>
AUTH_SECRET=<paste>
API_KEY=<paste>
SHARE_SIGNING_SECRET=<paste>
MC_HOST=mission.example.com
MC_DOMAIN_ZONE=example.com
MC_ALLOWED_HOSTS=mission.example.com
MC_COOKIE_SECURE=1
MC_COOKIE_SAMESITE=strict
MC_ENABLE_HSTS=1
OPENCLAW_GATEWAY_HOST=127.0.0.1
OPENCLAW_GATEWAY_PORT=18789
STRIPE_SECRET_KEY=sk_live_...   # or leave unset → mock mode
STRIPE_WEBHOOK_SECRET=whsec_...
EOF

# 2. Preflight — fails fast on insecure defaults
./scripts/preflight-production.sh .env.production
# → PASS lines for every required var; zero FAILs
```

---

## ✅ DNS checklist

Before pointing the domain, you need:

- [ ] An A record `mission.example.com → <DO App static IP>` (DO will hand
      you one after the first deploy). Or, easier:
- [ ] A CNAME `mission.example.com → ondigitalocean.app` (DO App
      Platform terminates TLS automatically).
- [ ] CAA records, if you use them, must allow Let's Encrypt:
      `0 issue "letsencrypt.org"`.
- [ ] `dig +short mission.example.com` returns the DO endpoint.

Verification:

```bash
dig +short mission.example.com
# Expect: <something>.ondigitalocean.app  OR  <DO IP>
```

---

## ✅ Secrets checklist (DigitalOcean App env)

For each of these, paste into DO App → Settings → web component →
Environment variables → type `SECRET`:

- [ ] `AUTH_USER`
- [ ] `AUTH_PASS`
- [ ] `AUTH_SECRET`
- [ ] `API_KEY`
- [ ] `SHARE_SIGNING_SECRET`
- [ ] `MC_ALLOWED_HOSTS`
- [ ] `STRIPE_SECRET_KEY`        (only if billing in live mode)
- [ ] `STRIPE_WEBHOOK_SECRET`    (only if billing in live mode)

Non-secret env (paste as plain values — `.do/app.yaml` already
references them):

- [ ] `MC_HOST`
- [ ] `MC_DOMAIN_ZONE`
- [ ] `MC_COOKIE_SECURE=1`
- [ ] `MC_COOKIE_SAMESITE=strict`
- [ ] `MC_ENABLE_HSTS=1`

GitHub repo Secrets (for the deploy workflow):

- [ ] `DIGITALOCEAN_ACCESS_TOKEN` (Settings → API → Personal Access
      Tokens; full account scope is fine for v1)
- [ ] `DIGITALOCEAN_APP_ID` (captured below, after first
      `doctl apps create`)
- [ ] `MC_HOST` (same value as DO env)

---

## ✅ First deploy

```bash
# 1. Make sure the image is published (CI does this on push to main)
git push origin main          # → Quality Gate → Docker Publish → GHCR

# 2. Create the DO app from the spec (FIRST DEPLOY ONLY)
doctl apps create --spec .do/app.yaml
# → outputs APP_ID. Save it as DIGITALOCEAN_APP_ID in GitHub secrets.

# 3. Subsequent deploys are automatic on every push to main.
```

Watch the build:

```bash
APP_ID=<paste>
doctl apps list-deployments $APP_ID
doctl apps logs $APP_ID --follow --type=build
```

---

## ✅ Health verification

The deploy workflow polls this for ~150s and auto-rolls back on
failure. You should still verify manually after the first deploy.

```bash
# 1. Health endpoint
curl -fsS "https://$MC_HOST/api/status?action=health" | jq .
# → {"status":"healthy", ...}

# 2. Login round-trip
curl -s -c /tmp/c.txt -X POST "https://$MC_HOST/api/auth/login" \
  -H 'Content-Type: application/json' \
  -d "{\"username\":\"$AUTH_USER\",\"password\":\"$AUTH_PASS\"}" -w '\n%{http_code}\n'
# → 200

# 3. Mint a demo share link
TOKEN=$(curl -s -b /tmp/c.txt -X POST "https://$MC_HOST/api/demo-share" \
  -H 'Content-Type: application/json' \
  -d '{"vertical":"cpa","ttlDays":1,"tour":true,"watermark":true}' \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")

# 4. Verify the redeem URL hands out a guest cookie
curl -s -i "https://$MC_HOST/api/demo-share/redeem?token=$TOKEN" | head -20
# → 302 to /app?demo=cpa, Set-Cookie: mc_demo_guest=...
```

---

## ✅ Runtime validation

Once at least one of `Hermes`, `OpenClaw/OpenCode`, or `Claude Code`
is connected, exercise the full 5-flow contract:

```bash
./scripts/runtime-validate.sh \
  --base-url "https://$MC_HOST" \
  --auth-user "$AUTH_USER" --auth-pass "$AUTH_PASS" \
  --runtime hermes        # then: openclaw, claude
```

Expected output for each runtime (one line per stage):

```
PASS  login as <user>
PASS  register agent → id=<n>
PASS  heartbeat 200
PASS  task transitions ...
PASS  billing idempotent (1st=200, 2nd=409|200)
PASS  telemetry session:start / session:end
PASS  cleanup agent <n>
```

If any stage FAILs, the harness dumps the HTTP response. Read it,
fix the runtime config (not Mission Control), and re-run.

A captured proof from the staging preview lives in
`docs/operations/proofs/runtime-validation-*.txt` — keep one in your
launch ticket as the supervision baseline.

---

## ✅ Stripe (if billing live)

- [ ] Stripe Dashboard → Webhooks → Add endpoint:
      `https://$MC_HOST/api/stripe/webhook`
- [ ] Subscribe events: `checkout.session.completed` and
      `checkout.session.async_payment_succeeded`
- [ ] Copy the signing secret to DO env as `STRIPE_WEBHOOK_SECRET`,
      redeploy
- [ ] Run one $1 token-pack end-to-end. Verify ledger credit.
- [ ] Replay the webhook from Stripe Dashboard. Verify **no
      double-credit** (idempotency check).

---

## ✅ Backups

- [ ] Cron the daily SQLite `.backup` from
      `docs/operations/BACKUP_RESTORE.md`.
- [ ] One **test restore** against a staging app — required before
      declaring launch complete.

---

## ⚠️ Rollback (if anything goes red)

The deploy workflow rolls back automatically when the health probe
fails for ~150s. Manual rollback paths:

```bash
# A. Re-pin the previous good image tag
doctl apps list-deployments $APP_ID
doctl apps update $APP_ID --spec .do/app.yaml --wait \
  --image-tag sha-<previous-good>

# B. Revert the commit and push
git revert <bad-sha> && git push origin main

# C. Rotate the share secret if it leaked (kills all live demo links)
#    → DO App env → SHARE_SIGNING_SECRET = $(openssl rand -hex 32)
```

Detail in `docs/operations/ROLLBACK.md`.

---

## ✅ Launch readiness gate (the actual definition of "ready")

You are launch-ready when, in a clean incognito window with no
cookies:

1. ☐ `https://$MC_HOST/api/status?action=health` returns
   `"status":"healthy"`.
2. ☐ A signed demo link minted from `/app/share?vertical=cpa&prospect=Acme`
   opens directly in the guided demo without a login wall.
3. ☐ The watermark reads
   `DEMO WORKSPACE FOR ACME · BASELINE OS · NO LIVE CUSTOMER DATA`.
4. ☐ At least one runtime (Hermes / OpenClaw / Claude Code) passes
   the validation harness.
5. ☐ `/app/runtime-validation` shows a green band for that runtime.
6. ☐ The same link, opened tomorrow, is still valid (TTL > 1 day).
7. ☐ Rotating `SHARE_SIGNING_SECRET` instantly invalidates the link.

When all seven are green, post the launch link.

---

## Quick reference — verticals available at launch

| Vertical | Slug | COO Briefing teaser |
|----------|------|---------------------|
| Property Management | `pm` | "Quiet morning, two doors making noise." |
| General Contractor | `gc` | "Two bids signed overnight. One conflict needs you." |
| Home Services | `home-services` | "Booked 17 calls overnight. One emergency." |
| Real Estate | `real-estate` | "18 Westwood under contract. Two listings need pricing strategy." |
| Mortgage | `mortgage` | "Six loans funded this month. One appraisal came in low." |
| CPA / Accounting | `cpa` | "Tax season pressure is dropping. One reconciliation needs you." |
| Law Firm | `law-firm` | (See `src/lib/demo-narratives.ts`) |
| Marketing Agency | `marketing-agency` | (See `src/lib/demo-narratives.ts`) |
| AI Agency | `ai-agency` | (See `src/lib/demo-narratives.ts`) |

The Cigar Lounge / Local Retail template ships in the Workforce
Dashboard now; its full demo narrative is the first item on the
post-launch backlog.
