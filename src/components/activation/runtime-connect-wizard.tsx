'use client'

import { useEffect, useState } from 'react'

// Runtime Connection Wizard — one-click runtime onboarding.
//
// Customer picks "Claude / Codex / OpenClaw / Hermes". We mint a runtime
// API key behind the scenes, show the exact `node scripts/connect-runtime.mjs`
// command they paste, then poll until we see the runtime's first
// heartbeat — at which point we mark the step complete and unblock
// the next activation step.

type Runtime = 'claude' | 'codex' | 'openclaw' | 'hermes'

const RUNTIMES: Array<{
  id: Runtime
  title: string
  whatItIs: string
  whyItMatters: string
  prereqs: string
}> = [
  {
    id: 'claude',
    title: 'Claude Code',
    whatItIs: "Anthropic's coding agent.",
    whyItMatters: 'Best at thoughtful, multi-step code review, refactors, and PR drafting.',
    prereqs: 'A box with Node 20+ and Claude Code installed.',
  },
  {
    id: 'codex',
    title: 'Codex',
    whatItIs: "OpenAI's autonomous coding agent.",
    whyItMatters: 'Fast pattern-matching, code generation, migrations.',
    prereqs: 'A box with Node 20+ and Codex CLI installed.',
  },
  {
    id: 'openclaw',
    title: 'OpenClaw / OpenCode',
    whatItIs: 'A self-hosted execution runtime.',
    whyItMatters: 'Run agents on your own infrastructure with full control over models and data.',
    prereqs: 'A VPS or workstation reachable on the network.',
  },
  {
    id: 'hermes',
    title: 'Hermes',
    whatItIs: 'A long-running orchestration runtime.',
    whyItMatters: 'Drives recurring pipelines: knowledge consolidation, memory updates, scheduled tasks.',
    prereqs: 'A long-running host (cloud VM is ideal).',
  },
]

type Provisioned = {
  runtime: Runtime
  agent_id: number
  agent_name: string
  api_key: string
  api_key_hint: string
  connect_command: string
  mission_control_url: string
}

export function RuntimeConnectWizard({
  onComplete,
  onSkip,
}: {
  onComplete: () => void
  onSkip: () => void
}) {
  const [selected, setSelected] = useState<Runtime | null>(null)
  const [provisioning, setProvisioning] = useState(false)
  const [provisioned, setProvisioned] = useState<Provisioned | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [heartbeatSeen, setHeartbeatSeen] = useState(false)

  async function mintKey(runtime: Runtime) {
    setError(null)
    setProvisioning(true)
    try {
      const res = await fetch('/api/onboarding/runtime-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runtime }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as Provisioned
      setProvisioned(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'failed to mint key')
    } finally {
      setProvisioning(false)
    }
  }

  // Poll for first heartbeat on the new agent.
  useEffect(() => {
    if (!provisioned || heartbeatSeen) return
    const t = setInterval(async () => {
      try {
        const res = await fetch(`/api/agents/${provisioned.agent_id}`, { cache: 'no-store' })
        if (!res.ok) return
        const data = (await res.json()) as { agent?: { last_seen?: number | null; last_heartbeat_at?: number | null } }
        const beat = data?.agent?.last_seen ?? data?.agent?.last_heartbeat_at
        if (beat) {
          setHeartbeatSeen(true)
        }
      } catch {
        /* ignore */
      }
    }, 4000)
    return () => clearInterval(t)
  }, [provisioned, heartbeatSeen])

  const meta = selected ? RUNTIMES.find((r) => r.id === selected)! : null

  if (provisioned && meta) {
    return (
      <div className="space-y-5" data-testid="runtime-wizard-provisioned">
        <header>
          <p className="text-xs uppercase tracking-wider text-emerald-300/80 font-mono mb-1.5">
            Step 1 of 3 · Connect runtime → {meta.title}
          </p>
          <h2 className="text-2xl font-semibold tracking-tight">
            Paste this on the runtime host
          </h2>
          <p className="mt-2 text-sm text-white/55 leading-relaxed">
            We just created an agent record + a one-time runtime API key for{' '}
            <span className="font-mono text-white/80">{provisioned.agent_name}</span>. Paste the command on
            the box where {meta.title} runs. We'll detect it as soon as it heartbeats.
          </p>
        </header>

        <div className="rounded-lg border border-white/[0.08] bg-black/40 p-4 relative" data-testid="runtime-wizard-command">
          <pre className="text-xs leading-relaxed text-white/85 overflow-x-auto">{provisioned.connect_command}</pre>
          <button
            type="button"
            data-testid="runtime-wizard-copy"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(provisioned.connect_command)
                setCopied(true)
                setTimeout(() => setCopied(false), 1800)
              } catch { /* ignore */ }
            }}
            className="absolute top-2 right-2 text-[10px] uppercase tracking-wider text-white/45 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded px-2 py-1"
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>

        <div className="rounded-lg border border-amber-500/30 bg-amber-500/[0.04] p-3 text-xs text-amber-100/80">
          <strong className="text-amber-200">Save the API key now.</strong> It is shown once and cannot be retrieved later. Key hint:{' '}
          <span className="font-mono">{provisioned.api_key_hint}</span>.
        </div>

        <div
          data-testid="runtime-wizard-heartbeat-status"
          className={`rounded-lg border p-4 transition-colors ${
            heartbeatSeen
              ? 'border-emerald-500/40 bg-emerald-500/[0.06]'
              : 'border-white/[0.08] bg-white/[0.02]'
          }`}
        >
          <div className="flex items-center gap-3">
            <span
              className={`inline-block w-2.5 h-2.5 rounded-full ${
                heartbeatSeen ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'
              }`}
            />
            <span className="text-sm font-medium text-white">
              {heartbeatSeen ? `${meta.title} connected — heartbeat received.` : `Waiting for first heartbeat from ${meta.title}…`}
            </span>
          </div>
          {!heartbeatSeen && (
            <p className="mt-1.5 ml-5 text-xs text-white/45">
              Once you run the command above, this will flip green within ~30 seconds.
            </p>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 pt-2">
          <button
            type="button"
            data-testid="runtime-wizard-skip"
            onClick={onSkip}
            className="text-sm text-white/50 hover:text-white/80"
          >
            I'll connect later
          </button>
          <button
            type="button"
            data-testid="runtime-wizard-continue"
            disabled={!heartbeatSeen}
            onClick={onComplete}
            className={`h-10 px-5 rounded-lg text-sm font-semibold transition-colors ${
              heartbeatSeen
                ? 'bg-white text-[#09090b] hover:bg-white/90'
                : 'bg-white/[0.06] text-white/40 cursor-not-allowed'
            }`}
          >
            {heartbeatSeen ? 'Continue to invite team →' : 'Heartbeat pending'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5" data-testid="runtime-wizard-picker">
      <header>
        <p className="text-xs uppercase tracking-wider text-violet-300/80 font-mono mb-1.5">Step 1 of 3</p>
        <h2 className="text-2xl font-semibold tracking-tight">Pick a runtime to connect</h2>
        <p className="mt-2 text-sm text-white/55 leading-relaxed">
          A runtime is the worker that actually does the AI work (Claude, Codex, OpenClaw, Hermes). Mission Control supervises it. Pick one to start — you can add more later.
        </p>
      </header>

      <div className="grid sm:grid-cols-2 gap-3">
        {RUNTIMES.map((r) => (
          <button
            type="button"
            key={r.id}
            data-testid={`runtime-wizard-option-${r.id}`}
            onClick={() => setSelected(r.id)}
            className={`text-left rounded-lg border p-4 transition-colors ${
              selected === r.id
                ? 'border-violet-400/50 bg-violet-500/[0.06]'
                : 'border-white/[0.08] bg-white/[0.02] hover:border-white/[0.15]'
            }`}
          >
            <div className="text-base font-semibold text-white">{r.title}</div>
            <p className="mt-1 text-sm text-white/55">{r.whatItIs}</p>
            <p className="mt-2 text-xs text-white/45">
              <strong className="text-white/65">Why:</strong> {r.whyItMatters}
            </p>
            <p className="mt-1.5 text-[11px] text-white/35">
              <strong>Needs:</strong> {r.prereqs}
            </p>
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/[0.04] p-3 text-sm text-red-200" data-testid="runtime-wizard-error">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between gap-3 pt-2">
        <button
          type="button"
          data-testid="runtime-wizard-skip-picker"
          onClick={onSkip}
          className="text-sm text-white/50 hover:text-white/80"
        >
          I'll connect later
        </button>
        <button
          type="button"
          data-testid="runtime-wizard-generate"
          disabled={!selected || provisioning}
          onClick={() => selected && mintKey(selected)}
          className={`h-10 px-5 rounded-lg text-sm font-semibold transition-colors ${
            selected && !provisioning
              ? 'bg-white text-[#09090b] hover:bg-white/90'
              : 'bg-white/[0.06] text-white/40 cursor-not-allowed'
          }`}
        >
          {provisioning ? 'Generating…' : 'Generate API key + command →'}
        </button>
      </div>
    </div>
  )
}
