'use client'

/**
 * Mission Control — Operator Refresh Preferences
 *
 * Centralizes every "auto-poll the server" interval into one user-controlled
 * subscription. Why this exists:
 *   - Before, ~14 panels each ran their own `setInterval` between 5s and 30s.
 *     The cumulative effect made the UI feel like it was constantly resetting:
 *     scroll positions jumped, modals flickered, demo mode reset state.
 *   - Now every panel that wants to "stay fresh" subscribes through one place.
 *     We default to a slow, non-disruptive 120s cadence. We pause when the
 *     tab is hidden. We pause when a form, modal, or text input is focused.
 *     And the operator can toggle auto-refresh off entirely from the header.
 *
 * Usage in a panel:
 *
 *   const refreshConfig = useRefreshConfig()
 *   useAutoRefresh(loadData, refreshConfig)
 *
 * Usage from a "Refresh now" button:
 *
 *   const { triggerRefresh } = useRefreshConfig()
 *   <button onClick={triggerRefresh}>Refresh now</button>
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

const STORAGE_KEY = 'mc-refresh-prefs-v1'
export const REFRESH_INTERVAL_PRESETS = [60_000, 120_000, 300_000, 600_000] as const
const DEFAULT_INTERVAL_MS = 120_000

interface RefreshPrefs {
  enabled: boolean
  intervalMs: number
}

interface RefreshContextValue extends RefreshPrefs {
  setEnabled: (next: boolean) => void
  setIntervalMs: (ms: number) => void
  /** Manually trigger every subscribed loader RIGHT NOW. */
  triggerRefresh: () => void
  /** Subscribe to the "operator clicked refresh" event. Returns unsubscribe. */
  onManualRefresh: (cb: () => void) => () => void
  /** Pause auto-refresh while truthy (e.g., during a form or modal). */
  registerInteractionLock: () => () => void
  /** True when any registered interaction lock is held. */
  interactionLocked: boolean
}

const RefreshContext = createContext<RefreshContextValue | null>(null)

function loadPrefs(): RefreshPrefs {
  if (typeof window === 'undefined') return { enabled: true, intervalMs: DEFAULT_INTERVAL_MS }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return { enabled: true, intervalMs: DEFAULT_INTERVAL_MS }
    const parsed = JSON.parse(raw) as Partial<RefreshPrefs>
    return {
      enabled: parsed.enabled !== false,
      intervalMs:
        typeof parsed.intervalMs === 'number' && parsed.intervalMs >= 30_000
          ? parsed.intervalMs
          : DEFAULT_INTERVAL_MS,
    }
  } catch {
    return { enabled: true, intervalMs: DEFAULT_INTERVAL_MS }
  }
}

function persistPrefs(prefs: RefreshPrefs) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
  } catch {
    // best-effort
  }
}

export function RefreshConfigProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<RefreshPrefs>(() => loadPrefs())
  const [lockCount, setLockCount] = useState(0)
  const manualSubsRef = useRef<Set<() => void>>(new Set())

  // Persist whenever prefs change.
  useEffect(() => {
    persistPrefs(prefs)
  }, [prefs])

  const setEnabled = useCallback((next: boolean) => {
    setPrefs((p) => ({ ...p, enabled: next }))
  }, [])

  const setIntervalMs = useCallback((ms: number) => {
    setPrefs((p) => ({ ...p, intervalMs: Math.max(30_000, ms) }))
  }, [])

  const triggerRefresh = useCallback(() => {
    manualSubsRef.current.forEach((cb) => {
      try {
        cb()
      } catch {
        // never let one panel break the others
      }
    })
  }, [])

  const onManualRefresh = useCallback((cb: () => void) => {
    manualSubsRef.current.add(cb)
    return () => {
      manualSubsRef.current.delete(cb)
    }
  }, [])

  const registerInteractionLock = useCallback(() => {
    setLockCount((c) => c + 1)
    return () => setLockCount((c) => Math.max(0, c - 1))
  }, [])

  const value = useMemo<RefreshContextValue>(
    () => ({
      ...prefs,
      setEnabled,
      setIntervalMs,
      triggerRefresh,
      onManualRefresh,
      registerInteractionLock,
      interactionLocked: lockCount > 0,
    }),
    [prefs, setEnabled, setIntervalMs, triggerRefresh, onManualRefresh, registerInteractionLock, lockCount],
  )

  return <RefreshContext.Provider value={value}>{children}</RefreshContext.Provider>
}

export function useRefreshConfig(): RefreshContextValue {
  const ctx = useContext(RefreshContext)
  if (!ctx) {
    // Safe fallback for components that may render outside the provider during
    // testing or migration — they get sensible defaults and a no-op manual
    // refresh API.
    return {
      enabled: true,
      intervalMs: DEFAULT_INTERVAL_MS,
      setEnabled: () => {},
      setIntervalMs: () => {},
      triggerRefresh: () => {},
      onManualRefresh: () => () => {},
      registerInteractionLock: () => () => {},
      interactionLocked: false,
    }
  }
  return ctx
}

/**
 * Wires `loader` into the global auto-refresh cadence with all the
 * non-disruptive guards (tab visibility, interaction locks, manual refresh
 * button). The loader is NOT called on mount — callers handle the initial
 * fetch themselves.
 *
 * Returns a stable `refreshNow` callback (so panels can wire their own
 * "Refresh now" button without going through the global one).
 */
export function useAutoRefresh(
  loader: () => void | Promise<void>,
  opts?: { minIntervalMs?: number; pauseWhile?: boolean },
): () => void {
  const cfg = useRefreshConfig()
  const loaderRef = useRef(loader)
  useEffect(() => {
    loaderRef.current = loader
  }, [loader])

  const runNow = useCallback(() => {
    try {
      void loaderRef.current()
    } catch {
      // ignore
    }
  }, [])

  // Subscribe to the global "Refresh now" button.
  useEffect(() => cfg.onManualRefresh(runNow), [cfg, runNow])

  // Auto-refresh loop with all the guards.
  useEffect(() => {
    if (!cfg.enabled) return
    if (opts?.pauseWhile) return
    if (cfg.interactionLocked) return
    const interval = Math.max(opts?.minIntervalMs ?? cfg.intervalMs, cfg.intervalMs)
    const id = window.setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return
      runNow()
    }, interval)
    return () => window.clearInterval(id)
  }, [cfg.enabled, cfg.intervalMs, cfg.interactionLocked, opts?.minIntervalMs, opts?.pauseWhile, runNow])

  return runNow
}
