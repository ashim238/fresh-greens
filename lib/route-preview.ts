/**
 * Route-preview card: shared types, constants, and pure helpers.
 * Used by both `app/home.tsx` (focusRouteHazardAtIndex,
 * reportRouteContextLine) and `components/RoutePreviewCard.tsx`.
 */
import type { Coordinate, Zone } from './api/zones';
import {
  distanceAlongRouteMeters,
  nearestPointOnPolyline,
  routePassesZone,
  zoneAnchor,
} from './scoring';

// ---------------------------------------------------------------------------
// Hazard chip types

// Display order: community leads — a "felt unsafe HERE" community flag is the
// most directly relevant thesis signal, then OSM-derived ones.
export const ROUTE_HAZARD_ORDER = [
  'community',
  'police',
  'lowLight',
  'wildlife',
  'road',
] as const;
export type RouteHazardType = (typeof ROUTE_HAZARD_ORDER)[number];

// [singular, plural] chip labels per hazard type.
export const ROUTE_HAZARD_LABEL: Record<RouteHazardType, readonly [string, string]> = {
  community: ['community flag', 'community flags'],
  police: ['police zone', 'police zones'],
  lowLight: ['low light zone', 'low light zones'],
  wildlife: ['wildlife zone', 'wildlife zones'],
  road: ['road condition', 'road conditions'],
};

// ---------------------------------------------------------------------------
// Safe-zone chip types

// These surface the *offset* against visible hazards — the algorithm sums
// hazards (negative) and safe zones (positive) into one net score, but only
// the negatives showed on the chip row, making the recommendation feel wrong
// when a hazard-heavier route won via more safe-tagged streets (user-flagged
// 2026-06-04: "why is the route with 2 community flags the safest?").
export const ROUTE_SAFE_ORDER = ['litStreet', 'residential'] as const;
export type RouteSafeType = (typeof ROUTE_SAFE_ORDER)[number];

export const ROUTE_SAFE_LABEL: Record<RouteSafeType, readonly [string, string]> = {
  litStreet: ['lit street', 'lit streets'],
  residential: ['residential block', 'residential blocks'],
};

// ---------------------------------------------------------------------------
// Type for a hazard position along a route

export type RouteHazardOnPath = {
  zone: Zone;
  focus: Coordinate;
  distanceAlongM: number;
};

// ---------------------------------------------------------------------------
// Classifiers

/**
 * Which hazard chip a zone contributes to, or null if it's not a charted
 * hazard. Safe-typed zones never warn. community-report and lighting only
 * chart their AVOID variants.
 */
export function routeHazardType(zone: Zone): RouteHazardType | null {
  if (zone.type === 'safe') return null;
  switch (zone.category) {
    case 'community-report':
      return zone.type === 'avoid' ? 'community' : null;
    case 'police':
      return 'police';
    case 'lighting':
      return zone.type === 'avoid' ? 'lowLight' : null;
    case 'wildlife':
      return 'wildlife';
    case 'road-condition':
      return 'road';
    default:
      return null;
  }
}

/**
 * Which safe chip a zone contributes to, or null if the zone isn't a charted
 * safe signal. The two we surface are the same `safe`-typed zones that
 * contribute the +2 to scoreRoute — lit streets and residential landuse.
 */
export function routeSafeType(zone: Zone): RouteSafeType | null {
  if (zone.type !== 'safe') return null;
  if (zone.category === 'lighting') return 'litStreet';
  if (zone.category === 'landuse') return 'residential';
  return null;
}

// ---------------------------------------------------------------------------
// Route-path queries

/** All distinct hazards of a chip type on the route, ordered start → end. */
export function routeHazardsOnPath(
  hazardType: RouteHazardType,
  routeCoordinates: Coordinate[],
  zones: Zone[],
): RouteHazardOnPath[] {
  const seen = new Set<string>();
  const hits: RouteHazardOnPath[] = [];

  for (const zone of zones) {
    if (routeHazardType(zone) !== hazardType) continue;
    if (!routePassesZone(routeCoordinates, zone)) continue;
    const anchor = zoneAnchor(zone);
    if (!anchor) continue;
    const dedupeKey = zone.canonicalHazardKey ?? zone.id;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    const focus =
      zone.category === 'community-report'
        ? anchor
        : nearestPointOnPolyline(anchor, routeCoordinates);
    hits.push({
      zone,
      focus,
      distanceAlongM: distanceAlongRouteMeters(focus, routeCoordinates),
    });
  }

  hits.sort((a, b) => a.distanceAlongM - b.distanceAlongM);
  return hits;
}

/** First zone on the route matching a safe chip type — map focus target. */
export function firstRouteSafeOnPath(
  safeType: RouteSafeType,
  routeCoordinates: Coordinate[],
  zones: Zone[],
): { zone: Zone; focus: Coordinate } | null {
  for (const zone of zones) {
    if (routeSafeType(zone) !== safeType) continue;
    if (!routePassesZone(routeCoordinates, zone)) continue;
    const anchor = zoneAnchor(zone);
    if (!anchor) continue;
    return {
      zone,
      focus: nearestPointOnPolyline(anchor, routeCoordinates),
    };
  }
  return null;
}
