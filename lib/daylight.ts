// Fresh Greens — daylight gradient for route polylines.
//
// Pure function (no async, no I/O). Splits a route into colored segments
// representing minutes-to-sunset at each segment, computed for real using
// SunCalc against:
//   - the user's departure time (defaults to now)
//   - estimated travel time per segment (departure + cumulative offset)
//   - the segment's actual lat/lng (so a long east-west route can have
//     different sunset times across its segments)
//
// Per .cursorrules: orange used here as functional daylight encoding (the
// literal color of light at that time of day), NOT as signaling — exactly
// the documented exception to the reserved-color rule. The polyline
// palette (orange → mauve → indigo) matches the bottom-sheet daylight
// strip on /home and Route (Experienced) so the legend and the polyline
// agree visually — one canonical encoding for "amount of daylight,"
// not two competing scales.

import SunCalc from 'suncalc';

import type { Route } from './api/routes';
import type { Coordinate } from './api/zones';

export type RouteSegment = {
  coordinates: Coordinate[];
  color: string;
};

/**
 * Splits a route's coordinates into colored segments. The color of each
 * segment represents how much daylight remains when (approximately) the
 * driver reaches that segment.
 *
 * @param route — the route polyline to gradient
 * @param departureTime — when the trip starts; defaults to now. Future-
 *   facing for the "Schedule for 7:38 AM" feature where users can pick
 *   a departure that maximizes daylight.
 */
export function gradientSegments(
  route: Route,
  departureTime: Date = new Date(),
): RouteSegment[] {
  const points = route.coordinates;
  if (points.length < 2) return [];

  const segmentCount = 5;
  const pointsPerSegment = Math.max(
    2,
    Math.ceil(points.length / segmentCount),
  );
  const segments: RouteSegment[] = [];

  for (let i = 0; i < segmentCount; i++) {
    // -1 so adjacent segments share a boundary coordinate, preventing
    // visible gaps between polylines at segment seams.
    const start = i * (pointsPerSegment - 1);
    const end = Math.min(start + pointsPerSegment, points.length);
    if (start >= points.length - 1) break;

    const segmentCoords = points.slice(start, end);

    // Estimated arrival time at this segment's midpoint: departure +
    // (segment's fractional position * total trip duration).
    // (i + 0.5) targets the middle of segment i, not its start.
    const segmentProgress = (i + 0.5) / segmentCount;
    const segmentTime = new Date(
      departureTime.getTime() +
        segmentProgress * route.estimatedMinutes * 60_000,
    );

    // Sunset is computed at the segment's geometric midpoint. Routes
    // mostly stay in one general area, but for cross-region trips this
    // matters — sunset varies by longitude (and by latitude in winter).
    const midpoint = segmentCoords[Math.floor(segmentCoords.length / 2)];
    const sunTimes = SunCalc.getTimes(
      segmentTime,
      midpoint.latitude,
      midpoint.longitude,
    );

    const minutesToSunset =
      (sunTimes.sunset.getTime() - segmentTime.getTime()) / 60_000;

    segments.push({
      coordinates: segmentCoords,
      color: colorForMinutesToSunset(minutesToSunset),
    });
  }

  return segments;
}

/**
 * Maps minutes-to-sunset to a daylight color sampled from the
 * orange → mauve → indigo gradient that the bottom-sheet daylight
 * strip uses (Figma 825:3635 / 825:3715). Intermediate stops are
 * linear-RGB blends between the three anchor colors, so the
 * five-segment polyline reads as a smooth left-to-right slice of
 * the same gradient the user sees in the legend.
 *
 * Bands map "minutes to sunset" → "what time of day this segment
 * looks like":
 *   90+ min remaining  → mid-afternoon (orange)
 *   60–90 min          → late afternoon (warm orange)
 *   30–60 min          → golden hour (mauve)
 *   0–30 min           → sunset transition (dusty mauve)
 *   negative           → past sunset, night (indigo)
 *
 * Falls back to mid-afternoon orange if SunCalc returned NaN (polar
 * day/night edge case at extreme latitudes).
 */
function colorForMinutesToSunset(minutes: number): string {
  if (Number.isNaN(minutes)) return '#FFB347'; // safe default — full daylight
  if (minutes > 90) return '#FFB347'; // orange anchor (strip start)
  if (minutes > 60) return '#E19551'; // orange→mauve blend
  if (minutes > 30) return '#C4785A'; // mauve anchor (strip middle)
  if (minutes > 0) return '#784961'; // mauve→indigo blend
  return '#2D1B69'; // indigo anchor (strip end) — past sunset
}
