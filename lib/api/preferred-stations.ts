// Fresh Greens — preferred-stations adapter.
//
// Persists gas/charging stations the user has marked as trusted. Same
// architectural shape as saved-places.ts: typed PreferredStation, async
// public surface, AsyncStorage backing, backend swap-in preserved.
//
// Identity is by PROXIMITY, not POI id — the same station retrieved from
// search (Nominatim) vs on-route (Overpass) carries a different id, so
// id-matching would treat them as different places. We match on lat/lng
// within PREFERRED_MATCH_DELTA, the same technique regular-destinations.ts
// and the /search saved-row merge already use.
//
// Spec: docs/superpowers/specs/2026-06-02-preferred-stations-design.md

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'fresh-greens.preferred-stations.v1';

// ~0.0007° ≈ 78m of latitude — tighter than the 0.002° (~222m) used for
// destination matching, because distinct gas stations can sit close
// together and we don't want to conflate two real ones. Exported as the
// single source of truth: the hook + every proximity check derive from
// this so a retune can't desync toggle-remove from isPreferred.
export const PREFERRED_MATCH_DELTA = 0.0007;

export type PreferredStation = {
  id: string;
  /** Station name as shown ("Wawa", "Shell"). */
  name: string;
  /** Optional brand, when distinguishable from name. */
  brand?: string;
  latitude: number;
  longitude: number;
  /** ms timestamp of when this was starred. */
  setAt: number;
};

/** Case/whitespace-insensitive name key for matching. */
function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * Two station-like records refer to the same station when their names
 * match AND they sit within PREFERRED_MATCH_DELTA. Name is the
 * disambiguator — proximity alone conflated distinct neighbors (a Shell
 * and a Wawa within ~78m both read as "preferred", lighting two stars
 * for one tap). Exported so the hook matches identically (single source).
 */
export function stationsMatch(
  a: { name: string; latitude: number; longitude: number },
  b: { name: string; latitude: number; longitude: number },
): boolean {
  return (
    normalizeName(a.name) === normalizeName(b.name) &&
    Math.abs(a.latitude - b.latitude) < PREFERRED_MATCH_DELTA &&
    Math.abs(a.longitude - b.longitude) < PREFERRED_MATCH_DELTA
  );
}

/** Reads all preferred stations, newest first. */
export async function getPreferredStations(): Promise<PreferredStation[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PreferredStation[];
    if (!Array.isArray(parsed)) return [];
    return parsed.sort((a, b) => b.setAt - a.setAt);
  } catch (err) {
    console.warn('getPreferredStations failed', err);
    return [];
  }
}

/**
 * Stars a station. No-op-returns the existing entry if one already sits
 * within PREFERRED_MATCH_DELTA (dedupe against Nominatim/Overpass jitter).
 */
export async function addPreferredStation(input: {
  name: string;
  brand?: string;
  latitude: number;
  longitude: number;
}): Promise<PreferredStation> {
  const existing = await getPreferredStations();
  const dup = existing.find((s) => stationsMatch(s, input));
  if (dup) return dup;

  const station: PreferredStation = {
    id: `station-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    setAt: Date.now(),
    ...input,
  };
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([...existing, station]));
  return station;
}

/** Removes a preferred station by id. */
export async function removePreferredStation(id: string): Promise<void> {
  const all = await getPreferredStations();
  await AsyncStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(all.filter((s) => s.id !== id)),
  );
}

/** True if `place` (by name + proximity) is a preferred station. */
export async function isPreferredStation(place: {
  name: string;
  latitude: number;
  longitude: number;
}): Promise<boolean> {
  const all = await getPreferredStations();
  return all.some((s) => stationsMatch(s, place));
}

/** Sign-out / factory-reset cleanup. */
export async function clearPreferredStations(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}
