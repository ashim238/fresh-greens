// Fresh Greens — active-route AsyncStorage cache.
//
// **Why this exists, in one line:** if a user drives into a dead-signal
// area mid-trip (rural, mountain pass, tunnel), /en-route should still
// know the route + turn-by-turn instead of going blind.
//
// The Green Book parallel is exact — the original was created because
// Black motorists in rural areas without service stations or signal had
// no way to navigate safely. Offline route caching is the digital
// equivalent: pre-fetch the route while signal is good (the user picks
// a destination on city wifi, say, before driving rural), then survive
// the signal loss.
//
// Storage shape: single-slot, keyed only by destination (grid-rounded
// to ~50m so microscopic destination jitter from re-tapping a pin
// doesn't invalidate the cache). One active route at a time — the
// caller (getRoutesBetween) calls saveActiveRoute on every successful
// network fetch (Mapbox or OSRM), which overwrites the previous
// active route. Cross-call interleaving (rapid destination changes,
// or home + en-route firing concurrent fetches for the same dest) is
// resolved by last-write-wins — correct semantic since the cache key
// is grid-rounded destination, so concurrent calls target the same
// slot and the freshest write reflects the most recent successful
// fetch.
//
// Cache key is origin-agnostic by design: mid-trip, the user's origin
// has shifted from where they started, but the cached route from the
// start IS still the route they're on. Re-keying by origin would
// invalidate the cache the moment they started driving — defeating
// the offline purpose. The trade-off is that a totally different
// origin → same destination wouldn't get a recomputed route from
// cache. Acceptable since OSRM re-runs at every destination-pick.
//
// TTL: 24 hours. Older than that and we don't trust the data — road
// closures, construction, OSM updates. Driver sees a "saved route is
// stale" copy and is prompted to re-fetch when signal returns.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { runBestEffortAccountOperation } from '../account-session/operation-gate';

import type { Coordinate } from './zones';
import type { Route } from './routes';

const STORAGE_KEY = '@fresh-greens/active-route-cache';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

type CachedActiveRoute = {
  routes: Route[];
  destination: Coordinate;
  /** Wall-clock timestamp at write — used for TTL + age display. */
  cachedAt: number;
};

/**
 * Rounds a coord to a ~50m grid for cache-key matching. Without this,
 * a user who picks a destination from /search (one set of decimals)
 * then re-taps the same pin on /home (slightly different decimals
 * from a re-geocode) would get cache misses. 0.0005° ≈ 55m at the
 * equator, less at higher latitudes — fine for cache identity.
 *
 * TODO: ~50m can collide adjacent POIs on the same block. Acceptable
 * for single-slot v1 (the most-recently-saved route wins); revisit
 * if/when the cache holds multiple destinations.
 */
function gridKey(c: Coordinate): string {
  const lat = Math.round(c.latitude * 2000) / 2000;
  const lng = Math.round(c.longitude * 2000) / 2000;
  return `${lat},${lng}`;
}

/**
 * Writes the active route to cache. Best-effort — failures
 * (AsyncStorage quota, JSON.stringify edge case) are logged but
 * don't throw, since the caller's primary job is returning routes
 * to the consumer.
 */
export async function saveActiveRoute(
  routes: Route[],
  destination: Coordinate,
): Promise<void> {
  await runBestEffortAccountOperation(async () => {
    const payload: CachedActiveRoute = {
      routes,
      destination,
      cachedAt: Date.now(),
    };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, (error) => console.warn('[route-cache] save failed:', error));
}

/**
 * Loads the active route IF its cached destination matches the
 * requested destination (grid-rounded) AND it's within TTL. Returns
 * the routes + the cache age in ms (consumer can decide to surface
 * "X minutes ago" if useful).
 *
 * Returns null on:
 *   - empty cache
 *   - destination mismatch (different trip)
 *   - past TTL (stale data — don't trust it)
 *   - parse error (corrupted entry)
 */
export async function loadActiveRoute(
  destination: Coordinate,
): Promise<{ routes: Route[]; ageMs: number } | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const cached: CachedActiveRoute = JSON.parse(raw);
    if (gridKey(cached.destination) !== gridKey(destination)) return null;
    const age = Date.now() - cached.cachedAt;
    if (age > CACHE_TTL_MS) return null;
    return { routes: cached.routes, ageMs: age };
  } catch (err) {
    console.warn('[route-cache] load failed:', err);
    return null;
  }
}

/**
 * Wipes the single-slot active-route cache. Called on trip-end
 * arrival (app/en-route.tsx) so a subsequent trip to the same
 * destination from a different origin doesn't briefly render the
 * prior route shape before the fresh network fetch (Mapbox or OSRM)
 * lands. Also intended for any future explicit "clear destination"
 * flow.
 */
export async function clearActiveRoute(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.warn('[route-cache] clear failed:', err);
  }
}

/**
 * Account-isolation purge path. Throwing here lets the session purge
 * coordinator report a location-bearing cache that still remains.
 */
export async function purgeActiveRouteForAccount(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}
