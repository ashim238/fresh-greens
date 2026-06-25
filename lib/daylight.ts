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

import { colors } from '../theme/colors';

import type { Route } from './api/routes';
import type { Coordinate } from './api/zones';

/**
 * Coarse daylight band a segment falls into — separate from the
 * (finer-grained) color anchor because consumers that style the
 * polyline non-redundantly (e.g. WCAG 1.4.1 dash patterns for
 * colorblind users) need a small enumerated set, not a five-stop
 * color ramp. `day` = full daylight, `twilight` = golden hour /
 * dusk transition, `night` = past sunset.
 */
export type DaylightBand = 'day' | 'twilight' | 'night';

export type RouteSegment = {
  coordinates: Coordinate[];
  color: string;
  band: DaylightBand;
};

/**
 * react-native-maps `Polyline.lineDashPattern` per band. Pairs with
 * the daylight color anchors so colorblind users (deuteranopia,
 * tritanopia, monochromacy — collectively ~8% of men) can read the
 * day → twilight → night transitions via stroke style as well as
 * hue. Solid for day, dash-dominant for twilight, gap-dominant
 * (true dots) for night.
 *
 * Values are deliberately proportionally distant — `[8,4]` reads as
 * dashes (mark > gap), `[2,8]` reads as dots (gap >> mark). Earlier
 * draft used `[10,6]` and `[3,5]` which compressed to similar visual
 * texture at zoomed-out drive-overview scales, defeating the WCAG
 * 1.4.1 differentiation. The dash → dot progression visually mirrors
 * the daylight diminishing.
 *
 * Platform note: react-native-maps' `lineDashPattern` is honored on
 * iOS (Apple MapKit). Android support has historically been spotty;
 * the gradient color anchors carry the signal there.
 *
 * WCAG 1.4.1: color is never the only means of conveying information.
 */
export const DAYLIGHT_DASH_PATTERN: Record<DaylightBand, number[] | undefined> = {
  day: undefined,
  twilight: [8, 4],
  night: [2, 8],
};

/** Anchor colors for the route daylight legend — left-to-right = more → less light. */
export const DAYLIGHT_LEGEND_ANCHORS = [
  { band: 'day' as const, color: colors.daylightDawn },
  { band: 'twilight' as const, color: colors.daylightDusk },
  { band: 'night' as const, color: colors.daylightNight },
];

/**
 * VoiceOver label for the daylight legend strip. Pairs with the visual
 * pattern swatches (solid → dashed → dotted) so colorblind users get
 * the dash-density cue in text as well as on the map polyline.
 */
export const DAYLIGHT_LEGEND_A11Y_LABEL =
  'Daylight along your route. Colors warm to cool as light fades. On the map, solid is full daylight, dashed is twilight, dotted is after dark. Denser dashes mean less light.';

/** One-line route-loaded hint (en-route) — complements the map polyline. */
export const DAYLIGHT_ROUTE_PATTERN_A11Y =
  'Route line uses color and dashes for daylight: solid is brightest; denser dashes mean darker segments.';

/**
 * Splits a route's coordinates into colored segments. The color of each
 * segment represents how much daylight remains when (approximately) the
 * driver reaches that segment.
 *
 * @param route — the route polyline to gradient
 * @param departureTime — when the trip starts; defaults to now. Future-
 *   facing for the "Schedule for 7:38 AM" feature where users can pick
 *   a departure that maximizes daylight.
 * @param cloudCoverPct — optional cloud cover 0–100; passed through to
 *   colorForMinutesToSunset so overcast arrivals render dimmer. Omitting
 *   it leaves segment colors identical to the pre-cloud behavior.
 */
export function gradientSegments(
  route: Route,
  departureTime: Date = new Date(),
  cloudCoverPct?: number,
): RouteSegment[] {
  const points = route.coordinates;
  if (points.length < 2) return [];

  // 15 segments (was 5) — RN-Maps Polyline only supports a single
  // color per overlay, so the daylight gradient is a stepped
  // approximation. Five segments left visible color jumps; fifteen
  // makes each step ~1/3 the size, which the eye reads as a smooth
  // gradient at typical map zoom. Cost is 3× the native Polyline
  // overlays per route, still cheap on iOS MapKit.
  const segmentCount = 15;
  const pointsPerSegment = Math.max(
    2,
    Math.ceil(points.length / segmentCount),
  );
  const segments: RouteSegment[] = [];

  for (let i = 0; i < segmentCount; i++) {
    // -1 so adjacent segments share a boundary coordinate, preventing
    // visible gaps between polylines at segment seams.
    const start = i * (pointsPerSegment - 1);
    if (start >= points.length - 1) break;

    // The naïve `end = start + pointsPerSegment` math leaves the last
    // ~stride points uncovered (segmentCount × stride < points.length
    // when stride = pointsPerSegment - 1). Detect "no more segments
    // will fit after this one" and stretch this segment's end to the
    // polyline's true end so the route always draws all the way to
    // the destination.
    const nextStart = (i + 1) * (pointsPerSegment - 1);
    const isFinalSegment =
      i === segmentCount - 1 || nextStart >= points.length - 1;
    const end = isFinalSegment
      ? points.length
      : Math.min(start + pointsPerSegment, points.length);

    const segmentCoords = points.slice(start, end);

    // Estimated arrival time at this segment's midpoint: departure +
    // (segment's fractional position * total trip duration).
    // (i + 0.5) targets the middle of segment i, not its start.
    const segmentProgress = (i + 0.5) / segmentCount;
    const segmentTime = new Date(
      departureTime.getTime() +
        segmentProgress * route.estimatedMinutes * 60_000,
    );

    // Sunset + sunrise are computed at the segment's geometric midpoint.
    // Routes mostly stay in one general area, but for cross-region trips
    // this matters — solar times vary by longitude (and by latitude in
    // winter).
    const midpoint = segmentCoords[Math.floor(segmentCoords.length / 2)];
    const sunTimes = SunCalc.getTimes(
      segmentTime,
      midpoint.latitude,
      midpoint.longitude,
    );

    // Pre-dawn departures must be treated as night, not as "many hours
    // until today's sunset." SunCalc returns events for the calendar day
    // passed in, so a 1 AM segment computes against today's 7:30 PM
    // sunset and reports +1110 minutes — which the band table would
    // mistakenly read as full daylight. Short-circuit: if we're before
    // today's sunrise, the segment is night.
    const isPreDawn = segmentTime.getTime() < sunTimes.sunrise.getTime();
    const minutesToSunset = isPreDawn
      ? -1
      : (sunTimes.sunset.getTime() - segmentTime.getTime()) / 60_000;

    segments.push({
      coordinates: segmentCoords,
      color: colorForMinutesToSunset(minutesToSunset, cloudCoverPct),
      band: bandForMinutesToSunset(minutesToSunset),
    });
  }

  return segments;
}

/**
 * Shared band thresholds — single source of truth so the band
 * classifier and the color-ramp picker can't drift out of sync.
 */
const DAY_THRESHOLD_MIN = 60;
const TWILIGHT_THRESHOLD_MIN = 0;

/**
 * Coarse classifier — 3-band reduction of the 5-stop color ramp for
 * styling that needs a small enumerated set. Pre-dawn segments
 * already carry `minutes = -1`, so they fall into `night` here too.
 * NaN (polar extreme edge case) defaults to `day` to match
 * `colorForMinutesToSunset`.
 *
 * Exported so the band logic is unit-testable independently of
 * `gradientSegments`.
 */
export function bandForMinutesToSunset(minutes: number): DaylightBand {
  if (Number.isNaN(minutes)) return 'day';
  if (minutes > DAY_THRESHOLD_MIN) return 'day';
  if (minutes > TWILIGHT_THRESHOLD_MIN) return 'twilight';
  return 'night';
}

/** Cloud % at/above which a daytime arrival reads as "low light". */
const LOW_LIGHT_CLOUD_PCT = 60;

/**
 * Short arrival-light descriptor for the route-preview conditions line.
 * `day` + heavy cloud reads as "low light" (overcast dims daylight);
 * twilight/night are cloud-independent. Returns null when band is
 * unknown so the caller can fall back to the plain conditions copy.
 */
export function arrivalLightLabel(
  band: DaylightBand,
  cloudCoverPct?: number,
): string | null {
  switch (band) {
    case 'day':
      return cloudCoverPct != null && cloudCoverPct >= LOW_LIGHT_CLOUD_PCT
        ? 'arriving in low light'
        : 'arriving in daylight';
    case 'twilight':
      return 'arriving at dusk';
    case 'night':
      return 'arriving after dark';
    default:
      return null;
  }
}

/** Max desaturation at 100% cloud — capped so it never goes fully gray. */
const MAX_CLOUD_DESATURATION = 0.65;

/** Blend a #RRGGBB hex toward its luminance-gray by `amount` (0..1). */
function desaturateHex(hex: string, amount: number): string {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return hex;
  const r = parseInt(m[1], 16), g = parseInt(m[2], 16), b = parseInt(m[3], 16);
  const gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
  const mix = (c: number) => Math.round(c + (gray - c) * amount);
  const h = (c: number) => mix(c).toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}

/** Cloud % → desaturation amount, capped. Exported (the card strip uses it directly). */
export function cloudDesaturate(hex: string, cloudCoverPct?: number): string {
  if (cloudCoverPct == null || cloudCoverPct <= 0) return hex;
  const amount = (Math.min(cloudCoverPct, 100) / 100) * MAX_CLOUD_DESATURATION;
  return desaturateHex(hex, amount);
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
 * day/night edge case at extreme latitudes). The NaN fallback is also
 * routed through cloudDesaturate — an overcast polar-day sky is still
 * dimmer than a clear one.
 *
 * @param cloudCoverPct — optional cloud cover 0–100; omitting it or
 *   passing 0 preserves the original (no-cloud) color exactly.
 */
function colorForMinutesToSunset(minutes: number, cloudCoverPct?: number): string {
  // Anchors come from the theme (daylightDawn / daylightDusk /
  // daylightNight) so the polyline and the /home legend reference one
  // source. The two blend stops (#E19551, #784961) are mathematical
  // interpolations between the anchors and stay inline — they exist
  // only to smooth the gradient, not as named design colors.
  let base: string;
  if (Number.isNaN(minutes)) base = colors.daylightDawn; // safe default — full daylight
  else if (minutes > 90) base = colors.daylightDawn;     // strip start
  else if (minutes > 60) base = '#E19551';               // dawn → dusk blend
  else if (minutes > 30) base = colors.daylightDusk;     // strip middle
  else if (minutes > 0) base = '#784961';                // dusk → night blend
  else base = colors.daylightNight;                      // strip end — past sunset
  return cloudDesaturate(base, cloudCoverPct);
}

/**
 * Returns a departure time that puts more of the route in daylight than
 * leaving now would, or `null` if no near-future improvement exists.
 *
 * v1 rule: if the user is currently before sunrise at the route's
 * starting coordinate, suggest sunrise + 15 minutes — a small buffer
 * past the horizon so the trip starts visually past the dim band, even
 * though scoring.ts still treats this as part of the dawn ±30-min
 * wildlife window. The trade-off is intentional: clearing the wildlife
 * window entirely would mean +31min, which begins to feel like a
 * different trip rather than "leave in a bit."
 *
 * Capped to a 3-hour look-ahead and a 5-minute floor: beyond 3 hours,
 * the suggestion stops feeling like "leave in a bit"; under 5 min, the
 * math is real but the suggestion ("schedule for 4 minutes from now")
 * is silly. Both bounds are product calls, not physics.
 *
 * Mid-day, late-afternoon, and post-sunset departures all return null:
 * either the route is already in full daylight, or the only "fix"
 * would be tomorrow morning — out of scope for the in-line chip.
 */
export function suggestedDepartureForDaylight(
  route: Route,
  now: Date = new Date(),
): Date | null {
  const start = route.coordinates[0];
  if (!start) return null;

  const sunTimes = SunCalc.getTimes(now, start.latitude, start.longitude);
  const sunrise = sunTimes.sunrise;
  if (Number.isNaN(sunrise.getTime())) return null;

  const suggested = new Date(sunrise.getTime() + 15 * 60_000);
  const minutesUntil = (suggested.getTime() - now.getTime()) / 60_000;

  if (minutesUntil < 5 || minutesUntil > 180) return null;

  return suggested;
}
