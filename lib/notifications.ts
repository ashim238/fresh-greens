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
