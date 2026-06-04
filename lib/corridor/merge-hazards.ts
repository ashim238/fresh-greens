import type { Coordinate, Zone, ZoneSourceId } from '../api/zones';
import { HAZARD_GRID_METERS, HAZARD_MERGE_ENABLED } from './constants';

export type HazardBucket = 'low-light' | 'police' | 'wildlife' | 'road' | 'community';

const SOURCE_PRECEDENCE: ZoneSourceId[] = [
  'community-report',
  'dot-511',
  'mapbox-incidents',
  'osm-overpass',
];

/** Chip-aligned bucket; null = skip L3 (score-only / safe). */
export function hazardBucketForZone(zone: Zone): HazardBucket | null {
  if (zone.type === 'safe') return null;
  switch (zone.category) {
    case 'lighting':
      return zone.type === 'avoid' || zone.type === 'caution' ? 'low-light' : null;
    case 'police':
      return 'police';
    case 'wildlife':
      return 'wildlife';
    case 'road-condition':
      return 'road';
    case 'community-report':
      return zone.type === 'avoid' ? 'community' : null;
    default:
      return null;
  }
}

function anchorCoordinate(zone: Zone): Coordinate | null {
  const coords = zone.coordinates;
  if (coords.length === 0) return null;
  if (zone.geometry === 'point') return coords[0];
  if (zone.geometry === 'polyline') {
    return coords[Math.floor(coords.length / 2)] ?? coords[0];
  }
  let south = Infinity;
  let north = -Infinity;
  let west = Infinity;
  let east = -Infinity;
  for (const p of coords) {
    south = Math.min(south, p.latitude);
    north = Math.max(north, p.latitude);
    west = Math.min(west, p.longitude);
    east = Math.max(east, p.longitude);
  }
  return { latitude: (south + north) / 2, longitude: (west + east) / 2 };
}

function snapGrid(coord: Coordinate): { gridLat: number; gridLng: number } {
  const metersPerDegLat = 111_320;
  const metersPerDegLng =
    metersPerDegLat * Math.cos((coord.latitude * Math.PI) / 180);
  const gridLatDeg = HAZARD_GRID_METERS / metersPerDegLat;
  const gridLngDeg = HAZARD_GRID_METERS / Math.max(metersPerDegLng, 1);
  return {
    gridLat: Math.round(coord.latitude / gridLatDeg) * gridLatDeg,
    gridLng: Math.round(coord.longitude / gridLngDeg) * gridLngDeg,
  };
}

export function canonicalHazardKeyForZone(zone: Zone): string | undefined {
  const bucket = hazardBucketForZone(zone);
  if (!bucket) return undefined;
  const anchor = anchorCoordinate(zone);
  if (!anchor) return undefined;
  const { gridLat, gridLng } = snapGrid(anchor);
  return `${bucket}:${gridLat.toFixed(5)}:${gridLng.toFixed(5)}`;
}

function sourceRank(source: ZoneSourceId | undefined): number {
  if (!source) return SOURCE_PRECEDENCE.length;
  const idx = SOURCE_PRECEDENCE.indexOf(source);
  return idx === -1 ? SOURCE_PRECEDENCE.length : idx;
}

/**
 * L3 cross-source collapse (Part B½). Groups by `canonicalHazardKey`, keeps
 * highest-precedence source per group.
 */
export function collapseHazardZones(zones: Zone[]): Zone[] {
  if (!HAZARD_MERGE_ENABLED) return zones;

  const passthrough: Zone[] = [];
  const groups = new Map<string, Zone[]>();

  for (const zone of zones) {
    const key = canonicalHazardKeyForZone(zone);
    if (!key) {
      passthrough.push(zone);
      continue;
    }
    const list = groups.get(key) ?? [];
    list.push(zone);
    groups.set(key, list);
  }

  const merged: Zone[] = [...passthrough];
  for (const group of groups.values()) {
    let winner = group[0];
    for (let i = 1; i < group.length; i++) {
      if (sourceRank(group[i].source) < sourceRank(winner.source)) {
        winner = group[i];
      }
    }
    merged.push({
      ...winner,
      canonicalHazardKey: canonicalHazardKeyForZone(winner),
    });
  }
  return merged;
}
