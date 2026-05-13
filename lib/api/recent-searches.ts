// Fresh Greens — recent searches adapter.
//
// Persists the user's last N picked search destinations. Same
// architectural shape as saved-places.ts / community-reports.ts:
// typed `RecentSearch`, async public surface, AsyncStorage backing,
// backend swap-in point preserved.
//
// "Recent" is *picked-from-results*, not *typed-and-discarded*. We
// don't log every keystroke that hit the autocomplete — only the
// places the user actually committed to by tapping a result row.
// That keeps the list curated and prevents accidental queries
// ("ass", "uhh") from showing up in the persistent UI.
//
// Storing lat/lng alongside the display name lets a recent re-tap
// route directly to the original coordinate without re-querying
// Mapbox. The user gets the *same place* every time, not "whatever
// Mapbox returns for this string today" — important because POI
// data shifts and a string-only retry could land somewhere else.

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'fresh-greens.recent-searches.v1';

/**
 * Cap on stored recents. 8 is a tradeoff: enough for "the four
 * places I drive to most often plus a few one-offs" without growing
 * the recent-list scroll into a second screen. The cap is enforced
 * at write time, so the persisted array is never larger than N.
 */
const MAX_RECENTS = 8;

export type RecentSearch = {
  /** Stable id from the underlying geocoder (mapbox_id). */
  id: string;
  /** Display name (e.g. "L'industrie Pizzeria"). */
  name: string;
  /** Resolved address, used as the secondary line on the row. */
  address: string;
  latitude: number;
  longitude: number;
  /** ms timestamp; drives newest-first ordering. */
  savedAt: number;
};

// --- Public surface ------------------------------------------------------

/** Reads recents, newest-first. */
export async function getRecentSearches(): Promise<RecentSearch[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RecentSearch[];
    if (!Array.isArray(parsed)) return [];
    return parsed.sort((a, b) => b.savedAt - a.savedAt);
  } catch (err) {
    console.warn('getRecentSearches failed', err);
    return [];
  }
}

/**
 * Adds a recent. Dedups by `id` — re-tapping a place that's already
 * in the list bumps its `savedAt` rather than appending a duplicate.
 * Enforces the cap by dropping the oldest entry when the list grows
 * past MAX_RECENTS.
 */
export async function addRecentSearch(
  input: Omit<RecentSearch, 'savedAt'>,
): Promise<RecentSearch> {
  const record: RecentSearch = { ...input, savedAt: Date.now() };
  try {
    const existing = await getRecentSearches();
    // Drop any prior entry with the same id (dedup); prepend the new
    // record; slice to the cap. The result is always newest-first
    // because we just prepended a Date.now().
    const next = [record, ...existing.filter((r) => r.id !== record.id)]
      .slice(0, MAX_RECENTS);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch (err) {
    console.warn('addRecentSearch failed', err);
  }
  return record;
}

/** Removes a single recent by id. */
export async function removeRecentSearch(id: string): Promise<void> {
  try {
    const existing = await getRecentSearches();
    const next = existing.filter((r) => r.id !== id);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch (err) {
    console.warn('removeRecentSearch failed', err);
  }
}

/** Wipes all recents — for a future "clear history" affordance. */
export async function clearRecentSearches(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.warn('clearRecentSearches failed', err);
  }
}
