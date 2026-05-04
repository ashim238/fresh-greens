// Fresh Greens — route scoring.
//
// Pure functions (no async, no I/O) that take routes + zones and decide
// which route is "recommended." This is the moment Fresh Greens stops
// being "an app with a map" and becomes "an app that picks safer routes."
//
// The algorithm is deliberately simple — for each waypoint of a route,
// check which zone (if any) it falls inside, sum weighted scores. The
// route with the highest total wins. Real-world refinement comes later
// (route segment length weighting, time-of-day modifiers, user
// preferences), but the contract stays the same.

import type { Coordinate, Zone, ZoneType } from './api/zones';
import type { Route, RouteType } from './api/routes';

/**
 * Per-zone-type score contribution per waypoint inside that zone.
 * Tunable knob — these numbers express how risk-averse Fresh Greens is
 * by default. Higher safe weight = more willing to detour for safety.
 * Higher avoid penalty = more strongly avoids red zones.
 */
const SCORE_WEIGHTS: Record<ZoneType, number> = {
  safe: 2,
  caution: -1,
  avoid: -5,
};

/** A route after scoring — adds `type` (winner status) and `score`. */
export type RankedRoute = Route & {
  type: RouteType;
  score: number;
};

/**
 * Score a single route against the active zones.
 * For each waypoint, check each zone — if the point falls inside, add
 * the zone type's weight. Sum across all waypoints. Higher = better.
 *
 * Naïve O(waypoints × zones) — fine for the scales we care about
 * (~50 waypoints × ~10 zones = 500 checks per route).
 */
export function scoreRoute(route: Route, zones: Zone[]): number {
  let total = 0;
  for (const point of route.coordinates) {
    for (const zone of zones) {
      if (isPointInPolygon(point, zone.coordinates)) {
        total += SCORE_WEIGHTS[zone.type];
      }
    }
  }
  return total;
}

/**
 * Score every candidate route, sort by score descending, mark the
 * winner as 'recommended' and the rest as 'alternate'.
 *
 * Returns RankedRoute[] (same length as input, sorted, with new fields).
 * The original Route objects aren't mutated — we spread them into new
 * objects with the added fields. Pure function: same input → same output,
 * no side effects.
 */
export function pickWinner(routes: Route[], zones: Zone[]): RankedRoute[] {
  const scored = routes.map((route) => ({
    ...route,
    score: scoreRoute(route, zones),
  }));

  scored.sort((a, b) => b.score - a.score);

  return scored.map((route, index) => ({
    ...route,
    type: index === 0 ? ('recommended' as const) : ('alternate' as const),
  }));
}

// --- Geometry helpers -------------------------------------------------------

/**
 * Ray-casting point-in-polygon test. Standard algorithm: from the point,
 * cast a horizontal ray to the east and count how many polygon edges
 * it crosses. Odd count = inside; even count = outside.
 *
 * Works for any simple polygon (no self-intersections). Doesn't account
 * for the Earth's curvature — fine at neighborhood scale, would matter
 * at country scale.
 */
function isPointInPolygon(point: Coordinate, polygon: Coordinate[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].longitude;
    const yi = polygon[i].latitude;
    const xj = polygon[j].longitude;
    const yj = polygon[j].latitude;

    const intersects =
      yi > point.latitude !== yj > point.latitude &&
      point.longitude <
        ((xj - xi) * (point.latitude - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}
