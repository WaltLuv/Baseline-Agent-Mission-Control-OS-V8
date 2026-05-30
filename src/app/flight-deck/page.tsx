'use client'

import Link from 'next/link'
import { useState } from 'react'

// ─────────────────────────────────────────────────────────────────────
// Baseline Flight Deck — public download / build page.
//
// HONEST about artifact status: we do NOT pretend we have prebuilt
// signed installers ready to download. The truth is:
//   • CI workflow at .github/workflows/flight-deck-release.yml builds
//     unsigned macOS / Windows / Linux artifacts when a tag is pushed.
//   • Until that workflow runs and uploads to GitHub Releases, the
//     only way to get Flight Deck is to build locally from source.
//   • A bell-curve of operators (Walter included) can do that in ~3
//     minutes with the commands below.
//
// When the GH Releases run completes, replace `releaseStatus` below
// from 'pending-build' → 'available' and point `releaseUrl` at the
// real GitHub Release URL. No download buttons should be shown until
// real binaries exist.
// ─────────────────────────────────────────────────────────────────────

const FLIGHT_DECK_VERSION = 'v0.1.0'

// Single source of truth for whether installers are available.
// 'pending-build'  — no GH Release run has succeeded yet
// 'available'      — at least one platform has signed/unsigned binaries
const releaseStatus: 'pending-build' | 'available' = 'pending-build'
const releaseUrl: string | null = null

type PlatformStatus = 'pending-build' | 'available' | 'unsupported'

const platforms: Array<{
  id: string
  name: string
  status: PlatformStatus
  artifact: string
  buildCommand: string
}> = [
  {
    id: 'macos',
    name: 'macOS (Intel + Apple Silicon)',
    status: 'pending-build',
    artifact: 'Baseline-Flight-Deck-0.1.0.dmg (unsigned development build)',
    buildCommand: 'cd desktop && yarn install && yarn tauri:build:mac',
  },
  {
    id: 'windows',
    name: 'Windows 10 / 11 (x64)',
    status: 'pending-build',
    artifact: 'Baseline-Flight-Deck-Setup-0.1.0.msi (unsigned development build)',
    buildCommand: 'cd desktop && yarn install && yarn tauri:build:win',
  },
  {
    id: 'linux',
    name: 'Linux (Ubuntu/Debian)',
    status: 'pending-build',
    artifact: 'Baseline-Flight-Deck-0.1.0.AppImage / .deb (unsigned development build)',
    buildCommand: 'cd desktop && yarn install && yarn tauri:build:linux',
  },
]

function StatusBadge({ status }: { status: PlatformStatus }) {
  if (status === 'available') {
    return <span className="text-[11px] uppercase tracking-wider font-semibold text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded-full px-2 py-0.5">Available</span>
  }
  if (status === 'pending-build') {
    return <span className="text-[11px] uppercase tracking-wider font-semibold text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-full px-2 py-0.5">Build pending</span>
  }
  return <span className="text-[11px] uppercase tracking-wider font-semibold text-white/40 bg-white/5 border border-white/10 rounded-full px-2 py-0.5">Not supported yet</span>
}

function CopyBlock({ children, testId }: { children: string; testId?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="relative group">
      <pre
        data-testid={testId}
        className="text-xs leading-relaxed bg-black/40 border border-white/[0.06] rounded-lg px-4 py-3 overflow-x-auto text-white/85"
      >{children}</pre>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(children)
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
          } catch { /* ignore */ }
        }}
        className="absolute top-2 right-2 text-[10px] uppercase tracking-wider text-white/40 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded px-2 py-0.5 transition-colors opacity-0 group-hover:opacity-100"
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  )
}

export default function FlightDeckDownloadPage() {
  return (
    <div className="min-h-screen bg-[#09090b] text-[#fafafa] antialiased">
      {/* Header */}
      <header className="border-b border-white/[0.06] backdrop-blur-xl bg-[#09090b]/70">
        <div className="mx-auto max-w-screen-lg px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 text-sm font-semibold tracking-tight">
            <img src="/brand/mc-logo-128.png" alt="" width={28} height={28} className="w-7 h-7 rounded-md object-contain" />
            Baseline Automations
          </Link>
          <nav className="text-sm text-white/50 flex gap-6">
            <Link href="/" className="hover:text-white">Home</Link>
            <Link href="/pricing" className="hover:text-white">Pricing</Link>
            <Link href="/login" className="hover:text-white">Sign in</Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-screen-lg px-6 py-16 md:py-24">
        {/* Hero */}
        <section className="mb-16" data-testid="flight-deck-hero">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-violet-500/20 bg-violet-500/5 px-3.5 py-1 text-[13px] font-medium text-violet-300 mb-6">
            Baseline Flight Deck · <span className="text-violet-400/80" data-testid="flight-deck-version">{FLIGHT_DECK_VERSION}</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight leading-[1.1] mb-5">
            The installed desktop terminal for Mission Control.
          </h1>
          <p className="text-lg text-white/55 leading-relaxed max-w-2xl">
            Open Mission Control like real desktop software. Switch between Emergent Production, DigitalOcean, Staging, and Localhost without typing a URL each time. Runtime status, demo links, and workforce health one click away.
          </p>
        </section>

        {/* Honest artifact status banner */}
        {releaseStatus === 'pending-build' && (
          <section
            data-testid="flight-deck-artifact-status"
            className="mb-12 rounded-xl border border-amber-500/30 bg-amber-500/[0.04] p-5"
          >
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-amber-300 mt-0.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                <path d="M12 9v4M12 17h.01" />
              </svg>
              <div>
                <h3 className="text-base font-semibold text-amber-200">Installer build pending — use local build instructions below</h3>
                <p className="mt-1.5 text-sm text-amber-100/70 leading-relaxed">
                  No signed installers have shipped from CI yet. The GitHub Actions workflow at
                  {' '}<code className="text-amber-200 bg-amber-500/10 px-1 py-0.5 rounded text-xs">.github/workflows/flight-deck-release.yml</code>{' '}
                  produces unsigned macOS / Windows / Linux artifacts on every <code className="text-amber-200 bg-amber-500/10 px-1 py-0.5 rounded text-xs">flight-deck-v*</code> tag.
                  Until that runs and uploads to GitHub Releases, build locally from source — it takes about three minutes.
                </p>
              </div>
            </div>
          </section>
        )}

        {/* Per-platform truth table */}
        <section className="mb-16" data-testid="flight-deck-platforms">
          <h2 className="text-2xl font-semibold tracking-tight mb-6">Platform status</h2>
          <div className="space-y-3">
            {platforms.map(p => (
              <div
                key={p.id}
                data-testid={`platform-${p.id}`}
                className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5"
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="text-base font-semibold text-white">{p.name}</h3>
                      <StatusBadge status={p.status} />
                    </div>
                    <p className="text-xs text-white/40 font-mono">{p.artifact}</p>
                  </div>
                  {p.status === 'available' && releaseUrl && (
                    <a
                      href={releaseUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="h-9 px-4 rounded-lg bg-white text-[#09090b] text-sm font-semibold hover:bg-white/90 transition-colors flex items-center"
                    >
                      Download
                    </a>
                  )}
                </div>
                <div className="mt-4">
                  <p className="text-xs uppercase tracking-wider text-white/35 font-mono mb-2">Build locally</p>
                  <CopyBlock testId={`platform-${p.id}-build`}>{p.buildCommand}</CopyBlock>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Build from source — full recipe */}
        <section className="mb-16" data-testid="flight-deck-build-from-source">
          <h2 className="text-2xl font-semibold tracking-tight mb-3">Build from source</h2>
          <p className="text-white/55 leading-relaxed mb-6">
            Flight Deck is a Tauri 2 app. You need Rust, Node 20+, and your OS toolchain. ~3 minute first build, ~20 seconds incremental.
          </p>

          <div className="space-y-5">
            <div>
              <h3 className="text-sm font-semibold text-white/85 mb-2">1 · Install prerequisites</h3>
              <CopyBlock testId="prereq-install">{`# Rust toolchain (all OSes)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
source "$HOME/.cargo/env"

# macOS
rustup target add aarch64-apple-darwin x86_64-apple-darwin
xcode-select --install

# Windows — install Visual Studio Build Tools 2022 with "Desktop development with C++"
# Then:  rustup target add x86_64-pc-windows-msvc

# Linux (Ubuntu / Debian)
sudo apt install libwebkit2gtk-4.1-dev libssl-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev`}</CopyBlock>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-white/85 mb-2">2 · Clone, install, run</h3>
              <CopyBlock testId="clone-install-run">{`git clone https://github.com/builderz-labs/baseline-united-mission-control.git
cd baseline-united-mission-control

# Run Mission Control (terminal #1)
pnpm install
pnpm dev

# Run Flight Deck dev shell (terminal #2)
cd desktop
yarn install
yarn tauri:dev`}</CopyBlock>
              <p className="mt-2 text-xs text-white/40">Flight Deck opens in a native window. Pick the <strong>Localhost</strong> preset to point at <code className="text-white/60">http://localhost:3000</code>.</p>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-white/85 mb-2">3 · Build an installer</h3>
              <CopyBlock testId="installer-build">{`cd desktop
yarn install
yarn tauri:build         # builds for your current OS
# → desktop/src-tauri/target/release/bundle/<format>/`}</CopyBlock>
            </div>
          </div>
        </section>

        {/* CI build workflow */}
        <section className="mb-16" data-testid="flight-deck-ci">
          <h2 className="text-2xl font-semibold tracking-tight mb-3">Cross-platform builds via GitHub Actions</h2>
          <p className="text-white/55 leading-relaxed mb-4">
            Tag a release as <code className="text-white/80 bg-white/[0.06] px-1.5 py-0.5 rounded text-xs">flight-deck-v0.1.0</code> and the matrix workflow at <code className="text-white/80 bg-white/[0.06] px-1.5 py-0.5 rounded text-xs">.github/workflows/flight-deck-release.yml</code> produces macOS, Windows, and Linux artifacts in one run and attaches them to the GitHub Release.
          </p>
          <CopyBlock testId="release-tag">{`git tag flight-deck-v0.1.0
git push origin flight-deck-v0.1.0
# → watch https://github.com/<owner>/<repo>/actions/workflows/flight-deck-release.yml`}</CopyBlock>
          <p className="mt-3 text-xs text-white/40">
            Artifacts are <strong>unsigned development builds</strong>. macOS users will see Gatekeeper warning; Windows users will see SmartScreen warning. Both are dismissible. Production signing requires Apple Developer ID and a Windows code-signing cert (each ~$99–$200/yr) — out of scope for v0.1.
          </p>
        </section>

        {/* What it does */}
        <section className="mb-16">
          <h2 className="text-2xl font-semibold tracking-tight mb-6">What Flight Deck does</h2>
          <ul className="space-y-3 text-sm text-white/65 leading-relaxed">
            <li><strong className="text-white">Picks the Mission Control target.</strong> Emergent Production, DigitalOcean Production, Staging, Localhost, or a custom URL — saved persistently.</li>
            <li><strong className="text-white">Shows live runtime status.</strong> Hermes, OpenClaw / OpenCode, Claude Code, Codex — pulled from <code className="text-white/70 bg-white/[0.06] px-1 py-0.5 rounded text-xs">/api/agent-runtimes</code>, refreshed on click.</li>
            <li><strong className="text-white">Never bundles credentials.</strong> Authentication happens against Mission Control as if you opened it in a browser. Reset Session clears local target settings and calls <code className="text-white/70 bg-white/[0.06] px-1 py-0.5 rounded text-xs">/api/auth/logout</code>.</li>
            <li><strong className="text-white">Does not auto-refresh.</strong> No background polling, no jitter. Click Refresh or Test Connection when you want updates.</li>
            <li><strong className="text-white">Allowlisted hosts only.</strong> Custom URLs must match <code className="text-white/70 bg-white/[0.06] px-1 py-0.5 rounded text-xs">*.emergent.host</code>, <code className="text-white/70 bg-white/[0.06] px-1 py-0.5 rounded text-xs">*.emergentagent.com</code>, <code className="text-white/70 bg-white/[0.06] px-1 py-0.5 rounded text-xs">baseline-agents.com</code>, or loopback. Enforced both client-side and in Tauri CSP.</li>
          </ul>
        </section>

        {/* Footer CTA */}
        <section data-testid="flight-deck-footer-cta" className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-8 text-center">
          <p className="text-white/55 mb-5">Want to run Mission Control too? Start free, no credit card needed.</p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Link
              href="/signup"
              className="h-10 px-5 rounded-lg bg-white text-[#09090b] text-sm font-semibold hover:bg-white/90 transition-colors"
            >
              Start free
            </Link>
            <Link
              href="/login"
              className="h-10 px-5 rounded-lg bg-white/[0.06] text-white/80 text-sm font-medium border border-white/[0.08] hover:bg-white/[0.1] transition-colors"
            >
              Sign in
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/[0.06] mt-12">
        <div className="mx-auto max-w-screen-lg px-6 py-8 text-sm text-white/40 flex items-center justify-between flex-wrap gap-4">
          <span>© {new Date().getFullYear()} Baseline Automations</span>
          <Link href="/" className="hover:text-white/80 transition-colors">← Back home</Link>
        </div>
      </footer>
    </div>
  )
}
