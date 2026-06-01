# Connect Calendar — Implementation Plan (Plan 2 of 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connecting the user's calendar reads their upcoming located events and surfaces them as one-tap navigation destinations in `/search`, with a persisted manual-correct affordance for events whose location text doesn't geocode.

**Architecture:** A read-only `expo-calendar` integration behind two AsyncStorage adapters (connection state + events; persisted location corrections) and two hooks (connection; the event→destination resolver that composes events + corrections + the existing `searchPlaces` geocode). The `/search` screen gains an "Upcoming" section; `/menu`'s carousel gains a second progressive tile ("Connect calendar"); a pick-sheet handles manual location correction.

**Tech Stack:** React Native + Expo (managed), TypeScript, `expo-calendar` (NEW dep, read-only), AsyncStorage, the existing `searchPlaces` (Mapbox Search Box) geocode, the settings register primitives from Plan 1.

**Spec:** [docs/superpowers/specs/2026-06-01-settings-register-refresh-design.md](../specs/2026-06-01-settings-register-refresh-design.md) (§ Connect Calendar Feature)

**Plan 1 (settings register) is landed** (`7fc4cff`). This plan builds on it: the carousel tile uses the same `tileCard` styles; `/menu`'s sign-out handler already clears identity stores (we add to it).

> **⚠ Native-module note for the implementer + verifier:** `expo-calendar` is a native module. After Task 1 it will NOT work in Expo Go — calendar reads require a dev build (`npx expo run:ios`) or a development client. tsc + the JS logic can be validated without it, but the simulator verification (Task 10) needs a dev build with a calendar that has located events. This is expected; flag it, don't treat it as a failure.

**tsc baseline filter** (pre-existing, not regressions): `npx tsc --noEmit 2>&1 | grep -vE "avatar\.png|@vercel/node"` — empty = clean.

---

## File structure

| File | Action | Responsibility |
|---|---|---|
| `app.json` (or `app.config.*`) | modify | Register the `expo-calendar` config plugin + `NSCalendarsUsageDescription`. |
| `package.json` | modify | `expo-calendar` dependency (via `npx expo install`). |
| `lib/api/calendar.ts` | create | Connection state (AsyncStorage) + `getUpcomingLocatedEvents()` reading the device calendar (read-only). |
| `lib/api/calendar-resolutions.ts` | create | Persisted location corrections, keyed by event location text. |
| `hooks/useCalendarConnection.ts` | create | Reactive connection state + `connect()` (permission request) / `disconnect()`. |
| `hooks/useUpcomingDestinations.ts` | create | The resolver: events × resolutions × `searchPlaces` → `{ resolved, unresolved, loading }`. |
| `components/CalendarPickSheet.tsx` | create | Bottom-sheet to search + pick a location for an unresolved/wrong event; persists the correction. |
| `app/search.tsx` | modify | "Upcoming" section (rendered when connected): resolved → route rows, unresolved → "Set location" rows; opens the pick-sheet. |
| `app/menu.tsx` | modify | Carousel gains the "Connect calendar" tile (2nd progressive tile); sign-out clears the two calendar stores. |

No test runner — verification is `tsc` per task + a dev-build simulator pass (Task 10).

---

## Task 1: Add the expo-calendar dependency + permission config

**Files:**
- Modify: `package.json` (via expo install)
- Modify: `app.json` / `app.config.*` (plugin + usage string)

- [ ] **Step 1: Install via expo (pins an SDK-compatible version)**

Run: `npx expo install expo-calendar`
Expected: `expo-calendar` added to `package.json` dependencies at an SDK-54-compatible version.

- [ ] **Step 2: Register the config plugin + iOS usage string**

Open `app.json` (or `app.config.js`/`.ts` if the project uses one — check which exists first). In the `expo.plugins` array, add the calendar plugin with a usage string:

```json
[
  "expo-calendar",
  {
    "calendarPermission": "Fresh Greens reads your upcoming events to offer them as safe-routed destinations. It never edits your calendar."
  }
]
```

If the project has no `plugins` array yet, add one under `expo`. Also confirm/add the raw iOS key under `expo.ios.infoPlist` as a fallback:

```json
"NSCalendarsUsageDescription": "Fresh Greens reads your upcoming events to offer them as safe-routed destinations. It never edits your calendar."
```

(Read-only access: do NOT add `NSCalendarsWriteOnlyAccessUsageDescription` or `NSRemindersUsageDescription` — we never write events or touch reminders.)

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep -vE "avatar\.png|@vercel/node"`
Expected: empty. (`expo-calendar` ships its own types.)

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json app.json
git commit -m "chore(deps): add expo-calendar (read-only) for the Connect-calendar feature

Flagged per .cursorrules anti-slop #4: expo-calendar is the canonical
Expo wrapper for iOS EventKit; no built-in covers native calendar
access. Read-only — calendarPermission usage string set, no write/
reminders keys. NOTE: native module — calendar reads require a dev
build, not Expo Go.

Spec: docs/superpowers/specs/2026-06-01-settings-register-refresh-design.md"
```

---

## Task 2: `lib/api/calendar.ts` — connection state + event reading

**Files:**
- Create: `lib/api/calendar.ts`

- [ ] **Step 1: Create the adapter**

```ts
// lib/api/calendar.ts
//
// Connect-calendar adapter. Two concerns: (1) a tiny AsyncStorage flag
// for whether the user has connected their calendar, and (2) a read-only
// reader that returns upcoming events with a non-empty location, for the
// /search Upcoming section. Same architectural shape as preferences.ts /
// fuel.ts: typed surface, AsyncStorage internals, backend swap-in
// preserved. Read-only: this module never creates or edits events.
//
// Spec: docs/superpowers/specs/2026-06-01-settings-register-refresh-design.md

import AsyncStorage from '@react-native-async-storage/async-storage';
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
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

/** Sign-out hygiene — drop the connection flag. */
export async function clearCalendarConnection(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
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
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep calendar.ts`
Expected: empty. (If `Calendar.getEventsAsync`'s signature differs in the installed version — e.g. the start/end are strings — adjust the Date args to match the installed `expo-calendar` types; report DONE_WITH_CONCERNS noting the adjustment.)

- [ ] **Step 3: Commit**

```bash
git add lib/api/calendar.ts
git commit -m "feat(calendar): connection-state + read-only upcoming-events adapter

AsyncStorage connection flag + getUpcomingLocatedEvents (next 7 days,
non-empty location, all calendars, sorted by start). Read-only;
permission helper separated for the hook to drive the connect UX.
Empty-on-error/empty-on-denied so callers honestly show nothing.

Spec: docs/superpowers/specs/2026-06-01-settings-register-refresh-design.md"
```

---

## Task 3: `lib/api/calendar-resolutions.ts` — persisted corrections

**Files:**
- Create: `lib/api/calendar-resolutions.ts`

- [ ] **Step 1: Create the adapter**

```ts
// lib/api/calendar-resolutions.ts
//
// Persisted manual location corrections for calendar events, keyed by
// the event's raw location TEXT (not event id) so recurring events and
// repeated venues reuse one correction. When the user fixes "Dr. Lee
// Dentistry" → a picked place, every event with that location text
// auto-resolves thereafter. Same adapter shape as the other lib/api
// stores.
//
// Spec: docs/superpowers/specs/2026-06-01-settings-register-refresh-design.md

import AsyncStorage from '@react-native-async-storage/async-storage';

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
  const current = await getResolutions();
  const next: ResolutionMap = { ...current, [locationText]: place };
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

/** Sign-out hygiene — drop all corrections. */
export async function clearResolutions(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep calendar-resolutions`
Expected: empty.

- [ ] **Step 3: Commit**

```bash
git add lib/api/calendar-resolutions.ts
git commit -m "feat(calendar): persisted location-correction store (keyed by location text)

ResolutionMap = locationText → ResolvedPlace in AsyncStorage. Keyed by
the raw event location string (not event id) so recurring events +
repeated venues reuse one correction. get/set/clear surface.

Spec: docs/superpowers/specs/2026-06-01-settings-register-refresh-design.md"
```

---

## Task 4: `hooks/useCalendarConnection.ts`

**Files:**
- Create: `hooks/useCalendarConnection.ts`

- [ ] **Step 1: Create the hook**

```tsx
// hooks/useCalendarConnection.ts
import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import { useFocusEffect } from 'expo-router';

import {
  getCalendarConnection,
  requestCalendarPermission,
  setCalendarConnected,
} from '../lib/api/calendar';

/**
 * Reactive wrapper over the calendar connection flag. Re-reads on focus
 * (matching usePreferences) so the /menu carousel tile + /search
 * Upcoming section both reflect a connection made elsewhere.
 *
 * connect() runs the OS permission prompt; on grant it persists
 * connected=true, on denial it surfaces the standard "enable in
 * Settings" Alert and leaves connected=false (honest — we didn't get
 * access). disconnect() flips the flag off (the OS permission itself is
 * managed in iOS Settings; this is the app-level opt-out).
 */
export function useCalendarConnection() {
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const c = await getCalendarConnection();
        if (!cancelled) {
          setConnected(c.connected);
          setLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const connect = useCallback(async () => {
    const granted = await requestCalendarPermission();
    if (!granted) {
      Alert.alert(
        'Calendar access needed',
        'Allow Calendar access for Fresh Greens in Settings to see your upcoming events as destinations.',
      );
      return false;
    }
    await setCalendarConnected(true);
    setConnected(true);
    return true;
  }, []);

  const disconnect = useCallback(async () => {
    await setCalendarConnected(false);
    setConnected(false);
  }, []);

  return { connected, loading, connect, disconnect };
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep useCalendarConnection`
Expected: empty.

- [ ] **Step 3: Commit**

```bash
git add hooks/useCalendarConnection.ts
git commit -m "feat(calendar): useCalendarConnection hook

Reactive connection flag, re-reads on focus (matches usePreferences).
connect() drives the OS permission prompt → persists on grant, Alerts
+ stays false on denial. disconnect() = app-level opt-out.

Spec: docs/superpowers/specs/2026-06-01-settings-register-refresh-design.md"
```

---

## Task 5: `hooks/useUpcomingDestinations.ts` — the resolver

**Files:**
- Create: `hooks/useUpcomingDestinations.ts`

- [ ] **Step 1: Create the hook**

```tsx
// hooks/useUpcomingDestinations.ts
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import {
  getUpcomingLocatedEvents,
  type UpcomingEvent,
} from '../lib/api/calendar';
import {
  getResolutions,
  type ResolvedPlace,
} from '../lib/api/calendar-resolutions';
import { searchPlaces } from '../lib/api/places';

export type ResolvedDestination = {
  event: UpcomingEvent;
  place: ResolvedPlace;
};

/**
 * Resolves upcoming located events into navigable destinations.
 *
 * For each event in the next 7 days with a non-empty location:
 *   1. A stored manual correction for its locationText wins (no geocode
 *      call) — that's the persisted pick-sheet result.
 *   2. Else geocode the locationText via searchPlaces (the same path
 *      /unfamiliar uses); the first hit becomes the resolved place.
 *   3. Else the event is UNRESOLVED — surfaced with a "Set location"
 *      affordance rather than hidden, so the user can correct it.
 *
 * Returns resolved + unresolved + loading. Re-runs on focus and when
 * `refreshKey` changes (bump it after a pick-sheet correction so the
 * list re-resolves immediately). geocode is called once per distinct
 * unresolved locationText per run.
 */
export function useUpcomingDestinations(
  userLocation: { latitude: number; longitude: number } | null,
  refreshKey: number = 0,
) {
  const [resolved, setResolved] = useState<ResolvedDestination[]>([]);
  const [unresolved, setUnresolved] = useState<UpcomingEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        setLoading(true);
        const events = await getUpcomingLocatedEvents();
        const resolutions = await getResolutions();

        const nextResolved: ResolvedDestination[] = [];
        const nextUnresolved: UpcomingEvent[] = [];
        // Cache geocode results per locationText within this run so two
        // events at the same venue don't double-call searchPlaces.
        const geocodeCache = new Map<string, ResolvedPlace | null>();

        for (const event of events) {
          const stored = resolutions[event.locationText];
          if (stored) {
            nextResolved.push({ event, place: stored });
            continue;
          }
          if (!userLocation) {
            // Can't geocode without an anchor — treat as unresolved for
            // now; a later run with a fix re-resolves.
            nextUnresolved.push(event);
            continue;
          }
          let place: ResolvedPlace | null;
          if (geocodeCache.has(event.locationText)) {
            place = geocodeCache.get(event.locationText) ?? null;
          } else {
            try {
              const hits = await searchPlaces(event.locationText, userLocation);
              const hit = hits[0];
              place = hit
                ? { name: hit.name, latitude: hit.latitude, longitude: hit.longitude }
                : null;
            } catch {
              place = null;
            }
            geocodeCache.set(event.locationText, place);
          }
          if (place) {
            nextResolved.push({ event, place });
          } else {
            nextUnresolved.push(event);
          }
        }

        if (!cancelled) {
          setResolved(nextResolved);
          setUnresolved(nextUnresolved);
          setLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
      // userLocation identity + refreshKey drive re-resolution.
    }, [userLocation, refreshKey]),
  );

  return { resolved, unresolved, loading };
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep useUpcomingDestinations`
Expected: empty. Confirm `searchPlaces(query, userLocation)` matches the real signature in `lib/api/places.ts` (`(query: string, userLocation: {latitude, longitude}) => Promise<Place[]>`) and `Place` has `name`/`latitude`/`longitude`.

- [ ] **Step 3: Commit**

```bash
git add hooks/useUpcomingDestinations.ts
git commit -m "feat(calendar): useUpcomingDestinations resolver hook

Composes upcoming located events × stored corrections × searchPlaces
geocode into { resolved, unresolved, loading }. Stored correction wins
(no geocode); else first searchPlaces hit; else unresolved (shown with
Set-location, not hidden). Per-run geocode cache dedups same-venue
events. Re-resolves on focus + refreshKey bump.

Spec: docs/superpowers/specs/2026-06-01-settings-register-refresh-design.md"
```

---

## Task 6: `components/CalendarPickSheet.tsx` — manual correction

**Files:**
- Create: `components/CalendarPickSheet.tsx`

- [ ] **Step 1: Create the component**

```tsx
// components/CalendarPickSheet.tsx
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { MagnifyingGlass } from 'phosphor-react-native/src/icons/MagnifyingGlass';
import { X } from 'phosphor-react-native/src/icons/X';

import { DragHandle } from './DragHandle';
import { searchPlaces, type Place } from '../lib/api/places';
import { type ResolvedPlace } from '../lib/api/calendar-resolutions';
import { colors } from '../theme/colors';
import { dynamicType } from '../theme/dynamic-type';
import { pressedDim } from '../theme/interaction';
import { radii } from '../theme/radii';
import { shadows } from '../theme/shadows';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

/**
 * Manual location correction for a calendar event. Bottom-sheet (same
 * scrim + sheet + drag-handle chrome as ReportDetailCard / ZoneDetailCard)
 * pre-filled with the event's location text. The user searches (via
 * searchPlaces) and picks the right place; the parent persists it.
 *
 * Spec: docs/superpowers/specs/2026-06-01-settings-register-refresh-design.md
 */
export function CalendarPickSheet({
  initialQuery,
  userLocation,
  onPick,
  onDismiss,
}: {
  initialQuery: string;
  userLocation: { latitude: number; longitude: number } | null;
  onPick: (place: ResolvedPlace) => void;
  onDismiss: () => void;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<Place[]>([]);
  const [searching, setSearching] = useState(false);

  async function runSearch() {
    const q = query.trim();
    if (!q || !userLocation) return;
    setSearching(true);
    try {
      const hits = await searchPlaces(q, userLocation);
      setResults(hits);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }

  return (
    <Pressable
      style={styles.scrim}
      onPress={onDismiss}
      accessibilityRole="button"
      accessibilityLabel="Dismiss location picker"
    >
      <Pressable
        style={styles.sheet}
        onPress={() => {}}
        accessibilityViewIsModal
      >
        <DragHandle />

        <View style={styles.header}>
          <Text style={styles.title} accessibilityRole="header">
            Set location
          </Text>
          <Pressable
            onPress={onDismiss}
            accessibilityRole="button"
            accessibilityLabel="Close"
            hitSlop={8}
            style={({ pressed }) => [styles.closeBtn, pressed && pressedDim]}
          >
            <X size={20} color={colors.labelSecondary} weight="bold" />
          </Pressable>
        </View>

        <View style={styles.searchRow}>
          <MagnifyingGlass size={20} color={colors.labelTertiary} weight="regular" />
          <TextInput
            style={styles.input}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={runSearch}
            placeholder="Search for the place"
            placeholderTextColor={colors.labelTertiary}
            returnKeyType="search"
            autoFocus
            accessibilityLabel="Search for the event's location"
          />
        </View>

        {searching ? (
          <ActivityIndicator style={styles.spinner} color={colors.labelSecondary} />
        ) : (
          <View style={styles.results}>
            {results.map((place) => (
              <Pressable
                key={place.id}
                onPress={() =>
                  onPick({
                    name: place.name,
                    latitude: place.latitude,
                    longitude: place.longitude,
                  })
                }
                accessibilityRole="button"
                accessibilityLabel={`Use ${place.name}`}
                style={({ pressed }) => [styles.resultRow, pressed && pressedDim]}
              >
                <Text style={styles.resultName} numberOfLines={1}>
                  {place.name}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.modalScrim,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
    ...shadows.sheet,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    ...dynamicType(typography.title2Emphasized),
    color: colors.black,
  },
  closeBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.systemGroupedBackground,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    minHeight: 44,
  },
  input: {
    ...dynamicType(typography.bodyRegular),
    color: colors.black,
    flex: 1,
    paddingVertical: spacing.sm,
  },
  spinner: {
    paddingVertical: spacing.lg,
  },
  results: {
    gap: spacing.xs,
  },
  resultRow: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  resultName: {
    ...dynamicType(typography.bodyRegular),
    color: colors.black,
  },
});
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep -E "CalendarPickSheet"`
Expected: empty. Confirm `colors.modalScrim` + `shadows.sheet` exist (they're used by ReportDetailCard — grep to confirm exact names; if `shadows.sheet` is named differently, match it).

- [ ] **Step 3: Commit**

```bash
git add components/CalendarPickSheet.tsx
git commit -m "feat(calendar): CalendarPickSheet manual-correction bottom sheet

Scrim + sheet + drag-handle chrome (matches ReportDetailCard). Search
field pre-filled with the event's location text; runs searchPlaces on
submit; picking a result calls onPick (parent persists the correction).

Spec: docs/superpowers/specs/2026-06-01-settings-register-refresh-design.md"
```

---

## Task 7: `/search` Upcoming section

**Files:**
- Modify: `app/search.tsx`

The section renders only when the calendar is connected. Resolved events route on tap (same `router.replace` as `handleSelectSaved`); unresolved events open the pick-sheet. A correction bumps a `refreshKey` so the resolver re-runs.

- [ ] **Step 1: Add imports**

```tsx
import { useCalendarConnection } from '../hooks/useCalendarConnection';
import { useUpcomingDestinations } from '../hooks/useUpcomingDestinations';
import { CalendarPickSheet } from '../components/CalendarPickSheet';
import { setResolution, type ResolvedPlace } from '../lib/api/calendar-resolutions';
import { type UpcomingEvent } from '../lib/api/calendar';
import { CalendarBlank } from 'phosphor-react-native/src/icons/CalendarBlank';
```

- [ ] **Step 2: Wire the hooks + pick-sheet state**

In the `Search` component body, near the other hooks. `userLocation` must be the same coordinate the screen already uses for `searchPlaces` — find the existing user-location/coords value in the file (it's passed to `searchPlaces` in `handleQueryChange`); reuse that exact source. If it's stored as state like `userCoords`, use it; if derived, derive the same way.

```tsx
const { connected: calendarConnected } = useCalendarConnection();
const [calRefreshKey, setCalRefreshKey] = useState(0);
const { resolved: upcomingResolved, unresolved: upcomingUnresolved } =
  useUpcomingDestinations(userCoords, calRefreshKey);
const [pickEvent, setPickEvent] = useState<UpcomingEvent | null>(null);

function handlePickResolution(place: ResolvedPlace) {
  if (!pickEvent) return;
  void setResolution(pickEvent.locationText, place).then(() => {
    setPickEvent(null);
    setCalRefreshKey((k) => k + 1); // re-resolve with the new correction
  });
}

function handleSelectUpcoming(place: ResolvedPlace, name: string) {
  router.replace({
    pathname: fromEnRoute ? '/en-route' : '/home',
    params: {
      destLat: String(place.latitude),
      destLng: String(place.longitude),
      destName: name,
    },
  });
}

function relativeWhen(startsAt: number): string {
  const diffMin = Math.round((startsAt - Date.now()) / 60000);
  if (diffMin < 60) return diffMin <= 0 ? 'now' : `in ${diffMin}m`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `in ${diffHr}h`;
  const diffDay = Math.round(diffHr / 24);
  return diffDay === 1 ? 'tomorrow' : `in ${diffDay}d`;
}
```

Replace `userCoords` with the file's actual user-location variable name. If the screen lacks a stored user coordinate (it requests location per-search), add a one-shot `userCoords` state seeded from `Location.getForegroundPermissionsAsync()` + `getCurrentPositionAsync` in a mount effect — mirror how `/unfamiliar` obtains the anchor. Report DONE_WITH_CONCERNS if you have to add the location fetch, noting it.

- [ ] **Step 3: Render the Upcoming section**

Place it in the browse/empty view (the same area as the Saved section, around `app/search.tsx:572`), ABOVE the Saved tool block, gated on `calendarConnected`. Use the existing `recentSection` / `recentLabel` / `recentItem` / `recentTextColumn` / `recentText` / `recentSubtext` styles for register consistency:

```tsx
{calendarConnected &&
  (upcomingResolved.length > 0 || upcomingUnresolved.length > 0) && (
    <View style={styles.recentSection}>
      <Text style={styles.recentLabel}>Upcoming</Text>
      {upcomingResolved.map(({ event, place }) => (
        <Pressable
          key={event.id}
          style={({ pressed }) => [styles.recentItem, pressed && pressedDim]}
          onPress={() => handleSelectUpcoming(place, event.title)}
          accessibilityRole="button"
          accessibilityLabel={`${event.title}, ${place.name}, ${relativeWhen(event.startsAt)}. Tap to navigate.`}
        >
          <CalendarBlank size={24} color={colors.labelTertiary} weight="duotone" />
          <View style={styles.recentTextColumn}>
            <Text style={styles.recentText} numberOfLines={1}>
              {event.title}
            </Text>
            <Text style={styles.recentSubtext} numberOfLines={1}>
              {place.name} · {relativeWhen(event.startsAt)}
            </Text>
          </View>
        </Pressable>
      ))}
      {upcomingUnresolved.map((event) => (
        <Pressable
          key={event.id}
          style={({ pressed }) => [styles.recentItem, pressed && pressedDim]}
          onPress={() => setPickEvent(event)}
          accessibilityRole="button"
          accessibilityLabel={`${event.title}, ${relativeWhen(event.startsAt)}. Location not set — tap to choose.`}
        >
          <CalendarBlank size={24} color={colors.labelTertiary} weight="duotone" />
          <View style={styles.recentTextColumn}>
            <Text style={styles.recentText} numberOfLines={1}>
              {event.title}
            </Text>
            <Text style={styles.recentSubtext} numberOfLines={1}>
              Set location · {relativeWhen(event.startsAt)}
            </Text>
          </View>
        </Pressable>
      ))}
    </View>
  )}
```

- [ ] **Step 4: Render the pick-sheet**

At the top level of the screen's return (sibling to the main content, like a modal overlay — e.g. just before the closing root tag), add:

```tsx
{pickEvent && (
  <CalendarPickSheet
    initialQuery={pickEvent.locationText}
    userLocation={userCoords}
    onPick={handlePickResolution}
    onDismiss={() => setPickEvent(null)}
  />
)}
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep -vE "avatar\.png|@vercel/node"`
Expected: empty.

- [ ] **Step 6: Commit**

```bash
git add app/search.tsx
git commit -m "feat(search): Upcoming calendar-event destinations section

Renders when the calendar is connected: resolved events route on tap
(same destLat/destLng path as Saved rows); unresolved events open the
CalendarPickSheet to set a location, which persists + re-resolves via
a refreshKey bump. Reuses the recent/saved row register.

Spec: docs/superpowers/specs/2026-06-01-settings-register-refresh-design.md"
```

---

## Task 8: `/menu` carousel — Connect-calendar tile

**Files:**
- Modify: `app/menu.tsx`

Plan 1 left `/menu` with a single conditional Refuel tile. Now there are two progressive tiles, so restore a horizontal carousel that shows whichever tiles are still un-configured.

- [ ] **Step 1: Add imports + hook**

```tsx
import { useCalendarConnection } from '../hooks/useCalendarConnection';
import { CalendarBlank } from 'phosphor-react-native/src/icons/CalendarBlank';
```
In the component body:
```tsx
const { connected: calendarConnected, connect: connectCalendar } = useCalendarConnection();
const showCalendarTile = !calendarConnected;
```

- [ ] **Step 2: Build the tiles list + render**

Replace the single `{showFuelTile && (<Pressable .../>)}` block with a horizontal carousel of the eligible tiles. Build the list:

```tsx
const carouselTiles = [
  showFuelTile && {
    key: 'fuel',
    label: 'Set up refuel reminders',
    subtitle: "Add your fuel cadence so you don't run low in an unsafe spot.",
    icon: <FuelIcon width={32} height={32} />,
    onPress: () => {
      Haptics.selectionAsync().catch(() => {});
      router.push('/fuel');
    },
  },
  showCalendarTile && {
    key: 'calendar',
    label: 'Connect your calendar',
    subtitle: 'Turn upcoming appointments into one-tap safe-routed destinations.',
    icon: <CalendarBlank size={32} color={colors.wiltedgreen} weight="duotone" />,
    onPress: () => {
      Haptics.selectionAsync().catch(() => {});
      void connectCalendar();
    },
  },
].filter(Boolean) as {
  key: string;
  label: string;
  subtitle: string;
  icon: React.ReactNode;
  onPress: () => void;
}[];
```

Render (only when `carouselTiles.length > 0`): a horizontal `ScrollView` when >1 tile, a single full-width card when ==1. To keep it simple and avoid reintroducing the FlatList/PageControl machinery, use a horizontal ScrollView with the tiles:

```tsx
{carouselTiles.length > 0 && (
  <ScrollView
    horizontal
    showsHorizontalScrollIndicator={false}
    contentContainerStyle={styles.carouselContent}
  >
    {carouselTiles.map((tile) => (
      <Pressable
        key={tile.key}
        style={({ pressed }) => [
          styles.tileCard,
          carouselTiles.length > 1 && styles.tileCardCarousel,
          pressed && pressedDim,
        ]}
        onPress={tile.onPress}
        accessibilityRole="button"
        accessibilityLabel={`${tile.label}. ${tile.subtitle}`}
      >
        <View style={styles.tileIcon}>{tile.icon}</View>
        <Text style={styles.tileTitle}>{tile.label}</Text>
        <Text style={styles.tileSubtitle}>{tile.subtitle}</Text>
      </Pressable>
    ))}
  </ScrollView>
)}
```

Add styles:
```tsx
  carouselContent: {
    gap: spacing.md,
  },
  // When ≥2 tiles, each is ~80% viewport width so the next peeks; a
  // lone tile uses the default full-width tileCard.
  tileCardCarousel: {
    width: 280,
  },
```
(`ScrollView` is already imported in `/menu`; if `React` isn't imported for the `React.ReactNode` cast, use `import type { ReactNode } from 'react'` and type the array with `ReactNode`.)

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep -vE "avatar\.png|@vercel/node"`
Expected: empty.

- [ ] **Step 4: Commit**

```bash
git add app/menu.tsx
git commit -m "feat(menu): Connect-calendar carousel tile + restore horizontal carousel

Second progressive tile: 'Connect your calendar' shows while the
calendar is unconnected; tapping runs the connect flow (permission
prompt). With 2 eligible tiles the carousel scrolls horizontally; with
1 it's a full-width card; with 0 the section is gone. Tiles hide once
their setting is configured.

Spec: docs/superpowers/specs/2026-06-01-settings-register-refresh-design.md"
```

---

## Task 9: Sign-out hygiene

**Files:**
- Modify: `app/menu.tsx`

- [ ] **Step 1: Clear the calendar stores on sign-out**

Add imports:
```tsx
import { clearCalendarConnection } from '../lib/api/calendar';
import { clearResolutions } from '../lib/api/calendar-resolutions';
```
In `handleSignOut`'s `Promise.all([...])`, add the two clears alongside the existing ones (`signOut()`, `clearContact()`, `clearSavedPlaces()`, `clearRegularDestinations()`, `clearPreferences()`, `clearFuelProfile()`):
```tsx
        clearCalendarConnection(),
        clearResolutions(),
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep -vE "avatar\.png|@vercel/node"`
Expected: empty.

- [ ] **Step 3: Commit**

```bash
git add app/menu.tsx
git commit -m "feat(menu): clear calendar connection + resolutions on sign-out

Sign-out hygiene — a sign-out must not leave the next user another
user's calendar connection flag or location corrections on the device.
Added to the existing identity-clear Promise.all.

Spec: docs/superpowers/specs/2026-06-01-settings-register-refresh-design.md"
```

---

## Task 10: Verification

**Files:** none modified.

- [ ] **Step 1: tsc baseline**

Run: `npx tsc --noEmit 2>&1 | grep -vE "avatar\.png|@vercel/node"; echo done`
Expected: empty then `done`.

- [ ] **Step 2: Dev build (native module — Expo Go won't work)**

Run: `npx expo run:ios` (or the project's dev-client build). Confirm it builds with `expo-calendar` linked.

- [ ] **Step 3: Connect flow**

`/menu` → the "Connect your calendar" tile shows. Tap → iOS calendar permission prompt. Grant → tile disappears (carousel collapses to just Refuel, or gone if reminders also set). Deny → "Calendar access needed" Alert, tile stays.

- [ ] **Step 4: Upcoming section (needs a seeded calendar)**

On the test device/simulator, add calendar events in the next 7 days: one with a geocodable address location ("Apple Park, Cupertino"), one with a vague location ("Mom's"), one with no location. Open `/search`:
- Geocodable event → appears under "Upcoming" with a resolved place name; tap routes to it.
- Vague event → appears with "Set location"; tap → CalendarPickSheet → search + pick → row becomes resolved (persists; re-opening /search keeps it resolved).
- No-location event → does NOT appear.

- [ ] **Step 5: Sign-out hygiene**

Connect calendar, set a correction, sign out, sign back in → calendar tile shows again (connection cleared), corrections gone.

- [ ] **Step 6: tsc-only fallback if no dev build available**

If a dev build can't be produced in this environment, confirm: tsc clean, all 9 prior commits present, and that the JS logic is sound by reading. Note in the report that native verification is pending a dev build. Do NOT claim the calendar reads were verified if they weren't run.

---

## Self-review (writing-plans skill)

**Spec coverage** (§ Connect Calendar Feature):
- New dependency → Task 1. ✓
- `lib/api/calendar.ts` (connection + getUpcomingLocatedEvents + CALENDAR_LOOKAHEAD_DAYS=7) → Task 2. ✓
- `lib/api/calendar-resolutions.ts` (ResolvedPlace, ResolutionMap, get/set/clear, keyed by locationText) → Task 3. ✓
- `useCalendarConnection` (connect/disconnect, permission Alert) → Task 4. ✓
- `useUpcomingDestinations` (stored-wins → geocode → unresolved; per-run cache; focus+refreshKey) → Task 5. ✓
- CalendarPickSheet (scrim/sheet chrome, prefilled search, persist on pick) → Task 6. ✓
- `/search` Upcoming section (resolved route rows + unresolved Set-location rows + pick-sheet) → Task 7. ✓
- `/menu` Connect-calendar tile (2nd progressive tile, hides on connect) → Task 8. ✓
- Sign-out hygiene (clearCalendarConnection + clearResolutions) → Task 9. ✓
- Known limitations (first-hit-wrong, non-geocodable unresolved, read-only, focus-refresh) → encoded in adapter/hook behavior + the verification handles them. ✓

**Placeholder scan:** retrofit tasks (7, 8, 9) reference existing variables (`userCoords`, `fromEnRoute`, `handleSignOut`'s Promise.all, the `tileCard`/`recent*` styles) because they extend existing code — each names the exact symbol + shows the new code. Net-new (adapters, hooks, pick-sheet) is full code. The one genuine unknown — `/search`'s user-coordinate source — is called out explicitly in Task 7 Step 2 with a fallback instruction + a DONE_WITH_CONCERNS directive rather than a vague "get the location somehow."

**Type consistency:** `UpcomingEvent` (id/title/startsAt/locationText), `ResolvedPlace` (name/lat/lng), `ResolutionMap`, `ResolvedDestination` ({event, place}) used identically across Tasks 2/3/5/6/7. `searchPlaces(query, userLocation): Promise<Place[]>` matches the real signature. Hook returns (`{connected, loading, connect, disconnect}`, `{resolved, unresolved, loading}`) match their consumers in Tasks 7/8.

**One flagged risk for the implementer:** Task 7's user-coordinate source is the only "read the existing file to find X" dependency. If `/search` doesn't hold a persistent user coordinate, Task 7 must add a one-shot location fetch (instruction included) — surfaced as DONE_WITH_CONCERNS so the reviewer scrutinizes it.

No gaps. Plan complete.
