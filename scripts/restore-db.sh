#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════
# restore-db.sh — Restore the Mission Control SQLite DB from a backup.
#
# Stops the app, replaces the live DB with the chosen backup (after saving
# a safety copy of the current DB), then you bring the stack back up.
#
# Usage:
#   MC_DATA_DIR=/mnt/mc_data ./scripts/restore-db.sh /mnt/mc_data/backups/mission-control-20260610T120000Z.db.gz
#
# Always taken offline first to avoid restoring under live writes.
# ═══════════════════════════════════════════════════════════════════════
set -euo pipefail

MC_DATA_DIR="${MC_DATA_DIR:?set MC_DATA_DIR to the host data path, e.g. /mnt/mc_data}"
DB_PATH="${DB_PATH:-$MC_DATA_DIR/mission-control.db}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.droplet.yml}"
BACKUP="${1:?usage: restore-db.sh <path-to-backup.db.gz|.db>}"

[ -f "$BACKUP" ] || { echo "[restore] ERROR: backup not found: $BACKUP" >&2; exit 1; }
command -v sqlite3 >/dev/null 2>&1 || { echo "[restore] ERROR: sqlite3 CLI not found." >&2; exit 1; }

echo "[restore] Stopping app container (Caddy can stay up)…"
docker compose -f "$COMPOSE_FILE" stop mission-control || true

# Save the current DB before overwriting.
if [ -f "$DB_PATH" ]; then
  SAFETY="$DB_PATH.pre-restore.$(date -u +%Y%m%dT%H%M%SZ)"
  echo "[restore] Saving current DB -> $SAFETY"
  cp "$DB_PATH" "$SAFETY"
fi

# Decompress to a temp file, integrity-check, then move into place.
TMP="$(mktemp)"
if [[ "$BACKUP" == *.gz ]]; then
  echo "[restore] Decompressing $BACKUP"
  gzip -dc "$BACKUP" > "$TMP"
else
  cp "$BACKUP" "$TMP"
fi

if [ "$(sqlite3 "$TMP" 'PRAGMA integrity_check;')" != "ok" ]; then
  echo "[restore] ERROR: backup failed integrity check — aborting, live DB untouched." >&2
  rm -f "$TMP"
  exit 1
fi

# Clear any stale WAL/SHM so the restored file is authoritative.
rm -f "$DB_PATH-wal" "$DB_PATH-shm"
mv "$TMP" "$DB_PATH"
chown 1001:1001 "$DB_PATH" 2>/dev/null || true

echo "[restore] Restored $DB_PATH from $BACKUP"
echo "[restore] Bring the stack back up:  docker compose -f $COMPOSE_FILE --env-file .env.production up -d"
