'use client'

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react'
import { useSearchParams } from 'next/navigation'
import { getDemoNarrative, DEMO_TEMPLATE_IDS, type DemoNarrative } from '@/lib/demo-narratives'

interface DemoContextValue {
  active: boolean
  narrative: DemoNarrative | null
  templateId: string | null
  /** Switch to a different demo persona. */
  setDemo: (id: string | null) => void
}

const DemoContext = createContext<DemoContextValue>({
  active: false,
  narrative: null,
  templateId: null,
  setDemo: () => {},
})

const COOKIE_NAME = 'mc_demo_template'

function readCookie(): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(new RegExp('(?:^|; )' + COOKIE_NAME + '=([^;]*)'))
  return match ? decodeURIComponent(match[1]) : null
}

function writeCookie(value: string | null): void {
  if (typeof document === 'undefined') return
  if (value === null) {
    document.cookie = `${COOKIE_NAME}=; path=/; max-age=0`
  } else {
    document.cookie = `${COOKIE_NAME}=${encodeURIComponent(value)}; path=/; max-age=2592000; SameSite=Lax`
  }
}

export function DemoModeProvider({ children }: { children: ReactNode }) {
  const params = useSearchParams()
  const [templateId, setTemplateId] = useState<string | null>(null)

  useEffect(() => {
    const fromQuery = params?.get('demo')
    if (fromQuery !== null) {
      if (fromQuery === '' || fromQuery === 'off' || fromQuery === 'none') {
        writeCookie(null)
        setTemplateId(null)
      } else if (DEMO_TEMPLATE_IDS.includes(fromQuery)) {
        writeCookie(fromQuery)
        setTemplateId(fromQuery)
      }
      return
    }
    const cookie = readCookie()
    if (cookie && DEMO_TEMPLATE_IDS.includes(cookie)) setTemplateId(cookie)
  }, [params])

  const setDemo = useCallback((id: string | null) => {
    writeCookie(id)
    setTemplateId(id)
    // NOTE: we intentionally do NOT call router.refresh() here. Doing so
    // resets every panel's state (scroll, modals, form inputs, expanded
    // accordions). The provider's React state is the single source of
    // truth — every consumer re-renders from this state change alone.
  }, [])

  const narrative = templateId ? getDemoNarrative(templateId) : null
  const active = !!narrative

  return (
    <DemoContext.Provider value={{ active, narrative, templateId, setDemo }}>
      {children}
    </DemoContext.Provider>
  )
}

export function useDemoMode(): DemoContextValue {
  return useContext(DemoContext)
}
