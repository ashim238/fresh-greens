// Fresh Greens — OSM Overpass zone adapter (B0).
//
// Builds multi-source Overpass QL queries and maps elements → Zone[].
// Used by browse (`getZonesForRegion`) and corridor (`fetchCorridorSample`)
// so trip and browse share the same selector + parser surface.

import type { Coordinate, Zone, ZoneBounds, ZoneType } from '../zones';

const OVERPASS_AROUND_DEFAULT_RADIUS_M = 1500;

/** B0: extended selectors; `spatial` is `(around:R,lat,lng)` or `(south,west,north,east)`. */
export function overpassZoneSelectors(spatial: string): string {
  return `
      way["highway"]["lit"]${spatial};
      way["tunnel"]["lit"="no"]${spatial};
      way["bridge"]["lit"="no"]${spatial};
      way["landuse"~"^(residential|commercial|industrial)$"]${spatial};
      way["leisure"="park"]${spatial};
      way["amenity"="police"]${spatial};
      node["amenity"="police"]${spatial};
      node["highway"="speed_camera"]${spatial};
      node["enforcement"="maxspeed"]${spatial};
      node["hazard"="wildlife_crossing"]${spatial};
      node["highway"="traffic_calming"]${spatial};
      node["railway"="level_crossing"]${spatial};
      node["highway"="crossing"]["crossing"~"^(uncontrolled|unmarked)$"]${spatial};
      way["landuse"="forest"]${spatial};
      way["natural"="wood"]${spatial};
      way["highway"]["surface"~"^(unpaved|gravel|dirt|sand|ground)$"]${spatial};
      way["highway"]["smoothness"~"^(bad|very_bad|horrible|impassable)$"]${spatial};
      way["highway"="construction"]${spatial};
  `.trim();
}

export function buildOverpassQueryAround(
  center: Coordinate,
  radius: number = OVERPASS_AROUND_DEFAULT_RADIUS_M,
): string {
  const spatial = `(around:${radius},${center.latitude},${center.longitude})`;
  return `
    [out:json][timeout:25];
    (
      ${overpassZoneSelectors(spatial)}
    );
    out geom 72;
  `.trim();
}

export function buildOverpassQueryBbox(bounds: ZoneBounds): string {
  const { south, west, north, east } = bounds;
  const spatial = `(${south},${west},${north},${east})`;
  return `
    [out:json][timeout:25];
    (
      ${overpassZoneSelectors(spatial)}
    );
    out geom 140;
  `.trim();
}

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

export function parseOverpassElements(
  elements: OverpassElement[],
): Zone[] {
  return elements
    .map(parseOverpassElement)
    .filter((zone): zone is Zone => zone !== null)
    .map((zone) => ({ ...zone, source: 'osm-overpass' as const }));
}

function parseOverpassElement(element: OverpassElement): Zone | null {
  if (!element.tags) return null;
  if (element.type === 'way') return parseOverpassWay(element);
  if (element.type === 'node') return parseOverpassNode(element);
  return null;
}

function parseOverpassWay(way: OverpassWay): Zone | null {
  if (!way.geometry?.length) return null;

  const tags = way.tags ?? {};
  const coordinates: Coordinate[] = way.geometry.map(({ lat, lon }) => ({
    latitude: lat,
    longitude: lon,
  }));

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

  if (
    tags.lit === 'no' &&
    (tags.tunnel === 'yes' || tags.bridge === 'yes')
  ) {
    const kind = tags.tunnel === 'yes' ? 'Tunnel' : 'Bridge';
    return {
      id: `osm-way-${way.id}`,
      type: 'avoid',
      label: `${kind}: unlit (${tags.name ?? 'Unnamed'})`,
      geometry: 'polyline',
      coordinates,
      category: 'lighting',
    };
  }

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

function parseOverpassNode(node: OverpassNode): Zone | null {
  const tags = node.tags ?? {};
  const coordinates: Coordinate[] = [
    { latitude: node.lat, longitude: node.lon },
  ];

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

  if (tags.highway === 'speed_camera' || tags.enforcement === 'maxspeed') {
    return {
      id: `osm-node-${node.id}`,
      type: 'caution',
      label: tags.enforcement === 'maxspeed' ? 'Speed enforcement' : 'Speed camera',
      geometry: 'point',
      coordinates,
      category: 'police',
    };
  }

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

  if (tags.highway === 'traffic_calming') {
    return {
      id: `osm-node-${node.id}`,
      type: 'caution',
      label: `Traffic calming: ${tags.traffic_calming ?? 'device'}`,
      geometry: 'point',
      coordinates,
      category: 'road-condition',
    };
  }

  if (tags.railway === 'level_crossing') {
    return {
      id: `osm-node-${node.id}`,
      type: 'caution',
      label: `Railway level crossing`,
      geometry: 'point',
      coordinates,
      category: 'road-condition',
    };
  }

  if (
    tags.highway === 'crossing' &&
    (tags.crossing === 'uncontrolled' || tags.crossing === 'unmarked')
  ) {
    return {
      id: `osm-node-${node.id}`,
      type: 'caution',
      label: `Uncontrolled crossing`,
      geometry: 'point',
      coordinates,
      category: 'road-condition',
    };
  }

  return null;
}

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

function mapLanduseToZoneType(landuse: string | undefined): ZoneType | null {
  switch (landuse) {
    case 'residential':
      return 'safe';
    case 'commercial':
      return 'caution';
    case 'industrial':
      return 'avoid';
    default:
      return null;
  }
}

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
