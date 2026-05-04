// Fresh Greens — routes adapter (mock).
//
// Same architectural pattern as lib/api/zones.ts: typed adapter, async
// signature, simulated delay, mock-first. The real version will call
// OSRM (or Mapbox Directions, or Google Directions) — only the body
// of getRoutesBetween changes.
//
// Returns *candidate* routes — multiple options between the same two
// points. The next PR (route scoring) picks a winner from this list
// based on which zones each candidate passes through.

import type { Coordinate } from './zones';

export type RouteType = 'recommended' | 'alternate';

/**
 * A candidate route from origin to destination. Note there is no `type`
 * field here — the adapter doesn't pre-classify which route is best.
 * That decision belongs to scoring (see lib/scoring.ts), not to the
 * data source. Real routing engines return candidates the same way.
 */
export type Route = {
  id: string;
  label: string;
  /** Approximate duration in minutes (mock for now) */
  estimatedMinutes: number;
  /** Polyline of lat/lng waypoints from origin to destination */
  coordinates: Coordinate[];
};

/**
 * Fetches candidate routes between two points.
 *
 * Returns 2 mock routes: a "recommended" path that arcs through the
 * area to the north (intended to pass through the safe zone in the
 * mock zone data), and a faster direct path. Currently the route
 * shapes are hardcoded — the next PR will compute scoring based on
 * which zones each route intersects.
 */
export async function getRoutesBetween(
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

// --- Helpers ----------------------------------------------------------------

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * "Direct" path — straight line from origin to destination, with a few
 * intermediate points so it renders as a polyline (same shape a real
 * routing engine would return).
 */
function directPath(origin: Coordinate, destination: Coordinate): Coordinate[] {
  return interpolate(origin, destination, 6);
}

/**
 * "Arc" path — curve that detours through a midpoint biased to the
 * north, mimicking a route that takes a longer way around. In the
 * mock zone setup, "north of midpoint" lands inside the green safe
 * zone, so the visual reads as "the recommended route goes through
 * the safe area."
 */
function arcPath(origin: Coordinate, destination: Coordinate): Coordinate[] {
  const midLat = (origin.latitude + destination.latitude) / 2;
  const midLng = (origin.longitude + destination.longitude) / 2;
  const detour: Coordinate = {
    latitude: midLat + 0.003, // bias north
    longitude: midLng,
  };

  return [
    ...interpolate(origin, detour, 4),
    ...interpolate(detour, destination, 4),
  ];
}

/**
 * Linear interpolation between two coordinates, returning `steps + 1`
 * waypoints (including both endpoints). Real routing engines give you
 * ~50-200 points per route; 6 is enough to look like a polyline at
 * city-block zoom.
 */
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
