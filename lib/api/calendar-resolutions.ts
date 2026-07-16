// lib/api/calendar-resolutions.ts
//
// Persisted manual location corrections for calendar events, keyed by
// the event's raw location TEXT (not event id) so recurring events and
// repeated venues reuse one correction. When the user fixes "Dr. Lee
// Dentistry" → a picked place, every event with that location text
// auto-resolves thereafter. Same adapter shape as the other lib/api
// stores.
//
// Spec: docs/archive/superpowers/specs/2026-06-01-settings-register-refresh-design.md

import AsyncStorage from '@react-native-async-storage/async-storage';
import { accountOperationGate } from '../account-session/operation-gate';

const STORAGE_KEY = 'fresh-greens.calendar-resolutions.v1';

export type ResolvedPlace = {
  name: string;
  latitude: number;
  longitude: number;
};

/** Map of locationText → chosen place. */
export type ResolutionMap = Record<string, ResolvedPlace>;

export async function getResolutions(): Promise<ResolutionMap> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as ResolutionMap;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (err) {
    console.warn('getResolutions failed', err);
    return {};
  }
}

export async function setResolution(
  locationText: string,
  place: ResolvedPlace,
): Promise<ResolutionMap> {
  return accountOperationGate.runCurrent(async () => {
    const current = await getResolutions();
    const next: ResolutionMap = { ...current, [locationText]: place };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    return next;
  });
}

/** Sign-out hygiene — drop all corrections. */
export async function clearResolutions(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}

export async function purgeCalendarResolutionsForAccount(): Promise<void> {
  await clearResolutions();
}
