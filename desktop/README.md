# Baseline Flight Deck

> The installed desktop operator terminal for Baseline Automations.
> Mission Control remains the source of truth — Flight Deck is the
> daily cockpit you double-click to open it like real software.

Tauri v2 + a tiny static shell. ~400 lines of code total. No second
UI, no parallel state, no local AI. Open Mission Control inside a
native window, secure-by-default.

---

## Architecture (don't violate)

```
Operator
  → Baseline Flight Deck       (desktop shell — this app)
    → Mission Control          (supervision; web)
      → Baseline OS            (orchestration)
        → Hermes / OpenClaw / OpenCode / Claude Code   (execution)
```

Flight Deck **never** holds customer data. It is a perception layer:
mode selector, connection probe, native window, allowlist.

---

## Prerequisites

The host that builds the desktop binary needs:

| Toolchain | Version | Notes |
|-----------|---------|-------|
| Node.js | ≥ 18 | Vite + Tauri CLI |
| Yarn or pnpm | latest | repo standard is yarn |
| Rust | ≥ 1.77 (stable) | `rustup default stable` |
| Platform deps | varies | see below |

Platform-specific build dependencies:

| Target | Required toolchain |
|--------|--------------------|
| **macOS** (`.app` / `.dmg`) | Xcode Command Line Tools (`xcode-select --install`). Universal builds need both `aarch64-apple-darwin` and `x86_64-apple-darwin` targets installed via `rustup target add`. Code-signing + notarization is operator-supplied (Apple Developer cert + `tauri.conf.json` signing keys). |
| **Windows** (`.msi` / `.exe`) | WiX Toolset v3.x and WebView2 runtime; Visual Studio Build Tools with the "Desktop development with C++" workload. |
| **Linux** (`.AppImage` / `.deb`) | `libwebkit2gtk-4.1-dev`, `build-essential`, `curl`, `wget`, `file`, `libxdo-dev`, `libssl-dev`, `libayatana-appindicator3-dev`, `librsvg2-dev`. |

The sandbox that authored this scaffold does **not** have Rust
installed — final binaries must be built on the target platform.

---

## Install

```bash
cd desktop
yarn install
# OR with pnpm
pnpm install
```

Then add the Rust target for your platform if needed:

```bash
rustup target add aarch64-apple-darwin   # Apple Silicon mac
rustup target add x86_64-pc-windows-msvc # Windows
```

---

## Build commands

Run from the **repo root** so the operator has one consistent CLI:

```bash
pnpm desktop:dev               # hot-reload dev shell — opens a native window
pnpm desktop:build             # production build for the current host
pnpm desktop:build:mac         # macOS .app + .dmg (must run on a Mac)
pnpm desktop:build:win         # Windows .msi + .exe (must run on Windows)
pnpm desktop:build:linux       # Linux .AppImage + .deb (must run on Linux)
pnpm desktop:icon              # regenerate the icon set from src-tauri/icons/icon.png
```

Bundled artifacts land in `desktop/src-tauri/target/release/bundle/`.

---

## Modes

The shell ships with three pre-allowlisted Mission Control targets:

| Mode | Host |
|------|------|
| Production | `https://mission.baselineautomations.com` |
| Staging | `https://token-monetization.preview.emergentagent.com` |
| Localhost | `http://127.0.0.1:3000` |

Operators may save a custom URL inside the **Custom Mission Control
URL** section. Custom URLs must:

- Use `https://` (or `http://` for `127.0.0.1` / `localhost` only).
- Resolve to a host in the allowlist (`src/main.js` →
  `ALLOWED_HOSTS`). To add a permanent host, edit that constant and
  the matching `frame-src` entry in `src-tauri/tauri.conf.json`.

Settings persist in the webview's `localStorage` under
`flight-deck.settings.v1`. Nothing is stored on disk by the Rust
layer.

---

## Security

1. **No secrets bundled.** Flight Deck ships no API keys, no signing
   secrets, no auth tokens. It uses Mission Control's web auth
   (cookies inside the webview) like any browser session.
2. **CSP locked.** `tauri.conf.json` → `app.security.csp` restricts
   `connect-src` and `frame-src` to the allowlisted hosts. Adding a
   new host requires both the JS allowlist and CSP edit to ship.
3. **Capabilities minimised.** `src-tauri/capabilities/default.json`
   declares only `core:webview`, `core:window`, `core:app`, `store`,
   and a narrow `shell:open` to Baseline-owned docs. No filesystem,
   no http plugin, no exec, no dialog file pick.
4. **No customer data on disk.** The store plugin is wired but
   currently unused by the shell. If we ever persist customer data
   locally, that change goes through a dedicated review.
5. **No arbitrary remote URLs.** `window.location.assign` is only
   called with URLs that pass `isAllowedUrl(...)`. Disallowed input
   shows `URL not allowlisted` and does nothing.

---

## File map

```
desktop/
├── README.md                     # this file
├── package.json                  # Vite + Tauri CLI
├── vite.config.js
├── index.html                    # shell entry
├── public/icon.png               # web-visible logo
├── src/
│   ├── main.js                   # mode + allowlist + open-MC logic
│   └── styles.css                # ~80 lines, dark, minimal
├── __tests__/allowlist.test.js   # vitest — strict allowlist contract
└── src-tauri/
    ├── Cargo.toml
    ├── build.rs
    ├── tauri.conf.json           # window + bundle + CSP
    ├── capabilities/default.json # IPC permission set
    ├── icons/                    # generated from the Baseline logo
    └── src/main.rs               # Rust entry — opens the window, plugins
```

---

## What this is NOT (rule, do not violate)

- Not a new product. Not a Mission Control replacement.
- Not a prospect-facing portal.
- Not where Baseline Studios lives.
- Not a separate CRM, analytics layer, or local AI manager.

Mission Control supervises. Baseline OS coordinates. Hermes / OpenClaw /
OpenCode / Claude Code execute. Flight Deck is the desktop cockpit
that makes opening that stack feel like opening Cursor or Slack.
