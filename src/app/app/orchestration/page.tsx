'use client'

/**
 * /app/orchestration — cloud-native orchestration surface.
 *
 * Walt's bottom line: Mission Control cloud stands alone. This page
 * renders missions + tasks + ready queue + active + proofs straight from
 * the cloud DB; it does NOT shell out to a local maestro CLI and does
 * NOT require Baseline OS. When local Maestro events arrive via the
 * (future #63) mirror, the same page renders them with a
 * `Source: baseline-local | maestro-import` chip.
 */

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'

type Mission = {
  id: number
  slug: string
  title: string
  status: 'active' | 'done' | 'archived'
  source: 'cloud' | 'baseline-local' | 'maestro-import'
}

type Task = {
  id: number
  mission_id: number
  title: string
  status: 'todo' | 'ready' | 'in_progress' | 'approval_required' | 'blocked' | 'failed' | 'done'
  priority: number
  assignee: string | null
  runtime_hint: string | null
  source: 'cloud' | 'baseline-local' | 'maestro-import'
  claimed_by_runtime_key_id: number | null
  heartbeat_at: number | null
  blocked_by: number[]
  maestro_task_id: string | null
}

const STATUS_TONE: Record<Task['status'], string> = {
  todo: 'text-zinc-300 bg-zinc-500/10 border-zinc-500/30',
  ready: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30',
  in_progress: 'text-violet-300 bg-violet-500/10 border-violet-500/30',
  approval_required: 'text-amber-300 bg-amber-500/10 border-amber-500/30',
  blocked: 'text-red-300 bg-red-500/10 border-red-500/30',
  failed: 'text-red-300 bg-red-500/10 border-red-500/30',
  done: 'text-zinc-400 bg-zinc-500/10 border-zinc-500/30',
}

const SOURCE_LABEL: Record<Task['source'], string> = {
  cloud: 'Cloud',
  'baseline-local': 'Mirrored from Baseline OS',
  'maestro-import': 'Imported from Maestro',
}

type MirrorStatus = {
  total_mirrored: number
  by_source: Record<string, number>
  latest_event_at: number | null
}

export default function OrchestrationPage() {
  const [missions, setMissions] = useState<Mission[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [mirror, setMirror] = useState<MirrorStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeMission, setActiveMission] = useState<number | 'all'>('all')

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [mRes, tRes, sRes] = await Promise.all([
        fetch('/api/orchestration/missions', { cache: 'no-store' }),
        fetch('/api/orchestration/tasks', { cache: 'no-store' }),
        fetch('/api/orchestration/mirror/status', { cache: 'no-store' }),
      ])
      if (!mRes.ok) throw new Error(`missions HTTP ${mRes.status}`)
      if (!tRes.ok) throw new Error(`tasks HTTP ${tRes.status}`)
      const mData = (await mRes.json()) as { missions: Mission[] }
      const tData = (await tRes.json()) as { tasks: Task[] }
      setMissions(mData.missions)
      setTasks(tData.tasks)
      if (sRes.ok) setMirror((await sRes.json()) as MirrorStatus)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'load failed')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload])

  const filteredTasks = useMemo(() => {
    if (activeMission === 'all') return tasks
    return tasks.filter((t) => t.mission_id === activeMission)
  }, [tasks, activeMission])

  const buckets = useMemo(() => {
    const out = {
      ready: [] as Task[],
      in_progress: [] as Task[],
      blocked: [] as Task[],
      approval_required: [] as Task[],
      done_or_failed: [] as Task[],
      todo: [] as Task[],
    }
    for (const t of filteredTasks) {
      if (t.status === 'ready') out.ready.push(t)
      else if (t.status === 'in_progress') out.in_progress.push(t)
      else if (t.status === 'blocked') out.blocked.push(t)
      else if (t.status === 'approval_required') out.approval_required.push(t)
      else if (t.status === 'done' || t.status === 'failed') out.done_or_failed.push(t)
      else out.todo.push(t)
    }
    return out
  }, [filteredTasks])

  return (
    <div className="min-h-screen bg-[#09090b] text-[#fafafa] antialiased" data-testid="orchestration-page">
      <main className="mx-auto max-w-screen-xl px-6 py-10 space-y-6">
        <header>
          <p className="text-[10px] uppercase tracking-[0.24em] text-violet-300/80 font-mono mb-2">
            Cloud-native · Maestro-compatible
          </p>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Orchestration</h1>
              <p className="mt-2 text-sm text-white/55 max-w-2xl">
                Missions + tasks + ready queue + active runs + proofs.
                Cloud rows live in Mission Control&apos;s DB; baseline-local rows arrive via the #63 event/proof mirror (no DB replication).
              </p>
            </div>
            <div className="flex items-center gap-2">
              <a
                href="/api/orchestration/export?format=maestro"
                data-testid="orchestration-export"
                className="text-xs font-semibold rounded-md border border-white/[0.1] px-3 py-1.5 hover:bg-white/[0.04]"
                target="_blank"
                rel="noopener noreferrer"
              >
                Export as Maestro JSON ↓
              </a>
              <button
                type="button"
                onClick={() => void reload()}
                data-testid="orchestration-refresh"
                className="text-xs font-semibold rounded-md border border-white/[0.1] px-3 py-1.5 hover:bg-white/[0.04]"
              >
                Refresh
              </button>
            </div>
          </div>
        </header>

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/[0.06] px-4 py-3 text-sm text-red-200">
            Could not load: {error}
          </div>
        )}

        {/* Mirror status — surfaces #63 health honestly. Empty state when no
            Baseline OS box has connected yet; live counters when it has. */}
        {mirror && (
          <section
            data-testid="orchestration-mirror-status"
            className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 flex flex-wrap items-center gap-4 text-[12px]"
          >
            <div className="text-[11px] uppercase tracking-[0.22em] text-white/45 font-mono">
              Mirror (#63 event/proof sync)
            </div>
            {mirror.total_mirrored === 0 ? (
              <span className="text-white/45">
                No Baseline OS mirror traffic yet. Run <code className="bg-black/40 px-1 rounded text-white/70">bun run scripts/mc.ts mirror push</code> on your local box.
              </span>
            ) : (
              <>
                <span className="text-white/75">
                  <strong className="text-white">{mirror.total_mirrored}</strong> events mirrored
                </span>
                {Object.entries(mirror.by_source).map(([source, n]) => (
                  <span key={source} className="text-white/55">
                    · {source}: <strong className="text-white/80">{n}</strong>
                  </span>
                ))}
                {mirror.latest_event_at && (
                  <span className="text-white/45 font-mono">
                    · latest {new Date(mirror.latest_event_at * 1000).toLocaleTimeString()}
                  </span>
                )}
              </>
            )}
          </section>
        )}

        {/* Mission picker */}
        <section data-testid="orchestration-missions">
          <h2 className="text-[11px] uppercase tracking-[0.22em] text-white/45 font-mono mb-2">
            Missions ({missions.length})
          </h2>
          {loading ? (
            <p className="text-xs text-white/45">Loading…</p>
          ) : missions.length === 0 ? (
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-sm text-white/60" data-testid="orchestration-empty">
              No missions yet. Create one via{' '}
              <code className="text-white/80 bg-black/40 px-1 rounded text-[12px]">POST /api/orchestration/missions</code>.
              See{' '}
              <Link href="/app/maestro" className="underline">/app/maestro</Link>{' '}
              for the local-mirror story and{' '}
              <code className="text-white/80 bg-black/40 px-1 rounded text-[12px]">docs/architecture/ORCHESTRATION_MAP.md</code>{' '}
              for the architecture map.
            </div>
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setActiveMission('all')}
                data-testid="orchestration-mission-all"
                className={`text-xs font-semibold border rounded-full px-3 py-1 ${
                  activeMission === 'all'
                    ? 'bg-white/[0.08] border-white/[0.2] text-white'
                    : 'border-white/[0.06] text-white/55 hover:text-white'
                }`}
              >
                All ({tasks.length})
              </button>
              {missions.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setActiveMission(m.id)}
                  data-testid={`orchestration-mission-${m.id}`}
                  className={`text-xs font-semibold border rounded-full px-3 py-1 inline-flex items-center gap-1.5 ${
                    activeMission === m.id
                      ? 'bg-white/[0.08] border-white/[0.2] text-white'
                      : 'border-white/[0.06] text-white/55 hover:text-white'
                  }`}
                >
                  {m.title}
                  <span className="text-[10px] uppercase tracking-wider text-white/40">
                    {SOURCE_LABEL[m.source]}
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Buckets */}
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" data-testid="orchestration-buckets">
          {([
            ['ready', 'Ready'],
            ['in_progress', 'In progress'],
            ['approval_required', 'Approval required'],
            ['blocked', 'Blocked'],
            ['done_or_failed', 'Done / failed'],
            ['todo', 'Todo (waiting on deps)'],
          ] as Array<[keyof typeof buckets, string]>).map(([key, label]) => (
            <div
              key={key}
              data-testid={`orchestration-bucket-${key}`}
              className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"
            >
              <h3 className="text-[11px] uppercase tracking-[0.22em] text-white/45 font-mono mb-2">
                {label} ({buckets[key].length})
              </h3>
              {buckets[key].length === 0 ? (
                <p className="text-xs text-white/40">—</p>
              ) : (
                <ul className="space-y-2">
                  {buckets[key].slice(0, 12).map((t) => (
                    <li
                      key={t.id}
                      data-testid={`orchestration-task-${t.id}`}
                      className="rounded-lg border border-white/[0.06] bg-black/30 px-3 py-2"
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="text-sm font-semibold text-white truncate">{t.title}</div>
                        <span className={`text-[10px] uppercase tracking-wider border rounded-full px-2 py-0.5 ${STATUS_TONE[t.status]}`}>
                          {t.status}
                        </span>
                      </div>
                      <div className="text-[11px] text-white/45 font-mono flex flex-wrap items-center gap-2">
                        <span>#{t.id}</span>
                        <span>·</span>
                        <span>{SOURCE_LABEL[t.source]}</span>
                        {t.runtime_hint && (
                          <>
                            <span>·</span>
                            <span>runtime: {t.runtime_hint}</span>
                          </>
                        )}
                        {t.claimed_by_runtime_key_id && (
                          <>
                            <span>·</span>
                            <span>key #{t.claimed_by_runtime_key_id}</span>
                          </>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </section>

        <p className="text-[11px] text-white/40 max-w-2xl">
          API contract: <code>POST /api/orchestration/missions</code>,{' '}
          <code>POST /api/orchestration/missions/[id]/tasks</code>,{' '}
          <code>POST /api/orchestration/tasks/[id]/claim</code>,{' '}
          <code>PUT /api/orchestration/tasks/[id]</code>,{' '}
          <code>POST /api/orchestration/tasks/[id]/proof</code>,{' '}
          <code>GET /api/orchestration/export?format=maestro</code>.
          Remote runtimes authenticate with an agent-scoped API key whose workspace matches the target row.
        </p>
      </main>
    </div>
  )
}
