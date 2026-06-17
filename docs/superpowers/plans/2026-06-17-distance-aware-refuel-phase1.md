# Distance-Aware Refuel — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a distance trigger to the refuel reminder as an *additive, earliest-of(time, distance)* nudge — accumulate in-app navigated miles since last fill-up, fire an immediate (optionally station-aware) reminder when the tank range is crossed, and let the driver set a tank range plus log partial fill-ups.

**Architecture:** Three layers, matching the project's adapter / hook / screen split. (1) `lib/api/fuel.ts` gains the data-model fields, defaults, and four pure-ish mutators/predicates (`addMilesSinceFilled`, `isDistanceRefuelDue`, `markFilledUp(fillFraction)`, `fillFractionFromDollars`). (2) `lib/notifications.ts` gains `fireRefuelReminderNow` (immediate variant of `scheduleRefuelReminder`). (3) `hooks/useFuelProfile.ts` owns the earliest-wins engine (distance check at trip-end + AppState foreground, cancels the scheduled time notification when distance wins, tracks the time-notification-fired case). `app/en-route.tsx` hosts a route-progress odometer (per-fix projection onto the route polyline → monotonic max arc-length → throttled flush). `app/fuel.tsx` and `components/FuelStopsSheet.tsx` carry the UI: a "Tank range" RowGroup and fraction-button fill-up.

**Tech Stack:** Expo (managed) + React Native + TypeScript, `expo-router`, `react-native-maps`, `expo-location` (`watchPositionAsync`), `expo-notifications`, AsyncStorage. StyleSheet API only. Theme tokens at `theme/colors.ts`, `theme/spacing.ts`, `theme/interaction.ts`, `theme/typography.ts`, `theme/dynamic-type.ts`. Phosphor icons (`phosphor-react-native/src/icons/*`). No test runner — verification is `npx tsc --noEmit` (filtered) + throwaway-node assertions for pure logic + device passes.

---

## Verification rhythm (read once, applies to every task)

Fresh Greens has **no test runner**. Do NOT write jest/pytest. Each code task ends with:

1. **Typecheck** — always run, filtered for the 4 known-unrelated errors:
   ```bash
   npx tsc --noEmit 2>&1 | grep -v -E '@expo/vector-icons|@vercel/node|avatar\.png' | head -40
   ```
   Expected: no lines referencing the file you touched. (The `@expo/vector-icons`, `@vercel/node`, and `avatar.png` lines are pre-existing environment noise — they will appear; ignore only those.)

2. **Throwaway-node assertion** (pure functions only) — paste-and-run a pure-JS mirror of the logic. NOT committed, no deps. This is the project's substitute for the writing-plans "write failing test → make it pass" rhythm: for pure functions the assertion *is* the test; write it, run it, confirm it prints the expected booleans before moving on.

3. **Device test** (UI / integration) — explicit on-device steps where logic can't be node-asserted.

4. **Commit** — frequent, one logical change per commit.

The reserved-color rule, `tapTarget44`, and Phosphor-only icon rules from `.cursorrules` are in force throughout. Every new color must be a token from `theme/colors.ts`; no inline hex.

---

## File Structure

| File | Phase-1 responsibility |
|---|---|
| `lib/api/fuel.ts` (modify) | New `FuelProfile` fields + `RangeSource`/`Vehicle` types, new defaults (merge-with-defaults already tolerant), and the pure helpers: `addMilesSinceFilledTo`, `isDistanceRefuelDue`, `applyFilledUp`, `fillFractionFromDollars`. (Persistence stays in the existing adapter functions; the new pure helpers compute next-state and are called by the hook.) |
| `lib/notifications.ts` (modify) | `fireRefuelReminderNow(profile, nearbyStop?)` — immediate local notification reusing the copy builder, station-aware body when a stop is passed. Extract the shared copy builder so schedule + fire-now agree. |
| `hooks/useFuelProfile.ts` (modify) | `addMilesSinceFilled(delta)`, the earliest-of engine (`checkDistanceTrigger`, AppState-foreground listener, time-notification-fired reconciliation), and `markFilledUp(fillFraction?)`. |
| `app/en-route.tsx` (modify) | Route-progress odometer wired into the existing `watchPositionAsync` effect: per-route cumulative-length prefix array, monotonic max arc-length, throttled (≥0.5 mi) + AppState-background + unmount flush; calls the hook's `addMilesSinceFilled`. Trip-end distance check on arrival. |
| `app/fuel.tsx` (modify) | "Tank range" RowGroup (Time only / tier buckets / Custom) + honest footer copy; the "I filled up" control becomes fraction buttons (Full / ¾ / ½ / ¼). |
| `components/FuelStopsSheet.tsx` (modify) | None beyond what's already there — `refuelDue` prop already exists; the wiring change is in `app/en-route.tsx` (point `refuelDue` at `refuelNotifiedAt != null`). |

**Out of scope (Phase 2 — do NOT build here):** EPA make/model/year proxy + `proxy/api/vehicles.ts`, `OptionPickSheet` extraction, `useVehicleLookup`, the **dollar-input "$15 → about ⅓ tank"** fill-up register, the cascading "Your car" RowGroup. The `vehicle` field is *added to the type* in Phase 1 (so the stored shape is forward-compatible) but is never read or written by Phase-1 code. `fillFractionFromDollars` is a pure helper that *exists* in Phase 1 (it's pure and cheap to land) but has no Phase-1 caller.

---

## Task 1: Data model — new `FuelProfile` fields, types, and defaults

**Files:**
- Modify: `lib/api/fuel.ts:19-44` (types + defaults)

The merge-with-defaults read path (`lib/api/fuel.ts:47-57`) already does `{ ...DEFAULT_FUEL_PROFILE, ...parsed }`, so absent fields in an older stored blob resolve to the new defaults with **no migration code**. We only need to add fields to the type and the defaults object.

- [ ] **Step 1: Add `RangeSource` and `Vehicle` types above `FuelProfile`**

In `lib/api/fuel.ts`, immediately after the `export type FuelType = ...` line (line 19), insert:

```ts
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
```

- [ ] **Step 2: Add the new fields to the `FuelProfile` type**

In the `FuelProfile` type (currently ends at line 35, the `notificationId` field), add the new fields before the closing `};`:

```ts
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
```

- [ ] **Step 3: Add the new defaults**

In `DEFAULT_FUEL_PROFILE` (lines 37-44), add the five new fields after `notificationId: null,`:

```ts
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
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep -v -E '@expo/vector-icons|@vercel/node|avatar\.png' | head -40`
Expected: no new errors referencing `fuel.ts`. (Existing `useFuelProfile.ts` / `fuel.tsx` references to the old shape still compile because all new fields are present in `DEFAULT_FUEL_PROFILE`, which those files already spread.)

- [ ] **Step 5: Commit**

```bash
git add lib/api/fuel.ts
git commit -m "feat(fuel): add distance-trigger fields to FuelProfile (rangeMiles, milesSinceFilled, refuelNotifiedAt, rangeSource, vehicle)"
```

---

## Task 2: Pure helper — `isDistanceRefuelDue`

**Files:**
- Modify: `lib/api/fuel.ts` (append after `clearStoredFuelProfile`, line 70)

This is the testable core of the earliest-of engine. Pure, no I/O.

- [ ] **Step 1: Write the throwaway-node assertion FIRST (the "failing test")**

Run this BEFORE implementing — it mirrors the intended logic so you confirm the four branches before writing the real function. (It will pass because it's a self-contained mirror; its purpose is to lock the truth table you're about to implement.)

```bash
node --input-type=module -e '
const due = (p, now) =>
  p.remindersEnabled &&
  p.rangeMiles != null &&
  p.milesSinceFilled >= p.rangeMiles &&
  p.refuelNotifiedAt == null;
const base = { remindersEnabled: true, rangeMiles: 300, milesSinceFilled: 0, refuelNotifiedAt: null };
const now = "2026-06-17T00:00:00.000Z";
console.log("under threshold       =", due({ ...base, milesSinceFilled: 120 }, now), "(expect false)");
console.log("at threshold, unfired =", due({ ...base, milesSinceFilled: 300 }, now), "(expect true)");
console.log("over, already fired   =", due({ ...base, milesSinceFilled: 350, refuelNotifiedAt: now }, now), "(expect false)");
console.log("rangeMiles null       =", due({ ...base, rangeMiles: null, milesSinceFilled: 999 }, now), "(expect false)");
console.log("reminders off         =", due({ ...base, remindersEnabled: false, milesSinceFilled: 999 }, now), "(expect false)");
'
```

Expected output:
```
under threshold       = false (expect false)
at threshold, unfired = true (expect true)
over, already fired   = false (expect false)
rangeMiles null       = false (expect false)
reminders off         = false (expect false)
```

- [ ] **Step 2: Implement `isDistanceRefuelDue`**

Append to `lib/api/fuel.ts` (after line 70):

```ts
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
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep -v -E '@expo/vector-icons|@vercel/node|avatar\.png' | head -40`
Expected: no errors referencing `fuel.ts`.

- [ ] **Step 4: Commit**

```bash
git add lib/api/fuel.ts
git commit -m "feat(fuel): isDistanceRefuelDue — pure earliest-of distance predicate"
```

---

## Task 3: Pure helpers — `addMilesSinceFilledTo`, `applyFilledUp`, `fillFractionFromDollars`

**Files:**
- Modify: `lib/api/fuel.ts` (append after `isDistanceRefuelDue`)

These compute next-state from a profile. The hook (Task 5) calls them and persists the result. Keeping them pure makes them node-assertable and keeps the cadence/miles math out of React.

- [ ] **Step 1: Write the throwaway-node assertion FIRST**

Run this to lock the math for all three helpers before implementing:

```bash
node --input-type=module -e '
const clamp01 = (x) => Math.max(0, Math.min(1, x));
// applyFilledUp: fraction in [0,1]. Full=1 -> milesSinceFilled 0 + full cadence.
// Partial -> milesSinceFilled = rangeMiles*(1-frac); effectiveDays = cadenceDays*frac (>=1).
// rangeMiles null -> milesSinceFilled stays 0, only cadence scales.
const applied = (p, frac) => {
  const f = clamp01(frac);
  const miles = p.rangeMiles == null ? 0 : p.rangeMiles * (1 - f);
  // floor (not round), clamped >=1: bias toward reminding SOONER, matching the
  // feature's "fail toward an earlier nudge" stance (confirmed 2026-06-17).
  const effDays = Math.max(1, Math.floor(p.cadenceDays * f));
  return { milesSinceFilled: miles, effectiveDays: effDays };
};
const p = { rangeMiles: 300, cadenceDays: 10 };
console.log("full  ->", JSON.stringify(applied(p, 1)), "(expect miles 0, days 10)");
console.log("half  ->", JSON.stringify(applied(p, 0.5)), "(expect miles 150, days 5)");
console.log("quart ->", JSON.stringify(applied(p, 0.25)), "(expect miles 225, days 2)"); // floor(2.5)=2
console.log("tiny  ->", JSON.stringify(applied(p, 0.05)), "(expect days clamped to 1)");
console.log("null  ->", JSON.stringify(applied({ rangeMiles: null, cadenceDays: 10 }, 0.5)), "(expect miles 0, days 5)");
// fillFractionFromDollars: dollars / (price*tank), clamp 0..1; price|tank missing -> null
const fracFromDollars = (d, price, tank) =>
  (price == null || tank == null || price <= 0 || tank <= 0) ? null : clamp01(d / (price * tank));
console.log("$15 @ $3*15gal =", fracFromDollars(15, 3, 15), "(expect ~0.333)");
console.log("overfill clamp =", fracFromDollars(999, 3, 15), "(expect 1)");
console.log("missing price  =", fracFromDollars(15, null, 15), "(expect null)");
'
```

Expected output (`floor`, clamped ≥1: `0.25 × 10 = 2.5 → floor → 2`; `0.05 × 10 = 0.5 → floor → 0 → clamp → 1`):
```
full  -> {"milesSinceFilled":0,"effectiveDays":10} (expect miles 0, days 10)
half  -> {"milesSinceFilled":150,"effectiveDays":5} (expect miles 150, days 5)
quart -> {"milesSinceFilled":225,"effectiveDays":2} (expect miles 225, days 2)
tiny  -> {"milesSinceFilled":285,"effectiveDays":1} (expect days clamped to 1)
null  -> {"milesSinceFilled":0,"effectiveDays":5} (expect miles 0, days 5)
$15 @ $3*15gal = 0.3333333333333333 (expect ~0.333)
overfill clamp = 1 (expect 1)
missing price  = null (expect null)
```

- [ ] **Step 2: Implement the three helpers**

Append to `lib/api/fuel.ts` (after `isDistanceRefuelDue`):

```ts
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
 *   - effectiveDays   = floor(cadenceDays × fraction), clamped to >= 1 day
 *     (floor, not round — bias toward reminding SOONER, confirmed 2026-06-17;
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
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep -v -E '@expo/vector-icons|@vercel/node|avatar\.png' | head -40`
Expected: no errors referencing `fuel.ts`.

- [ ] **Step 4: Commit**

```bash
git add lib/api/fuel.ts
git commit -m "feat(fuel): addMilesSinceFilledTo, applyFilledUp (partial-fill + cadence scale), fillFractionFromDollars"
```

---

## Task 4: Notifications — extract copy builder + add `fireRefuelReminderNow`

**Files:**
- Modify: `lib/notifications.ts:118-190` (refactor copy out of `scheduleRefuelReminder`, add the immediate variant)

`fireRefuelReminderNow` is the distance-trigger fire path: an immediate local notification, station-aware when a nearby stop is passed. It must NOT pre-schedule (no trigger → fires now). Reuse the same copy builder so schedule + fire-now agree on verb/subject.

- [ ] **Step 1: Extract the copy builder**

In `lib/notifications.ts`, after `refuelVerb` (ends line 121), add:

```ts
/**
 * Builds the title/body for a refuel reminder. Shared by the scheduled
 * (time) reminder and the immediate (distance) fire so the voice is
 * consistent. When `stopName` is passed (distance fire only — the
 * station is loaded in-app at trip-end), the body names a real stop;
 * otherwise it uses the generic time-based copy. `daysCopy` is the
 * "it's been about N days" tail, only meaningful for the scheduled
 * reminder — omitted for the immediate fire (which is mileage-driven).
 */
function refuelCopy(
  profile: FuelProfile,
  opts: { stopName?: string; days?: number } = {},
): { title: string; body: string } {
  const verb = refuelVerb(profile.fuelType);
  const subject = profile.carName ? ` the ${profile.carName}` : '';
  const lowOn = profile.fuelType === 'electric' ? 'Low on charge' : 'Low on gas';
  if (opts.stopName) {
    return {
      title: `Time to ${verb}${subject}`,
      body: `${lowOn} — ${opts.stopName} is on your route (you trust it).`,
    };
  }
  if (opts.days != null) {
    const d = opts.days;
    return {
      title: `Time to ${verb}${subject}`,
      body: `It's been about ${d} day${d === 1 ? '' : 's'} — a good time to ${verb}.`,
    };
  }
  return {
    title: `Time to ${verb}${subject}`,
    body: `${lowOn} — a good time to ${verb}.`,
  };
}
```

- [ ] **Step 2: Rewire `scheduleRefuelReminder` to use the builder**

In `scheduleRefuelReminder`, replace the inline `verb`/`subject` + `content` (lines 165-175) so the body comes from `refuelCopy`. Replace:

```ts
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
```

with:

```ts
  const days = Math.max(1, Math.round(profile.cadenceDays));
  const seconds = days * 86400;
  const nextReminderAt = new Date(Date.now() + seconds * 1000).toISOString();
  const copy = refuelCopy(profile, { days });

  try {
    const identifier = await Notifications.scheduleNotificationAsync({
      content: {
        title: copy.title,
        body: copy.body,
        sound: 'default',
      },
```

(The `refuelVerb` function is still used by `refuelCopy`, so keep it.)

- [ ] **Step 3: Add `fireRefuelReminderNow`**

After `scheduleRefuelReminder` (before `cancelRefuelReminder`, line 192), add:

```ts
/**
 * Fires an IMMEDIATE refuel reminder (null trigger → delivers now). This
 * is the distance-trigger path: the threshold crossed in-app, so we nudge
 * right then rather than waiting for the time cadence. When `stopName` is
 * passed (the caller resolved a trusted/on-route stop ahead), the body
 * names it — the thesis payoff: favorited = trusted, surfaced at the
 * moment of need. Generic copy otherwise.
 *
 * Reuses the same inline-permission flow as the scheduled reminder. Asks
 * once if not yet granted; on denial returns permission-denied so the
 * caller can still show the in-app banner (graceful — no notification,
 * but the UI surface still fires).
 *
 * Returns ok with the identifier (callers don't need to persist it — an
 * immediate notification isn't rescheduled/cancelled like the recurring
 * one) or a discriminated failure.
 */
export async function fireRefuelReminderNow(
  profile: FuelProfile,
  stopName?: string,
): Promise<ScheduleResult> {
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

  const copy = refuelCopy(profile, stopName ? { stopName } : {});
  try {
    const identifier = await Notifications.scheduleNotificationAsync({
      content: { title: copy.title, body: copy.body, sound: 'default' },
      // null trigger = deliver immediately.
      trigger: null,
    });
    console.info(`[notifications] fired immediate refuel reminder ${identifier}`);
    return { ok: true, identifier };
  } catch (err) {
    console.warn('[notifications] immediate refuel fire failed:', err);
    return { ok: false, reason: 'failed' };
  }
}
```

Note: `ScheduleResult` (line 41-43) is `{ ok: true; identifier } | { ok: false; reason: 'permission-denied' | 'past-time' | 'failed' }`. `fireRefuelReminderNow` only ever returns `permission-denied` or `failed`, both valid members — reuse the existing type, no new type needed.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep -v -E '@expo/vector-icons|@vercel/node|avatar\.png' | head -40`
Expected: no errors referencing `notifications.ts`.

- [ ] **Step 5: Throwaway-node assertion — station-aware vs generic copy**

The copy builder branches are pure string logic. Mirror them:

```bash
node --input-type=module -e '
const verb = (ft) => ft === "electric" ? "recharge" : "refuel";
const copy = (p, o = {}) => {
  const v = verb(p.fuelType);
  const subj = p.carName ? ` the ${p.carName}` : "";
  const lowOn = p.fuelType === "electric" ? "Low on charge" : "Low on gas";
  if (o.stopName) return { title: `Time to ${v}${subj}`, body: `${lowOn} — ${o.stopName} is on your route (you trust it).` };
  if (o.days != null) return { title: `Time to ${v}${subj}`, body: `It is been about ${o.days} days — a good time to ${v}.` };
  return { title: `Time to ${v}${subj}`, body: `${lowOn} — a good time to ${v}.` };
};
console.log("station gas  :", copy({ fuelType: "gas", carName: "Civic" }, { stopName: "Sunoco on Franklin" }).body);
console.log("station ev   :", copy({ fuelType: "electric" }, { stopName: "ChargePoint" }).body);
console.log("generic dist :", copy({ fuelType: "gas" }).body, "(no stop -> generic)");
console.log("scheduled    :", copy({ fuelType: "gas" }, { days: 7 }).body);
'
```

Expected: station lines name the stop; generic line has no stop; EV says "Low on charge".

- [ ] **Step 6: Commit**

```bash
git add lib/notifications.ts
git commit -m "feat(notifications): fireRefuelReminderNow immediate variant + shared station-aware copy builder"
```

---

## Task 5: Earliest-of engine in `useFuelProfile` — `addMilesSinceFilled`, distance check, AppState foreground, `markFilledUp(fraction)`

**Files:**
- Modify: `hooks/useFuelProfile.ts` (imports, three new behaviors, `markFilledUp` signature change)

This is the orchestration layer. It owns: persisting odometer deltas; checking the distance trigger at the two moments (trip-end via a callback the odometer calls, and AppState→active); firing the immediate notification + cancelling the scheduled time notification when distance wins; reconciling the "time notification already fired" case; and the amount-aware `markFilledUp`.

- [ ] **Step 1: Update imports**

In `hooks/useFuelProfile.ts`, extend the imports. Replace lines 1-16:

```ts
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
```

- [ ] **Step 2: Add a `profileRef` so the AppState listener reads the latest profile without re-subscribing**

The listener effect should mount once. To read the current profile inside it without a stale closure or a dep that re-subscribes every change, mirror the `userLocationRef` pattern from `en-route.tsx`. Inside `useFuelProfile`, right after the `const [loading, setLoading] = useState(true);` line (line 43), add:

```ts
  // Latest profile, readable from listeners/callbacks that mount once
  // (AppState, the odometer's trip-end check) without re-subscribing or
  // capturing a stale snapshot. Mirrors en-route's userLocationRef.
  const profileRef = useRef<FuelProfile | null>(null);
  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);
```

- [ ] **Step 3: Add the shared distance-trigger check**

This is called both by AppState→active and by the odometer at trip-end. Add it as a `useCallback` after `markFilledUp` is defined is fine, but it has no profile dep (reads via ref), so define it after the `profileRef` effect (Step 2). Add:

```ts
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
```

- [ ] **Step 4: Add the AppState→active listener**

After `checkRefuelTriggers`, add a once-mounted effect:

```ts
  // App-foreground distance check — covers miles added then the app
  // backgrounded before a trip-end check ran. Mounts once; reads the
  // latest profile via ref inside checkRefuelTriggers.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') void checkRefuelTriggers();
    });
    return () => sub.remove();
  }, [checkRefuelTriggers]);
```

- [ ] **Step 5: Add `addMilesSinceFilled`**

The odometer calls this (throttled). It persists the delta and then runs the trip-end check path is handled separately (the odometer calls `checkRefuelTriggers` on its own final flush — see Task 7); here we only accumulate + persist. Add after `markFilledUp` or near the other mutators (place it after the `saveProfile` callback, before `markFilledUp`):

```ts
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
```

- [ ] **Step 6: Rewrite `markFilledUp` to take an optional fraction**

Replace the current `markFilledUp` (lines 122-140) with the amount-aware version. It uses `applyFilledUp` for the miles + cadence math, reschedules the time notification at the scaled cadence, clears `refuelNotifiedAt`, and resets `milesSinceFilled`:

```ts
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
```

- [ ] **Step 7: Export the new surface**

Update the return object (currently line 150) to expose the two new functions:

```ts
  return {
    profile,
    loading,
    saveProfile,
    markFilledUp,
    addMilesSinceFilled,
    checkRefuelTriggers,
    clearAll,
  };
```

- [ ] **Step 8: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep -v -E '@expo/vector-icons|@vercel/node|avatar\.png' | head -40`
Expected: no errors referencing `useFuelProfile.ts`. Note: `app/fuel.tsx`'s existing `markFilledUp()` call (no args) still compiles because `fillFraction` defaults to 1 — Task 6 changes that call site to pass a fraction.

- [ ] **Step 9: Commit**

```bash
git add hooks/useFuelProfile.ts
git commit -m "feat(fuel): earliest-of engine — addMilesSinceFilled, distance check (trip-end + AppState foreground), amount-aware markFilledUp"
```

---

## Task 6: Fuel screen — "Tank range" RowGroup + fraction-button fill-up

**Files:**
- Modify: `app/fuel.tsx` (range state, range RowGroup, footer copy, fraction buttons, save wiring, styles)

The range picker for Phase 1 is a simple inline `RowGroup` of options (no `OptionPickSheet` — that's Phase 2). Buckets: Time only / Compact ~300 / Sedan ~350 / SUV/Truck ~400 / EV ~250 / Custom. The fill-up control becomes four fraction buttons.

- [ ] **Step 1: Add range constants + bucket table near the top**

In `app/fuel.tsx`, after the `MAX_DAYS = 60;` line (line 30), add:

```ts
/** Phase-1 tank-range tier buckets. `null` = Time only (distance off). */
const RANGE_BUCKETS: { id: string; label: string; rangeMiles: number | null }[] = [
  { id: 'none', label: 'Time only', rangeMiles: null },
  { id: 'compact', label: 'Compact ~300 mi', rangeMiles: 300 },
  { id: 'sedan', label: 'Sedan ~350 mi', rangeMiles: 350 },
  { id: 'suv', label: 'SUV / Truck ~400 mi', rangeMiles: 400 },
  { id: 'ev', label: 'EV ~250 mi', rangeMiles: 250 },
];

const MIN_RANGE = 20;
const MAX_RANGE = 800;

/** Fraction-button options for "I filled up" (Phase 1 / all EVs). */
const FILL_FRACTIONS: { id: string; label: string; fraction: number }[] = [
  { id: 'full', label: 'Filled up', fraction: 1 },
  { id: 'three-q', label: '¾', fraction: 0.75 },
  { id: 'half', label: '½', fraction: 0.5 },
  { id: 'quarter', label: 'A little', fraction: 0.25 },
];
```

- [ ] **Step 2: Add range form state + seed it on hydrate**

In the local-state block (after `const [cadenceDays, setCadenceDays] = useState(7);`, line 65), add:

```ts
  const [rangeMiles, setRangeMiles] = useState<number | null>(null);
  const [rangeSource, setRangeSource] = useState<FuelProfile['rangeSource']>('none');
  const [customRangeOpen, setCustomRangeOpen] = useState(false);
  const [customRangeText, setCustomRangeText] = useState('');
```

Import `FuelProfile` type — update the import on line 13:

```ts
import { type FuelProfile, type FuelType } from '../lib/api/fuel';
```

In the hydrate effect (the `useEffect` at lines 74-81), add after `setCadenceDays(profile.cadenceDays);`:

```ts
    setRangeMiles(profile.rangeMiles);
    setRangeSource(profile.rangeSource);
```

- [ ] **Step 3: Thread range through `saveProfile`**

`saveProfile` takes `FuelProfileInput`. Extend the input type and the save call. First, in `hooks/useFuelProfile.ts`, extend `FuelProfileInput` (lines 20-25) to carry range:

```ts
export type FuelProfileInput = {
  carName?: string;
  fuelType: FuelType;
  cadenceDays: number;
  remindersEnabled: boolean;
  rangeMiles: number | null;
  rangeSource: FuelProfile['rangeSource'];
};
```

(Import note: `FuelProfile` is already imported in `useFuelProfile.ts` from Task 5 Step 1.)

The `saveProfile` body spreads `...input` over `base`, so `rangeMiles`/`rangeSource` flow through automatically in both the enabled and disabled branches — no further change in the hook. **One addition:** when reminders are turned OFF (the `if (!input.remindersEnabled)` branch, lines 75-87), leave `milesSinceFilled`/`refuelNotifiedAt` as-is (don't reset accumulated miles just because reminders paused). No code change needed there — the spread of `...input` doesn't touch those fields. Confirm by reading the branch.

Back in `app/fuel.tsx`, update `handleSave` (lines 86-91) to pass range:

```ts
    const result = await saveProfile({
      carName: carName.trim() || undefined,
      fuelType,
      cadenceDays,
      remindersEnabled: enabled,
      rangeMiles,
      rangeSource,
    });
```

- [ ] **Step 4: Add the bucket-select + custom helpers**

Add these handlers inside the component, after `handleFilledUp` (line 112). Note `handleFilledUp` itself changes in Step 6.

```ts
  function handlePickBucket(bucket: (typeof RANGE_BUCKETS)[number]) {
    setCustomRangeOpen(false);
    setRangeMiles(bucket.rangeMiles);
    setRangeSource(bucket.rangeMiles == null ? 'none' : 'bucket');
  }

  function handleOpenCustom() {
    setCustomRangeOpen(true);
    setCustomRangeText(rangeMiles != null ? String(rangeMiles) : '');
  }

  function handleCommitCustom() {
    const parsed = parseInt(customRangeText, 10);
    if (Number.isFinite(parsed)) {
      const clamped = Math.max(MIN_RANGE, Math.min(MAX_RANGE, parsed));
      setRangeMiles(clamped);
      setRangeSource('custom');
      setCustomRangeText(String(clamped));
    }
  }

  // Which bucket (if any) is currently selected — for the selected styling.
  const selectedBucketId =
    rangeSource === 'custom'
      ? 'custom'
      : RANGE_BUCKETS.find((b) => b.rangeMiles === rangeMiles)?.id ?? 'none';
```

- [ ] **Step 5: Render the "Tank range" RowGroup**

Place it directly below the cadence `RowGroup` (after its closing `</RowGroup>` at line 226, before the `{profile?.remindersEnabled && nextLabel && (` block). Only show it when reminders are enabled (consistent with the cadence row's `enabled &&` gate):

```tsx
            {enabled && (
              <RowGroup
                footer="We'll remind you at your cadence OR after this many in-app navigated miles — whichever comes first. Miles only count trips you navigate in the app."
              >
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Tank range</Text>
                  <View style={styles.rangeOptions}>
                    {RANGE_BUCKETS.map((b) => {
                      const selected = selectedBucketId === b.id && !customRangeOpen;
                      return (
                        <Pressable
                          key={b.id}
                          onPress={() => handlePickBucket(b)}
                          style={({ pressed }) => [
                            styles.rangeOption,
                            selected && styles.rangeOptionSelected,
                            pressed && pressedDim,
                          ]}
                          accessibilityRole="button"
                          accessibilityState={{ selected }}
                          accessibilityLabel={b.label}
                        >
                          <Text
                            style={[
                              styles.rangeOptionText,
                              selected && styles.rangeOptionTextSelected,
                            ]}
                          >
                            {b.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                    <Pressable
                      onPress={handleOpenCustom}
                      style={({ pressed }) => [
                        styles.rangeOption,
                        (selectedBucketId === 'custom' || customRangeOpen) &&
                          styles.rangeOptionSelected,
                        pressed && pressedDim,
                      ]}
                      accessibilityRole="button"
                      accessibilityState={{
                        selected: selectedBucketId === 'custom' || customRangeOpen,
                      }}
                      accessibilityLabel="Custom range"
                    >
                      <Text
                        style={[
                          styles.rangeOptionText,
                          (selectedBucketId === 'custom' || customRangeOpen) &&
                            styles.rangeOptionTextSelected,
                        ]}
                      >
                        {rangeSource === 'custom' && rangeMiles != null
                          ? `Custom · ${rangeMiles} mi`
                          : 'Custom…'}
                      </Text>
                    </Pressable>
                  </View>

                  {customRangeOpen && (
                    <View style={styles.customRangeRow}>
                      <TextInput
                        style={styles.input}
                        value={customRangeText}
                        onChangeText={setCustomRangeText}
                        onEndEditing={handleCommitCustom}
                        placeholder="e.g. 320"
                        placeholderTextColor={colors.labelTertiary}
                        keyboardType="number-pad"
                        returnKeyType="done"
                        onSubmitEditing={handleCommitCustom}
                        accessibilityLabel="Custom tank range in miles"
                      />
                      <Text style={styles.customRangeUnit}>mi</Text>
                    </View>
                  )}
                </View>
              </RowGroup>
            )}
```

- [ ] **Step 6: Replace the binary "I filled up" with fraction buttons**

Replace the status `RowGroup` (lines 228-242) so the single "I filled up" button becomes four fraction buttons. Replace:

```tsx
            {profile?.remindersEnabled && nextLabel && (
              <RowGroup footer="Tap “I filled up” to reset the cadence clock.">
                <View style={styles.statusBlock}>
                  <Text style={styles.statusText}>Next reminder: {nextLabel}</Text>
                  <Pressable
                    onPress={handleFilledUp}
                    style={({ pressed }) => [styles.filledBtn, pressed && pressedDim]}
                    accessibilityRole="button"
                    accessibilityLabel="I filled up — reset the reminder"
                  >
                    <Text style={styles.filledBtnText}>I filled up</Text>
                  </Pressable>
                </View>
              </RowGroup>
            )}
```

with:

```tsx
            {profile?.remindersEnabled && nextLabel && (
              <RowGroup footer="Tell us how much you filled — a partial fill reminds you sooner.">
                <View style={styles.statusBlock}>
                  <Text style={styles.statusText}>Next reminder: {nextLabel}</Text>
                  <Text style={styles.fieldLabel}>I filled up…</Text>
                  <View style={styles.fillRow}>
                    {FILL_FRACTIONS.map((f) => (
                      <Pressable
                        key={f.id}
                        onPress={() => handleFilledUp(f.fraction)}
                        style={({ pressed }) => [
                          styles.fillBtn,
                          pressed && pressedDim,
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel={`Filled ${f.label}`}
                      >
                        <Text style={styles.fillBtnText}>{f.label}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              </RowGroup>
            )}
```

And update `handleFilledUp` (lines 107-112) to take a fraction:

```ts
  async function handleFilledUp(fillFraction: number) {
    const result = await markFilledUp(fillFraction);
    if (!result.ok) {
      Alert.alert('Could not update', 'Please try again in a moment.');
    }
  }
```

- [ ] **Step 7: Add the new styles**

In the `StyleSheet.create` block, add after the `filledBtnText` style (line 371). Keep the old `filledBtn`/`filledBtnText` only if still referenced — they are NOT after Step 6, so remove them and add:

```ts
  rangeOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  rangeOption: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: colors.separatorSubtle,
  },
  rangeOptionSelected: {
    backgroundColor: colors.freshgreen,
    borderColor: colors.freshgreen,
  },
  rangeOptionText: {
    ...dynamicType(typography.subheadlineEmphasized),
    color: colors.labelSecondary,
  },
  rangeOptionTextSelected: { color: colors.white },
  customRangeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  customRangeUnit: {
    ...dynamicType(typography.bodyRegular),
    color: colors.labelSecondary,
  },
  fillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  fillBtn: {
    minHeight: 44,
    minWidth: 64,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: colors.freshgreen,
  },
  fillBtnText: {
    ...dynamicType(typography.subheadlineEmphasized),
    color: colors.freshgreen,
  },
```

Then delete the now-unused `filledBtn` and `filledBtnText` style entries (lines 362-371).

- [ ] **Step 8: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep -v -E '@expo/vector-icons|@vercel/node|avatar\.png' | head -40`
Expected: no errors referencing `fuel.tsx` or `useFuelProfile.ts`.

- [ ] **Step 9: Device test**

Launch the app, open `/fuel` (from the /search Fuel card). Verify:
- Toggle "Remind me to refuel" ON → the "Tank range" group appears with five tier chips + Custom.
- Tap "Sedan ~350 mi" → it highlights freshgreen.
- Tap "Custom…" → a number field appears; type `320`, dismiss the keyboard → the Custom chip reads "Custom · 320 mi".
- Tap "Time only" → all bucket highlights clear (rangeMiles back to null).
- Save → re-open `/fuel` → the range selection persists (hydrate restores it).
- With reminders on + a range set, the status group shows four fraction buttons (Filled up / ¾ / ½ / A little). Tapping "A little" reschedules the next reminder sooner (the "Next reminder" date moves closer).

- [ ] **Step 10: Commit**

```bash
git add app/fuel.tsx hooks/useFuelProfile.ts
git commit -m "feat(fuel): Tank range RowGroup (buckets + custom) and fraction-button fill-up"
```

---

## Task 7: Route-progress odometer in `en-route.tsx`

**Files:**
- Modify: `app/en-route.tsx` (odometer state/refs, prefix-array build on route change, projection in `watchPositionAsync`, throttle flush, AppState-background + unmount flush, trip-end check, `refuelDue` rewire)

The odometer measures advance *along the route polyline* (not raw GPS deltas): per fix, project onto the route with `nearestPointOnPolyline`, look up arc-length via a per-route cumulative-length prefix array, track the monotonic max, flush deltas to `addMilesSinceFilled` every ≥0.5 mi (plus on background + unmount + arrival).

- [ ] **Step 1: Pull the new hook surface + add a pure arc-length helper to `lib/geo.ts`**

The odometer needs (a) a cumulative prefix array and (b) the arc-length of a projected point. `pathLengthMeters` already sums a whole path; add a prefix-array builder and a projected-arc-length lookup so the per-fix cost stays O(segments) without rebuilding. In `lib/geo.ts`, after `pathLengthMeters` (line 58), add:

```ts
const METERS_PER_MILE = 1609.344;

/**
 * Cumulative arc-length (meters) from the path start to each vertex.
 * `cumulative[i]` = distance along the path to vertex i. `cumulative[0]`
 * is always 0. Built once per route; the odometer reuses it for every GPS
 * fix so per-fix projection is O(segments) without re-summing the path.
 */
export function cumulativeLengthsMeters(path: LatLng[]): number[] {
  const cum: number[] = new Array(path.length).fill(0);
  for (let i = 1; i < path.length; i++) {
    cum[i] = cum[i - 1] + haversineMeters(path[i - 1], path[i]);
  }
  return cum;
}

/**
 * Arc-length (meters) from the route start to the point on `path` nearest
 * `point`. Walks each segment, projects `point` onto it (clamped to the
 * segment), and returns the cumulative length to the segment start plus
 * the projected distance into that segment. `cumulative` must come from
 * cumulativeLengthsMeters(path). Empty/degenerate path → 0.
 *
 * This is the odometer's per-fix measurement: how far along the route the
 * driver has reached. Pairs with the monotonic-max discipline in the caller
 * so jitter/teleport can't push progress backward.
 */
export function arcLengthAtNearestPoint(
  point: LatLng,
  path: LatLng[],
  cumulative: number[],
): number {
  if (path.length < 2) return 0;
  const latToMeters = 111000;
  const lngToMeters = 111000 * Math.cos((point.latitude * Math.PI) / 180);

  let bestDistSq = Infinity;
  let bestArc = 0;

  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i];
    const b = path[i + 1];
    const px = (point.longitude - a.longitude) * lngToMeters;
    const py = (point.latitude - a.latitude) * latToMeters;
    const sx = (b.longitude - a.longitude) * lngToMeters;
    const sy = (b.latitude - a.latitude) * latToMeters;

    const segLenSq = sx * sx + sy * sy;
    const segLen = Math.sqrt(segLenSq);
    const t = segLenSq === 0 ? 0 : Math.max(0, Math.min(1, (px * sx + py * sy) / segLenSq));
    const cx = sx * t;
    const cy = sy * t;
    const dx = px - cx;
    const dy = py - cy;
    const distSq = dx * dx + dy * dy;

    if (distSq < bestDistSq) {
      bestDistSq = distSq;
      bestArc = cumulative[i] + segLen * t;
    }
  }
  return bestArc;
}

/** Meters → miles. */
export function metersToMiles(meters: number): number {
  return meters / METERS_PER_MILE;
}
```

(`arcLengthAtNearestPoint` duplicates the projection math of `distanceAlongRouteMeters` in `lib/scoring.ts` but reads from a precomputed prefix array instead of re-accumulating, which the spec's per-fix throttled loop wants. The spec says use `nearestPointOnPolyline`; this is the arc-length companion that the projection result maps onto — same equirectangular projection, consistent results.)

- [ ] **Step 2: Throwaway-node assertion — arc-length monotonicity + jitter/teleport absorption**

```bash
node --input-type=module -e '
const R = 6371000, rad = (d) => d*Math.PI/180;
const hav = (a,b) => { const dLat=rad(b.latitude-a.latitude), dLng=rad(b.longitude-a.longitude), la1=rad(a.latitude), la2=rad(b.latitude); const h=Math.sin(dLat/2)**2+Math.cos(la1)*Math.cos(la2)*Math.sin(dLng/2)**2; return 2*R*Math.asin(Math.min(1,Math.sqrt(h))); };
const cum = (path) => { const c=[0]; for(let i=1;i<path.length;i++) c[i]=c[i-1]+hav(path[i-1],path[i]); return c; };
const arcAt = (pt, path, c) => { if(path.length<2) return 0; const L2M=111000, G2M=111000*Math.cos(rad(pt.latitude)); let bd=Infinity, ba=0; for(let i=0;i<path.length-1;i++){ const a=path[i],b=path[i+1]; const px=(pt.longitude-a.longitude)*G2M, py=(pt.latitude-a.latitude)*L2M, sx=(b.longitude-a.longitude)*G2M, sy=(b.latitude-a.latitude)*L2M; const sl2=sx*sx+sy*sy, sl=Math.sqrt(sl2); const t=sl2===0?0:Math.max(0,Math.min(1,(px*sx+py*sy)/sl2)); const cx=sx*t, cy=sy*t, dx=px-cx, dy=py-cy, dsq=dx*dx+dy*dy; if(dsq<bd){bd=dsq; ba=c[i]+sl*t;} } return ba; };
// A ~straight east-west route, ~5 vertices over ~400m.
const path = [0,1,2,3,4].map(i => ({ latitude: 40.0, longitude: -73.0 + i*0.001 }));
const c = cum(path);
const total = c[c.length-1];
console.log("total meters ~", Math.round(total), "(expect ~340)");
// fix near vertex 0 vs vertex 3 -> arc increases.
console.log("arc@v0 =", Math.round(arcAt(path[0], path, c)), "arc@v3 =", Math.round(arcAt(path[3], path, c)), "(v3 > v0)");
// jitter: a fix 30m NORTH of vertex 2 (lateral) -> ~same arc as vertex 2 (no big progress).
const jitter = { latitude: 40.0 + 30/111000, longitude: path[2].longitude };
console.log("arc@v2 =", Math.round(arcAt(path[2], path, c)), "arc@jitter =", Math.round(arcAt(jitter, path, c)), "(near-equal)");
// teleport BACKWARD: a fix at vertex 1 after we already reached vertex 3 -> max() guards it.
const maxArc = Math.max(arcAt(path[3], path, c), arcAt(path[1], path, c));
console.log("monotonic max after backward fix =", Math.round(maxArc), "(== arc@v3, not v1)");
'
```

Expected: total ~340m; arc@v3 > arc@v0; arc@jitter ≈ arc@v2; monotonic max equals arc@v3 (the backward fix at v1 does not reduce it).

- [ ] **Step 3: Add odometer imports + hook surface in `en-route.tsx`**

At the top of `app/en-route.tsx`, ensure these are imported (check existing imports first; `nearestPointOnPolyline` from `lib/scoring.ts` and the geo helpers from `lib/geo.ts`):

```ts
import {
  arcLengthAtNearestPoint,
  cumulativeLengthsMeters,
  metersToMiles,
} from '../lib/geo';
import { nearestPointOnPolyline } from '../lib/scoring';
```

(If `lib/geo` or `lib/scoring` is already imported with other named imports, merge these names into the existing import statement rather than adding a duplicate.)

Update the `useFuelProfile` destructure (line 516) to pull the new functions:

```ts
  const { profile: fuelProfile, addMilesSinceFilled, checkRefuelTriggers } =
    useFuelProfile();
```

- [ ] **Step 4: Rewire `refuelDue` to the distance latch**

Replace the time-only `refuelDue` (lines 523-526):

```ts
  // "Due" = either trigger fired this tank (the hook stamps refuelNotifiedAt
  // for both the time and distance fires). Drives the FuelStopsSheet banner.
  const refuelDue =
    !!fuelProfile?.remindersEnabled && fuelProfile.refuelNotifiedAt != null;
```

- [ ] **Step 5: Add the odometer refs + per-route prefix-array build**

After the `minStepIndexRef` block (lines 660-667), add the odometer state. Place a new block:

```ts
  // --- Trip odometer (distance-trigger accumulation) ---------------------
  // Per-route cumulative-length prefix array, rebuilt when the active route
  // polyline changes. The monotonic max arc-length reached this route +
  // the last-flushed arc-length drive the throttled delta to
  // addMilesSinceFilled. The accumulated milesSinceFilled lives in the
  // FuelProfile and persists across routes — only these per-route trackers
  // reset on a new polyline.
  const odoCumulativeRef = useRef<number[]>([]);
  const odoMaxArcRef = useRef(0);
  const odoLastFlushedArcRef = useRef(0);

  // Read the live odometer-relevant values via refs inside the once-mounted
  // watchPositionAsync callback (Step 6) and the unmount flush, so they
  // don't re-subscribe GPS. Mirrors en-route's existing userLocationRef.
  const odoActiveCoordsRef = useRef<Coordinate[]>([]);
  const odoMeteringEnabledRef = useRef(false);

  // Rebuild the prefix array + reset per-route trackers on route change.
  // Bank-on-reset is implicit: deltas are flushed incrementally as the user
  // drives, so resetting maxArc/lastFlushed for the new polyline loses
  // nothing already accumulated.
  useEffect(() => {
    const coords = activeRoute?.coordinates ?? [];
    odoActiveCoordsRef.current = coords;
    odoCumulativeRef.current =
      coords.length >= 2 ? cumulativeLengthsMeters(coords) : [];
    odoMaxArcRef.current = 0;
    odoLastFlushedArcRef.current = 0;
  }, [activeRoute?.id, activeRoute?.coordinates]);

  // Keep a ref of whether metering is armed (reminders on + range set) so
  // the GPS callback can gate cheaply without a stale closure.
  useEffect(() => {
    odoMeteringEnabledRef.current =
      !!fuelProfile?.remindersEnabled && fuelProfile.rangeMiles != null;
  }, [fuelProfile?.remindersEnabled, fuelProfile?.rangeMiles]);
```

(`Coordinate` is already imported in `en-route.tsx` — it's used throughout, e.g. line 1126.)

- [ ] **Step 6: Project each GPS fix + throttled flush inside `watchPositionAsync`**

In the existing `watchPositionAsync` callback (lines 1293-1313), after the `setUserLocation(...)` call (line 1294-1297) and the speed/heading handling, add the odometer projection. The flush threshold is 0.5 mi = `0.5 * 1609.344` ≈ 805 m. Add inside the callback, after the heading block (before the closing `}` of the `(pos) => {` arrow at line 1313):

```ts
          // --- Trip odometer: project this fix onto the route, advance the
          // monotonic max arc-length, flush in >= 0.5 mi increments. Two
          // guardrails (spec Unit 1.1): skip junk fixes (accuracy > 50m),
          // and only meter while the distance trigger is armed.
          if (!odoMeteringEnabledRef.current) return;
          const acc = pos.coords.accuracy;
          if (typeof acc === 'number' && acc > 50) return; // junk fix
          const coords = odoActiveCoordsRef.current;
          const cumulative = odoCumulativeRef.current;
          if (coords.length < 2 || cumulative.length !== coords.length) return;

          const fix = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          };
          // Project onto the route line (snap), then look up its arc-length.
          // nearestPointOnPolyline gives the snapped coordinate;
          // arcLengthAtNearestPoint gives how far along the route that is.
          const snapped = nearestPointOnPolyline(fix, coords);
          const arc = arcLengthAtNearestPoint(snapped, coords, cumulative);
          // Monotonic: progress never decreases (jitter/backward GPS absorbed).
          if (arc > odoMaxArcRef.current) odoMaxArcRef.current = arc;

          const FLUSH_METERS = 0.5 * 1609.344;
          const pendingMeters = odoMaxArcRef.current - odoLastFlushedArcRef.current;
          if (pendingMeters >= FLUSH_METERS) {
            const deltaMiles = metersToMiles(pendingMeters);
            odoLastFlushedArcRef.current = odoMaxArcRef.current;
            void addMilesSinceFilled(deltaMiles);
          }
```

- [ ] **Step 7: Flush on background + unmount, and run the trip-end check**

Add a dedicated effect (near the other AppState handling) that flushes the sub-threshold remainder when the app backgrounds, and a flush + trip-end distance check on unmount. Add after the `watchPositionAsync` effect (after line 1319):

```ts
  // Flush the sub-0.5mi odometer remainder on background (iOS may kill a
  // backgrounded app — losing at most the unflushed remainder this commits)
  // and on unmount/arrival; the unmount path also runs the trip-end distance
  // check so a crossed threshold fires its immediate notification right then.
  const flushOdometer = useCallback(() => {
    const pendingMeters = odoMaxArcRef.current - odoLastFlushedArcRef.current;
    if (pendingMeters > 0) {
      odoLastFlushedArcRef.current = odoMaxArcRef.current;
      void addMilesSinceFilled(metersToMiles(pendingMeters));
    }
  }, [addMilesSinceFilled]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background' || state === 'inactive') flushOdometer();
    });
    return () => {
      sub.remove();
      // Unmount = trip end (user backed out / navigated away). Flush the
      // remainder, then run the distance check, resolving the nearest trusted
      // stop AHEAD at this instant (Step 8) so the immediate notification can
      // be station-aware.
      flushOdometer();
      void checkRefuelTriggers(resolveTrustedStopAhead());
    };
  }, [flushOdometer, checkRefuelTriggers, resolveTrustedStopAhead]);
```

- [ ] **Step 8: Resolve the nearest trusted/on-route stop name for station-aware copy**

The trip-end fire wants a stop name. Resolve the nearest **favorited** stop that is **strictly ahead** of the user on the route, else the nearest stop ahead. "Ahead" is confirmed Phase-1 scope (2026-06-17) — naming a stop *behind* the driver when they're low on gas is actively wrong, and the odometer's arc-length machinery (Step 1: `arcLengthAtNearestPoint`; Step 5: the per-route prefix in `odoCumulativeRef`) makes it nearly free. Resolve it **at the fire instant, not continuously** — the name is only needed when the notification actually fires, so a per-fix effect would be wasted work. Define a `useCallback` (it reads live values via refs, mirroring the existing `userLocationRef` pattern) and call it from the trip-end fire path (Step 9 / the Task 5 distance fire):

```ts
  // Nearest TRUSTED stop AHEAD of the user — resolved at the trip-end fire so
  // the notification names a real, trusted stop the driver is actually
  // approaching ("Sunoco on Franklin — you trust it"), never one already
  // behind them. "Ahead" = projected arc-length greater than the user's
  // current arc-length, reusing the odometer's per-route prefix
  // (odoCumulativeRef, built in Step 5 — no extra prefix build). Returns
  // undefined → fireRefuelReminderNow falls back to generic copy.
  const resolveTrustedStopAhead = useCallback((): string | undefined => {
    const coords = odoActiveCoordsRef.current;
    const prefix = odoCumulativeRef.current;
    const here = userLocationRef.current;
    const stops = sortedFuelStopsRef.current; // preferred-first, then nearest
    if (!here || coords.length < 2 || prefix.length === 0 || stops.length === 0) {
      return undefined;
    }
    const userArc = arcLengthAtNearestPoint(here, coords, prefix);
    const ahead = stops.filter(
      (s) => arcLengthAtNearestPoint(s, coords, prefix) > userArc,
    );
    // filter preserves the preferred-first order, so find(isPreferred) is the
    // nearest trusted stop ahead and ahead[0] the nearest stop ahead overall.
    return (ahead.find((s) => isPreferredRef.current(s)) ?? ahead[0])?.name;
  }, []);
```

Needs two live-value refs alongside the existing `userLocationRef`/`odo*Ref`s: `sortedFuelStopsRef` (mirrors `sortedFuelStops`) and `isPreferredRef` (mirrors `isPreferred`) — both kept current by a one-line `useEffect(() => { sortedFuelStopsRef.current = sortedFuelStops; isPreferredRef.current = isPreferred; })`. The trip-end fire calls `fireRefuelReminderNow(profile, resolveTrustedStopAhead())`. `arcLengthAtNearestPoint(point, coords, prefix)` projects `point` onto the route and returns its arc-length from start — the same helper the odometer uses for the user's own progress, so "ahead" is measured on the identical scale.

- [ ] **Step 9: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep -v -E '@expo/vector-icons|@vercel/node|avatar\.png' | head -40`
Expected: no errors referencing `en-route.tsx`, `geo.ts`, or `scoring.ts`.

- [ ] **Step 10: Device test (the integration pass)**

On device:
- In `/fuel`: reminders ON, fuel type Gas, set Custom range to **2 mi**, Save.
- Start navigation to a destination > 2 mi away (`/en-route`).
- Drive (or simulate) > 2 mi along the route. As you back out of `/en-route` (trip end), confirm: a refuel notification fires immediately; if a trusted/on-route stop is loaded, the body names it; otherwise generic copy. The FuelStopsSheet `refuelDue` banner shows when reopened.
- Confirm the scheduled time notification was cancelled (it should not also fire later for this tank).
- Background the app mid-drive, return → the foreground AppState check runs (no double-fire because `refuelNotifiedAt` is now set).
- Back in `/fuel`, tap "I filled up → A little (¼)" → banner clears (refuelNotifiedAt null), milesSinceFilled resets to ¾ of range (1.5 mi for a 2-mi range), next reminder date moves closer.
- Park at a red light (stationary jitter) with metering armed → milesSinceFilled does NOT inflate (projection absorbs lateral wander).

- [ ] **Step 11: Commit**

```bash
git add lib/geo.ts app/en-route.tsx
git commit -m "feat(en-route): route-progress trip odometer — monotonic arc-length projection, throttled/background/unmount flush, trip-end distance check, station-aware refuelDue"
```

---

## Task 8: Final full-suite verification + learnings entry

**Files:**
- Modify: `docs/learnings.md` (prepend a branch-headed entry, per workflow Step 11)
- Modify: `docs/next-session.md` (strike-through the Round-5 distance-refuel Phase-1 item if present)

- [ ] **Step 1: Full typecheck**

Run: `npx tsc --noEmit 2>&1 | grep -v -E '@expo/vector-icons|@vercel/node|avatar\.png' | head -40`
Expected: empty (no lines for any touched file).

- [ ] **Step 2: Re-run all four throwaway-node assertions** (Tasks 2, 3, 4, 7) and confirm each prints its expected output. (Paste-and-run; nothing committed.)

- [ ] **Step 3: Append a learnings entry**

Prepend to `docs/learnings.md` (newest at top) a branch-headed entry. Capture what took two tries or surprised you — candidates: the monotonic-arc-length-vs-raw-sum jitter result, the time-notification-fired reconciliation (no notification-response listener needed), the partial-fill cadence-scale-but-don't-overwrite-stored-cadence subtlety, or the ref-based listener-reads-latest-profile pattern. Only write the entry if something non-obvious bit; per the project check, bias toward writing one.

- [ ] **Step 4: Update the backlog**

In `docs/next-session.md`, strike through (do not delete) the Round-5 distance-aware refuel Phase-1 item, leaving the closure note for grep.

- [ ] **Step 5: Commit**

```bash
git add docs/learnings.md docs/next-session.md
git commit -m "docs: distance-refuel Phase 1 learnings + backlog closure"
```

- [ ] **Step 6: Per-PR audit (workflow Step 13)**

Dispatch the `code-reviewer` and `mobile-ux-optimizer` subagents on the diff before merge, per `docs/workflow.md` Step 13. Address findings, then squash-merge to main once the audit is clean (the merge-to-main-default rule).

---

## Spec coverage check (self-review)

| Spec requirement (Phase 1 + shared data model) | Task |
|---|---|
| `RangeSource` type | Task 1 |
| `Vehicle` type (added, unused in P1) | Task 1 |
| `FuelProfile` new fields (rangeMiles, rangeSource, milesSinceFilled, refuelNotifiedAt, vehicle) | Task 1 |
| New defaults + merge-with-defaults tolerance (no migration) | Task 1 (Step 3 + the existing read path) |
| `addMilesSinceFilled` (accumulate + persist) | Task 3 (`addMilesSinceFilledTo` pure) + Task 5 (hook `addMilesSinceFilled`) |
| `isDistanceRefuelDue(profile, now)` | Task 2 |
| `markFilledUp(fillFraction)` (partial reset + cadence scale + clear notified) | Task 3 (`applyFilledUp` pure) + Task 5 (hook `markFilledUp`) |
| `fillFractionFromDollars` (pure, no P1 caller) | Task 3 |
| Unit 1.1 odometer — projection via `nearestPointOnPolyline` | Task 7 (Step 6) |
| Unit 1.1 — per-route cumulative prefix array | Task 7 (Step 1 `cumulativeLengthsMeters`, Step 5 build) |
| Unit 1.1 — monotonic max arc-length | Task 7 (Step 5 ref, Step 6 `Math.max`) |
| Unit 1.1 — throttle ≥0.5mi + background + unmount flush | Task 7 (Step 6 flush, Step 7 background/unmount) |
| Unit 1.1 — skip accuracy > 50m | Task 7 (Step 6) |
| Unit 1.1 — gate on remindersEnabled && rangeMiles != null | Task 7 (Step 5 `odoMeteringEnabledRef`, Step 6 gate) |
| Unit 1.1 — reset per-route trackers on route change, persist milesSinceFilled | Task 7 (Step 5 reset effect) |
| Unit 1.2 — time notification stays scheduled (floor unchanged) | Untouched `scheduleRefuelReminder` (Task 4 only refactors copy) |
| Unit 1.2 — distance check at trip-end + AppState foreground | Task 5 (AppState listener) + Task 7 (unmount trip-end check) |
| Unit 1.2 — `fireRefuelReminderNow` immediate + station-aware copy | Task 4 + Task 7 (Step 8 name resolution) |
| Unit 1.2 — cancel scheduled time notif on distance win | Task 5 (`checkRefuelTriggers` (b)) |
| Unit 1.2 — set refuelNotifiedAt | Task 5 |
| Unit 1.2 — time-notification-fired reconciliation | Task 5 (`checkRefuelTriggers` (a)) |
| Unit 1.2 — wire FuelStopsSheet `refuelDue` to `refuelNotifiedAt != null` | Task 7 (Step 4) |
| Unit 1.3 — "Tank range" RowGroup (Time only / buckets / Custom) + footer | Task 6 (Steps 1, 5) |
| Unit 1.4 — fraction buttons (Full/¾/½/¼) | Task 6 (Steps 1, 6) |
| Unit 1.4 — dollar input is Phase 2 (noted out of scope) | File Structure "Out of scope" + Task 3 docstring |

---

## Notes / placeholder + type-consistency check (self-review)

- **Placeholder scan:** no "TBD"/"add validation"/"handle edge cases" — every code step shows complete code. The custom-range parse, clamp, and bucket-selection logic are all spelled out (Task 6 Step 4).
- **Type consistency:** pure helpers are named `addMilesSinceFilledTo` / `applyFilledUp` (the *hook* methods are `addMilesSinceFilled` / `markFilledUp` — deliberately distinct so the hook owns persistence and the helper stays pure). `FilledUpPlan` (Task 3) is consumed in Task 5 Step 6. `isDistanceRefuelDue` (Task 2) is consumed in Task 5 Step 3. `fireRefuelReminderNow` returns the existing `ScheduleResult` (Task 4). `FuelProfileInput` gains `rangeMiles`/`rangeSource` (Task 6 Step 3) consumed by `saveProfile`'s existing `...input` spread. `cumulativeLengthsMeters` / `arcLengthAtNearestPoint` / `metersToMiles` (Task 7 Step 1) consumed in Task 7 Steps 5-7.
- **`nearestPointOnPolyline` usage:** the spec names it explicitly; Task 7 uses it to snap the fix, then `arcLengthAtNearestPoint` maps the snap to an along-route distance. Same equirectangular projection as the existing `distanceAlongRouteMeters`, so results agree.
```
