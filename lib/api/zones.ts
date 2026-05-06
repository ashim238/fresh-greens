// Fresh Greens — zones adapter.
//
// Pulls multiple real data sources from OpenStreetMap's free Overpass API
// in a single round-trip. Each source becomes a Zone with the appropriate
// geometry kind:
//
//   Lit streets (way + highway + lit tag) → polyline zone
//     lit=yes / 24/7 / automatic  → safe
//     lit=interval / limited      → caution
//     lit=no                      → avoid
//
//   Landuse polygons (way + landuse tag) → polygon zone
//     landuse=residential  → safe   (Jacobs' "eyes on the street")
//     landuse=commercial   → caution (mixed-use, time-dependent)
//     landuse=industrial   → avoid  (low foot traffic, esp. at night)
//
//   Parks (way + leisure=park) → polygon zone
//     leisure=park → caution (research shows higher nighttime crime;
//                             not "safe" despite intuition)
//
// Multi-source coverage mitigates sparsity: even areas without rich
// lighting tags usually have landuse data. When ALL sources fail or
// return nothing, falls back to three mock polygon zones around the
// user's center for resilience.
//
// All sources flow through the same Zone[] type and the same scoring
// pipeline. Each source's contribution adds to the route's score, so
// signals can compound (e.g., a residential street that's also lit=yes
// stacks safe+safe = strongly preferred).

const OVERPASS_ENDPOINT = 'https://overpass-api.de/api/interpreter';

/** Bail on the Overpass call if it doesn't respond within this window. */
const OVERPASS_TIMEOUT_MS = 6000;

/** How close (meters) a route waypoint must be to a lit street to count. */
export const POLYLINE_PROXIMITY_METERS = 20;

/**
 * Influence radius (meters) for community-report point zones. A point
 * report counts as "hit" when a route waypoint is within this radius.
 * 30m roughly matches a city block's perpendicular extent — wide enough
 * to catch the route as it passes but not so wide that one report
 * shadows multiple streets.
 */
export const POINT_PROXIMITY_METERS = 30;

export type ZoneType = 'safe' | 'caution' | 'avoid';

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
 *              Used for community-submitted reports — see
 *              lib/api/community-reports.ts.
 *
 * For `point` geometry, `coordinates` is a single-element array.
 */
export type Zone = {
  id: string;
  type: ZoneType;
  label: string;
  geometry: 'polygon' | 'polyline' | 'point';
  coordinates: Coordinate[];
};

/**
 * Fetches safety zones around a given map center.
 *
 * Tries OSM Overpass first; falls back to mock polygon zones on any
 * failure (network error, non-OK response, parse error, no results).
 */
export async function getZonesForRegion(center: Coordinate): Promise<Zone[]> {
  // AbortController + setTimeout: fetch has no built-in timeout, so a
  // hanging server would otherwise block forever. We give the request
  // OVERPASS_TIMEOUT_MS, then abort. The aborted fetch throws into our
  // catch block, which falls back to mock zones cleanly.
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    OVERPASS_TIMEOUT_MS,
  );

  try {
    const query = buildOverpassQuery(center);
    const response = await fetch(OVERPASS_ENDPOINT, {
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
      throw new Error('Overpass returned no lit ways');
    }

    const zones = data.elements
      .map(parseOverpassWay)
      .filter((zone): zone is Zone => zone !== null);

    if (!zones.length) {
      throw new Error('No usable lit values in Overpass response');
    }

    return zones;
  } catch (error) {
    console.warn(
      '[zones] Overpass fetch failed, falling back to mock:',
      error,
    );
    return getZonesForRegionMock(center);
  } finally {
    // Always clear the timeout so it doesn't fire after success.
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

// --- OSM Overpass ---------------------------------------------------------

type OverpassResponse = {
  elements?: OverpassWay[];
};

type OverpassWay = {
  type: 'way';
  id: number;
  tags?: Record<string, string>;
  geometry?: { lat: number; lon: number }[];
};

/**
 * Builds a multi-source Overpass QL query — combines lit highways,
 * landuse polygons, and parks into a single union. Output capped at 100
 * ways to keep map rendering snappy on dense urban areas.
 *
 * The `(...)` syntax in Overpass is a union: every `way[...]` clause
 * inside contributes to the result set. `out geom 100;` returns up to
 * 100 ways with their full coordinate geometry.
 */
function buildOverpassQuery(center: Coordinate): string {
  const radius = 1500; // meters — narrowed from 2km for faster response
  const lat = center.latitude;
  const lng = center.longitude;
  // out geom 40: caps total returned ways. Plenty for scoring (each
  // route waypoint just needs *some* zones to test against). Lower cap
  // = smaller payload = faster network round-trip + parse. SHOW_ZONES
  // is false in normal use, so visual coverage isn't a concern either.
  return `
    [out:json][timeout:25];
    (
      way["highway"]["lit"](around:${radius},${lat},${lng});
      way["landuse"~"^(residential|commercial|industrial)$"](around:${radius},${lat},${lng});
      way["leisure"="park"](around:${radius},${lat},${lng});
    );
    out geom 40;
  `.trim();
}

/**
 * Maps an OSM `lit` tag value to one of our zone types.
 * Returns null for unknown/unhandled values.
 */
function mapLitToZoneType(lit: string | undefined): ZoneType | null {
  switch (lit) {
    case 'yes':
    case '24/7':
    case 'automatic':
      return 'safe';
    case 'interval':
    case 'limited':
      return 'caution';
    case 'no':
      return 'avoid';
    default:
      return null;
  }
}

/**
 * Maps an OSM landuse tag value to a zone type. Mapping is intentionally
 * conservative — research shows landuse alone is a weak safety predictor.
 * Real strength comes from layering multiple signals (lit + landuse +
 * incident data + community input), which is why this adapter combines
 * sources rather than relying on landuse alone.
 */
function mapLanduseToZoneType(landuse: string | undefined): ZoneType | null {
  switch (landuse) {
    case 'residential':
      return 'safe'; // Jacobs' "eyes on the street" theory
    case 'commercial':
      return 'caution';
    case 'industrial':
      return 'avoid';
    default:
      return null;
  }
}

/**
 * Parses an Overpass way into a Zone, branching by which tag is present.
 * Tag-precedence order: `lit` → polyline; `landuse` → polygon; `leisure=park`
 * → polygon. A way with multiple matching tags is most likely a lit street
 * (highways are tagged with both `highway` and possibly `lit`); landuse
 * polygons don't usually carry `lit`.
 */
function parseOverpassWay(way: OverpassWay): Zone | null {
  if (!way.tags || !way.geometry?.length) return null;

  // OSM uses { lat, lon } in geometry; convert to our { latitude, longitude }
  // shape at the boundary so the rest of the codebase stays in one convention.
  const coordinates: Coordinate[] = way.geometry.map(({ lat, lon }) => ({
    latitude: lat,
    longitude: lon,
  }));

  // Lit street → polyline zone
  const litType = mapLitToZoneType(way.tags.lit);
  if (litType) {
    const streetName = way.tags.name ?? 'Unnamed street';
    return {
      id: `osm-way-${way.id}`,
      type: litType,
      label: `${streetName} (lit=${way.tags.lit})`,
      geometry: 'polyline',
      coordinates,
    };
  }

  // Landuse area → polygon zone
  const landuseType = mapLanduseToZoneType(way.tags.landuse);
  if (landuseType) {
    return {
      id: `osm-way-${way.id}`,
      type: landuseType,
      label: `Landuse: ${way.tags.landuse}`,
      geometry: 'polygon',
      coordinates,
    };
  }

  // Park → polygon zone (caution per nighttime-crime research)
  if (way.tags.leisure === 'park') {
    return {
      id: `osm-way-${way.id}`,
      type: 'caution',
      label: `Park: ${way.tags.name ?? 'Unnamed'}`,
      geometry: 'polygon',
      coordinates,
    };
  }

  return null;
}

// --- Mock fallback --------------------------------------------------------

/**
 * Three hardcoded polygon zones around the center point. Only used when
 * Overpass is unreachable or returns no usable data. Same Zone shape
 * with geometry='polygon' so the consumer doesn't have to special-case
 * the fallback.
 */
async function getZonesForRegionMock(center: Coordinate): Promise<Zone[]> {
  await delay(100);
  return [
    {
      id: 'mock-safe-1',
      type: 'safe',
      label: 'Mock: well-lit residential area',
      geometry: 'polygon',
      coordinates: rectangleNear(center, 0.001, 0.001, 0.005, 0.005),
    },
    {
      id: 'mock-caution-1',
      type: 'caution',
      label: 'Mock: moderate visibility',
      geometry: 'polygon',
      coordinates: rectangleNear(center, -0.005, 0.001, -0.001, 0.005),
    },
    {
      id: 'mock-avoid-1',
      type: 'avoid',
      label: 'Mock: incident reports',
      geometry: 'polygon',
      coordinates: rectangleNear(center, -0.003, -0.005, 0.001, -0.001),
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
