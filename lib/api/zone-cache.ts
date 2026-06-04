// Fresh Greens — corridor OSM zone AsyncStorage cache.
//
// Handoff from /home preview to /en-route: when the user taps Go,
// en-route can hydrate zones immediately instead of re-fetching the
// full corridor. Single-slot, destination grid-keyed (same ~50m
// rounding as route-cache.ts). OSM-only — community reports stay
// screen-local.

import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  ZONE_CACHE_KEY_INCLUDES_ROUTE_ID,
  ZONE_CACHE_TTL_MS,
} from '../corridor/constants';
import type { Coordinate, Zone } from './zones';

const STORAGE_KEY = '@fresh-greens/corridor-zones-cache';

type CachedCorridorZones = {
  zones: Zone[];
  destination: Coordinate;
  pathMeters: number;
  routeId?: string;
  cachedAt: number;
};

/** Same ~50m grid as route-cache.ts destination key (factor 2000). */
function gridKey(c: Coordinate): string {
  const lat = Math.round(c.latitude * 2000) / 2000;
  const lng = Math.round(c.longitude * 2000) / 2000;
  return `${lat},${lng}`;
}

export async function saveCorridorZones(
  zones: Zone[],
  destination: Coordinate,
  meta: { pathMeters: number; routeId?: string },
): Promise<void> {
  try {
    const payload: CachedCorridorZones = {
      zones,
      destination,
      pathMeters: meta.pathMeters,
      routeId: meta.routeId,
      cachedAt: Date.now(),
    };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (err) {
    console.warn('[zone-cache] save failed:', err);
  }
}

export async function loadCorridorZones(
  destination: Coordinate,
  routeId?: string,
): Promise<{ zones: Zone[]; pathMeters: number; ageMs: number } | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const cached: CachedCorridorZones = JSON.parse(raw);
    if (gridKey(cached.destination) !== gridKey(destination)) return null;
    if (
      ZONE_CACHE_KEY_INCLUDES_ROUTE_ID &&
      routeId &&
      cached.routeId !== routeId
    ) {
      return null;
    }
    const age = Date.now() - cached.cachedAt;
    if (age > ZONE_CACHE_TTL_MS) return null;
    return { zones: cached.zones, pathMeters: cached.pathMeters, ageMs: age };
  } catch (err) {
    console.warn('[zone-cache] load failed:', err);
    return null;
  }
}

export async function clearCorridorZones(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.warn('[zone-cache] clear failed:', err);
  }
}
