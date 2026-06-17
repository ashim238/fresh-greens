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

export type RangeSource =
  | 'none'        // distance trigger off (rangeMiles null)
  | 'bucket'      // chosen from a tier preset (Phase 1)
  | 'custom'      // user typed a number (Phase 1)
  | 'epa-ev'      // EPA published EV range (Phase 2)
  | 'epa-gas';    // EPA combined MPG × class-typical tank, estimate (Phase 2)

/** EPA-resolved vehicle. Phase 2 writes this; Phase 1 leaves it null. */
export type Vehicle = {
  year: number;
  make: string;
  model: string;
  /** EPA fueleconomy.gov vehicle id (the `value` from its options menu). */
  epaVehicleId: string;
};

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

  // --- new: distance trigger (Phase 1) ---
  /** Tank range in miles. null = distance trigger OFF (time-only). */
  rangeMiles: number | null;
  /** Provenance of rangeMiles — drives copy + the adjust affordance. */
  rangeSource: RangeSource;
  /** In-app driven miles since the tank was last considered full. A FULL
      fill resets this to 0; a PARTIAL fill resets it to
      rangeMiles × (1 − fillFraction) — you start the new cycle already
      part-consumed (see Task 6). */
  milesSinceFilled: number;
  /** ISO — set when EITHER trigger fires; cleared on "I filled up". Dedups
      the distance check so it doesn't re-fire every trip-end after the
      threshold is crossed. */
  refuelNotifiedAt: string | null;

  // --- new: Phase 2 vehicle selection (unused in Phase 1) ---
  /** EPA-resolved vehicle, when range came from make/model. null otherwise. */
  vehicle: Vehicle | null;
};

export const DEFAULT_FUEL_PROFILE: FuelProfile = {
  fuelType: 'gas',
  cadenceDays: 7,
  remindersEnabled: false,
  lastFilledAt: null,
  nextReminderAt: null,
  notificationId: null,
  rangeMiles: null,
  rangeSource: 'none',
  milesSinceFilled: 0,
  refuelNotifiedAt: null,
  vehicle: null,
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

/**
 * Pure earliest-of distance predicate. True when the distance trigger
 * should fire NOW: reminders on, a range threshold is set, accumulated
 * in-app miles have crossed it, and we haven't already fired for this
 * tank (refuelNotifiedAt is the dedup latch). The `now` param is unused
 * today but kept in the signature so the call site reads symmetrically
 * with the time-trigger reconciliation (which does compare against now).
 */
export function isDistanceRefuelDue(
  profile: FuelProfile,
  _now: Date = new Date(),
): boolean {
  return (
    profile.remindersEnabled &&
    profile.rangeMiles != null &&
    profile.milesSinceFilled >= profile.rangeMiles &&
    profile.refuelNotifiedAt == null
  );
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

/**
 * Pure: the new milesSinceFilled after the odometer advances by `delta`
 * miles. Clamped at >= 0 (a negative delta — shouldn't happen given the
 * monotonic odometer, but defensive — never decreases the accumulator).
 * The hook persists the returned value.
 */
export function addMilesSinceFilledTo(
  profile: FuelProfile,
  deltaMiles: number,
): number {
  return profile.milesSinceFilled + Math.max(0, deltaMiles);
}

/** Result of computing a fill-up: the reset miles + the cadence (in days)
    to reschedule the time notification at. */
export type FilledUpPlan = {
  milesSinceFilled: number;
  effectiveDays: number;
};

/**
 * Pure: compute the post-fill state from a 0–1 fill fraction.
 *   - milesSinceFilled = rangeMiles × (1 − fraction)  (full → 0; half →
 *     half the range pre-spent). When rangeMiles is null (distance trigger
 *     off), milesSinceFilled stays 0 — a partial fill only scales cadence.
 *   - effectiveDays   = cadenceDays × fraction, clamped to >= 1 day (so a
 *     half fill reminds in half the days; the scheduler also clamps >= 1).
 * The fraction is clamped to [0,1] defensively.
 */
export function applyFilledUp(
  profile: FuelProfile,
  fillFraction: number,
): FilledUpPlan {
  const f = clamp01(fillFraction);
  const milesSinceFilled =
    profile.rangeMiles == null ? 0 : profile.rangeMiles * (1 - f);
  const effectiveDays = Math.max(1, Math.floor(profile.cadenceDays * f));
  return { milesSinceFilled, effectiveDays };
}

/**
 * Pure (Phase 2 helper, lands in Phase 1 because it's pure): derive a
 * 0–1 fill fraction from a dollar amount, price/gallon, and tank size.
 * MPG cancels out — only price and tank matter. Returns null when price
 * or tank can't be resolved (so the UI never fabricates an "about ⅓ tank"
 * subtext — it falls back to the fraction buttons). No Phase-1 caller.
 */
export function fillFractionFromDollars(
  dollars: number,
  pricePerGallon: number | null,
  tankGallons: number | null,
): number | null {
  if (
    pricePerGallon == null ||
    tankGallons == null ||
    pricePerGallon <= 0 ||
    tankGallons <= 0
  ) {
    return null;
  }
  return clamp01(dollars / (pricePerGallon * tankGallons));
}
