/**
 * Next.js Middleware — Adds trace headers to every request and logs
 * request duration + status code via the observability layer.
 *
 * This file is read on every request and MUST remain small for cold-start
 * performance. It intentionally does not import heavy dependencies.
 */

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// ── Minimal inlined trace ID generator (avoids import in edge runtime) ─────

let _traceCounter = 0

function generateTraceId(): string {
  const ts = Date.now().toString(36)
  _traceCounter++
  const seq = _traceCounter.toString(36).padStart(4, '0')
  return `trc-${ts}-${seq}${Math.random().toString(36).substring(2, 6)}`
}

// ── Matcher config: which routes this middleware applies to ──────────────

export const config = {
  matcher: [
    // Match all API routes
    '/api/:path*',
    // Match all pages except static assets
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|ico|webp)$).*)',
  ],
}

// ── Middleware handler ───────────────────────────────────────────────────

export function middleware(request: NextRequest) {
  const { method } = request
  const { pathname } = request.nextUrl

  // Create trace ID (respects existing trace header from upstream proxy)
  const existingTraceId = request.headers.get('x-trace-id')
  const traceId = existingTraceId || generateTraceId()
  const startTime = Date.now()

  // Build response with trace header propagation
  const response = NextResponse.next()
  response.headers.set('x-trace-id', traceId)
  response.headers.set('x-request-start', startTime.toString())

  // For API routes, also set timing header for client-side visibility
  if (pathname.startsWith('/api/')) {
    response.headers.set(
      'x-server-timing',
      `trace;desc="${traceId}"`
    )
  }

  return response
}
