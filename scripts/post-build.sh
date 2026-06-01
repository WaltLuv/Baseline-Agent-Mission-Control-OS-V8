#!/bin/bash
# scripts/post-build.sh — run after `yarn build` to make the standalone
# deploy actually serveable.
#
# Next.js 16 standalone output does NOT copy:
#   - /app/.next/static  (compiled JS/CSS chunks)
#   - /app/public         (favicon, brand, downloads)
#
# Without these, /_next/static/chunks/*.js all return 404 and the entire
# app renders as un-hydrated HTML. React never boots; every interactive
# component is silently dead.
#
# Symlink them in. Idempotent.

set -e

ROOT=${1:-/app}

if [ ! -d "$ROOT/.next/standalone" ]; then
  echo "post-build: $ROOT/.next/standalone does not exist — did yarn build run? skipping" >&2
  exit 0
fi

ln -sfn "$ROOT/.next/static" "$ROOT/.next/standalone/.next/static"
ln -sfn "$ROOT/public" "$ROOT/.next/standalone/public"

echo "post-build: symlinked .next/static and public into standalone"
