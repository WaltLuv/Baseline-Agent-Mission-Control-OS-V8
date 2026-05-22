/**
 * Observability Layer — Structured logging, request tracing, error aggregation,
 * and performance timing for Mission Control.
 *
 * Provides:
 *   - logStructured(): JSON-structured logging with level, message, metadata, traceId
 *   - RequestTracer: Assigns unique traceId per request, logs method+path+duration+status
 *   - ErrorAggregator: Collects/deduplicates errors, exposes getTopErrors/getRecentErrors
 *   - PerformanceTimer: Measures operation duration, auto-logs slow ops (>100ms default threshold)
 */

// ── Structured Logging ───────────────────────────────────────────────────

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface StructuredLogEvent {
  level: LogLevel
  message: string
  traceId?: string
  durationMs?: number
  statusCode?: number
  method?: string
  path?: string
  [key: string]: unknown
}

/**
 * Write a JSON-structured log line to stdout (production) or console (dev).
 * Each line includes timestamp, level, message, and arbitrary metadata.
 */
export function logStructured(event: StructuredLogEvent): void {
  const logLine: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    level: event.level,
    message: event.message,
    ...(event.traceId ? { traceId: event.traceId } : {}),
    ...(event.durationMs !== undefined ? { durationMs: event.durationMs } : {}),
    ...(event.statusCode !== undefined ? { statusCode: event.statusCode } : {}),
    ...(event.method ? { method: event.method } : {}),
    ...(event.path ? { path: event.path } : {}),
  }

  // Strip out the known keys so we only emit custom metadata
  const knownKeys = new Set(['level', 'message', 'traceId', 'durationMs', 'statusCode', 'method', 'path'])
  for (const [key, value] of Object.entries(event)) {
    if (!knownKeys.has(key)) {
      logLine[key] = value
    }
  }

  if (process.env.NODE_ENV === 'production') {
    if (event.level === 'error') {
      process.stderr.write(JSON.stringify(logLine) + '\n')
    } else {
      process.stdout.write(JSON.stringify(logLine) + '\n')
    }
    return
  }

  // Development: colorized console
  const prefix = `[${event.level.toUpperCase()}]`
  switch (event.level) {
    case 'error':
      console.error(`${prefix} ${event.message}`, logLine)
      break
    case 'warn':
      console.warn(`${prefix} ${event.message}`, logLine)
      break
    case 'info':
      console.info(`${prefix} ${event.message}`, logLine)
      break
    case 'debug':
      console.debug(`${prefix} ${event.message}`, logLine)
      break
  }
}

// ── Request Tracer ───────────────────────────────────────────────────────

let traceCounter = 0

/** Generate a unique trace ID for a request. */
export function generateTraceId(): string {
  const ts = Date.now().toString(36)
  traceCounter++
  const seq = traceCounter.toString(36).padStart(4, '0')
  return `trc-${ts}-${seq}${Math.random().toString(36).substring(2, 6)}`
}

export interface RequestTrace {
  traceId: string
  method: string
  path: string
  startTime: number
  endTime?: number
  statusCode?: number
  durationMs?: number
}

/**
 * Tracks a single request lifecycle. Creates at request start, completes
 * at response end to log method + path + duration + status.
 */
export class RequestTracer {
  public trace: RequestTrace

  constructor(method: string, path: string) {
    this.trace = {
      traceId: generateTraceId(),
      method,
      path,
      startTime: Date.now(),
    }
  }

  /** Complete the trace with response status. Logs the result. */
  complete(statusCode: number): void {
    this.trace.endTime = Date.now()
    this.trace.statusCode = statusCode
    this.trace.durationMs = this.trace.endTime - this.trace.startTime

    const level: LogLevel = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info'

    logStructured({
      level,
      message: `${this.trace.method} ${this.trace.path}`,
      traceId: this.trace.traceId,
      durationMs: this.trace.durationMs,
      statusCode,
      method: this.trace.method,
      path: this.trace.path,
    })
  }

  traceId(): string {
    return this.trace.traceId
  }

  /** Attach trace ID to request headers (server-side). */
  static fromRequest(headers: Headers, method: string, path: string): RequestTracer {
    const existing = headers.get('x-trace-id')
    const tracer = new RequestTracer(method, path)
    if (existing) {
      tracer.trace.traceId = existing
    }
    return tracer
  }
}

// ── Error Aggregator ─────────────────────────────────────────────────────

interface GroupedError {
  message: string
  stack?: string
  count: number
  lastSeen: Date
  firstSeen: Date
}

/**
 * Collects errors, deduplicates by message, tracks frequency.
 * Use in production to surface recurring issues without alert fatigue.
 */
export class ErrorAggregator {
  private maxGroups: number
  private groups = new Map<string, GroupedError>()
  private recents: Array<{ message: string; stack?: string; at: Date; traceId?: string }> = []
  private maxRecents: number

  constructor(options?: { maxGroups?: number; maxRecents?: number }) {
    this.maxGroups = options?.maxGroups ?? 100
    this.maxRecents = options?.maxRecents ?? 50
  }

  /** Report an error. Deduplicates by message text. */
  report(error: unknown, traceId?: string): void {
    const message = error instanceof Error
      ? error.message
      : error instanceof Object
        ? JSON.stringify(error)
        : String(error)

    const stack = error instanceof Error ? error.stack : undefined

    // Update grouped counter
    const existing = this.groups.get(message)
    if (existing) {
      existing.count++
      existing.lastSeen = new Date()
    } else {
      if (this.groups.size >= this.maxGroups) {
        // Evict least frequent
        let minKey = ''
        let minCount = Infinity
        this.groups.forEach((val, key) => {
          if (val.count < minCount) {
            minCount = val.count
            minKey = key
          }
        })
        this.groups.delete(minKey)
      }
      this.groups.set(message, {
        message,
        stack,
        count: 1,
        firstSeen: new Date(),
        lastSeen: new Date(),
      })
    }

    // Update recent list
    this.recents.push({ message, stack, at: new Date(), traceId })
    if (this.recents.length > this.maxRecents) {
      this.recents.shift()
    }
  }

  /** Top N errors by frequency across all time. */
  getTopErrors(limit = 10): GroupedError[] {
    return Array.from(this.groups.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, limit)
  }

  /** N most recent errors. */
  getRecentErrors(limit = 10): Array<{ message: string; stack?: string; at: Date; traceId?: string }> {
    return this.recents.slice(-limit).reverse()
  }

  /** Total unique error groups tracked. */
  groupCount(): number {
    return this.groups.size
  }

  /** Total errors reported (raw count, not deduplicated). */
  totalCount(): number {
    let total = 0
    this.groups.forEach((g) => { total += g.count })
    return total
  }

  /** Clear all tracked errors. */
  clear(): void {
    this.groups.clear()
    this.recents = []
  }
}

// Singleton for server-side usage
export const errorAggregator = new ErrorAggregator()

// ── Performance Timer ────────────────────────────────────────────────────

export interface TimerResult {
  operation: string
  durationMs: number
  slow: boolean
}

export interface PerformanceTimerOptions {
  /** Threshold in ms to consider an operation "slow" (default: 100) */
  slowThreshold?: number
  /** Log level for slow operations (default: "warn") */
  slowLogLevel?: LogLevel
  /** Log level for fast operations (default: "debug") */
  fastLogLevel?: LogLevel
}

/**
 * Measures operation duration and automatically logs the result.
 * Usage:
 *   const timer = PerformanceTimer.start('db-query')
 *   // ... do work
 *   timer.end()
 */
export class PerformanceTimer {
  private operation: string
  private startTime: number
  private options: Required<PerformanceTimerOptions>

  constructor(operation: string, options?: PerformanceTimerOptions) {
    this.operation = operation
    this.startTime = Date.now()
    this.options = {
      slowThreshold: options?.slowThreshold ?? 100,
      slowLogLevel: options?.slowLogLevel ?? 'warn',
      fastLogLevel: options?.fastLogLevel ?? 'debug',
    }
  }

  /** Factory: create and start a timer. */
  static start(operation: string, options?: PerformanceTimerOptions): PerformanceTimer {
    return new PerformanceTimer(operation, options)
  }

  /** Stop the timer and log the result. Returns timing info. */
  end(metadata?: Record<string, unknown>): TimerResult {
    const durationMs = Date.now() - this.startTime
    const slow = durationMs > this.options.slowThreshold
    const level = slow ? this.options.slowLogLevel : this.options.fastLogLevel

    logStructured({
      level,
      message: slow ? `⚠️ SLOW: ${this.operation} took ${durationMs}ms` : `${this.operation} completed`,
      durationMs,
      ...(metadata ?? {}),
    })

    return { operation: this.operation, durationMs, slow }
  }

  /** Get elapsed time without ending the timer. */
  elapsed(): number {
    return Date.now() - this.startTime
  }
}

/**
 * Convenience: wrap an async function with timing.
 *   const result = await time('fetch-users', () => db.query(...))
 */
export async function timed<T>(operation: string, fn: () => Promise<T>, options?: PerformanceTimerOptions): Promise<T> {
  const timer = PerformanceTimer.start(operation, options)
  try {
    return await fn()
  } finally {
    timer.end()
  }
}
