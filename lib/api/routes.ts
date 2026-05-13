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
  /** Total route distance in meters */
  distanceMeters: number;
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

    // OSRM snaps the destination to the nearest road segment in its
    // own (OpenStreetMap-derived) network, which can be a different
    // road than where the Mapbox-geocoded POI actually sits. The
    // returned geometry ends at OSRM's snap, which often visibly
    // overshoots the destination on the map. Trim each route to the
    // point closest to the requested destination so the polyline
    // ends where the user expects to arrive.
    return data.routes
      .map(parseOSRMRoute)
      .map((route) => ({
        ...route,
        coordinates: trimToDestination(route.coordinates, destination),
      }));
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

/**
 * Trims a route's coordinate list so it ends at the polyline point
 * closest to `destination`. Necessary because OSRM snaps the
 * requested destination to its own road network — when the snap is
 * a block past the actual POI, the unbounded geometry visibly
 * overshoots. The trimmed polyline preserves OSRM's path up to the
 * closest approach, then stops.
 *
 * Pure + cheap: O(n) linear scan over the coordinate list (~50-200
 * points per route on a city trip).
 *
 * Safety net: always keeps at least 2 points so the result is still
 * a renderable line, even in the degenerate case where the closest
 * point is the origin itself.
 */
function trimToDestination(
  coordinates: Coordinate[],
  destination: Coordinate,
): Coordinate[] {
  if (coordinates.length <= 2) return coordinates;

  let bestIndex = coordinates.length - 1;
  let bestDistSq = Number.POSITIVE_INFINITY;
  for (let i = 0; i < coordinates.length; i++) {
    // Squared equirectangular distance — same units as the existing
    // estimatePathMeters helper, but we only care about ordering so
    // skip the sqrt + Earth-radius multiply.
    const dLat = coordinates[i].latitude - destination.latitude;
    const dLng = coordinates[i].longitude - destination.longitude;
    const distSq = dLat * dLat + dLng * dLng;
    if (distSq < bestDistSq) {
      bestDistSq = distSq;
      bestIndex = i;
    }
  }

  // Slice inclusive of the closest point; guard against returning a
  // 1-point list if the origin itself was the closest match.
  const trimmedLength = Math.max(2, bestIndex + 1);
  return coordinates.slice(0, trimmedLength);
}

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
    distanceMeters: osrmRoute.distance,
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

  const arc = arcPath(origin, destination);
  const direct = directPath(origin, destination);

  return [
    {
      id: 'mock-route-arc',
      label: 'Northern arc',
      estimatedMinutes: 9,
      distanceMeters: estimatePathMeters(arc),
      coordinates: arc,
    },
    {
      id: 'mock-route-direct',
      label: 'Direct',
      estimatedMinutes: 6,
      distanceMeters: estimatePathMeters(direct),
      coordinates: direct,
    },
  ];
}

/**
 * Sums segment lengths along a coordinate path, in meters. Same
 * equirectangular projection as lib/scoring.ts (latToMeters = 111000,
 * lngToMeters scaled by cos(latitude)). Used only for the mock fallback —
 * OSRM returns distance directly.
 */
function estimatePathMeters(path: Coordinate[]): number {
  let total = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i];
    const b = path[i + 1];
    const latToMeters = 111000;
    const lngToMeters = 111000 * Math.cos((a.latitude * Math.PI) / 180);
    const dx = (b.longitude - a.longitude) * lngToMeters;
    const dy = (b.latitude - a.latitude) * latToMeters;
    total += Math.hypot(dx, dy);
  }
  return total;
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
