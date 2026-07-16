// Fresh Greens — auto-insurance profile adapter.
//
// AsyncStorage-backed identity for the user's insurance carrier + policy
// number. Separate from roadside.ts (roadside *service* dial identity) and
// from pulled-over session state. Persisted so "What to Have" and future
// document surfaces can read it without re-entry under stress.
//
// cardPhotoUri is a local file:// URI from expo-image-picker; not uploaded.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { accountOperationGate } from '../account-session/operation-gate';

const STORAGE_KEY = 'fresh-greens.insurance.v1';

export type InsuranceProfile = {
  /** Carrier name as printed on the card, e.g. "State Farm", "GEICO". */
  carrierName: string;
  /** Policy / member ID — stored verbatim; mask at display time. */
  policyNumber: string;
  /** Optional scan of the insurance card (local URI only). */
  cardPhotoUri?: string;
  /** ms epoch — when the profile was created/last edited. */
  setAt: number;
};

export async function getStoredInsuranceProfile(): Promise<InsuranceProfile | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as InsuranceProfile;
  } catch (err) {
    console.warn('getStoredInsuranceProfile failed', err);
    return null;
  }
}

export async function setStoredInsuranceProfile(
  profile: InsuranceProfile,
): Promise<InsuranceProfile> {
  await accountOperationGate.runCurrent(async () => {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  });
  return profile;
}

export async function clearStoredInsuranceProfile(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}

export async function purgeStoredInsuranceProfileForAccount(): Promise<void> {
  await clearStoredInsuranceProfile();
}

/** Last four characters for stress-state surfaces (full number in settings). */
export function maskPolicyNumber(policyNumber: string): string {
  const compact = policyNumber.replace(/\s/g, '');
  if (compact.length <= 4) return compact;
  return `···${compact.slice(-4)}`;
}
