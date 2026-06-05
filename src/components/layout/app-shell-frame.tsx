'use client'

import { usePathname } from 'next/navigation'

/**
 * Layout scope: authenticated Mission Control dashboard (`/app/*`).
 *
 * Most dashboard routes are fixed split-pane workstations whose panels own
 * their own scrolling. `/app/activate` is a customer setup flow, so it must
 * use normal document scrolling instead of the dashboard viewport lock.
 */
export function AppShellFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isActivationFlow = pathname === '/app/activate'

  return (
    <div
      className={isActivationFlow ? 'min-h-screen' : 'h-screen'}
      data-testid="app-shell-frame"
      data-scroll-mode={isActivationFlow ? 'document' : 'locked'}
    >
      {children}
    </div>
  )
}
