// Fresh Greens — foreground passive tile warming (same-metro use case).
//
// Throttled: at most one new Overpass tile per PASSIVE_TILE_MIN_INTERVAL_MS
// while the app is open. Called from /home browse + after GPS fixes.

import {
  saveZoneTile,
  tileCenterForKey,
  tileKeyForCoordinate,
  loadZoneTile,
} from '../api/zone-tile-cache';
import type { Coordinate } from '../api/zones';
import { fetchZonesForTileWarm } from '../api/zones';
import { PASSIVE_TILE_MIN_INTERVAL_MS } from './constants';

let lastWarmAt = 0;
let lastWarmKey = '';
let warmInFlight: Promise<void> | null = null;

/**
 * Fetch and cache one grid tile around `center` if missing and throttle
 * allows. Fire-and-forget safe — errors are swallowed.
 */
export async function maybeWarmZoneTile(center: Coordinate): Promise<void> {
  const key = tileKeyForCoordinate(center);
  if (key === lastWarmKey && Date.now() - lastWarmAt < PASSIVE_TILE_MIN_INTERVAL_MS) {
    return;
  }
  if (Date.now() - lastWarmAt < PASSIVE_TILE_MIN_INTERVAL_MS) {
    return;
  }
  const existing = await loadZoneTile(key);
  if (existing && existing.length > 0) {
    lastWarmKey = key;
    lastWarmAt = Date.now();
    return;
  }
  if (warmInFlight) {
    return warmInFlight;
  }

  warmInFlight = (async () => {
    try {
      lastWarmKey = key;
      lastWarmAt = Date.now();
      const tileCenter = tileCenterForKey(key);
      const zones = await fetchZonesForTileWarm(tileCenter);
      await saveZoneTile(key, zones);
    } catch (err) {
      console.warn('[passive-zone-tiles] warm failed:', err);
    } finally {
      warmInFlight = null;
    }
  })();

  return warmInFlight;
}
