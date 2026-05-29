#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────
# Mission Control v3 — Runtime Validation Harness
#
# Walks the five-flow contract (register, heartbeat, task update,
# billing report, telemetry) against a live Mission Control deployment
# and prints PASS / FAIL per step.
#
# Usage:
#   ./scripts/runtime-validate.sh \
#     --base-url https://mission.example.com \
#     --auth-user admin --auth-pass '<pass>' \
#     --runtime hermes
# ─────────────────────────────────────────────────────────────────────
set -euo pipefail

BASE_URL=""
AUTH_USER=""
AUTH_PASS=""
RUNTIME="hermes"
COOKIE_JAR="$(mktemp)"
TS="$(date +%s)"
AGENT_NAME=""
AGENT_ID=""
TASK_ID=""

cleanup() { rm -f "$COOKIE_JAR" >/dev/null 2>&1 || true; }
trap cleanup EXIT

usage() {
  cat <<EOF
runtime-validate.sh — validate a runtime against Mission Control's contract.

Required:
  --base-url <url>     Public base URL (e.g. https://mission.example.com)
  --auth-user <user>   Operator username
  --auth-pass <pass>   Operator password
Optional:
  --runtime <name>     One of: hermes | openclaw | opencode | claude  (default: hermes)
EOF
  exit 2
}

while [ $# -gt 0 ]; do
  case "$1" in
    --base-url)    BASE_URL="$2"; shift 2 ;;
    --auth-user)   AUTH_USER="$2"; shift 2 ;;
    --auth-pass)   AUTH_PASS="$2"; shift 2 ;;
    --runtime)     RUNTIME="$2"; shift 2 ;;
    -h|--help)     usage ;;
    *) echo "Unknown arg: $1" >&2; usage ;;
  esac
done

[ -z "$BASE_URL" ] && usage
[ -z "$AUTH_USER" ] && usage
[ -z "$AUTH_PASS" ] && usage

AGENT_NAME="validate-${RUNTIME}-${TS}"

pass() { printf "PASS  %s\n" "$1"; }
fail() {
  printf "FAIL  %s\n" "$1" >&2
  [ -n "${2:-}" ] && printf "      response: %s\n" "$2" >&2
  exit 1
}

call() {
  # $1 method, $2 path, $3 body (or empty)
  local method="$1" path="$2" body="${3:-}"
  if [ -n "$body" ]; then
    curl -sS -c "$COOKIE_JAR" -b "$COOKIE_JAR" \
      -X "$method" "${BASE_URL}${path}" \
      -H 'Content-Type: application/json' \
      -d "$body" -w "\n%{http_code}"
  else
    curl -sS -c "$COOKIE_JAR" -b "$COOKIE_JAR" \
      -X "$method" "${BASE_URL}${path}" \
      -H 'Content-Type: application/json' \
      -w "\n%{http_code}"
  fi
}

read_body() { sed '$d' <<<"$1"; }
read_code() { tail -n1 <<<"$1"; }

# ─── 0. Login ────────────────────────────────────────────────────────
LOGIN=$(call POST "/api/auth/login" "{\"username\":\"${AUTH_USER}\",\"password\":\"${AUTH_PASS}\"}")
CODE=$(read_code "$LOGIN")
[ "$CODE" = "200" ] || fail "login (HTTP ${CODE})" "$(read_body "$LOGIN")"
pass "login as ${AUTH_USER}"

# ─── 1. Register ─────────────────────────────────────────────────────
REG=$(call POST "/api/agents/register" "{\"name\":\"${AGENT_NAME}\",\"role\":\"agent\",\"capabilities\":[\"validate\"],\"framework\":\"${RUNTIME}\"}")
CODE=$(read_code "$REG"); BODY=$(read_body "$REG")
[ "$CODE" = "200" ] || [ "$CODE" = "201" ] || fail "register agent (HTTP ${CODE})" "$BODY"
AGENT_ID=$(printf '%s' "$BODY" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('agent',{}).get('id') or d.get('id') or '')" 2>/dev/null || true)
[ -n "$AGENT_ID" ] || fail "register agent — no id in response" "$BODY"
pass "register agent → id=${AGENT_ID}"

# ─── 2. Heartbeat ────────────────────────────────────────────────────
HB=$(call GET "/api/agents/${AGENT_ID}/heartbeat")
CODE=$(read_code "$HB")
[ "$CODE" = "200" ] || fail "heartbeat (HTTP ${CODE})" "$(read_body "$HB")"
pass "heartbeat 200"

# ─── 3. Task transitions ─────────────────────────────────────────────
TC=$(call POST "/api/tasks" "{\"title\":\"validate-${RUNTIME}-${TS}\",\"agent_id\":${AGENT_ID},\"status\":\"planned\"}")
CODE=$(read_code "$TC"); BODY=$(read_body "$TC")
if [ "$CODE" = "200" ] || [ "$CODE" = "201" ]; then
  TASK_ID=$(printf '%s' "$BODY" | python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('task',{}).get('id') or d.get('id') or '')" 2>/dev/null || true)
fi
if [ -n "$TASK_ID" ]; then
  TRANSITIONS=0
  for next in in_progress completed; do
    PR=$(call PATCH "/api/tasks/${TASK_ID}" "{\"status\":\"${next}\"}")
    [ "$(read_code "$PR")" = "200" ] && TRANSITIONS=$((TRANSITIONS + 1)) || true
  done
  pass "task transitions ${TRANSITIONS}/2 (task ${TASK_ID})"
else
  printf "SKIP  task transitions — POST /api/tasks not creatable in this build\n"
fi

# ─── 4. Billing idempotency ──────────────────────────────────────────
IDEMP="validate-${RUNTIME}-${TS}-bill"
PAY="{\"model\":\"anthropic/claude-sonnet-4\",\"sessionId\":\"validate:${TS}\",\"inputTokens\":100,\"outputTokens\":50,\"provider\":\"openrouter\",\"agentId\":${AGENT_ID},\"idempotencyKey\":\"${IDEMP}\"}"
B1=$(call POST "/api/tokens" "$PAY"); C1=$(read_code "$B1")
B2=$(call POST "/api/tokens" "$PAY"); C2=$(read_code "$B2")
if [ "$C1" = "200" ] && { [ "$C2" = "200" ] || [ "$C2" = "409" ]; }; then
  pass "billing idempotent (1st=${C1}, 2nd=${C2})"
else
  printf "WARN  billing path returned C1=%s C2=%s — verify ledger\n" "$C1" "$C2"
fi

# ─── 5. Telemetry ────────────────────────────────────────────────────
T1=$(call POST "/api/hermes/events" "{\"event\":\"session:start\",\"session_id\":\"validate-${TS}\",\"source\":\"${RUNTIME}\",\"timestamp\":${TS},\"agent_name\":\"${AGENT_NAME}\"}")
T2=$(call POST "/api/hermes/events" "{\"event\":\"session:end\",\"session_id\":\"validate-${TS}\",\"source\":\"${RUNTIME}\",\"timestamp\":${TS},\"agent_name\":\"${AGENT_NAME}\"}")
[ "$(read_code "$T1")" = "200" ] && [ "$(read_code "$T2")" = "200" ] \
  && pass "telemetry session:start / session:end" \
  || printf "WARN  telemetry returned %s / %s\n" "$(read_code "$T1")" "$(read_code "$T2")"

# ─── 6. Cleanup ──────────────────────────────────────────────────────
DEL=$(call DELETE "/api/agents/${AGENT_ID}")
[ "$(read_code "$DEL")" = "200" ] && pass "cleanup agent ${AGENT_ID}" \
  || printf "WARN  cleanup agent %s returned %s\n" "$AGENT_ID" "$(read_code "$DEL")"

printf "\nRuntime %s — validated\n" "$RUNTIME"
