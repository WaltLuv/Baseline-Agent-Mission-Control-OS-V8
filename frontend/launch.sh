#!/bin/bash
# Mission Control frontend launcher (shim).
#
# Boots the prebuilt Next.js standalone server at /app/.next/standalone/server.js
# from inside the /app/frontend supervisor program.
#
# Why this exists:
#   The Emergent deployment supervisor template runs `yarn start` from
#   /app/frontend with PORT=3000 to satisfy the platform's ingress health
#   check on port 3000. This Next.js-only app's real source lives at /app
#   (single-package Next.js 16). This script bridges the two: a thin
#   `yarn start` that simply boots the standalone server in-place.
#
# Runtime selection:
#   1. /app/.node22/bin/node  (preferred — persistent Node 22 install)
#   2. The Node 22 install referenced by start-with-node22.sh (handles
#      ABI rebuild of better-sqlite3 automatically)
#   3. System `node` as last resort

set -euo pipefail

cd /app

# Re-link standalone static assets / public dir so /_next/static/* and
# /public/* never 404. Idempotent — safe to re-run on every restart.
if [ -d /app/.next/static ]; then
  rm -rf /app/.next/standalone/.next/static
  ln -sfn /app/.next/static /app/.next/standalone/.next/static
fi
if [ -d /app/public ]; then
  rm -rf /app/.next/standalone/public
  ln -sfn /app/public /app/.next/standalone/public
fi

# Load /app/.env into the environment before exec'ing the server.
# Next.js' built-in dotenv only runs at BUILD time; the standalone runtime
# does NOT re-parse .env.
if [ -f /app/.env ] && [ -x /app/.node22/bin/node ]; then
  while IFS= read -r -d '' line; do
    export "$line"
  done < <(/app/.node22/bin/node /app/scripts/load-env.cjs /app/.env 2>/dev/null || true)
fi

# Start the Baseline OS sidecar (workforce layer console + MC sync heartbeat).
# Idempotent; never blocks Mission Control boot.
chmod +x /app/baseline-os/launch.sh 2>/dev/null || true
bash /app/baseline-os/launch.sh || true

# Force the standalone server to bind on every interface so the
# Kubernetes service / Emergent ingress can reach it.
export HOSTNAME=0.0.0.0
export PORT="${PORT:-3000}"
export NODE_ENV="${NODE_ENV:-production}"

# Pick the best Node binary available.
if [ -x /app/.node22/bin/node ]; then
  NODE_BIN="/app/.node22/bin/node"
elif command -v node >/dev/null 2>&1; then
  NODE_BIN="$(command -v node)"
else
  echo "[frontend-launcher] ERROR: no node binary found" >&2
  exit 1
fi

# Defensive: rebuild better-sqlite3 if its native binding doesn't match
# the running Node ABI. The start-with-node22.sh helper already knows how.
if [ -x /app/scripts/start-with-node22.sh ]; then
  exec /app/scripts/start-with-node22.sh "$NODE_BIN" /app/.next/standalone/server.js
fi

echo "[frontend-launcher] starting Next.js standalone with $NODE_BIN on $HOSTNAME:$PORT"
exec "$NODE_BIN" /app/.next/standalone/server.js
