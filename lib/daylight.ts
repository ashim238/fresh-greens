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
// Per .cursorrules: red/orange used here as functional daylight encoding,
// NOT as signaling — exactly the documented exception to the reserved-
// color rule.

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
 * Maps minutes-to-sunset to a daylight color.
 * Bands tuned for "how warm should this segment look" UX intuition:
 *   90+ min remaining  → full daylight (green)
 *   60–90 min          → afternoon (faded green)
 *   30–60 min          → golden hour begins (yellow)
 *   0–30 min           → sunset approaching (orange)
 *   negative           → past sunset, twilight (red)
 *
 * Falls back to bright daylight if SunCalc returned NaN (polar day/night
 * edge case at extreme latitudes).
 */
function colorForMinutesToSunset(minutes: number): string {
  if (Number.isNaN(minutes)) return '#41AD49'; // safe default
  if (minutes > 90) return '#41AD49'; // freshgreen
  if (minutes > 60) return '#A0D6A4'; // fadedgreen
  if (minutes > 30) return '#FFCC00'; // yellow
  if (minutes > 0) return '#FF9500'; // orange
  return '#FF3B30'; // red — past sunset
}
