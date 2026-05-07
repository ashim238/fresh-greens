import { useCallback, useEffect, useState } from 'react';

import {
  addSavedPlace as addSavedPlaceToStore,
  clearSavedPlaces as clearSavedPlacesFromStore,
  getSavedPlaces,
  removeSavedPlace as removeSavedPlaceFromStore,
  type SavedPlace,
  type SavedPlaceKind,
} from '../lib/api/saved-places';

/**
 * Reactive wrapper around the saved-places adapter. Same shape as
 * useUser / useTrustedContact / useRecordings — load on mount, expose
 * add/remove helpers that update local state alongside AsyncStorage so
 * the UI re-renders without a manual refetch.
 */
export function useSavedPlaces() {
  const [savedPlaces, setSavedPlaces] = useState<SavedPlace[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = await getSavedPlaces();
      if (!cancelled) {
        setSavedPlaces(stored);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const addSavedPlace = useCallback(
    async (input: {
      kind: SavedPlaceKind;
      name: string;
      latitude: number;
      longitude: number;
    }): Promise<SavedPlace> => {
      const place = await addSavedPlaceToStore(input);
      // Mirror the adapter's one-home-at-a-time invariant in local
      // state: if the new place is a home, drop any prior home before
      // appending.
      setSavedPlaces((prev) => {
        const filtered =
          input.kind === 'home' ? prev.filter((p) => p.kind !== 'home') : prev;
        return [...filtered, place];
      });
      return place;
    },
    [],
  );

  const removeSavedPlace = useCallback(async (id: string) => {
    await removeSavedPlaceFromStore(id);
    setSavedPlaces((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const clearAll = useCallback(async () => {
    await clearSavedPlacesFromStore();
    setSavedPlaces([]);
  }, []);

  const home = savedPlaces.find((p) => p.kind === 'home') ?? null;

  return { savedPlaces, home, loading, addSavedPlace, removeSavedPlace, clearAll };
}
