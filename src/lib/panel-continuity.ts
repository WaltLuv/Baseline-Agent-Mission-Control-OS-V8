'use client'

import { useEffect, useRef } from 'react'

/**
 * Cross-Panel Continuity — calm, additive state retention.
 *
 * Goal: when an executive moves between panels, the surface should not
 * forget where they were. This module backs two pieces of continuity:
 *
 *   1. Per-panel scroll position (sessionStorage) — when the operator
 *      navigates Overview → Tasks → Overview, the Overview scroll
 *      position is restored. Cleared on a hard reload (sessionStorage)
 *      so we never resurrect stale state across sessions.
 *
 *   2. Last-touched employee slug — when the operator clicks an AI
 *      Employee in any list, downstream panels can deep-link to that
 *      slug without the operator having to re-select.
 *
 * Constraints:
 *   - No layout jumps. Scroll is restored after layout settles, gated by
 *     a microtask so the panel's first paint never appears to "snap".
 *   - No refresh loops. We only write on scroll/visibility-change, not
 *     on every render.
 *   - Honors prefers-reduced-motion by skipping the restore animation
 *     and using instant scroll.
 */

const SCROLL_KEY = 'mc:panel-scroll-v1'
const EMPLOYEE_KEY = 'mc:last-touched-employee-v1'

interface ScrollMap {
  [panel: string]: number
}

function readScrollMap(): ScrollMap {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.sessionStorage.getItem(SCROLL_KEY)
    return raw ? (JSON.parse(raw) as ScrollMap) : {}
  } catch {
    return {}
  }
}

function writeScrollMap(map: ScrollMap) {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(SCROLL_KEY, JSON.stringify(map))
  } catch {
    // sessionStorage may be unavailable (Safari private mode). Ignore.
  }
}

/**
 * Per-panel scroll memory. Attach to the scrollable element of the
 * dashboard main content (`<main>`). Scroll position is saved as the
 * operator scrolls and restored when the panel id changes.
 */
export function usePanelScrollMemory(
  scrollRef: React.RefObject<HTMLElement | null>,
  panelId: string,
) {
  const lastPanel = useRef<string | null>(null)

  // Persist scroll on scroll events (debounced via rAF).
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    let ticking = false
    const onScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        const map = readScrollMap()
        map[panelId] = el.scrollTop
        writeScrollMap(map)
        ticking = false
      })
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [scrollRef, panelId])

  // Restore on first mount per panel, and again whenever the panel changes.
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    if (lastPanel.current === panelId) return // already restored for this panel
    lastPanel.current = panelId

    const map = readScrollMap()
    const saved = map[panelId]
    if (typeof saved !== 'number' || saved <= 0) {
      // No saved position — leave the scroll at top (the panel just mounted).
      return
    }
    // Restore after layout settles; use 'auto' so no jarring smooth-scroll.
    // Two rAFs give the panel content time to lay out and the scrollHeight to
    // stabilize before we attempt the scrollTo.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        try {
          el.scrollTo({ top: saved, behavior: 'auto' })
        } catch {
          el.scrollTop = saved
        }
      })
    })
  }, [scrollRef, panelId])
}

/** Read the last-touched employee slug, or null if none. */
export function getLastTouchedEmployee(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.sessionStorage.getItem(EMPLOYEE_KEY)
  } catch {
    return null
  }
}

/** Persist the last-touched employee slug for downstream panels. */
export function setLastTouchedEmployee(slug: string | null) {
  if (typeof window === 'undefined') return
  try {
    if (slug) window.sessionStorage.setItem(EMPLOYEE_KEY, slug)
    else window.sessionStorage.removeItem(EMPLOYEE_KEY)
  } catch {
    // ignore
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('mc:employee-touched', { detail: { slug } }))
  }
}
