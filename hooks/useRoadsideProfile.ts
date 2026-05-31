import { useCallback, useState } from 'react';

import { useFocusEffect } from 'expo-router';

import {
  clearStoredRoadsideProfile,
  getStoredRoadsideProfile,
  type RoadsideProfile,
  setStoredRoadsideProfile,
} from '../lib/api/roadside';

/** The user-editable fields of a RoadsideProfile. `setAt` is managed here. */
export type RoadsideProfileInput = {
  serviceName: string;
  phoneNumber: string;
};

/**
 * Reactive wrapper around the roadside adapter. Loads the stored profile
 * on mount and re-reads on focus (so when /roadside-setup is popped, the
 * underlying /roadside or /menu surface sees the freshly-saved profile
 * without a manual refetch).
 *
 * Same shape as useFuelProfile / useTrustedContact. `loading` only flips
 * false (never back to true on refocus) to avoid a flash.
 *
 * `profile` is null both when not-yet-loaded AND when the user has never
 * set up a profile — callers treat both identically (show the "Set up"
 * CTA) so the distinction doesn't matter in practice.
 */
export function useRoadsideProfile() {
  const [profile, setProfile] = useState<RoadsideProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const stored = await getStoredRoadsideProfile();
        if (!cancelled) {
          setProfile(stored);
          setLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const saveProfile = useCallback(async (input: RoadsideProfileInput) => {
    const next: RoadsideProfile = {
      serviceName: input.serviceName.trim(),
      phoneNumber: input.phoneNumber.trim(),
      setAt: Date.now(),
    };
    setProfile(next);
    await setStoredRoadsideProfile(next);
    return next;
  }, []);

  const clearAll = useCallback(async () => {
    setProfile(null);
    await clearStoredRoadsideProfile();
  }, []);

  return { profile, loading, saveProfile, clearAll };
}
