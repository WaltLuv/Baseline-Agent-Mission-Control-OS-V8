#!/bin/bash
# Baseline OS sidecar launcher.
#
# Starts the Baseline OS operator console (vite dev on 127.0.0.1:4173) and the
# `mc sync watch` heartbeat loop that keeps Mission Control's runtime registry
# fresh. Idempotent — safe to call on every Mission Control (frontend) restart.
#
# Architecture: Mission Control (:3000, customer-facing) ← x-api-key sync ←
# Baseline OS (:4173, internal workforce layer). Loose coupling via API only.

set -u

BASELINE_DIR=/app/baseline-os
LOG=/var/log/baseline-os.log
SYNC_LOG=/var/log/baseline-os-sync.log

# Pick a bun binary (persistent copy under /app survives container restarts).
if [ -x /root/.bun/bin/bun ]; then
  BUN=/root/.bun/bin/bun
elif [ -x /app/.bun/bin/bun ]; then
  BUN=/app/.bun/bin/bun
else
  echo "[baseline-os] no bun binary found — skipping sidecar" >&2
  exit 0
fi

cd "$BASELINE_DIR"

# Seed the read-only dashboard data file if missing.
[ -f src/data/live-data.json ] || cp src/data/live-data.example.json src/data/live-data.json

# 1. Operator console (vite dev) on 127.0.0.1:4173 — internal only.
if ! pgrep -f "vite.*4173" > /dev/null 2>&1; then
  nohup "$BUN" ./node_modules/vite/bin/vite.js dev --port 4173 --strictPort --host 127.0.0.1 >> "$LOG" 2>&1 &
  echo "[baseline-os] console starting on 127.0.0.1:4173 (pid $!)"
fi

# 2. Sync loop → Mission Control runtime registry. `sync push` re-runs local
#    runtime discovery on every pass (unlike `sync watch`, whose heartbeats
#    let local last_seen age out and flip health to red between ticks).
if ! pgrep -f "baseline-os-sync-loop" > /dev/null 2>&1; then
  nohup bash -c 'exec -a baseline-os-sync-loop bash -c "while true; do '"$BUN"' run scripts/mc.ts sync push --json; sleep 45; done"' >> "$SYNC_LOG" 2>&1 &
  echo "[baseline-os] mc sync push loop started (pid $!)"
fi

exit 0
