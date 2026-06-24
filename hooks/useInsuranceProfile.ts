import { useCallback, useState } from 'react';

import { useFocusEffect } from 'expo-router';

import {
  clearStoredInsuranceProfile,
  getStoredInsuranceProfile,
  type InsuranceProfile,
  setStoredInsuranceProfile,
} from '../lib/api/insurance';

export type InsuranceProfileInput = {
  carrierName: string;
  policyNumber: string;
  cardPhotoUri?: string;
};

/**
 * Reactive wrapper around the insurance adapter. Same shape as
 * useRoadsideProfile — refocus re-reads AsyncStorage so /insurance-setup
 * saves propagate to /safety-settings and /pulled-over without a manual
 * refetch.
 */
export function useInsuranceProfile() {
  const [profile, setProfile] = useState<InsuranceProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const stored = await getStoredInsuranceProfile();
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

  const saveProfile = useCallback(async (input: InsuranceProfileInput) => {
    const next: InsuranceProfile = {
      carrierName: input.carrierName.trim(),
      policyNumber: input.policyNumber.trim(),
      cardPhotoUri: input.cardPhotoUri,
      setAt: Date.now(),
    };
    setProfile(next);
    await setStoredInsuranceProfile(next);
    return next;
  }, []);

  const clearAll = useCallback(async () => {
    setProfile(null);
    await clearStoredInsuranceProfile();
  }, []);

  return { profile, loading, saveProfile, clearAll };
}
