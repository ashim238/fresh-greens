// Fresh Greens — user preferences adapter.
//
// AsyncStorage-backed bag of toggleable preferences. Same architectural
// shape as user.ts and trusted-contact.ts: typed `Preferences`, async
// public surface, AsyncStorage internals, backend swap-in point preserved.
//
// Started with a single preference (`showZones`) so /menu has something
// real to toggle. As more toggles arrive (theme, auto-record, etc.),
// they go on this same Preferences object — one storage key, one
// adapter, one hook. Avoids the "every preference is its own
// AsyncStorage entry" pattern that gets messy fast.
//
// Defaults are returned when nothing's stored yet — the first read on a
// fresh install gives a complete Preferences object, no null-checks
// needed at the call site.

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'fresh-greens.preferences.v1';

export type Preferences = {
  /**
   * Whether to render the zone-overlay layer (lighting/landuse/police/
   * wildlife/road-condition zones) on top of the route on /home.
   * Useful for thesis screenshots that need to show the data layer;
   * default off so users see a clean route map.
   */
  showZones: boolean;
  /** Flag areas near police presence (station / speed camera) — feeds
      route scoring + map flags. */
  flagPolice: boolean;
  /** Flag poorly-lit streets / areas. */
  flagLowLight: boolean;
  /** Factor in neighbor-submitted felt-unsafe / incident / hazard reports. */
  flagCommunityReports: boolean;
};

export const DEFAULT_PREFERENCES: Preferences = {
  showZones: false,
  flagPolice: true,
  flagLowLight: true,
  flagCommunityReports: true,
};

// --- Public surface ------------------------------------------------------

/** Reads stored preferences merged with defaults — never returns null. */
export async function getStoredPreferences(): Promise<Preferences> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    const parsed = JSON.parse(raw) as Partial<Preferences>;
    // Merge with defaults so newly-added preferences in future versions
    // still resolve to a value when reading from older stored shapes.
    return { ...DEFAULT_PREFERENCES, ...parsed };
  } catch (err) {
    console.warn('getStoredPreferences failed', err);
    return DEFAULT_PREFERENCES;
  }
}

/** Persists preferences and returns the stored copy. */
export async function setStoredPreferences(
  preferences: Preferences,
): Promise<Preferences> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  return preferences;
}

/** Removes stored preferences (sign-out cleanup, factory reset). */
export async function clearStoredPreferences(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}
