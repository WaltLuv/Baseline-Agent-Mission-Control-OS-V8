/**
 * SafeBoundary — a minimal React error boundary.
 *
 * Why this exists: the home page embeds a WebGL/three.js memory graph
 * (MemoryGraph3D). On machines/browsers where a WebGL context can't be
 * created, that component throws during render. A plain <Suspense> does NOT
 * catch render errors, so the throw bubbled to the route error boundary and
 * replaced the ENTIRE page with "Something went wrong" — which also killed
 * scrolling. Wrapping fragile/optional widgets in <SafeBoundary> keeps a local
 * failure local: the rest of the page renders and scrolls normally.
 */
import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  /** Rendered in place of the children when they throw. */
  fallback?: ReactNode;
  /** Optional label for debugging. */
  label?: string;
}

interface State {
  failed: boolean;
}

export class SafeBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Local, non-fatal. Log for diagnostics; never rethrow.
    console.warn(
      `[SafeBoundary${this.props.label ? `:${this.props.label}` : ""}] contained a render error`,
      error?.message,
      info?.componentStack,
    );
  }

  render() {
    if (this.state.failed) {
      return (
        this.props.fallback ?? (
          <div
            data-testid="safe-boundary-fallback"
            className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4 text-[12px] text-zinc-500"
          >
            This panel couldn&apos;t load in your browser (it needs WebGL). The rest of the page is
            unaffected.
          </div>
        )
      );
    }
    return this.props.children;
  }
}
