// Fresh Greens — regular-destinations adapter.
//
// Persists destinations the user has marked "regular" from the
// post-trip summary ("Set as default"). Same architectural shape as
// saved-places.ts / recent-searches.ts: typed record, async public
// surface, AsyncStorage backing, backend swap-in point preserved.
//
// This is the frequency signal `home.tsx`'s `isRegularDestination`
// reads to decide whether to render the recurring-destination
// underline (the "save this as home/work" invitation). It's the first
// concrete piece of the thesis's adaptive-personalization spine (C15) —
// a marked-regular destination is a habitual route the home surface can
// eventually personalize around.

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'fresh-greens.regular-destinations.v1';

// Per-axis bounding-box half-width in degrees (NOT a geodesic radius).
// ~0.002° is roughly ±222m of latitude and, at mid-latitudes, a shorter
// ±150-170m of longitude — so the match region is an anisotropic ~box,
// not a circle. Fine for a v1 frequency signal where a false-merge of
// two nearby destinations is cheap. Two arrivals at "the same place"
// rarely share exact GPS, so anything within the box is treated as the
// same regular (incrementing its count rather than duplicating).
const MATCH_DELTA_DEG = 0.002;

export type RegularDestination = {
  id: string;
  /** Display name, e.g. the destination label from the trip. */
  name: string;
  latitude: number;
  longitude: number;
  /** Times marked regular — a frequency signal for future ranking. */
  count: number;
  /** ms timestamp of the most recent mark. */
  setAt: number;
};

// --- Public surface ------------------------------------------------------

/** Reads all regular destinations. */
export async function getRegularDestinations(): Promise<RegularDestination[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RegularDestination[];
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn('getRegularDestinations failed', err);
    return [];
  }
}

/**
 * True when (latitude, longitude) is within ~200m of any stored regular
 * destination. Pure — pass the list from `getRegularDestinations` (or
 * the `useRegularDestinations` hook) so callers control the read.
 */
export function isRegularLocation(
  latitude: number,
  longitude: number,
  list: RegularDestination[],
): boolean {
  return list.some(
    (r) =>
      Math.abs(r.latitude - latitude) < MATCH_DELTA_DEG &&
      Math.abs(r.longitude - longitude) < MATCH_DELTA_DEG,
  );
}

/**
 * Marks a destination as regular. If one already exists within ~200m,
 * increments its count (frequency) + refreshes its timestamp instead of
 * creating a duplicate. Returns the stored record.
 */
export async function addRegularDestination(input: {
  name: string;
  latitude: number;
  longitude: number;
}): Promise<RegularDestination> {
  const all = await getRegularDestinations();
  const existing = all.find(
    (r) =>
      Math.abs(r.latitude - input.latitude) < MATCH_DELTA_DEG &&
      Math.abs(r.longitude - input.longitude) < MATCH_DELTA_DEG,
  );
  if (existing) {
    existing.count += 1;
    existing.setAt = Date.now();
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    return existing;
  }
  const record: RegularDestination = {
    id: `regular-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    count: 1,
    setAt: Date.now(),
    ...input,
  };
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([...all, record]));
  return record;
}

/** Sign-out / factory-reset cleanup. */
export async function clearRegularDestinations(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}
