// Fresh Greens — routes adapter.
//
// Four-tier source ladder, in priority order:
//   1. Mapbox Directions API (driving-traffic profile + banner_instructions)
//      — primary; unlocks lane guidance, traffic-aware routing
//   2. OSRM public demo server — automatic fallback (network error, missing
//      Mapbox token, Mapbox quota/5xx)
//   3. AsyncStorage cache — replay of the last successful network fetch
//      when both Mapbox and OSRM fail (handles rural dead-signal mid-trip)
//   4. Mock route — synthetic catastrophe-fallback so the UI never gets
//      an empty state
//
// The consumer (app/home.tsx, app/en-route.tsx) gets back a RoutesResult
// with a `source` tag. They use the tag to decide whether to show the
// "Offline route" / "Demo route" pill — but the Route[] shape itself is
// identical across all four tiers (that's the adapter-pattern payoff).
//
// Note on tokens: Mapbox uses `process.env.EXPO_PUBLIC_MAPBOX_TOKEN`
// (same env var as the Search Box adapter in lib/api/places.ts). When
// absent, the Mapbox tier is skipped and OSRM becomes effective primary.

import { loadActiveRoute, saveActiveRoute } from './route-cache';
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
 * Walks the source ladder top-down: Mapbox → OSRM → cache → mock.
 * Each tier's failure (network error, non-OK status, no routes
 * returned, exception) falls through to the next. Console-warns on
 * each tier's failure so dev can see which tier resolved.
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

/**
 * Where a route came from. The source ladder in getRoutesBetween:
 *   - 'mapbox' — primary network source (lanes, banner instructions)
 *   - 'osrm'   — automatic fallback when Mapbox unreachable/quota
 *   - 'cache'  — AsyncStorage replay when both network sources fail
 *   - 'mock'   — synthetic catastrophe-fallback
 *
 * Drives the /en-route UX: 'mapbox' and 'osrm' are both live data
 * (no offline pill); 'cache' and 'mock' surface the offline/demo
 * pill so the driver knows there's no live recalculation. A
 * background poll attempts the primary Mapbox tier periodically
 * to swap non-mapbox sources back to live data non-jarringly.
 */
export type RouteSource = 'mapbox' | 'osrm' | 'cache' | 'mock';

export type RoutesResult = {
  routes: Route[];
  source: RouteSource;
  /** Present only when source === 'cache' — how stale the cached
      routes are in ms. Lets /en-route surface "Offline route · 3h
      old" so the driver knows the data isn't live. */
  cacheAgeMs?: number;
};

export async function getRoutesBetween(
  origin: Coordinate,
  destination: Coordinate,
): Promise<RoutesResult> {
  // Guard against unroutable origin/destination pairs before hitting
  // the routing ladder. Beyond MAX_ROUTE_DISTANCE_MILES the optimization
  // is moot (and the routing API would return a multi-thousand-mile
  // polyline that no one wants to drive). Caller (/home route-preview)
  // already handles the "no recommended route" empty state gracefully.
  // The 'mapbox' source on the empty result is nominal — consumers
  // don't read `source` when `routes` is empty.
  const distance = haversineMiles(origin, destination);
  if (distance > MAX_ROUTE_DISTANCE_MILES) {
    console.warn(
      `[routes] origin→destination ${distance.toFixed(0)}mi exceeds ` +
        `${MAX_ROUTE_DISTANCE_MILES}mi guard; returning no routes.`,
    );
    return { routes: [], source: 'mapbox' };
  }

  // Tier 1 — Mapbox Directions. Primary network source; richer step
  // metadata (banner_instructions for lanes in PR 2) and `driving-
  // traffic` profile uses live traffic. Falls through to OSRM on any
  // failure (network error, non-OK status, no routes, missing token).
  const mapboxUrl = buildMapboxUrl(origin, destination);
  if (mapboxUrl) {
    try {
      const response = await fetch(mapboxUrl);
      if (response.ok) {
        const data = await response.json();
        if (data?.code === 'Ok' && data?.routes?.length) {
          const routes = data.routes.map((r: any, idx: number) =>
            parseMapboxRoute(r, idx, destination),
          );
          if (routes.length > 0) {
            // Best-effort cache write — same semantics as the OSRM
            // tier below. saveActiveRoute has its own try/catch + warn,
            // so no redundant outer .catch needed.
            void saveActiveRoute(routes, destination);
            return { routes, source: 'mapbox' };
          }
        } else {
          console.warn(
            `[routes] Mapbox returned no routes (code: ${data?.code ?? 'unknown'}); falling through to OSRM.`,
          );
        }
      } else {
        console.warn(
          `[routes] Mapbox HTTP ${response.status}; falling through to OSRM.`,
        );
      }
    } catch (err) {
      console.warn('[routes] Mapbox fetch failed, falling through to OSRM:', err);
    }
  }

  // Tier 2 — OSRM. Free public demo, no lanes, no traffic data, but
  // a reliable structural fallback. Same try/catch/cache/mock ladder
  // it had before the Mapbox tier landed on top.
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
    const routes = data.routes
      .map(parseOSRMRoute)
      .map((route) => ({
        ...route,
        coordinates: trimToDestination(route.coordinates, destination),
      }));
    // Best-effort cache write — saveActiveRoute already has its own
    // try/catch + warn log, so no redundant outer .catch needed.
    // This is what enables the offline-fallback path: every
    // successful OSRM fetch warms the cache so a subsequent
    // dead-signal /en-route mount has data to hydrate from.
    void saveActiveRoute(routes, destination);
    return { routes, source: 'osrm' };
  } catch (error) {
    console.warn(
      '[routes] OSRM fetch failed, trying cache:',
      error,
    );
    const cached = await loadActiveRoute(destination);
    if (cached) {
      console.info(
        `[routes] hydrated from cache (age: ${Math.round(cached.ageMs / 1000)}s)`,
      );
      return {
        routes: cached.routes,
        source: 'cache',
        cacheAgeMs: cached.ageMs,
      };
    }
    console.warn('[routes] no cache for this destination, falling back to mock');
    const mockRoutes = await getRoutesBetweenMock(origin, destination);
    return { routes: mockRoutes, source: 'mock' };
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

// --- Network adapters (OSRM + Mapbox) -------------------------------------

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

/**
 * Mapbox Directions v5 URL for `driving-traffic` profile.
 *
 *   - `geometries=geojson` + `overview=full` returns the polyline as
 *     a GeoJSON LineString matching OSRM's shape — parseMapboxStep
 *     and parseOSRMStep populate Route.coordinates identically.
 *   - `steps=true` enables turn-by-turn step data.
 *   - `banner_instructions=true` enables lane data (PR 2 reads it;
 *     enabling here keeps the URL stable across PRs and avoids a
 *     second adapter rev when PR 2 lands).
 *   - `alternatives=true` matches the OSRM tier so the alternates
 *     list isn't empty when /home renders the route preview.
 *   - `driving-traffic` profile uses live traffic data when available.
 *
 * Token: process.env.EXPO_PUBLIC_MAPBOX_TOKEN (already wired in
 * lib/api/places.ts — same Mapbox account). Returns null when the
 * token isn't set so getRoutesBetween can skip the tier cleanly
 * instead of issuing an unauthorized request.
 *
 * SECURITY: The returned URL contains the access token as a query
 * parameter. DO NOT log this URL anywhere — token leaks through
 * stderr/stdout could compromise the Mapbox account's billing quota.
 * Mapbox tokens are public-prefixed (`pk.*`) and URL-scoped, but a
 * leaked token is still a vector for quota abuse.
 */
function buildMapboxUrl(
  origin: Coordinate,
  destination: Coordinate,
): string | null {
  const token = process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? '';
  if (!token) {
    console.warn('[routes] EXPO_PUBLIC_MAPBOX_TOKEN not set — skipping Mapbox tier.');
    return null;
  }
  // Mapbox uses the same `lng,lat;lng,lat` convention as OSRM.
  const coords = `${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}`;
  const params = new URLSearchParams({
    geometries: 'geojson',
    overview: 'full',
    steps: 'true',
    banner_instructions: 'true',
    alternatives: 'true',
    access_token: token,
  });
  return `https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${coords}?${params.toString()}`;
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
 * Parse a single Mapbox Directions step into the codebase's
 * RouteStep shape. Mapbox uses an OSRM-derived schema, so step
 * structure (maneuver, geometry, distance, duration, name) is
 * near-identical — the same classifyManeuver/buildInstruction
 * pipeline that handles OSRM works here. Lanes will be added in
 * PR 2 by reading banner_instructions; PR 1 stays structural.
 *
 * Returns null when the step is malformed (missing maneuver or
 * location). The outer parser filters nulls — null here means
 * "skip this step" rather than fail the whole route.
 */
function parseMapboxStep(step: any): RouteStep | null {
  if (!step?.maneuver?.location || step.maneuver.location.length < 2) {
    return null;
  }
  const kind = classifyManeuver(step.maneuver.type, step.maneuver.modifier);
  return {
    instruction: buildInstruction(kind, step.name ?? ''),
    distanceMeters: step.distance ?? 0,
    maneuverLocation: {
      latitude: step.maneuver.location[1],
      longitude: step.maneuver.location[0],
    },
    kind,
  };
}

/**
 * Parse Mapbox Directions response into Route[]. Mapbox structures
 * each route as `legs[].steps[]` (a "leg" is the path between two
 * waypoints; for a single-waypoint trip there's exactly one leg).
 * Flatten legs into a single steps array for the Route shape so the
 * /en-route turn pipeline can index across leg boundaries — matches
 * what parseOSRMRoute does for the OSRM tier.
 *
 * Mirrors parseOSRMRoute's output: same id pattern (`{source}-route-{i}`),
 * same label rule (`Primary route` / `Alternative N`), same min-1-minute
 * estimatedMinutes guard, same trimToDestination pass on the polyline
 * (Mapbox snaps to its own road network, same overshoot concern as
 * OSRM).
 */
function parseMapboxRoute(r: any, index: number, destination: Coordinate): Route {
  // Mirror parseOSRMRoute's invariant: assume the data shape is valid
  // (the Mapbox tier's wrapping check already verified `data.code ===
  // 'Ok' && data.routes.length`). If core fields (geometry, duration,
  // distance) are missing, let the access throw — the outer try/catch
  // in the Mapbox tier swallows it and falls through to OSRM. Matches
  // parseOSRMRoute's behavior on malformed payloads.
  const rawCoordinates: Coordinate[] = r.geometry.coordinates.map(
    ([longitude, latitude]: [number, number]) => ({ latitude, longitude }),
  );
  const coordinates = trimToDestination(rawCoordinates, destination);

  // Defensive on `legs[].steps` (the array shape, not the core fields)
  // — same pattern as parseOSRMRoute. Missing/empty steps degrade
  // gracefully to undefined; the turn-pipeline already handles that
  // (mock-route path produces step-less Routes).
  const legs = r.legs ?? [];
  const allSteps = legs.flatMap((leg: any) => leg.steps ?? []);
  const parsed = allSteps
    .map(parseMapboxStep)
    .filter((s: RouteStep | null): s is RouteStep => s !== null);
  const steps: RouteStep[] | undefined = parsed.length > 0 ? parsed : undefined;

  return {
    id: `mapbox-route-${index}`,
    label: index === 0 ? 'Primary route' : `Alternative ${index}`,
    estimatedMinutes: Math.max(1, Math.round(r.duration / 60)),
    distanceMeters: r.distance,
    coordinates,
    steps,
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
 * the candidate; advance to next step when user is within the
 * step-length-scaled advance threshold AND that step isn't `depart`
 * at trip start.
 *
 * `minStepIndex` enforces monotonic progress — the caller tracks the
 * highest index ever reached and passes it back here, preventing
 * regression to an already-completed maneuver. Without this, GPS
 * jitter or a slow turn (red light at the corner) made the closest-
 * by-GPS pick re-select the maneuver the user just completed.
 *
 * Thresholds scale with the current step's length (see body comment)
 * so urban precision (~30m advance / 150m off-route) doesn't regress
 * AND rural highway driving (multi-mile steps, naturally large GPS-to-
 * maneuver distances mid-segment) doesn't trigger false "off-route"
 * or advance too eagerly on wide rural turn radii.
 *
 * Terminal states:
 *   - `arrived`: closest maneuver is `arrive` and user is within 30m
 *     (static threshold — arrive's step has distanceMeters=0).
 *   - `off-route`: closest maneuver is past the (scaled) off-route
 *     threshold — closest-by-GPS pick is unreliable, surface a
 *     recalculating UX instead of confidently displaying a wrong
 *     maneuver.
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
  const current = steps[closestIdx];
  // Dynamic thresholds — Fresh Greens explicitly serves Black drivers
  // navigating rural areas, where OSRM steps can be 5+ miles apart
  // and GPS sampling is noisier. The earlier urban-tuned 30m advance
  // / 150m off-route would have triggered "off-route" constantly on
  // highway driving (the user is naturally > 150m from any maneuver
  // for most of a long step), and would have advanced too late on a
  // wide rural turn radius. Both thresholds scale with the current
  // step's length:
  //   advance: max(30, stepLen / 25) capped at 200m
  //     → urban grid (~150m steps): 30m (urban-tight, no regression)
  //     → suburban (~1km steps): 40m
  //     → rural highway (~10km steps): 200m (capped — long enough
  //       that GPS sampling can land on the maneuver without missing)
  //   off-route: max(150, stepLen / 6) capped at 1000m
  //     → urban: 150m (urban-tight, no regression)
  //     → suburban: 167m
  //     → rural highway: 1000m (capped — genuine off-route still
  //       fires; 1km is well past "natural mid-step GPS distance")
  const stepLen = current.distanceMeters;
  const advanceThreshold = Math.min(200, Math.max(30, stepLen / 25));
  const offRouteThreshold = Math.min(1000, Math.max(150, stepLen / 6));

  // Off-route guard: when even the closest maneuver is far, the
  // closest-by-GPS heuristic is unreliable. Surface a recalculating
  // UX instead of confidently displaying a wrong maneuver.
  if (closestDist > offRouteThreshold) {
    return {
      step: current,
      index: closestIdx,
      distanceMeters: closestDist,
      status: 'off-route',
    };
  }
  // Arrival: closest step IS the arrive step and we're at it. Uses
  // the static 30m advance threshold (arrival doesn't benefit from
  // the dynamic scale — arrive's step has distanceMeters=0).
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
  // step's maneuverLocation IS the origin; user is always within
  // advanceThreshold at trip start, so the canonical advance would
  // immediately skip "Head out on {street}." Hold on depart until
  // user has actually moved >50m away from origin.
  const shouldAdvance =
    current.kind === 'depart' ? closestDist > 50 : closestDist < advanceThreshold;
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
