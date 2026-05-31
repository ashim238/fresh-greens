// Fresh Greens — local notification helpers.
//
// Currently used by /home's "Schedule for X" CTA to fire a departure
// reminder at the suggestedDepartureForDaylight() time so the user can
// actually leave at the lower-light-cost moment without keeping the
// app foregrounded.
//
// Permission strategy: ask inline on first use (NOT at /permissions
// onboarding). Rationale — the Schedule CTA is conditional (only
// renders when suggestedDeparture is non-null, which is a minority of
// trips), so eager-prompting in onboarding would burn permission
// goodwill on a feature most users never reach. Inline ask at point-
// of-use ties the prompt to the user's stated intent ("schedule this")
// rather than an abstract "we might want to notify you sometime."
//
// All scheduling is local — no push server, no remote payload. The
// notification fires from the device's scheduler whether or not the
// app is foregrounded; no background-fetch infrastructure needed.

import * as Notifications from 'expo-notifications';
import type { FuelProfile } from './api/fuel';

/**
 * Foreground presentation handler — controls what happens when the
 * notification fires while the app is open. We want the user to see
 * the reminder either way (the whole point is "time to leave"), so
 * we surface a banner + sound even in-foreground.
 *
 * Set once at module load — Notifications.setNotificationHandler is
 * idempotent and the handler is module-global.
 */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export type ScheduleResult =
  | { ok: true; identifier: string }
  | { ok: false; reason: 'permission-denied' | 'past-time' | 'failed' };

/**
 * Schedules a local notification for the given departure time. Asks
 * for notification permission inline if not yet granted.
 *
 * `destName` (optional) drops into the body copy when present —
 * "...to Wintzell's" vs the generic "...to your destination."
 *
 * Returns a discriminated result so the caller can decide UX:
 *   - permission-denied: caller surfaces Alert pointing to Settings
 *   - past-time: caller surfaces "Pick a time in the future" Alert
 *     (defensive — suggestedDeparture is computed at render so it can
 *     theoretically already be past by the time the user taps)
 *   - failed: caller surfaces "Couldn't schedule, try again"
 *   - ok: caller surfaces confirmation + success haptic
 */
export async function scheduleDepartureNotification(
  when: Date,
  destName?: string,
): Promise<ScheduleResult> {
  // Defensive: notification scheduling silently no-ops past times,
  // which would leave the user thinking "scheduled" without anything
  // actually firing. Catch + report explicitly. 1000ms buffer covers
  // (a) the tap → resolve latency window, and (b) iOS occasionally
  // dropping sub-second-precision DATE triggers.
  if (when.getTime() <= Date.now() + 1000) {
    return { ok: false, reason: 'past-time' };
  }

  const existing = await Notifications.getPermissionsAsync();
  let granted = existing.granted;
  if (!granted && existing.canAskAgain) {
    const req = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowSound: true,
        allowBadge: false,
      },
    });
    granted = req.granted;
  }
  if (!granted) {
    return { ok: false, reason: 'permission-denied' };
  }

  const dest = destName ? `to ${destName}` : 'on your route';

  try {
    const identifier = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Time to head out',
        body: `Leaving now gives you more daylight ${dest}.`,
        sound: 'default',
      },
      // DATE trigger: fires once at the exact moment, no repeat.
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: when,
      },
    });
    console.info(
      `[notifications] scheduled departure reminder ${identifier} for ${when.toISOString()}`,
    );
    return { ok: true, identifier };
  } catch (err) {
    console.warn('[notifications] schedule failed:', err);
    return { ok: false, reason: 'failed' };
  }
}

export type RefuelScheduleResult =
  | { ok: true; identifier: string; nextReminderAt: string }
  | { ok: false; reason: 'permission-denied' | 'failed' };

/** Verb the reminder uses — electric "recharges", everything else "refuels". */
function refuelVerb(fuelType: FuelProfile['fuelType']): 'refuel' | 'recharge' {
  return fuelType === 'electric' ? 'recharge' : 'refuel';
}

/**
 * Schedules a RECURRING refuel reminder from the given profile. Cancels
 * any prior reminder first (by `profile.notificationId`). Uses a
 * TIME_INTERVAL repeating trigger (cadenceDays × 86400s) so it survives
 * the app being closed with no re-arm — unlike the one-shot DATE trigger
 * used by scheduleDepartureNotification (departure is a single event;
 * refuel recurs).
 *
 * Tradeoff (documented in the spec): a TIME_INTERVAL repeat fires at
 * (now + N days) and on that cadence — it does not pin a time-of-day.
 * Accepted for v1; a refuel nudge isn't hour-sensitive.
 *
 * Asks notification permission inline if not yet granted — reuses the
 * same flow as scheduleDepartureNotification. No new sensitive permission.
 *
 * Returns the new identifier + the derived first-fire time (nextReminderAt)
 * so the caller can persist both onto the FuelProfile.
 */
export async function scheduleRefuelReminder(
  profile: FuelProfile,
): Promise<RefuelScheduleResult> {
  // Cancel any prior reminder so we never stack duplicates.
  if (profile.notificationId) {
    await cancelRefuelReminder(profile.notificationId);
  }

  const existing = await Notifications.getPermissionsAsync();
  let granted = existing.granted;
  if (!granted && existing.canAskAgain) {
    const req = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowSound: true, allowBadge: false },
    });
    granted = req.granted;
  }
  if (!granted) {
    return { ok: false, reason: 'permission-denied' };
  }

  // Clamp to >= 1 day. iOS requires repeating TIME_INTERVAL seconds >= 60;
  // 1 day = 86400s clears that comfortably.
  const days = Math.max(1, Math.round(profile.cadenceDays));
  const seconds = days * 86400;
  const verb = refuelVerb(profile.fuelType);
  const subject = profile.carName ? ` the ${profile.carName}` : '';
  const nextReminderAt = new Date(Date.now() + seconds * 1000).toISOString();

  try {
    const identifier = await Notifications.scheduleNotificationAsync({
      content: {
        title: `Time to ${verb}${subject}`,
        body: `It's been about ${days} day${days === 1 ? '' : 's'} — a good time to ${verb}.`,
        sound: 'default',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds,
        repeats: true,
      },
    });
    console.info(
      `[notifications] scheduled refuel reminder ${identifier} every ${days}d`,
    );
    return { ok: true, identifier, nextReminderAt };
  } catch (err) {
    console.warn('[notifications] refuel schedule failed:', err);
    return { ok: false, reason: 'failed' };
  }
}

/** Cancels a scheduled refuel reminder. Safe to call with a stale id. */
export async function cancelRefuelReminder(identifier: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(identifier);
  } catch (err) {
    console.warn('[notifications] refuel cancel failed:', err);
  }
}
