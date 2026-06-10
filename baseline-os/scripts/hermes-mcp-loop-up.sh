#!/usr/bin/env bash
# hermes-mcp-loop-up.sh — bring the Hermes MCP / Hermes MCP Loop online.
#
# Idempotent: skips steps that are already done. Safe to re-run.
#
# Steps:
#   1. Verify hermes-mcp + cloudflared binaries
#   2. Start cloudflared tunnel (background) → grab the trycloudflare.com URL
#   3. Ensure `hermes login` has completed (opens browser if not)
#   4. Start `hermes proxy start --port 8642` (background) — needs the login
#   5. Start `hermes-mcp serve` (background) with OAuth env vars
#   6. Print the Claude Desktop connector config + the test prompt
#
# All long-running processes are detached with nohup + disown so this script
# returns once they're up. Logs live in /tmp/.
#
# Usage:
#   bash scripts/hermes-mcp-loop-up.sh
#
# Status:
#   curl -s http://localhost:8081/__hermes_mcp_loop_status | jq

set -u   # don't set -e — we want to recover from individual step failures
SELF="$(basename "$0")"
say() { printf "\033[1;33m[%s]\033[0m %s\n" "$SELF" "$*"; }
ok()  { printf "\033[1;32m  ✓\033[0m %s\n" "$*"; }
warn(){ printf "\033[1;31m  ✗\033[0m %s\n" "$*"; }

# ─── 0. Source .env.local for OAuth creds ─────────────────────────────────────
ENV_FILE="${BASELINE_ENV:-/Users/walt/code/claude-os/.env.local}"
if [ -f "$ENV_FILE" ]; then
  # shellcheck disable=SC1090
  set -a; source "$ENV_FILE"; set +a
  ok "loaded env from $ENV_FILE"
else
  warn "$ENV_FILE not found — OAuth client ID/secret unset"
fi

# ─── 1. Required binaries ─────────────────────────────────────────────────────
say "checking required binaries"
HMCP=$(command -v hermes-mcp || true)
HERMES=$(command -v hermes || true)
CFD=$(command -v cloudflared || true)
[ -n "$HMCP" ]   && ok "hermes-mcp: $HMCP"   || { warn "hermes-mcp not found — run: pipx install hermes-mcp"; exit 2; }
[ -n "$HERMES" ] && ok "hermes: $HERMES"     || { warn "hermes CLI not found — install the Hermes Agent first"; exit 2; }
[ -n "$CFD" ]    && ok "cloudflared: $CFD"   || { warn "cloudflared not found — run: brew install cloudflared"; exit 2; }

# ─── 2. Cloudflared tunnel (background) ───────────────────────────────────────
TUNNEL_URL=""
if pgrep -f "cloudflared tunnel --url" >/dev/null 2>&1; then
  TUNNEL_URL=$(grep -oE "https://[a-z0-9-]+\.trycloudflare\.com" /tmp/cloudflared.log 2>/dev/null | head -1)
  ok "cloudflared already running · $TUNNEL_URL"
else
  say "starting cloudflared tunnel → http://127.0.0.1:8765"
  nohup cloudflared tunnel --url http://127.0.0.1:8765 >/tmp/cloudflared.log 2>&1 &
  disown $! 2>/dev/null
  # Poll up to 20s for the URL to appear
  for _ in $(seq 1 20); do
    TUNNEL_URL=$(grep -oE "https://[a-z0-9-]+\.trycloudflare\.com" /tmp/cloudflared.log 2>/dev/null | head -1)
    [ -n "$TUNNEL_URL" ] && break
    sleep 1
  done
  if [ -n "$TUNNEL_URL" ]; then
    ok "cloudflared up · $TUNNEL_URL"
  else
    warn "cloudflared started but didn't expose a URL in 20s — see /tmp/cloudflared.log"
  fi
fi

# Persist current tunnel URL into the env for hermes-mcp-loop-status to pick it up
if [ -n "$TUNNEL_URL" ]; then
  TUNNEL_HOST="${TUNNEL_URL#https://}"
  if grep -q "^HERMES_MCP_TUNNEL_URL=" "$ENV_FILE" 2>/dev/null; then
    sed -i '' "s|^HERMES_MCP_TUNNEL_URL=.*|HERMES_MCP_TUNNEL_URL=$TUNNEL_URL|" "$ENV_FILE"
  else
    echo "HERMES_MCP_TUNNEL_URL=$TUNNEL_URL" >> "$ENV_FILE"
  fi
  export OAUTH_ISSUER_URL="$TUNNEL_URL"
  export MCP_ALLOWED_HOSTS="$TUNNEL_HOST"
fi

# ─── 3. Hermes login ──────────────────────────────────────────────────────────
say "checking Hermes auth"
if hermes auth status 2>&1 | grep -qi "logged in\|authenticated\|nous"; then
  ok "already logged in to Nous Portal"
else
  say "running 'hermes login' (browser will open)"
  hermes login || warn "hermes login failed — re-run manually and then re-run $SELF"
fi

# ─── 4. Hermes proxy on :8642 ────────────────────────────────────────────────
if curl -s -m 2 http://127.0.0.1:8642/v1/health >/dev/null 2>&1; then
  ok "hermes proxy already live on :8642"
else
  say "starting hermes proxy on :8642"
  nohup hermes proxy start --port 8642 >/tmp/hermes-proxy.log 2>&1 &
  disown $! 2>/dev/null
  for _ in $(seq 1 15); do
    sleep 1
    if curl -s -m 2 http://127.0.0.1:8642/v1/health >/dev/null 2>&1; then
      ok "hermes proxy up"
      break
    fi
  done
  curl -s -m 2 http://127.0.0.1:8642/v1/health >/dev/null 2>&1 || warn "hermes proxy didn't come up — see /tmp/hermes-proxy.log"
fi

# ─── 5. hermes-mcp serve on :8765 ────────────────────────────────────────────
# The bridge needs all five env vars to start cleanly.
HERMES_API_KEY="${HERMES_API_KEY:-$(grep -i '^API_SERVER_KEY=' "$HOME/.hermes/.env" 2>/dev/null | cut -d= -f2)}"
export OAUTH_CLIENT_ID OAUTH_CLIENT_SECRET OAUTH_ISSUER_URL MCP_ALLOWED_HOSTS HERMES_API_KEY

if curl -s -m 2 http://127.0.0.1:8765/health >/dev/null 2>&1; then
  ok "hermes-mcp bridge already live on :8765"
else
  say "starting hermes-mcp serve on :8765"
  if [ -z "${OAUTH_CLIENT_ID:-}" ] || [ -z "${OAUTH_CLIENT_SECRET:-}" ]; then
    warn "OAUTH_CLIENT_ID/SECRET missing — run 'hermes-mcp mint-client' first"
  else
    nohup hermes-mcp serve >/tmp/hermes-mcp.log 2>&1 &
    disown $! 2>/dev/null
    for _ in $(seq 1 15); do
      sleep 1
      if curl -s -m 2 http://127.0.0.1:8765/health >/dev/null 2>&1; then
        ok "hermes-mcp bridge up"
        break
      fi
    done
    curl -s -m 2 http://127.0.0.1:8765/health >/dev/null 2>&1 || warn "bridge didn't come up — see /tmp/hermes-mcp.log"
  fi
fi

# ─── 6. Final report ──────────────────────────────────────────────────────────
echo
say "Hermes MCP Loop status:"
[ -n "$TUNNEL_URL" ] && ok "tunnel        · $TUNNEL_URL"
curl -s -m 2 http://127.0.0.1:8642/v1/health >/dev/null 2>&1 && ok "hermes proxy  · http://127.0.0.1:8642" || warn "hermes proxy  · DOWN"
curl -s -m 2 http://127.0.0.1:8765/health >/dev/null 2>&1     && ok "hermes-mcp    · http://127.0.0.1:8765" || warn "hermes-mcp    · DOWN"

if [ -n "$TUNNEL_URL" ] && [ -n "${OAUTH_CLIENT_ID:-}" ]; then
  echo
  printf "\033[1;33m─── Paste into Claude Desktop → Settings → Connectors ───\033[0m\n"
  echo "  URL:           $TUNNEL_URL/mcp"
  echo "  Client ID:     $OAUTH_CLIENT_ID"
  echo "  Client Secret: ${OAUTH_CLIENT_SECRET:-<missing>}"
  echo
  printf "\033[1;33m─── Test prompt for Claude ───\033[0m\n"
  echo "  Use Hermes to schedule a daily cron job that emails me a summary of my inbox at 8am."
  echo
fi

say "live status: curl -s http://localhost:8081/__hermes_mcp_loop_status | jq"
say "tear down:  bash scripts/hermes-mcp-loop-down.sh"
