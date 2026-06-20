import { useCallback, useMemo } from 'react';

import {
  addRecording as addRecordingToStore,
  getRecordings,
  removeRecording as removeRecordingFromStore,
  type ArmedAnswer,
  type Recording,
} from '../lib/api/recordings';
import { useHydratedResource } from './useHydratedResource';
import { type Mutation, type MutationResult, useMutation } from './useMutation';

export type AddRecordingInput = {
  sourceUri: string;
  durationMs: number;
  armed: ArmedAnswer | null;
  createdAt?: number;
};

type RecordingsMutations = {
  add: Mutation<AddRecordingInput, Recording>;
  remove: Mutation<string, void>;
};

export type RecordingsState = RecordingsMutations &
  (
    | { ready: false }
    | { ready: true; ok: false; error: Error }
    | { ready: true; ok: true; recordings: Recording[] }
  );

/**
 * Reactive wrapper around the recordings adapter. Reads through
 * useHydratedResource (3-state — recordings reads can throw on
 * corrupt store / quota / cold-simulator wipe). Writes through
 * useMutation.
 *
 * Per-call exact-id reconciliation for add: each call closes over its
 * own optimistic id so the DATA STORE stays consistent under concurrent
 * runs (distinct ids, independent rollbacks). The STATUS/ERROR UI state
 * is single-slot per useMutation's version counter — a second add.run()
 * while one is pending will cancel the first's status-flip. Same
 * trade-off as PR #2's useSavedPlaces.add.
 */
export function useRecordings(): RecordingsState {
  const hydrated = useHydratedResource<Recording[]>(getRecordings, {
    mountOnly: true,
  });

  // add — per-call exact-id reconciliation. Each call closes over its
  // own unique optimistic id so concurrent calls can't collide; rollback
  // and reconciliation both target the exact id (no version race).
  const addMutation = useMutation(addRecordingToStore);
  const addRun = useCallback(
    async (
      input: AddRecordingInput,
    ): Promise<MutationResult<Recording>> => {
      const optimisticId = `__optimistic-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}`;
      const optimistic: Recording = {
        id: optimisticId,
        uri: input.sourceUri,
        durationMs: input.durationMs,
        armed: input.armed,
        createdAt: input.createdAt ?? Date.now(),
      };
      // Newest-first ordering — match what getRecordings returns.
      hydrated.setData((prev) => [optimistic, ...(prev ?? [])]);
      const result = await addMutation.run(input);
      if (result.ok) {
        hydrated.setData((prev) => {
          const base = prev ?? [];
          const idx = base.findIndex((r) => r.id === optimisticId);
          if (idx === -1) return base;
          const next = [...base];
          next[idx] = result.data;
          return next;
        });
      } else {
        // Rollback — remove only our optimistic entry, leave concurrent
        // ones in place.
        hydrated.setData((prev) =>
          (prev ?? []).filter((r) => r.id !== optimisticId),
        );
      }
      return result;
    },
    [addMutation.run, hydrated.setData],
  );
  const add = useMemo<Mutation<AddRecordingInput, Recording>>(
    () => ({
      run: addRun,
      status: addMutation.status,
      error: addMutation.error,
      reset: addMutation.reset,
    }),
    [addRun, addMutation.status, addMutation.error, addMutation.reset],
  );

  // remove — onOptimistic captures original index for splice-restore on rollback.
  const remove = useMutation(removeRecordingFromStore, {
    onOptimistic: (id) => {
      const base = hydrated.ready && hydrated.ok ? hydrated.data : [];
      const idx = base.findIndex((r) => r.id === id);
      const removed = idx !== -1 ? base[idx] : undefined;
      hydrated.setData((prev) => (prev ?? []).filter((r) => r.id !== id));
      return () => {
        if (removed !== undefined && idx !== -1) {
          hydrated.setData((prev) => {
            const next = [...(prev ?? [])];
            next.splice(idx, 0, removed);
            return next;
          });
        }
      };
    },
  });

  if (!hydrated.ready) {
    return { ready: false, add, remove };
  }
  if (!hydrated.ok) {
    return {
      ready: true,
      ok: false,
      error: hydrated.error,
      add,
      remove,
    };
  }
  return {
    ready: true,
    ok: true,
    recordings: hydrated.data,
    add,
    remove,
  };
}
