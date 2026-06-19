import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Discriminated-result async-write primitive — the blessed way to
 * persist data in this app.
 *
 * Separates three axes today's writes collapse into one tangle:
 *   - persist:    the async write itself (slow, may fail)
 *   - optimistic: the UI echo that fires immediately + its rollback
 *                 (do-and-undo declared in the SAME function — they
 *                 can't drift apart)
 *   - outcome:    `run` returns a discriminated MutationResult the
 *                 caller MUST narrow before reading `.data`
 *
 * The result shape is deliberately breaking: a consumer cannot reach
 * `.data` without first checking `.ok`, so silent-fail (catching with
 * console.warn and pretending success) becomes a compile error rather
 * than a convention.
 *
 * `persist` AND `onOptimistic` MUST be stable references — module-level
 * functions or useCallback'd closures. Both are render-time effect deps
 * on `run`.
 */
export type MutationResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: Error };

export type MutationStatus = 'idle' | 'pending' | 'success' | 'error';

export type Mutation<I, T> = {
  run: (input: I) => Promise<MutationResult<T>>;
  status: MutationStatus;
  error: Error | null;
  reset: () => void;
};

export function useMutation<I, T>(
  persist: (input: I) => Promise<T>,
  options?: {
    /**
     * Apply the optimistic UI echo immediately; return a rollback fn
     * that fires if `persist` throws. Matches useEffect cleanup shape:
     * "what I did" and "how to undo it" in one function. Return void
     * if no rollback is needed.
     */
    onOptimistic?: (input: I) => (() => void) | void;
  },
): Mutation<I, T> {
  const [status, setStatus] = useState<MutationStatus>('idle');
  const [error, setError] = useState<Error | null>(null);

  // In-flight version counter: concurrent run() calls cancel the
  // previous attempt's state-flips. A stale resolution can't overwrite
  // a newer one's status, and the prior optimistic apply's rollback
  // does NOT fire (the newer call's optimistic IS the current truth).
  const versionRef = useRef(0);

  // Unmount guard: state setters no-op after unmount. No
  // "setState on unmounted component" warning.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const onOptimistic = options?.onOptimistic;

  const run = useCallback(
    async (input: I): Promise<MutationResult<T>> => {
      const myVersion = ++versionRef.current;
      let rollback: (() => void) | void = undefined;
      if (mountedRef.current) {
        setStatus('pending');
        // Apply the optimistic echo synchronously, capture the rollback.
        rollback = onOptimistic?.(input);
      }

      try {
        const data = await persist(input);

        // Cancelled by a newer run() — discard the result silently.
        // The newer call's optimistic is the current UI truth.
        if (versionRef.current !== myVersion) {
          return { ok: true, data };
        }
        if (mountedRef.current) {
          setStatus('success');
          setError(null);
        }
        return { ok: true, data };
      } catch (raw) {
        // Cancelled — newer call's optimistic is the truth; don't
        // rollback this one (would clobber it).
        if (versionRef.current !== myVersion) {
          const err =
            raw instanceof Error ? raw : new Error(String(raw));
          return { ok: false, error: err };
        }
        // Fire the rollback before flipping status — UI snaps back
        // and only then sees the error state.
        rollback?.();
        const err =
          raw instanceof Error ? raw : new Error(String(raw));
        if (mountedRef.current) {
          setStatus('error');
          setError(err);
        }
        return { ok: false, error: err };
      }
    },
    [persist, onOptimistic],
  );

  const reset = useCallback(() => {
    if (mountedRef.current) {
      setStatus('idle');
      setError(null);
    }
  }, []);

  return { run, status, error, reset };
}
