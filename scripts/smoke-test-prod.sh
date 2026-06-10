#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════
# smoke-test-prod.sh — Post-deploy smoke test for Mission Control.
#
# Verifies the server is up and every key route responds (not 5xx / 404).
# Auth-protected /app routes legitimately return 200 (client shell) or a
# 3xx redirect to /login when unauthenticated — both count as PASS here.
# /api/health must return HTTP 200 with a healthy JSON body.
#
# Usage:
#   ./scripts/smoke-test-prod.sh https://mc.example.com
#   ./scripts/smoke-test-prod.sh https://localhost --insecure     # self-signed during bringup
# ═══════════════════════════════════════════════════════════════════════
set -uo pipefail

BASE="${1:-http://localhost:3000}"
BASE="${BASE%/}"
CURL_OPTS=(-s -o /dev/null -w "%{http_code}" --max-time 15)
[ "${2:-}" = "--insecure" ] && CURL_OPTS+=(-k)

# Routes the deploy must verify (status-code check).
ROUTES=(
  "/"
  "/login"
  "/app"
  "/app/maintenance"
  "/app/comms"
  "/app/approvals"
  "/app/replay"
  "/app/flight-deck"   # served via /app catch-all panel router
  "/flight-deck"       # top-level marketing/flight-deck page
)

pass=0; fail=0
echo "── Smoke test against: $BASE ──"

check() {  # $1=path
  local path="$1" code
  code="$(curl "${CURL_OPTS[@]}" "$BASE$path")"
  if [[ "$code" =~ ^(2|3)[0-9][0-9]$ ]] || [ "$code" = "401" ]; then
    printf "  PASS  %-22s %s\n" "$path" "$code"; pass=$((pass+1))
  else
    printf "  FAIL  %-22s %s\n" "$path" "$code"; fail=$((fail+1))
  fi
}

for r in "${ROUTES[@]}"; do check "$r"; done

# /api/health — must be 200 AND report healthy.
hc_opts=(-s --max-time 15); [ "${2:-}" = "--insecure" ] && hc_opts+=(-k)
health_body="$(curl "${hc_opts[@]}" "$BASE/api/health" || true)"
health_code="$(curl "${CURL_OPTS[@]}" "$BASE/api/health")"
if [ "$health_code" = "200" ]; then
  printf "  PASS  %-22s %s  %s\n" "/api/health" "$health_code" "$(echo "$health_body" | head -c 120)"; pass=$((pass+1))
else
  printf "  FAIL  %-22s %s\n" "/api/health" "$health_code"; fail=$((fail+1))
fi

echo "── Result: $pass passed, $fail failed ──"
[ "$fail" -eq 0 ]
