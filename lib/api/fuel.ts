// Fresh Greens — fuel-profile adapter.
//
// AsyncStorage-backed car/fuel profile that drives the time-based refuel
// reminder. Same architectural shape as preferences.ts / user.ts: typed
// `FuelProfile`, async public surface, AsyncStorage internals, backend
// swap-in point preserved.
//
// Time-based by design: a phone can't sense fuel level and the app has no
// mileage tracking, so the reminder is an explicit user-set cadence — not
// a fake gauge. `lastFilledAt` + `cadenceDays` derive `nextReminderAt`;
// `notificationId` is the scheduled recurring reminder (so it can be
// cancelled/rescheduled). See docs/superpowers/specs/2026-05-30-refuel-
// reminders-design.md.

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'fresh-greens.fuel.v1';

export type FuelType = 'gas' | 'diesel' | 'hybrid' | 'electric';

export type FuelProfile = {
  /** Optional nickname/model — "Civic". Personalizes reminder copy. */
  carName?: string;
  /** Tunes copy ("refuel" vs "recharge") and the future on-route POI query. */
  fuelType: FuelType;
  /** Remind every N days. Clamped to >= 1 by the scheduler. */
  cadenceDays: number;
  remindersEnabled: boolean;
  /** ISO — set at enable + on "I filled up". Anchors the cadence clock. */
  lastFilledAt: string | null;
  /** ISO — derived: lastFilledAt + cadenceDays. Shown in card + screen. */
  nextReminderAt: string | null;
  /** Scheduled recurring-reminder id (cancel/reschedule). */
  notificationId: string | null;
};

export const DEFAULT_FUEL_PROFILE: FuelProfile = {
  fuelType: 'gas',
  cadenceDays: 7,
  remindersEnabled: false,
  lastFilledAt: null,
  nextReminderAt: null,
  notificationId: null,
};

/** Reads stored profile merged with defaults — never returns null. */
export async function getStoredFuelProfile(): Promise<FuelProfile> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_FUEL_PROFILE;
    const parsed = JSON.parse(raw) as Partial<FuelProfile>;
    return { ...DEFAULT_FUEL_PROFILE, ...parsed };
  } catch (err) {
    console.warn('getStoredFuelProfile failed', err);
    return DEFAULT_FUEL_PROFILE;
  }
}

/** Persists the profile and returns the stored copy. */
export async function setStoredFuelProfile(
  profile: FuelProfile,
): Promise<FuelProfile> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  return profile;
}

/** Removes the stored profile (sign-out cleanup, factory reset). */
export async function clearStoredFuelProfile(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}
