#!/bin/bash
# Mission Control startup wrapper.
#
# Why this exists:
#   - The container ships with Node v20 by default and resets on recycle.
#     Mission Control requires Node >= 22 (and the `better-sqlite3` native
#     binding must match the running Node ABI / NODE_MODULE_VERSION).
#   - We install a pinned Node 22 into /app/.node22 (persistent across
#     container recycles) and always invoke it directly.
#   - If `better-sqlite3` cannot be loaded against the current Node ABI
#     we rebuild it from source via node-gyp before exec'ing the server.
set -e

export PATH="/app/.node22/bin:$PATH"
cd /app

# Load /app/.env into the environment before exec'ing the standalone server.
# Next.js' built-in dotenv only runs at build time; the standalone runtime
# does NOT re-parse .env. Without this, env values added after `yarn build`
# (e.g. STRIPE_*, MC_EMAIL_FROM updates) are invisible to the running server.
# NUL-separated stream tolerates values with spaces / `<` `>` / quotes.
if [ -f /app/.env ] && [ -x /app/.node22/bin/node ]; then
  while IFS= read -r -d '' line; do
    export "$line"
  done < <(/app/.node22/bin/node /app/scripts/load-env.cjs /app/.env 2>/dev/null)
fi

NODE_BIN="/app/.node22/bin/node"
NPM_BIN="/app/.node22/bin/npm"

if [ ! -x "$NODE_BIN" ]; then
  echo "[start] Node 22 not found at $NODE_BIN — installing..."
  ARCH=$(uname -m)
  if [ "$ARCH" = "aarch64" ] || [ "$ARCH" = "arm64" ]; then NARCH="arm64"; else NARCH="x64"; fi
  mkdir -p /app/.node22
  curl -fsSL -o /tmp/node22.tar.xz "https://nodejs.org/dist/v22.22.2/node-v22.22.2-linux-${NARCH}.tar.xz"
  tar -xJf /tmp/node22.tar.xz --strip-components=1 -C /app/.node22
fi

# Verify better-sqlite3 ABI matches current Node. If not, do a real
# from-source rebuild via node-gyp (npm rebuild alone has been observed
# to silently leave the old .node binary in place).
if ! "$NODE_BIN" -e "require('better-sqlite3')" >/dev/null 2>&1; then
  echo "[start] better-sqlite3 ABI mismatch — rebuilding for $($NODE_BIN --version)..."
  BSQ_DIR="/app/node_modules/.pnpm/better-sqlite3@12.6.2/node_modules/better-sqlite3"
  if [ -d "$BSQ_DIR" ]; then
    (
      cd "$BSQ_DIR"
      rm -rf build
      /app/.node22/bin/npx --yes node-gyp@10 rebuild --release --python=python3 2>&1 | tail -3
    )
  else
    "$NPM_BIN" rebuild better-sqlite3 --build-from-source 2>&1 | tail -3 || true
  fi
fi

echo "[start] Node: $($NODE_BIN --version) — exec: $*"
exec "$@"
