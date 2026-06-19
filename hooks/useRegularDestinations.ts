import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import {
  addRegularDestination as addToStore,
  clearRegularDestinations,
  getRegularDestinations,
  removeRegularDestination,
  type RegularDestination,
} from '../lib/api/regular-destinations';

/**
 * Reactive wrapper around the regular-destinations adapter. Loads the
 * list on mount + re-reads on focus; `markRegular` persists + refreshes local state so a
 * consumer re-renders without a manual refetch. `clearAll` wipes the
 * store (sign-out hygiene), mirroring useSavedPlaces' `clearAll`.
 *
 * Same shape as useSavedPlaces / useTrustedContact. Deliberately omits a
 * `ready` discriminant (useSavedPlaces uses a `{ ready } & union`): the only consumer treats
 * "not yet loaded" identically to "no match" — `isRegularDestination`
 * stays false until the load resolves, which is the desired behavior
 * for the recurring-destination underline (no flash of a wrong
 * underline). `isRegularLocation` stays a pure import from the adapter —
 * callers compute membership against `regulars` themselves so the
 * boolean isn't re-derived per render inside the hook.
 */
export function useRegularDestinations() {
  const [regulars, setRegulars] = useState<RegularDestination[]>([]);

  // Re-read on focus, not just mount: trip-summary (a modal over /home)
  // can set a "default destination", so /home is revealed without
  // remounting — a mount-only load would leave the route-card
  // recurring-destination star/underline stale.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const list = await getRegularDestinations();
        if (!cancelled) setRegulars(list);
      })();
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const markRegular = useCallback(
    async (input: { name: string; latitude: number; longitude: number }) => {
      const record = await addToStore(input);
      setRegulars(await getRegularDestinations());
      return record;
    },
    [],
  );

  const unmarkRegular = useCallback(
    async (latitude: number, longitude: number) => {
      const remaining = await removeRegularDestination(latitude, longitude);
      setRegulars(remaining);
    },
    [],
  );

  const clearAll = useCallback(async () => {
    await clearRegularDestinations();
    setRegulars([]);
  }, []);

  return { regulars, markRegular, unmarkRegular, clearAll };
}
