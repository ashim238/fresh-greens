// Fresh Greens — saved-places adapter.
//
// Persists the user's saved spatial anchors (home, landmarks). Same
// architectural shape as user.ts / trusted-contact.ts / recordings.ts:
// typed `SavedPlace`, async public surface, AsyncStorage backing,
// backend swap-in point preserved.
//
// v1 supports a single 'home' kind plus open-ended 'landmark' kinds.
// The map screen renders these as custom Markers and as edge
// indicators when they're outside the current viewport.

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'fresh-greens.saved-places.v1';

/**
 * Per-axis bounding-box half-width in degrees — same convention as
 * `regular-destinations.ts` MATCH_DELTA_DEG (~±200m). Keeps saved-
 * place proximity checks aligned across /search, /home, and adapters.
 */
export const SAVED_PLACE_MATCH_DELTA_DEG = 0.002;

export type SavedPlaceKind = 'home' | 'landmark';

export type SavedPlace = {
  id: string;
  kind: SavedPlaceKind;
  /** Display name (e.g. "Home", "Mom's house"). */
  name: string;
  latitude: number;
  longitude: number;
  /** ms timestamp of when this was saved. */
  setAt: number;
};

// --- Public surface ------------------------------------------------------

/** Reads all saved places, oldest first. */
export async function getSavedPlaces(): Promise<SavedPlace[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as SavedPlace[];
    if (!Array.isArray(parsed)) return [];
    return parsed.sort((a, b) => a.setAt - b.setAt);
  } catch (err) {
    console.warn('getSavedPlaces failed', err);
    return [];
  }
}

/** Reads the user's saved home, if any. v1 enforces "one home at a time". */
export async function getSavedHome(): Promise<SavedPlace | null> {
  const all = await getSavedPlaces();
  return all.find((p) => p.kind === 'home') ?? null;
}

/**
 * Returns a saved place within ~200m of the coordinate, if any. Pure —
 * pass the list from `getSavedPlaces` or `useSavedPlaces`.
 */
export function findSavedPlaceNear(
  latitude: number,
  longitude: number,
  list: SavedPlace[],
): SavedPlace | undefined {
  return list.find(
    (p) =>
      Math.abs(p.latitude - latitude) < SAVED_PLACE_MATCH_DELTA_DEG &&
      Math.abs(p.longitude - longitude) < SAVED_PLACE_MATCH_DELTA_DEG,
  );
}

/**
 * Persists a saved place. If the new place is `kind: 'home'`, any
 * existing home is replaced (one-home-at-a-time invariant).
 */
export async function addSavedPlace(input: {
  kind: SavedPlaceKind;
  name: string;
  latitude: number;
  longitude: number;
}): Promise<SavedPlace> {
  const place: SavedPlace = {
    id: `place-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    setAt: Date.now(),
    ...input,
  };

  const existing = await getSavedPlaces();
  const next =
    input.kind === 'home'
      ? [...existing.filter((p) => p.kind !== 'home'), place]
      : [...existing, place];

  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return place;
}

/** Removes a saved place by id. */
export async function removeSavedPlace(id: string): Promise<void> {
  const all = await getSavedPlaces();
  const remaining = all.filter((p) => p.id !== id);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(remaining));
}

/** Sign-out / factory-reset cleanup. */
export async function clearSavedPlaces(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}
