// Fresh Greens — route scoring.
//
// Pure functions (no async, no I/O) that take routes + zones and decide
// which route is "recommended."
//
// Zones can have polygon, polyline, or point geometry — the algorithm
// branches per zone:
//   polygon  → ray-casting point-in-polygon (waypoint inside the area?)
//   polyline → point-near-polyline within a meters threshold (waypoint
//              on/near this lit street?)
//   point    → point-to-point distance within POINT_PROXIMITY_METERS
//              (waypoint near this community-reported location?)
//
// Per-category score modulation lives here too. Today: wildlife zones
// during dawn/dusk get a ×2 multiplier because deer and other wildlife
// are crepuscular — the same forested polygon is a stronger caution
// signal at 6am than at noon. Time modulation belongs in scoring (which
// has trip context) rather than in the zones adapter (which describes
// what's there, not what to do about it given the trip).

import SunCalc from 'suncalc';

import type {
  Coordinate,
  Zone,
  ZoneCategory,
  ZoneType,
} from './api/zones';
import {
  POINT_PROXIMITY_METERS,
  POLYLINE_PROXIMITY_METERS,
} from './api/zones';
import type { Route, RouteType } from './api/routes';

/**
 * Per-zone-type score contribution per waypoint that hits that zone.
 * Tunable knob — these numbers express how risk-averse Fresh Greens is
 * by default. Higher safe weight = more willing to detour for safety.
 * Higher avoid penalty = more strongly avoids unlit streets.
 */
const SCORE_WEIGHTS: Record<ZoneType, number> = {
  safe: 2,
  caution: -1,
  avoid: -5,
};

/**
 * Per-category multiplier applied on top of the per-type weight.
 * Default 1.0 (no modulation). Wildlife zones during dawn/dusk get
 * ×2 — see docstring at top of file. Compute the multiplier per zone
 * and per trip context (departureTime), not per type, so a forested
 * polygon scored at noon is unmodulated but the same polygon scored
 * at sunset is amplified.
 */
function categoryMultiplier(
  category: ZoneCategory | undefined,
  point: Coordinate,
  departureTime: Date,
): number {
  if (category === 'wildlife' && isDawnOrDusk(point, departureTime)) {
    return 2;
  }
  return 1;
}

/**
 * Returns true when `time` falls within ±30 minutes of sunrise or sunset
 * at the given location. Crepuscular wildlife (deer especially) emerge
 * heavily during this window, justifying the score amplification.
 *
 * SunCalc is the same library lib/daylight.ts uses for the route
 * polyline gradient — single solar-geometry source across the codebase.
 */
function isDawnOrDusk(point: Coordinate, time: Date): boolean {
  const sun = SunCalc.getTimes(time, point.latitude, point.longitude);
  const windowMs = 30 * 60_000;
  const t = time.getTime();
  return (
    Math.abs(t - sun.sunrise.getTime()) <= windowMs ||
    Math.abs(t - sun.sunset.getTime()) <= windowMs
  );
}

/** A route after scoring — adds `type` (winner status) and `score`. */
export type RankedRoute = Route & {
  type: RouteType;
  score: number;
};

/**
 * Score a single route against the active zones. For each waypoint,
 * test against every zone using the right geometric primitive (in-polygon
 * for areas, near-polyline for streets). Sum weighted scores. Higher is
 * better.
 *
 * `departureTime` enables per-category time-of-day modulation (e.g.,
 * wildlife dawn/dusk amplification). Defaults to now — most trips are
 * "leave now" — but a scheduled departure passes a future time so the
 * preview reflects the trip the user will actually take.
 */
export function scoreRoute(
  route: Route,
  zones: Zone[],
  departureTime: Date = new Date(),
): number {
  let total = 0;
  for (const point of route.coordinates) {
    for (const zone of zones) {
      const hit = isWaypointInZone(point, zone);
      if (hit) {
        const multiplier = categoryMultiplier(
          zone.category,
          point,
          departureTime,
        );
        total += SCORE_WEIGHTS[zone.type] * multiplier;
      }
    }
  }
  return total;
}

/**
 * Geometry-dispatch for scoring. Each zone-geometry kind has its own
 * primitive; this picks the right one. Extracted from `scoreRoute`'s
 * inner loop because three branches on zone.geometry inside a nested
 * loop reads worse than one named function.
 */
function isWaypointInZone(point: Coordinate, zone: Zone): boolean {
  switch (zone.geometry) {
    case 'polygon':
      return isPointInPolygon(point, zone.coordinates);
    case 'polyline':
      return isPointNearPolyline(
        point,
        zone.coordinates,
        POLYLINE_PROXIMITY_METERS,
      );
    case 'point':
      // Point zones store the location as a single-element array.
      // Empty (defensive) → never hit.
      if (zone.coordinates.length === 0) return false;
      return (
        pointToPointDistanceMeters(point, zone.coordinates[0]) <
        POINT_PROXIMITY_METERS
      );
  }
}

/**
 * Score every candidate route, sort by score descending, mark the
 * winner as 'recommended' and the rest as 'alternate'. Returns
 * RankedRoute[] sorted highest-score-first.
 *
 * `departureTime` flows through to `scoreRoute` for time-of-day
 * modulation. Defaults to now.
 */
export function pickWinner(
  routes: Route[],
  zones: Zone[],
  departureTime: Date = new Date(),
): RankedRoute[] {
  const scored = routes.map((route) => ({
    ...route,
    score: scoreRoute(route, zones, departureTime),
  }));

  scored.sort((a, b) => b.score - a.score);

  return scored.map((route, index) => ({
    ...route,
    type: index === 0 ? ('recommended' as const) : ('alternate' as const),
  }));
}

// --- Geometry helpers -------------------------------------------------------

/**
 * Ray-casting point-in-polygon test. From the point, cast a horizontal
 * ray east; count edge crossings. Odd = inside, even = outside.
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

/**
 * Returns true when the point is within `thresholdMeters` of any segment
 * of the polyline. For each segment, project the point onto it and clamp
 * to the segment's extent; that gives the closest in-segment point and
 * its distance.
 *
 * Distance is computed in meters using an equirectangular projection
 * (lat/lng deltas scaled to meters). Accurate enough at neighborhood
 * scale; would matter at country scale.
 */
function isPointNearPolyline(
  point: Coordinate,
  polyline: Coordinate[],
  thresholdMeters: number,
): boolean {
  for (let i = 0; i < polyline.length - 1; i++) {
    if (
      pointToSegmentDistanceMeters(point, polyline[i], polyline[i + 1]) <
      thresholdMeters
    ) {
      return true;
    }
  }
  return false;
}

function pointToSegmentDistanceMeters(
  point: Coordinate,
  segStart: Coordinate,
  segEnd: Coordinate,
): number {
  // Convert lat/lng deltas to meters via equirectangular projection.
  // 1° latitude ≈ 111,000m always.
  // 1° longitude ≈ 111,000m × cos(latitude in radians).
  const latToMeters = 111000;
  const lngToMeters =
    111000 * Math.cos((point.latitude * Math.PI) / 180);

  // Translate so segStart is at origin, then convert to meters.
  const px = (point.longitude - segStart.longitude) * lngToMeters;
  const py = (point.latitude - segStart.latitude) * latToMeters;
  const sx = (segEnd.longitude - segStart.longitude) * lngToMeters;
  const sy = (segEnd.latitude - segStart.latitude) * latToMeters;

  const segLengthSquared = sx * sx + sy * sy;
  // Degenerate segment (start === end) — point-to-point distance.
  if (segLengthSquared === 0) return Math.hypot(px, py);

  // Project point onto segment, clamp t to [0,1] so we stay within
  // the segment rather than its infinite line extension.
  const t = Math.max(0, Math.min(1, (px * sx + py * sy) / segLengthSquared));
  const closestX = sx * t;
  const closestY = sy * t;
  return Math.hypot(px - closestX, py - closestY);
}

/**
 * Distance between two coordinates in meters, via equirectangular
 * projection (lat/lng deltas scaled to meters). Same approach as the
 * segment helper above; the math collapses to plain Euclidean distance
 * when both endpoints are the same point.
 */
function pointToPointDistanceMeters(
  a: Coordinate,
  b: Coordinate,
): number {
  const latToMeters = 111000;
  const lngToMeters = 111000 * Math.cos((a.latitude * Math.PI) / 180);
  const dx = (b.longitude - a.longitude) * lngToMeters;
  const dy = (b.latitude - a.latitude) * latToMeters;
  return Math.hypot(dx, dy);
}
