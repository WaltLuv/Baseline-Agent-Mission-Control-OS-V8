'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

// ─────────────────────────────────────────────────────────────────────
// /app/goals — Operator goals (cloud parity of Baseline OS /goals).
//
// Storage:
//   · Baseline OS local saves goals to {vault}/Baseline Automations/Goals/.
//   · Mission Control cloud persists them in SQLite (`goals` table).
//
// No fake state: every list item is a real DB row; status changes round-trip
// through PATCH; checkboxes only reflect server state, never optimistic-only.
// ─────────────────────────────────────────────────────────────────────

interface Goal {
  id: number
  title: string
  status: 'open' | 'in_progress' | 'done' | 'archived'
  due_date: string | null
  notes: string | null
  created_at: number
  updated_at: number
  completed_at: number | null
}

function formatDate(unix: number): string {
  if (!unix) return ''
  return new Date(unix * 1000).toLocaleDateString(undefined, {
    month: 'short', day: 'numeric',
  })
}

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [newTitle, setNewTitle] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [includeDone, setIncludeDone] = useState(true)

  const fetchGoals = useCallback(async () => {
    try {
      setError(null)
      const res = await fetch('/api/goals', { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as { goals: Goal[] }
      setGoals(data.goals)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'failed to load goals')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchGoals() }, [fetchGoals])

  const addGoal = useCallback(async () => {
    const title = newTitle.trim()
    if (!title || submitting) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `HTTP ${res.status}`)
      }
      const { goal } = (await res.json()) as { goal: Goal }
      setGoals((prev) => [goal, ...prev])
      setNewTitle('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'failed to add goal')
    } finally {
      setSubmitting(false)
    }
  }, [newTitle, submitting])

  const toggleGoal = useCallback(async (id: number, currentStatus: Goal['status']) => {
    const nextStatus: Goal['status'] = currentStatus === 'done' ? 'open' : 'done'
    try {
      const res = await fetch(`/api/goals?id=${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const { goal } = (await res.json()) as { goal: Goal }
      setGoals((prev) => prev.map((g) => (g.id === id ? goal : g)))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'failed to update goal')
    }
  }, [])

  const archiveGoal = useCallback(async (id: number) => {
    try {
      const res = await fetch(`/api/goals?id=${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setGoals((prev) => prev.filter((g) => g.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'failed to archive goal')
    }
  }, [])

  const visible = goals.filter((g) => includeDone || g.status !== 'done')
  const openCount = goals.filter((g) => g.status !== 'done').length
  const doneCount = goals.filter((g) => g.status === 'done').length

  return (
    <div className="h-full overflow-y-auto bg-[#09090b] text-[#fafafa]" data-testid="goals-page">
      <div className="mx-auto max-w-3xl px-6 py-10">
        <header className="mb-6">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/5 px-3 py-1 text-[11px] font-medium text-emerald-300 uppercase tracking-wider mb-3">
            Mission Control · Goals
          </div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">Goals</h1>
          <p className="text-sm text-white/55 leading-relaxed max-w-2xl">
            Workspace-scoped goals. Same surface as the Baseline OS local edition;
            in the cloud they persist to SQLite instead of an Obsidian vault.
          </p>
        </header>

        {/* Add bar */}
        <section className="mb-8 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4" data-testid="goals-add">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') addGoal() }}
              placeholder="What's the next outcome?"
              maxLength={500}
              className="flex-1 bg-transparent border-none outline-none text-sm text-white placeholder-white/40"
              data-testid="goals-add-input"
            />
            <Button
              size="sm"
              disabled={!newTitle.trim() || submitting}
              onClick={addGoal}
              data-testid="goals-add-button"
            >
              {submitting ? 'Adding…' : 'Add goal'}
            </Button>
          </div>
        </section>

        {error && (
          <div className="mb-4 rounded-lg border border-rose-500/30 bg-rose-500/[0.05] px-4 py-3 text-sm text-rose-200" data-testid="goals-error">
            {error}
          </div>
        )}

        {/* Tally + filter */}
        <div className="mb-4 flex items-center justify-between text-xs text-white/55">
          <span data-testid="goals-tally">
            {openCount} open · {doneCount} done
          </span>
          <button
            onClick={() => setIncludeDone((v) => !v)}
            className="text-white/45 hover:text-white/85"
            data-testid="goals-filter-toggle"
          >
            {includeDone ? 'Hide completed' : 'Show completed'}
          </button>
        </div>

        {/* List */}
        <section data-testid="goals-list">
          {loading ? (
            <p className="text-sm text-white/40">Loading…</p>
          ) : visible.length === 0 ? (
            <p className="text-sm text-white/40 italic">
              No goals yet. Add one above; it persists to your workspace.
            </p>
          ) : (
            <ul className="space-y-2">
              {visible.map((g) => (
                <li
                  key={g.id}
                  data-testid={`goal-${g.id}`}
                  className="group flex items-start gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-3 hover:bg-white/[0.04] transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={g.status === 'done'}
                    onChange={() => toggleGoal(g.id, g.status)}
                    className="mt-1 h-4 w-4 rounded border-white/20 bg-transparent cursor-pointer accent-emerald-500"
                    data-testid={`goal-${g.id}-checkbox`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm leading-relaxed ${g.status === 'done' ? 'text-white/40 line-through' : 'text-white/90'}`}>
                      {g.title}
                    </p>
                    <p className="text-[11px] text-white/35 mt-0.5">
                      Updated {formatDate(g.updated_at)}
                      {g.due_date ? ` · Due ${g.due_date}` : ''}
                      {g.completed_at ? ` · Done ${formatDate(g.completed_at)}` : ''}
                    </p>
                  </div>
                  <button
                    onClick={() => archiveGoal(g.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-[11px] text-white/40 hover:text-rose-300"
                    title="Archive goal"
                    data-testid={`goal-${g.id}-archive`}
                  >
                    Archive
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <footer className="mt-10 pt-6 border-t border-white/[0.06] text-xs text-white/40 flex items-center justify-between flex-wrap gap-3">
          <span>Goals persist to your workspace ledger.</span>
          <Link href="/app" className="hover:text-white/80">← Back to dashboard</Link>
        </footer>
      </div>
    </div>
  )
}
