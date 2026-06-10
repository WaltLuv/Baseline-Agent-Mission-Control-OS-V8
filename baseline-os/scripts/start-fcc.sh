#!/usr/bin/env bash
# Free Claude Code — one-click launcher
#
# Usage:
#   ./start-fcc.sh         → starts the proxy in the foreground
#   ./start-fcc.sh --bg    → starts the proxy in the background (logs to /tmp/fcc.log)
#   ./start-fcc.sh --stop  → kills any running fcc-server
#   ./start-fcc.sh --status → shows whether the proxy is reachable
#
# Drop this anywhere on your PATH. Or just run it from this folder.

set -euo pipefail

PORT="${FCC_PORT:-8082}"
LOG_FILE="${FCC_LOG:-/tmp/fcc.log}"

cmd_status() {
  if curl -sf -o /dev/null "http://127.0.0.1:${PORT}/health"; then
    echo "✅ fcc-server is LIVE on :${PORT}"
    echo "   logs: ${LOG_FILE}"
    echo "   admin UI: http://127.0.0.1:${PORT}/admin"
  else
    echo "❌ fcc-server is NOT running on :${PORT}"
    return 1
  fi
}

cmd_stop() {
  local pid
  pid=$(lsof -ti :"${PORT}" -sTCP:LISTEN 2>/dev/null || true)
  if [[ -z "${pid}" ]]; then
    echo "Nothing to stop on :${PORT}"
    return 0
  fi
  echo "Stopping fcc-server (PID ${pid})…"
  kill "${pid}" || true
  sleep 1
  if kill -0 "${pid}" 2>/dev/null; then
    kill -9 "${pid}" 2>/dev/null || true
  fi
  echo "Stopped."
}

cmd_start_fg() {
  if curl -sf -o /dev/null "http://127.0.0.1:${PORT}/health"; then
    echo "fcc-server already running on :${PORT}"
    exit 0
  fi
  echo "Starting fcc-server on :${PORT} (Ctrl+C to stop)…"
  exec fcc-server
}

cmd_start_bg() {
  if curl -sf -o /dev/null "http://127.0.0.1:${PORT}/health"; then
    echo "fcc-server already running on :${PORT}"
    exit 0
  fi
  echo "Starting fcc-server in background → ${LOG_FILE}"
  nohup fcc-server > "${LOG_FILE}" 2>&1 &
  disown
  sleep 2
  cmd_status
}

# Pre-flight: is the binary installed?
if ! command -v fcc-server >/dev/null 2>&1; then
  echo "❌ fcc-server is not on your PATH."
  echo "   Install it first:"
  echo "   uv tool install --force \"git+https://github.com/Alishahryar1/free-claude-code.git\""
  exit 1
fi

# Pre-flight: is the config file in place?
if [[ ! -f "${HOME}/.fcc/.env" ]]; then
  echo "❌ No config at ~/.fcc/.env"
  echo "   Run: fcc-init"
  echo "   Then edit ~/.fcc/.env and paste your OpenRouter key."
  exit 1
fi

case "${1:-}" in
  --bg)     cmd_start_bg ;;
  --stop)   cmd_stop ;;
  --status) cmd_status ;;
  -h|--help)
    sed -n '2,11p' "$0"
    ;;
  *)        cmd_start_fg ;;
esac
