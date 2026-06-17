import { useCallback, useEffect, useRef, useState } from 'react';

import { AppState, type AppStateStatus } from 'react-native';

import { useFocusEffect } from 'expo-router';

import {
  addMilesSinceFilledTo,
  applyFilledUp,
  clearStoredFuelProfile,
  DEFAULT_FUEL_PROFILE,
  type FuelProfile,
  type FuelType,
  getStoredFuelProfile,
  isDistanceRefuelDue,
  setStoredFuelProfile,
} from '../lib/api/fuel';
import {
  cancelRefuelReminder,
  fireRefuelReminderNow,
  scheduleRefuelReminder,
} from '../lib/notifications';

/** The user-editable fields of a FuelProfile (the derived/internal fields
    — lastFilledAt, nextReminderAt, notificationId — are managed here). */
export type FuelProfileInput = {
  carName?: string;
  fuelType: FuelType;
  cadenceDays: number;
  remindersEnabled: boolean;
  rangeMiles: number | null;
  rangeSource: FuelProfile['rangeSource'];
};

export type SaveResult = { ok: true } | { ok: false; reason: 'permission-denied' | 'failed' };

/**
 * Reactive wrapper around the fuel adapter + the refuel scheduler. Loads
 * the stored profile on mount; saveProfile / markFilledUp drive BOTH the
 * AsyncStorage write AND the recurring local notification, keeping the
 * stored notificationId + nextReminderAt in sync with what's actually
 * scheduled.
 *
 * Local-state only, like usePreferences — each consumer reads its own
 * snapshot. Re-reads on focus (via useFocusEffect), so a consumer like the
 * /search card reflects edits made on /fuel even though /search stays
 * mounted underneath.
 */
export function useFuelProfile() {
  const [profile, setProfile] = useState<FuelProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Latest profile, readable from listeners/callbacks that mount once
  // (AppState, the odometer's trip-end check) without re-subscribing or
  // capturing a stale snapshot. Mirrors en-route's userLocationRef.
  const profileRef = useRef<FuelProfile | null>(null);
  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  // Re-read on focus (not just mount): /search stays mounted while /fuel
  // is pushed on top, so a mount-only load would leave the Fuel card's
  // live status stale after the user edits + taps back. useFocusEffect
  // re-reads each time the consuming screen regains focus. `loading` only
  // flips false (never back to true on refocus) to avoid a flash.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const stored = await getStoredFuelProfile();
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

  // Save the edited profile. When reminders are enabled, (re)schedule the
  // recurring notification and persist its id + nextReminderAt; the
  // cadence clock anchors to now (lastFilledAt = now). When disabled,
  // cancel any scheduled reminder and clear the derived fields.
  const saveProfile = useCallback(
    async (input: FuelProfileInput): Promise<SaveResult> => {
      const base = profile ?? DEFAULT_FUEL_PROFILE;
      const nowIso = new Date().toISOString();

      if (!input.remindersEnabled) {
        if (base.notificationId) await cancelRefuelReminder(base.notificationId);
        const next: FuelProfile = {
          ...base,
          ...input,
          lastFilledAt: null,
          nextReminderAt: null,
          notificationId: null,
          // Clear distance state so re-enabling starts a fresh cycle
          // (no stale "refuel due" banner or pre-loaded odometer).
          refuelNotifiedAt: null,
          milesSinceFilled: 0,
        };
        setProfile(next);
        await setStoredFuelProfile(next);
        return { ok: true };
      }

      // Enabling (or re-saving while enabled): schedule from a profile that
      // carries the prior notificationId so the scheduler cancels it first.
      const toSchedule: FuelProfile = {
        ...base,
        ...input,
        lastFilledAt: nowIso,
      };
      const result = await scheduleRefuelReminder(toSchedule);
      if (!result.ok) {
        // Persist the entered fields but leave reminders OFF so the UI
        // doesn't claim a reminder exists when scheduling was refused.
        const next: FuelProfile = {
          ...toSchedule,
          remindersEnabled: false,
          nextReminderAt: null,
          notificationId: null,
          // Re-enable failed — distance state is stale; start fresh.
          refuelNotifiedAt: null,
          milesSinceFilled: 0,
        };
        setProfile(next);
        await setStoredFuelProfile(next);
        return { ok: false, reason: result.reason };
      }
      const next: FuelProfile = {
        ...toSchedule,
        nextReminderAt: result.nextReminderAt,
        notificationId: result.identifier,
        // Re-enabling is a fresh cycle — clear any stale distance state
        // so no "refuel due" banner or pre-loaded odometer carries over.
        refuelNotifiedAt: null,
        milesSinceFilled: 0,
      };
      setProfile(next);
      await setStoredFuelProfile(next);
      return { ok: true };
    },
    [profile],
  );

  // The earliest-of distance check. Reads the latest profile via ref so it
  // can be called from a once-mounted AppState listener and from the
  // odometer's trip-end flush. Fires the immediate (optionally station-
  // aware) notification, cancels the scheduled time notification (so the
  // driver isn't reminded twice for the same tank), stamps refuelNotifiedAt,
  // and persists. Also reconciles the case where the TIME notification
  // already fired out-of-process: if now >= nextReminderAt and we haven't
  // recorded a fire, treat the time trigger as fired (stamp
  // refuelNotifiedAt = nextReminderAt) so the in-app banner + dedup stay in
  // sync without a notification-response listener.
  //
  // `nearbyStopName` is supplied by the caller (en-route) when a trusted /
  // on-route stop is loaded; null/undefined → generic copy.
  const checkRefuelTriggers = useCallback(
    async (nearbyStopName?: string): Promise<void> => {
      const current = profileRef.current;
      if (!current || !current.remindersEnabled) return;

      const now = new Date();

      // (a) Time trigger known-fired reconciliation.
      if (
        current.refuelNotifiedAt == null &&
        current.nextReminderAt != null &&
        new Date(current.nextReminderAt).getTime() <= now.getTime()
      ) {
        const next: FuelProfile = {
          ...current,
          refuelNotifiedAt: current.nextReminderAt,
        };
        profileRef.current = next;
        setProfile(next);
        await setStoredFuelProfile(next);
        return; // time won; nothing more to do this pass.
      }

      // (b) Distance trigger.
      if (!isDistanceRefuelDue(current, now)) return;

      // Fire immediate notification (station-aware when a stop is passed).
      // Permission denial is non-fatal — the in-app banner still shows.
      await fireRefuelReminderNow(current, nearbyStopName);

      // Cancel the pending scheduled time notification so the same tank
      // doesn't get a second reminder days later.
      if (current.notificationId) {
        await cancelRefuelReminder(current.notificationId);
      }

      const next: FuelProfile = {
        ...current,
        refuelNotifiedAt: now.toISOString(),
        // Time notification cancelled — clear its derived fields so the UI
        // (and a future reschedule) doesn't think one is still pending.
        notificationId: null,
        nextReminderAt: null,
      };
      profileRef.current = next;
      setProfile(next);
      await setStoredFuelProfile(next);
    },
    [],
  );

  // App-foreground distance check — covers miles added then the app
  // backgrounded before a trip-end check ran. Mounts once; reads the
  // latest profile via ref inside checkRefuelTriggers.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') void checkRefuelTriggers();
    });
    return () => sub.remove();
  }, [checkRefuelTriggers]);

  // Odometer flush — accumulate driven miles and persist. Throttled by the
  // caller (en-route, every >= 0.5 mi). Reads the latest profile via ref so
  // rapid flushes don't race the React state. No notification work here —
  // the trip-end distance check is invoked separately by the odometer's
  // final flush (checkRefuelTriggers).
  const addMilesSinceFilled = useCallback(
    async (deltaMiles: number): Promise<void> => {
      const current = profileRef.current;
      // Only meter while the distance trigger is armed.
      if (!current || !current.remindersEnabled || current.rangeMiles == null) {
        return;
      }
      if (!(deltaMiles > 0)) return;
      const next: FuelProfile = {
        ...current,
        milesSinceFilled: addMilesSinceFilledTo(current, deltaMiles),
      };
      profileRef.current = next;
      setProfile(next);
      await setStoredFuelProfile(next);
    },
    [],
  );

  // "I filled up" — amount-aware. fillFraction defaults to 1 (full tank).
  //   - milesSinceFilled = rangeMiles × (1 − fraction)  (full → 0)
  //   - the rescheduled time cadence is scaled: effectiveDays =
  //     cadenceDays × fraction (clamped >= 1 by applyFilledUp + scheduler)
  //   - refuelNotifiedAt cleared (new tank, dedup latch reset)
  // When rangeMiles is null (distance off), milesSinceFilled stays 0 and
  // only the cadence scales.
  const markFilledUp = useCallback(
    async (fillFraction = 1): Promise<SaveResult> => {
      const base = profileRef.current ?? profile ?? DEFAULT_FUEL_PROFILE;
      // Unreachable by construction — the fill UI is gated on remindersEnabled
      // (the RowGroup only renders when profile.remindersEnabled is true), so
      // this guard exists for defensive completeness, not as a silent failure.
      if (!base.remindersEnabled) return { ok: true };
      const nowIso = new Date().toISOString();
      const plan = applyFilledUp(base, fillFraction);
      // Reschedule the time notification at the scaled cadence. Pass the
      // effective cadence so a partial fill reminds sooner; scheduleRefuel-
      // Reminder cancels the prior notification by base.notificationId.
      const result = await scheduleRefuelReminder({
        ...base,
        cadenceDays: plan.effectiveDays,
        lastFilledAt: nowIso,
      });
      if (!result.ok) return { ok: false, reason: result.reason };
      const next: FuelProfile = {
        ...base,
        // NOTE: cadenceDays is the USER's setting — do NOT overwrite it with
        // the scaled effectiveDays. Only the scheduled notification uses the
        // scaled value; the stored cadence stays what the user chose.
        lastFilledAt: nowIso,
        nextReminderAt: result.nextReminderAt,
        notificationId: result.identifier,
        milesSinceFilled: plan.milesSinceFilled,
        refuelNotifiedAt: null,
      };
      profileRef.current = next;
      setProfile(next);
      await setStoredFuelProfile(next);
      return { ok: true };
    },
    [profile],
  );

  // Sign-out / factory-reset: cancel any scheduled reminder, wipe storage.
  const clearAll = useCallback(async () => {
    const base = profile;
    if (base?.notificationId) await cancelRefuelReminder(base.notificationId);
    setProfile(null);
    await clearStoredFuelProfile();
  }, [profile]);

  return {
    profile,
    loading,
    saveProfile,
    markFilledUp,
    addMilesSinceFilled,
    checkRefuelTriggers,
    clearAll,
  };
}
