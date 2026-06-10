'use client'

import { usePathname } from 'next/navigation'

/**
 * Layout scope: authenticated Mission Control dashboard (`/app/*`).
 *
 * Most dashboard routes are fixed split-pane workstations whose panels own
 * their own scrolling, so they get a viewport-locked container. But tall
 * customer SETUP pages (activation, credentials, …) are normal `min-h-screen`
 * documents — they MUST use document scrolling, or their content is clipped
 * below the fold inside the locked shell (the recurring P0 scroll bug).
 *
 * Add any full-page setup/scroll route here so it scrolls correctly. Matching
 * is exact-or-prefix so nested subpaths (e.g. `/app/credentials/x`) inherit it.
 */
const DOCUMENT_SCROLL_ROUTES = ['/app/activate', '/app/credentials']

export function AppShellFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isDocumentScroll = DOCUMENT_SCROLL_ROUTES.some(
    (r) => pathname === r || pathname.startsWith(`${r}/`),
  )

  return (
    <div
      className={isDocumentScroll ? 'min-h-screen' : 'h-screen overflow-hidden'}
      data-testid="app-shell-frame"
      data-scroll-mode={isDocumentScroll ? 'document' : 'locked'}
    >
      {children}
    </div>
  )
}
