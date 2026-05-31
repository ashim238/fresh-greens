import { useCallback, useState } from 'react';

import { useFocusEffect } from 'expo-router';

import {
  clearStoredFuelProfile,
  DEFAULT_FUEL_PROFILE,
  type FuelProfile,
  type FuelType,
  getStoredFuelProfile,
  setStoredFuelProfile,
} from '../lib/api/fuel';
import {
  cancelRefuelReminder,
  scheduleRefuelReminder,
} from '../lib/notifications';

/** The user-editable fields of a FuelProfile (the derived/internal fields
    — lastFilledAt, nextReminderAt, notificationId — are managed here). */
export type FuelProfileInput = {
  carName?: string;
  fuelType: FuelType;
  cadenceDays: number;
  remindersEnabled: boolean;
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
        };
        setProfile(next);
        await setStoredFuelProfile(next);
        return { ok: false, reason: result.reason };
      }
      const next: FuelProfile = {
        ...toSchedule,
        nextReminderAt: result.nextReminderAt,
        notificationId: result.identifier,
      };
      setProfile(next);
      await setStoredFuelProfile(next);
      return { ok: true };
    },
    [profile],
  );

  // "I filled up" — reset the cadence clock from now (cancel + reschedule).
  const markFilledUp = useCallback(async (): Promise<SaveResult> => {
    const base = profile ?? DEFAULT_FUEL_PROFILE;
    if (!base.remindersEnabled) return { ok: true };
    const nowIso = new Date().toISOString();
    const result = await scheduleRefuelReminder({ ...base, lastFilledAt: nowIso });
    // Schedule failed — keep the existing reminder + record intact rather
    // than tearing down a working reminder. Stored notificationId still valid.
    if (!result.ok) return { ok: false, reason: result.reason };
    const next: FuelProfile = {
      ...base,
      lastFilledAt: nowIso,
      nextReminderAt: result.nextReminderAt,
      notificationId: result.identifier,
    };
    setProfile(next);
    await setStoredFuelProfile(next);
    return { ok: true };
  }, [profile]);

  // Sign-out / factory-reset: cancel any scheduled reminder, wipe storage.
  const clearAll = useCallback(async () => {
    const base = profile;
    if (base?.notificationId) await cancelRefuelReminder(base.notificationId);
    setProfile(null);
    await clearStoredFuelProfile();
  }, [profile]);

  return { profile, loading, saveProfile, markFilledUp, clearAll };
}
