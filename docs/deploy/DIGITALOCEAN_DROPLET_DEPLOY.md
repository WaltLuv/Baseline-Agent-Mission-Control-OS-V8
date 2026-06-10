# Deploying Mission Control to a DigitalOcean Droplet

**Chosen path:** Droplet + Docker Compose + a persistent Block Storage volume, with
Caddy for automatic HTTPS. SQLite data lives on the attached volume and survives
container redeploys, restarts, and droplet rebuilds.

**Why not App Platform?** Mission Control stores all production data in SQLite
(`/app/.data/mission-control.db`). App Platform has an **ephemeral filesystem** —
the DB would be wiped on every deploy/restart. App Platform only becomes viable
**after** migrating to managed Postgres (see [§9](#9-future-path-postgres--app-platform)).

---

## 0. What you need

- A DigitalOcean account + project
- A domain you can point at the droplet (for HTTPS via Let's Encrypt)
- The repo: `github.com/WaltLuv/Baseline-Agent-Mission-Control-OS-V8`
- Your production secrets (Stripe, Resend, Twilio, Google OAuth, etc.)

**Recommended droplet:** Ubuntu 24.04 LTS, Basic plan, **2 GB RAM / 1 vCPU**
(`s-1vcpu-2gb`, ~$12/mo). 1 GB works but the Next build is tight — 2 GB is safer.

---

## 1. Create the droplet + volume

In the DO console (or `doctl`):

1. **Create → Droplet** → Ubuntu 24.04 → Basic → 2 GB. Add your SSH key.
2. **Create → Volume** (Block Storage), e.g. **10 GB**, in the **same region**,
   and attach it to the droplet. DO auto-mounts it at `/mnt/<volume-name>`
   (e.g. `/mnt/mc_data`). Confirm with `df -h | grep mnt`.

This volume is where the SQLite DB and backups live — it is the durable layer.

---

## 2. Install Docker + tools (one-time, on the droplet)

```bash
ssh root@<DROPLET_IP>

# Docker Engine + compose plugin
curl -fsSL https://get.docker.com | sh

# sqlite3 CLI (needed for safe online backups), git, ufw
apt-get update && apt-get install -y sqlite3 git ufw

# Firewall: allow SSH + HTTP + HTTPS only
ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw --force enable
```

---

## 3. Get the code

```bash
git clone https://github.com/WaltLuv/Baseline-Agent-Mission-Control-OS-V8.git /opt/mission-control
cd /opt/mission-control
git checkout main
```

---

## 4. Create the production env file (secrets stay on the server)

```bash
cp .env.production.example .env.production
nano .env.production        # fill every CHANGE_ME
chmod 600 .env.production    # owner-only; never committed
```

Generate the secret values:

```bash
openssl rand -hex 32   # AUTH_SECRET, NEXTAUTH_SECRET, SHARE_SIGNING_SECRET, CREDENTIALS_ENCRYPTION_KEY
openssl rand -hex 16   # API_KEY
```

Set at minimum: `MC_HOST`, `APP_URL`/`NEXT_PUBLIC_APP_URL`/`MC_PUBLIC_BASE_URL`,
`MC_ALLOWED_HOSTS`, `AUTH_*`, `CREDENTIALS_ENCRYPTION_KEY`, Stripe, Resend, Twilio,
Google OAuth. See [§7](#7-required-env-vars-by-category) for the full list.

> **Secrets policy:** `.env.production` lives only on the droplet (chmod 600).
> It is gitignored and never committed, logged, or pasted into docs.

---

## 5. Point DNS at the droplet

Create an **A record**: `mc.example.com → <DROPLET_IP>`. Wait for it to resolve
(`dig +short mc.example.com`) before first boot so Caddy can obtain the TLS cert.
`MC_HOST` in `.env.production` must equal this hostname.

---

## 6. Deploy

```bash
export MC_DATA_DIR=/mnt/mc_data        # your attached volume mount
export MC_HOST=mc.example.com
./scripts/deploy-droplet.sh
```

The script: ensures `$MC_DATA_DIR` exists and is owned by uid/gid **1001**
(the container's `nextjs` user) → **backs up the DB before deploy** (migrations
run automatically on boot) → `docker compose -f docker-compose.droplet.yml build`
→ starts the stack → waits for health → runs the smoke test.

**Migrations** run automatically when the app boots (the migration runner applies
any new migrations against the DB on the mounted volume). The pre-deploy backup in
step above makes this safe and reversible.

Manual equivalent:

```bash
docker compose -f docker-compose.droplet.yml --env-file .env.production up -d --build
```

---

## 7. Required env vars by category

Placeholders only — real values go in `.env.production` on the server.
Full template: [`.env.production.example`](../../.env.production.example).

| Category | Vars |
|---|---|
| **App URL / Domain** | `MC_HOST`, `APP_URL`, `NEXT_PUBLIC_APP_URL`, `MC_PUBLIC_BASE_URL`, `MC_ALLOWED_HOSTS` |
| **Auth / Session** | `AUTH_USER`, `AUTH_PASS`, `AUTH_SECRET`, `NEXTAUTH_SECRET`, `API_KEY`, `SHARE_SIGNING_SECRET`, `MC_COOKIE_SECURE`, `MC_COOKIE_SAMESITE`, `MC_ENABLE_HSTS` |
| **Database (SQLite)** | `MISSION_CONTROL_DATA_DIR=/app/.data` (DB → `/app/.data/mission-control.db`, on the volume) |
| **Encryption** | `CREDENTIALS_ENCRYPTION_KEY` (64 hex chars) |
| **Google OAuth** | `GOOGLE_CLIENT_ID`, `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (+ add prod origin in Cloud Console) |
| **Twilio** | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` |
| **Resend / SMTP** | `RESEND_API_KEY`, `MC_RESEND_API_KEY`, `RESEND_FROM`, `MC_EMAIL_FROM`, `BRIEFING_FROM_EMAIL`, `SMTP_*` |
| **Stripe** | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_LIVE_MODE`, `STRIPE_PRICE_*` |
| **Model providers** | `OPENAI_API_KEY`, `OPENROUTER_API_KEY`, `ANTHROPIC_API_KEY` |
| **Vector/memory (opt.)** | `PINECONE_API_KEY`, `PINECONE_ENVIRONMENT`, `PINECONE_INDEX`, `PINECONE_INDEX_HOST` |
| **Gateway (local sidecar)** | `NEXT_PUBLIC_GATEWAY_OPTIONAL=true`, `OPENCLAW_GATEWAY_HOST/PORT` |

> **VisionOps / PropControl:** no `VISIONOPS_*` / `PROPCONTROL_*` env vars exist in
> the codebase. PropControl is linked as external sites only. If integration keys
> are added later, document them in `.env.production.example` first.

---

## 8. Post-deploy smoke test

```bash
./scripts/smoke-test-prod.sh https://mc.example.com
# during first bringup, before DNS/TLS settle:
./scripts/smoke-test-prod.sh https://localhost --insecure
```

Verifies (non-5xx / non-404): `/`, `/login`, `/app`, `/app/maintenance`,
`/app/comms`, `/app/approvals`, `/app/replay`, `/app/flight-deck`, `/flight-deck`,
and `GET /api/health` (must be **200** + healthy body).

Manual extras: log in, confirm marketing/video assets under `/public` load over
HTTPS, create a test agent/task, and confirm the Stripe webhook endpoint is
reachable from the Stripe dashboard.

---

## 9. Backup & restore

The SQLite DB is the crown jewel. Back it up on a schedule and before every deploy.

**Manual / pre-deploy backup** (WAL-safe online snapshot, gzipped, auto-pruned):

```bash
MC_DATA_DIR=/mnt/mc_data ./scripts/backup-db.sh
# → /mnt/mc_data/backups/mission-control-<UTC-timestamp>.db.gz
```

**Cron (hourly), keep 14 days:**

```bash
crontab -e
# add:
0 * * * * MC_DATA_DIR=/mnt/mc_data /opt/mission-control/scripts/backup-db.sh >> /var/log/mc-backup.log 2>&1
```

**Off-box copies:** periodically push `/mnt/mc_data/backups/` to DO Spaces (s3cmd/rclone)
or take a **DO Volume Snapshot** from the console for point-in-time recovery.

**Restore:**

```bash
MC_DATA_DIR=/mnt/mc_data ./scripts/restore-db.sh /mnt/mc_data/backups/mission-control-<stamp>.db.gz
docker compose -f docker-compose.droplet.yml --env-file .env.production up -d
```

Restore stops the app, saves the current DB as `*.pre-restore.<stamp>`, integrity-checks
the backup, then swaps it in.

---

## 10. Rollback

**Code/image rollback:**

```bash
cd /opt/mission-control
git log --oneline -10
git checkout <last-good-commit>
./scripts/deploy-droplet.sh        # rebuilds + redeploys (auto-backs up first)
```

**Database rollback:** use `restore-db.sh` with the pre-deploy backup taken in step 6
(or the `*.pre-restore.*` safety copy).

**Fast revert without rebuild:** `docker compose -f docker-compose.droplet.yml restart`.

---

## 11. Update / redeploy (routine)

```bash
cd /opt/mission-control && git pull
export MC_DATA_DIR=/mnt/mc_data MC_HOST=mc.example.com
./scripts/deploy-droplet.sh
```

---

## 12. Future path: Postgres → App Platform

When you outgrow a single box (need multiple app instances, managed failover, or
fully-managed hosting), migrate off SQLite:

1. Provision **DO Managed Postgres**; set `DATABASE_URL` in env.
2. Swap `better-sqlite3` for `pg`/Drizzle; make the migration runner + queries async.
3. One-time data copy from `mission-control.db` → Postgres (`pgloader`).
4. Deploy [`.do/app.yaml`](../../.do/app.yaml) to App Platform (auto-TLS, stateless
   container, env via the App settings UI). The spec is already updated to the
   correct GHCR image (`ghcr.io/waltluv/baseline-agent-mission-control-os-v8`).

Until then, **the Droplet is the production deploy.**

---

## Production risks (current)

- **Single instance / single box** — no automatic failover. Droplet down = app down.
  Mitigation: DO monitoring/alerts + volume snapshots + the backup cron above.
- **SQLite = one writer** — fine at launch-validation scale; revisit at high
  concurrent write load (see §12).
- **Backups are only as good as their off-box copies** — schedule Spaces/snapshot
  copies, not just on-volume backups.
- **Secrets live in `.env.production` on the droplet** — keep it chmod 600, rotate
  if the box is ever compromised.
