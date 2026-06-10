#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════
# deploy-droplet.sh — Deploy / redeploy Mission Control on a DO Droplet.
#
# Run this ON the droplet, from the repo root. It is idempotent and safe to
# re-run for every deploy. Migrations run automatically when the app boots,
# so this script ALWAYS backs the DB up first.
#
# Prereqs (one-time, see docs/deploy/DIGITALOCEAN_DROPLET_DEPLOY.md):
#   - Docker + compose plugin installed
#   - sqlite3 installed (for safe backups)
#   - A DO Block Storage volume attached and mounted (e.g. /mnt/mc_data)
#   - .env.production present in repo root (chmod 600, NOT committed)
#
# Usage:
#   export MC_DATA_DIR=/mnt/mc_data
#   export MC_HOST=mc.example.com
#   ./scripts/deploy-droplet.sh
# ═══════════════════════════════════════════════════════════════════════
set -euo pipefail

cd "$(dirname "$0")/.."   # repo root

COMPOSE_FILE="docker-compose.droplet.yml"
ENV_FILE="${ENV_FILE:-.env.production}"
MC_DATA_DIR="${MC_DATA_DIR:?set MC_DATA_DIR to the attached-volume path, e.g. /mnt/mc_data}"
export MC_DATA_DIR
export MC_HOST="${MC_HOST:-localhost}"

echo "═══ Mission Control droplet deploy ═══"
echo "  repo:      $(pwd)"
echo "  data dir:  $MC_DATA_DIR"
echo "  host:      $MC_HOST"
echo "  env file:  $ENV_FILE"

# ── 0. Preconditions ────────────────────────────────────────────────────
command -v docker >/dev/null || { echo "ERROR: docker not installed." >&2; exit 1; }
docker compose version >/dev/null 2>&1 || { echo "ERROR: docker compose plugin missing." >&2; exit 1; }
[ -f "$ENV_FILE" ] || { echo "ERROR: $ENV_FILE missing. Copy .env.production.example and fill it in (chmod 600)." >&2; exit 1; }
[ -f "$COMPOSE_FILE" ] || { echo "ERROR: $COMPOSE_FILE missing." >&2; exit 1; }

# ── 1. Persistent data dir (container runs as uid/gid 1001) ──────────────
echo "── Ensuring persistent data dir: $MC_DATA_DIR"
sudo mkdir -p "$MC_DATA_DIR/backups"
sudo chown -R 1001:1001 "$MC_DATA_DIR"

# ── 2. Backup BEFORE deploy (migrations auto-run on boot) ────────────────
echo "── Backing up DB before deploy (safe migration)…"
MC_DATA_DIR="$MC_DATA_DIR" ./scripts/backup-db.sh || {
  echo "ERROR: pre-deploy backup failed — aborting before any migration runs." >&2
  exit 1
}

# ── 3. Build + start ─────────────────────────────────────────────────────
echo "── Building and starting stack…"
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" up -d --build

# ── 4. Wait for health ───────────────────────────────────────────────────
echo "── Waiting for app health (up to 120s)…"
ok=0
for i in $(seq 1 24); do
  status="$(docker inspect --format '{{.State.Health.Status}}' mission-control 2>/dev/null || echo starting)"
  if [ "$status" = "healthy" ]; then ok=1; break; fi
  sleep 5
  printf '.'
done
echo
if [ "$ok" -ne 1 ]; then
  echo "ERROR: app did not become healthy. Recent logs:" >&2
  docker compose -f "$COMPOSE_FILE" logs --tail 50 mission-control >&2
  exit 1
fi
echo "── App is healthy."

# ── 5. Smoke test (through Caddy on localhost, self-signed OK at bringup) ─
echo "── Running smoke test…"
./scripts/smoke-test-prod.sh "https://${MC_HOST}" --insecure || \
  echo "WARN: some smoke checks failed — review above (DNS/TLS may still be propagating)."

echo "═══ Deploy complete. Commit: $(git rev-parse --short HEAD 2>/dev/null || echo n/a) ═══"
echo "  Live at: https://${MC_HOST}"
