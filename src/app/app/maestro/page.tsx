'use client'

/**
 * Mission Control — Maestro mirror surface.
 *
 * Walt: "Maestro is local state. Mission Control should read/display
 * Maestro state, not mutate it blindly. Mission Control cloud can receive
 * mirrored Maestro events/proofs later through #63."
 *
 * This page is the read-only mirror that lives on the cloud side. It
 * never executes Maestro commands itself — that happens on the local
 * Baseline OS box. Until #63 lands the mirror is honest about its empty
 * state and surfaces the path to set it up.
 */

import Link from 'next/link'

export default function MaestroMirrorPage() {
  return (
    <div className="min-h-screen bg-[#09090b] text-[#fafafa] antialiased" data-testid="mc-maestro-mirror">
      <main className="mx-auto max-w-screen-lg px-6 py-10 space-y-6">
        <header>
          <p className="text-[10px] uppercase tracking-[0.24em] text-violet-300/80 font-mono mb-2">
            Local-first conductor · Read-only mirror
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">Maestro</h1>
          <p className="mt-2 text-sm text-white/55 max-w-2xl">
            Mission Control reads Maestro events + mission snapshots from your Baseline OS box.
            The live coordination surface — missions, tasks, handoffs, checkpoints, validation — lives next to your code at <code className="bg-white/[0.06] text-white/80 px-1 rounded text-[12px]">/maestro</code> on the local dashboard.
          </p>
        </header>

        <section
          className="rounded-xl border border-amber-500/30 bg-amber-500/[0.06] px-4 py-3 text-sm text-amber-200"
          data-testid="mc-maestro-pending"
        >
          <strong className="text-amber-100">No mirror data yet.</strong> Maestro event/proof sync from Baseline OS to Mission Control rides on the #63 mirroring pipeline,
          which is not yet shipped. Today the mirror is honestly empty rather than fabricating mission state.
        </section>

        <section className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-5 space-y-3" data-testid="mc-maestro-howto">
          <h2 className="text-sm font-semibold text-white">How to use Maestro today</h2>
          <ol className="text-[13px] text-white/75 space-y-2 list-decimal list-inside leading-relaxed">
            <li>
              Open Baseline OS on the host where your project lives:{' '}
              <code className="bg-black/40 px-1 rounded text-[12px]">http://localhost:8081/maestro</code>.
            </li>
            <li>
              Install the Maestro CLI if needed (the page surfaces the install command + version probe).
            </li>
            <li>
              From your project root, run <code className="bg-black/40 px-1 rounded text-[12px]">maestro init</code> and define your missions / features / tasks.
            </li>
            <li>
              The local panel surfaces <code className="bg-black/40 px-1 rounded text-[12px]">maestro mission-control --json</code>{' '}
              + the writable subcommands (task ready / claim / update / handoff / checkpoint save / memory-correct) behind explicit confirmation.
            </li>
          </ol>
        </section>

        <section className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-5 space-y-3" data-testid="mc-maestro-roadmap">
          <h2 className="text-sm font-semibold text-white">What lands next</h2>
          <ul className="text-[13px] text-white/65 space-y-1.5 leading-relaxed">
            <li>
              <strong className="text-white/85">#62 SQLite Kanban Dispatcher</strong> — pairs with Maestro: planning lives in Maestro,
              runtime claim + atomic dispatch lives in the kanban. Architecture review available at{' '}
              <code className="bg-black/40 px-1 rounded text-[12px]">claude-os/architecture/maestro-vs-kanban.md</code>.
            </li>
            <li>
              <strong className="text-white/85">#63 Mission Control Mirroring</strong> — event/proof sync (NOT DB replication).
              Once it lands, this page renders the same mission snapshot live.
            </li>
          </ul>
          <Link
            href="/app/credentials"
            data-testid="mc-maestro-credentials-link"
            className="inline-flex items-center gap-1.5 text-[12px] text-violet-300 hover:text-violet-200"
          >
            Credentials Manager →
          </Link>
        </section>

        <p className="text-[11px] text-white/40">
          Mission Control never mutates local Maestro state. All writable Maestro commands run on the Baseline OS box where your <code>.maestro/</code> directory lives.
        </p>
      </main>
    </div>
  )
}
