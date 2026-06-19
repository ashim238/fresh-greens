import { useCallback } from 'react';

import {
  clearStoredPreferences,
  DEFAULT_PREFERENCES,
  getStoredPreferences,
  setStoredPreferences,
  type Preferences,
} from '../lib/api/preferences';
import { useHydratedState } from './useHydratedState';

type PreferencesWrites = {
  setShowZones: (next: boolean) => void;
  setPreference: <K extends keyof Preferences>(key: K, value: Preferences[K]) => void;
  clearAll: () => Promise<void>;
};

export type PreferencesState = PreferencesWrites &
  ({ ready: false } | { ready: true; preferences: Preferences });

/**
 * Reactive wrapper around the preferences adapter. Re-reads on focus
 * (default) so a toggle made in /menu surfaces on the screens it was
 * pushed over (/home, /en-route). getStoredPreferences always returns a
 * complete object (merged with DEFAULT_PREFERENCES), so the ready branch
 * never needs per-key `?? default` fallbacks.
 */
export function usePreferences(): PreferencesState {
  const hydrated = useHydratedState<Preferences>(getStoredPreferences);

  const setShowZones = useCallback((next: boolean) => {
    hydrated.setData((prev) => {
      const merged: Preferences = { ...(prev ?? DEFAULT_PREFERENCES), showZones: next };
      void setStoredPreferences(merged);
      return merged;
    });
  }, [hydrated.setData]);

  const setPreference = useCallback<PreferencesWrites['setPreference']>(
    (key, value) => {
      hydrated.setData((prev) => {
        const merged: Preferences = { ...(prev ?? DEFAULT_PREFERENCES), [key]: value };
        void setStoredPreferences(merged);
        return merged;
      });
    },
    [hydrated.setData],
  );

  // Sign-out / factory reset. The union can't represent "null preferences",
  // so reset to DEFAULT_PREFERENCES — behaviourally identical to the prior
  // null-then-refetch (consumers saw defaults either way), and avoids a
  // transient null.
  const clearAll = useCallback(async () => {
    hydrated.setData(DEFAULT_PREFERENCES);
    await clearStoredPreferences();
  }, [hydrated.setData]);

  if (!hydrated.ready) {
    return { ready: false, setShowZones, setPreference, clearAll };
  }
  return { ready: true, preferences: hydrated.data, setShowZones, setPreference, clearAll };
}
