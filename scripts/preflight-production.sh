#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────
# Mission Control v3 — Production Preflight
#
# Fails fast if the supplied env file would deploy with insecure
# defaults. Run this before `doctl apps update` for the first deploy
# and any time you change production env.
#
# Usage:
#   ./scripts/preflight-production.sh .env.production
# ─────────────────────────────────────────────────────────────────────
set -euo pipefail

ENV_FILE="${1:-.env.production}"
[ -f "$ENV_FILE" ] || { echo "ERROR: $ENV_FILE not found" >&2; exit 1; }

# shellcheck disable=SC1090
set -a; . "$ENV_FILE"; set +a

errors=0
warns=0
err()  { printf "FAIL  %s\n" "$1" >&2; errors=$((errors + 1)); }
warn() { printf "WARN  %s\n" "$1" >&2; warns=$((warns + 1)); }
pass() { printf "PASS  %s\n" "$1"; }

# ─── Required secrets ───────────────────────────────────────────────
for var in AUTH_USER AUTH_PASS AUTH_SECRET API_KEY SHARE_SIGNING_SECRET MC_ALLOWED_HOSTS MC_HOST; do
  v="$(eval echo "\${$var:-}")"
  if [ -z "$v" ] || [ "$v" = "CHANGE_ME" ]; then
    err "$var is empty or still CHANGE_ME"
  else
    pass "$var set"
  fi
done

# ─── Cookie / network lockdown ──────────────────────────────────────
if [ "${MC_COOKIE_SECURE:-}" != "1" ] && [ "${MC_COOKIE_SECURE:-}" != "true" ]; then
  err "MC_COOKIE_SECURE must be 1 in production"
fi
if [ "${MC_COOKIE_SAMESITE:-}" != "strict" ] && [ "${MC_COOKIE_SAMESITE:-}" != "lax" ]; then
  warn "MC_COOKIE_SAMESITE should be 'strict' (got '${MC_COOKIE_SAMESITE:-}')"
fi
if [ -n "${MC_ALLOW_ANY_HOST:-}" ] && [ "$MC_ALLOW_ANY_HOST" != "0" ] && [ "$MC_ALLOW_ANY_HOST" != "false" ]; then
  err "MC_ALLOW_ANY_HOST is set — must be unset in production"
fi
if [ "${MC_ENABLE_HSTS:-}" != "1" ]; then
  warn "MC_ENABLE_HSTS not enabled — HSTS recommended for HTTPS"
fi

# ─── Allowed hosts — no wildcards ───────────────────────────────────
case "${MC_ALLOWED_HOSTS:-}" in
  *"*"*) err "MC_ALLOWED_HOSTS contains a wildcard — not allowed in production" ;;
  "")    err "MC_ALLOWED_HOSTS is empty" ;;
  *)     pass "MC_ALLOWED_HOSTS has no wildcards" ;;
esac

# ─── Gateway lockdown ───────────────────────────────────────────────
case "${OPENCLAW_GATEWAY_HOST:-}" in
  127.0.0.1|localhost|"") pass "OPENCLAW_GATEWAY_HOST=${OPENCLAW_GATEWAY_HOST:-unset} (local-only)" ;;
  *) err "OPENCLAW_GATEWAY_HOST=${OPENCLAW_GATEWAY_HOST} — gateway must stay local" ;;
esac

# ─── Secret strength ─────────────────────────────────────────────────
for var in AUTH_SECRET API_KEY SHARE_SIGNING_SECRET; do
  v="$(eval echo "\${$var:-}")"
  if [ -n "$v" ] && [ ${#v} -lt 32 ]; then
    warn "$var is shorter than 32 chars — consider regenerating with: openssl rand -hex 32"
  fi
done

# ─── Stripe ─────────────────────────────────────────────────────────
if [ -n "${STRIPE_SECRET_KEY:-}" ]; then
  case "$STRIPE_SECRET_KEY" in
    sk_test_*) warn "STRIPE_SECRET_KEY is a test key — mock mode will run in production" ;;
    sk_live_*) pass "Stripe live mode" ;;
    *)         warn "STRIPE_SECRET_KEY is set but doesn't start with sk_test_/sk_live_" ;;
  esac
else
  warn "STRIPE_SECRET_KEY unset — billing will run in mock mode"
fi

# ─── Summary ─────────────────────────────────────────────────────────
echo ""
if [ "$errors" -gt 0 ]; then
  printf "Preflight FAILED — %d error(s), %d warning(s)\n" "$errors" "$warns" >&2
  exit 1
fi
printf "Preflight PASSED — %d warning(s)\n" "$warns"
