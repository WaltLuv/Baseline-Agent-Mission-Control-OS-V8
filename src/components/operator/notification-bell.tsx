'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'

/**
 * Header notification bell — surfaces the five Day-2 events that matter:
 *   approvals waiting · failed executions · blocked actions ·
 *   critical tasks · runtime offline.
 *
 * Polls /api/operator/notifications every 30s while mounted, with a
 * gentle backoff if the endpoint errors. Click toggles a dropdown.
 */

interface Day2Item {
  id: string
  kind: 'approval_pending' | 'failed_execution' | 'blocked_action' | 'critical_task' | 'runtime_offline'
  title: string
  detail?: string
  age_hours?: number
  age_label?: string
  severity: 'info' | 'warn' | 'critical'
  url: string
  created_at_iso: string
}

interface Feed {
  unread_count: number
  total_count: number
  items: Day2Item[]
  generated_at: string
}

const KIND_LABEL: Record<Day2Item['kind'], string> = {
  approval_pending: 'Approval',
  failed_execution: 'Failed',
  blocked_action: 'Blocked',
  critical_task: 'Critical',
  runtime_offline: 'Runtime',
}

const SEVERITY_TONE: Record<Day2Item['severity'], string> = {
  critical: 'border-rose-400/40 bg-rose-500/[0.08] text-rose-200',
  warn: 'border-amber-400/40 bg-amber-500/[0.08] text-amber-200',
  info: 'border-white/[0.12] bg-white/[0.04] text-white/70',
}

export function NotificationBell() {
  const [feed, setFeed] = useState<Feed | null>(null)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/operator/notifications', { cache: 'no-store' })
      if (res.ok) setFeed(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const id = window.setInterval(load, 30000)
    return () => window.clearInterval(id)
  }, [load])

  // Close on click outside.
  useEffect(() => {
    if (!open) return
    function onDoc(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const unread = feed?.unread_count ?? 0
  const hasCritical = feed?.items?.some((i) => i.severity === 'critical') ?? false

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v)
          if (!open) load()
        }}
        data-testid="notification-bell"
        aria-label={unread > 0 ? `${unread} unread notifications` : 'Notifications'}
        className="relative h-9 w-9 rounded-md bg-white/[0.04] text-white/75 border border-white/[0.06] hover:bg-white/[0.08] hover:text-white flex items-center justify-center transition-colors"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unread > 0 && (
          <span
            data-testid="notification-bell-badge"
            className={`absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold font-mono flex items-center justify-center ${
              hasCritical ? 'bg-rose-500 text-white' : 'bg-amber-400 text-[#09090b]'
            }`}
          >
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          data-testid="notification-dropdown"
          className="absolute right-0 mt-2 w-[380px] max-w-[calc(100vw-32px)] max-h-[70vh] rounded-xl border border-white/[0.08] bg-[#0f0f17] shadow-2xl overflow-hidden z-50 flex flex-col"
        >
          <header className="flex items-center justify-between gap-2 px-4 py-3 border-b border-white/[0.06]">
            <div>
              <p className="text-xs uppercase tracking-wider text-violet-300/80 font-mono">
                Day-2 inbox
              </p>
              <p className="text-sm text-white/85">
                {unread === 0
                  ? 'All clear.'
                  : `${unread} ${unread === 1 ? 'item needs' : 'items need'} your eye`}
              </p>
            </div>
            <button
              type="button"
              onClick={load}
              disabled={loading}
              data-testid="notification-refresh"
              className="text-xs text-white/55 hover:text-white px-2 py-1 rounded border border-white/[0.06] hover:bg-white/[0.06] disabled:opacity-50"
            >
              {loading ? '…' : 'Refresh'}
            </button>
          </header>

          <div className="flex-1 overflow-auto">
            {(!feed || feed.items.length === 0) && (
              <div data-testid="notification-empty" className="px-4 py-10 text-center">
                <p className="text-sm text-white/65">Nothing to flag right now.</p>
                <p className="text-xs text-white/40 mt-1">Your workforce is running clean.</p>
              </div>
            )}
            {feed && feed.items.length > 0 && (
              <ul className="divide-y divide-white/[0.04]">
                {feed.items.map((item) => (
                  <li key={item.id} data-testid={`notification-item-${item.kind}`}>
                    <Link
                      href={item.url}
                      onClick={() => setOpen(false)}
                      className="block px-4 py-3 hover:bg-white/[0.03] transition-colors"
                    >
                      <div className="flex items-start gap-2.5">
                        <span className={`shrink-0 mt-0.5 text-[10px] uppercase tracking-wider font-mono px-1.5 py-0.5 rounded border ${SEVERITY_TONE[item.severity]}`}>
                          {KIND_LABEL[item.kind]}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-white truncate">{item.title}</p>
                          {item.detail && (
                            <p className="text-xs text-white/55 mt-0.5 line-clamp-2">{item.detail}</p>
                          )}
                          {item.age_label && (
                            <p className="text-[10px] text-white/35 font-mono mt-1">{item.age_label}</p>
                          )}
                        </div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <footer className="px-4 py-2 border-t border-white/[0.06] text-[10px] text-white/40 font-mono flex items-center justify-between">
            <span>{feed && `Updated ${new Date(feed.generated_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`}</span>
            <Link href="/app/approvals" onClick={() => setOpen(false)} className="text-violet-300 hover:text-violet-200">
              Open approval queue →
            </Link>
          </footer>
        </div>
      )}
    </div>
  )
}
