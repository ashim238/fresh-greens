import { useCallback, useEffect, useState } from 'react';

import {
  addRecording as addRecordingToStore,
  getRecordings,
  removeRecording as removeRecordingFromStore,
  type ArmedAnswer,
  type Recording,
} from '../lib/api/recordings';

/**
 * Reactive wrapper around the recordings adapter. Loads stored
 * recordings on mount, exposes add/remove helpers that update local
 * state alongside AsyncStorage so the UI re-renders without needing
 * a manual refetch.
 *
 * Usage:
 *   const { recordings, loading, addRecording, removeRecording } =
 *     useRecordings();
 *
 * Same architectural pattern as useUser / useTrustedContact /
 * usePreferences. Local-state-only for now (each consumer reads its
 * own snapshot); when /recordings and /pulled-over need to share live
 * state, this becomes a context provider.
 */
export function useRecordings() {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(true);
  // R2 (PR K): surface a load failure so /recordings can render an
  // ErrorState instead of hanging on a blank screen forever. Without
  // the catch, a throwing getRecordings() (corrupt store, quota,
  // cold-simulator wipe) left `loading` pinned true and the UI empty
  // with no recovery path. Additive to the return shape — existing
  // consumers (safety-settings, pulled-over) don't destructure it.
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stored = await getRecordings();
        if (!cancelled) {
          setRecordings(stored);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error(String(err)));
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const addRecording = useCallback(
    async (input: {
      sourceUri: string;
      durationMs: number;
      armed: ArmedAnswer | null;
      createdAt?: number;
    }): Promise<Recording> => {
      const recording = await addRecordingToStore(input);
      // Newest-first ordering — match what getRecordings returns.
      setRecordings((prev) => [recording, ...prev]);
      return recording;
    },
    [],
  );

  const removeRecording = useCallback(async (id: string) => {
    await removeRecordingFromStore(id);
    setRecordings((prev) => prev.filter((r) => r.id !== id));
  }, []);

  return { recordings, loading, error, addRecording, removeRecording };
}
