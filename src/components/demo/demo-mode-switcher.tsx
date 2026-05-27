'use client'

import { useState } from 'react'
import { useDemoMode } from './demo-mode-provider'
import { BUSINESS_TEMPLATES } from '@/lib/business-templates'
import { DEMO_TEMPLATE_IDS } from '@/lib/demo-narratives'
import { cn } from '@/lib/utils'

/**
 * Demo Workspace Switcher — top-of-app affordance that lets a visitor
 * "View as" any of the 9 business templates. Persists via cookie so sales
 * links like `?demo=cpa` survive page reloads.
 *
 * Shown to ALL authenticated users so prospects can demo even after login.
 */
export function DemoModeSwitcher() {
  const { active, templateId, setDemo } = useDemoMode()
  const [open, setOpen] = useState(false)
  const demoTemplates = BUSINESS_TEMPLATES.filter((t) => DEMO_TEMPLATE_IDS.includes(t.id))

  const currentLabel = active
    ? `${demoTemplates.find((t) => t.id === templateId)?.icon ?? '🎭'} ${demoTemplates.find((t) => t.id === templateId)?.name}`
    : 'View as…'

  return (
    <div className="relative" data-testid="demo-mode-switcher">
      <button
        onClick={() => setOpen((v) => !v)}
        data-testid="demo-mode-toggle"
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
          active
            ? 'border-primary/40 bg-primary/10 text-primary'
            : 'border-border/50 bg-card/40 text-muted-foreground hover:bg-card/60 hover:text-foreground',
        )}
      >
        <span
          className={cn(
            'inline-block h-1.5 w-1.5 rounded-full',
            active ? 'bg-primary animate-pulse' : 'bg-muted-foreground/40',
          )}
        />
        {active ? 'Demo' : 'View'}
        <span className="text-foreground/80">· {currentLabel}</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            data-testid="demo-mode-menu"
            className="absolute right-0 z-50 mt-2 w-72 overflow-hidden rounded-xl border border-border/60 bg-card/95 shadow-2xl backdrop-blur"
          >
            <div className="border-b border-border/40 px-3 py-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Demo Workspace
              </p>
              <p className="mt-0.5 text-xs text-foreground/80">
                See Mission Control as if you ran one of these businesses.
              </p>
            </div>
            <ul className="max-h-72 overflow-y-auto py-1">
              <li>
                <button
                  data-testid="demo-mode-option-off"
                  onClick={() => {
                    setDemo(null)
                    setOpen(false)
                  }}
                  className={cn(
                    'flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted/30',
                    !active && 'bg-primary/5 text-primary',
                  )}
                >
                  <span className="text-lg">🏢</span>
                  <span className="flex-1 text-left">My real workspace</span>
                  {!active && <span className="text-xs text-primary">●</span>}
                </button>
              </li>
              <li className="my-1 border-t border-border/30" />
              {demoTemplates.map((t) => (
                <li key={t.id}>
                  <button
                    data-testid={`demo-mode-option-${t.id}`}
                    onClick={() => {
                      setDemo(t.id)
                      setOpen(false)
                    }}
                    className={cn(
                      'flex w-full items-start gap-2 px-3 py-2 text-sm hover:bg-muted/30',
                      templateId === t.id && 'bg-primary/5',
                    )}
                  >
                    <span className="text-lg">{t.icon}</span>
                    <span className="flex-1 text-left">
                      <span className="block text-foreground">{t.name}</span>
                      <span className="block text-xs text-muted-foreground">{t.tagline}</span>
                    </span>
                    {templateId === t.id && <span className="text-xs text-primary">●</span>}
                  </button>
                </li>
              ))}
            </ul>
            <div className="border-t border-border/40 bg-muted/20 px-3 py-2 text-[10px] text-muted-foreground">
              Demo view overlays a curated story. Real workspace data is unchanged.
            </div>
          </div>
        </>
      )}
    </div>
  )
}
