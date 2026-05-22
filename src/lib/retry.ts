/**
 * Retry, timeout, and circuit breaker utilities for reliability engineering.
 * Pure logic — no database or external dependencies.
 */

// ─────────────────────────────────────────────
// Exponential backoff with jitter
// ─────────────────────────────────────────────

export interface RetryOptions {
  /** Maximum number of attempts (default: 3) */
  maxAttempts?: number
  /** Base delay in milliseconds (default: 100) */
  baseDelayMs?: number
  /** Maximum delay cap in milliseconds (default: 30_000) */
  maxDelayMs?: number
  /** Optional callback invoked before each retry attempt */
  onRetry?: (attempt: number, error: unknown) => void | Promise<void>
  /** Optional predicate to decide if an error is retryable (default: always true) */
  isRetryable?: (error: unknown) => boolean
}

/**
 * Execute a function with exponential backoff and full jitter.
 * Retries on failure up to `maxAttempts` total calls.
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    baseDelayMs = 100,
    maxDelayMs = 30_000,
    onRetry,
    isRetryable = () => true,
  } = options

  let lastError: unknown

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error

      if (!isRetryable(error)) {
        throw error
      }

      if (attempt < maxAttempts - 1) {
        if (onRetry) {
          await onRetry(attempt + 1, error)
        }
        const delay = exponentialBackoffWithJitter(attempt, baseDelayMs, maxDelayMs)
        await sleep(delay)
      }
    }
  }

  throw lastError
}

/**
 * Exponential backoff with full jitter:
 *   delay = random(0, min(baseDelayMs * 2^attempt, maxDelayMs))
 */
function exponentialBackoffWithJitter(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number
): number {
  const exponential = baseDelayMs * 2 ** attempt
  const capped = Math.min(exponential, maxDelayMs)
  return Math.floor(Math.random() * capped)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ─────────────────────────────────────────────
// Timeout wrapper
// ─────────────────────────────────────────────

export interface TimeoutError extends Error {
  name: 'TimeoutError'
  timeoutMs: number
}

/**
 * Create a TimeoutError instance.
 */
export function createTimeoutError(timeoutMs: number): TimeoutError {
  const err = new Error(`Operation timed out after ${timeoutMs}ms`) as TimeoutError
  err.name = 'TimeoutError'
  err.timeoutMs = timeoutMs
  return err
}

/**
 * Wraps a promise with a timeout. Rejects with TimeoutError if the
 * operation does not complete within `timeoutMs`.
 *
 * If the operation accepts an AbortSignal, a fresh AbortController is
 * created and its signal is passed to the operation via the options object.
 */
export async function withTimeout<T>(
  promiseOrFactory: (() => Promise<T>) | Promise<T>,
  timeoutMs: number
): Promise<T> {
  // If the caller passes a factory function, create an AbortController so
  // the operation can be cancelled on timeout.
  if (typeof promiseOrFactory === 'function') {
    const controller = new AbortController()
    const factory = promiseOrFactory as (options: { signal: AbortSignal }) => Promise<T>

    const timeout = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const result = await Promise.race([
        factory({ signal: controller.signal }),
        new Promise<never>((_, reject) => {
          controller.signal.addEventListener('abort', () => {
            reject(createTimeoutError(timeoutMs))
          })
        }),
      ])
      return result
    } finally {
      clearTimeout(timeout)
    }
  }

  // Plain promise path — no AbortController.
  return Promise.race([
    promiseOrFactory,
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(createTimeoutError(timeoutMs)), timeoutMs)
    }),
  ])
}

// ─────────────────────────────────────────────
// Circuit breaker
// ─────────────────────────────────────────────

export type CircuitState = 'closed' | 'open' | 'half-open'

export interface CircuitBreakerOptions {
  /** Number of consecutive failures before opening the circuit (default: 5) */
  failureThreshold?: number
  /** Milliseconds to wait before transitioning from open → half-open (default: 30_000) */
  resetTimeoutMs?: number
  /** Number of successful calls in half-open state to close circuit (default: 1) */
  successThreshold?: number
}

export interface CircuitBreakerStats {
  state: CircuitState
  failureCount: number
  successCount: number
  lastFailureAt: number | null
  lastStateChangeAt: number
  consecutiveSuccesses: number
}

export class CircuitBreakerError extends Error {
  override name = 'CircuitBreakerError'
  constructor(
    message: string,
    public readonly state: CircuitState
  ) {
    super(message)
  }
}

/**
 * A circuit breaker that wraps an async function.
 *
 * States:
 *   - closed:   normal operation, failures are counted
 *   - open:     calls fail immediately; after resetTimeoutMs → half-open
 *   - half-open: allows a limited number of trial calls; on success → closed
 */
export class CircuitBreaker {
  private _state: CircuitState = 'closed'
  private _failureCount = 0
  private _consecutiveSuccesses = 0
  private _lastFailureAt: number | null = null
  private _lastStateChangeAt = Date.now()

  private readonly failureThreshold: number
  private readonly resetTimeoutMs: number
  private readonly successThreshold: number

  constructor(options: CircuitBreakerOptions = {}) {
    this.failureThreshold = options.failureThreshold ?? 5
    this.resetTimeoutMs = options.resetTimeoutMs ?? 30_000
    this.successThreshold = options.successThreshold ?? 1
  }

  get stats(): CircuitBreakerStats {
    this._maybeTransitionToHalfOpen()
    return {
      state: this._state,
      failureCount: this._failureCount,
      successCount: this._consecutiveSuccesses,
      lastFailureAt: this._lastFailureAt,
      lastStateChangeAt: this._lastStateChangeAt,
      consecutiveSuccesses: this._consecutiveSuccesses,
    }
  }

  /**
   * Execute the given function through the circuit breaker.
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this._maybeTransitionToHalfOpen()

    if (this._state === 'open') {
      throw new CircuitBreakerError(
        'Circuit breaker is open — calls are blocked',
        this._state
      )
    }

    try {
      const result = await fn()
      this._onSuccess()
      return result
    } catch (error) {
      this._onFailure()
      throw error
    }
  }

  /** Resets the circuit breaker to closed state. */
  reset(): void {
    this._state = 'closed'
    this._failureCount = 0
    this._consecutiveSuccesses = 0
    this._lastStateChangeAt = Date.now()
  }

  private _maybeTransitionToHalfOpen(): void {
    if (
      this._state === 'open' &&
      Date.now() - this._lastStateChangeAt >= this.resetTimeoutMs
    ) {
      this._state = 'half-open'
      this._consecutiveSuccesses = 0
      this._lastStateChangeAt = Date.now()
    }
  }

  private _onSuccess(): void {
    if (this._state === 'half-open') {
      this._consecutiveSuccesses++
      if (this._consecutiveSuccesses >= this.successThreshold) {
        this._state = 'closed'
        this._failureCount = 0
        this._consecutiveSuccesses = 0
        this._lastStateChangeAt = Date.now()
      }
    } else {
      this._failureCount = 0
    }
  }

  private _onFailure(): void {
    this._failureCount++
    this._lastFailureAt = Date.now()

    if (this._state === 'half-open') {
      // Any failure in half-open reopens the circuit
      this._state = 'open'
      this._consecutiveSuccesses = 0
      this._lastStateChangeAt = Date.now()
    } else if (this._failureCount >= this.failureThreshold) {
      this._state = 'open'
      this._lastStateChangeAt = Date.now()
    }
  }
}
