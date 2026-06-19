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

type SavedPlacesWrites = {
  addSavedPlace: (input: {
    kind: SavedPlaceKind;
    name: string;
    latitude: number;
    longitude: number;
  }) => Promise<SavedPlace>;
  removeSavedPlace: (id: string) => Promise<void>;
  clearAll: () => Promise<void>;
};

export type SavedPlacesState = SavedPlacesWrites &
  (
    | { ready: false }
    | { ready: true; savedPlaces: SavedPlace[]; home: SavedPlace | null }
  );

/**
 * Reactive wrapper around the saved-places adapter. Mount-only read
 * (saved places don't change behind this screen's back the way a
 * contact set in a pushed-over flow does). Loading is owned by
 * useHydratedState; write methods mirror the adapter into local state.
 */
export function useSavedPlaces(): SavedPlacesState {
  const hydrated = useHydratedState<SavedPlace[]>(getSavedPlaces, {
    mountOnly: true,
  });

  const addSavedPlace = useCallback<SavedPlacesWrites['addSavedPlace']>(
    async (input) => {
      const place = await addSavedPlaceToStore(input);
      // Mirror the adapter's one-home-at-a-time invariant in local state.
      hydrated.setData((prev) => {
        const base = prev ?? [];
        const filtered =
          input.kind === 'home' ? base.filter((p) => p.kind !== 'home') : base;
        return [...filtered, place];
      });
      return place;
    },
    [hydrated.setData],
  );

  const removeSavedPlace = useCallback(async (id: string) => {
    await removeSavedPlaceFromStore(id);
    hydrated.setData((prev) => (prev ?? []).filter((p) => p.id !== id));
  }, [hydrated.setData]);

  const clearAll = useCallback(async () => {
    await clearSavedPlacesFromStore();
    hydrated.setData([]);
  }, [hydrated.setData]);

  if (!hydrated.ready) {
    return { ready: false, addSavedPlace, removeSavedPlace, clearAll };
  }
  const savedPlaces = hydrated.data;
  const home = savedPlaces.find((p) => p.kind === 'home') ?? null;
  return { ready: true, savedPlaces, home, addSavedPlace, removeSavedPlace, clearAll };
}
