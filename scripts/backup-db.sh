#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════
# backup-db.sh — Safe, online backup of the Mission Control SQLite database.
#
# Uses `sqlite3 .backup`, which takes a consistent snapshot even while the
# app is writing (WAL-safe) — never just `cp` a live DB. Output is gzipped
# and timestamped; old backups are pruned past the retention window.
#
# Usage:
#   MC_DATA_DIR=/mnt/mc_data ./scripts/backup-db.sh
#   MC_DATA_DIR=/mnt/mc_data BACKUP_DIR=/mnt/mc_data/backups RETENTION=14 ./scripts/backup-db.sh
#
# Run from cron, e.g. hourly:
#   0 * * * * MC_DATA_DIR=/mnt/mc_data /opt/mission-control/scripts/backup-db.sh >> /var/log/mc-backup.log 2>&1
# ═══════════════════════════════════════════════════════════════════════
set -euo pipefail

MC_DATA_DIR="${MC_DATA_DIR:?set MC_DATA_DIR to the host data path, e.g. /mnt/mc_data}"
DB_PATH="${DB_PATH:-$MC_DATA_DIR/mission-control.db}"
BACKUP_DIR="${BACKUP_DIR:-$MC_DATA_DIR/backups}"
RETENTION="${RETENTION:-14}"   # delete gzipped backups older than N days

if [ ! -f "$DB_PATH" ]; then
  echo "[backup] No database at $DB_PATH yet — nothing to back up (first deploy?)."
  exit 0
fi

if ! command -v sqlite3 >/dev/null 2>&1; then
  echo "[backup] ERROR: sqlite3 CLI not found. Install it:  sudo apt-get install -y sqlite3" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
TMP="$BACKUP_DIR/mission-control-$STAMP.db"
OUT="$TMP.gz"

echo "[backup] Snapshotting $DB_PATH -> $OUT"
# .backup is an atomic, consistent online copy (safe under concurrent writes).
sqlite3 "$DB_PATH" ".backup '$TMP'"
# Integrity-check the snapshot before we trust it.
if [ "$(sqlite3 "$TMP" 'PRAGMA integrity_check;')" != "ok" ]; then
  echo "[backup] ERROR: integrity check FAILED on snapshot — keeping raw file for inspection." >&2
  exit 1
fi
gzip -f "$TMP"

echo "[backup] OK: $OUT ($(du -h "$OUT" | cut -f1))"
echo "[backup] Pruning backups older than ${RETENTION} days in $BACKUP_DIR"
find "$BACKUP_DIR" -name 'mission-control-*.db.gz' -type f -mtime "+$RETENTION" -print -delete || true
echo "[backup] Done."
