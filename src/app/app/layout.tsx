/**
 * Layout scope: authenticated Mission Control dashboard (`/app/*`).
 *
 * The dashboard is a fixed split-pane workstation, not a scroll page. It
 * relies on a viewport-locked container so internal panels can manage their
 * own scrolling. Marketing pages (`/`, `/login`, `/signup`, `/pricing`, etc.)
 * are NOT under this layout and therefore scroll normally.
 *
 * The previous design applied `h-screen overflow-hidden` at the root layout,
 * which trapped scroll for every public route. Moving it here at the
 * `/app/*` segment is the root-cause fix.
 */
export default function AppShellLayout({ children }: { children: React.ReactNode }) {
  return <div className="h-screen overflow-hidden">{children}</div>
}
