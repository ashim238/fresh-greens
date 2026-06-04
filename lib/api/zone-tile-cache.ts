// Fresh Greens — passive metro tile cache for OSM corridor samples.
//
// Fixed grid cells (~12 km) filled in the background on /home browse and
// read before Overpass in fetchCorridorSample. LRU + 24h TTL.

import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  ZONE_TILE_LAT_DEG,
  ZONE_TILE_LNG_DEG,
  ZONE_TILE_MAX_ENTRIES,
  ZONE_TILE_RADIUS_M,
  ZONE_TILE_TTL_MS,
} from '../corridor/constants';
import type { Coordinate, Zone, ZoneBounds } from './zones';

const STORAGE_KEY = '@fresh-greens/zone-tiles-v1';

type TileEntry = {
  zones: Zone[];
  cachedAt: number;
};

type TileStore = Record<string, TileEntry>;

export function tileCenterForKey(key: string): Coordinate {
  const [lat, lng] = key.split(',').map(Number);
  return {
    latitude: lat + ZONE_TILE_LAT_DEG / 2,
    longitude: lng + ZONE_TILE_LNG_DEG / 2,
  };
}

/** Grid key for the tile containing `coord`. */
export function tileKeyForCoordinate(coord: Coordinate): string {
  const lat =
    Math.floor(coord.latitude / ZONE_TILE_LAT_DEG) * ZONE_TILE_LAT_DEG;
  const lng =
    Math.floor(coord.longitude / ZONE_TILE_LNG_DEG) * ZONE_TILE_LNG_DEG;
  return `${lat.toFixed(4)},${lng.toFixed(4)}`;
}

export function tileBoundsForKey(key: string): ZoneBounds {
  const [lat, lng] = key.split(',').map(Number);
  return {
    south: lat,
    west: lng,
    north: lat + ZONE_TILE_LAT_DEG,
    east: lng + ZONE_TILE_LNG_DEG,
  };
}

function boundsOverlap(a: ZoneBounds, b: ZoneBounds): boolean {
  return !(
    a.south > b.north ||
    a.north < b.south ||
    a.west > b.east ||
    a.east < b.west
  );
}

/** Tile keys whose cells intersect `bounds`. */
export function tileKeysCoveringBounds(bounds: ZoneBounds): string[] {
  const keys = new Set<string>();
  const startLat =
    Math.floor(bounds.south / ZONE_TILE_LAT_DEG) * ZONE_TILE_LAT_DEG;
  const endLat =
    Math.floor(bounds.north / ZONE_TILE_LAT_DEG) * ZONE_TILE_LAT_DEG;
  const startLng =
    Math.floor(bounds.west / ZONE_TILE_LNG_DEG) * ZONE_TILE_LNG_DEG;
  const endLng =
    Math.floor(bounds.east / ZONE_TILE_LNG_DEG) * ZONE_TILE_LNG_DEG;

  for (let lat = startLat; lat <= endLat + 1e-9; lat += ZONE_TILE_LAT_DEG) {
    for (let lng = startLng; lng <= endLng + 1e-9; lng += ZONE_TILE_LNG_DEG) {
      keys.add(`${lat.toFixed(4)},${lng.toFixed(4)}`);
    }
  }
  return [...keys];
}

async function readStore(): Promise<TileStore> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as TileStore;
  } catch {
    return {};
  }
}

async function writeStore(store: TileStore): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch (err) {
    console.warn('[zone-tile-cache] write failed:', err);
  }
}

function pruneStore(store: TileStore): TileStore {
  const now = Date.now();
  const fresh: TileStore = {};
  for (const [key, entry] of Object.entries(store)) {
    if (now - entry.cachedAt <= ZONE_TILE_TTL_MS) {
      fresh[key] = entry;
    }
  }
  const keys = Object.keys(fresh);
  if (keys.length <= ZONE_TILE_MAX_ENTRIES) return fresh;
  keys.sort((a, b) => fresh[a].cachedAt - fresh[b].cachedAt);
  const drop = keys.length - ZONE_TILE_MAX_ENTRIES;
  for (let i = 0; i < drop; i++) {
    delete fresh[keys[i]];
  }
  return fresh;
}

export async function loadZoneTile(key: string): Promise<Zone[] | null> {
  const store = await readStore();
  const entry = store[key];
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > ZONE_TILE_TTL_MS) return null;
  return entry.zones;
}

export async function saveZoneTile(key: string, zones: Zone[]): Promise<void> {
  let store = pruneStore(await readStore());
  store[key] = { zones, cachedAt: Date.now() };
  store = pruneStore(store);
  await writeStore(store);
}

function mergeZonesById(batches: Zone[][]): Zone[] {
  const byId = new Map<string, Zone>();
  for (const batch of batches) {
    for (const z of batch) {
      byId.set(z.id, z);
    }
  }
  return [...byId.values()];
}

/**
 * Cached zones for an `around` sample when the request fits one warmed tile.
 */
export async function getZonesForAroundFromTiles(
  center: Coordinate,
  radiusMeters: number,
): Promise<Zone[] | null> {
  if (radiusMeters > ZONE_TILE_RADIUS_M) return null;
  const key = tileKeyForCoordinate(center);
  const zones = await loadZoneTile(key);
  return zones && zones.length > 0 ? zones : null;
}

/**
 * Merge cached tiles overlapping a bbox (metro passive warm).
 */
export async function getZonesForBboxFromTiles(
  bounds: ZoneBounds,
): Promise<Zone[] | null> {
  const keys = tileKeysCoveringBounds(bounds);
  const batches: Zone[][] = [];
  for (const key of keys) {
    const zones = await loadZoneTile(key);
    if (zones && zones.length > 0) {
      const tileBounds = tileBoundsForKey(key);
      if (boundsOverlap(bounds, tileBounds)) {
        batches.push(zones);
      }
    }
  }
  if (batches.length === 0) return null;
  return mergeZonesById(batches);
}

export async function storeZonesForAroundTile(
  center: Coordinate,
  zones: Zone[],
): Promise<void> {
  if (zones.length === 0) return;
  const key = tileKeyForCoordinate(center);
  await saveZoneTile(key, zones);
}

/** After a bbox fetch, fan the result into every overlapping tile slot. */
export async function storeZonesForBboxTiles(
  bounds: ZoneBounds,
  zones: Zone[],
): Promise<void> {
  if (zones.length === 0) return;
  for (const key of tileKeysCoveringBounds(bounds)) {
    await saveZoneTile(key, zones);
  }
}
