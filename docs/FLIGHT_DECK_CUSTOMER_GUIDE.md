# Flight Deck — Customer Install Guide

> Print this and hand it to a customer.
> Mission Control runs in your browser. Flight Deck is the **optional** desktop wrapper that gives Mission Control a real app window + native menu bar + URL bookmarks for multiple deployments.
> You do not need Flight Deck to use Mission Control. Skip this if you live in the browser.

## Who should install Flight Deck

- You manage **more than one** Mission Control deployment (e.g., production + staging + a customer's instance).
- You want Mission Control in the macOS dock / Windows taskbar like a real app.
- Your team complains about "I keep losing the tab in 50 browser tabs."

## Quick install — one minute

### macOS (Apple Silicon or Intel)

1. Go to `https://baseline-agents.com/flight-deck` while signed in.
2. Find the macOS row that matches your chip (Apple Silicon for M1/M2/M3/M4; Intel for older Macs).
3. Click **Download**.
4. Double-click the `.dmg` file. Drag Baseline Flight Deck into Applications.
5. First launch: right-click the app → **Open** → confirm.
   - You'll see "unsigned developer build" — this is expected. It's a one-time approval.
6. Sign in to Mission Control inside the app window. Done.

### Windows 10 / Windows 11

1. Go to `https://baseline-agents.com/flight-deck`.
2. Download the Windows `.msi`.
3. Double-click to install.
4. Windows SmartScreen will say "Windows protected your PC." Click **More info → Run anyway**.
   - This is expected. It's a one-time approval.
5. Open from the Start menu. Sign in. Done.

### Linux

1. Go to `https://baseline-agents.com/flight-deck`.
2. Pick `.AppImage` (works on most distros) or `.deb` (Debian/Ubuntu).

**AppImage:**
```bash
chmod +x baseline-flight-deck_0.1.0_linux-<arch>.AppImage
./baseline-flight-deck_0.1.0_linux-<arch>.AppImage
```

**.deb (Debian/Ubuntu):**
```bash
sudo dpkg -i baseline-flight-deck_0.1.0_linux-<arch>.deb
# If you see missing dep errors:
sudo apt-get install -f
baseline-flight-deck
```

## "My platform shows 'Build pending' on /flight-deck"

That means the installer for your OS hasn't been built yet by our CI. Two options:

**Easier:** ask Baseline support (hello@baseline-agents.com) to push the release tag. The build takes about 15 minutes. You'll get a download link by email.

**DIY (developer-friendly):** clone the repo and build locally — instructions are inline on the `/flight-deck` page.

## First-launch configuration

When you open Flight Deck for the first time:

1. **Mission Control URL** — paste your deployment URL. Defaults to `https://baseline-agents.com`. If your company runs Mission Control on a different domain, paste that here. You can save multiple presets.
2. **Sign in** — uses your normal Mission Control credentials. The embedded browser window handles it the same as Safari/Chrome would.
3. **Default workspace** — if you have access to multiple workspaces, pick which one opens by default.

Settings persist across restarts. If they don't, see Help Center → "Flight Deck won't save my settings."

## Daily use

Flight Deck is a thin shell around the same Mission Control web app you'd use in a browser. **Everything works the same way:**
- Tasks, agents, runtimes, billing, team — all identical.
- The only difference: it lives in your dock / taskbar instead of a tab.

You can switch deployments without re-signing-in: **File → Switch deployment** (macOS) or **Settings → Deployment** (Windows/Linux).

## Updating Flight Deck

Flight Deck v0.1 does not auto-update. To update:

1. Visit `/flight-deck` in any browser.
2. Note the version number at the top.
3. If newer than what's installed, download + reinstall (it preserves your settings).

## Uninstalling

- **macOS:** drag Baseline Flight Deck from Applications to Trash. Optionally delete `~/Library/Application Support/baseline-flight-deck/` to remove saved settings.
- **Windows:** Settings → Apps → Baseline Flight Deck → Uninstall.
- **Linux .deb:** `sudo apt remove baseline-flight-deck`. Linux .AppImage: just delete the file.

## When to call us

Email `hello@baseline-agents.com` if:

- Installation fails with a specific OS-level error (paste the error text).
- The app launches but cannot reach Mission Control (we'll check our side too).
- You need Flight Deck signed for enterprise distribution (Apple Developer ID, Windows EV cert — both available with the Growth plan).

## Verified test environments

| OS | Version | Architecture | Status |
| -- | ------- | ------------ | ------ |
| Linux | Ubuntu 22.04 LTS, Debian 12 | ARM64 | ✅ shipped, verified headless launch |
| Linux | Ubuntu 22.04 LTS, Debian 12 | x86_64 | 🟡 CI build pending (push `flight-deck-v0.1.0` tag) |
| macOS | 13 Ventura, 14 Sonoma | Apple Silicon | 🟡 CI build pending |
| macOS | 13 Ventura | Intel | 🟡 CI build pending |
| Windows | 10 22H2, 11 23H2 | x86_64 | 🟡 CI build pending |
