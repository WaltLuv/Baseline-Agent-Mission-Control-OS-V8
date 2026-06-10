# Walt's Mission Control Deploy Checklist — DigitalOcean Droplet

Work top to bottom. Each box is one concrete action. Full commands live in
[`DIGITALOCEAN_DROPLET_DEPLOY.md`](./DIGITALOCEAN_DROPLET_DEPLOY.md) (see the
⚡ Quickstart at the top). Don't skip the backup step at the end.

> Target: Droplet + Docker Compose + persistent Block Storage volume + Caddy HTTPS,
> SQLite on the mounted volume. Not App Platform (ephemeral disk would wipe the DB).

---

## Pre-flight

- [ ] **DigitalOcean account ready** — billing enabled, a Project created
- [ ] **SSH key added** to DigitalOcean (Settings → Security → SSH Keys)
- [ ] Domain available and you can edit its DNS (e.g. `mc.example.com`)
- [ ] Production secrets on hand: Stripe (`sk_live_…`, `whsec_…`), Resend key,
      Twilio SID/token/number, Google OAuth client ID

## Infrastructure

- [ ] **Droplet created** — Ubuntu 24.04, Basic, **2 GB / 1 vCPU**, your SSH key, a region
- [ ] **Volume attached** — Block Storage, **10 GB**, *same region*, attached to the droplet
      (confirm `df -h | grep mnt` shows `/mnt/mc_data`)
- [ ] **Domain DNS pointed** — A record `mc.example.com → <DROPLET_IP>`
      (confirm `dig +short mc.example.com` returns the droplet IP)

## Setup on the droplet

- [ ] SSH in: `ssh root@<DROPLET_IP>`
- [ ] Docker + tools installed (`curl -fsSL https://get.docker.com | sh`;
      `apt-get install -y sqlite3 git ufw`; firewall: allow OpenSSH/80/443)
- [ ] **Repo cloned** to `/opt/mission-control`
- [ ] **Env filled** — `cp .env.production.example .env.production`, every `CHANGE_ME`
      replaced, secrets generated with `openssl rand`, `chmod 600 .env.production`
- [ ] Added prod origin `https://mc.example.com` to the **Google OAuth** client
      (Cloud Console → Authorized JavaScript origins) so login works
- [ ] Pointed the **Stripe webhook** at `https://mc.example.com/api/stripe/webhook`
      (or your configured webhook route) and put the signing secret in `.env.production`

## Deploy

- [ ] **Deploy script run** — `export MC_DATA_DIR=/mnt/mc_data MC_HOST=mc.example.com`
      then `./scripts/deploy-droplet.sh` (it backs up the DB, builds, waits for health)
- [ ] App reports **healthy** (script prints "App is healthy")

## Verify (post-deploy)

- [ ] **Smoke test passed** — `./scripts/smoke-test-prod.sh https://mc.example.com`
      (all routes PASS, `/api/health` = 200)
- [ ] **Login verified** — open `https://mc.example.com/login`, sign in, land on `/app`
- [ ] **Maintenance workflow verified** — `/app/maintenance` loads; run a triage →
      work order → approval in dry-run, confirm proof/replay records
- [ ] **Comms checked** — `/app/comms` loads; SMS/email shows connected (or honest
      dry-run if Twilio/Resend not yet live)
- [ ] Marketing assets load over HTTPS (homepage hero video `/marketing/mission-control-hero.mp4`)

## Durability

- [ ] **Backup cron installed** — `crontab -e`, add:
      `0 * * * * MC_DATA_DIR=/mnt/mc_data /opt/mission-control/scripts/backup-db.sh >> /var/log/mc-backup.log 2>&1`
- [ ] Took one manual backup and saw the `.db.gz` in `/mnt/mc_data/backups/`
- [ ] (Recommended) Set up off-box copies — DO Volume Snapshot or sync `backups/` to Spaces

---

## If something fails

| Symptom | Check |
|---|---|
| Won't become healthy | `docker compose -f docker-compose.droplet.yml logs --tail 50 mission-control` |
| TLS cert error | DNS must resolve to the droplet *before* first boot; `docker logs mc-proxy` |
| 401 / login loop | `MC_HOST`, `APP_URL`, `MC_ALLOWED_HOSTS` match the real domain; cookies secure |
| Google login rejected | prod origin added to the OAuth client in Cloud Console |
| Need to roll back | `git checkout <last-good>` → `./scripts/deploy-droplet.sh`; DB via `restore-db.sh` |

Rollback details: see §10 of the runbook.
