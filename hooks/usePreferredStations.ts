import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import {
  addPreferredStation as addToStore,
  clearPreferredStations as clearFromStore,
  getPreferredStations,
  PREFERRED_MATCH_DELTA,
  removePreferredStation as removeFromStore,
  type PreferredStation,
} from '../lib/api/preferred-stations';

/**
 * Reactive wrapper around the preferred-stations adapter. Re-reads on
 * focus (like usePreferences) so a star set in the fuel sheet shows in
 * /fuel's list and vice-versa. isPreferred is computed synchronously
 * against `stations` so the star renders without an async round-trip.
 */
export function usePreferredStations() {
  const [stations, setStations] = useState<PreferredStation[]>([]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const stored = await getPreferredStations();
        if (!cancelled) setStations(stored);
      })();
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const isPreferred = useCallback(
    (place: { latitude: number; longitude: number }): boolean =>
      stations.some(
        (s) =>
          Math.abs(s.latitude - place.latitude) < PREFERRED_MATCH_DELTA &&
          Math.abs(s.longitude - place.longitude) < PREFERRED_MATCH_DELTA,
      ),
    [stations],
  );

  const add = useCallback(
    async (input: {
      name: string;
      brand?: string;
      latitude: number;
      longitude: number;
    }) => {
      const station = await addToStore(input);
      setStations((prev) =>
        prev.some((s) => s.id === station.id) ? prev : [...prev, station],
      );
      return station;
    },
    [],
  );

  const remove = useCallback(async (id: string) => {
    await removeFromStore(id);
    setStations((prev) => prev.filter((s) => s.id !== id));
  }, []);

  /**
   * Removes the preferred station nearest `place` (within
   * PREFERRED_MATCH_DELTA), if any. Lets callers untrust a station they
   * only have coordinates for (a search result / on-route stop) without
   * re-deriving the proximity match themselves — keeps the delta in one
   * place and collapses the duplicated toggle handlers.
   */
  const removeNear = useCallback(
    async (place: { latitude: number; longitude: number }) => {
      const match = stations.find(
        (s) =>
          Math.abs(s.latitude - place.latitude) < PREFERRED_MATCH_DELTA &&
          Math.abs(s.longitude - place.longitude) < PREFERRED_MATCH_DELTA,
      );
      if (match) await remove(match.id);
    },
    [stations, remove],
  );

  const clearAll = useCallback(async () => {
    await clearFromStore();
    setStations([]);
  }, []);

  return { stations, isPreferred, add, remove, removeNear, clearAll };
}
