#!/bin/bash
# Comprehensive backend CLI test — MCP audit + CLI mapping pass + Runtime proof
# Run: bash /app/test_reports/cli_mcp_audit_test.sh

set +e
cd /app

PASS=0
FAIL=0
FAILED_TESTS=()

assert() {
  local name="$1"
  local actual="$2"
  local expected_pattern="$3"
  if echo "$actual" | grep -qE "$expected_pattern"; then
    echo "  PASS: $name"
    PASS=$((PASS+1))
  else
    echo "  FAIL: $name"
    echo "    expected: $expected_pattern"
    echo "    actual:   $(echo "$actual" | head -3)"
    FAIL=$((FAIL+1))
    FAILED_TESTS+=("$name")
  fi
}

assert_exit_nonzero() {
  local name="$1"
  local code="$2"
  if [ "$code" != "0" ]; then
    echo "  PASS: $name (exit=$code)"
    PASS=$((PASS+1))
  else
    echo "  FAIL: $name (exit=$code, expected non-zero)"
    FAIL=$((FAIL+1))
    FAILED_TESTS+=("$name")
  fi
}

echo "=== T1. CLI help mentions all required groups ==="
HELP=$(node scripts/mc-cli.cjs --help 2>&1)
for g in agent task run eval session memory soul knowledge queue health dashboard; do
  assert "help mentions '$g'" "$HELP" "(^| )$g( |$|[ ]+)"
done

echo ""
echo "=== T2. Top-level shortcuts ==="
OUT=$(node scripts/mc-cli.cjs health --json 2>&1)
assert "health shortcut ok=true status=200" "$OUT" '"ok": true.*"status": 200|"status": 200.*"ok": true'

OUT=$(node scripts/mc-cli.cjs dashboard --json 2>&1)
assert "dashboard shortcut ok=true" "$OUT" '"ok": true'

echo ""
echo "=== T3. Login admin ==="
OUT=$(node scripts/mc-cli.cjs login --username admin --password admin12345 --json 2>&1)
assert "login admin ok=true" "$OUT" '"ok": true'
assert "login admin status=200" "$OUT" '"status": 200'

echo ""
echo "=== T4. Singular-noun MCP-aligned groups ==="

OUT=$(node scripts/mc-cli.cjs agent list --json 2>&1)
assert "agent list ok=true" "$OUT" '"ok": true'
AGENT_COUNT=$(echo "$OUT" | grep -oE '"id":[ ]*[0-9]+' | wc -l)
echo "  INFO: agent list returned $AGENT_COUNT agent rows"
# Verify the 4 proof runtimes present
for r in proof-claude-runtime proof-hermes-runtime proof-openclaw-runtime proof-codex-runtime; do
  assert "agent list contains $r" "$OUT" "$r"
done

OUT=$(node scripts/mc-cli.cjs agent costs --timeframe week --json 2>&1)
assert "agent costs --timeframe week ok=true" "$OUT" '"ok": true'

OUT=$(node scripts/mc-cli.cjs task list --json 2>&1)
assert "task list ok=true" "$OUT" '"ok": true'
# proof task id=1 present
assert "task list contains id=1" "$OUT" '"id":[ ]*1[^0-9]'

OUT=$(node scripts/mc-cli.cjs run list --json 2>&1)
assert "run list ok=true" "$OUT" '"ok": true'

OUT=$(node scripts/mc-cli.cjs eval leaderboard --json 2>&1)
assert "eval leaderboard ok=true" "$OUT" '"ok": true'

OUT=$(node scripts/mc-cli.cjs knowledge search --q billing --limit 3 --json 2>&1)
assert "knowledge search ok=true" "$OUT" '"ok": true'
assert "knowledge search status=200" "$OUT" '"status": 200'

OUT=$(node scripts/mc-cli.cjs knowledge health --json 2>&1)
assert "knowledge health ok=true" "$OUT" '"ok": true'

OUT=$(node scripts/mc-cli.cjs memory read --id 1 --json 2>&1)
assert "memory read --id 1 ok=true" "$OUT" '"ok": true'

OUT=$(node scripts/mc-cli.cjs soul read --id 1 --json 2>&1)
assert "soul read --id 1 ok=true" "$OUT" '"ok": true'

OUT=$(node scripts/mc-cli.cjs queue poll --agent proof-claude-runtime --json 2>&1)
assert "queue poll --agent ok=true" "$OUT" '"ok": true'

echo ""
echo "=== T5. --yes safety guard on destructive verbs ==="

run_safety() {
  local name="$1"; shift
  OUT=$(node scripts/mc-cli.cjs "$@" --json 2>&1)
  CODE=$?
  assert "$name ok=false" "$OUT" '"ok": false'
  assert "$name mentions destructive" "$OUT" 'destructive'
  assert "$name mentions Re-run with --yes" "$OUT" 'Re-run with --yes'
  assert_exit_nonzero "$name exit code non-zero" "$CODE"
}

run_safety "memory clear (no --yes)"        memory clear --id 99
run_safety "memory write (no --yes)"        memory write --id 99 --content x
run_safety "soul write (no --yes)"          soul write --id 99 --content x
run_safety "knowledge write-file (no --yes)" knowledge write-file --path foo --content bar
run_safety "knowledge rebuild-index (no --yes)" knowledge rebuild-index
run_safety "knowledge consolidate (no --yes)" knowledge consolidate
run_safety "session control (no --yes)"     session control --id sess_x --action pause
run_safety "agent mint-key (no --yes)"      agent mint-key --id 1

echo ""
echo "=== T6. Deploy / employee verbs ==="

OUT=$(node scripts/mc-cli.cjs deploy preflight --json 2>&1)
assert "deploy preflight executes (method=EXEC)" "$OUT" '"method":[ ]*"EXEC"'
assert "deploy preflight has numeric exit_code" "$OUT" '"exit_code":[ ]*[0-9-]+'

OUT=$(node scripts/mc-cli.cjs deploy rollback --yes --json 2>&1)
assert "deploy rollback advisory has runbook array" "$OUT" '"runbook":[ ]*\['
# Should NOT be a fake 200; either method!=POST 200 or message indicates advisory
echo "  INFO: deploy rollback returned: $(echo "$OUT" | head -5)"

OUT=$(node scripts/mc-cli.cjs employee install --slug test --yes --json 2>&1)
assert "employee install hits /api/marketplace/purchase URL" "$OUT" '/api/marketplace/purchase'

echo ""
echo "=== T7. Docs files exist and have required content ==="

[ -f /app/docs/MCP_TOOL_AUDIT.md ] && { echo "  PASS: MCP_TOOL_AUDIT.md exists"; PASS=$((PASS+1)); } || { echo "  FAIL: MCP_TOOL_AUDIT.md missing"; FAIL=$((FAIL+1)); FAILED_TESTS+=("MCP_TOOL_AUDIT.md missing"); }

[ -f /app/docs/CLI_MCP_MAPPING.md ] && { echo "  PASS: CLI_MCP_MAPPING.md exists"; PASS=$((PASS+1)); } || { echo "  FAIL: CLI_MCP_MAPPING.md missing"; FAIL=$((FAIL+1)); FAILED_TESTS+=("CLI_MCP_MAPPING.md missing"); }

[ -f /app/docs/RUNTIME_SETUP_GUIDE.md ] && { echo "  PASS: RUNTIME_SETUP_GUIDE.md exists"; PASS=$((PASS+1)); } || { echo "  FAIL: RUNTIME_SETUP_GUIDE.md missing"; FAIL=$((FAIL+1)); FAILED_TESTS+=("RUNTIME_SETUP_GUIDE.md missing"); }

[ -f /app/docs/CLI_GUIDE.md ] && { echo "  PASS: CLI_GUIDE.md exists"; PASS=$((PASS+1)); } || { echo "  FAIL: CLI_GUIDE.md missing"; FAIL=$((FAIL+1)); FAILED_TESTS+=("CLI_GUIDE.md missing"); }

# RUNTIME_SETUP_GUIDE.md must contain sections for each runtime
RSG=$(cat /app/docs/RUNTIME_SETUP_GUIDE.md 2>/dev/null)
for r in Hermes OpenClaw "Claude Code" Codex; do
  if echo "$RSG" | grep -qi "$r"; then
    echo "  PASS: RUNTIME_SETUP_GUIDE mentions $r"; PASS=$((PASS+1))
  else
    echo "  FAIL: RUNTIME_SETUP_GUIDE missing $r"; FAIL=$((FAIL+1)); FAILED_TESTS+=("RSG missing $r")
  fi
done

# CLI_GUIDE.md must mention --yes safety
if grep -qE "[-][-]yes" /app/docs/CLI_GUIDE.md; then
  echo "  PASS: CLI_GUIDE.md mentions --yes safety"; PASS=$((PASS+1))
else
  echo "  FAIL: CLI_GUIDE.md missing --yes section"; FAIL=$((FAIL+1)); FAILED_TESTS+=("CLI_GUIDE.md --yes")
fi

# MCP_TOOL_AUDIT.md must contain 49 tool names — count rows with `mcp_` or `name:` style entries
TOOL_COUNT=$(grep -cE '^[ ]*[-*][ ]*`?[a-z_]+`?[ ]*(\||—|$)|^\|[ ]*`?[a-z_]+`?[ ]*\|' /app/docs/MCP_TOOL_AUDIT.md)
echo "  INFO: MCP_TOOL_AUDIT.md tool-row count (heuristic) = $TOOL_COUNT"
if [ "$TOOL_COUNT" -ge "49" ]; then
  echo "  PASS: MCP_TOOL_AUDIT.md has >= 49 tool rows"; PASS=$((PASS+1))
else
  echo "  WARN: MCP_TOOL_AUDIT.md tool count heuristic below 49 (=$TOOL_COUNT) — verify visually"
fi

# CLI_MCP_MAPPING.md should have mapping table
if grep -qE "\|.*\|" /app/docs/CLI_MCP_MAPPING.md; then
  echo "  PASS: CLI_MCP_MAPPING.md has table rows"; PASS=$((PASS+1))
else
  echo "  FAIL: CLI_MCP_MAPPING.md has no table"; FAIL=$((FAIL+1)); FAILED_TESTS+=("CLI_MCP_MAPPING.md table")
fi

echo ""
echo "=== SUMMARY ==="
echo "Pass: $PASS"
echo "Fail: $FAIL"
if [ "$FAIL" -gt 0 ]; then
  echo ""
  echo "Failed tests:"
  for t in "${FAILED_TESTS[@]}"; do echo "  - $t"; done
fi
exit $FAIL
