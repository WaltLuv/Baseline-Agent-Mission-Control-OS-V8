#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${AGENT_ENV_FILE:-}" ]]; then
  echo "Required env: AGENT_ENV_FILE" >&2
  exit 2
fi

if [[ ! -f "$AGENT_ENV_FILE" ]]; then
  echo "Missing agent env file: $AGENT_ENV_FILE" >&2
  exit 2
fi

set -a
source "$AGENT_ENV_FILE"
set +a

cd /Users/walt/code/claude-os
exec /opt/homebrew/bin/bun run scripts/persona-tg-bot.ts
