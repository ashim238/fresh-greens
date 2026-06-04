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

import { zonesFromMapboxLegIncidents } from './sources/mapbox-incidents';
import { loadActiveRoute, saveActiveRoute } from './route-cache';
import type { Coordinate, Zone } from './zones';

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
 * Direction a lane permits. Subset of ManeuverKind — lanes don't
 * have 'depart' / 'arrive' / 'merge' / 'roundabout' as choices.
 * Tighter type prevents misuse downstream and shrinks the glyph
 * dispatch table in LaneStrip.
 */
export type LaneDirection =
  | 'straight'
  | 'slight-left' | 'left' | 'sharp-left'
  | 'slight-right' | 'right' | 'sharp-right'
  | 'uturn';

/**
 * A single lane on the road approaching the next maneuver.
 *
 *   - `active: true`  → driver should use this lane to follow the route
 *   - `directions[]`  → all turns this lane permits (a lane can allow
 *                       "straight or right")
 *   - `activeDirection` → when active, the specific direction to take;
 *                         lets LaneStrip highlight one glyph in a
 *                         multi-direction lane.
 *
 * Lanes are ordered left-to-right as the driver faces forward.
 */
export type Lane = {
  active: boolean;
  directions: LaneDirection[];
  activeDirection?: LaneDirection;
};

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
  /** Street/road name for this step (e.g. "I-580 W", "Telegraph Ave").
      Undefined for unnamed segments (slip roads, service roads) and for
      step-less routes. Drives the /home route-preview "Via {road}". */
  name?: string;
  /** Lane layout for the maneuver. Mapbox-sourced only; OSRM/cache/
      mock steps don't have lane data. */
  lanes?: Lane[];
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
  /** Turn-by-turn maneuvers. Undefined when the adapter returned mock
      data (no engine steps), or when a preview-detail fetch dropped
      them on a long route (A20) — consumers should fall back to a
      neutral "Heading toward destination" copy in either case. */
  steps?: RouteStep[];
  /** Live traffic incidents from Mapbox Directions (`legs[].incidents`). */
  mapboxIncidentZones?: Zone[];
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
 * Defensive upper bound on origin→destination straight-line distance,
 * in miles. Real multi-day road trips fit comfortably under this
 * (NYC↔LA ≈ 2,450mi, Vancouver↔Halifax ≈ 2,800mi, Anchorage→Tijuana
 * ≈ 2,500mi). Catches the pathological case: a persisted recent-
 * searches entry from a prior trip (e.g., user searched NYC, flew to
 * Madrid, app reloads and tries to route NYC→Madrid) which would
 * issue a multi-thousand-mile transoceanic fetch that the routing
 * engine has no useful answer for.
 *
 * Previously set to 500mi, which gated out reasonable multi-day road
 * trips. The new bound trusts the routing engines (Mapbox / OSRM) to
 * return a clean `code === 'NoRoute'` for transoceanic destinations
 * — see the no-route handling below.
 */
const MAX_ROUTE_DISTANCE_MILES = 3000;

/**
 * Distance past which a route is fetched at COARSE detail
 * (`overview=simplified`) instead of full. This is a RENDER-COST
 * threshold, not a routability one — `MAX_ROUTE_DISTANCE_MILES` above
 * handles routability.
 *
 * Why: a ~2,300km route (e.g. Amsterdam→Granada) returns thousands of
 * polyline coordinates at `overview=full`. `gradientSegments` slices
 * that array 15× and `pickWinner` runs point-in-zone tests against
 * every coordinate — on the JS thread, which froze the /home route
 * preview hard enough that the "Go" button stopped responding.
 * `overview=simplified` caps a cross-continent route at a few hundred
 * points; the zoomed-out route line is visually identical at the zoom
 * level you'd actually view a 150mi+ trip, and per-STEP geometry stays
 * full-resolution regardless of `overview`, so turn-by-turn navigation
 * is unaffected.
 *
 * 150mi ≈ 2.5h of driving. Below it (the overwhelming majority of real
 * trips — urban + regional) routes keep full precise overview; the
 * coarse path only engages where the coordinate blow-up actually
 * happens and where a coarse zoomed-out line can't be perceived.
 */
const LONG_ROUTE_MILES = 150;

/**
 * How much route detail a caller needs.
 *   - 'full'    — turn-by-turn navigation (/en-route). Always requests
 *                 steps (+ lane banners); on long routes the route
 *                 overview goes coarse but steps stay precise.
 *   - 'preview' — route preview only (/home). Never needs maneuver
 *                 data, so on long routes it drops steps entirely (the
 *                 steps payload is the other half of the parse cost).
 *                 Short previews keep steps so the offline cache still
 *                 pre-warms with turn-by-turn for the common regional
 *                 trip.
 */
export type RouteDetail = 'preview' | 'full';

/**
 * Where a route came from. The source ladder in getRoutesBetween:
 *   - 'mapbox'   — primary network source (lanes, banner instructions)
 *   - 'osrm'     — automatic fallback when Mapbox unreachable/quota
 *   - 'cache'    — AsyncStorage replay when both network sources fail
 *   - 'mock'     — synthetic catastrophe-fallback
 *   - 'no-route' — both routing engines responded but explicitly said
 *                  no route exists (transoceanic destination, road
 *                  network disconnect). Caller should render "no
 *                  route available" copy, NOT a polyline.
 *
 * Drives the /en-route UX: 'mapbox' and 'osrm' are both live data
 * (no offline pill); 'cache' and 'mock' surface the offline/demo
 * pill so the driver knows there's no live recalculation. A
 * background poll attempts the primary Mapbox tier periodically
 * to swap non-mapbox sources back to live data non-jarringly.
 *
 * 'no-route' is terminal — there are no routes to render and no
 * point retrying. The caller's empty-state distinguishes this from
 * "no destination set" (which also has empty routes but different
 * copy).
 */
export type RouteSource = 'mapbox' | 'osrm' | 'cache' | 'mock' | 'no-route';

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
  opts?: { detail?: RouteDetail },
): Promise<RoutesResult> {
  // Default to full detail — navigation (/en-route) is the demanding
  // caller; the route-preview caller (/home) opts down to 'preview'.
  const detail: RouteDetail = opts?.detail ?? 'full';
  // Guard against pathological origin/destination pairs before hitting
  // the routing ladder. Beyond MAX_ROUTE_DISTANCE_MILES we treat the
  // pair as "no route available" rather than attempting a fetch that
  // a routing engine would either reject as NoRoute or return a
  // multi-thousand-mile polyline for. Returning 'no-route' lets the
  // caller render distinct "no route available" copy instead of
  // conflating with "no destination set."
  const distance = haversineMiles(origin, destination);
  if (distance > MAX_ROUTE_DISTANCE_MILES) {
    console.warn(
      `[routes] origin→destination ${distance.toFixed(0)}mi exceeds ` +
        `${MAX_ROUTE_DISTANCE_MILES}mi guard; returning no-route.`,
    );
    return { routes: [], source: 'no-route' };
  }

  // Detail scaling (A20). Long routes return a coarse overview so the
  // polyline + daylight gradient + zone scoring don't choke the JS
  // thread on thousands of coordinates. `wantSteps` drops turn-by-turn
  // for preview-of-long-routes only — full-detail callers (/en-route)
  // always keep steps, and short previews keep them too so the offline
  // cache pre-warms with maneuvers for the common regional trip.
  const coarse = distance > LONG_ROUTE_MILES;
  const wantSteps = detail === 'full' ? true : !coarse;

  // Track whether AT LEAST ONE routing engine responded successfully
  // (HTTP-wise) but explicitly said "no route exists." We trust a
  // single engine's no-route response because: (a) when both engines
  // are reachable they almost always agree on routability — the
  // underlying OpenStreetMap data is shared upstream; (b) returning
  // no-route on partial confirmation is safer than degrading to a
  // synthetic mock for a genuinely unroutable destination. Distinct
  // from "couldn't reach the engine" (which falls through to cache +
  // mock — those tiers handle network failures, not routing failures).
  let engineSaidNoRoute = false;

  // Tier 1 — Mapbox Directions. Primary network source; richer step
  // metadata (banner_instructions for lanes) and `driving-traffic`
  // profile uses live traffic. Falls through to OSRM on network
  // failure / non-OK HTTP / missing token. A successful HTTP response
  // with `code !== 'Ok'` sets `engineSaidNoRoute` and ALSO falls
  // through to OSRM — see the engineSaidNoRoute check after the
  // OSRM tier for terminal no-route semantics.
  const mapboxUrl = buildMapboxUrl(origin, destination, { coarse, steps: wantSteps });
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
            // Best-effort cache write, gated on `wantSteps` — same
            // semantics as the OSRM tier below. The cache exists for
            // offline NAVIGATION, so only nav-detail routes (those
            // carrying turn-by-turn steps) belong in it. Gating here
            // prevents a /home preview-of-a-long-route (stepless) from
            // clobbering a richer full-detail entry the same
            // destination may already hold from a prior /en-route
            // fetch. Short previews still pre-warm (they keep steps).
            if (wantSteps) void saveActiveRoute(routes, destination);
            return { routes, source: 'mapbox' };
          }
        } else {
          // Mapbox responded successfully but said no route exists
          // (transoceanic, disconnected road network, etc.). Mark the
          // signal and fall through to OSRM — if OSRM also confirms,
          // we'll return 'no-route' below instead of degrading to
          // mock. Common codes: 'NoRoute', 'NoSegment'.
          engineSaidNoRoute = true;
          console.warn(
            `[routes] Mapbox: no route (code: ${data?.code ?? 'unknown'}); confirming with OSRM.`,
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
  // a reliable structural fallback. Same `engineSaidNoRoute`
  // distinction as Mapbox: a successful HTTP response with code
  // !== 'Ok' is a routing failure (engine confirmed no route), not
  // a network failure.
  try {
    const response = await fetch(buildOSRMUrl(origin, destination, { coarse, steps: wantSteps }));
    if (!response.ok) {
      throw new Error(`OSRM HTTP ${response.status}`);
    }

    const data: OSRMResponse = await response.json();
    if (data.code !== 'Ok' || !data.routes?.length) {
      // Engine responded but said no route exists. Mark and fall
      // through to the post-tier no-route check below — we don't
      // want cache or mock to substitute a stale or synthetic
      // straight-line for a destination that genuinely can't be
      // routed to.
      engineSaidNoRoute = true;
      console.warn(
        `[routes] OSRM: no route (code: ${data.code}); routing engine confirms unroutable.`,
      );
    } else {
      // OSRM snaps the destination to the nearest road segment in
      // its own (OpenStreetMap-derived) network, which can be a
      // different road than where the Mapbox-geocoded POI actually
      // sits. The returned geometry ends at OSRM's snap, which often
      // visibly overshoots the destination on the map. Trim each
      // route to the point closest to the requested destination so
      // the polyline ends where the user expects to arrive.
      const routes = data.routes
        .map(parseOSRMRoute)
        .map((route) => ({
          ...route,
          coordinates: trimToDestination(route.coordinates, destination),
        }));
      // Best-effort cache write, gated on `wantSteps`. The cache feeds
      // the offline /en-route fallback, so only routes carrying turn-
      // by-turn steps are worth storing — a stepless preview route
      // would degrade a dead-signal navigation to a bare polyline and
      // could overwrite a richer full-detail entry. Short previews keep
      // steps, so the regional-trip pre-warm path is unaffected; only a
      // preview of a >150mi route (already rare, never navigated in a
      // demo) skips the write. saveActiveRoute has its own try/catch.
      if (wantSteps) void saveActiveRoute(routes, destination);
      return { routes, source: 'osrm' };
    }
  } catch (error) {
    console.warn('[routes] OSRM network error:', error);
  }

  // Both network tiers tried. If at least one engine confirmed
  // no-route (vs. network errors), return the terminal no-route
  // state — cache and mock can't help: cache only stores routes
  // that previously succeeded, and mock would synthesize a
  // misleading straight-line across the un-routable gap.
  if (engineSaidNoRoute) {
    return { routes: [], source: 'no-route' };
  }

  // Tier 3 — cache. Reached only when both Mapbox and OSRM had
  // network failures (not "no route" responses).
  console.warn('[routes] both network tiers failed, trying cache');
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

  // Tier 4 — mock. Catastrophic last resort: no network, no cache.
  // The mock synthesizes a straight-line route so /en-route renders
  // something rather than a broken state.
  console.warn('[routes] no cache for this destination, falling back to mock');
  const mockRoutes = await getRoutesBetweenMock(origin, destination);
  return { routes: mockRoutes, source: 'mock' };
}

/**
 * Display style per route type.
 * - Recommended: bold freshgreen — visually claims "this is the choice."
 * - Alternate: thin muted gray — present but unmistakably secondary.
 *
 * The width and opacity gap between recommended (5pt, 0.9α) and
 * alternate (2pt, 0.4α) is the load-bearing hierarchy: where two
 * routes share streets near origin/destination, the recommended's
 * wider gradient stroke fully covers the slim gray underneath and
 * reads as a single colored line; where alternates share streets
 * with each other, gray-40α stacking stays in the gray family
 * rather than compounding to dark. Earlier values (3pt + 0.6α)
 * left enough visual weight on the alternates that overlap segments
 * read as "messy parallel lines" — user-flagged 2026-06-03.
 */
export const routeColors: Record<
  RouteType,
  { stroke: string; width: number }
> = {
  recommended: { stroke: 'rgba(65, 173, 73, 0.9)', width: 5 },
  alternate: { stroke: 'rgba(128, 128, 128, 0.4)', width: 2 },
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

function buildOSRMUrl(
  origin: Coordinate,
  destination: Coordinate,
  opts: { coarse: boolean; steps: boolean },
): string {
  // OSRM expects coordinates as `lng,lat;lng,lat` (longitude first — opposite
  // of our internal { latitude, longitude } convention). Easy bug to make.
  const coords = `${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}`;
  // `overview=simplified` on long routes (A20) keeps the coordinate
  // count bounded so the gradient + scoring passes stay cheap. `steps`
  // is conditional — preview-of-long-routes omits the leg→steps array
  // (the turn-by-turn maneuver list) entirely.
  const overview = opts.coarse ? 'simplified' : 'full';
  const steps = opts.steps ? '&steps=true' : '';
  return `https://router.project-osrm.org/route/v1/driving/${coords}?overview=${overview}&geometries=geojson&alternatives=true${steps}`;
}

/**
 * Mapbox Directions v5 URL for `driving-traffic` profile.
 *
 *   - `geometries=geojson` returns the polyline as a GeoJSON
 *     LineString matching OSRM's shape — parseMapboxStep and
 *     parseOSRMStep populate Route.coordinates identically.
 *   - `overview` is request-dependent (A20): `simplified` on long
 *     routes (`opts.coarse`) to bound the coordinate count, `full`
 *     otherwise for a precise line on the regional trips that are the
 *     common case.
 *   - `steps` + `banner_instructions` are request-dependent
 *     (`opts.steps`) and travel together — lane banners are a property
 *     of maneuver steps. Preview-of-long-routes omits both; navigation
 *     and short previews include them.
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
  opts: { coarse: boolean; steps: boolean },
): string | null {
  const token = process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? '';
  if (!token) {
    console.warn('[routes] EXPO_PUBLIC_MAPBOX_TOKEN not set — skipping Mapbox tier.');
    return null;
  }
  // Mapbox uses the same `lng,lat;lng,lat` convention as OSRM.
  const coords = `${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}`;
  // `overview=simplified` on long routes (A20) bounds the coordinate
  // count. `steps` + `banner_instructions` are conditional and travel
  // together — lanes are a property of maneuver steps, so there's no
  // reason to request banners without steps.
  const params = new URLSearchParams({
    geometries: 'geojson',
    overview: opts.coarse ? 'simplified' : 'full',
    alternatives: 'true',
    access_token: token,
  });
  if (opts.steps) {
    params.set('steps', 'true');
    params.set('banner_instructions', 'true');
  }
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

/**
 * The route's primary road — the road covering the most *cumulative*
 * distance. This is what "Via {road}" on the /home route preview should
 * surface (the bug it replaces showed the *destination* name there).
 *
 * We sum distance per road name rather than picking the single longest
 * step: OSRM/Mapbox split one continuous road into several steps across
 * interchanges (e.g. "I-580 W" arrives as 3km + 3km + 3km), so the
 * longest-single-step heuristic would let an uninterrupted side street
 * outweigh the highway the trip is actually mostly driven on. Summing
 * by name matches the "main road you take" intent.
 *
 * Returns null when no step carries a name: step-less preview/mock
 * routes, or a route made entirely of unnamed segments.
 */
export function primaryRoadName(steps: RouteStep[] | undefined): string | null {
  if (!steps || steps.length === 0) return null;
  const byName = new Map<string, number>();
  for (const s of steps) {
    if (!s.name) continue;
    byName.set(s.name, (byName.get(s.name) ?? 0) + s.distanceMeters);
  }
  let bestName: string | null = null;
  let bestDistance = -1;
  for (const [name, distance] of byName) {
    if (distance > bestDistance) {
      bestName = name;
      bestDistance = distance;
    }
  }
  return bestName;
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
    name: s.name || undefined,
  };
}

/**
 * Maps a Mapbox direction string to the codebase's LaneDirection
 * enum. The transform is trivial space-to-hyphen for known values
 * ('slight left' → 'slight-left'); unknown values (e.g., Mapbox's
 * "none" for valid-but-prohibited lanes in some markets) return
 * null so consumers can filter them out instead of type-erasing
 * unsafe values into LaneDirection.
 */
const KNOWN_LANE_DIRECTIONS: readonly LaneDirection[] = [
  'straight',
  'slight-left', 'left', 'sharp-left',
  'slight-right', 'right', 'sharp-right',
  'uturn',
];

function mapMapboxDirection(d: string): LaneDirection | null {
  const normalized = d.replace(/ /g, '-');
  return KNOWN_LANE_DIRECTIONS.includes(normalized as LaneDirection)
    ? (normalized as LaneDirection)
    : null;
}

/**
 * Parse a single Mapbox Directions step into the codebase's
 * RouteStep shape. Mapbox uses an OSRM-derived schema, so step
 * structure (maneuver, geometry, distance, duration, name) is
 * near-identical — the same classifyManeuver/buildInstruction
 * pipeline that handles OSRM works here. Extracts lane data from
 * banner_instructions[].sub.components (lane components) so the
 * /en-route turn card's LaneStrip has data to render.
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

  // Pull lanes from the FIRST banner with a sub-banner containing lane
  // components. Mapbox returns banners in order of trigger distance
  // (farthest first), so this is the earliest lane coaching for the
  // step. Multi-banner refinement (different lane layouts at different
  // distances) is deferred to PR3 polish.
  //
  // NOTE: Mapbox returns lane component fields in snake_case
  // (`active_direction`, not `activeDirection`) — easy bug to trip on
  // if you're working in TS-land where camelCase is the norm.
  const laneBanner = (step.bannerInstructions ?? []).find((b: any) =>
    b.sub?.components?.some((c: any) => c.type === 'lane'),
  );

  const lanes: Lane[] | undefined = laneBanner
    ? laneBanner.sub.components
        .filter((c: any) => c.type === 'lane')
        .map((c: any) => ({
          active: !!c.active,
          directions: (c.directions ?? [])
            .map(mapMapboxDirection)
            .filter((d: LaneDirection | null): d is LaneDirection => d !== null),
          activeDirection: c.active_direction
            ? mapMapboxDirection(c.active_direction) ?? undefined
            : undefined,
        }))
    : undefined;

  return {
    instruction: buildInstruction(kind, step.name ?? ''),
    distanceMeters: step.distance ?? 0,
    maneuverLocation: {
      latitude: step.maneuver.location[1],
      longitude: step.maneuver.location[0],
    },
    kind,
    name: step.name || undefined,
    lanes,
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
  const mapboxIncidentZones = zonesFromMapboxLegIncidents(legs, coordinates);

  return {
    id: `mapbox-route-${index}`,
    label: index === 0 ? 'Primary route' : `Alternative ${index}`,
    estimatedMinutes: Math.max(1, Math.round(r.duration / 60)),
    distanceMeters: r.distance,
    coordinates,
    steps,
    mapboxIncidentZones:
      mapboxIncidentZones.length > 0 ? mapboxIncidentZones : undefined,
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
