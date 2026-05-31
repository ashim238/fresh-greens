import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import {
  clearStoredPreferences,
  DEFAULT_PREFERENCES,
  getStoredPreferences,
  setStoredPreferences,
  type Preferences,
} from '../lib/api/preferences';

/**
 * Reactive wrapper around the preferences adapter. Loads stored
 * preferences on mount, exposes per-key setters that persist + update
 * local state.
 *
 * Usage:
 *   const { preferences, setShowZones } = usePreferences();
 *   <Switch value={preferences.showZones} onValueChange={setShowZones} />
 *
 * Per-key setters (vs a single `setPreferences(partial)`) keep call
 * sites simple — UI just wires to a setter — and let TypeScript catch
 * typos in preference names. Add new setters as new preferences arrive.
 *
 * Each consumer keeps its own local snapshot but RE-READS on focus
 * (useFocusEffect) — so a screen that reads preferences (/home, /en-route)
 * picks up a toggle made in /menu when it regains focus, even though /menu
 * is pushed *over* it (revealed, not remounted, on pop). A mount-only load
 * stayed stale until a forced remount (e.g. re-routing through /search).
 * If live cross-screen sync (while both are mounted) is ever needed, this
 * becomes a context provider.
 */
export function usePreferences() {
  const [preferences, setPreferencesState] = useState<Preferences | null>(null);
  const [loading, setLoading] = useState(true);

  // Re-read on focus (not just mount): /menu is pushed on top of the
  // screens that consume preferences (/home, /en-route), so popping back
  // reveals them WITHOUT remounting — a mount-only load would leave a
  // just-toggled flag stale until a forced remount. `loading` only flips
  // false (never back to true on refocus) to avoid a flash.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const stored = await getStoredPreferences();
        if (!cancelled) {
          setPreferencesState(stored);
          setLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const setShowZones = useCallback(async (next: boolean) => {
    setPreferencesState((prev) => {
      const merged: Preferences = { ...(prev ?? DEFAULT_PREFERENCES), showZones: next };
      // Fire-and-forget the persistence — local state already updated
      // for snappy UI, AsyncStorage write happens in the background.
      void setStoredPreferences(merged);
      return merged;
    });
  }, []);

  // Generic per-key setter for the boolean preference toggles (the zone
  // factor flags). Same optimistic-merge + fire-and-forget pattern as
  // setShowZones; DEFAULT_PREFERENCES seeds a complete object when prev
  // is still null (pre-hydration).
  const setPreference = useCallback(
    <K extends keyof Preferences>(key: K, value: Preferences[K]) => {
      setPreferencesState((prev) => {
        const merged: Preferences = { ...(prev ?? DEFAULT_PREFERENCES), [key]: value };
        void setStoredPreferences(merged);
        return merged;
      });
    },
    [],
  );

  // Sign-out / factory-reset cleanup — wipes the whole Preferences
  // object (showZones + all factor flags) so nothing carries across
  // accounts. Local state drops to null; consumers fall back to
  // defaults until the next hydrate.
  const clearAll = useCallback(async () => {
    setPreferencesState(null);
    await clearStoredPreferences();
  }, []);

  return { preferences, loading, setShowZones, setPreference, clearAll };
}
