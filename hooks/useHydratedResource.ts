import {
  useCallback,
  useEffect,
  useState,
  type Dispatch,
  type SetStateAction,
  useRef,
} from 'react';
import { useFocusEffect } from 'expo-router';
import { useSessionGeneration } from '../lib/account-session/session-context';

/**
 * Discriminated-result async-read primitive — sibling to useHydratedState
 * for reads that can MEANINGFULLY THROW. Three-state union:
 *
 *   { ready: false }                              // still loading
 *   { ready: true; ok: false; error: Error }      // loaded, but failed
 *   { ready: true; ok: true; data: T }            // loaded fine
 *
 * Use this for hooks whose reader can throw (storage corrupt, quota
 * exceeded, network-backed in the future). Use useHydratedState for
 * reads that always return a default (preferences, savedPlaces, etc.).
 *
 * Like useHydratedState:
 * - setData intersected outside the union (always callable, on every
 *   branch, so a composing mutation hook can do optimistic updates
 *   regardless of whether the read itself has settled or errored).
 * - Refocus-aware by default; { mountOnly: true } opt-out.
 * - `ready` latches false → true once. Once hydration settles it never
 *   re-enters the loading branch on refocus.
 *
 * Different from useHydratedState:
 * - `ok` can flip true ↔ false on refocus. A retry might succeed where
 *   the first read failed, or vice versa. The error branch is not sticky.
 *
 * `read` MUST be a stable reference (module-level adapter function or a
 * useCallback'd closure). It's an effect dependency.
 */
export type HydratedResource<T> =
  | { ready: false }
  | { ready: true; ok: false; error: Error }
  | { ready: true; ok: true; data: T };

export function useHydratedResource<T>(
  read: () => Promise<T>,
  options?: { mountOnly?: boolean },
): HydratedResource<T> & { setData: Dispatch<SetStateAction<T>> } {
  const mountOnly = options?.mountOnly ?? false;
  const generation = useSessionGeneration();
  const generationRef = useRef(generation);
  generationRef.current = generation;
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<Error | null>(null);
  const [ready, setReady] = useState(false);
  const [ok, setOk] = useState(true); // meaningful only when ready === true

  useEffect(() => {
    setData(undefined);
    setError(null);
    setOk(true);
    setReady(false);
  }, [generation]);

  const runRead = useCallback(() => {
    let cancelled = false;
    const readGeneration = generation;
    void (async () => {
      try {
        const result = await read();
        if (cancelled || generationRef.current !== readGeneration) return;
        // setData + setOk + setReady are batched into one render (React
        // 18+ automatic batching inside async callbacks), so a consumer
        // never observes ready:true with data still undefined.
        setData(result);
        setError(null);
        setOk(true);
        setReady(true);
      } catch (raw) {
        if (cancelled || generationRef.current !== readGeneration) return;
        const err =
          raw instanceof Error ? raw : new Error(String(raw));
        setError(err);
        setOk(false);
        setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [generation, read]);

  // Both effects always called (rules-of-hooks); the unused one no-ops
  // via early return inside its body.
  useEffect(() => {
    if (!mountOnly) return;
    return runRead();
  }, [mountOnly, runRead]);

  useFocusEffect(
    useCallback(() => {
      if (mountOnly) return;
      return runRead();
    }, [mountOnly, runRead]),
  );

  const stableSetData = setData as Dispatch<SetStateAction<T>>;

  if (!ready) {
    return { ready: false, setData: stableSetData };
  }
  if (!ok) {
    return {
      ready: true,
      ok: false,
      error: error as Error,
      setData: stableSetData,
    };
  }
  return {
    ready: true,
    ok: true,
    data: data as T,
    setData: stableSetData,
  };
}
