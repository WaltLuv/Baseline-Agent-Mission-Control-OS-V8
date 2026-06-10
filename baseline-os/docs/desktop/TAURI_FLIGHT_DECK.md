# Baseline Flight Deck — The Secure Desktop Connector for the PropControl Ecosystem

Flight Deck is a **customer-facing desktop app** that securely connects a user's
local machine — files, business tools, browser workers, AI workforce — to their
**Mission Control** cloud workspace. It is **not** a personal/dev tool; it is the
installable runtime connector for the whole PropControl ecosystem (Mission
Control, Baseline OS, PropControl, VisionOps, VoiceOps, PropControl Empire, and
future products).

> **Mission Control** runs your business in the cloud (any browser, no install).
> **Flight Deck** is the optional desktop app that bridges your local resources
> to it. **Baseline OS** is the advanced power-user workspace Flight Deck can
> also reach. Most customers use Mission Control alone; teams that need local
> files, browser automation, and on-device AI install Flight Deck and pair their
> device in minutes.

## Who it's for

Property managers · real estate / mortgage brokers · private lenders · general
contractors · home-services companies · agencies · operators · business owners ·
internal teams · future enterprise customers. **Not** a single-user tool.

## What it does for a user

- Pair this device with a Mission Control workspace (secure, revocable)
- Install / connect local runtimes and tools
- Connect local files & folders through approved channels
- Connect browser automation and AI workers
- Run secure local tasks; approve sensitive actions before they execute
- Monitor system health; view proof / replay
- Bridge local execution with cloud supervision

## How the layers relate

| Layer | Role | Install? |
|---|---|---|
| **Mission Control** | Cloud supervisor — maintenance, approvals, dispatch, replay, proof, billing, workforce | No (browser) |
| **Flight Deck** | Local runtime connector — bridges this device to Mission Control | Yes (Mac/Windows*) |
| **Baseline OS** | Advanced operator workspace — build automations, agents, Graphify, Knowledge OS | Power users |

\*Windows/Linux packaging is Phase 2 (see below). macOS ships today.

Mission Control should be able to report, per paired device: *"Your local Flight
Deck is online · your desktop runtime is paired · your local tools are available
· your browser worker is connected · your files are reachable via approved
secure channels."* (The device-side status that powers this is built; see the
multi-user audit for what's wired vs. roadmap.)

---

## Project layout

```
src-tauri/
  Cargo.toml · build.rs · tauri.conf.json · capabilities/default.json · icons/
  src/main.rs · src/lib.rs   (8 commands + tray + global shortcut + updater + tests)
  ui/                        static frontend — index.html / app.js / styles.css
```

The frontend is static and calls Rust via `window.__TAURI__.core.invoke`
(`withGlobalTauri`), so it works in a packaged `.app` without the dev sidecar.

## Rust commands (the only IPC surface)

| Command | Kind | Notes |
|---|---|---|
| `get_system_status` | read | OS/arch, app version, connections online/total |
| `get_runtime_status` | read | per-connection connected/off/setup-needed + detail |
| `check_ports` | read | TCP probe of known (or supplied) local ports |
| `open_local_url` | action | **loopback-only** URLs; rejects external/`file:`/`javascript:` |
| `start_runtime` | action | **allowlisted** fixed argv (Hermes via `launchctl`); others → not yet |
| `stop_runtime` | action | allowlisted fixed argv; no shell, no interpolation |
| `read_safe_config` | read | non-secret prefs + pairing/workspace identifiers |
| `write_safe_config` | action | allowlisted keys only; **rejects secret-looking keys**; writes 0600 |

## Local connections shown

| id | label | probe |
|---|---|---|
| `mission-control` | Mission Control | TCP `:3000` |
| `baseline-os` | Baseline OS | TCP `:5173` |
| `graphify` | Graphify | TCP `:5173` |
| `openclaw` | OpenClaw (automation workers) | TCP `:18789` |
| `hermes` | Hermes (AI assistant) | `launchctl list ai.hermes.gateway` |

## Native features

- **System tray** (Show / Hide / Quit + click-toggle), **global shortcut ⌘⇧F**, native window controls.
- **Auto-updater** — `tauri-plugin-updater` + minisign public key; builds emit a signed `.app.tar.gz` + `.sig`.

---

## Security model (why it's safe to connect a device)

Flight Deck is customer-facing, so the trust boundary is explicit and shown in-app:

- **Per-device pairing** — each device links to one workspace and is **revocable** at any time.
- **Workspace-scoped** — a paired device only sees the data of the workspace it's paired to.
- **Approval gates** — destructive / deploy / billing / external-message intents require explicit approval before execution.
- **No arbitrary terminal execution** — `start/stop_runtime` run only **fixed, allowlisted argv vectors**; there is no shell, no string interpolation of user input.
- **Loopback-only opening** — `open_local_url` refuses anything that isn't `http(s)://localhost|127.0.0.1`.
- **Encrypted / no-plaintext-secrets config** — local config is 0600 and **rejects any secret-looking key**; pairing **tokens** belong in the OS keychain, never the config file.
- **Proof & replay + audit logs** — actions are logged and replayable (Mission Control / Baseline OS replay surfaces).

These guarantees are unit-tested in `src/lib.rs` (loopback-only URLs, start/stop
allowlist, secret-key rejection, pairing-identifier vs token separation).

---

## Multi-user / multi-workspace readiness — honest audit

| Concept | Status | Notes |
|---|---|---|
| Per-device config (non-secret identifiers) | ✅ Built | `read/write_safe_config` stores `workspace`, `workspace_id`, `device_name`, `mission_control_url`, `role`, `paired` |
| Pairing **state** surfaced in UI | ✅ Built | "Paired to …" / "not paired yet" with a revoke (unpair) control |
| Secret/token handling | ✅ Built (by exclusion) | config refuses secret-looking keys; tokens must go to OS keychain (not yet wired) |
| Loopback-only + allowlist + approval gates | ✅ Built + tested | the enforced trust boundary |
| **Secure pairing handshake** (device ↔ Mission Control auth) | ⛔ **Gap / Phase 2** | UI routes the user to Mission Control to pair; the cryptographic handshake + token storage in keychain is not built |
| **User account / org / RBAC enforcement** | ⛔ **Gap / Phase 2** | identifiers can be stored; roles aren't enforced locally yet — enforcement is server-side in Mission Control |
| **Revocation propagation** (cloud → device) | ⛔ **Gap / Phase 2** | local "unpair" clears device state; a server-initiated revoke channel isn't built |
| Windows / Linux packaging | ⛔ **Phase 2** | macOS only today |

**Bottom line:** the device-side model, status surfacing, and security boundary
are real and tested. The cloud↔device **auth handshake, RBAC enforcement, and
revocation channel** are not built yet and are called out as the next milestone —
no faked pairing state (the "Pair this device" button honestly routes to Mission
Control and tells the user the handshake is rolling out).

---

## Build & run

```bash
cd ~/code/claude-os
export PATH="$HOME/.cargo/bin:$PATH"

bun run tauri:dev      # run the connector in dev (hot-reloads ui/)
bun run tauri:build    # produce a release .app + .dmg + signed updater artifact
```

Artifacts:

```
src-tauri/target/release/bundle/macos/Baseline Flight Deck.app
src-tauri/target/release/bundle/dmg/Baseline Flight Deck_0.1.0_aarch64.dmg
src-tauri/target/release/bundle/macos/Baseline Flight Deck.app.tar.gz(.sig)   # updater
```

### Signing update artifacts

```bash
export TAURI_SIGNING_PRIVATE_KEY="$(cat ~/.tauri/flight-deck-updater.key)"
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD=""
bun run tauri:build
```

Private updater key lives at `~/.tauri/flight-deck-updater.key` (outside the repo,
never committed). Only the public key is embedded in `tauri.conf.json`.

### Tests

```bash
cd ~/code/claude-os/src-tauri && cargo test    # security-boundary unit tests
```

---

## Phase 2 backlog (documented, NOT built today)

- **Secure pairing handshake** + token storage in the macOS keychain; **RBAC
  enforcement** and **server-initiated revocation** channel.
- **Auto-updater hosting** — plugin + signing key wired; still need a release feed
  at the configured endpoint (signed artifacts on Spaces / GitHub Releases).
- **Code signing (Apple Developer ID)** + **notarization** for clean first launch
  (unsigned today → Gatekeeper "unidentified developer", right-click → Open).
- **Windows** (`.msi`/NSIS) and **Linux** (`.deb`/AppImage) packaging.
- **Background daemon** — always-running tray-resident supervisor (auto-start,
  auto-restart failed runtimes, push notifications, continuous Mission Control sync).
- **Advanced runtime supervisor** — start/stop/restart/auto-heal for
  `baseline-os`, `mission-control`, `openclaw`, browser workers (beyond today's
  Hermes/launchctl allowlist entry).
- **Deep UI embedding** — render full Baseline OS surfaces inside the native window.
