# Refuel Reminders — Design Spec

**Date:** 2026-05-30
**Status:** Approved scope, pending spec review → implementation planning
**Topic:** Make the /search Fuel card real — a time-based refuel-reminder feature with on-route fuel stops.

---

## Goal

Replace the /search Fuel card's coming-soon stub with a genuine, honest, local-only feature: a user-set **time-based refuel reminder** (a light car profile + a cadence), plus **on-route fuel stops** surfaced during navigation. No fake fuel-sensing, no new sensitive permission.

## Scope decisions (from brainstorm)

- **Trigger model: time-based.** A phone can't sense fuel level, and the app has no mileage tracking (verified — nothing accumulates driven distance). So the reminder is an explicit user-set cadence ("every N days"), not a fake fuel gauge. Distance-based auto-tracking was rejected (biggest build, *and* unreliable — it could only count in-app-navigated drives, undercounting routine driving and misleading the user).
- **Data: light car profile + cadence.** Optional nickname/model + fuel type (tunes copy: "refuel" vs "recharge") + cadence. Matches the Figma "add your car's model and fuel" intent and personalizes the reminder. No tank-size/MPG fields (the time-based reminder never uses them — YAGNI).
- **Feature scope: Approach C** — the minimal recurring reminder **plus on-route fuel stops** (the thesis-aligned piece: fuel along your daylight-optimized route).
- **On-route surface: true on-route stops in /en-route** — gas/charging stations filtered by proximity to the active route polyline, surfaced during navigation (not just "gas near me" from the card).
- **Local-only**, iPhone-first, App-Store-honest.

---

## Architecture — four units

### ① Store — `lib/api/fuel.ts` (new)

Mirrors the `lib/api/preferences.ts` adapter exactly: typed shape, async `getStored`/`setStored`/`clearStored`, defaults, merge-with-defaults so older stored shapes still resolve.

```ts
export type FuelType = 'gas' | 'diesel' | 'hybrid' | 'electric';

export type FuelProfile = {
  carName?: string;             // optional nickname/model — "Civic"
  fuelType: FuelType;           // tunes copy + the on-route POI query
  cadenceDays: number;          // remind every N days
  remindersEnabled: boolean;
  lastFilledAt: string | null;  // ISO — set at enable + on "I filled up"
  nextReminderAt: string | null;// derived: lastFilledAt + cadenceDays
  notificationId: string | null;// scheduled reminder id (cancel/reschedule)
};

export const DEFAULT_FUEL_PROFILE: FuelProfile = {
  fuelType: 'gas',
  cadenceDays: 7,
  remindersEnabled: false,
  lastFilledAt: null,
  nextReminderAt: null,
  notificationId: null,
};
```

- `STORAGE_KEY = 'fresh-greens.fuel.v1'`.
- `getStoredFuelProfile()` / `setStoredFuelProfile(profile)` / `clearStoredFuelProfile()`.
- Added to the sign-out `Promise.all` clear set (alongside user, trusted-contact, preferences, recordings).
- A `hooks/useFuelProfile.ts` reactive wrapper: `{ profile, loading, saveProfile, markFilledUp, disableReminders }`. `saveProfile`/`markFilledUp`/`disableReminders` each also drive the reminder engine (② below) and persist the resulting `notificationId`/`nextReminderAt`.

### ② Reminder engine — add to `lib/notifications.ts`

Alongside the existing `scheduleDepartureNotification`. Same conventions (inline permission ask, discriminated result, `console` breadcrumbs).

- `scheduleRefuelReminder(profile: FuelProfile): Promise<RefuelScheduleResult>`
  - Cancels any prior reminder (`Notifications.cancelScheduledNotificationAsync(profile.notificationId)` if set).
  - Schedules a **recurring** local notification: `TIME_INTERVAL` trigger, `repeats: true`, `seconds = cadenceDays * 86400`. Recurring (not one-shot DATE) so it survives the app being closed with no re-arm. **Documented tradeoff:** a `TIME_INTERVAL` repeat fires at *(enable time) + N days* and on that cadence — it does not pin a specific time-of-day. Accepted for v1 (a refuel nudge isn't time-of-day-sensitive); a re-armed `CALENDAR`/DATE variant is the follow-up if a fixed hour is ever wanted.
  - Copy tuned by `fuelType`: gas/diesel/hybrid → "Time to refuel{ the carName}"; electric → "Time to recharge{ the carName}".
  - Inline permission ask reuses the existing pattern. **No new sensitive permission** — notifications only, already used by the departure feature.
  - Returns `{ ok: true, identifier, nextReminderAt }` or `{ ok: false, reason: 'permission-denied' | 'failed' }`.
- `cancelRefuelReminder(id: string): Promise<void>` — for disable + reset.
- **"I filled up"** = `useFuelProfile.markFilledUp()` → set `lastFilledAt = now`, cancel + reschedule (resets the cadence clock from now), persist new `notificationId` + `nextReminderAt`.

### ③ /search Fuel card → setup screen — `app/fuel.tsx` (new, pushed)

- The /search Fuel card (`app/search.tsx:614`) gains an `onPress` → `router.push('/fuel')`, and its content becomes **live status** read from `useFuelProfile`:
  - reminders off → "Set up refuel reminders" (no more "Coming soon" hint).
  - reminders on → "Refuel reminder on · next in N days" (from `nextReminderAt`).
- `app/fuel.tsx` — a pushed setup screen (matches the `/safety-settings` + `/recordings` register): optional car-nickname `TextInput`, a fuel-type segmented control (gas/diesel/hybrid/electric), a cadence stepper ("Remind me every [7] days"), an enable toggle. When enabled: an **"I filled up"** button + a "Next reminder: {date}" line. Saving drives `useFuelProfile.saveProfile`.
- Per workflow, **pull the Fuel design from Figma** if one exists (the card cites `825:4997` for the /menu Fuel tile; a setup-screen node may exist) before finalizing layout.

### ④ /en-route on-route fuel stops

- A **fuel affordance** in the /en-route side-button column, shown only when `remindersEnabled` is true (the user has actually set fuel up — note the adapter's merge-with-defaults *always* returns a `FuelProfile`, so "profile exists" is never a usable gate; `remindersEnabled` is the real "user uses this feature" signal). No setup → no affordance, keeps the column clean. When `nextReminderAt` is past (reminder due), the affordance carries a small badge.
- Tap → a **fuel-stops sheet**: runs the same Mapbox category POI search the Gas tile uses (query adapts to `fuelType`: "gas station" for gas/diesel/hybrid, "ev charging" for electric), then **filters/sorts by proximity to the active route polyline** — each POI's distance to the nearest route coordinate, keep those within a threshold (start ~1.5 km, validate on device), sort by along-route order or distance. Tapping a station can recenter/route to it.
- Geo math reuses/extends the existing helpers in `lib/edge-indicators.ts` (haversine/bearing) — add a small pure `distanceToPolyline(point, coords)` util (own file or co-located) rather than inlining.
- **Coordination note:** the en-route side column is also gaining an alternate-paths FAB (separate effort). Sequencing matters so the column doesn't overflow on small devices — see Risks.

---

## Data flow

1. User taps the /search Fuel card → `/fuel`.
2. Sets profile + cadence + enables → `useFuelProfile.saveProfile` persists to `fuel.v1` AND calls `scheduleRefuelReminder` → stores the returned `notificationId` + `nextReminderAt`.
3. The recurring local notification fires every `cadenceDays`. Tapping it (future enhancement) could deep-link to fuel stops; v1 just surfaces the nudge.
4. User refuels → opens `/fuel`, taps "I filled up" → `markFilledUp` resets `lastFilledAt`, reschedules.
5. During navigation, /en-route reads `useFuelProfile`; if `remindersEnabled` it shows the fuel affordance → fuel-stops sheet filtered to the route.

---

## Honesty / App Store

- **No fake sensing.** The reminder is an explicitly user-set cadence; copy states exactly that ("Remind me every N days"). Nothing claims to know the actual fuel level.
- **No new sensitive permission.** Notifications only — already requested by the departure feature; refuel reuses the same inline flow.
- **The Fuel card stops being a dead-end** — it opens a real screen and reflects real state. Removes one of the App-Store-rejection-risk "coming soon" stubs found in the acceptance sweep.

---

## Implementation decomposition — two plans

This is large enough for two sequential plans (each ships working software on its own):

- **Plan 1 — Reminder core:** ① store + `useFuelProfile`, ② reminder engine, ③ /search card → `/fuel` setup + live status. Self-contained; makes the card real and the reminder work end-to-end.
- **Plan 2 — On-route stops:** ④ the /en-route fuel affordance + route-proximity-filtered fuel-stops sheet. Depends on Plan 1's profile + the route/POI plumbing.

---

## Dependencies & risks

- **Recurrence time-of-day:** `TIME_INTERVAL` repeats fire at enable-time + N-day cadence, not a fixed hour. Accepted for v1; documented.
- **Route-proximity threshold (④):** the ~1.5 km keep-radius needs device validation (too tight drops useful stops; too loose includes off-route ones).
- **En-route side-column crowding:** the fuel FAB lands in the same column as the (separately-built) alternate-paths FAB plus Shield/SOS/Report. Validate the column height on the smallest supported iPhone; if crowded, consider moving fuel into the bottom sheet instead of the FAB column.
- **Mapbox POI rate limits:** ④ reuses the existing gas search; same limits as the Gas tile.
- **EV query quality:** "ev charging" category coverage in Mapbox is thinner than gas; acceptable, but note for electric users.
- **Figma:** confirm whether a Fuel setup-screen design exists before finalizing ③'s layout.

## Success criteria

- The /search Fuel card opens a real setup screen and shows live status — no "Coming soon", no no-op.
- A user can set a car profile + cadence, enable, and receive a real recurring local notification; "I filled up" resets the cycle.
- /en-route surfaces gas/charging stations filtered to the active route when a profile exists.
- No fake fuel-sensing, no new sensitive permission, honest copy throughout.

## Out of scope

- Distance-based / auto mileage tracking (rejected — unreliable without always-on in-app nav).
- Multi-car "garage" (single profile in v1).
- Fuel price / brand data; fill-up history log (Approach B, not chosen).
- Deep-linking the fired notification straight into the fuel-stops sheet (nice future enhancement; v1 just nudges).
