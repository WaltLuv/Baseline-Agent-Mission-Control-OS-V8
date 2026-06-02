'use client'

/**
 * Global error boundary for Mission Control.
 *
 * Why this file exists
 * ─────────────────────────────────────────────────────────────────────
 * The Next.js App Router auto-generates a `/_global-error` route during
 * prerender. When the root `layout.tsx` mounts client providers
 * (`next-themes`, `next-intl`, `RefreshConfigProvider`) that depend on
 * React Context, the auto-generated fallback can crash with
 *
 *     TypeError: Cannot read properties of null (reading 'useContext')
 *
 * because those providers aren't available in the global-error render
 * scope.
 *
 * Per the Next.js docs (Handling Global Errors), a user-supplied
 * `app/global-error.tsx` REPLACES the root layout entirely while a
 * top-level error is being handled — it MUST define its own `<html>`
 * and `<body>` and MUST NOT consume any provider/context from the
 * normal layout tree.
 *
 * This file is therefore deliberately provider-free, self-contained,
 * and visually minimal. It also logs the error so we still capture it
 * for diagnostics.
 */
import { useEffect } from 'react'

type GlobalErrorProps = {
  error: Error & { digest?: string }
  reset: () => void
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    // Best-effort console capture — runs only on the client.
    // We deliberately do NOT route through a telemetry provider here
    // because the global-error boundary must remain provider-free.
    // eslint-disable-next-line no-console
    console.error('[mission-control] global-error boundary caught:', error)
  }, [error])

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          background: '#0b0b14',
          color: '#e7e7ef',
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
        }}
      >
        <div
          role="alert"
          aria-live="assertive"
          data-testid="global-error-boundary"
          style={{
            maxWidth: '480px',
            width: '100%',
            background: 'rgba(20, 20, 30, 0.78)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '14px',
            padding: '28px 26px',
            boxShadow: '0 24px 60px rgba(0, 0, 0, 0.35)',
          }}
        >
          <div
            style={{
              fontSize: '12px',
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: '#9b9bb5',
              marginBottom: '10px',
            }}
          >
            Mission Control
          </div>
          <h1
            style={{
              fontSize: '20px',
              fontWeight: 600,
              margin: '0 0 10px',
              color: '#f4f4f8',
            }}
          >
            Something went wrong.
          </h1>
          <p
            style={{
              fontSize: '14px',
              lineHeight: 1.55,
              color: '#c7c7d5',
              margin: '0 0 18px',
            }}
          >
            The page hit an unrecoverable error. Try again — if it keeps
            happening, refresh or contact support and share the digest
            below.
          </p>
          {error?.digest ? (
            <div
              style={{
                fontFamily:
                  'ui-monospace, SFMono-Regular, Menlo, monospace',
                fontSize: '12px',
                color: '#7a7a96',
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                borderRadius: '8px',
                padding: '8px 10px',
                marginBottom: '18px',
                wordBreak: 'break-all',
              }}
              data-testid="global-error-digest"
            >
              digest: {error.digest}
            </div>
          ) : null}
          <button
            type="button"
            onClick={() => reset()}
            data-testid="global-error-retry"
            style={{
              appearance: 'none',
              border: '1px solid rgba(180, 180, 220, 0.4)',
              background: 'rgba(120, 120, 220, 0.18)',
              color: '#f4f4f8',
              fontSize: '13px',
              fontWeight: 600,
              padding: '9px 18px',
              borderRadius: '10px',
              cursor: 'pointer',
              letterSpacing: '0.02em',
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  )
}
