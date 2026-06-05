'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

// ─────────────────────────────────────────────────────────────────────
// Baseline Flight Deck — public download / build page.
//
// Honest about artifact status: the page reads /api/flight-deck/manifest
// to determine which platforms have prebuilt artifacts available *right
// now* on this deployment. Available artifacts get real download buttons.
// Pending artifacts get the "build from source" or "tag a release" path.
// No artifact is faked as available.
// ─────────────────────────────────────────────────────────────────────

const FLIGHT_DECK_VERSION = 'v0.1.0'

type ArtifactStatus = 'available' | 'pending-build' | 'unsupported'

type Artifact = {
  platform: string
  arch: string
  file_type: string
  filename: string
  size_bytes: number | null
  size_human: string | null
  sha256: string | null
  download_url: string | null
  status: ArtifactStatus
  signed: boolean
  notes?: string
}

type Manifest = {
  version: string
  release_url: string | null
  release_published: boolean
  ci_workflow: string
  ci_tag_command: string
  available_count: number
  pending_count: number
  artifacts: Artifact[]
}

const PLATFORM_LABELS: Record<string, string> = {
  macos: 'macOS',
  windows: 'Windows',
  linux: 'Linux',
}

const ARCH_LABELS: Record<string, string> = {
  arm64: 'Apple Silicon / ARM64',
  x86_64: 'Intel / x86_64',
}

const BUILD_COMMANDS: Record<string, string> = {
  macos: 'cd desktop && yarn install && yarn tauri:build:mac',
  windows: 'cd desktop && yarn install && yarn tauri:build:win',
  linux: 'cd desktop && yarn install && yarn tauri:build:linux',
}

function StatusBadge({ status }: { status: ArtifactStatus }) {
  if (status === 'available') {
    return (
      <span
        data-testid="status-available"
        className="text-[11px] uppercase tracking-wider font-semibold text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded-full px-2 py-0.5"
      >
        Available
      </span>
    )
  }
  if (status === 'pending-build') {
    return (
      <span
        data-testid="status-pending"
        className="text-[11px] uppercase tracking-wider font-semibold text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-full px-2 py-0.5"
      >
        Build pending
      </span>
    )
  }
  return (
    <span className="text-[11px] uppercase tracking-wider font-semibold text-white/40 bg-white/5 border border-white/10 rounded-full px-2 py-0.5">
      Not supported yet
    </span>
  )
}

function CopyBlock({ children, testId }: { children: string; testId?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="relative group">
      <pre
        data-testid={testId}
        className="text-xs leading-relaxed bg-black/40 border border-white/[0.06] rounded-lg px-4 py-3 overflow-x-auto text-white/85"
      >
        {children}
      </pre>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(children)
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
          } catch {
            /* ignore */
          }
        }}
        className="absolute top-2 right-2 text-[10px] uppercase tracking-wider text-white/40 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded px-2 py-0.5 transition-colors opacity-0 group-hover:opacity-100"
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  )
}

export default function FlightDeckDownloadPage() {
  const [manifest, setManifest] = useState<Manifest | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetch('/api/flight-deck/manifest', { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Manifest ${res.status}`)
        return res.json() as Promise<Manifest>
      })
      .then((data) => {
        if (!cancelled) setManifest(data)
      })
      .catch((err: unknown) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : 'manifest unavailable')
      })
    return () => {
      cancelled = true
    }
  }, [])

  const groups = (manifest?.artifacts || []).reduce<Record<string, Artifact[]>>((acc, a) => {
    ;(acc[a.platform] ||= []).push(a)
    return acc
  }, {})

  return (
    <div className="min-h-screen bg-[#09090b] text-[#fafafa] antialiased">
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
        <section className="mb-12" data-testid="flight-deck-hero">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-violet-500/20 bg-violet-500/5 px-3.5 py-1 text-[13px] font-medium text-violet-300 mb-6">
            Baseline Flight Deck · <span className="text-violet-400/80" data-testid="flight-deck-version">{manifest?.version || FLIGHT_DECK_VERSION}</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight leading-[1.1] mb-5">
            The installed desktop terminal — for either deployment mode.
          </h1>
          <p className="text-lg text-white/55 leading-relaxed max-w-2xl">
            Flight Deck is the desktop companion. It connects to <strong className="text-white/80">Baseline OS</strong> if you run it locally, or directly to your <strong className="text-white/80">Mission Control</strong> cloud workspace. Same install, switch per workspace, no Baseline OS dependency for cloud users.
          </p>
        </section>

        {/* Connection modes — Mode 1 (local Baseline OS) vs Mode 2 (cloud MC) */}
        <section className="mb-16" data-testid="flight-deck-modes">
          <h2 className="text-2xl font-semibold tracking-tight mb-5">Two ways to connect</h2>
          <div className="grid gap-4 md:grid-cols-2">
            <div
              data-testid="flight-deck-mode-local"
              className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] p-5"
            >
              <div className="inline-flex items-center rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[10px] uppercase tracking-wider font-semibold text-emerald-300 mb-3">
                Mode 1 · local
              </div>
              <h3 className="text-base font-semibold text-white">Connect to Baseline OS (local)</h3>
              <p className="text-sm text-white/55 mt-2 leading-relaxed">
                Run Baseline OS on your Mac mini, VPS, or workstation. Flight Deck points at <code className="bg-white/10 px-1 rounded text-xs">http://localhost:8081</code> (or your custom port). All your runtimes, files, and memory stay local.
              </p>
              <CopyBlock testId="flight-deck-mode-local-cmd">{`# In the Flight Deck app, switch the active workspace to:
http://localhost:8081`}</CopyBlock>
            </div>
            <div
              data-testid="flight-deck-mode-cloud"
              className="rounded-xl border border-violet-500/20 bg-violet-500/[0.04] p-5"
            >
              <div className="inline-flex items-center rounded-full bg-violet-500/15 px-2.5 py-0.5 text-[10px] uppercase tracking-wider font-semibold text-violet-300 mb-3">
                Mode 2 · cloud
              </div>
              <h3 className="text-base font-semibold text-white">Connect to Mission Control (cloud)</h3>
              <p className="text-sm text-white/55 mt-2 leading-relaxed">
                Point Flight Deck at your Mission Control tenant URL + a runtime API key (generate one in the cloud dashboard). No Baseline OS install required; agents you run on any machine can register against the same workspace.
              </p>
              <CopyBlock testId="flight-deck-mode-cloud-cmd">{`# In the Flight Deck app, add a workspace:
URL:       https://<your-tenant>.mission-control.app
API key:   mc_runtime_•••••• (from /app/settings → Runtime keys)`}</CopyBlock>
            </div>
          </div>
        </section>

        {/* Manifest summary */}
        {manifest && (
          <section
            data-testid="flight-deck-artifact-status"
            className={`mb-12 rounded-xl border p-5 ${
              manifest.available_count > 0
                ? 'border-emerald-500/30 bg-emerald-500/[0.04]'
                : 'border-amber-500/30 bg-amber-500/[0.04]'
            }`}
          >
            <div className="flex items-start gap-3">
              <div>
                <h3 className={`text-base font-semibold ${manifest.available_count > 0 ? 'text-emerald-200' : 'text-amber-200'}`}>
                  {manifest.available_count > 0
                    ? `${manifest.available_count} artifact${manifest.available_count === 1 ? '' : 's'} ready to download · ${manifest.pending_count} pending CI build`
                    : 'Installer build pending — use local build instructions below'}
                </h3>
                <p className={`mt-1.5 text-sm leading-relaxed ${manifest.available_count > 0 ? 'text-emerald-100/70' : 'text-amber-100/70'}`}>
                  Cross-platform installers are produced by{' '}
                  <code className="bg-white/10 px-1 py-0.5 rounded text-xs">{manifest.ci_workflow}</code>
                  {' '}on every{' '}
                  <code className="bg-white/10 px-1 py-0.5 rounded text-xs">flight-deck-v*</code>{' '}
                  tag. Anything not yet built can be produced locally in ~3 minutes — recipe below.
                </p>
              </div>
            </div>
          </section>
        )}
        {loadError && (
          <section className="mb-12 rounded-xl border border-red-500/30 bg-red-500/[0.04] p-5 text-sm text-red-200" data-testid="flight-deck-manifest-error">
            Could not load release manifest: {loadError}
          </section>
        )}

        {/* Per-platform truth table */}
        <section className="mb-16" data-testid="flight-deck-platforms">
          <h2 className="text-2xl font-semibold tracking-tight mb-6">Platform status</h2>
          <div className="space-y-4">
            {Object.entries(groups).map(([platform, list]) => (
              <div
                key={platform}
                data-testid={`platform-${platform}`}
                className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5"
              >
                <h3 className="text-base font-semibold text-white mb-4">
                  {PLATFORM_LABELS[platform] || platform}
                </h3>
                <div className="space-y-3">
                  {list.map((a) => (
                    <div
                      key={a.filename}
                      data-testid={`artifact-${a.platform}-${a.arch}-${a.file_type}`}
                      className="flex items-start justify-between gap-3 flex-wrap rounded-lg border border-white/[0.04] bg-black/20 px-4 py-3"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-sm font-medium text-white">
                            {ARCH_LABELS[a.arch] || a.arch} · .{a.file_type}
                          </span>
                          <StatusBadge status={a.status} />
                          {a.signed ? null : (
                            <span className="text-[10px] uppercase tracking-wider text-white/40 bg-white/5 border border-white/10 rounded-full px-2 py-0.5">
                              Unsigned
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-white/40 font-mono break-all">{a.filename}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-white/40 font-mono">
                          {a.size_human && <span data-testid={`size-${a.platform}-${a.arch}`}>{a.size_human}</span>}
                          {a.sha256 && (
                            <span data-testid={`sha256-${a.platform}-${a.arch}`} title={a.sha256}>
                              sha256:{a.sha256.slice(0, 12)}…
                            </span>
                          )}
                        </div>
                        {a.notes && <p className="mt-1.5 text-xs text-white/45">{a.notes}</p>}
                      </div>
                      <div className="shrink-0">
                        {a.status === 'available' && a.download_url ? (
                          <a
                            href={a.download_url}
                            data-testid={`download-${a.platform}-${a.arch}-${a.file_type}`}
                            className="h-9 px-4 rounded-lg bg-white text-[#09090b] text-sm font-semibold hover:bg-white/90 transition-colors flex items-center"
                          >
                            Download
                          </a>
                        ) : (
                          <span className="h-9 px-4 rounded-lg bg-white/[0.04] text-white/35 text-xs border border-white/[0.06] flex items-center" data-testid={`pending-${a.platform}-${a.arch}-${a.file_type}`}>
                            CI build pending
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4">
                  <p className="text-xs uppercase tracking-wider text-white/35 font-mono mb-2">Build locally</p>
                  <CopyBlock testId={`platform-${platform}-build`}>{BUILD_COMMANDS[platform] || ''}</CopyBlock>
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
            Tag a release as <code className="text-white/80 bg-white/[0.06] px-1.5 py-0.5 rounded text-xs">flight-deck-{FLIGHT_DECK_VERSION}</code> and the matrix workflow at <code className="text-white/80 bg-white/[0.06] px-1.5 py-0.5 rounded text-xs">.github/workflows/flight-deck-release.yml</code> produces macOS, Windows, and Linux artifacts in one run and attaches them to the GitHub Release.
          </p>
          <CopyBlock testId="release-tag">{manifest?.ci_tag_command || `git tag flight-deck-${FLIGHT_DECK_VERSION}\ngit push origin flight-deck-${FLIGHT_DECK_VERSION}`}</CopyBlock>
          <p className="mt-3 text-xs text-white/40">
            Artifacts default to <strong>unsigned development builds</strong>. macOS users will see Gatekeeper warning; Windows users will see SmartScreen warning. Both are dismissible. Production signing requires Apple Developer ID and a Windows code-signing cert (each ~$99–$200/yr) — out of scope for v0.1.
          </p>
        </section>

        {/* CLI hint */}
        <section className="mb-16" data-testid="flight-deck-cli-hint">
          <h2 className="text-2xl font-semibold tracking-tight mb-3">Inspect from the terminal</h2>
          <p className="text-white/55 leading-relaxed mb-4">
            Operators can audit the release state from the Mission Control CLI without leaving the terminal.
          </p>
          <CopyBlock testId="cli-flightdeck-example">{`# List artifacts and download status
pnpm run mc -- flightdeck downloads --json

# Show release / CI / checksum doctor
pnpm run mc -- flightdeck doctor`}</CopyBlock>
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
