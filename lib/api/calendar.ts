// lib/api/calendar.ts
//
// Connect-calendar adapter. Two concerns: (1) a tiny AsyncStorage flag
// for whether the user has connected their calendar, and (2) a read-only
// reader that returns upcoming events with a non-empty location, for the
// /search Upcoming section. Same architectural shape as preferences.ts /
// fuel.ts: typed surface, AsyncStorage internals, backend swap-in
// preserved. Read-only: this module never creates or edits events.
//
// Spec: docs/archive/superpowers/specs/2026-06-01-settings-register-refresh-design.md

import AsyncStorage from '@react-native-async-storage/async-storage';
import { accountOperationGate } from '../account-session/operation-gate';
import * as Calendar from 'expo-calendar';

const STORAGE_KEY = 'fresh-greens.calendar.v1';

/** How far ahead we surface events. One week of appointments is the
    useful horizon; past that the list reads as noise. */
export const CALENDAR_LOOKAHEAD_DAYS = 7;

export type CalendarConnection = { connected: boolean };

const DEFAULT_CONNECTION: CalendarConnection = { connected: false };

export type UpcomingEvent = {
  /** Calendar event id (stable within the device). */
  id: string;
  /** Event title, e.g. "Dentist". */
  title: string;
  /** ms epoch of the event start. */
  startsAt: number;
  /** Raw event.location free-text. Always non-empty here — events with
      no location are filtered out by getUpcomingLocatedEvents. */
  locationText: string;
};

// --- Connection state ----------------------------------------------------

export async function getCalendarConnection(): Promise<CalendarConnection> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CONNECTION;
    const parsed = JSON.parse(raw) as Partial<CalendarConnection>;
    return { ...DEFAULT_CONNECTION, ...parsed };
  } catch (err) {
    console.warn('getCalendarConnection failed', err);
    return DEFAULT_CONNECTION;
  }
}

export async function setCalendarConnected(
  connected: boolean,
): Promise<CalendarConnection> {
  const next: CalendarConnection = { connected };
  await accountOperationGate.runCurrent(async () => {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  });
  return next;
}

/** Sign-out hygiene — drop the connection flag. */
export async function clearCalendarConnection(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}

export async function purgeCalendarConnectionForAccount(): Promise<void> {
  await clearCalendarConnection();
}

// --- Event reading (read-only) -------------------------------------------

/**
 * Requests calendar read permission and returns it. Separated so the
 * hook can drive the permission UX (connect button → prompt → on grant
 * persist connected=true). Returns the granted boolean.
 */
export async function requestCalendarPermission(): Promise<boolean> {
  const { status } = await Calendar.requestCalendarPermissionsAsync();
  return status === 'granted';
}

/**
 * Reads upcoming events (next CALENDAR_LOOKAHEAD_DAYS) that have non-
 * empty location text, across all the device's calendars. Pure of
 * geocoding — turning location text into coordinates is the resolver
 * hook's job. Returns [] if permission isn't granted or on any error
 * (the caller treats empty as "nothing to show", which is honest).
 *
 * `now` is injectable for testing; defaults to Date.now() at call time.
 */
export async function getUpcomingLocatedEvents(
  now: number = Date.now(),
): Promise<UpcomingEvent[]> {
  try {
    const granted = (await Calendar.getCalendarPermissionsAsync()).status === 'granted';
    if (!granted) return [];

    const calendars = await Calendar.getCalendarsAsync(
      Calendar.EntityTypes.EVENT,
    );
    if (calendars.length === 0) return [];

    const start = new Date(now);
    const end = new Date(now + CALENDAR_LOOKAHEAD_DAYS * 24 * 60 * 60 * 1000);
    const events = await Calendar.getEventsAsync(
      calendars.map((c) => c.id),
      start,
      end,
    );

    return events
      .filter((e) => typeof e.location === 'string' && e.location.trim().length > 0)
      .map((e) => ({
        id: e.id,
        title: e.title?.trim() || 'Untitled event',
        startsAt: new Date(e.startDate).getTime(),
        locationText: (e.location as string).trim(),
      }))
      .sort((a, b) => a.startsAt - b.startsAt);
  } catch (err) {
    console.warn('getUpcomingLocatedEvents failed', err);
    return [];
  }
}
