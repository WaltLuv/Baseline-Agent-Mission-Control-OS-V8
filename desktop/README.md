# Baseline Flight Deck — Desktop Operator Terminal

The installed desktop terminal an operator opens every day to manage live Mission Control deployments. Tauri 2 + a deliberately tiny vanilla-JS shell — Mission Control itself remains the source of truth.

---

## What it does

| Capability | Status |
|---|---|
| Picks the Mission Control target (Emergent / DigitalOcean / Staging / Localhost / Custom) | ✅ |
| Persists selected target across restarts (`flight-deck.settings.v1` in localStorage) | ✅ |
| Manual connection probe (`/api/status?action=health`) | ✅ |
| Manual runtime status panel (Hermes · OpenClaw/OpenCode · Claude Code · Codex) | ✅ |
| Reset Session button (clears settings + calls `/api/auth/logout`) | ✅ |
| Strict allowlist for host navigation (also enforced in Tauri CSP) | ✅ |
| Cross-platform CI builds via GitHub Actions matrix | ✅ |
| Signed installers | ❌ — see [Code signing](#code-signing) |

**No background polling.** Status refreshes only when the operator clicks. No auto-refresh, no jitter.

---

## Running it locally (5 minutes)

### Prerequisites
- **Rust** (any recent stable): `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y && source "$HOME/.cargo/env"`
- **Node 20+** and **Yarn**: `npm install -g yarn`
- **OS-specific toolchain:**
  - **macOS:** `xcode-select --install`, plus `rustup target add aarch64-apple-darwin x86_64-apple-darwin`
  - **Windows:** Visual Studio Build Tools 2022 with "Desktop development with C++", plus `rustup target add x86_64-pc-windows-msvc`
  - **Linux (Ubuntu/Debian):** `sudo apt install libwebkit2gtk-4.1-dev libssl-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev libsoup-3.0-dev`

### Run Mission Control + Flight Deck together

```bash
# Terminal 1 — Mission Control server
git clone https://github.com/builderz-labs/baseline-united-mission-control.git
cd baseline-united-mission-control
pnpm install
pnpm dev                          # → http://localhost:3000

# Terminal 2 — Flight Deck desktop shell
cd desktop
yarn install
yarn tauri:dev                    # native window opens
```

In the Flight Deck window, click **Localhost** in the target picker. Flight Deck probes `http://localhost:3000/api/status?action=health` and turns the pill green. Click **Open Mission Control**.

### Dev-only frontend (no Rust, no native window)

If you want to iterate on the Flight Deck HTML/JS without rebuilding the Tauri binary, just run the Vite dev server:

```bash
cd desktop
yarn install
yarn dev                          # → http://localhost:1430
```

This is what `yarn tauri:dev` mounts into the webview anyway. Useful for fast iteration before producing an installer.

---

## Picking a Mission Control target

Flight Deck supports four presets plus a free-form custom URL.

| Preset | Default URL | When to use |
|---|---|---|
| **Emergent Production** | (blank — paste your URL into Custom) | You deployed Mission Control via Emergent. Your URL looks like `https://your-app.emergent.host`. Paste it into the Custom URL field once; Flight Deck saves it. |
| **DigitalOcean Production** | `https://baseline-agents.com` | Walter's canonical production deployment on DigitalOcean App Platform. |
| **Staging / Preview** | `https://mission-control-v8.preview.emergentagent.com` | The active Emergent preview while iterating before launch. |
| **Localhost** | `http://localhost:3000` | Local dev. Custom port? Override via Custom URL — `http://localhost:3001` etc. are accepted. |
| **Custom URL** | — | Any host in the allowlist (`*.emergent.host`, `*.emergentagent.com`, `baseline-agents.com`, `localhost`, `127.0.0.1`). Loopback may use http; everything else must be https. |

Selected target persists across app restarts. Restart Flight Deck → it remembers the last preset / custom URL you chose.

---

## Building an installer locally

```bash
cd desktop
yarn install
yarn tauri:build
```

Output appears under `desktop/src-tauri/target/release/bundle/` — `dmg/` on macOS, `msi/` and `nsis/` on Windows, `appimage/` and `deb/` on Linux.

For platform-specific universal builds (Intel + Apple Silicon macOS DMG, etc.), use the platform-targeted scripts in `desktop/package.json` — `yarn tauri:build:mac`, `yarn tauri:build:win`, `yarn tauri:build:linux`.

The result is an **unsigned development build**. macOS Gatekeeper and Windows SmartScreen will warn on first run. See [Code signing](#code-signing) below.

---

## Cross-platform builds via GitHub Actions

The repo ships a matrix workflow at `.github/workflows/flight-deck-release.yml`. Tag a release and the workflow builds macOS (arm64 + x64), Windows (x64), and Linux (x64) installers and attaches them to a GitHub Release.

```bash
git tag flight-deck-v0.1.0
git push origin flight-deck-v0.1.0
# → watch https://github.com/<owner>/<repo>/actions/workflows/flight-deck-release.yml
```

`workflow_dispatch` also exists if you want to trigger a build from the Actions UI without tagging.

---

## Code signing

Out of scope for v0.1 — unsigned builds are fine for the first wave of operators (Walter ships them directly to ≤10 customers via email).

To enable signed builds, add these GitHub Secrets and re-tag:

**macOS** (requires Apple Developer Program membership, $99/yr):
- `APPLE_CERTIFICATE` — base64 of your Developer ID Application `.p12`
- `APPLE_CERTIFICATE_PASSWORD`
- `APPLE_SIGNING_IDENTITY` — e.g. `"Developer ID Application: Baseline Automations (TEAM_ID)"`
- `APPLE_ID`, `APPLE_PASSWORD` (app-specific password), `APPLE_TEAM_ID`

**Windows** (requires DigiCert / Sectigo cert, ~$200/yr):
- `WINDOWS_CERTIFICATE` — base64 of your `.pfx`
- `WINDOWS_CERTIFICATE_PASSWORD`

The workflow reads these via `env:` and Tauri picks them up automatically.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| **Connection pill stays grey ("Idle")** | No target picked yet | Click a preset, or paste a URL into Custom URL |
| **"URL not allowlisted"** | Custom URL host is outside the allowlist | Edit `desktop/src/allowlist.js` `ALLOWED_HOSTS` to add it, then rebuild |
| **"Unreachable" on Localhost** | Mission Control isn't running, or running on a different port | Confirm `pnpm dev` is up in another terminal; check port with `lsof -i :3000` |
| **"login required" in runtime panel** | Cookie/session missing for the chosen MC host | Click **Open Mission Control**, sign in, return to Flight Deck, click **Refresh** |
| **Runtime panel is empty even after login** | No runtimes connected yet to that MC host | Use `scripts/connect-runtime.mjs` (root repo) to register an OpenClaw / Hermes runtime |
| **`yarn tauri:dev` fails on Linux: "linker `cc` not found"** | Missing build-essential | `sudo apt install build-essential` |
| **`yarn tauri:dev` fails on macOS: "xcode-select error"** | Command Line Tools not installed | `xcode-select --install` |
| **Tauri build hangs at "Compiling tauri"** | First build on a fresh machine — Rust is downloading + compiling ~400 crates | Be patient; subsequent builds are cached and take ~20 seconds |
| **macOS: "Baseline Flight Deck is damaged"** | Unsigned binary blocked by Gatekeeper | Right-click the `.app` → Open → Open. Or: `xattr -dr com.apple.quarantine Baseline\ Flight\ Deck.app` |
| **Windows: SmartScreen "Unknown publisher"** | Unsigned binary | Click "More info" → "Run anyway" |
| **Flight Deck window is blank** | Mission Control target host has a CSP that blocks framing | Use **Open Mission Control** (full-page navigate) instead of expecting inline embedding |

---

## Security notes

- Flight Deck **never bundles credentials or API keys**. It is an HTTP client around an existing Mission Control deployment.
- The only thing it stores locally is `flight-deck.settings.v1` (your selected target + custom URL).
- The strict navigation allowlist is enforced **twice**: in `desktop/src/allowlist.js` (JS guard before `window.location.assign`) and in `desktop/src-tauri/tauri.conf.json` `app.security.csp` (Tauri-level CSP that the webview refuses to violate).
- **Reset Session** wipes the local target settings and posts to `/api/auth/logout` on the active Mission Control host. It does not store passwords anywhere, so there's nothing else to clear.
- The MC server enforces `MC_ALLOWED_HOSTS` independently — even if Flight Deck were misconfigured, the server would 403 unknown Host headers.

---

## Tests

The Flight Deck JS surface is covered by vitest, runnable from the repo root:

```bash
pnpm vitest run desktop/__tests__/
```

The current suite covers: URL allowlist parsing, preset resolution, custom URL precedence, mode persistence, runtime status state machine.

---

## File layout

```
desktop/
├── index.html                    Shell markup (single-file)
├── src/
│   ├── main.js                   Shell logic — settings, probe, runtime status
│   ├── allowlist.js              MODES + ALLOWED_HOSTS + isAllowedUrl + activeUrl
│   └── styles.css                Visual styling
├── src-tauri/
│   ├── tauri.conf.json           Window title, identifier, CSP, bundle config
│   ├── Cargo.toml                Rust deps
│   ├── src/                      main.rs entrypoint
│   ├── icons/                    Window/dock/installer icons
│   └── capabilities/             Tauri 2 capability permissions
├── __tests__/                    vitest unit tests
├── public/                       Static assets bundled into the binary
├── package.json                  yarn scripts: dev / build / tauri:dev / tauri:build
└── vite.config.js
```

---

## License

Mission Control is proprietary to Baseline Automations. Flight Deck source is included in the repo under the same license. See repo root `LICENSE`.
