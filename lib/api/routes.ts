// Fresh Greens — routes adapter.
//
// Calls OSRM's free public demo server (router.project-osrm.org) for real
// routing data. Falls back to the mock implementation if the request fails
// (no network, server down, no route found between origin and destination).
//
// The fallback is deliberate: the consumer (app/home.tsx) calls this
// function and gets back a Route[] either way. It can't tell whether
// the data came from a real API or the mock. That's the value of the
// adapter pattern — the consumer is decoupled from the data source.
//
// Note on OSRM: the public demo server has rate limits and isn't intended
// for production. For the thesis demo it's fine. Real launch would require
// either self-hosting OSRM or paying for Mapbox Directions / Google
// Directions — the function signature stays the same; only the body
// changes.

import type { Coordinate } from './zones';

export type RouteType = 'recommended' | 'alternate';

/**
 * A candidate route from origin to destination. Note there is no `type`
 * field here — the adapter doesn't pre-classify which route is best.
 * That decision belongs to scoring (see lib/scoring.ts), not to the
 * data source.
 */
export type Route = {
  id: string;
  label: string;
  /** Approximate duration in minutes */
  estimatedMinutes: number;
  /** Polyline of lat/lng waypoints from origin to destination */
  coordinates: Coordinate[];
};

/**
 * Fetches candidate routes between two points.
 *
 * Tries OSRM first; falls back to mock on any failure (network error,
 * non-OK status, no routes found). Console-warns on fallback so we can
 * see in dev when the real API isn't responding.
 */
export async function getRoutesBetween(
  origin: Coordinate,
  destination: Coordinate,
): Promise<Route[]> {
  try {
    const response = await fetch(buildOSRMUrl(origin, destination));
    if (!response.ok) {
      throw new Error(`OSRM HTTP ${response.status}`);
    }

    const data: OSRMResponse = await response.json();
    if (data.code !== 'Ok' || !data.routes?.length) {
      throw new Error(`OSRM returned no routes (code: ${data.code})`);
    }

    return data.routes.map(parseOSRMRoute);
  } catch (error) {
    console.warn(
      '[routes] OSRM fetch failed, falling back to mock:',
      error,
    );
    return getRoutesBetweenMock(origin, destination);
  }
}

/**
 * Display style per route type.
 * - Recommended: bold freshgreen — visually claims "this is the choice."
 * - Alternate: muted gray — present but de-emphasized.
 */
export const routeColors: Record<
  RouteType,
  { stroke: string; width: number }
> = {
  recommended: { stroke: 'rgba(65, 173, 73, 0.9)', width: 5 },
  alternate: { stroke: 'rgba(128, 128, 128, 0.6)', width: 3 },
};

// --- OSRM ------------------------------------------------------------------

/**
 * Minimal type for the OSRM response shape we use. The real response has
 * far more fields (legs, steps, waypoints, etc.) — typing only what we
 * read keeps the contract tight without listing OSRM's whole API.
 */
type OSRMResponse = {
  code: string;
  routes?: OSRMRoute[];
};

type OSRMRoute = {
  /** Total duration in seconds */
  duration: number;
  /** Total distance in meters */
  distance: number;
  geometry: {
    /** GeoJSON LineString — array of [longitude, latitude] pairs */
    coordinates: [number, number][];
  };
};

function buildOSRMUrl(origin: Coordinate, destination: Coordinate): string {
  // OSRM expects coordinates as `lng,lat;lng,lat` (longitude first — opposite
  // of our internal { latitude, longitude } convention). Easy bug to make.
  const coords = `${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}`;
  return `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson&alternatives=true`;
}

function parseOSRMRoute(osrmRoute: OSRMRoute, index: number): Route {
  // GeoJSON coordinates are [longitude, latitude]. Convert to our
  // { latitude, longitude } shape so the rendering code doesn't have to
  // care that this came from a GeoJSON source.
  const coordinates: Coordinate[] = osrmRoute.geometry.coordinates.map(
    ([longitude, latitude]) => ({ latitude, longitude }),
  );

  return {
    id: `osrm-route-${index}`,
    label: index === 0 ? 'Primary route' : `Alternative ${index}`,
    estimatedMinutes: Math.max(1, Math.round(osrmRoute.duration / 60)),
    coordinates,
  };
}

// --- Mock fallback ---------------------------------------------------------

/**
 * Synthesizes 2 mock routes between the given points. Only used when OSRM
 * is unreachable. Same shape as the real response so consumers can't tell
 * the difference.
 */
async function getRoutesBetweenMock(
  origin: Coordinate,
  destination: Coordinate,
): Promise<Route[]> {
  await delay(150);

  return [
    {
      id: 'mock-route-arc',
      label: 'Northern arc',
      estimatedMinutes: 9,
      coordinates: arcPath(origin, destination),
    },
    {
      id: 'mock-route-direct',
      label: 'Direct',
      estimatedMinutes: 6,
      coordinates: directPath(origin, destination),
    },
  ];
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function directPath(origin: Coordinate, destination: Coordinate): Coordinate[] {
  return interpolate(origin, destination, 6);
}

function arcPath(origin: Coordinate, destination: Coordinate): Coordinate[] {
  const midLat = (origin.latitude + destination.latitude) / 2;
  const midLng = (origin.longitude + destination.longitude) / 2;
  const detour: Coordinate = {
    latitude: midLat + 0.003,
    longitude: midLng,
  };

  return [
    ...interpolate(origin, detour, 4),
    ...interpolate(detour, destination, 4),
  ];
}

function interpolate(
  a: Coordinate,
  b: Coordinate,
  steps: number,
): Coordinate[] {
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps;
    return {
      latitude: a.latitude + (b.latitude - a.latitude) * t,
      longitude: a.longitude + (b.longitude - a.longitude) * t,
    };
  });
}
