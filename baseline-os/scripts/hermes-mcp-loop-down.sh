#!/usr/bin/env bash
# hermes-mcp-loop-down.sh — tear down everything hermes-mcp-loop-up.sh started.
#
# Stops: hermes-mcp serve · hermes proxy · cloudflared tunnel.
# Leaves: hermes login state, OAuth client, env vars, ~/.hermes/.

set -u
say() { printf "\033[1;33m[hermes-mcp-loop-down]\033[0m %s\n" "$*"; }
ok()  { printf "\033[1;32m  ✓\033[0m %s\n" "$*"; }

kill_match() {
  local label="$1" pattern="$2"
  local pids
  pids=$(pgrep -f "$pattern" 2>/dev/null || true)
  if [ -z "$pids" ]; then
    ok "$label not running"
    return
  fi
  echo "$pids" | xargs kill 2>/dev/null
  sleep 1
  # SIGKILL if still alive
  pids=$(pgrep -f "$pattern" 2>/dev/null || true)
  [ -n "$pids" ] && echo "$pids" | xargs kill -9 2>/dev/null
  ok "$label stopped"
}

say "stopping the Hermes MCP loop"
kill_match "hermes-mcp serve"     "hermes-mcp serve"
kill_match "hermes proxy"         "hermes proxy start"
kill_match "cloudflared tunnel"   "cloudflared tunnel --url"

say "logs preserved at /tmp/{cloudflared,hermes-proxy,hermes-mcp}.log"
