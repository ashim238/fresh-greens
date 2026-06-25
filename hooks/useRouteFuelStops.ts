import { useEffect, useRef, useState } from 'react';

import { enrichPlacesWithFuelPrices } from '../lib/api/fuel-prices';
import { searchPlaces, type Place } from '../lib/api/places';
import type { FuelType } from '../lib/api/fuel';
import type { LatLng } from '../lib/edge-indicators';
import {
  distanceToPolylineMeters,
  haversineMeters,
  metersToMiles,
  sampleAlongPath,
} from '../lib/geo';

/** Keep stops within this distance of the route polyline. ~1.5 km is a
    short detour; tune on device (spec risk note). */
export const ROUTE_PROXIMITY_METERS = 1500;

/** Human-readable proximity copy for fuel-sheet subtitles. */
export const ROUTE_PROXIMITY_MILES = 1;

/**
 * Mapbox `searchPlaces` is proximity-biased and capped at 10 results.
 * A single query at the user's GPS returns only nearby stations — on a
 * long route every on-map pin clusters at the origin even after the
 * polyline filter. Sample centers along the route so discovery covers
 * the corridor (bounded to limit API calls).
 */
const FUEL_ROUTE_SAMPLE_SPACING_M = 25_000; // ~15 mi
const MAX_FUEL_ROUTE_SAMPLES = 5;
const FUEL_SAMPLE_DEDUPE_M = 500;

/** Mapbox category query per fuel type — electric searches charging,
    everything else searches gas. */
function fuelQuery(fuelType: FuelType): string {
  return fuelType === 'electric' ? 'ev charging' : 'gas station';
}

function distanceMilesFrom(a: LatLng, b: LatLng): number {
  return Math.round(metersToMiles(haversineMeters(a, b)) * 10) / 10;
}

async function searchFuelAlongRoute(
  query: string,
  routeCoords: LatLng[],
  userLocation: LatLng,
): Promise<Place[]> {
  const samples = sampleAlongPath(
    routeCoords,
    FUEL_ROUTE_SAMPLE_SPACING_M,
    MAX_FUEL_ROUTE_SAMPLES,
  ).filter(
    (s) => haversineMeters(s, userLocation) > FUEL_SAMPLE_DEDUPE_M,
  );

  const batches = await Promise.all([
    searchPlaces(query, userLocation),
    ...samples.map((s) => searchPlaces(query, s)),
  ]);

  const byId = new Map<string, Place>();
  for (const batch of batches) {
    for (const place of batch) {
      if (!byId.has(place.id)) byId.set(place.id, place);
    }
  }

  return [...byId.values()]
    .map((p) => ({
      ...p,
      distanceMiles: distanceMilesFrom(userLocation, p),
    }))
    .sort((a, b) => a.distanceMiles - b.distanceMiles);
}

export type RouteFuelStopsState = {
  stops: Place[];
  loading: boolean;
  error: boolean;
};

/**
 * Fetches fuel/charging POIs along the active route corridor and keeps
 * only those within ROUTE_PROXIMITY_METERS of the polyline. Mapbox
 * queries run at the user's location plus sample points along the route
 * (not user-GPS-only) so long routes don't cluster every pin at the
 * origin. Only fetches when `active` so we don't spend Mapbox calls on
 * every idle mount.
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
        const results = await searchFuelAlongRoute(
          fuelQuery(fuelType),
          routeCoords,
          loc,
        );
        const onRoute = results.filter(
          (p) =>
            distanceToPolylineMeters(
              { latitude: p.latitude, longitude: p.longitude },
              routeCoords,
            ) <= ROUTE_PROXIMITY_METERS,
        );
        const priced =
          fuelType === 'electric'
            ? onRoute
            : await enrichPlacesWithFuelPrices(onRoute);
        if (!cancelled) setState({ stops: priced, loading: false, error: false });
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
