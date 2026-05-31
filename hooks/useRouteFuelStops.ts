import { useEffect, useRef, useState } from 'react';

import { searchPlaces, type Place } from '../lib/api/places';
import type { FuelType } from '../lib/api/fuel';
import type { LatLng } from '../lib/edge-indicators';
import { distanceToPolylineMeters } from '../lib/geo';

/** Keep stops within this distance of the route polyline. ~1.5 km is a
    short detour; tune on device (spec risk note). */
const ROUTE_PROXIMITY_METERS = 1500;

/** Mapbox category query per fuel type — electric searches charging,
    everything else searches gas. */
function fuelQuery(fuelType: FuelType): string {
  return fuelType === 'electric' ? 'ev charging' : 'gas station';
}

export type RouteFuelStopsState = {
  stops: Place[];
  loading: boolean;
  error: boolean;
};

/**
 * Fetches fuel/charging POIs near the user and keeps only those within
 * ROUTE_PROXIMITY_METERS of the active route polyline, sorted by distance
 * to the user (searchPlaces already returns that order; the proximity
 * filter preserves it). Only fetches when `active` (the sheet is open) so
 * we don't spend Mapbox calls on every /en-route mount.
 */
export function useRouteFuelStops(params: {
  active: boolean;
  routeCoords: LatLng[];
  fuelType: FuelType;
  userLocation: { latitude: number; longitude: number } | null;
}): RouteFuelStopsState {
  const { active, routeCoords, fuelType, userLocation } = params;
  const [state, setState] = useState<RouteFuelStopsState>({
    stops: [],
    loading: false,
    error: false,
  });

  // Read userLocation via a ref so a fresh GPS object every tick doesn't
  // re-trigger the fetch while the sheet is open. The sheet queries against
  // the location at open-time (active flips false→true on each open).
  const userLocationRef = useRef(userLocation);
  userLocationRef.current = userLocation;

  useEffect(() => {
    const loc = userLocationRef.current;
    if (!active || !loc || routeCoords.length === 0) return;
    let cancelled = false;
    setState({ stops: [], loading: true, error: false });
    (async () => {
      try {
        const results = await searchPlaces(fuelQuery(fuelType), loc);
        const onRoute = results.filter(
          (p) =>
            distanceToPolylineMeters(
              { latitude: p.latitude, longitude: p.longitude },
              routeCoords,
            ) <= ROUTE_PROXIMITY_METERS,
        );
        if (!cancelled) setState({ stops: onRoute, loading: false, error: false });
      } catch (err) {
        console.warn('[fuel-stops] search failed:', err);
        if (!cancelled) setState({ stops: [], loading: false, error: true });
      }
    })();
    return () => {
      cancelled = true;
    };
    // userLocation intentionally NOT a dep — read via userLocationRef so the
    // open sheet doesn't refetch on every GPS tick. Keyed on routeCoords
    // length (new array each render); active flips on each open for a fresh
    // fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, fuelType, routeCoords.length]);

  return state;
}
