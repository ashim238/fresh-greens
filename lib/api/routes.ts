// Fresh Greens — routes adapter.
//
// Calls OSRM's free public demo server (router.project-osrm.org) for real
// routing data. Falls back to the mock implementation if the request fails
// (no network, server down, no route found between origin and destination).
//
// The fallback is deliberate: the consumer (app/home.tsx) calls this
// function and gets back a Route[] either way. It can't tell whether
// the data came from a real API or the mock. That's the value of the
// adapter pattern — the consumer is decoupled from the data source.
//
// Note on OSRM: the public demo server has rate limits and isn't intended
// for production. For the thesis demo it's fine. Real launch would require
// either self-hosting OSRM or paying for Mapbox Directions / Google
// Directions — the function signature stays the same; only the body
// changes.

import type { Coordinate } from './zones';

export type RouteType = 'recommended' | 'alternate';

/**
 * Coarse maneuver kind for icon picking + instruction templating.
 * 11 buckets covering the ~95% of city/highway driving — anything
 * OSRM emits outside this set falls through to 'straight'.
 */
export type ManeuverKind =
  | 'depart'
  | 'arrive'
  | 'straight'
  | 'left'
  | 'right'
  | 'slight-left'
  | 'slight-right'
  | 'sharp-left'
  | 'sharp-right'
  | 'merge'
  | 'on-ramp'
  | 'off-ramp'
  | 'roundabout';

/**
 * One maneuver in a route. Built from an OSRM step; mock-fallback
 * routes don't carry steps (consumer falls back to "Heading toward
 * {destination}" copy when steps is undefined or empty).
 */
export type RouteStep = {
  /** Pre-built English instruction. OSRM doesn't return one; we
      template from maneuver kind + street name. */
  instruction: string;
  /** Length of this step in meters (from maneuver to next maneuver). */
  distanceMeters: number;
  /** GPS point where the maneuver happens (= step start). */
  maneuverLocation: Coordinate;
  /** Coarse classifier for icon dispatch + instruction templating. */
  kind: ManeuverKind;
};

/**
 * A candidate route from origin to destination. Note there is no `type`
 * field here — the adapter doesn't pre-classify which route is best.
 * That decision belongs to scoring (see lib/scoring.ts), not to the
 * data source.
 */
export type Route = {
  id: string;
  label: string;
  /** Approximate duration in minutes */
  estimatedMinutes: number;
  /** Total route distance in meters */
  distanceMeters: number;
  /** Polyline of lat/lng waypoints from origin to destination */
  coordinates: Coordinate[];
  /** Turn-by-turn maneuvers. Empty when adapter returned mock data
      (no OSRM steps available) — consumers should fall back to a
      neutral "Heading toward destination" copy. */
  steps?: RouteStep[];
};

/**
 * Fetches candidate routes between two points.
 *
 * Tries OSRM first; falls back to mock on any failure (network error,
 * non-OK status, no routes found). Console-warns on fallback so we can
 * see in dev when the real API isn't responding.
 */
/**
 * Maximum origin→destination straight-line distance the app will
 * attempt to route, in miles. Anything beyond this is cross-continent
 * territory the safety/daylight optimization doesn't sensibly apply
 * to — single-day road trips top out around here (LA↔SF is ~380mi,
 * NYC↔Boston ~215mi, Houston↔Dallas ~240mi). Catches the case where
 * a recent-searches entry from a prior trip (e.g. NYC) is re-tapped
 * after the user has traveled abroad (e.g. Spain) — the search query
 * itself is bbox-gated to ~140mi, but persisted entries bypass that.
 */
const MAX_ROUTE_DISTANCE_MILES = 500;

export async function getRoutesBetween(
  origin: Coordinate,
  destination: Coordinate,
): Promise<Route[]> {
  // Guard against unroutable origin/destination pairs before hitting
  // OSRM. Beyond MAX_ROUTE_DISTANCE_MILES the optimization is moot
  // (and the OSRM call would return a multi-thousand-mile polyline
  // that no one wants to drive). Caller (/home route-preview) already
  // handles the "no recommended route" empty state gracefully.
  const distance = haversineMiles(origin, destination);
  if (distance > MAX_ROUTE_DISTANCE_MILES) {
    console.warn(
      `[routes] origin→destination ${distance.toFixed(0)}mi exceeds ` +
        `${MAX_ROUTE_DISTANCE_MILES}mi guard; returning no routes.`,
    );
    return [];
  }

  try {
    const response = await fetch(buildOSRMUrl(origin, destination));
    if (!response.ok) {
      throw new Error(`OSRM HTTP ${response.status}`);
    }

    const data: OSRMResponse = await response.json();
    if (data.code !== 'Ok' || !data.routes?.length) {
      throw new Error(`OSRM returned no routes (code: ${data.code})`);
    }

    // OSRM snaps the destination to the nearest road segment in its
    // own (OpenStreetMap-derived) network, which can be a different
    // road than where the Mapbox-geocoded POI actually sits. The
    // returned geometry ends at OSRM's snap, which often visibly
    // overshoots the destination on the map. Trim each route to the
    // point closest to the requested destination so the polyline
    // ends where the user expects to arrive.
    return data.routes
      .map(parseOSRMRoute)
      .map((route) => ({
        ...route,
        coordinates: trimToDestination(route.coordinates, destination),
      }));
  } catch (error) {
    console.warn(
      '[routes] OSRM fetch failed, falling back to mock:',
      error,
    );
    return getRoutesBetweenMock(origin, destination);
  }
}

/**
 * Display style per route type.
 * - Recommended: bold freshgreen — visually claims "this is the choice."
 * - Alternate: muted gray — present but de-emphasized.
 */
export const routeColors: Record<
  RouteType,
  { stroke: string; width: number }
> = {
  recommended: { stroke: 'rgba(65, 173, 73, 0.9)', width: 5 },
  alternate: { stroke: 'rgba(128, 128, 128, 0.6)', width: 3 },
};

// --- OSRM ------------------------------------------------------------------

/**
 * Minimal type for the OSRM response shape we use. The real response has
 * far more fields (legs, steps, waypoints, etc.) — typing only what we
 * read keeps the contract tight without listing OSRM's whole API.
 */
type OSRMResponse = {
  code: string;
  routes?: OSRMRoute[];
};

type OSRMRoute = {
  /** Total duration in seconds */
  duration: number;
  /** Total distance in meters */
  distance: number;
  geometry: {
    /** GeoJSON LineString — array of [longitude, latitude] pairs */
    coordinates: [number, number][];
  };
  /** Present only when the request includes `steps=true`. A single
      multi-leg trip would split here; we always single-leg (origin →
      destination, no waypoints), so we read legs[0] only. */
  legs?: OSRMLeg[];
};

type OSRMLeg = {
  steps?: OSRMStep[];
};

type OSRMStep = {
  /** Length of this step in meters */
  distance: number;
  duration: number;
  /** Street name being entered (empty string for unnamed roads — OSM
      gaps are common on rural side-streets). */
  name: string;
  maneuver: {
    /** "turn" | "depart" | "arrive" | "continue" | "merge" | "roundabout" | ... */
    type: string;
    /** "left" | "right" | "slight left" | "slight right" |
        "sharp left" | "sharp right" | "straight" | "uturn" — present
        on most types, absent on depart/arrive/continue. */
    modifier?: string;
    /** [longitude, latitude] — the GPS point the maneuver happens at. */
    location: [number, number];
  };
};

/**
 * Trims a route's coordinate list so it ends at the polyline point
 * closest to `destination` — but only when OSRM's snap is genuinely
 * past the destination. Necessary because OSRM and Mapbox use
 * different road networks; when their endpoints disagree, OSRM's
 * geometry can overshoot the user's expected destination pin.
 *
 * Two guards prevent over-aggressive trimming:
 *
 *  1. **End-already-close short-circuit** — if the geometry's last
 *     point is within ~50m of the destination, OSRM's snap matched
 *     the requested point closely enough. Return the geometry
 *     untouched.
 *
 *  2. **Search the latter half only** — when we DO trim, search
 *     only the second half of the polyline. A route that curves
 *     near the destination mid-trip (loops, U-turns, multi-leg
 *     paths) was passing-by, not arriving; a global-closest scan
 *     would mistake that pass-by for the endpoint and cut the
 *     route in half. Constraining the search to the latter half
 *     keeps mid-trip approaches intact.
 *
 * Pure + cheap: O(n) linear scan over half the coordinate list
 * (~25-100 points on a city trip).
 *
 * Safety net: always keeps at least 2 points so the result is still
 * a renderable line.
 */
function trimToDestination(
  coordinates: Coordinate[],
  destination: Coordinate,
): Coordinate[] {
  if (coordinates.length <= 2) return coordinates;

  // Guard 1: end-already-close. Compute approximate meters from the
  // last polyline point to the destination via equirectangular
  // projection — same scale lib/scoring.ts and the mock estimator
  // use elsewhere. 50m is roughly half a city block; closer than
  // that and OSRM's snap is "right place, slightly different road."
  const last = coordinates[coordinates.length - 1];
  const latToM = 111000;
  const lngToM = 111000 * Math.cos((destination.latitude * Math.PI) / 180);
  const lastDLat = (last.latitude - destination.latitude) * latToM;
  const lastDLng = (last.longitude - destination.longitude) * lngToM;
  if (Math.hypot(lastDLat, lastDLng) < 50) return coordinates;

  // Guard 2: search the latter half only. Use squared lat/lng deltas
  // as a comparator — we only care about ordering, not actual meters.
  const startIdx = Math.floor(coordinates.length / 2);
  let bestIndex = coordinates.length - 1;
  let bestDistSq = Number.POSITIVE_INFINITY;
  for (let i = startIdx; i < coordinates.length; i++) {
    const dLat = coordinates[i].latitude - destination.latitude;
    const dLng = coordinates[i].longitude - destination.longitude;
    const distSq = dLat * dLat + dLng * dLng;
    if (distSq < bestDistSq) {
      bestDistSq = distSq;
      bestIndex = i;
    }
  }

  return coordinates.slice(0, Math.max(2, bestIndex + 1));
}

function buildOSRMUrl(origin: Coordinate, destination: Coordinate): string {
  // OSRM expects coordinates as `lng,lat;lng,lat` (longitude first — opposite
  // of our internal { latitude, longitude } convention). Easy bug to make.
  const coords = `${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}`;
  // `steps=true` requests the leg→steps array used for turn-by-turn.
  // No additional cost on OSRM's public demo; payload grows by ~1-2KB
  // per city trip (well under 100 steps typical).
  return `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson&alternatives=true&steps=true`;
}

function parseOSRMRoute(osrmRoute: OSRMRoute, index: number): Route {
  // GeoJSON coordinates are [longitude, latitude]. Convert to our
  // { latitude, longitude } shape so the rendering code doesn't have to
  // care that this came from a GeoJSON source.
  const coordinates: Coordinate[] = osrmRoute.geometry.coordinates.map(
    ([longitude, latitude]) => ({ latitude, longitude }),
  );

  // We always single-leg (origin → destination, no waypoints), so
  // legs[0].steps carries the maneuver list. Missing/empty falls
  // through to undefined — consumers must handle that case.
  const osrmSteps = osrmRoute.legs?.[0]?.steps ?? [];
  const parsed = osrmSteps
    .map(parseOSRMStep)
    .filter((s): s is RouteStep => s !== null);
  const steps: RouteStep[] | undefined = parsed.length > 0 ? parsed : undefined;

  return {
    id: `osrm-route-${index}`,
    label: index === 0 ? 'Primary route' : `Alternative ${index}`,
    estimatedMinutes: Math.max(1, Math.round(osrmRoute.duration / 60)),
    distanceMeters: osrmRoute.distance,
    coordinates,
    steps,
  };
}

function parseOSRMStep(s: OSRMStep): RouteStep | null {
  // Defensive guard: malformed OSRM responses (rare but possible from
  // the public demo server) would crash the downstream destructure.
  // Returning null lets the caller filter-out and degrade to the
  // mock fallback instead of taking down /en-route.
  if (!s?.maneuver?.location || s.maneuver.location.length < 2) return null;
  const kind = classifyManeuver(s.maneuver.type, s.maneuver.modifier);
  return {
    instruction: buildInstruction(kind, s.name ?? ''),
    distanceMeters: s.distance,
    maneuverLocation: {
      latitude: s.maneuver.location[1],
      longitude: s.maneuver.location[0],
    },
    kind,
  };
}

/**
 * Maps OSRM's (type, modifier) → ManeuverKind. Anything not enumerated
 * (e.g. "rotary", "fork", "exit roundabout") falls through to
 * 'straight' which renders the neutral NavigationArrow icon and a
 * "Continue" instruction — degraded but never broken.
 */
function classifyManeuver(type: string, modifier?: string): ManeuverKind {
  if (type === 'depart') return 'depart';
  if (type === 'arrive') return 'arrive';
  if (type === 'merge') return 'merge';
  if (type === 'on ramp') return 'on-ramp';
  if (type === 'off ramp') return 'off-ramp';
  if (type === 'roundabout' || type === 'rotary' || type === 'roundabout turn') {
    return 'roundabout';
  }
  if (type === 'turn' || type === 'end of road' || type === 'fork') {
    switch (modifier) {
      case 'left':
        return 'left';
      case 'right':
        return 'right';
      case 'slight left':
        return 'slight-left';
      case 'slight right':
        return 'slight-right';
      case 'sharp left':
        return 'sharp-left';
      case 'sharp right':
        return 'sharp-right';
    }
  }
  // 'continue', 'new name', 'notification', 'use lane', etc. — all
  // collapse to 'straight'. They're advisory (road name change, lane
  // hint) and don't require a directional cue; the neutral icon +
  // "Continue on {name}" copy is honest for all of them.
  return 'straight';
}

/**
 * Templates an English instruction from maneuver kind + street name.
 * Street name comes from OSM `name` tag; rural side-streets often
 * have none ('' empty string) — the fallback copy ("Turn left",
 * "Continue") still reads cleanly without the street.
 */
function buildInstruction(kind: ManeuverKind, name: string): string {
  const onto = name ? ` onto ${name}` : '';
  const on = name ? ` on ${name}` : '';
  switch (kind) {
    case 'depart':
      return name ? `Head out on ${name}` : 'Head out';
    case 'arrive':
      return 'Arrive at destination';
    case 'left':
      return `Turn left${onto}`;
    case 'right':
      return `Turn right${onto}`;
    case 'slight-left':
      return `Slight left${onto}`;
    case 'slight-right':
      return `Slight right${onto}`;
    case 'sharp-left':
      return `Sharp left${onto}`;
    case 'sharp-right':
      return `Sharp right${onto}`;
    case 'merge':
      return `Merge${onto}`;
    case 'on-ramp':
      return name ? `Take the on-ramp to ${name}` : 'Take the on-ramp';
    case 'off-ramp':
      return name ? `Take the exit toward ${name}` : 'Take the exit';
    case 'roundabout':
      return name ? `At the roundabout, take ${name}` : 'Enter the roundabout';
    case 'straight':
    default:
      return `Continue${on}`;
  }
}

/** Status of the current navigation pass — drives the turn-card render. */
export type NextStepStatus = 'upcoming' | 'arrived' | 'off-route';

export type NextStepInfo = {
  step: RouteStep;
  /** Step index in the source array — caller uses this to maintain
      monotonic progress (see `minStepIndex` parameter). */
  index: number;
  /** Haversine distance from user to step's maneuverLocation, meters. */
  distanceMeters: number;
  status: NextStepStatus;
};

/**
 * Picks the next maneuver the user needs to act on.
 *
 * Strategy: closest-by-GPS step from the (minStepIndex …) slice is
 * the candidate; advance to next step when user is within 30m AND
 * that step isn't `depart` at trip start.
 *
 * `minStepIndex` enforces monotonic progress — the caller tracks the
 * highest index ever reached and passes it back here, preventing
 * regression to an already-completed maneuver. Without this, GPS
 * jitter or a slow turn (red light at the corner) made the closest-
 * by-GPS pick re-select the maneuver the user just completed.
 *
 * Terminal states:
 *   - `arrived`: closest maneuver is `arrive` and user is within 30m.
 *   - `off-route`: even the closest maneuver is > 150m away — the
 *     closest-by-GPS pick is unreliable, surface a recalculating UX
 *     instead of confidently displaying a wrong maneuver.
 *
 * Returns null when steps is empty/undefined (mock fallback path) —
 * caller renders neutral "Heading toward {destination}" copy.
 */
export function findNextStep(
  steps: RouteStep[] | undefined,
  userLocation: Coordinate,
  minStepIndex: number = 0,
): NextStepInfo | null {
  if (!steps || steps.length === 0) return null;
  // Search from minStepIndex forward — never regress.
  let closestIdx = Math.min(minStepIndex, steps.length - 1);
  let closestDist = Number.POSITIVE_INFINITY;
  for (let i = Math.max(0, minStepIndex); i < steps.length; i++) {
    const d = haversineMeters(userLocation, steps[i].maneuverLocation);
    if (d < closestDist) {
      closestDist = d;
      closestIdx = i;
    }
  }
  // Off-route guard: when even the closest maneuver is far, the
  // closest-by-GPS heuristic is unreliable. 150m is a conservative
  // threshold — urban GPS accuracy is ~10-30m, suburban ~30-50m;
  // 150m says "the user is genuinely not near any maneuver point."
  if (closestDist > 150) {
    return {
      step: steps[closestIdx],
      index: closestIdx,
      distanceMeters: closestDist,
      status: 'off-route',
    };
  }
  // Arrival: closest step IS the arrive step and we're at it.
  const current = steps[closestIdx];
  if (
    closestIdx === steps.length - 1 &&
    current.kind === 'arrive' &&
    closestDist < 30
  ) {
    return {
      step: current,
      index: closestIdx,
      distanceMeters: closestDist,
      status: 'arrived',
    };
  }
  // Advance past completed maneuvers. Special-case depart: the depart
  // step's maneuverLocation IS the origin; user is always within 30m
  // at trip start, so the canonical < 30m advance would immediately
  // skip "Head out on {street}." Hold on depart until user has
  // actually moved >50m away from origin.
  const shouldAdvance =
    current.kind === 'depart' ? closestDist > 50 : closestDist < 30;
  if (shouldAdvance && closestIdx + 1 < steps.length) {
    const next = steps[closestIdx + 1];
    return {
      step: next,
      index: closestIdx + 1,
      distanceMeters: haversineMeters(userLocation, next.maneuverLocation),
      status: 'upcoming',
    };
  }
  return {
    step: current,
    index: closestIdx,
    distanceMeters: closestDist,
    status: 'upcoming',
  };
}

/** Haversine distance in meters between two GPS coords. */
function haversineMeters(a: Coordinate, b: Coordinate): number {
  return haversineMiles(a, b) * 1609.344;
}

// --- Mock fallback ---------------------------------------------------------

/**
 * Synthesizes 2 mock routes between the given points. Only used when OSRM
 * is unreachable. Same shape as the real response so consumers can't tell
 * the difference.
 */
async function getRoutesBetweenMock(
  origin: Coordinate,
  destination: Coordinate,
): Promise<Route[]> {
  await delay(150);

  const arc = arcPath(origin, destination);
  const direct = directPath(origin, destination);

  return [
    {
      id: 'mock-route-arc',
      label: 'Northern arc',
      estimatedMinutes: 9,
      distanceMeters: estimatePathMeters(arc),
      coordinates: arc,
    },
    {
      id: 'mock-route-direct',
      label: 'Direct',
      estimatedMinutes: 6,
      distanceMeters: estimatePathMeters(direct),
      coordinates: direct,
    },
  ];
}

/**
 * Sums segment lengths along a coordinate path, in meters. Same
 * equirectangular projection as lib/scoring.ts (latToMeters = 111000,
 * lngToMeters scaled by cos(latitude)). Used only for the mock fallback —
 * OSRM returns distance directly.
 */
/**
 * Haversine distance in miles between two lat/lng points. Used by the
 * MAX_ROUTE_DISTANCE_MILES guard above. Inlined here rather than
 * imported from `recommendations.ts` (which has its own private
 * `distanceMilesBetween`) — the math is small and the duplication
 * keeps `routes.ts` self-contained.
 */
function haversineMiles(a: Coordinate, b: Coordinate): number {
  const R = 3958.8; // Earth's radius in miles
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function estimatePathMeters(path: Coordinate[]): number {
  let total = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i];
    const b = path[i + 1];
    const latToMeters = 111000;
    const lngToMeters = 111000 * Math.cos((a.latitude * Math.PI) / 180);
    const dx = (b.longitude - a.longitude) * lngToMeters;
    const dy = (b.latitude - a.latitude) * latToMeters;
    total += Math.hypot(dx, dy);
  }
  return total;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function directPath(origin: Coordinate, destination: Coordinate): Coordinate[] {
  return interpolate(origin, destination, 6);
}

function arcPath(origin: Coordinate, destination: Coordinate): Coordinate[] {
  const midLat = (origin.latitude + destination.latitude) / 2;
  const midLng = (origin.longitude + destination.longitude) / 2;
  const detour: Coordinate = {
    latitude: midLat + 0.003,
    longitude: midLng,
  };

  return [
    ...interpolate(origin, detour, 4),
    ...interpolate(detour, destination, 4),
  ];
}

function interpolate(
  a: Coordinate,
  b: Coordinate,
  steps: number,
): Coordinate[] {
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps;
    return {
      latitude: a.latitude + (b.latitude - a.latitude) * t,
      longitude: a.longitude + (b.longitude - a.longitude) * t,
    };
  });
}
