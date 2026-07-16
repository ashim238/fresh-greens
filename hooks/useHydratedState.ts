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
 * Discriminated-union loading primitive — the blessed way to read an
 * async-hydrated value in this app.
 *
 * Separates two axes that screens used to collapse into one nullable
 * value (the cause of the cold-launch "empty state flash"):
 *   - hydration: has the read settled?  → the `ready` flag
 *   - content:   once settled, is there anything there?  → the data's
 *                own nullability/emptiness
 *
 * `ready: true` does NOT mean "data exists" — it means "the read has
 * settled." A loaded-but-empty result is `ready: true` with empty data.
 *
 * The union shape is deliberately breaking: a consumer cannot reach
 * `.data` without first narrowing on `ready`, so the flash bug is a
 * compile error rather than a convention. `setData` is intersected
 * OUTSIDE the union so a composing hook can build write methods at the
 * top level (and so write-only consumers compile unchanged).
 *
 * `read` MUST be a stable reference (a module-level adapter function, or
 * a useCallback'd closure) — it is an effect dependency.
 */
export type Hydrated<T> =
  | { ready: false }
  | { ready: true; data: T };

export function useHydratedState<T>(
  read: () => Promise<T>,
  options?: { mountOnly?: boolean },
): Hydrated<T> & { setData: Dispatch<SetStateAction<T>> } {
  const mountOnly = options?.mountOnly ?? false;
  const generation = useSessionGeneration();
  const generationRef = useRef(generation);
  generationRef.current = generation;
  const [data, setData] = useState<T | undefined>(undefined);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setData(undefined);
    setReady(false);
  }, [generation]);

  // Shared read body. `ready` latches false→true once and never returns
  // to false on refocus — re-reading must update `data` silently without
  // re-showing the loading branch (which would re-flash the UI).
  const runRead = useCallback(() => {
    let cancelled = false;
    const readGeneration = generation;
    void (async () => {
      const result = await read();
      if (!cancelled && generationRef.current === readGeneration) {
        // setData + setReady are batched into one render (React 18+
        // automatic batching inside async callbacks), so a consumer never
        // observes ready:true with data still undefined — which is what
        // makes the `data as T` cast on the ready branch sound.
        setData(result);
        setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [generation, read]);

  // Both hooks are always called (rules-of-hooks); the unused one no-ops
  // via an early return inside its body, not around the call.
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
  return { ready: true, data: data as T, setData: stableSetData };
}
