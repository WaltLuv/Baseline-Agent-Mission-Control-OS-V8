#!/bin/bash
# CLI tests
set +e
cd /app
PASS=0; FAIL=0
declare -a FAILURES
check() { if [ "$2" = "1" ]; then echo "PASS: $1"; PASS=$((PASS+1)); else echo "FAIL: $1 -- $3"; FAIL=$((FAIL+1)); FAILURES+=("$1"); fi; }

echo "=== CLI: --help ==="
HELP=$(node scripts/mc-cli.cjs --help 2>&1)
RC=$?
[ $RC -eq 0 ] && check "help_exit_0" 1 || check "help_exit_0" 0 "rc=$RC"
for g in runtime gateway workspace team employee skill billing deploy flightdeck; do
  echo "$HELP" | grep -q "  $g " && check "help_lists_$g" 1 || check "help_lists_$g" 0
done

echo ""
echo "=== CLI: version --json ==="
V=$(node scripts/mc-cli.cjs version --json 2>&1)
echo "$V" | head -20
echo "$V" | python3 -c 'import sys,json; d=json.load(sys.stdin); assert "version" in d["cli"]; assert d["mission_control"]["reachable"]==True' && check "version_json" 1 || check "version_json" 0

echo ""
echo "=== CLI: status health --json ==="
SH=$(node scripts/mc-cli.cjs status health --json 2>&1)
echo "$SH" | python3 -c 'import sys,json; d=json.load(sys.stdin); assert d["ok"]==True; assert d["status"]==200' && check "status_health" 1 || check "status_health" 0
echo "$SH" | head -3

echo ""
echo "=== CLI: flightdeck downloads --json ==="
FD=$(node scripts/mc-cli.cjs flightdeck downloads --json 2>&1)
echo "$FD" | python3 -c '
import sys,json
d=json.load(sys.stdin)
assert d["ok"]==True, f"ok={d.get(\"ok\")}"
assert d["data"]["available_count"]==2, f"avail={d[\"data\"][\"available_count\"]}"
assert len(d["data"]["artifacts"])==6, f"len={len(d[\"data\"][\"artifacts\"])}"
print("OK")
' && check "flightdeck_downloads" 1 || check "flightdeck_downloads" 0

echo ""
echo "=== CLI: flightdeck doctor --json ==="
FDD=$(node scripts/mc-cli.cjs flightdeck doctor --json 2>&1)
echo "$FDD" | python3 -c '
import sys,json
d=json.load(sys.stdin)
assert d["ok"]==True
checks={c["name"]:c["ok"] for c in d["data"]["checks"]}
assert checks.get("any_artifact_available")==True, f"checks={checks}"
print("OK")
' && check "flightdeck_doctor" 1 || check "flightdeck_doctor" 0

echo ""
echo "=== CLI: config current --json ==="
CC=$(node scripts/mc-cli.cjs config current --json 2>&1)
echo "$CC" | python3 -c 'import sys,json; d=json.load(sys.stdin); assert "url" in d["data"]; print(d["data"])' && check "config_current" 1 || check "config_current" 0

echo ""
echo "=== CLI: login --json ==="
LO=$(node scripts/mc-cli.cjs login --username admin --password admin12345 --json 2>&1)
echo "$LO" | head -30
echo "$LO" | python3 -c '
import sys,json
d=json.load(sys.stdin)
assert d["ok"]==True
assert d["data"]["user"]["role"]=="admin", f"role={d[\"data\"][\"user\"].get(\"role\")}"
assert d["data"].get("saved_cookie")==True
print("OK")
' && check "login_admin" 1 || check "login_admin" 0

# verify cookie file written
COOKIE_FILE="$HOME/.mission-control/profiles/default.json"
[ -f "$COOKIE_FILE" ] && grep -q '"cookie"' "$COOKIE_FILE" && check "cookie_file_written" 1 || check "cookie_file_written" 0

echo ""
echo "=== CLI: runtime list --json ==="
RL=$(node scripts/mc-cli.cjs runtime list --json 2>&1)
echo "$RL" | python3 -c 'import sys,json; d=json.load(sys.stdin); assert d["ok"]==True; assert d["status"]==200' && check "runtime_list" 1 || check "runtime_list" 0

echo ""
echo "=== CLI: employee list --json ==="
EL=$(node scripts/mc-cli.cjs employee list --json 2>&1)
echo "$EL" | python3 -c 'import sys,json; d=json.load(sys.stdin); assert d["ok"]==True; assert d["status"]==200' && check "employee_list" 1 || check "employee_list" 0

echo ""
echo "=== CLI: workspace list --json ==="
WL=$(node scripts/mc-cli.cjs workspace list --json 2>&1)
echo "$WL" | python3 -c 'import sys,json; d=json.load(sys.stdin); assert d["ok"]==True; assert d["status"]==200' && check "workspace_list" 1 || check "workspace_list" 0

echo ""
echo "=== CLI: employee install (planned) ==="
EI=$(node scripts/mc-cli.cjs employee install --json 2>&1)
echo "$EI" | python3 -c '
import sys,json
d=json.load(sys.stdin)
assert d["data"]["status"]=="planned", d
print("OK")
' && check "employee_install_planned" 1 || check "employee_install_planned" 0

echo ""
echo "=== CLI: deploy preflight (planned) ==="
DP=$(node scripts/mc-cli.cjs deploy preflight --json 2>&1)
echo "$DP" | python3 -c '
import sys,json
d=json.load(sys.stdin)
assert d["data"]["status"]=="planned", d
print("OK")
' && check "deploy_preflight_planned" 1 || check "deploy_preflight_planned" 0

echo ""
echo "=== CLI: deploy env-check ==="
DE=$(node scripts/mc-cli.cjs deploy env-check --json 2>&1)
echo "$DE" | python3 -c '
import sys,json
d=json.load(sys.stdin)
assert d["ok"]==True
assert "node_version" in d["data"]
print("OK")
' && check "deploy_env_check" 1 || check "deploy_env_check" 0

echo ""
echo "=== CLI: flightdeck release ==="
FR=$(node scripts/mc-cli.cjs flightdeck release --json 2>&1)
echo "$FR" | python3 -c '
import sys,json
d=json.load(sys.stdin)
assert d["ok"]==True
cmds=d["data"].get("commands",[])
assert any("git tag" in c for c in cmds), cmds
print("OK")
' && check "flightdeck_release" 1 || check "flightdeck_release" 0

echo ""
echo "=== Results: PASS=$PASS FAIL=$FAIL ==="
for f in "${FAILURES[@]}"; do echo "  - $f"; done
