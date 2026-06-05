'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

// ─────────────────────────────────────────────────────────────────────
// /app/claude-code — Dedicated Claude Code setup + orientation page.
//
// Why this is its own surface (vs. just the row on /app/runtimes):
// operators land here to install + pair + verify Claude Code with this
// Mission Control workspace, copy the exact MCP-register command, and
// see honest connection state. The page also surfaces a handful of
// common workflows the CLI is best suited for.
//
// Real connection state pulled from `/api/agent-runtimes` — never faked.
// ─────────────────────────────────────────────────────────────────────

interface DetectedRuntime {
  id: string
  name: string
  installed: boolean
  version: string | null
  authRequired: boolean
  authenticated: boolean
}

interface ApiPayload {
  runtimes: DetectedRuntime[]
}

function CopyBlock({ children, testId }: { children: string; testId?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="relative group">
      <pre
        data-testid={testId}
        className="text-xs leading-relaxed bg-black/40 border border-white/[0.06] rounded-lg px-3 py-2.5 overflow-x-auto text-white/85 whitespace-pre-wrap"
      >
        {children}
      </pre>
      <button
        type="button"
        onClick={async () => {
          try { await navigator.clipboard.writeText(children); setCopied(true); setTimeout(() => setCopied(false), 1200) } catch { /* noop */ }
        }}
        className="absolute top-1.5 right-1.5 text-[10px] uppercase tracking-wider text-white/40 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded px-1.5 py-0.5 transition-colors opacity-0 group-hover:opacity-100"
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  )
}

export default function ClaudeCodePage() {
  const [runtime, setRuntime] = useState<DetectedRuntime | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchRuntime = useCallback(async () => {
    try {
      setError(null)
      const res = await fetch('/api/agent-runtimes', { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as ApiPayload
      setRuntime(data.runtimes.find((r) => r.id === 'claude') ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'failed to load runtime state')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchRuntime() }, [fetchRuntime])

  const state: 'installed-authed' | 'installed-needs-auth' | 'not-installed' | 'unknown' =
    !runtime ? 'unknown'
    : runtime.installed && runtime.authenticated ? 'installed-authed'
    : runtime.installed ? 'installed-needs-auth'
    : 'not-installed'

  return (
    <div className="h-full overflow-y-auto bg-[#09090b] text-[#fafafa]" data-testid="claude-code-page">
      <div className="mx-auto max-w-screen-lg px-6 py-10">
        <header className="mb-8">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-orange-500/20 bg-orange-500/5 px-3 py-1 text-[11px] font-medium text-orange-300 uppercase tracking-wider mb-3">
            Mission Control · Claude Code
          </div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">Claude Code · setup &amp; pairing</h1>
          <p className="text-sm text-white/55 leading-relaxed max-w-2xl">
            Anthropic&apos;s CLI agent for software engineering tasks. Install on the machine
            where you want it to run, authenticate, and register Mission Control as an MCP
            server so your workspace shows up in Claude Code&apos;s tool list. State below is
            live from this Mission Control host.
          </p>
        </header>

        {/* Live status banner */}
        <section className="mb-8 rounded-xl border p-4" data-testid="claude-code-status">
          {loading ? (
            <p className="text-sm text-white/40">Checking detector…</p>
          ) : error ? (
            <div className="border-rose-500/30 bg-rose-500/[0.04] text-rose-200 text-sm" data-testid="claude-code-error">
              Could not reach the runtime registry: {error}
            </div>
          ) : state === 'installed-authed' ? (
            <div className="flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_6px] shadow-emerald-400/50" />
              <span className="text-sm text-emerald-200">
                Claude Code is installed and authenticated on this host.
              </span>
              {runtime?.version && (
                <code className="ml-auto text-[11px] font-mono text-white/45">v{runtime.version}</code>
              )}
            </div>
          ) : state === 'installed-needs-auth' ? (
            <div className="flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full bg-amber-400 shadow-[0_0_6px] shadow-amber-400/50" />
              <span className="text-sm text-amber-200">
                Installed but not authenticated. Run <code className="font-mono bg-white/10 px-1 rounded text-xs">claude login</code> below.
              </span>
            </div>
          ) : state === 'not-installed' ? (
            <div className="flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full bg-zinc-500" />
              <span className="text-sm text-white/65">
                Not installed on this Mission Control host. Use the install recipe below.
              </span>
            </div>
          ) : (
            <div className="text-sm text-white/55">Runtime detector returned no Claude Code row.</div>
          )}
        </section>

        {/* 1 — Install */}
        <section className="mb-8" data-testid="claude-code-install">
          <h2 className="text-base font-semibold mb-2">1 · Install</h2>
          <p className="text-sm text-white/55 leading-relaxed mb-3">
            Recommended path uses Anthropic&apos;s official installer. macOS, Linux, and
            Windows are supported.
          </p>
          <CopyBlock testId="claude-code-install-cmd">{`# Official installer (macOS / Linux)
curl -fsSL https://claude.ai/install.sh | sh

# Verify
claude --version`}</CopyBlock>
        </section>

        {/* 2 — Login */}
        <section className="mb-8" data-testid="claude-code-login">
          <h2 className="text-base font-semibold mb-2">2 · Authenticate</h2>
          <p className="text-sm text-white/55 leading-relaxed mb-3">
            Claude Code authenticates with your Anthropic account. Run the command below
            and complete the browser flow it opens.
          </p>
          <CopyBlock testId="claude-code-login-cmd">claude login</CopyBlock>
        </section>

        {/* 3 — MCP register */}
        <section className="mb-8" data-testid="claude-code-mcp">
          <h2 className="text-base font-semibold mb-2">3 · Register Mission Control as an MCP server</h2>
          <p className="text-sm text-white/55 leading-relaxed mb-3">
            This makes the Mission Control tool surface (agents, tasks, sessions, memory,
            soul, comments, tokens, skills, cron, status) available inside any Claude Code
            session. The agent learns when to call your workspace before writing code.
          </p>
          <CopyBlock testId="claude-code-mcp-cmd">{`# Register Mission Control once
claude mcp add mission-control -- node /path/to/mission-control/scripts/mc-mcp-server.cjs

# Or with explicit URL + API key (preferred for cloud Mission Control)
MC_URL=http://127.0.0.1:3000 MC_API_KEY=<your-runtime-key> \\
  claude mcp add mission-control -- node /path/to/mission-control/scripts/mc-mcp-server.cjs

# Verify
claude mcp list | grep mission-control`}</CopyBlock>
          <p className="mt-3 text-[11px] text-white/45 leading-relaxed">
            Generate the runtime API key from Mission Control →{' '}
            <Link href="/app/settings" className="text-violet-300 hover:text-violet-200 underline">Settings → Runtime keys</Link>.
          </p>
        </section>

        {/* 4 — Verify */}
        <section className="mb-8" data-testid="claude-code-verify">
          <h2 className="text-base font-semibold mb-2">4 · Verify the pairing</h2>
          <p className="text-sm text-white/55 leading-relaxed mb-3">
            Inside a Claude Code session, ask the agent to list your Mission Control agents.
            If the MCP server is correctly registered, it will call the workspace and read
            back the list.
          </p>
          <CopyBlock testId="claude-code-verify-cmd">{`# In a Claude Code session:
> use the mission-control tool to list agents in my workspace`}</CopyBlock>
        </section>

        {/* Common workflows */}
        <section className="mb-8" data-testid="claude-code-workflows">
          <h2 className="text-base font-semibold mb-3">Common workflows</h2>
          <ul className="grid gap-3 md:grid-cols-2">
            {[
              { title: 'Bug triage + fix', body: 'Open a Claude Code session in the repo, paste the failing test output, and let the agent reproduce, root-cause, and fix while writing tests.' },
              { title: 'Refactor under a contract', body: 'Constrain the agent with an Implementation Plan markdown file, then ask it to refactor while preserving the listed invariants.' },
              { title: 'Workforce task delegation', body: 'From within Claude Code, call the mission-control MCP to create a task and assign it to a specific employee in your workforce.' },
              { title: 'Memory + soul reads', body: 'Use the MCP to read shared memory + soul templates so the agent inherits operator context across sessions.' },
            ].map((w) => (
              <li
                key={w.title}
                data-testid={`claude-code-workflow-${w.title.toLowerCase().replace(/[^a-z]+/g, '-')}`}
                className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3"
              >
                <h3 className="text-sm font-semibold text-white mb-1">{w.title}</h3>
                <p className="text-[11px] text-white/55 leading-relaxed">{w.body}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* Troubleshooting */}
        <section className="mb-8" data-testid="claude-code-troubleshoot">
          <h2 className="text-base font-semibold mb-3">Troubleshooting</h2>
          <ul className="space-y-2 text-sm text-white/65 leading-relaxed">
            <li>
              <strong className="text-white/85">Detector says &ldquo;not installed&rdquo; but the CLI works.</strong>{' '}
              Mission Control checks PATH; ensure <code className="font-mono bg-white/10 px-1 rounded text-xs">claude</code> is on the
              same PATH that started the Mission Control process, then click Refresh.
            </li>
            <li>
              <strong className="text-white/85">MCP server not loading.</strong>{' '}
              Check <code className="font-mono bg-white/10 px-1 rounded text-xs">claude mcp list</code> — if mission-control isn&apos;t there, re-run the add command with the absolute path to mc-mcp-server.cjs.
            </li>
            <li>
              <strong className="text-white/85">Auth says expired.</strong>{' '}
              Run <code className="font-mono bg-white/10 px-1 rounded text-xs">claude logout</code> then <code className="font-mono bg-white/10 px-1 rounded text-xs">claude login</code> again.
            </li>
          </ul>
        </section>

        <div className="flex items-center gap-3 mb-2">
          <Button size="sm" onClick={fetchRuntime} data-testid="claude-code-refresh">
            Refresh detection
          </Button>
          <Link href="/app/runtimes" className="text-[11px] text-white/55 hover:text-white/85">
            ← All runtimes
          </Link>
        </div>

        <footer className="mt-10 pt-6 border-t border-white/[0.06] text-xs text-white/40 flex items-center justify-between flex-wrap gap-3">
          <span>This page describes Claude Code. It does not run commands.</span>
          <Link href="/app" className="hover:text-white/80">← Back to dashboard</Link>
        </footer>
      </div>
    </div>
  )
}
