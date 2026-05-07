import { useCallback, useEffect, useState } from 'react';

import {
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
 * Note: like useUser, this hook is local-state only. Each consumer
 * reads its own snapshot; cross-screen invalidation isn't wired. Fine
 * while preferences are read by /home (one place) and toggled in /menu
 * (another). When a preference grows enough surfaces to need shared
 * state, this becomes a context provider.
 */
export function usePreferences() {
  const [preferences, setPreferencesState] = useState<Preferences | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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
  }, []);

  const setShowZones = useCallback(async (next: boolean) => {
    setPreferencesState((prev) => {
      const merged: Preferences = { ...(prev ?? { showZones: false }), showZones: next };
      // Fire-and-forget the persistence — local state already updated
      // for snappy UI, AsyncStorage write happens in the background.
      void setStoredPreferences(merged);
      return merged;
    });
  }, []);

  return { preferences, loading, setShowZones };
}
