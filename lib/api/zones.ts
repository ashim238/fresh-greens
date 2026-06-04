// Fresh Greens — zones adapter.
//
// Pulls multiple real data sources from OpenStreetMap's free Overpass API
// in a single round-trip. Each source becomes a Zone with the appropriate
// geometry kind and category:
//
//   Lighting (way + highway + lit tag) → polyline zone, category 'lighting'
//     lit=yes / 24/7 / automatic  → safe
//     lit=interval / limited      → caution
//     lit=no                      → avoid
//
//   Landuse (way + landuse tag) → polygon zone, category 'landuse'
//     landuse=residential  → safe   (Jacobs' "eyes on the street")
//     landuse=commercial   → caution (mixed-use, time-dependent)
//     landuse=industrial   → avoid  (low foot traffic, esp. at night)
//
//   Parks (way + leisure=park) → polygon zone, category 'park'
//     leisure=park → caution (research shows higher nighttime crime;
//                             not "safe" despite intuition)
//
//   Police (way OR node + amenity=police, node + highway=speed_camera) →
//     polygon/point zone, category 'police' → caution
//     Reflects the lived-experience of Black drivers exercising caution
//     around police presence. Caution-bias, not avoid: the app respects
//     the wariness without paternalizing the choice.
//
//   Wildlife (node + hazard=wildlife_crossing, way + landuse=forest, way
//     + natural=wood) → point/polygon zone, category 'wildlife' → caution
//     Score is amplified ×2 at dawn/dusk in lib/scoring.ts because deer
//     and other wildlife are crepuscular. Time-of-day modulation lives
//     in scoring, not here — zones describe what's there; scoring decides
//     what to do about it given the trip context.
//
//   Road conditions (way + highway + surface/smoothness/construction;
//     nodes: traffic_calming, level_crossing, uncontrolled crossing;
//     enforcement=maxspeed) → polyline/point, category 'road-condition'
//
//   Lighting extras (B0): tunnel/bridge + lit=no → polyline avoid
//     Severity is graduated:
//       surface=unpaved/gravel/dirt/sand/ground → caution
//       smoothness=bad/very_bad                 → caution
//       smoothness=horrible/impassable          → avoid
//       highway=construction                    → caution
//     Default for unmapped roads is "no signal" — we don't penalize
//     undocumented infrastructure. v2 candidates: TIGER/Line for
//     classification of unmapped roads, ALDOT 511 for real-time
//     construction/incident feed.
//
// Multi-source coverage mitigates sparsity: even areas without rich
// lighting tags usually have landuse data. When ALL sources fail or
// return nothing, falls back to mock zones around the user's center.
//
// Long trips use several `around:1500m` queries sampled along the route
// corridor instead of one huge bbox (Overpass caps elements and times out).
//
// All sources flow through the same Zone[] type and the same scoring
// pipeline. Each source's contribution adds to the route's score, so
// signals can compound (e.g., a residential street that's also lit=yes
// stacks safe+safe = strongly preferred).

import {
  OVERPASS_MIRROR_COUNT,
  SEGMENT_TIMEOUT_MS,
} from '../corridor/constants';
import type { SampleRequest } from '../corridor/types';
import {
  buildOverpassQueryAround,
  buildOverpassQueryBbox,
  parseOverpassElements,
} from './sources/osm-overpass';

// Public Overpass mirrors, tried in order on every call. All three
// speak the same query API. `overpass-api.de` (Heidelberg / Geofabrik)
// is the canonical mirror and tends to respond first in our testing,
// despite being heavier-loaded in general. `kumi.systems` (Yannik
// Schwieren, Berlin) and `openstreetmap.fr` (OSM France) are the
// backups. The three mirrors don't usually fail in lockstep —
// chaining all three before mock fallback cuts the "demo runs on
// synthetic zones" rate sharply during thesis-demo windows when one
// or two are under load.
//
// Order was kumi → overpass-api.de → openstreetmap.fr until empirical
// testing showed kumi timing out (AbortError) more often than the
// canonical. Order optimized for hit-rate at the head of the chain.
const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.openstreetmap.fr/api/interpreter',
] as const;

/**
 * Bail on a single Overpass call if it doesn't respond within this
 * window. 12s leaves room for a cold-start request (Overpass JIT-
 * compiles the query on first hit) without making a real failure
 * feel infinite. With three endpoints tried sequentially, worst-case
 * latency before mock fallback is ~36s.
 */
const OVERPASS_TIMEOUT_MS = 12000;

/** How close (meters) a route waypoint must be to a polyline zone to count. */
export const POLYLINE_PROXIMITY_METERS = 20;

/**
 * Influence radius (meters) for point-geometry zones (community reports,
 * speed cameras, wildlife crossings). A point counts as "hit" when a
 * route waypoint is within this radius. 30m roughly matches a city
 * block's perpendicular extent — wide enough to catch the route as it
 * passes but not so wide that one point shadows multiple streets.
 */
export const POINT_PROXIMITY_METERS = 30;

export type ZoneType = 'safe' | 'caution' | 'avoid';

/**
 * Source category for a zone. Lets scoring dispatch per-category logic
 * (e.g., wildlife dawn/dusk amplification) without re-parsing tags, and
 * lets future UI explain *why* a zone earned its safety classification.
 */
export type ZoneCategory =
  | 'lighting'
  | 'landuse'
  | 'park'
  | 'police'
  | 'wildlife'
  | 'road-condition'
  | 'community-report';

/** Vendor that produced a zone (Part B½ — namespaced `id` per source). */
export type ZoneSourceId =
  | 'osm-overpass'
  | 'dot-511'
  | 'mapbox-incidents'
  | 'community-report';

export type Coordinate = {
  latitude: number;
  longitude: number;
};

/**
 * A zone is a region, line, or single location tagged with a safety
 * classification. `geometry` discriminates how `coordinates` should be
 * interpreted:
 *   polygon  → closed area; scoring uses point-in-polygon test
 *   polyline → open path of road; scoring uses point-near-polyline test
 *   point    → single location with influence radius; scoring uses
 *              point-to-point distance ≤ POINT_PROXIMITY_METERS.
 *
 * For `point` geometry, `coordinates` is a single-element array.
 *
 * `category` is optional for backwards compatibility with existing zone
 * fixtures, but every adapter-produced zone sets it. Scoring uses the
 * category to apply per-category modulation (e.g., wildlife multiplier).
 */
export type Zone = {
  id: string;
  type: ZoneType;
  label: string;
  geometry: 'polygon' | 'polyline' | 'point';
  coordinates: Coordinate[];
  /** Set by adapters; required for new sources (B4+). */
  source?: ZoneSourceId;
  /** L3 cross-source dedup key — computed in B4 (`merge-hazards.ts`). */
  canonicalHazardKey?: string;
  category?: ZoneCategory;
  /**
   * Set only when `category === 'community-report'`. Carries the
   * report's source category so map markers can render the right
   * glyph (e.g. eye for felt-unsafe, storefront for black-owned)
   * without re-querying the reports adapter. The string is the
   * `ReportCategoryId` from `lib/api/community-reports.ts`; we
   * declare it as `string` here to keep zones.ts decoupled from
   * the reports module's internal id set.
   */
  reportCategoryId?: string;
  /**
   * Set only when `category === 'community-report'` and the report's
   * source category had a `subTags` whitelist that the user picked
   * from (the *place* categories — black-owned, felt-welcome). Not
   * yet used by the marker glyph mapping; reserved for a future PR
   * that ships per-business-type glyphs (e.g. a barber-pole vs a
   * fork-and-knife icon for different `subTag` values).
   */
  reportSubTag?: string;
  /** Community-report detail text (the optional user-written message). */
  reportDetail?: string;
  /** Community-report submission timestamp (ms since epoch). */
  reportTimestamp?: number;
  /**
   * Auto-resolved business name from the report's coords (set at
   * submit time by /report via the proxy's /api/nearby lookup).
   * Surfaces as the title in ReportDetailCard when present.
   */
  reportPlaceName?: string;
  /** Author id (`CommunityReport.submittedBy`) — used by hold-to-delete
   *  to gate deletion to the report's author. */
  reportSubmittedBy?: string;
  /** Local file URI for the optional photo the user attached at
   *  submit time (`CommunityReport.photoUri`). Lives in
   *  expo-file-system documentDirectory so it survives cache evictions.
   *  ReportDetailCard renders it inline when present; absence falls
   *  back to the category glyph header. */
  reportPhotoUri?: string;
};

/** Axis-aligned bounds for an Overpass `(...)` bbox query. */
export type ZoneBounds = {
  south: number;
  west: number;
  north: number;
  east: number;
};

/** Default radius for browse-mode `around` and corridor around samples. */
const OVERPASS_AROUND_RADIUS_METERS = 1500;

/**
 * Fetches safety zones around a given map center (1.5 km radius).
 * Browse mode on /home — no destination yet.
 */
export async function getZonesForRegion(center: Coordinate): Promise<Zone[]> {
  return fetchZonesWithFailover(
    buildOverpassQueryAround(center),
    () => getZonesForRegionMock(center),
  );
}

/**
 * Fetches OSM zones covering a trip corridor so route-preview chips and
 * scoring can see police / lighting / wildlife / road zones the polyline
 * actually crosses — not just a circle around the user's GPS.
 *
 * Pass `routeCoordinates` whenever the polyline is known — callers
 * should not pre-fetch on origin→destination alone and then refine;
 * one call with the route avoids doubling Overpass work on long trips.
 */
export async function getZonesForTrip(
  origin: Coordinate,
  destination: Coordinate,
  routeCoordinates?: Coordinate[],
  options?: import('../corridor/types').GetZonesForTripOptions,
): Promise<Zone[]> {
  const path: Coordinate[] =
    routeCoordinates && routeCoordinates.length >= 2
      ? routeCoordinates
      : [origin, destination];

  if (options?.mode === 'navigation') {
    const { executeNavigationRoll } = await import('../corridor/navigation');
    return executeNavigationRoll(path, options);
  }

  const { executeCorridorTrip } = await import('../corridor/executor');
  return executeCorridorTrip(path, { ...options, mode: 'preview' });
}

export async function fetchCorridorSample(
  request: SampleRequest,
): Promise<Zone[]> {
  const batches = await Promise.all(
    request.sources.map((source) => fetchCorridorSourceSample(request, source)),
  );
  return batches.flat();
}

async function fetchCorridorSourceSample(
  request: SampleRequest,
  source: ZoneSourceId, // zones.ts export — same union as corridor/types
): Promise<Zone[]> {
  switch (source) {
    case 'osm-overpass':
      if (request.kind === 'around') {
        return fetchZonesAroundCenter(request.center, request.radiusMeters);
      }
      {
        const query = buildOverpassQueryBbox(request.bounds);
        for (let i = 0; i < OVERPASS_MIRROR_COUNT; i++) {
          try {
            return await fetchOverpassZones(
              OVERPASS_ENDPOINTS[i],
              query,
              SEGMENT_TIMEOUT_MS,
            );
          } catch {
            // next mirror
          }
        }
        return [];
      }
    case 'dot-511': {
      if (request.kind !== 'bbox') return [];
      const { dominantUsStateCode } = await import('../corridor/dominant-state');
      const { fetchDot511ZonesForBbox } = await import('./sources/dot-511');
      const state = dominantUsStateCode(request.bounds);
      if (!state) return [];
      return fetchDot511ZonesForBbox(request.bounds, state);
    }
    case 'mapbox-incidents':
      // Retired: incidents attach to Mapbox Directions routes, not bbox samples.
      return [];
    case 'community-report':
      return [];
    default:
      return [];
  }
}

/**
 * One corridor sample: try Overpass mirrors in order.
 * No per-segment mock fallback — empty segments merge away; the planner
 * covers the full trip.
 */
async function fetchZonesAroundCenter(
  center: Coordinate,
  radiusMeters: number = OVERPASS_AROUND_RADIUS_METERS,
): Promise<Zone[]> {
  const query = buildOverpassQueryAround(center, radiusMeters);
  for (let i = 0; i < OVERPASS_MIRROR_COUNT; i++) {
    try {
      return await fetchOverpassZones(
        OVERPASS_ENDPOINTS[i],
        query,
        SEGMENT_TIMEOUT_MS,
      );
    } catch {
      // try next mirror
    }
  }
  return [];
}

async function fetchZonesWithFailover(
  query: string,
  mockFallback: () => Promise<Zone[]>,
): Promise<Zone[]> {
  for (let i = 0; i < OVERPASS_ENDPOINTS.length; i++) {
    const endpoint = OVERPASS_ENDPOINTS[i];
    try {
      return await fetchOverpassZones(endpoint, query);
    } catch (error) {
      const isLast = i === OVERPASS_ENDPOINTS.length - 1;
      if (isLast) {
        console.warn(
          `[zones] Overpass ${endpoint} failed, falling back to mock:`,
          error,
        );
      } else {
        console.log(
          `[zones] Overpass ${endpoint} unavailable, trying next mirror`,
        );
      }
    }
  }

  return mockFallback();
}

/**
 * Single-endpoint fetch + parse. Throws on abort, non-OK HTTP, empty
 * elements, or parse failure — the caller catches and decides whether
 * to retry another endpoint or fall back to mock data.
 */
async function fetchOverpassZones(
  endpoint: string,
  query: string,
  timeoutMs: number = OVERPASS_TIMEOUT_MS,
): Promise<Zone[]> {
  // AbortController + setTimeout: fetch has no built-in timeout, so a
  // hanging server would otherwise block forever.
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(query)}`,
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`Overpass HTTP ${response.status}`);
    }

    const data: OverpassResponse = await response.json();
    if (!data.elements?.length) {
      throw new Error('Overpass returned no elements');
    }

    const zones = parseOverpassElements(data.elements);

    if (!zones.length) {
      throw new Error('No usable values in Overpass response');
    }

    return zones;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Display colors for each zone type. Reserved colors used here as
 * legitimate UI safety signals (per .cursorrules — exactly the
 * exception-allowed case).
 *
 * Both `fill` and `stroke` defined so the same lookup works for
 * polygon zones (use both) and polyline zones (use stroke only).
 */
export const zoneColors: Record<ZoneType, { fill: string; stroke: string }> = {
  safe: {
    fill: 'rgba(65, 173, 73, 0.25)', // freshgreen
    stroke: 'rgba(65, 173, 73, 0.85)',
  },
  caution: {
    fill: 'rgba(255, 204, 0, 0.25)', // yellow
    stroke: 'rgba(255, 204, 0, 0.85)',
  },
  avoid: {
    fill: 'rgba(255, 59, 48, 0.25)', // red
    stroke: 'rgba(255, 59, 48, 0.85)',
  },
};

/**
 * Stroke-pattern encoding per ZoneType — a non-color cue layered on
 * top of the color palette so users with red-green color vision
 * deficiency can still distinguish safe / caution / avoid zones at a
 * glance. Per WCAG 1.4.1 (Use of Color, Level A) and Apple HIG's
 * "Don't rely solely on color" guidance.
 *
 *   - safe    → solid (the "default" / "okay" rhythm)
 *   - caution → long-dash (read as "broken / heads-up")
 *   - avoid   → short-dash (read as "stop / warning")
 *
 * Apply via Polygon/Polyline's `lineDashPattern` prop on iOS.
 * Pattern arrays are `[on, off]` pixel runs. iOS-only; on Android
 * the pattern silently no-ops and the zones remain color-only —
 * acceptable since the project is iPhone-first.
 */
export const zoneDashPattern: Record<ZoneType, number[] | undefined> = {
  safe: undefined,
  caution: [10, 5],
  avoid: [3, 3],
};

// Overpass QL + parsers live in ./sources/osm-overpass.ts (B0).

type OverpassResponse = {
  elements?: Parameters<typeof parseOverpassElements>[0];
};

// --- Mock fallback --------------------------------------------------------

/**
 * Hardcoded zones around the center point. Only used when Overpass is
 * unreachable or returns no usable data. Includes one example per
 * category so SHOW_ZONES=true still demonstrates the data layer
 * meaningfully even without network.
 */
export async function getZonesForRegionMock(center: Coordinate): Promise<Zone[]> {
  await delay(100);
  return [
    {
      id: 'mock-safe-1',
      type: 'safe',
      label: 'Mock: well-lit residential area',
      geometry: 'polygon',
      coordinates: rectangleNear(center, 0.001, 0.001, 0.005, 0.005),
      category: 'landuse',
    },
    {
      id: 'mock-caution-1',
      type: 'caution',
      label: 'Mock: moderate visibility',
      geometry: 'polygon',
      coordinates: rectangleNear(center, -0.005, 0.001, -0.001, 0.005),
      category: 'landuse',
    },
    {
      id: 'mock-avoid-1',
      type: 'avoid',
      label: 'Mock: incident reports',
      geometry: 'polygon',
      coordinates: rectangleNear(center, -0.003, -0.005, 0.001, -0.001),
      category: 'landuse',
    },
    {
      id: 'mock-police-1',
      type: 'caution',
      label: 'Mock: police station',
      geometry: 'point',
      coordinates: [
        {
          latitude: center.latitude + 0.004,
          longitude: center.longitude - 0.004,
        },
      ],
      category: 'police',
    },
    {
      id: 'mock-wildlife-1',
      type: 'caution',
      label: 'Mock: wooded area',
      geometry: 'polygon',
      coordinates: rectangleNear(center, 0.005, -0.006, 0.009, -0.001),
      category: 'wildlife',
    },
    {
      id: 'mock-road-condition-1',
      type: 'caution',
      label: 'Mock: unpaved road',
      geometry: 'polyline',
      coordinates: [
        {
          latitude: center.latitude - 0.001,
          longitude: center.longitude + 0.003,
        },
        {
          latitude: center.latitude + 0.002,
          longitude: center.longitude + 0.005,
        },
      ],
      category: 'road-condition',
    },
  ];
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function rectangleNear(
  center: Coordinate,
  swLatOffset: number,
  swLngOffset: number,
  neLatOffset: number,
  neLngOffset: number,
): Coordinate[] {
  return [
    {
      latitude: center.latitude + swLatOffset,
      longitude: center.longitude + swLngOffset,
    },
    {
      latitude: center.latitude + neLatOffset,
      longitude: center.longitude + swLngOffset,
    },
    {
      latitude: center.latitude + neLatOffset,
      longitude: center.longitude + neLngOffset,
    },
    {
      latitude: center.latitude + swLatOffset,
      longitude: center.longitude + neLngOffset,
    },
  ];
}
