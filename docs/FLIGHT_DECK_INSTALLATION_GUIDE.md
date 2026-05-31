# Flight Deck — Installation Guide

The desktop companion that connects Mission Control to your local AI runtimes.

---

## Current release status

> **As of this guide: pre-installer-build phase.** The Flight Deck page at
> `/flight-deck` displays a "Build pending" amber banner because no signed
> installer binary has been published to GitHub Releases yet. The codebase,
> CI workflow, and source recipe are all complete; only the tag has not been
> pushed.

To go from "pre-build" → "downloadable installers", the operator does one thing:

```bash
cd /app
git tag flight-deck-v0.1.0
git push origin flight-deck-v0.1.0
```

That triggers `.github/workflows/flight-deck-release.yml` which builds
macOS (arm64 + x64), Windows (x64), and Linux (x64) installers in a matrix
and publishes them to a GitHub Release. The `/flight-deck` page then
auto-flips its `releaseStatus` from `pending-build` to `available` and
the Download buttons activate.

If your team has not done this yet, you have two valid paths:

---

## Path A — Wait for the operator to push the tag

Once `flight-deck-v0.1.0` ships, this guide will be updated with direct
download links and your install reduces to:

1. Visit `https://your-mission-control.example.com/flight-deck`.
2. Click your platform's Download button.
3. Open the downloaded file:
   - **macOS**: `Mission Control Flight Deck-v0.1.0-arm64.dmg`
   - **Windows**: `Mission Control Flight Deck-v0.1.0-x64.msi`
   - **Linux**: `mission-control-flight-deck_0.1.0_amd64.deb`
4. Launch Flight Deck → pick your environment preset (Emergent / DigitalOcean / Staging / Localhost / Custom) → sign in.

---

## Path B — Build it yourself from source (works today)

You'll need Rust, Node ≥22, and the platform's toolchain. All commands are
copy-paste safe.

### Prereqs

| OS | Install |
|---|---|
| macOS | `xcode-select --install` and `brew install rust node@22` |
| Windows | Install Rust (`rustup`), Visual Studio Build Tools (C++ workload), Node 22 |
| Linux (Debian/Ubuntu) | `sudo apt install -y curl build-essential pkg-config libssl-dev libwebkit2gtk-4.1-dev libayatana-appindicator3-dev librsvg2-dev` + Rust + Node 22 |

### Build

```bash
git clone https://github.com/<your-org>/mission-control.git
cd mission-control/desktop

yarn install
yarn tauri:build
```

The signed (or unsigned dev) installer lands in
`desktop/src-tauri/target/release/bundle/`.

For macOS unsigned builds you'll need to right-click → Open the first time
(Apple Gatekeeper). For signed Mac builds, set the env vars listed in
`desktop/README.md` before `yarn tauri:build`.

### Dev mode (no installer, hot reload)

```bash
cd desktop
yarn tauri:dev
```

This opens the desktop shell against `http://localhost:3000` by default.
Use the Localhost preset.

---

## Configuring Flight Deck

Once it's running:

1. Pick an **environment preset** from the dropdown:
   - **Emergent** — for `*.emergentagent.com` URLs (your Mission Control hosted on Emergent)
   - **DigitalOcean** — for `baseline-agents.com` / `*.baseline-agents.com`
   - **Staging** — for a private staging URL
   - **Localhost** — `http://localhost:3000` for dev
   - **Custom** — any URL on the allowlist (`*.emergent.host`, `*.preview.emergentagent.com`, `baseline-agents.com`, loopback)
2. Click **Test Connection** — verifies HTTPS reachability + responds with 200/health.
3. Click **Open Mission Control** — opens the embedded webview, sign in normally.
4. Click **Refresh** — Flight Deck calls `/api/agent-runtimes` (with your session) and shows the registry side-by-side with locally-detected CLI runtimes.

---

## What Flight Deck does (and doesn't)

| Does | Doesn't |
|---|---|
| Auto-discover `claude`, `codex`, `opencode`, `hermes` CLIs on your local `PATH` | Run any CLI agent itself |
| Show runtime status (`connected` / `stale` / `disconnected` / `not connected`) | Bundle credentials of any kind |
| Persist your last-selected environment + custom URL | Auto-refresh the registry (you click Refresh) |
| Reset session (`Reset Session` clears local storage + posts /api/auth/logout) | Modify your Mission Control workspace |
| Open Mission Control in a sandboxed Tauri webview | Speak MCP — that's the gateway's job |

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| "This URL is not on the allowlist" | Use a preset, or your operator must add the hostname to `desktop/src/allowlist.js` and rebuild |
| Runtime shows `not connected` for a CLI that IS installed | Make sure the CLI is on `PATH` for the user that launched Flight Deck. Test: `which claude` |
| Empty registry but you have a Hermes daemon running | Sign in (registry call is auth-gated) → click Refresh |
| Build fails on macOS with "no Xcode" | `xcode-select --install` |
| Build fails on Linux with `webkit2gtk` | Install `libwebkit2gtk-4.1-dev` (or 4.0 on older distros) |
| Build fails on Windows with `MSVC` | Install Visual Studio Build Tools 2022 with the C++ workload |

---

## Why no auto-refresh?

Earlier iterations polled the registry every 5s. That created scroll jumps,
form-input wipes, and a feeling of "unstable software". We removed it. You
click Refresh when you want the latest state — that's it. Production Mission
Control follows the same discipline.

---

## Roadmap

- **v0.1.0** — the build the GitHub Action publishes. macOS arm64 + x64,
  Windows x64, Linux x64. **Unsigned dev builds** unless you provide signing secrets.
- **v0.2.0** — signed macOS (notarized) + signed Windows installer.
- **v1.0.0** — auto-update channel, code-signed across all three platforms,
  Linux Snap + Flatpak in addition to .deb.

---

## Need help?

- `desktop/README.md` — exhaustive build matrix per platform.
- `scripts/local-flight-deck-check.mjs` — diagnostic probe; run it against
  any Mission Control URL to verify reachability before installing.
- Operator escalation: see the customer-facing email address in your
  workspace settings.
