# Baseline Flight Deck

**AI Workforce Operator Terminal** — a desktop shell for Mission Control + Baseline OS, built with Tauri v2.

> This is **not** a separate product. It is the installed desktop launch and control experience for an operator who runs an AI workforce. Mission Control remains the single source of truth.

## What it does

When a customer downloads Flight Deck, they get:

1. A native installer (DMG / MSI / AppImage)
2. A desktop / dock / start-menu icon (Baseline OS mark — not Tauri, not Next.js)
3. A native window labelled **Baseline Flight Deck**
4. A boot screen with environment selection (Production / Staging / Localhost / Custom)
5. A persisted Mission Control URL — remembered between launches
6. A system tray icon with **Open Mission Control · Check connection · Quit**
7. Optional native notifications (approvals needed, runtime offline, briefing ready)
8. Future runtime bridge readiness (Hermes / OpenClaw / Claude Code)

## What it is **not**

- It does **not** ship its own UI. Mission Control runs inside.
- It does **not** ship its own auth. Login still happens in Mission Control.
- It does **not** ship secrets. Everything is configured locally by the operator.
- It does **not** mock or replicate live data. The shell is dumb on purpose.

## Architecture

```
┌──────────────────────────────────────┐
│   Baseline Flight Deck (Tauri v2)    │
│  ┌────────────────────────────────┐  │
│  │  Native shell (Rust)           │  │
│  │  - window + tray + notify      │  │
│  │  - settings store (encrypted)  │  │
│  └────────────────────────────────┘  │
│  ┌────────────────────────────────┐  │
│  │  Launcher splash (shell.html)  │  │
│  │  - environment picker          │  │
│  │  - URL persistence             │  │
│  └────────────────────────────────┘  │
│  ┌────────────────────────────────┐  │
│  │  Mission Control (iframe)      │  │
│  │  - production / staging / local│  │
│  └────────────────────────────────┘  │
└──────────────────────────────────────┘
```

The Rust binary is intentionally minimal. It exposes three commands:

| Command | Purpose |
| --- | --- |
| `get_settings` | Read environment + Mission Control URL from the encrypted local store |
| `set_settings` | Persist the operator's environment + URL |
| `default_urls` | Return the well-known production and localhost defaults |

## Development

Prerequisites:

- Node.js ≥ 20
- Rust ≥ 1.77 (`rustup install stable`)
- macOS: Xcode Command Line Tools (`xcode-select --install`)
- Linux: `libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev`
- Windows: Microsoft Edge WebView2 (preinstalled on Win 10+) and the MSVC build tools

```bash
cd apps/flight-deck
yarn install           # or pnpm/npm
yarn dev               # runs the Tauri shell against the production splash
```

When Mission Control is running locally on `localhost:3000`, set environment to **Localhost** in the splash. Otherwise pick **Production** and confirm `https://app.baselineos.com`.

## Builds

Builds happen on a builder that matches the target OS — Tauri does not cross-compile native installers.

```bash
# From repo root or apps/flight-deck:
yarn build:mac           # Universal binary (macOS builder required)
yarn build:mac:intel     # x86_64-apple-darwin only
yarn build:mac:arm       # aarch64-apple-darwin only
yarn build:win           # MSI + NSIS (Windows builder required)
yarn build:linux         # AppImage + deb (Linux builder required)
yarn build:linux:appimage
yarn build:linux:deb
```

Artifacts land in `apps/flight-deck/src-tauri/target/release/bundle/`.

## Branding

Branding is *not* template branding. The app must always ship with:

- App name: **Baseline Flight Deck**
- Bundle id: `com.baselineos.flight-deck`
- Window title: `Baseline Flight Deck`
- Tray tooltip: `Baseline Flight Deck`
- Publisher: `Baseline OS`
- Category: `Productivity`
- Subtitle: `AI Workforce Operator Terminal`
- Icons: `icons/icon.icns` (macOS), `icons/icon.ico` (Windows), `icons/*.png` (Linux), `icons/tray-icon.png` (tray)

> The placeholder icons in this scaffold are intentional. Replace `icons/*` with the Baseline OS mark before shipping. **Do not ship Tauri default icons or Next.js icons.**

## Security review

The shell follows these rules:

- **No secrets in the binary.** Mission Control URL is the only setting; it is stored locally per operator.
- **No live customer data without login.** The shell never bypasses Mission Control auth; the iframe is a remote URL with normal cookies/SameSite rules.
- **No remote code execution.** The Rust side exposes three commands only (`get_settings`, `set_settings`, `default_urls`). None of them accept arbitrary code.
- **Sandboxed iframe.** The Mission Control iframe is loaded with a narrow `sandbox` attribute that still allows the dashboard to function (forms, same-origin, popups) but blocks `top-navigation` and `pointer-lock`.
- **Capability gating.** `capabilities/default.json` grants ONLY: notification, dialog, OS info, shell-open, and the store. There is no `fs:write`, no `process:command`, and no `http:fetch` capability.
- **Production / staging / localhost separation.** Each environment is a distinct URL with its own auth domain. There is no cross-environment cookie sharing.
- **Signed demo support.** Signed demo share links flow through Mission Control's existing public `/api/demo-share/redeem` endpoint. The shell is unaware of them; they Just Work.

## Future work (not in MVP)

- Native notifications wired to Mission Control's SSE stream (approval-needed, runtime-disconnected, briefing-ready).
- Runtime bridge for local Hermes / OpenClaw / Claude Code — the shell hosts the bridge, Mission Control supervises it.
- Auto-updater via `tauri-plugin-updater` with signed releases.
- Deep links (`flight-deck://workspace/<id>`) for inviting team members.

## License

Proprietary. Baseline OS.
