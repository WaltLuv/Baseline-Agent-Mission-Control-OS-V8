# VPS Hermes pairing

> **Identity:** `hermes-vps` · display name `Hermes VPS`
> **Role:** Production Controller for the 24 AI Maintenance Pipelines
> (Walt's directive 2026-06-06).
> **Mints from:** Mission Control's existing runtime-key flow
> (`POST /api/onboarding/runtime-key`) extended for `hermes-vps` per
> CONSOLIDATION_ARCHITECTURE.md §10 D-A3.

---

## What this flow does

1. **Mission Control mints** a one-shot runtime API key bound to:
   - `agent_name = hermes-vps`
   - `workspace_id = <your workspace>`
   - `scopes = ['runtime']` (operator-level — can handshake + heartbeat + report tasks)
   - `expires_at = null` (long-lived; revoke via `agent_api_keys.revoked_at`)
2. **You paste** the resulting curl command on the VPS.
3. **The VPS handshakes** with MC: a `runtime_registry` row appears for
   `(workspace, hermes-vps, <installation-id>)`.
4. **The VPS heartbeats** every N seconds (recommend 60s) to keep
   `last_seen_at` fresh and roll forward `health` + `last_task_count`.
5. **The MC UI** shows the VPS as connected, with linked workspace,
   capabilities, last-seen timestamp, and health colour.

No literal token bytes appear in this doc or in MEMORY.md. The minted
API key is shown to the operator **once**, in the MC response payload;
it lives encrypted at rest under `agent_api_keys.key_hash` (SHA-256).

---

## Pairing — step by step

### 1. Mint the runtime key (Mission Control side)

From MC's UI: open the `/app/runtimes` page → "Pair VPS Hermes" panel →
"Generate key." This calls:

```http
POST /api/onboarding/runtime-key
Content-Type: application/json
Cookie: <admin session>

{ "runtime": "hermes-vps", "label": "Hermes VPS" }
```

Response (relevant fields):

```jsonc
{
  "runtime": "hermes-vps",
  "agent_id": 42,
  "agent_name": "hermes-vps",
  "workspace_id": 1,
  "api_key": "mca_…",                // SHOWN ONCE — copy now
  "api_key_hint": "mca_abcd…wxyz",   // safe to log
  "curl_command": "curl -sS -X POST …",
  "mission_control_url": "https://mission-control.example.com"
}
```

**Copy the `curl_command` immediately.** The raw `api_key` is not
recoverable after this response — you'd have to re-mint and re-pair.

### 2. Hand the key off to the VPS

On the VPS (`root@<vps-host>:/opt/hermes#`), export the key as an env
var so the heartbeat cron picks it up without it landing in shell
history:

```bash
# Put this in /etc/hermes-vps.env (chmod 600, root:root)
MC_URL=https://mission-control.example.com
MC_API_KEY=mca_…   # the key from step 1
RUNTIME_NAME=hermes-vps
RUNTIME_KIND=hermes-vps
HERMES_WORKSPACE=/opt/data/profiles/slim-charles
```

Then source it for the current shell only — don't echo:

```bash
set -a; source /etc/hermes-vps.env; set +a
```

### 3. First handshake (registers `hermes-vps` in MC)

Paste the `curl_command` from step 1. It's pre-filled with the api key,
the kind, the installation id, the label, and the capabilities
(`production-controller`, `pipelines`, `agent-orchestration`).

```bash
curl -sS -X POST "$MC_URL/api/runtime/handshake" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $MC_API_KEY" \
  -d '{
        "kind": "hermes-vps",
        "installationId": "hermes-vps",
        "label": "Hermes VPS",
        "version": "0.15.1",
        "capabilities": ["production-controller", "pipelines", "agent-orchestration"]
      }'
```

Expected response:

```jsonc
{ "ok": true, "runtime": { "kind": "hermes-vps", "label": "Hermes VPS", … } }
```

Open MC → `/app/runtimes` and confirm `Hermes VPS` appears with a
recent `last_seen_at`.

### 4. Recurring heartbeat (keep the registry honest)

Heartbeats reuse the same endpoint with `heartbeat: true`. The cleanest
way is a systemd timer or cron. Cron example:

```bash
# /etc/cron.d/hermes-vps-heartbeat — every minute
*  *  *  *  *  root  /usr/local/sbin/hermes-vps-heartbeat.sh
```

```bash
# /usr/local/sbin/hermes-vps-heartbeat.sh — chmod 700, root:root
#!/bin/sh
set -eu
. /etc/hermes-vps.env
TASK_COUNT="$(hermes status --json 2>/dev/null | jq '.task_count // 0')"
HEALTH="$([ "$TASK_COUNT" -lt 100 ] && echo green || echo amber)"
curl -sS --max-time 5 -X POST "$MC_URL/api/runtime/handshake" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: $MC_API_KEY" \
  -d "{
        \"kind\": \"hermes-vps\",
        \"installationId\": \"hermes-vps\",
        \"heartbeat\": true,
        \"taskCount\": $TASK_COUNT,
        \"health\": \"$HEALTH\"
      }" >/dev/null
```

`recordHeartbeat()` updates `last_seen_at`, `last_task_count`, and
`health`; missing a heartbeat for >5 minutes will surface the row as
`amber`/`red` in the MC UI.

### 5. Verify in Mission Control

- `/app/runtimes` shows **Hermes VPS** in the list, kind `hermes-vps`,
  capabilities populated, `last_seen_at` < 5 minutes ago.
- `GET /api/runtimes` projection should include:
  ```jsonc
  {
    "runtime_id": "hermes-vps",
    "runtime_type": "hermes-vps",
    "status": "online",
    "health_score": 1.0,
    "active_tasks": 0,
    "heartbeat_age": 12
  }
  ```

---

## Rotation flow

When the runtime key needs to be rotated (compromise, scheduled
rotation, or policy):

1. **Revoke** the existing key:
   ```sql
   UPDATE agent_api_keys SET revoked_at = unixepoch()
   WHERE agent_id = (SELECT id FROM agents WHERE name='hermes-vps' AND workspace_id=?)
     AND revoked_at IS NULL;
   ```
   (Or via the UI — the agent's keys list shows a Revoke button.)

2. **Re-mint** by re-running step 1. The agent row is reused (singleton
   identity per workspace), but a brand-new key is minted.

3. **Roll out** by updating `MC_API_KEY` in `/etc/hermes-vps.env`. No
   restart required for the heartbeat cron — next minute uses the new
   key. If the heartbeat fails between revoke and roll-out, MC marks
   the row `amber`; that's the expected behaviour, not a regression.

---

## Revoke (kill switch)

```sql
UPDATE agent_api_keys
   SET revoked_at = unixepoch()
 WHERE agent_id = (SELECT id FROM agents WHERE name='hermes-vps' AND workspace_id=?)
   AND revoked_at IS NULL;
```

All subsequent VPS handshakes get `401`. The `runtime_registry` row
stays (history is preserved) but stops getting `last_seen_at` updates.

---

## Security rules (Walt's standing rules)

- **Never** paste the raw `api_key` into a chat, a public log, a commit,
  or a memory file. The Credentials Manager is the only authorised
  store for raw keys.
- **Never** echo `MC_API_KEY` in scripts (`set +x` before any curl).
  The heartbeat script above writes to `/dev/null` for exactly this
  reason.
- The VPS workspace `/opt/data/profiles/slim-charles` is workspace-scoped;
  the runtime key only grants `operator` role inside the linked
  workspace, not admin elsewhere.
- The mirror sync (Phase #63) is **opt-in** — VPS does not automatically
  push events to MC unless `mc mirror configure` is run on the VPS.

---

*Authored 2026-06-06 — implementation: `src/app/api/onboarding/runtime-key/route.ts`
(extended for `hermes-vps`), `src/lib/baseline-os/runtime-registry.ts`
(added `'hermes-vps'` kind). Production deploy of this flow remains
blocked on the §4.1 rotation actions in
`docs/security/TOKEN_EXPOSURE_REPORT.md`.*
