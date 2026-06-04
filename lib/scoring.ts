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
import { pathLengthMeters, sampleAlongPath } from './geo';

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
 * Score a single route against the active zones. Higher is better.
 *
 * Two passes, because a route is sampled at the Mapbox/OSRM waypoints —
 * which are SPARSE on straight blocks — and the two zone shapes need
 * different treatment to survive that:
 *
 *   - POINT zones (community reports + OSM police nodes) are scored ONCE
 *     per zone, by the reported spot's distance to the route LINE (see
 *     `routePassesZone`). A point is a tiny target, so the old "is any
 *     waypoint within 30m of the point?" test let a route slip right past
 *     a report whenever its waypoints fell >30m to either side — exactly
 *     the case where a felt-unsafe report on a straight stretch failed to
 *     demote the route. Measuring to the line fixes it, and scoring once
 *     keeps a single spot from being double-counted by however many
 *     waypoints happen to cluster near it (a single reported spot is
 *     binary — passing it is passing it, regardless of route length).
 *
 *   - POLYGON / POLYLINE zones (areas, unlit streets) stay per-waypoint,
 *     so the penalty scales with how much of the route is exposed (a route
 *     that spends more length in a dark/avoid zone is penalized more).
 *     These are large targets the route reliably samples, so waypoint
 *     sparsity isn't the acute problem it is for points.
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

  // Point zones — once per zone, line-based.
  for (const zone of zones) {
    if (zone.geometry !== 'point' || zone.coordinates.length === 0) continue;
    if (routePassesZone(route.coordinates, zone)) {
      total +=
        SCORE_WEIGHTS[zone.type] *
        categoryMultiplier(zone.category, zone.coordinates[0], departureTime);
    }
  }

  // Area / street zones — per-waypoint, exposure-proportional.
  for (const point of route.coordinates) {
    for (const zone of zones) {
      if (zone.geometry === 'point') continue;
      if (isPointInZone(point, zone)) {
        total +=
          SCORE_WEIGHTS[zone.type] *
          categoryMultiplier(zone.category, point, departureTime);
      }
    }
  }

  return total;
}

/**
 * Whether a point (user location, route waypoint, etc.) falls inside
 * or near enough to a zone to count as "in" it. Geometry-dispatch:
 * polygon → ray-casting; polyline → near-line proximity; point →
 * point-to-point distance. Shared between `scoreRoute`'s per-waypoint
 * scoring loop and /en-route's live zone-entry detection (driving the
 * En-Route Zone extended-pill).
 */
export function isPointInZone(point: Coordinate, zone: Zone): boolean {
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
 * Whether a route's PATH passes through `zone` — the route-level question
 * `scoreRoute` and `routeConditions` actually ask (vs. `isPointInZone`,
 * which answers it for one point).
 *
 * For POINT zones (community reports, OSM police nodes) this measures the
 * reported spot's distance to the route LINE: `isPointNearPolyline` is
 * point-to-segment, so it follows the route's true geometry and is immune
 * to how sparse the Mapbox/OSRM waypoints are — a report sitting on a
 * straight block between two distant waypoints is still caught.
 *
 * For AREA/STREET zones, /home's preview polyline can be very sparse on
 * long trips, so we also sample the route line every ~300m (capped) before
 * testing `isPointInZone` — otherwise lit=no segments and polygons between
 * waypoints never light up the orange chips.
 */
const ROUTE_ZONE_TEST_MAX_SAMPLES = 400;
const ROUTE_ZONE_TEST_SPACING_METERS = 300;

export function routePointsForZoneTest(routeCoordinates: Coordinate[]): Coordinate[] {
  if (routeCoordinates.length === 0) return routeCoordinates;
  const len = pathLengthMeters(routeCoordinates);
  if (len === 0) return routeCoordinates;
  const spacing = Math.max(
    ROUTE_ZONE_TEST_SPACING_METERS,
    len / ROUTE_ZONE_TEST_MAX_SAMPLES,
  );
  const dense = sampleAlongPath(
    routeCoordinates,
    spacing,
    ROUTE_ZONE_TEST_MAX_SAMPLES,
  );
  return dense.length > 0 ? dense : routeCoordinates;
}

export function routePassesZone(
  routeCoordinates: Coordinate[],
  zone: Zone,
): boolean {
  if (zone.geometry === 'point') {
    const line = routePointsForZoneTest(routeCoordinates);
    return (
      zone.coordinates.length > 0 &&
      isPointNearPolyline(
        zone.coordinates[0],
        line,
        POINT_PROXIMITY_METERS,
      )
    );
  }
  const samples = routePointsForZoneTest(routeCoordinates);
  return samples.some((point) => isPointInZone(point, zone));
}

/** Safety-condition categories surfaced as chips in the route comparison. */
export type RouteCondition =
  | 'community'
  | 'low-light'
  | 'wildlife'
  | 'police'
  | 'road';

/** Maps a Zone category to a comparison condition. `community-report`
    charts as 'community' (felt-unsafe / incident — the thesis's
    most directly relevant signal); landuse/park don't chart. Safe-typed
    zones are excluded by the caller, so a lit=yes street or a felt-WELCOME
    report never shows as a warning. */
function conditionForCategory(
  category: Zone['category'],
): RouteCondition | null {
  switch (category) {
    case 'community-report':
      return 'community';
    case 'lighting':
      return 'low-light';
    case 'wildlife':
      return 'wildlife';
    case 'police':
      return 'police';
    case 'road-condition':
      return 'road';
    default:
      return null;
  }
}

/**
 * The deduped set of safety conditions a route passes near — powers the
 * comparison-sheet chips. Reuses `routePassesZone` (the same route-level
 * test `scoreRoute` uses), so chips and score stay consistent — including
 * the line-based detection that catches a point report on a straight block
 * the per-waypoint test would miss. Safe-typed zones are skipped, so a
 * well-lit (lit=yes) street or a felt-welcome / black-owned report never
 * charts as a warning. Pure. Order is stable: community, low-light,
 * wildlife, police, road (community-flagged leads — see RouteCondition).
 */
export function routeConditions(route: Route, zones: Zone[]): RouteCondition[] {
  const present = new Set<RouteCondition>();
  for (const zone of zones) {
    if (zone.type === 'safe') continue;
    const condition = conditionForCategory(zone.category);
    if (!condition || present.has(condition)) continue;
    if (routePassesZone(route.coordinates, zone)) {
      present.add(condition);
    }
  }
  const order: RouteCondition[] = [
    'community',
    'low-light',
    'wildlife',
    'police',
    'road',
  ];
  return order.filter((c) => present.has(c));
}

/**
 * Approximate the on-the-ground length of a zone, in miles. Used by
 * the En-Route Zone extended-pill to surface "For X mi." copy.
 *
 *   polyline → sum of segment distances (true polyline length).
 *   polygon  → bounding-box diagonal. A rough proxy — a long thin
 *              polygon over-estimates, a square under-estimates —
 *              but the pill's purpose is order-of-magnitude
 *              reassurance ("this is a long zone vs. a short one"),
 *              not survey-grade measurement.
 *   point    → 0. Single-point zones don't have a length; callers
 *              should not render them as En-Route Zone markers.
 */
export function zoneLengthMiles(zone: Zone): number {
  switch (zone.geometry) {
    case 'polyline': {
      let totalMeters = 0;
      for (let i = 1; i < zone.coordinates.length; i++) {
        totalMeters += pointToPointDistanceMeters(
          zone.coordinates[i - 1],
          zone.coordinates[i],
        );
      }
      return totalMeters / 1609.344;
    }
    case 'polygon': {
      if (zone.coordinates.length === 0) return 0;
      let minLat = Infinity;
      let maxLat = -Infinity;
      let minLng = Infinity;
      let maxLng = -Infinity;
      for (const p of zone.coordinates) {
        minLat = Math.min(minLat, p.latitude);
        maxLat = Math.max(maxLat, p.latitude);
        minLng = Math.min(minLng, p.longitude);
        maxLng = Math.max(maxLng, p.longitude);
      }
      const diagonalMeters = pointToPointDistanceMeters(
        { latitude: minLat, longitude: minLng },
        { latitude: maxLat, longitude: maxLng },
      );
      return diagonalMeters / 1609.344;
    }
    case 'point':
      return 0;
  }
}

/**
 * Coordinate at the visual "middle" of a zone — where an En-Route
 * Zone marker should anchor. Polyline midpoint by index, polygon
 * centroid by mean coordinates, point as-is.
 */
export function zoneAnchor(zone: Zone): Coordinate | null {
  if (zone.coordinates.length === 0) return null;
  switch (zone.geometry) {
    case 'polyline':
      return zone.coordinates[Math.floor(zone.coordinates.length / 2)];
    case 'polygon': {
      let sumLat = 0;
      let sumLng = 0;
      for (const p of zone.coordinates) {
        sumLat += p.latitude;
        sumLng += p.longitude;
      }
      return {
        latitude: sumLat / zone.coordinates.length,
        longitude: sumLng / zone.coordinates.length,
      };
    }
    case 'point':
      return zone.coordinates[0];
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
    score: scoreRoute(
      route,
      [...zones, ...(route.mapboxIncidentZones ?? [])],
      departureTime,
    ),
  }));

  scored.sort((a, b) => b.score - a.score);

  return scored.map((route, index) => ({
    ...route,
    type: index === 0 ? ('recommended' as const) : ('alternate' as const),
  }));
}

/**
 * Hazard categories surfaced on /en-route's turn card and /home route-
 * preview markers. Community reports collapse into a single
 * 'community-alert' bucket since the icon distinction (felt-unsafe vs
 * incident) doesn't read mid-drive at 24pt. Police is the lowest
 * HAZARD_SEVERITY — presence awareness on the turn card, not alarm.
 */
export type HazardCategory =
  | 'lighting'
  | 'road-condition'
  | 'wildlife'
  | 'community-alert'
  | 'police';

/**
 * Per-category severity for ordering when more hazards cross threshold
 * than a turn card can show. Higher = worse = wins the slot. All five
 * categories have distinct values — ties would resolve by zone-iteration
 * order, which is data-dependent and non-deterministic from the user's
 * perspective. Police sits at the bottom: presence awareness, not an
 * immediate hazard, so when more than 2 hazards cluster near a turn,
 * police yields the slot to anything more urgent (a deer/pothole/dark
 * stretch wins).
 */
const HAZARD_SEVERITY: Record<HazardCategory, number> = {
  'community-alert': 5, // people-reported, most immediate
  'wildlife': 4,        // time-sensitive at dawn/dusk
  'road-condition': 3,  // surface damage / construction; chronic but specific
  'lighting': 2,        // chronic, contextual
  'police': 1,          // presence awareness, not action-required
};

const HAZARD_PROXIMITY_METERS = 200;

/**
 * Which hazard categories cluster near a given turn point, sorted
 * worst-first. Used by /en-route's turn card to surface up to two
 * hazard glyphs when the next turn passes through (or near) flagged
 * zones — a heads-up that "this turn is on your safe route, but be
 * aware."
 *
 * v1 trigger: any zone of caution/avoid type within
 * `HAZARD_PROXIMITY_METERS` of the turn surfaces its category. Future
 * refinement (per docs/architecture.md): a saturation threshold (≥N zones, not
 * just one) so a single distant marker doesn't trigger the symbol.
 *
 * Caller is responsible for capping the returned list — the turn card
 * shows at most 2 (three icons degrades into noise mid-drive). The
 * sort here puts the worst category first, so `result.slice(0, 2)`
 * does the right thing.
 */
export function hazardsNearTurn(turn: Coordinate, zones: Zone[]): HazardCategory[] {
  const present = new Set<HazardCategory>();

  for (const zone of zones) {
    if (zone.type === 'safe') continue; // only caution/avoid surface
    if (!isWaypointInProximity(turn, zone)) continue;
    const category = zoneToHazardCategory(zone);
    if (category) present.add(category);
  }

  return Array.from(present).sort(
    (a, b) => HAZARD_SEVERITY[b] - HAZARD_SEVERITY[a],
  );
}

/**
 * Looser version of `isWaypointInZone` — same dispatch, but the
 * point/polyline thresholds expand to `HAZARD_PROXIMITY_METERS`. The
 * scoring threshold (30m for points, 20m for polylines) asks "is this
 * waypoint *on* the zone?"; the hazard threshold asks "is the zone
 * *near* this turn?" — a wider window.
 */
function isWaypointInProximity(turn: Coordinate, zone: Zone): boolean {
  switch (zone.geometry) {
    case 'polygon':
      return isPointInPolygon(turn, zone.coordinates);
    case 'polyline':
      return isPointNearPolyline(
        turn,
        zone.coordinates,
        HAZARD_PROXIMITY_METERS,
      );
    case 'point':
      if (zone.coordinates.length === 0) return false;
      return (
        pointToPointDistanceMeters(turn, zone.coordinates[0]) <
        HAZARD_PROXIMITY_METERS
      );
  }
}

/**
 * Map a zone's category → hazard category, or null if the zone doesn't
 * surface as a hazard glyph (landuse, park, safe community reports).
 * Community reports collapse `felt-unsafe` and `incident` subcategories
 * into the single `community-alert` bucket; the more granular distinction
 * belongs on the map markers, not on the turn card.
 *
 * Police: returns `'police'` so a stationary OSM precinct within
 * HAZARD_PROXIMITY_METERS of a turn surfaces a presence-awareness glyph
 * on the turn card. The earlier rev returned null on the theory that
 * police is stationary and not "watch out, this is on your route" —
 * correct when the alternative was a blanket warning, but it left a real
 * gap as a driver approaches a precinct. With the 200m gate already in
 * place and `police: 1` at the bottom of HAZARD_SEVERITY (so it yields
 * the slot to anything more urgent), this is awareness without alarm.
 * Forward-looking: today the data is static OSM precincts; the SURFACE
 * is the same when live police-location data lands, the definition of a
 * "police zone" just widens.
 */
export function zoneToHazardCategory(zone: Zone): HazardCategory | null {
  switch (zone.category) {
    case 'police':
      return 'police';
    case 'lighting':
      return 'lighting';
    case 'road-condition':
      return 'road-condition';
    case 'wildlife':
      return 'wildlife';
    case 'community-report':
      if (
        zone.reportCategoryId === 'felt-unsafe' ||
        zone.reportCategoryId === 'incident'
      ) {
        return 'community-alert';
      }
      return null;
    default:
      return null;
  }
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
export function isPointNearPolyline(
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

/**
 * Snap `point` to the nearest point on `polyline`. Walks each segment,
 * projects the point onto it (clamped to the segment's extent), and
 * returns the closest projection. Used by the route-preview hazard
 * markers to place a zone glyph ON the route line rather than at the
 * zone's own anchor (which can sit off to the side of the road).
 *
 * Empty / single-vertex polyline → returns the input (defensive; callers
 * should gate on route presence before drawing). Pure.
 */
export function nearestPointOnPolyline(
  point: Coordinate,
  polyline: Coordinate[],
): Coordinate {
  if (polyline.length === 0) return point;
  if (polyline.length === 1) return polyline[0];

  // Equirectangular projection — same trick the segment-distance helper
  // uses (1° lat ≈ 111,000m; 1° lng ≈ 111,000m × cos(lat)). Pick the
  // scale from `point.latitude` so the projection is consistent across
  // segments at city scale (matters less for the snap itself than for
  // sub-meter agreement with pointToSegmentDistanceMeters).
  const latToMeters = 111000;
  const lngToMeters = 111000 * Math.cos((point.latitude * Math.PI) / 180);

  let bestDistSq = Infinity;
  let best: Coordinate = polyline[0];

  for (let i = 0; i < polyline.length - 1; i++) {
    const a = polyline[i];
    const b = polyline[i + 1];

    // Meters relative to `a`.
    const px = (point.longitude - a.longitude) * lngToMeters;
    const py = (point.latitude - a.latitude) * latToMeters;
    const sx = (b.longitude - a.longitude) * lngToMeters;
    const sy = (b.latitude - a.latitude) * latToMeters;

    const segLenSq = sx * sx + sy * sy;
    // Project + clamp to [0, 1] so we stay inside the segment, not on
    // its infinite line extension.
    const t = segLenSq === 0 ? 0 : Math.max(0, Math.min(1, (px * sx + py * sy) / segLenSq));
    const cx = sx * t;
    const cy = sy * t;

    const dx = px - cx;
    const dy = py - cy;
    const distSq = dx * dx + dy * dy;

    if (distSq < bestDistSq) {
      bestDistSq = distSq;
      // Convert closest-point back to lat/lng. cx/cy are meters from
      // `a`; reverse the scale.
      best = {
        latitude: a.latitude + cy / latToMeters,
        longitude: a.longitude + cx / lngToMeters,
      };
    }
  }
  return best;
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
