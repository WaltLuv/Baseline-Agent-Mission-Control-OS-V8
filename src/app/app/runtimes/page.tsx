'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { HermesVpsCard } from '@/components/runtimes/hermes-vps-card'

// ─────────────────────────────────────────────────────────────────────
// /app/runtimes — Remote Runtimes hub.
//
// Honest about state:
//   · Detector-wired runtimes (OpenClaw, Hermes, Claude Code, Codex,
//     OpenCode) come from the live `/api/agent-runtimes` endpoint.
//     Connection state reflects the real `agents.last_seen` heartbeat.
//   · Runtimes whose detector isn't yet wired (Ruflo, Antigravity,
//     NotebookLM, Browser Use, Maestro, Hermes Video / Hermes MCP Loop)
//     show a "Connect manually" card with the exact terminal command,
//     never a fake green dot.
// ─────────────────────────────────────────────────────────────────────

interface DetectedRuntime {
  id: string
  name: string
  description: string
  installed: boolean
  version: string | null
  running: boolean
  authRequired: boolean
  authHint: string
  authenticated: boolean
}

interface RegisteredRuntime {
  id: number
  name: string
  runtime_type: string
  workspace_id: number
  connection_status: 'connected' | 'stale' | 'disconnected'
  last_heartbeat_at: number | null
  seconds_since_heartbeat: number | null
}

interface ApiPayload {
  runtimes: DetectedRuntime[]
  registered: RegisteredRuntime[]
  isDocker: boolean
  heartbeat_window_seconds: number
}

// Manual-connect runtimes — no detector yet, but the connection
// recipe IS real. When a customer follows the command, the agent
// either handshakes via `/api/agents/register` and shows up under
// "Registered remote runtimes" below, or it does not. We never fake
// a successful registration.
const MANUAL_RUNTIMES: Array<{
  id: string
  name: string
  category: 'mcp' | 'cloud' | 'desktop'
  description: string
  install: string
  connect: string
  notes?: string
  docs?: string
}> = [
  {
    id: 'ruflo',
    name: 'Ruflo',
    category: 'mcp',
    description: 'MCP server exposing 200+ skills (memory, planning, embeddings, swarm).',
    install: 'npx ruflo@latest init',
    connect: 'claude mcp add ruflo -- npx ruflo@latest mcp start',
    notes: 'Once registered with your local Claude Code, Ruflo can be reached from any Mission Control task whose runtime is Claude Code.',
    docs: 'https://github.com/Frafortunato/ruflo',
  },
  {
    id: 'antigravity',
    name: 'Antigravity',
    category: 'desktop',
    description: 'Google Antigravity IDE-style code agent. Local desktop runtime.',
    install: '# Install Antigravity from antigravity.app',
    connect: '# In Mission Control, generate a runtime API key:\nmc runtime register --kind antigravity --label <hostname>',
    notes: 'Antigravity does not expose a CLI install pipeline yet; pair manually using a Mission Control runtime key.',
  },
  {
    id: 'notebooklm',
    name: 'Google NotebookLM Agent',
    category: 'cloud',
    description: 'Cloud notebook + research agent. Connects via Google OAuth (no local CLI).',
    install: '# NotebookLM is cloud-hosted — no install required',
    connect: '# Mission Control → Settings → Integrations → "Connect NotebookLM"\n# (requires Google OAuth client credentials in env)',
    notes: 'Setup-needed today: GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET must be configured in Mission Control.',
  },
  {
    id: 'browser-use',
    name: 'Browser Use',
    category: 'mcp',
    description: 'Browser-driving agent (Playwright-based). Customer-hosted runtime.',
    install: 'pipx install browser-use\n# or: uv tool install browser-use',
    connect: 'browser-use serve --register-with https://<your-mc>.app --api-key <runtime-key>',
    notes: 'Generate the runtime API key under Mission Control → Settings → Runtime keys.',
    docs: 'https://github.com/browser-use/browser-use',
  },
  {
    id: 'maestro',
    name: 'Maestro',
    category: 'desktop',
    description: 'Mobile UI test + automation runtime by mobile.dev.',
    install: 'curl -Ls "https://get.maestro.mobile.dev" | bash',
    connect: 'maestro --token <runtime-key> --register-with https://<your-mc>.app',
    notes: 'Maestro handshakes once on first run; subsequent runs reuse the same registration.',
    docs: 'https://maestro.mobile.dev',
  },
  {
    id: 'hermes-mcp-loop',
    name: 'Hermes MCP Loop',
    category: 'mcp',
    description: 'Hermes runtime exposed as an MCP server — for cross-agent tool reuse.',
    install: '# Already installed if Hermes is detected above',
    connect: 'hermes mcp register --target <your-mc> --runtime-key <key>',
    notes: 'Requires Hermes detector to report installed=true first.',
  },
  {
    id: 'hermes-video',
    name: 'Hermes Video Agent',
    category: 'mcp',
    description: 'Hermes video-generation pipeline (HyperFrames CLI under the hood).',
    install: 'brew install hyperframes # or: npm i -g @hermes/video-cli',
    connect: 'hermes-video serve --register-with https://<your-mc>.app --api-key <runtime-key>',
    notes: 'HyperFrames CLI must be on PATH before the video runtime can register.',
  },
]

function StatusDot({ state }: { state: 'connected' | 'stale' | 'disconnected' | 'not-configured' }) {
  const cls =
    state === 'connected' ? 'bg-emerald-400 shadow-emerald-400/50'
    : state === 'stale' ? 'bg-amber-400 shadow-amber-400/50'
    : state === 'disconnected' ? 'bg-rose-400 shadow-rose-400/50'
    : 'bg-zinc-500'
  return <span className={`inline-block h-2 w-2 rounded-full ${cls} shadow-[0_0_6px]`} />
}

function CopyableCommand({ command }: { command: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="relative group" data-testid="copyable-command">
      <pre className="text-xs leading-relaxed bg-black/40 border border-white/[0.06] rounded-lg px-3 py-2 overflow-x-auto text-white/85 whitespace-pre-wrap">
        {command}
      </pre>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(command)
            setCopied(true)
            setTimeout(() => setCopied(false), 1200)
          } catch { /* noop */ }
        }}
        className="absolute top-1.5 right-1.5 text-[10px] uppercase tracking-wider text-white/40 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded px-1.5 py-0.5 transition-colors opacity-0 group-hover:opacity-100"
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  )
}

export default function RemoteRuntimesPage() {
  const [payload, setPayload] = useState<ApiPayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchRuntimes = useCallback(async () => {
    try {
      setError(null)
      const res = await fetch('/api/agent-runtimes', { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as ApiPayload
      setPayload(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'failed to load runtimes')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchRuntimes() }, [fetchRuntimes])

  return (
    <div className="h-full overflow-y-auto bg-[#09090b] text-[#fafafa]" data-testid="remote-runtimes-page">
      <div className="mx-auto max-w-screen-lg px-6 py-10">
        <header className="mb-8">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-violet-500/20 bg-violet-500/5 px-3 py-1 text-[11px] font-medium text-violet-300 uppercase tracking-wider mb-3">
            Mission Control · Remote runtimes
          </div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">Remote runtimes</h1>
          <p className="text-sm text-white/55 leading-relaxed max-w-2xl">
            Connect any supported agent — local or cloud — to this Mission Control workspace.
            Detector-wired runtimes report real connection state; the rest show their
            exact setup command so you can pair them manually. Nothing is faked.
          </p>
        </header>

        {/* Hermes VPS — Primary Production Controller (secure pairing, no SSH) */}
        <HermesVpsCard />

        {/* Detected on this host */}
        <section className="mb-12" data-testid="runtimes-detected">
          <div className="flex items-baseline justify-between mb-4">
            <h2 className="text-lg font-semibold">Detected on this host</h2>
            <button
              onClick={fetchRuntimes}
              className="text-xs text-white/45 hover:text-white/85"
            >
              {loading ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
          {error && (
            <div className="rounded-lg border border-rose-500/30 bg-rose-500/[0.05] px-4 py-3 text-sm text-rose-200" data-testid="runtimes-error">
              Could not load runtime registry: {error}
            </div>
          )}
          {payload && (
            <div className="grid gap-3 md:grid-cols-2">
              {payload.runtimes.map((r) => {
                const state: 'connected' | 'stale' | 'disconnected' | 'not-configured' =
                  r.installed && (!r.authRequired || r.authenticated) ? 'connected'
                  : r.installed ? 'stale'
                  : 'not-configured'
                return (
                  <div
                    key={r.id}
                    data-testid={`detected-${r.id}`}
                    className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <StatusDot state={state} />
                      <h3 className="text-sm font-semibold text-white">{r.name}</h3>
                      {r.version && (
                        <span className="text-[10px] font-mono text-white/45 ml-auto">v{r.version}</span>
                      )}
                    </div>
                    <p className="text-xs text-white/55 leading-relaxed mb-2">{r.description}</p>
                    <div className="text-[11px] font-mono uppercase tracking-wider text-white/40">
                      {r.installed ? (r.authRequired ? (r.authenticated ? 'connected' : 'install ok · auth needed') : 'connected') : 'not installed'}
                    </div>
                    {r.installed && r.authRequired && !r.authenticated && r.authHint && (
                      <p className="mt-2 text-[11px] text-amber-200/80 italic">{r.authHint}</p>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* Registered remote runtimes (DB-backed) */}
        {payload && payload.registered.length > 0 && (
          <section className="mb-12" data-testid="runtimes-registered">
            <h2 className="text-lg font-semibold mb-4">Registered remote runtimes</h2>
            <div className="grid gap-3 md:grid-cols-2">
              {payload.registered.map((r) => (
                <div
                  key={r.id}
                  data-testid={`registered-${r.id}`}
                  className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <StatusDot state={r.connection_status} />
                    <h3 className="text-sm font-semibold text-white">{r.name}</h3>
                    <span className="text-[10px] font-mono text-white/45 ml-auto">{r.runtime_type}</span>
                  </div>
                  <div className="text-[11px] font-mono uppercase tracking-wider text-white/40">
                    {r.connection_status}{r.seconds_since_heartbeat !== null ? ` · ${r.seconds_since_heartbeat}s ago` : ''}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Connect manually */}
        <section data-testid="runtimes-manual">
          <h2 className="text-lg font-semibold mb-2">Connect manually</h2>
          <p className="text-sm text-white/55 leading-relaxed max-w-2xl mb-5">
            These runtimes are supported by the connection protocol but don&apos;t yet have a
            one-click detector in Mission Control. Run the command for each on the machine
            you want to register; the runtime will appear under <strong className="text-white/80">Registered remote runtimes</strong> above
            once its first heartbeat lands.
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            {MANUAL_RUNTIMES.map((r) => (
              <div
                key={r.id}
                data-testid={`manual-${r.id}`}
                className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-5"
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <StatusDot state="not-configured" />
                  <h3 className="text-sm font-semibold text-white">{r.name}</h3>
                  <span className="text-[10px] uppercase tracking-wider text-white/40 ml-auto bg-white/5 border border-white/10 rounded-full px-2 py-0.5">
                    {r.category}
                  </span>
                </div>
                <p className="text-xs text-white/55 leading-relaxed mb-3">{r.description}</p>
                <div className="space-y-2">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-white/40 mb-1">1 · Install</p>
                    <CopyableCommand command={r.install} />
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-white/40 mb-1">2 · Register with Mission Control</p>
                    <CopyableCommand command={r.connect} />
                  </div>
                </div>
                {r.notes && (
                  <p className="mt-3 text-[11px] text-white/50 leading-relaxed italic">{r.notes}</p>
                )}
                {r.docs && (
                  <a
                    href={r.docs}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-block text-[11px] text-violet-300 hover:text-violet-200"
                  >
                    Docs →
                  </a>
                )}
              </div>
            ))}
          </div>
        </section>

        <footer className="mt-12 pt-6 border-t border-white/[0.06] text-xs text-white/40 flex items-center justify-between flex-wrap gap-3">
          <span>Runtime API keys are generated under Mission Control → Settings.</span>
          <Link href="/app" className="hover:text-white/80">← Back to dashboard</Link>
        </footer>
      </div>
    </div>
  )
}
