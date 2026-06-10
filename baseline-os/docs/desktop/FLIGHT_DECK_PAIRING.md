# Flight Deck ↔ Mission Control — Device Pairing

How a Flight Deck desktop app securely pairs with a Mission Control workspace,
so Mission Control can show **"Flight Deck online."**

> Flight Deck is the secure desktop connector for the **Baseline Automations
> ecosystem** — any business vertical, not just property management / real estate.

## What pairing is

Pairing links one device to one Mission Control workspace with a **scoped,
revocable device token**. The token lives in the **macOS keychain** (never in a
plaintext file, never in logs). Mission Control stores only the token's SHA-256
hash. The device heartbeats so the workspace sees it online; an owner/admin can
revoke it at any time.

## The handshake (real, not faked)

```
Flight Deck                              Mission Control
-----------                              ---------------
1. Pair this device
2. POST /api/devices/pairing/start  ──▶  create pending device,
   {device_id, name, platform, ver}      return {pairing_code, claim_token, url}
3. show pairing_code, open url
                                         4. user logs in, opens Flight Deck panel
                                         5. POST /api/devices/pairing/approve
                                            (owner/admin) {pairing_code, role, perms}
                                            → status=paired, role, permissions
6. GET /api/devices/:device_id/status
   ?claim=<claim_token>  ───────────▶     mint device token ONCE, return it
   store device_token in keychain         (hash stored; claim token consumed)
7. POST /api/devices/heartbeat      ──▶   update last_seen → "online"
   Authorization: Bearer <token>
                                         8. (later) POST /api/devices/:id/revoke
9. next heartbeat → 401 revoked  ◀──────  token hash cleared
   delete local token, show "pair again"
```

The **claim token** (returned once at start) is what lets *this* device — and
only this device — retrieve the issued token after approval. The **device token**
is the long-lived bearer credential for heartbeats.

## Install

1. Build/obtain `Baseline Flight Deck.app` (or the `.dmg`) — see
   [TAURI_FLIGHT_DECK.md](./TAURI_FLIGHT_DECK.md#build--run).
2. Open it. (Unsigned today → right-click → Open to pass Gatekeeper. Signing is on the roadmap.)

## How to pair (under 5 minutes)

1. In Flight Deck, click **Pair this device**.
2. Enter your **Mission Control URL** (e.g. `https://mc.yourcompany.com`) and click **Get pairing code**.
3. A pairing code appears (e.g. `ABCD-2345`). Click **Open Mission Control ↗**.
4. Sign in to Mission Control → **Flight Deck** panel → **Paired Devices** → approve the code (owner/admin), pick a **role**.
5. Flight Deck polls, receives its token, stores it in the keychain, and flips to **Paired** — heartbeating. Mission Control shows it **online**.

## How to revoke

- **From Mission Control** (owner/admin): Flight Deck panel → Paired Devices → **Revoke**. The device drops its token on the next heartbeat and shows "Device revoked — pair again."
- **From the device:** click **Unpair** — deletes the keychain token + clears local pairing state.

## Roles & permissions (RBAC)

| Role | Can | Default device permissions |
|---|---|---|
| **owner / admin** | approve devices, revoke devices, manage permissions | all (`runtime_status`, `open_local_urls`, `graphify_query`, `start_runtime`, `stop_runtime`, `file_access`, `browser_worker`, `computer_use`) |
| **operator** | use the paired device, heartbeat, run allowed local tasks | `runtime_status`, `open_local_urls`, `graphify_query`, `start_runtime`, `stop_runtime` |
| **limited** | read-only health/status | `runtime_status` |

No broad access by default — permissions are least-privilege per role and can be
narrowed at approval time. Approve/revoke are gated to **owner/admin** server-side.

## Security model

- **No plaintext tokens** — device + claim tokens live in the macOS keychain; Mission Control stores only SHA-256 hashes.
- **No tokens in logs** — pairing audit events record device id / role / actor, never secrets.
- **Workspace-scoped** — every device read/write is scoped to the caller's workspace; you cannot list or revoke another workspace's devices.
- **Revocation clears local auth** — a revoked/expired token (401/410) makes Flight Deck delete its keychain token.
- **Audit log** — `device_pairing_started`, `device_paired`, `device_revoked` are written to `security_events`.
- **Allowlisted local actions only** — no arbitrary shell; loopback-only URL opening.
- **Pairing code expiry** — pending codes expire after 10 minutes.

## Troubleshooting

| Symptom | Fix |
|---|---|
| "Couldn't reach Mission Control" | Check the URL; ensure MC is running and reachable from this device. |
| Code shows but never approves | Approve it in MC → Flight Deck → Paired Devices (you must be owner/admin). |
| "Device revoked — pair again" | An admin revoked it (or the token expired). Click Pair this device again. |
| Approve button missing in MC | Your MC user role isn't owner/admin. |
| Device shows offline in MC | Flight Deck must be open to heartbeat (background daemon is future work). |

## API reference

| Route | Auth | Purpose |
|---|---|---|
| `POST /api/devices/pairing/start` | none (pending) | register a device, get code + claim token |
| `POST /api/devices/pairing/approve` | session + owner/admin + workspace | approve a code into the workspace with role/perms |
| `GET /api/devices/:device_id/status?claim=…` | claim token (device) / session (view) | poll + one-time token claim, or status view |
| `POST /api/devices/heartbeat` | Bearer device token | mark online; 401 if revoked / 410 if expired |
| `GET /api/devices` | session + workspace | list workspace devices + summary |
| `POST /api/devices/:id/revoke` | session + owner/admin + workspace | revoke a device |

## Roadmap (not yet built)

Websocket revocation push (instant, vs. poll), device-token rotation, code
signing + notarization, Windows/Linux packaging, always-on background daemon.
