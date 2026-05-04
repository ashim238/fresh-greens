// Fresh Greens — route scoring.
//
// Pure functions (no async, no I/O) that take routes + zones and decide
// which route is "recommended."
//
// Zones can have polygon or polyline geometry — the algorithm branches
// per zone:
//   polygon  → ray-casting point-in-polygon (waypoint inside the area?)
//   polyline → point-near-polyline within a meters threshold (waypoint
//              on/near this lit street?)

import type {
  Coordinate,
  Zone,
  ZoneType,
} from './api/zones';
import { POLYLINE_PROXIMITY_METERS } from './api/zones';
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
 */
export function scoreRoute(route: Route, zones: Zone[]): number {
  let total = 0;
  for (const point of route.coordinates) {
    for (const zone of zones) {
      const hit =
        zone.geometry === 'polygon'
          ? isPointInPolygon(point, zone.coordinates)
          : isPointNearPolyline(
              point,
              zone.coordinates,
              POLYLINE_PROXIMITY_METERS,
            );
      if (hit) {
        total += SCORE_WEIGHTS[zone.type];
      }
    }
  }
  return total;
}

/**
 * Score every candidate route, sort by score descending, mark the
 * winner as 'recommended' and the rest as 'alternate'. Returns
 * RankedRoute[] sorted highest-score-first.
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
