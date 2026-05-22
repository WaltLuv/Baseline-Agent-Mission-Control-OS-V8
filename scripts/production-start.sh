#!/usr/bin/env bash
# production-start.sh — Mission Control V2 production bootstrap
# Usage: bash scripts/production-start.sh [action]
# Actions: start, stop, restart, status, health

set -euo pipefail
MC_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DATA_DIR="${MC_DIR}/.data"
DB="${DATA_DIR}/mission-control.db"
PORT="${PORT:-3000}"
LOG_FILE="${MC_DIR}/logs/production.log"
PID_FILE="${DATA_DIR}/production.pid"
HEALTH_URL="http://127.0.0.1:${PORT}/api/status"
STARTUP_TIMEOUT=60

# ── Actions ───────────────────────────────────────────────────────────
action="${1:-start}"
shift || true

case "${action}" in
  start|stop|restart|status|health|backup|migrate) ;;
  *)
    echo "Usage: $0 {start|stop|restart|status|health|backup|migrate}"
    exit 1
    ;;
esac

# ── Helpers ───────────────────────────────────────────────────────────
log() { echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] $*"; }
die() { log "ERROR: $*" >&2; exit 1; }

check_port() {
  if ss -tlnp 2>/dev/null | grep -q ":${PORT} "; then
    die "Port ${PORT} is already in use. Another process is running."
  fi
}

checkpoint_wal() {
  if command -v sqlite3 &>/dev/null && [ -f "$DB" ]; then
    log "Checkpointing WAL..."
    sqlite3 "$DB" "PRAGMA wal_checkpoint(TRUNCATE);" 2>/dev/null || true
  elif [ -f "$DB" ]; then
    log "Skipping WAL checkpoint (sqlite3 not available)"
  fi
}

check_env() {
  local missing=0
  for var in AUTH_USER AUTH_PASS; do
    if [ -z "${!var:-}" ]; then
      log "WARN: ${var} is not set"
      missing=$((missing + 1))
    fi
  done
  [ "$missing" -gt 0 ] && log "WARN: Missing env vars — using auto-generated defaults"
  return 0
}

do_health() {
  local attempts=0
  local max_attempts=$((STARTUP_TIMEOUT / 2))
  while [ $attempts -lt $max_attempts ]; do
    if curl -sf "$HEALTH_URL" &>/dev/null; then
      log "✓ Health check passed"
      return 0
    fi
    attempts=$((attempts + 1))
    sleep 2
  done
  log "✗ Health check failed after ${STARTUP_TIMEOUT}s"
  return 1
}

# ── Main ──────────────────────────────────────────────────────────────
case "${action}" in
  start)
    log "Starting Mission Control V2 (port ${PORT})"
    check_env
    mkdir -p "${MC_DIR}/logs"
    check_port
    checkpoint_wal
    log "Launching Next.js production server..."
    cd "$MC_DIR"
    if [ "${NODE_ENV:-}" = "production" ]; then
      pnpm build 2>&1 | tee -a "$LOG_FILE" || die "Build failed"
      node .next/standalone/server.js 2>&1 &
    else
      pnpm dev 2>&1 &
    fi
    SERVER_PID=$!
    echo "$SERVER_PID" > "$PID_FILE"
    log "Server PID: $SERVER_PID"

    # Wait for health
    do_health || {
      log "Server failed to start. Check ${LOG_FILE}"
      kill "$SERVER_PID" 2>/dev/null || true
      exit 1
    }
    log "✓ Mission Control V2 is running on http://127.0.0.1:${PORT}"
    ;;

  stop)
    if [ -f "$PID_FILE" ]; then
      pid=$(cat "$PID_FILE")
      if kill -0 "$pid" 2>/dev/null; then
        log "Stopping server (PID ${pid})..."
        kill "$pid"
        # Wait up to 30s for graceful shutdown
        for i in $(seq 1 30); do
          kill -0 "$pid" 2>/dev/null || break
          sleep 1
        done
        if kill -0 "$pid" 2>/dev/null; then
          log "Force killing..."
          kill -9 "$pid" 2>/dev/null || true
        fi
        log "✓ Server stopped"
      else
        log "Server (PID ${pid}) is not running"
      fi
      rm -f "$PID_FILE"
    else
      log "No PID file found. Finding process on port ${PORT}..."
      pid=$(ss -tlnp 2>/dev/null | grep ":${PORT} " | grep -oP 'pid=\K[0-9]+' | head -1)
      if [ -n "$pid" ]; then
        kill "$pid" 2>/dev/null && log "✓ Stopped PID $pid" || log "Could not stop PID $pid"
      else
        log "No process found on port ${PORT}"
      fi
    fi
    checkpoint_wal
    ;;

  restart)
    "$0" stop
    sleep 2
    "$0" start
    ;;

  status)
    if [ -f "$PID_FILE" ]; then
      pid=$(cat "$PID_FILE")
      if kill -0 "$pid" 2>/dev/null; then
        echo "Status: RUNNING (PID ${pid})"
        uptime_str=$(ps -o etime= -p "$pid" | xargs)
        echo "Uptime: ${uptime_str}"
      else
        echo "Status: STOPPED (stale PID ${pid})"
        rm -f "$PID_FILE"
      fi
    else
      pid=$(ss -tlnp 2>/dev/null | grep ":${PORT} " | grep -oP 'pid=\K[0-9]+' | head -1)
      if [ -n "$pid" ]; then
        echo "Status: RUNNING (PID ${pid}, port ${PORT})"
      else
        echo "Status: STOPPED (no process on port ${PORT})"
      fi
    fi
    ;;

  health)
    if curl -sf "$HEALTH_URL" 2>/dev/null; then
      echo "✓ Healthy"
    else
      echo "✗ Unhealthy (server not responding on ${HEALTH_URL})"
      exit 1
    fi
    ;;

  backup)
    ts=$(date -u '+%Y%m%d_%H%M%S')
    backup_dir="${DATA_DIR}/backups"
    mkdir -p "$backup_dir"
    if [ -f "$DB" ]; then
      checkpoint_wal
      cp "$DB" "${backup_dir}/mission-control-${ts}.db"
      log "✓ Backed up to ${backup_dir}/mission-control-${ts}.db"
    else
      log "No database to backup"
    fi
    ;;

  migrate)
    log "PostgreSQL migration — run manually per docs/postgres-migration.md"
    log "This action validates readiness but does not execute migration"
    if [ -f "${MC_DIR}/scripts/init-db-postgres.sql" ]; then
      log "✓ PostgreSQL schema file found"
    else
      die "PostgreSQL schema not found — run Phase 5.1 first"
    fi
    ;;
esac
