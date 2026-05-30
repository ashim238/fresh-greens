import { useCallback, useEffect, useState } from 'react';

import {
  addRegularDestination as addToStore,
  clearRegularDestinations,
  getRegularDestinations,
  type RegularDestination,
} from '../lib/api/regular-destinations';

/**
 * Reactive wrapper around the regular-destinations adapter. Loads the
 * list on mount; `markRegular` persists + refreshes local state so a
 * consumer re-renders without a manual refetch. `clearAll` wipes the
 * store (sign-out hygiene), mirroring useSavedPlaces' `clearAll`.
 *
 * Same shape as useSavedPlaces / useTrustedContact. Deliberately omits a
 * `loading` flag (useSavedPlaces has one): the only consumer treats
 * "not yet loaded" identically to "no match" — `isRegularDestination`
 * stays false until the load resolves, which is the desired behavior
 * for the recurring-destination underline (no flash of a wrong
 * underline). `isRegularLocation` stays a pure import from the adapter —
 * callers compute membership against `regulars` themselves so the
 * boolean isn't re-derived per render inside the hook.
 */
export function useRegularDestinations() {
  const [regulars, setRegulars] = useState<RegularDestination[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const list = await getRegularDestinations();
      if (!cancelled) setRegulars(list);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const markRegular = useCallback(
    async (input: { name: string; latitude: number; longitude: number }) => {
      const record = await addToStore(input);
      setRegulars(await getRegularDestinations());
      return record;
    },
    [],
  );

  const clearAll = useCallback(async () => {
    await clearRegularDestinations();
    setRegulars([]);
  }, []);

  return { regulars, markRegular, clearAll };
}
