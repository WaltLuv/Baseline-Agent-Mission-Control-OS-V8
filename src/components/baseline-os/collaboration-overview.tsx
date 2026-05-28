'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { CollaborationGraph } from '@/lib/baseline-os/trace-derivation'
import { useDemoMode } from '@/components/demo/demo-mode-provider'

/**
 * CollaborationOverview — text-first, executive-grade collaboration view.
 *
 * Renders the workforce as a list of relationships ("Works with", "Hands
 * off to", "Escalates to") plus a single "most-valuable pair" callout.
 *
 * No noisy animated graph. No fake edges. Lives next to the Workforce
 * Health card on the overview / workforce route.
 *
 * Live → `/api/baseline-os/collaboration-graph`
 * Demo → derived from `narrative.lifeSignals[].collaborators`
 */
const VERB: Record<CollaborationGraph['edges'][number]['kind'], string> = {
  'works-with': 'Works with',
  'hands-off-to': 'Hands off to',
  'escalates-to': 'Escalates to',
  'depends-on': 'Depends on',
}

export function CollaborationOverview() {
  const demo = useDemoMode()
  const [graph, setGraph] = useState<CollaborationGraph | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    if (demo.active) {
      setLoaded(true)
      return
    }
    fetch('/api/baseline-os/collaboration-graph', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : { nodes: [], edges: [], topPair: null }))
      .then((j: CollaborationGraph) => {
        if (!cancelled) {
          setGraph(j)
          setLoaded(true)
        }
      })
      .catch(() => {
        if (!cancelled) setLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [demo.active])

  // Demo overlay — synthesize edges from each signal's collaborators[]
  const demoGraph: CollaborationGraph = (() => {
    if (!demo.active || !demo.narrative?.lifeSignals) {
      return { nodes: [], edges: [], topPair: null }
    }
    const edges: CollaborationGraph['edges'] = []
    const nodes: CollaborationGraph['nodes'] = []
    const namesSeen = new Set<string>()
    for (const sig of demo.narrative.lifeSignals) {
      if (!namesSeen.has(sig.agentName)) {
        const role =
          sig.workloadPressure === 'heavy'
            ? 'overloaded'
            : sig.escalation
              ? 'bottleneck'
              : sig.workloadPressure === 'light'
                ? 'underused'
                : 'normal'
        nodes.push({ name: sig.agentName, role })
        namesSeen.add(sig.agentName)
      }
      for (const c of sig.collaborators) {
        edges.push({
          from: sig.agentName,
          to: c,
          kind: sig.escalation ? 'escalates-to' : 'works-with',
          strength: 0.6,
          sharedTasks: 5,
          lastSharedAt: Math.floor(Date.now() / 1000),
        })
      }
    }
    const top = edges[0]
    return {
      nodes,
      edges,
      topPair: top
        ? { left: top.from, right: top.to, reason: 'Highest-value collaboration pair this week.' }
        : null,
    }
  })()

  const data = demo.active ? demoGraph : graph ?? { nodes: [], edges: [], topPair: null }

  if (!loaded) {
    return (
      <section className="rounded-2xl border border-border/40 bg-card/30 p-5 text-sm text-muted-foreground">
        Loading collaboration intelligence…
      </section>
    )
  }

  if (data.edges.length === 0) {
    return (
      <section
        className="rounded-2xl border border-border/40 bg-card/30 p-5"
        data-testid="collaboration-overview-empty"
      >
        <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-primary">
          Workforce Collaboration · Baseline OS
        </p>
        <h2 className="mt-1 text-base font-bold text-foreground">No collaboration history yet</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Once your AI Employees start sharing tasks, Baseline OS will surface who works with whom,
          who hands off, and where the bottlenecks are.
        </p>
      </section>
    )
  }

  return (
    <section
      className="rounded-2xl border border-border/40 bg-card/30 p-5"
      data-testid="collaboration-overview"
    >
      <header className="mb-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-primary">
          Workforce Collaboration · Baseline OS
        </p>
        <h2 className="mt-1 text-base font-bold text-foreground">How your AI workforce works together</h2>
      </header>

      {data.topPair && (
        <p
          className="mb-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-2 text-xs text-emerald-100"
          data-testid="collaboration-top-pair"
        >
          ★ Most valuable pair:{' '}
          <Link
            href={`/app/agents/${encodeURIComponent(data.topPair.left.toLowerCase().replace(/[^a-z0-9]+/g, '-'))}/trace`}
            className="font-semibold hover:underline"
          >
            {data.topPair.left}
          </Link>{' '}
          ↔{' '}
          <Link
            href={`/app/agents/${encodeURIComponent(data.topPair.right.toLowerCase().replace(/[^a-z0-9]+/g, '-'))}/trace`}
            className="font-semibold hover:underline"
          >
            {data.topPair.right}
          </Link>{' '}
          — {data.topPair.reason}
        </p>
      )}

      <ul className="space-y-1.5 text-xs" data-testid="collaboration-edges">
        {data.edges.slice(0, 8).map((e, i) => (
          <li
            key={`${e.from}-${e.to}-${i}`}
            className="flex items-center justify-between gap-3 rounded border border-border/30 bg-card/20 px-3 py-1.5"
            data-testid={`collab-edge-${i}`}
          >
            <span className="truncate">
              <Link
                href={`/app/agents/${encodeURIComponent(e.from.toLowerCase().replace(/[^a-z0-9]+/g, '-'))}/trace`}
                className="font-semibold text-foreground hover:underline"
              >
                {e.from}
              </Link>{' '}
              <span className="text-muted-foreground">{VERB[e.kind]}</span>{' '}
              <Link
                href={`/app/agents/${encodeURIComponent(e.to.toLowerCase().replace(/[^a-z0-9]+/g, '-'))}/trace`}
                className="font-semibold text-foreground hover:underline"
              >
                {e.to}
              </Link>
            </span>
            <span className="shrink-0 text-[10px] text-muted-foreground">
              {e.sharedTasks} shared
            </span>
          </li>
        ))}
      </ul>

      {data.nodes.some((n) => n.role === 'overloaded' || n.role === 'bottleneck') && (
        <p
          className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/5 p-2 text-[11px] text-amber-100"
          data-testid="collaboration-bottlenecks"
        >
          ⚠ Bottlenecks detected:{' '}
          {data.nodes
            .filter((n) => n.role === 'overloaded' || n.role === 'bottleneck')
            .map((n) => n.name)
            .join(', ')}
          . Consider hiring a peer or redistributing work.
        </p>
      )}
    </section>
  )
}
