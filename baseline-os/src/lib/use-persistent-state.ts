/**
 * usePersistentString — durable string state that reads storage FIRST and never
 * clobbers a saved value with an empty default on mount/SSR. Built on the
 * state-integrity layer (write → verify → audit).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { broadcastStorage, durableGet, durableSet, type DurableSetResult } from "./state-integrity";

export interface PersistentStringApi {
  value: string | null;
  /** Set + durably persist (verified). Pass allowEmpty to permit an explicit clear. */
  set: (next: string | null, opts?: { allowEmpty?: boolean }) => DurableSetResult | undefined;
  /** True once the client has hydrated from storage (writes are gated until then). */
  hydrated: boolean;
  /** Timestamp of the last verified write, or null. */
  lastSaved: number | null;
}

export function usePersistentString(
  key: string,
  fallback: string | null = null,
): PersistentStringApi {
  // Lazy init: on the client, read storage synchronously so first paint is correct.
  const [value, setValue] = useState<string | null>(() => {
    const stored = durableGet(key);
    return stored != null ? stored : fallback;
  });
  const [lastSaved, setLastSaved] = useState<number | null>(null);
  const hydratedRef = useRef(false);

  // Re-read on mount (covers SSR where the lazy init ran without window) and
  // subscribe to cross-tab / same-tab updates. NEVER writes here.
  useEffect(() => {
    const stored = durableGet(key);
    if (stored != null) setValue(stored);
    hydratedRef.current = true;
    const onStorage = (e: StorageEvent) => {
      if (e.key === key || e.key === null) {
        const v = durableGet(key);
        setValue(v != null ? v : fallback);
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const set = useCallback(
    (next: string | null, opts?: { allowEmpty?: boolean }) => {
      setValue(next);
      // Only persist after hydration so the initial render never clobbers storage.
      if (!hydratedRef.current && next == null) return;
      const res = durableSet(key, next ?? "", { allowEmpty: opts?.allowEmpty });
      if (res.ok) {
        setLastSaved(Date.now());
        broadcastStorage(key, next && next !== "" ? next : null);
      }
      return res;
    },
    [key],
  );

  return { value, set, hydrated: hydratedRef.current, lastSaved };
}
