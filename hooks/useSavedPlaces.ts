import { useCallback } from 'react';

import {
  addSavedPlace as addSavedPlaceToStore,
  clearSavedPlaces as clearSavedPlacesFromStore,
  getSavedPlaces,
  removeSavedPlace as removeSavedPlaceFromStore,
  type SavedPlace,
  type SavedPlaceKind,
} from '../lib/api/saved-places';
import { useHydratedState } from './useHydratedState';
import { type Mutation, type MutationResult, useMutation } from './useMutation';

export type AddSavedPlaceInput = {
  kind: SavedPlaceKind;
  name: string;
  latitude: number;
  longitude: number;
};

type SavedPlacesMutations = {
  add: Mutation<AddSavedPlaceInput, SavedPlace>;
  remove: Mutation<string, void>;
  clear: Mutation<void, void>;
};

export type SavedPlacesState = SavedPlacesMutations &
  (
    | { ready: false }
    | { ready: true; savedPlaces: SavedPlace[]; home: SavedPlace | null }
  );

/**
 * Reactive wrapper around the saved-places adapter. Mount-only read
 * (saved places don't change behind this screen's back the way a
 * contact set in a pushed-over flow does). Writes go through
 * useMutation so the UI echoes optimistically, rolls back on failure,
 * and the caller MUST narrow on result.ok.
 */
export function useSavedPlaces(): SavedPlacesState {
  const hydrated = useHydratedState<SavedPlace[]>(getSavedPlaces, {
    mountOnly: true,
  });

  const addMutation = useMutation(addSavedPlaceToStore);

  const addRun = useCallback(
    async (input: AddSavedPlaceInput): Promise<MutationResult<SavedPlace>> => {
      // Per-call optimistic id — Math.random() suffix eliminates the
      // same-millisecond collision the prior Date.now()-only id had.
      const optimisticId = `__optimistic-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const optimistic: SavedPlace = {
        id: optimisticId,
        kind: input.kind,
        name: input.name,
        latitude: input.latitude,
        longitude: input.longitude,
        setAt: 0,
      };

      // Optimistic apply (mirror adapter's one-home-at-a-time invariant).
      hydrated.setData((prev) => {
        const base = prev ?? [];
        const filtered =
          input.kind === 'home'
            ? base.filter((p) => p.kind !== 'home')
            : base;
        return [...filtered, optimistic];
      });

      const result = await addMutation.run(input);

      if (result.ok) {
        // Reconcile by EXACT id — concurrent calls each only touch their
        // own optimistic, so the version-cancellation race in the wrapper
        // is structurally avoided.
        hydrated.setData((prev) => {
          const base = prev ?? [];
          const idx = base.findIndex((p) => p.id === optimisticId);
          if (idx === -1) return base; // already reconciled or removed
          const next = [...base];
          next[idx] = result.data;
          return next;
        });
      } else {
        // Rollback: remove only our optimistic, leave concurrent ones.
        hydrated.setData((prev) =>
          (prev ?? []).filter((p) => p.id !== optimisticId),
        );
      }
      return result;
    },
    [addMutation.run, hydrated.setData],
  );

  const add: Mutation<AddSavedPlaceInput, SavedPlace> = {
    ...addMutation,
    run: addRun,
  };

  // inline onOptimistic — hydrated.setData is stable; hydrated.data/ready
  // are read at call time (not closed over), so staleness is not a concern.
  const remove = useMutation(removeSavedPlaceFromStore, {
    onOptimistic: (id) => {
      const base = hydrated.ready ? hydrated.data : [];
      const idx = base.findIndex((p) => p.id === id);
      const removed = idx !== -1 ? base[idx] : undefined;
      hydrated.setData((prev) => (prev ?? []).filter((p) => p.id !== id));
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

  // inline onOptimistic — hydrated.setData is stable; hydrated.data/ready
  // are read at call time (not closed over), so staleness is not a concern.
  const clear = useMutation(clearSavedPlacesFromStore, {
    onOptimistic: () => {
      const snapshot = hydrated.ready ? hydrated.data : [];
      hydrated.setData([]);
      return () => {
        hydrated.setData(snapshot);
      };
    },
  });

  if (!hydrated.ready) {
    return { ready: false, add, remove, clear };
  }
  const savedPlaces = hydrated.data;
  const home = savedPlaces.find((p) => p.kind === 'home') ?? null;
  return {
    ready: true,
    savedPlaces,
    home,
    add,
    remove,
    clear,
  };
}
