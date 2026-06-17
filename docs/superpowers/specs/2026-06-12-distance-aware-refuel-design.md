# Distance-aware refuel reminders — design

**Date:** 2026-06-12
**Status:** Approved (brainstorm)
**Supersedes/extends:** `2026-05-30-refuel-reminders-design.md` (the shipped
time-based reminder). This adds the distance dimension that spec explicitly
deferred, in the one shape that's honest: **additive, earliest-wins.**

## Why

The shipped fuel feature is a time-only cadence ("remind me every N days").
The original product vision was *fuel-aware* reminders from car make/model.
A true fuel gauge is unbuildable (no sensor, no background mileage), and the
2026-05-30 spec correctly rejected **distance as the sole trigger** — in-app
navigation only sees in-app drives, so it undercounts routine driving and
would fire *late*, risking an empty tank.

The unlock: distance as an **additive early trigger**, not a replacement.
Rule = remind at *whichever comes first*, **time cadence OR miles driven**.
Undercounting distance can then only ever make the distance trigger fire
*late or never* — in which case the time cadence still catches the driver.
Distance can only ever pull the reminder **earlier**. The unreliability is
defanged, and make/model earns its keep as a *range preset*, never a gauge.

## Phasing

The whole honest distance feature is **Phase 1** and needs no server work.
**Phase 2** is EPA make/model lookup that pre-fills *one field* (`rangeMiles`)
Phase 1 already owns. Both are specced here; Phase 1 is Phase 2's prerequisite.

- **Phase 1 (app-only):** earliest-of(time, distance) engine + trip odometer +
  range via tier buckets/custom.
- **Phase 2 (proxy + UI):** cascading make→model→year picker backed by the EPA
  fueleconomy.gov API; sets `rangeMiles` from real vehicle data.

## Goals

- **A.** Add a **distance trigger** to the refuel reminder, layered as
  earliest-of(time, distance). Time stays the guaranteed floor.
- **B.** Accumulate **in-app driven miles** since last fill-up (honest about
  what it can and can't see).
- **C.** Let the driver set their tank range via **tier buckets** (Phase 1) or
  **EPA make/model/year** (Phase 2).

## Non-goals

- No background-location odometer (no new sensitive permission; the spec's
  App-Store-honest principle holds). Distance is in-app-nav miles only.
- No real-time fuel gauge. `rangeMiles` is a *threshold*, never a live level.
- No per-trip fuel-cost tracking, no trip log. YAGNI.
- Phase 2 does not change any Phase-1 trigger/accumulator logic — it only makes
  *setting* `rangeMiles` smarter.

---

## Data model — `lib/api/fuel.ts` additions

Extends the existing `FuelProfile` (merge-with-defaults already tolerates older
stored shapes, so no migration code is needed — absent fields resolve to the
new defaults).

```ts
export type RangeSource =
  | 'none'        // distance trigger off (rangeMiles null)
  | 'bucket'      // chosen from a tier preset (Phase 1)
  | 'custom'      // user typed a number (Phase 1)
  | 'epa-ev'      // EPA published EV range (Phase 2)
  | 'epa-gas';    // EPA combined MPG × class-typical tank, estimate (Phase 2)

export type Vehicle = {
  year: number;
  make: string;
  model: string;
  /** EPA fueleconomy.gov vehicle id (the `value` from its options menu). */
  epaVehicleId: string;
};

export type FuelProfile = {
  // --- existing (unchanged) ---
  carName?: string;
  fuelType: FuelType;
  cadenceDays: number;
  remindersEnabled: boolean;
  lastFilledAt: string | null;
  nextReminderAt: string | null;
  notificationId: string | null;

  // --- new: distance trigger ---
  /** Tank range in miles. null = distance trigger OFF (time-only). */
  rangeMiles: number | null;
  /** Provenance of rangeMiles — drives copy + the adjust affordance. */
  rangeSource: RangeSource;
  /** In-app driven miles since lastFilledAt. Reset to 0 on "I filled up". */
  milesSinceFilled: number;
  /** ISO — set when EITHER trigger fires; cleared on "I filled up".
      Dedups the distance check so it doesn't re-fire every trip-end after
      the threshold is crossed. */
  refuelNotifiedAt: string | null;

  // --- new: Phase 2 vehicle selection ---
  /** EPA-resolved vehicle, when range came from make/model. null otherwise. */
  vehicle: Vehicle | null;
};
```

New defaults: `rangeMiles: null`, `rangeSource: 'none'`, `milesSinceFilled: 0`,
`refuelNotifiedAt: null`, `vehicle: null`.

New store mutators (alongside the existing ones):
- `addMilesSinceFilled(delta: number)` — `milesSinceFilled += delta`, persist.
  Called (throttled) by the trip odometer.
- `markFilledUp()` (exists) — additionally resets `milesSinceFilled = 0` and
  `refuelNotifiedAt = null`, and reschedules the time notification.

---

# PHASE 1 — app-only distance trigger

## Unit 1.1 — Trip odometer

**Where:** `app/en-route.tsx` already runs `Location.watchPositionAsync`
(line ~1287), holds `userLocation`, and the active route polyline. Add the
odometer there (or a `hooks/useTripOdometer.ts` if en-route's effect block is
already dense).

**Approach: route-progress projection, not raw GPS segment-sum.** Measure how
far the user has advanced *along the active route polyline*, not the sum of raw
fix-to-fix deltas. Per fix:
1. Project the fix onto the route line with `nearestPointOnPolyline` (already in
   `lib/scoring.ts`, added for the hazard markers).
2. Look up that projected point's **arc-length from route start** (precompute a
   cumulative-segment-length prefix array once per route — a `pathLength`-style
   scan from `lib/geo.ts`).
3. Track the **monotonic max** arc-length reached this route (clamp so it never
   decreases — the same monotonic-progress discipline `findNextStep` /
   `minStepIndex` already use in `routes.ts`).
4. `delta = newMaxArcLength − lastFlushedArcLength`; flush via
   `addMilesSinceFilled(deltaMiles)` on a throttle (**every ≥0.5 mi**, plus on
   `AppState → background` and on unmount/arrival, so iOS killing a backgrounded
   app loses at most the sub-0.5mi remainder).

**On route change** (reroute, new destination, off-route re-issue): bank the
current `maxArcLength` (already flushed incrementally) and reset the per-route
prefix array + monotonic tracker for the new polyline. The accumulated
`milesSinceFilled` persists across routes — only the per-route tracker resets.

**Why projection beats raw segment-sum** — segment-sum is noise-sensitive and
needs three brittle filters; projection dissolves the failure modes:
- **Stationary jitter** (a parked phone wandering in its accuracy circle would
  inflate a raw sum at every red light) → projects to ~the same arc-length →
  zero progress. No min-movement floor needed.
- **Reacquire teleports** (a tunnel-exit GPS snap) → arc-length is monotonic and
  bounded by route length; the spike projects near the same point or to one
  already passed → no effect. No `Δdist/Δt` speed gate needed.
- **Partial trips** → it's progress, not completion: reroute/cancel keeps the
  miles already advanced.

**Remaining guardrails (only two needed):**
- Skip projecting a fix with `coords.accuracy > 50 m` (don't trust junk).
- Only meter while `remindersEnabled && rangeMiles != null`.

**Honest limitation:** progress only accrues *while navigating in-app with a
route to project onto* — which was already the feature's stated boundary. True
off-route driving with no reroute saturates progress (undercount — the safe
direction). Raw segment-sum was the **rejected alternative** (see brainstorm
2026-06-12): more code, three jitter filters, and it *over*counts at idle —
firing the reminder early for sitting still, which breaks the "distance pulls
earlier only for real driving" promise the whole earliest-of design rests on.

## Unit 1.2 — Earliest-of trigger engine

The two triggers fire through different mechanisms because the OS can schedule
a *time* but cannot watch *mileage*:

**Time trigger (the floor):** unchanged — `scheduleRefuelReminder` already
schedules an OS `TIME_INTERVAL` notification that fires even if the app is
closed. This is the guaranteed backstop.

**Distance trigger (the early nudge):** cannot be a pre-scheduled OS
notification (the OS doesn't know `milesSinceFilled`). Checked
**opportunistically** in `hooks/useFuelProfile.ts` at two moments:
1. **Trip end** — right after the odometer's final flush (miles just changed).
2. **App foreground** — an `AppState` 'active' listener (covers miles added,
   then app backgrounded before a check).

Check logic (pure, testable — extract to `lib/api/fuel.ts`
`isDistanceRefuelDue(profile, now)`):
```
due =
  remindersEnabled &&
  rangeMiles != null &&
  milesSinceFilled >= rangeMiles &&
  refuelNotifiedAt == null      // not already fired this tank
```
When `due`:
- Fire an **immediate** local notification (`scheduleNotificationAsync` with a
  null/now trigger — reuse the `scheduleRefuelReminder` copy path, fuelType-aware
  "Time to refuel <carName>" / "recharge").
- Set `refuelNotifiedAt = now`.
- **Cancel the pending scheduled time notification** (`cancelRefuelReminder`),
  so the driver doesn't get a second reminder days later for the same tank.
- Surface the in-app `refuelDue` banner (the `FuelStopsSheet` already accepts a
  `refuelDue` prop — wire it to `refuelNotifiedAt != null`).

**Earliest-wins, both directions:**
- Distance crosses first → fires now, cancels the time notification.
- Time fires first → the scheduled notification delivers; on next app-open the
  distance check sees `refuelNotifiedAt != null` (we set it when the time
  notification is *known fired* — see below) and stays quiet.
- "I filled up" → `milesSinceFilled = 0`, `refuelNotifiedAt = null`, reschedule
  the time notification. Clean slate.

**Tracking that the time notification fired:** the OS notification fires
out-of-process. On app foreground, if `now >= nextReminderAt` and
`refuelNotifiedAt == null`, treat the time trigger as fired: set
`refuelNotifiedAt = nextReminderAt`. This keeps the in-app banner + dedup in
sync with the OS notification without a notification-response listener (a
listener is a fine future enhancement but not required).

## Unit 1.3 — Range input on the fuel screen (buckets)

**Where:** `app/fuel.tsx` (the existing RowGroup settings screen).

Add a **"Tank range"** RowGroup below the cadence row:
- A `SettingsRow` showing the current range ("~350 mi" / "Not set — time only").
- Tapping opens a range picker (reuse `OptionPickSheet` from Phase 2 if landed;
  Phase-1-alone uses a simple inline `RowGroup` of options):
  - **Time only** (rangeMiles = null, rangeSource = 'none')
  - **Compact ~300 mi**, **Sedan ~350 mi**, **SUV/Truck ~400 mi**, **EV ~250 mi**
    (rangeSource = 'bucket')
  - **Custom…** → numeric entry (rangeSource = 'custom')
- Footer copy: *"We'll remind you at your cadence OR after this many in-app
  navigated miles — whichever comes first. Miles only count trips you navigate
  in the app."* (Honest about the undercount.)

---

# PHASE 2 — EPA make/model/year lookup

Replaces the bucket picker's guesswork with the driver's actual vehicle. Writes
the **same `rangeMiles`** field; the trigger engine is untouched.

## Unit 2.1 — Proxy endpoint `proxy/api/vehicles.ts`

A new Vercel function mirroring the existing `nearby.ts`/`recs.ts` conventions
(CORS `*`, long `s-maxage` edge cache, typed handler). Fronts the **free,
no-key** EPA fueleconomy.gov web service so the app never touches EPA's XML.

**The edge cache IS the "periodic refresh"** the brainstorm discussed: EPA data
changes ~once a year (new model years), so a **7-day `s-maxage`** edge cache
means each (year/make/model) is fetched from EPA at most weekly and served from
Vercel's edge otherwise. No cron, no stored snapshot, no DB. Cheap by
construction.

Four steps (one endpoint, `?step=`):

| Request | EPA upstream | Returns |
|---|---|---|
| `?step=years` | static range (1984–current+1) | `{ years: number[] }` |
| `?step=makes&year=Y` | `/ws/rest/vehicle/menu/make?year=Y` | `{ makes: string[] }` |
| `?step=models&year=Y&make=M` | `/ws/rest/vehicle/menu/model?year=Y&make=M` | `{ models: string[] }` |
| `?step=range&year=Y&make=M&model=D` | `/menu/options` → pick first trim's id → `/vehicle/{id}` | `{ rangeMiles, source, epaVehicleId, mpgCombined? }` |

**Range computation in the `range` step** (server-side, so the client gets a
clean number):
- Fetch the EPA vehicle detail. Read `fuelType1`, `VClass`, `comb08` (combined
  MPG), and `range` (EV electric range, when present).
- **EV/PHEV** (`range` > 0): `rangeMiles = range`, `source = 'epa-ev'`. Clean,
  no tank-size gap.
- **Gas/diesel:** `rangeMiles = round(comb08 × classTank[VClass])`,
  `source = 'epa-gas'`. `classTank` is a small static gallons-by-class table in
  the proxy (`lib/vehicle-tanks.ts`): e.g. *Compact Cars 13, Midsize 15,
  Large Cars 18, Small SUV 15, Standard SUV 19, Pickup 24*; unknown class → 15.
- EPA returns XML; parse with the proxy's existing XML approach (the Places
  responses are JSON, so add a tiny XML→JSON parse — `fast-xml-parser` or a
  targeted regex extract of the handful of fields needed).
- Multiple trims for a (year/make/model): use the **first** trim's combined MPG
  (trims vary little in tank-derived range; a confirm/adjust step (2.3) lets the
  driver correct it). Documented limitation, not a silent guess.

Failure (EPA down, no match, parse error) → `{ rangeMiles: null }` with a 200,
same silent-degrade contract as `nearby.ts`. The client falls back to buckets.

`PROXY_VEHICLES_URL` added to `lib/proxy.ts` next to the existing URL consts.

## Unit 2.2 — Generic `OptionPickSheet` (extracted)

`components/CalendarPickSheet.tsx` is already a filterable bottom-sheet
single-select (search row + tappable rows). Phase 2 needs the same shape three
times (make, model, year) — with calendar that's **four** uses, past
rule-of-three. Extract `components/OptionPickSheet.tsx`:

```ts
type Option = { id: string; label: string; sublabel?: string };
function OptionPickSheet(props: {
  visible: boolean;
  title: string;
  options: Option[];
  selectedId?: string;
  loading?: boolean;        // async make/model fetch in flight
  searchable?: boolean;     // make/model: yes; year: short list, no
  onSelect: (id: string) => void;
  onClose: () => void;
}): JSX.Element;
```

Refactor `CalendarPickSheet` to consume it (the rule-of-three payoff; keeps the
search/scrim/drag-handle chrome in one place). Uses the existing `tapTarget44`
token for the close control.

## Unit 2.3 — Cascading vehicle flow on the fuel screen

A **"Your car"** RowGroup on `app/fuel.tsx`, three `SettingsRow`s:
- **Year** → `OptionPickSheet` (years list, not searchable).
- **Make** → `OptionPickSheet` (fetched on year-pick, searchable). Disabled
  until year set.
- **Model** → `OptionPickSheet` (fetched on make-pick, searchable). Disabled
  until make set.

On model-pick: call `?step=range`, then:
- Success → set `rangeMiles`, `rangeSource` (`epa-ev`|`epa-gas`),
  `vehicle = {year, make, model, epaVehicleId}`.
- **Gas estimate (`epa-gas`)** → show the computed range in an **editable**
  "Tank range" row ("~340 mi — tap to adjust"), since it's MPG×class-tank, not
  measured. EV (`epa-ev`) shows the published range read-only.
- Failure / unknown → toast "Couldn't find that vehicle's range — pick a range
  tier instead" and fall back to the Phase-1 bucket picker.

A small `hooks/useVehicleLookup.ts` wraps the three fetches (loading/error per
step, in-memory cache by query key — same pattern as `getExternalRecommendations`).

State: a network fetch per cascade step. Each is edge-cached, so repeat picks
are instant. Make/model lists are a few hundred items max — fine for an
in-memory filter in `OptionPickSheet`.

---

## Data flow (end to end)

```
Phase 1:
  drive (in-app nav) → watchPositionAsync fixes → project onto route
    → monotonic max arc-length → throttled addMilesSinceFilled()
    → milesSinceFilled persisted
  trip end / app-foreground → isDistanceRefuelDue()?
    → yes: immediate notification + cancel time notif + banner + refuelNotifiedAt
  "I filled up" → milesSinceFilled=0, refuelNotifiedAt=null, reschedule time notif

Phase 2:
  fuel screen → pick Year → /api/vehicles?step=makes → pick Make
    → ?step=models → pick Model → ?step=range
    → rangeMiles + rangeSource set (EV read-only / gas editable)
  (everything downstream identical to Phase 1)
```

## Error handling

- Odometer: bad-accuracy / teleport fixes skipped (Unit 1.1). Crash mid-trip
  loses ≤0.5 mi (throttled flush).
- Notification permission denied: the existing `scheduleRefuelReminder` already
  returns a discriminated result; the distance path reuses it. No permission →
  the in-app `refuelDue` banner still shows (graceful).
- EPA proxy failure → `{ rangeMiles: null }`, client falls back to buckets.
- EPA gas estimate is explicitly editable, so a wrong class-tank guess is
  user-correctable (never a silent confident-wrong number).

## Testing

No test runner in the repo (verified-static + device pass, per project norm).

1. **`npx tsc --noEmit`** clean (filtered for the 4 known-unrelated errors).
2. **Throwaway-node assertions** (pure functions):
   - `isDistanceRefuelDue`: under threshold → false; at/over + not notified →
     true; over + already notified → false; rangeMiles null → false.
   - Odometer route-progress: fixes along a known polyline → monotonic
     arc-length matches expected miles; a fix that projects *behind* the
     max (jitter/backward GPS) → no decrease; a fix lateral to the line
     (parked-at-light wander) → ~zero progress; an accuracy>50 fix → skipped.
   - Proxy range calc: EV (range>0) → epa-ev passthrough; gas → comb08×classTank
     rounded, epa-gas; unknown VClass → 15-gal fallback.
3. **Proxy curl** (manual): `?step=makes&year=2020`, `?step=models&...`,
   `?step=range&year=2020&make=Honda&model=Civic` → sane JSON.
4. **Device:** set a low range (e.g. Custom 2 mi) + reminders on → navigate >2mi
   in-app → refuel notification + banner fire; time notification cancelled;
   "I filled up" clears banner and miles. Phase 2: pick 2020/Honda/Civic →
   range pre-fills, editable; pick an EV → read-only range.

## Files touched

**Phase 1**
- `lib/api/fuel.ts` — schema additions, defaults, `addMilesSinceFilled`,
  `isDistanceRefuelDue`, `markFilledUp` reset additions.
- `hooks/useFuelProfile.ts` — distance-check on trip-end + AppState foreground;
  earliest-wins cancel logic.
- `app/en-route.tsx` (or new `hooks/useTripOdometer.ts`) — route-progress
  odometer: per-fix projection (`nearestPointOnPolyline` from `lib/scoring.ts`)
  → monotonic arc-length → throttled/background flush. Per-route
  cumulative-length prefix array built from `lib/geo.ts`.
- `app/fuel.tsx` — "Tank range" RowGroup (bucket/custom picker) + footer copy.
- `lib/notifications.ts` — an `fireRefuelReminderNow()` immediate variant beside
  `scheduleRefuelReminder` (reuses the copy builder).
- `components/FuelStopsSheet.tsx` — wire `refuelDue` to `refuelNotifiedAt`
  (prop already exists).

**Phase 2**
- `proxy/api/vehicles.ts` — new endpoint (4 steps).
- `proxy/lib/vehicle-tanks.ts` — class→gallons table + XML parse helper.
- `lib/proxy.ts` — `PROXY_VEHICLES_URL`.
- `components/OptionPickSheet.tsx` — extracted generic; `CalendarPickSheet.tsx`
  refactored to consume it.
- `hooks/useVehicleLookup.ts` — cascade fetch wrapper.
- `app/fuel.tsx` — "Your car" RowGroup (year/make/model cascade) + gas-estimate
  adjust affordance.

## Workflow

- **Step 13 (per-PR audit)** — code-reviewer + mobile-ux-optimizer, per phase.
- Phase 1 and Phase 2 are **separate PRs** (Phase 1 ships standalone; Phase 2
  builds on it). Each gets its own audit + learnings entry.
- Reserved-color / tap-target rules: the new sheets use `tapTarget44` and the
  existing settings register — no new design-system surface beyond
  `OptionPickSheet` (which inherits `CalendarPickSheet`'s already-audited chrome).
