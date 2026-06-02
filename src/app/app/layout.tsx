import { OperatorShortcutsProvider } from '@/components/operator/operator-shortcuts'

/**
 * Layout scope: authenticated Mission Control dashboard (`/app/*`).
 *
 * The dashboard is a fixed split-pane workstation, not a scroll page. It
 * relies on a viewport-locked container so internal panels can manage their
 * own scrolling. Marketing pages (`/`, `/login`, `/signup`, `/pricing`, etc.)
 * are NOT under this layout and therefore scroll normally.
 *
 * `<OperatorShortcutsProvider>` wraps the shell so global keyboard
 * shortcuts (?, /, A, R, J, K, Esc) work on every authenticated route.
 */
export default function AppShellLayout({ children }: { children: React.ReactNode }) {
  return (
    <OperatorShortcutsProvider>
      <div className="h-screen overflow-hidden">{children}</div>
    </OperatorShortcutsProvider>
  )
}
