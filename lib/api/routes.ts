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
/**
 * Maximum origin→destination straight-line distance the app will
 * attempt to route, in miles. Anything beyond this is cross-continent
 * territory the safety/daylight optimization doesn't sensibly apply
 * to — single-day road trips top out around here (LA↔SF is ~380mi,
 * NYC↔Boston ~215mi, Houston↔Dallas ~240mi). Catches the case where
 * a recent-searches entry from a prior trip (e.g. NYC) is re-tapped
 * after the user has traveled abroad (e.g. Spain) — the search query
 * itself is bbox-gated to ~140mi, but persisted entries bypass that.
 */
const MAX_ROUTE_DISTANCE_MILES = 500;

export async function getRoutesBetween(
  origin: Coordinate,
  destination: Coordinate,
): Promise<Route[]> {
  // Guard against unroutable origin/destination pairs before hitting
  // OSRM. Beyond MAX_ROUTE_DISTANCE_MILES the optimization is moot
  // (and the OSRM call would return a multi-thousand-mile polyline
  // that no one wants to drive). Caller (/home route-preview) already
  // handles the "no recommended route" empty state gracefully.
  const distance = haversineMiles(origin, destination);
  if (distance > MAX_ROUTE_DISTANCE_MILES) {
    console.warn(
      `[routes] origin→destination ${distance.toFixed(0)}mi exceeds ` +
        `${MAX_ROUTE_DISTANCE_MILES}mi guard; returning no routes.`,
    );
    return [];
  }

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
 * closest to `destination` — but only when OSRM's snap is genuinely
 * past the destination. Necessary because OSRM and Mapbox use
 * different road networks; when their endpoints disagree, OSRM's
 * geometry can overshoot the user's expected destination pin.
 *
 * Two guards prevent over-aggressive trimming:
 *
 *  1. **End-already-close short-circuit** — if the geometry's last
 *     point is within ~50m of the destination, OSRM's snap matched
 *     the requested point closely enough. Return the geometry
 *     untouched.
 *
 *  2. **Search the latter half only** — when we DO trim, search
 *     only the second half of the polyline. A route that curves
 *     near the destination mid-trip (loops, U-turns, multi-leg
 *     paths) was passing-by, not arriving; a global-closest scan
 *     would mistake that pass-by for the endpoint and cut the
 *     route in half. Constraining the search to the latter half
 *     keeps mid-trip approaches intact.
 *
 * Pure + cheap: O(n) linear scan over half the coordinate list
 * (~25-100 points on a city trip).
 *
 * Safety net: always keeps at least 2 points so the result is still
 * a renderable line.
 */
function trimToDestination(
  coordinates: Coordinate[],
  destination: Coordinate,
): Coordinate[] {
  if (coordinates.length <= 2) return coordinates;

  // Guard 1: end-already-close. Compute approximate meters from the
  // last polyline point to the destination via equirectangular
  // projection — same scale lib/scoring.ts and the mock estimator
  // use elsewhere. 50m is roughly half a city block; closer than
  // that and OSRM's snap is "right place, slightly different road."
  const last = coordinates[coordinates.length - 1];
  const latToM = 111000;
  const lngToM = 111000 * Math.cos((destination.latitude * Math.PI) / 180);
  const lastDLat = (last.latitude - destination.latitude) * latToM;
  const lastDLng = (last.longitude - destination.longitude) * lngToM;
  if (Math.hypot(lastDLat, lastDLng) < 50) return coordinates;

  // Guard 2: search the latter half only. Use squared lat/lng deltas
  // as a comparator — we only care about ordering, not actual meters.
  const startIdx = Math.floor(coordinates.length / 2);
  let bestIndex = coordinates.length - 1;
  let bestDistSq = Number.POSITIVE_INFINITY;
  for (let i = startIdx; i < coordinates.length; i++) {
    const dLat = coordinates[i].latitude - destination.latitude;
    const dLng = coordinates[i].longitude - destination.longitude;
    const distSq = dLat * dLat + dLng * dLng;
    if (distSq < bestDistSq) {
      bestDistSq = distSq;
      bestIndex = i;
    }
  }

  return coordinates.slice(0, Math.max(2, bestIndex + 1));
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
/**
 * Haversine distance in miles between two lat/lng points. Used by the
 * MAX_ROUTE_DISTANCE_MILES guard above. Inlined here rather than
 * imported from `recommendations.ts` (which has its own private
 * `distanceMilesBetween`) — the math is small and the duplication
 * keeps `routes.ts` self-contained.
 */
function haversineMiles(a: Coordinate, b: Coordinate): number {
  const R = 3958.8; // Earth's radius in miles
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

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
