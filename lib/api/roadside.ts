// Fresh Greens — roadside-service-profile adapter.
//
// AsyncStorage-backed identity for the user's roadside service (e.g.
// AAA, Geico, USAA). Same architectural shape as preferences.ts /
// fuel.ts / trusted-contact.ts: typed `RoadsideProfile`, async public
// surface, AsyncStorage internals.
//
// Lives separately from the in-flow /roadside session state — which is
// in-memory only and dies on unmount per spec. This file persists ONLY
// the service identity so we can dial directly and address the user's
// service by name on the live-status step.
//
// See docs/archive/superpowers/specs/2026-05-31-roadside-assistance-design.md.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { accountOperationGate } from '../account-session/operation-gate';

const STORAGE_KEY = 'fresh-greens.roadside.v1';

/** The 5 problem categories the Step 1 picker offers. */
export type ProblemType =
  | 'flat-tire'
  | 'no-start'
  | 'no-gas'
  | 'locked-out'
  | 'other';

export type RoadsideProfile = {
  /** "AAA", "Geico Emergency Roadside", "USAA" — shown verbatim. */
  serviceName: string;
  /** Raw user-entered phone; `Linking.openURL('tel:…')` handles formatting. */
  phoneNumber: string;
  /** ms epoch — when the profile was created/last edited. */
  setAt: number;
};

/** Reads stored profile or returns null when not yet set up. */
export async function getStoredRoadsideProfile(): Promise<RoadsideProfile | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RoadsideProfile;
    return parsed;
  } catch (err) {
    console.warn('getStoredRoadsideProfile failed', err);
    return null;
  }
}

/** Persists the profile and returns the stored copy. */
export async function setStoredRoadsideProfile(
  profile: RoadsideProfile,
): Promise<RoadsideProfile> {
  await accountOperationGate.runCurrent(async () => {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  });
  return profile;
}

/** Removes the stored profile (sign-out cleanup, factory reset). */
export async function clearStoredRoadsideProfile(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}

export async function purgeStoredRoadsideProfileForAccount(): Promise<void> {
  await clearStoredRoadsideProfile();
}
