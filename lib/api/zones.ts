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
//   Road conditions (way + highway + surface/smoothness tags, way +
//     highway=construction) → polyline zone, category 'road-condition'
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
// All sources flow through the same Zone[] type and the same scoring
// pipeline. Each source's contribution adds to the route's score, so
// signals can compound (e.g., a residential street that's also lit=yes
// stacks safe+safe = strongly preferred).

const OVERPASS_ENDPOINT = 'https://overpass-api.de/api/interpreter';

/** Bail on the Overpass call if it doesn't respond within this window. */
const OVERPASS_TIMEOUT_MS = 6000;

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
};

/**
 * Fetches safety zones around a given map center.
 *
 * Tries OSM Overpass first; falls back to mock zones on any failure
 * (network error, non-OK response, parse error, no results).
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
      throw new Error('Overpass returned no elements');
    }

    const zones = data.elements
      .map(parseOverpassElement)
      .filter((zone): zone is Zone => zone !== null);

    if (!zones.length) {
      throw new Error('No usable values in Overpass response');
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

// --- OSM Overpass ---------------------------------------------------------

type OverpassResponse = {
  elements?: OverpassElement[];
};

type OverpassWay = {
  type: 'way';
  id: number;
  tags?: Record<string, string>;
  geometry?: { lat: number; lon: number }[];
};

type OverpassNode = {
  type: 'node';
  id: number;
  tags?: Record<string, string>;
  lat: number;
  lon: number;
};

type OverpassElement = OverpassWay | OverpassNode;

/**
 * Builds a multi-source Overpass QL query — combines all four thesis
 * factors (light, police, wildlife, road conditions) plus existing
 * landuse/park context into a single union.
 *
 * The `(...)` syntax is a union: every clause inside contributes to the
 * result set. Mixed `way[...]` and `node[...]` queries pull both
 * geometry kinds (e.g., police can be a building polygon OR a point
 * marker; speed cameras and wildlife crossings are always points).
 *
 * `out geom 60` returns up to 60 elements with their full coordinate
 * geometry. Cap is tuned for the public demo Overpass server's rate
 * limit and parse cost on dense urban areas — plenty for scoring (each
 * route waypoint just needs *some* zones to test against).
 */
function buildOverpassQuery(center: Coordinate): string {
  const radius = 1500; // meters
  const lat = center.latitude;
  const lng = center.longitude;
  return `
    [out:json][timeout:25];
    (
      way["highway"]["lit"](around:${radius},${lat},${lng});
      way["landuse"~"^(residential|commercial|industrial)$"](around:${radius},${lat},${lng});
      way["leisure"="park"](around:${radius},${lat},${lng});
      way["amenity"="police"](around:${radius},${lat},${lng});
      node["amenity"="police"](around:${radius},${lat},${lng});
      node["highway"="speed_camera"](around:${radius},${lat},${lng});
      node["hazard"="wildlife_crossing"](around:${radius},${lat},${lng});
      way["landuse"="forest"](around:${radius},${lat},${lng});
      way["natural"="wood"](around:${radius},${lat},${lng});
      way["highway"]["surface"~"^(unpaved|gravel|dirt|sand|ground)$"](around:${radius},${lat},${lng});
      way["highway"]["smoothness"~"^(bad|very_bad|horrible|impassable)$"](around:${radius},${lat},${lng});
      way["highway"="construction"](around:${radius},${lat},${lng});
    );
    out geom 60;
  `.trim();
}

/**
 * Dispatches an Overpass element to the right parser based on element
 * type and tags. Returns null when no parser claims the element.
 */
function parseOverpassElement(element: OverpassElement): Zone | null {
  if (!element.tags) return null;
  if (element.type === 'way') return parseOverpassWay(element);
  if (element.type === 'node') return parseOverpassNode(element);
  return null;
}

/**
 * Parses an Overpass way into a Zone, branching by which tag is present.
 * Tag-precedence order is intentional: more-specific tags win. A way
 * with both `highway` and `lit` is a lit street (polyline), not a
 * landuse polygon, even if it sits within one.
 */
function parseOverpassWay(way: OverpassWay): Zone | null {
  if (!way.geometry?.length) return null;

  const tags = way.tags ?? {};

  // OSM uses { lat, lon } in geometry; convert to our { latitude, longitude }
  // shape at the boundary so the rest of the codebase stays in one convention.
  const coordinates: Coordinate[] = way.geometry.map(({ lat, lon }) => ({
    latitude: lat,
    longitude: lon,
  }));

  // Lit street → polyline zone (lighting category)
  const litType = mapLitToZoneType(tags.lit);
  if (litType) {
    const streetName = tags.name ?? 'Unnamed street';
    return {
      id: `osm-way-${way.id}`,
      type: litType,
      label: `${streetName} (lit=${tags.lit})`,
      geometry: 'polyline',
      coordinates,
      category: 'lighting',
    };
  }

  // Highway-construction → polyline zone (road-condition, caution)
  if (tags.highway === 'construction') {
    return {
      id: `osm-way-${way.id}`,
      type: 'caution',
      label: `Construction: ${tags.name ?? 'Unnamed road'}`,
      geometry: 'polyline',
      coordinates,
      category: 'road-condition',
    };
  }

  // Smoothness-graded road → polyline zone (road-condition)
  // Must precede surface check: a road tagged both `surface=gravel` and
  // `smoothness=horrible` should pick up the harsher avoid classification.
  const smoothnessType = mapSmoothnessToZoneType(tags.smoothness);
  if (smoothnessType) {
    return {
      id: `osm-way-${way.id}`,
      type: smoothnessType,
      label: `Road condition: smoothness=${tags.smoothness}`,
      geometry: 'polyline',
      coordinates,
      category: 'road-condition',
    };
  }

  // Surface-graded road → polyline zone (road-condition, caution)
  if (tags.highway && isPoorSurface(tags.surface)) {
    return {
      id: `osm-way-${way.id}`,
      type: 'caution',
      label: `Road condition: surface=${tags.surface}`,
      geometry: 'polyline',
      coordinates,
      category: 'road-condition',
    };
  }

  // Police building → polygon zone (police category, caution)
  if (tags.amenity === 'police') {
    return {
      id: `osm-way-${way.id}`,
      type: 'caution',
      label: `Police: ${tags.name ?? 'Unnamed station'}`,
      geometry: 'polygon',
      coordinates,
      category: 'police',
    };
  }

  // Forest / wood → polygon zone (wildlife category, caution)
  // Tree coverage is a proxy for wildlife crossing risk; deer and other
  // animals emerge from wooded margins. Score is amplified ×2 at
  // dawn/dusk in lib/scoring.ts.
  if (tags.landuse === 'forest' || tags.natural === 'wood') {
    return {
      id: `osm-way-${way.id}`,
      type: 'caution',
      label: `Wildlife: ${tags.landuse ?? tags.natural}`,
      geometry: 'polygon',
      coordinates,
      category: 'wildlife',
    };
  }

  // Park → polygon zone (caution per nighttime-crime research)
  if (tags.leisure === 'park') {
    return {
      id: `osm-way-${way.id}`,
      type: 'caution',
      label: `Park: ${tags.name ?? 'Unnamed'}`,
      geometry: 'polygon',
      coordinates,
      category: 'park',
    };
  }

  // Landuse area → polygon zone
  const landuseType = mapLanduseToZoneType(tags.landuse);
  if (landuseType) {
    return {
      id: `osm-way-${way.id}`,
      type: landuseType,
      label: `Landuse: ${tags.landuse}`,
      geometry: 'polygon',
      coordinates,
      category: 'landuse',
    };
  }

  return null;
}

/**
 * Parses an Overpass node (point) into a Zone. Nodes carry a single
 * lat/lon directly (no geometry array), so coordinates is always a
 * single-element list.
 */
function parseOverpassNode(node: OverpassNode): Zone | null {
  const tags = node.tags ?? {};
  const coordinates: Coordinate[] = [
    { latitude: node.lat, longitude: node.lon },
  ];

  // Police station as point → caution
  if (tags.amenity === 'police') {
    return {
      id: `osm-node-${node.id}`,
      type: 'caution',
      label: `Police: ${tags.name ?? 'Unnamed station'}`,
      geometry: 'point',
      coordinates,
      category: 'police',
    };
  }

  // Speed camera → caution (police category — same agency-of-stop register)
  if (tags.highway === 'speed_camera') {
    return {
      id: `osm-node-${node.id}`,
      type: 'caution',
      label: `Speed camera`,
      geometry: 'point',
      coordinates,
      category: 'police',
    };
  }

  // Wildlife crossing marker → caution (wildlife category)
  if (tags.hazard === 'wildlife_crossing') {
    return {
      id: `osm-node-${node.id}`,
      type: 'caution',
      label: `Wildlife crossing`,
      geometry: 'point',
      coordinates,
      category: 'wildlife',
    };
  }

  return null;
}

// --- Tag-value mappings ---------------------------------------------------

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
 * incident data + community input).
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
 * Maps an OSM `smoothness` tag to a graduated zone type.
 * `bad` / `very_bad` are uncomfortable but passable → caution.
 * `horrible` / `impassable` are dangerous → avoid.
 */
function mapSmoothnessToZoneType(
  smoothness: string | undefined,
): ZoneType | null {
  switch (smoothness) {
    case 'bad':
    case 'very_bad':
      return 'caution';
    case 'horrible':
    case 'impassable':
      return 'avoid';
    default:
      return null;
  }
}

/**
 * Returns true for OSM `surface` values that indicate poor infrastructure.
 * Paved/asphalt/concrete are skipped (good surface = no caution signal).
 */
function isPoorSurface(surface: string | undefined): boolean {
  switch (surface) {
    case 'unpaved':
    case 'gravel':
    case 'dirt':
    case 'sand':
    case 'ground':
      return true;
    default:
      return false;
  }
}

// --- Mock fallback --------------------------------------------------------

/**
 * Hardcoded zones around the center point. Only used when Overpass is
 * unreachable or returns no usable data. Includes one example per
 * category so SHOW_ZONES=true still demonstrates the data layer
 * meaningfully even without network.
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
