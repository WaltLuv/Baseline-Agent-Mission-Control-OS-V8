/**
 * Idempotency key tracking — prevents duplicate execution of the same operation.
 * In-memory, bounded to 10_000 keys with LRU eviction.
 */

// ─────────────────────────────────────────────
// LRU Map
// ─────────────────────────────────────────────

const DEFAULT_MAX_KEYS = 10_000

interface CacheEntry<V> {
  key: string
  value: V
}

/**
 * A simple LRU-bounded Map that evicts the least-recently-used key
 * when capacity exceeds `maxSize`.
 */
class LimitedLRUMap<V> {
  private _map = new Map<string, CacheEntry<V>>()
  private readonly maxSize: number

  constructor(maxSize: number) {
    this.maxSize = maxSize
  }

  get size(): number {
    return this._map.size
  }

  has(key: string): boolean {
    return this._map.has(key)
  }

  get(key: string): V | undefined {
    const entry = this._map.get(key)
    if (!entry) return undefined
    // Access bump — re-insert to mark as most recently used
    this._map.delete(key)
    this._map.set(key, entry)
    return entry.value
  }

  set(key: string, value: V): void {
    // If already present, remove first so re-insert bumps recency
    if (this._map.has(key)) {
      this._map.delete(key)
    }

    // Evict if at capacity
    if (this._map.size >= this.maxSize) {
      const oldest = this._map.keys().next()
      if (!oldest.done) {
        this._map.delete(oldest.value)
      }
    }

    this._map.set(key, { key, value })
  }

  clear(): void {
    this._map.clear()
  }
}

// ─────────────────────────────────────────────
// IdempotencyKey
// ─────────────────────────────────────────────

export interface IdempotencyResult<T = unknown> {
  key: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  result?: T
  error?: unknown
  createdAt: number
  updatedAt: number
}

export type IdempotencyStatus = IdempotencyResult['status']

/**
 * In-memory idempotency key store backed by an LRU-bounded Map.
 */
export class IdempotencyKey {
  private _store = new LimitedLRUMap<IdempotencyResult>(DEFAULT_MAX_KEYS)

  get size(): number {
    return this._store.size
  }

  /**
   * Returns the cached result for a key if one exists and has completed.
   * Returns null if the key is not tracked.
   */
  getIdempotencyResult(key: string): IdempotencyResult | null {
    return this._store.get(key) ?? null
  }

  /**
   * Mark a key as currently being processed (prevents concurrent execution).
   * Returns true if the key was newly registered, false if already processing/completed.
   */
  tryStartProcessing(key: string): boolean {
    const existing = this._store.get(key)
    if (existing) {
      return false
    }
    this._store.set(key, {
      key,
      status: 'processing',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
    return true
  }

  /** Mark a key's execution as completed with a result. */
  markComplete<T>(key: string, result: T): void {
    this._store.set(key, {
      key,
      status: 'completed',
      result,
      createdAt: this._store.get(key)?.createdAt ?? Date.now(),
      updatedAt: Date.now(),
    })
  }

  /** Mark a key's execution as failed. */
  markFailed(key: string, error: unknown): void {
    const existing = this._store.get(key)
    this._store.set(key, {
      key,
      status: 'failed',
      result: existing?.result,
      error,
      createdAt: existing?.createdAt ?? Date.now(),
      updatedAt: Date.now(),
    })
  }

  /** Remove a key from the store (e.g. for cleanup or retry scenarios). */
  remove(key: string): void {
    // LimitedLRUMap doesn't expose delete; we clear and rebuild without the key.
    // For simplicity we'll iterate and filter. A better approach would be to
    // add delete() to LimitedLRUMap, but this avoids modifying that class.
    const entries = Array.from(this._store['_map'].entries())
    this._store.clear()
    for (const [, entry] of entries) {
      if (entry.key !== key) {
        this._store.set(entry.key, entry.value)
      }
    }
  }

  /** Clear all keys. */
  reset(): void {
    this._store.clear()
  }
}

// ─────────────────────────────────────────────
// Global singleton
// ─────────────────────────────────────────────

const _globalIdempotency = new IdempotencyKey()

/**
 * Get the shared idempotency key store (singleton).
 */
export function getIdempotencyStore(): IdempotencyKey {
  return _globalIdempotency
}

// ─────────────────────────────────────────────
// Convenience wrappers
// ─────────────────────────────────────────────

/**
 * Get the cached idempotency result for a key, or null if not found.
 * Convenience function that delegates to the global store.
 */
export function getIdempotencyResult(key: string): IdempotencyResult | null {
  return _globalIdempotency.getIdempotencyResult(key)
}

/**
 * Wraps a handler function with idempotency protection.
 * If the key has already been processed (completed/failed), returns the cached result.
 * Otherwise, executes the handler exactly once and caches the outcome.
 *
 * If another call is currently processing the same key, this throws.
 */
export async function withIdempotency<T>(
  key: string,
  handler: () => Promise<T>
): Promise<{ result: T; idempotent: boolean }> {
  // Check if already completed
  const existing = getIdempotencyResult(key)

  if (existing?.status === 'completed') {
    return { result: existing.result as T, idempotent: true }
  }

  if (existing?.status === 'failed') {
    // Re-throw the cached error
    throw existing.error ?? new Error('Previous execution failed')
  }

  if (existing?.status === 'processing') {
    throw new Error(
      `Idempotency key "${key}" is already being processed by another request`
    )
  }

  // Try to acquire the key for processing
  const acquired = _globalIdempotency.tryStartProcessing(key)
  if (!acquired) {
    throw new Error(
      `Idempotency key "${key}" is already registered (concurrent request)`
    )
  }

  try {
    const result = await handler()
    _globalIdempotency.markComplete(key, result)
    return { result, idempotent: false }
  } catch (error) {
    _globalIdempotency.markFailed(key, error)
    throw error
  }
}
