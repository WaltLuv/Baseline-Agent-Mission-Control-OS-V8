import { OperatorShortcutsProvider } from '@/components/operator/operator-shortcuts'
import { AppShellFrame } from '@/components/layout/app-shell-frame'

/**
 * Layout scope: authenticated Mission Control dashboard (`/app/*`).
 *
 * Most dashboard routes are fixed split-pane workstations whose panels own
 * their own scrolling — those get a viewport-locked container. Customer setup
 * flows (e.g. `/app/activate`) need NORMAL document scrolling so every option
 * is reachable. `<AppShellFrame>` picks the right mode per route — it must NOT
 * be replaced with a hardcoded `h-screen overflow-hidden` wrapper, which traps
 * the activation page and hides workforce options below the fold (P0 regression).
 *
 * `<OperatorShortcutsProvider>` wraps the shell so global keyboard
 * shortcuts (?, /, A, R, J, K, Esc) work on every authenticated route.
 */
export default function AppShellLayout({ children }: { children: React.ReactNode }) {
  return (
    <OperatorShortcutsProvider>
      <AppShellFrame>{children}</AppShellFrame>
    </OperatorShortcutsProvider>
  )
}
