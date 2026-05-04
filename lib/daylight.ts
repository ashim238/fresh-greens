// Fresh Greens — daylight gradient for route polylines.
//
// Pure function (no async, no I/O). Takes a route and returns colored
// segments, simulating how daylight availability changes across the
// route's duration. Earlier segments = full sun (green), later segments
// = sunset/twilight (orange/red).
//
// v1 calibrates the gradient by *position along the route* — later
// segments are warmer regardless of actual time. When we install a
// solar calculator (suncalc or NOAA approximation), this function's
// body computes real sun-elevation angles per segment based on
// lat/lng/time. The signature and the rendering code don't change —
// same adapter-pattern discipline applies to pure utilities.
//
// Per .cursorrules: red/orange used here as the documented daylight-
// encoding exception to the reserved-color rule. This is functional
// (encoding daylight availability), not signaling — exactly the case
// the rule's daylight-gradient exception was written for.

import type { Route } from './api/routes';
import type { Coordinate } from './api/zones';

/**
 * Color stops representing daylight availability across a route.
 * Index 0 = full daylight; last index = twilight.
 */
const DAYLIGHT_GRADIENT = [
  '#41AD49', // freshgreen — full day
  '#A0D6A4', // fadedgreen — afternoon
  '#FFCC00', // yellow — golden hour begins
  '#FF9500', // orange — sunset
  '#FF3B30', // red — twilight
];

export type RouteSegment = {
  coordinates: Coordinate[];
  color: string;
};

/**
 * Splits a route's coordinates into one segment per gradient color and
 * assigns each its color. Adjacent segments share a boundary coordinate
 * so the polylines render as one continuous line with no visible seams.
 */
export function gradientSegments(route: Route): RouteSegment[] {
  const points = route.coordinates;
  const stops = DAYLIGHT_GRADIENT.length;

  // If the route has fewer points than gradient stops, just return one
  // segment per available point pair.
  if (points.length < 2) return [];

  const pointsPerSegment = Math.max(2, Math.ceil(points.length / stops));
  const segments: RouteSegment[] = [];

  for (let i = 0; i < stops; i++) {
    const start = i * (pointsPerSegment - 1); // -1 so adjacent segments share a point
    const end = Math.min(start + pointsPerSegment, points.length);
    if (start >= points.length - 1) break;

    segments.push({
      coordinates: points.slice(start, end),
      color: DAYLIGHT_GRADIENT[i],
    });
  }

  return segments;
}
