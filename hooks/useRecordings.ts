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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = await getRecordings();
      if (!cancelled) {
        setRecordings(stored);
        setLoading(false);
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

  return { recordings, loading, addRecording, removeRecording };
}
