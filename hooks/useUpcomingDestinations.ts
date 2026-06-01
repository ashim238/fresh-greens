// hooks/useUpcomingDestinations.ts
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import {
  getUpcomingLocatedEvents,
  type UpcomingEvent,
} from '../lib/api/calendar';
import {
  getResolutions,
  type ResolvedPlace,
} from '../lib/api/calendar-resolutions';
import { searchPlaces } from '../lib/api/places';

export type ResolvedDestination = {
  event: UpcomingEvent;
  place: ResolvedPlace;
};

/**
 * Resolves upcoming located events into navigable destinations.
 *
 * For each event in the next 7 days with a non-empty location:
 *   1. A stored manual correction for its locationText wins (no geocode
 *      call) — that's the persisted pick-sheet result.
 *   2. Else geocode the locationText via searchPlaces (the same path
 *      /unfamiliar uses); the first hit becomes the resolved place.
 *   3. Else the event is UNRESOLVED — surfaced with a "Set location"
 *      affordance rather than hidden, so the user can correct it.
 *
 * Returns resolved + unresolved + loading. Re-runs on focus and when
 * `refreshKey` changes (bump it after a pick-sheet correction so the
 * list re-resolves immediately). geocode is called once per distinct
 * unresolved locationText per run.
 */
export function useUpcomingDestinations(
  userLocation: { latitude: number; longitude: number } | null,
  refreshKey: number = 0,
) {
  const [resolved, setResolved] = useState<ResolvedDestination[]>([]);
  const [unresolved, setUnresolved] = useState<UpcomingEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        setLoading(true);
        const events = await getUpcomingLocatedEvents();
        const resolutions = await getResolutions();

        const nextResolved: ResolvedDestination[] = [];
        const nextUnresolved: UpcomingEvent[] = [];
        // Cache geocode results per locationText within this run so two
        // events at the same venue don't double-call searchPlaces.
        const geocodeCache = new Map<string, ResolvedPlace | null>();

        for (const event of events) {
          const stored = resolutions[event.locationText];
          if (stored) {
            nextResolved.push({ event, place: stored });
            continue;
          }
          if (!userLocation) {
            // Can't geocode without an anchor — treat as unresolved for
            // now; a later run with a fix re-resolves.
            nextUnresolved.push(event);
            continue;
          }
          let place: ResolvedPlace | null;
          if (geocodeCache.has(event.locationText)) {
            place = geocodeCache.get(event.locationText) ?? null;
          } else {
            try {
              const hits = await searchPlaces(event.locationText, userLocation);
              const hit = hits[0];
              place = hit
                ? { name: hit.name, latitude: hit.latitude, longitude: hit.longitude }
                : null;
            } catch {
              place = null;
            }
            geocodeCache.set(event.locationText, place);
          }
          if (place) {
            nextResolved.push({ event, place });
          } else {
            nextUnresolved.push(event);
          }
        }

        if (!cancelled) {
          setResolved(nextResolved);
          setUnresolved(nextUnresolved);
          setLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
      // userLocation identity + refreshKey drive re-resolution.
    }, [userLocation, refreshKey]),
  );

  return { resolved, unresolved, loading };
}
