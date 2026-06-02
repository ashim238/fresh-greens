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
      if (isPointInZone(point, zone)) {
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

/** Safety-condition categories surfaced as chips in the route comparison. */
export type RouteCondition = 'low-light' | 'wildlife' | 'police' | 'road';

/** Maps a Zone category to a comparison condition (only the four safety
    factors the thesis names; landuse/park/community-report are not charted). */
function conditionForCategory(
  category: Zone['category'],
): RouteCondition | null {
  switch (category) {
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
 * comparison-sheet chips. Reuses `isPointInZone` (the same proximity
 * dispatch `scoreRoute` uses), so chips and score stay consistent. Pure.
 * Order is stable: low-light, wildlife, police, road.
 */
export function routeConditions(route: Route, zones: Zone[]): RouteCondition[] {
  const present = new Set<RouteCondition>();
  for (const zone of zones) {
    const condition = conditionForCategory(zone.category);
    if (!condition || present.has(condition)) continue;
    if (route.coordinates.some((point) => isPointInZone(point, zone))) {
      present.add(condition);
    }
  }
  const order: RouteCondition[] = ['low-light', 'wildlife', 'police', 'road'];
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
    score: scoreRoute(route, zones, departureTime),
  }));

  scored.sort((a, b) => b.score - a.score);

  return scored.map((route, index) => ({
    ...route,
    type: index === 0 ? ('recommended' as const) : ('alternate' as const),
  }));
}

/**
 * Hazard categories surfaced on /en-route's turn card. Subset of zone
 * categories — police is intentionally excluded (it's a stationary
 * caution marker, not a "watch out, this is on your route" symbol).
 * Community reports collapse into a single 'community-alert' bucket
 * since the icon distinction (felt-unsafe vs incident) doesn't read
 * mid-drive at 24pt.
 */
export type HazardCategory =
  | 'lighting'
  | 'road-condition'
  | 'wildlife'
  | 'community-alert';

/**
 * Per-category severity for ordering when more hazards cross threshold
 * than a turn card can show. Higher = worse = wins the slot. All four
 * categories have distinct values — ties would resolve by zone-
 * iteration order, which is data-dependent and non-deterministic from
 * the user's perspective.
 */
const HAZARD_SEVERITY: Record<HazardCategory, number> = {
  'community-alert': 4, // people-reported, most immediate
  'wildlife': 3,        // time-sensitive at dawn/dusk
  'road-condition': 2,  // surface damage / construction; chronic but specific
  'lighting': 1,        // chronic, contextual
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
 * surface as a hazard glyph (police, landuse, park, safe community
 * reports). Community reports collapse `felt-unsafe` and `incident`
 * subcategories into the single `community-alert` bucket; the more
 * granular distinction belongs on the map markers, not on the turn card.
 */
export function zoneToHazardCategory(zone: Zone): HazardCategory | null {
  switch (zone.category) {
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
