# Fuel screen v2 — settings refresh + Phase-2-aware structure

**Date:** 2026-06-17
**Status:** Approved (brainstorm)
**Extends:** [2026-05-30-refuel-reminders-design.md](2026-05-30-refuel-reminders-design.md) (time-only reminders, shipped) and [2026-06-12-distance-aware-refuel-design.md](2026-06-12-distance-aware-refuel-design.md) (Phase 1 distance trigger, shipped; Phase 2 EPA cascade, planned).
**Scope:** Settings UX refresh of `app/fuel.tsx`. Restructures the form to anticipate Phase 2's "Your car" cascade, and fixes four UX gaps in shipped Phase 1.

## Why

Device test of the shipped Phase 1 fuel screen surfaced four UX gaps:
1. The Tank range bucket set mixes vehicle class (Compact/Sedan/SUV) with fuel type (EV), inconsistent — an EV user picking "Compact 300mi" is wrong on two axes.
2. "Time only" sits as a sibling of the range buckets, but it's a meta-choice (no distance trigger) rather than a tank-range answer.
3. The "Current cycle" group (Next reminder + I filled up) reads from saved `profile.remindersEnabled`, so toggling the local switch off leaves the live-state group on screen until Save fires.
4. The selected-state styling on bucket pills is freshgreen background + white text, but in scanning it reads as too similar to unselected. No checkmark or icon affordance.

Phase 2 EPA cascade (Year → Make → Model → range) is approved-spec but unbuilt. Polishing the bucket form now and redesigning when Phase 2 lands would touch the form twice. This spec restructures the form once, in a shape that already accommodates the Phase 2 cascade slot.

## What ships (this PR)

- New group hierarchy (Your car / Reminders / Current cycle / Preferred stations).
- Range subsection nested inside Reminders, gated on "Also use distance" toggle.
- Bucket pills filtered by fuel type (4 distinct sets, see below).
- Bucket pills get Phosphor icons + a stronger selected state (checkmark + icon + freshgreen background).
- Fuel type segment gets matching Phosphor icons for visual consistency.
- Fuel-type-change clears the bucket pick and surfaces a one-line "Pick a tank range for your new fuel type" note.
- Copy: replace "cadence" with "schedule" in user-facing footer copy.
- Current cycle group gates on the local `enabled` state in addition to the saved profile, so toggle-off feels honest pre-Save.

## What does NOT ship (deferred to Phase 2)

- The "Use my exact car for a precise range" upgrade link below the buckets — designed in this spec, but rendered only when Phase 2 ships the cascade behind it. Phase 1.5 ends at the bucket pills + footer copy. Phase 2 adds the link and the Year/Make/Model rows it reveals.
- No data-model changes. `FuelProfile` schema is untouched; this is presentation only.

---

## Section 1 — Group hierarchy

Four RowGroups, top-to-bottom:

1. **Your car** (always visible)
   - Car name (optional) — existing field, unchanged.
   - Fuel type segment — existing 4-pill segment, **gains a Phosphor icon per pill**: `GasPump` (Gas), `GasPump` (Diesel — same glyph reused; Phosphor has no diesel-specific icon, and the label below disambiguates), `Leaf` (Hybrid), `Lightning` (Electric).
2. **Reminders** (always visible; contents gated on `enabled`)
   - "Remind me to refuel" toggle.
   - When `enabled`:
     - "Remind me every {N} days" stepper (unchanged behavior).
     - Tank range subsection (Section 2).
3. **Current cycle** (visible when `enabled && profile?.remindersEnabled && profile.nextReminderAt`)
   - "Next reminder: {date}" status line.
   - "I filled up…" fraction buttons (Filled up · ¾ · ½ · ¼) — unchanged behavior.
4. **Preferred stations** (always visible) — existing card, unchanged.

The split is configuration (groups 1–2) vs. live state (group 3). Group 3 disappears the moment you toggle reminders off in the local form state, not only after Save.

## Section 2 — Range subsection (inside Reminders, when `enabled`)

Order, top-to-bottom:

1. **"Also use distance" toggle**
   - When OFF: only the toggle row renders. The remaining items below hide. This is the "time only" path — opt-in to distance triggering.
   - When ON: pills + footer copy render.
   - Default OFF for new profiles. Hydrated from `profile.rangeSource !== 'none'` for existing profiles.

2. **Bucket pills row** — 3 class buckets + Custom, filtered by `fuelType`:

   | Fuel type | Bucket A | Bucket B | Bucket C |
   |---|---|---|---|
   | Gas | Compact 300 | Sedan 350 | SUV/Truck 400 |
   | Diesel | Compact 350 | Sedan 400 | SUV/Truck 450 |
   | Hybrid | Compact 450 | Sedan 500 | SUV 550 |
   | Electric | Short 200 | Mid 280 | Long 360 |
   
   Plus a **Custom…** pill (always last, opens the existing inline number entry).

   **Pill design.**
   - Unselected: 1pt `colors.separatorSubtle` border, label color `colors.labelSecondary`, Phosphor icon (20pt, matches the existing fuel-type segment scale) on the left.
   - Selected: `colors.freshgreen` background, white label + icon, **Phosphor `Check` glyph** (14pt) prepended to the icon.
   - Minimum painted height: 44pt (cardinal rule). `tapTarget44` from `theme/interaction`.
   - Pressed: `pressedDim` from `theme/interaction`.
   - Per-pill icons (Phosphor): `Car` (Compact), `CarProfile` (Sedan), `Truck` (SUV/Truck), `Lightning` (all EV variants), `PencilSimple` (Custom).
   - Class buckets are class-based labels for gas/diesel/hybrid; EV uses range-based labels (Short / Mid / Long) because EV ranges vary too widely for vehicle class to map cleanly. The pill structure is identical; only the label vocabulary differs.

3. **(Phase 2 only)** — The "Use my exact car for a precise range" upgrade link belongs below the pill row but is **not rendered in Phase 1.5**. Phase 2 adds it as a new element when the cascade behind it is built. No reserved space, no stub — the link simply appears between the pill row and the footer copy when Phase 2 ships.

4. **Footer copy** — *"Reminders fire on your schedule OR after this many in-app navigated miles, whichever comes first. Miles only count trips you navigate in the app."* (Replaces "cadence" with "schedule".)

**Fuel-type-change behavior.** When the user changes `fuelType` while a bucket was selected:
- Clear: `rangeMiles → null`, `rangeSource → 'none'`.
- Show a one-line inline note above the bucket pills: *"Pick a tank range for your new fuel type."* (`typography.footnoteRegular`, `colors.labelSecondary`).
- The "Also use distance" toggle stays ON if it was on (the user opted in; only the specific number resets).

Auto-mapping (e.g. silently switching from "Sedan 350" gas → "Mid 280" EV when fuel type changes) is rejected — it would change a number the user didn't approve. Honest reset + prompt to re-pick is the safer pattern.

**Custom flow.** Tapping Custom reveals the existing inline numeric input below the pill row, with "mi" unit suffix. Unchanged from today. Selected state stays on the Custom pill while entry is open. Commit on submit / blur (existing handler).

## Section 3 — Current cycle group

Three-condition visibility (was a one-condition check, gating on saved profile only):

```ts
const showCycle = enabled && profile?.remindersEnabled && profile?.nextReminderAt;
```

Where:
- `enabled` is the local form toggle state (unsaved).
- `profile?.remindersEnabled` is the persisted toggle state.
- `profile?.nextReminderAt` confirms a reminder is actually scheduled.

The two new pre-conditions (`enabled` and the explicit `nextReminderAt` check) close the existing visibility gap where toggling local off but not saving left the live-state group rendered with stale data.

Contents unchanged: status text + fraction buttons.

---

## Selected-state design — the four affordances

For accessibility and scanning, the selected state on bucket pills stacks four affordances:

1. **Background** — `colors.freshgreen`.
2. **Icon + label color** — `colors.white`.
3. **Checkmark prefix** — Phosphor `Check`, 14pt, white, with 4pt right margin.
4. **`accessibilityState: { selected: true, checked: true }`** — existing.

Unselected pills get only the icon + label in `colors.labelSecondary` with a `colors.separatorSubtle` border. The visual jump between unselected and selected is now legible at a glance — pill grows ~14pt wider on select (Check width + margin), so scanning the row instantly reveals the active pick.

## Copy changes

- Footer copy: replace "cadence" with "schedule" (user-facing).
- Inline reset note: *"Pick a tank range for your new fuel type."* (new, fuel-type-change only).
- `cadenceDays` variable name stays in code (developer-facing, no churn).

## Files touched

- `app/fuel.tsx` — group restructure, range subsection rewrite, "Also use distance" toggle, fuel-type-change reset, current-cycle gating fix, selected-state checkmark, icon imports.

No other files. This is presentation-layer only:
- `FuelProfile` schema untouched.
- `useFuelProfile` hook untouched.
- `lib/api/fuel.ts` untouched (no new buckets at the data layer — the bucket map lives in `app/fuel.tsx` as a `Record<FuelType, BucketSpec[]>` constant).

## Testing

Project norm: no test runner; verified-static + device pass.

1. **`npx tsc --noEmit`** clean against the existing baseline (the four known-unrelated pre-existing errors documented elsewhere).
2. **Device pass on each fuel type:**
   - Pick Gas → bucket pills show Compact 300 / Sedan 350 / SUV/Truck 400 / Custom.
   - Change to Hybrid → bucket pills swap to Compact 450 / Sedan 500 / SUV 550 / Custom, with the inline reset note.
   - Change to Electric → bucket pills swap to Short 200 / Mid 280 / Long 360 / Custom.
3. **Toggle behaviors:**
   - Toggle "Remind me to refuel" off → Cadence stepper, Range subsection, and Current cycle group all hide immediately (before Save).
   - Toggle "Remind me" on, toggle "Also use distance" off → bucket pills + footer copy hide, only the distance toggle visible.
4. **Selected state:**
   - Tap Sedan 350 → pill turns freshgreen with checkmark prefix and white label.
   - Tap a different bucket → previous pill returns to unselected styling; new pill takes the freshgreen + check.
5. **Cycle group:**
   - With a saved profile that has `nextReminderAt`, group renders.
   - Toggle local "Remind me" off (don't Save) — group hides immediately. Toggle on again — group returns.
6. **VoiceOver:** each pill announces label + selected state. Check `accessibilityRole="radio"` + `accessibilityState: { selected, checked }` on each.

## Workflow

- Per-PR `docs/workflow.md` rhythm: branch → scope → build → self-review → verify-goal → merge → learnings.
- Step 7 review brief: `code-reviewer` + `mobile-ux-optimizer` (the latter checks the selected-state visual jump and the fuel-type-change reset flow specifically).
- Step 11 learnings entry candidate: the "anticipate Phase 2 slot in Phase 1.5 layout" pattern — designing for a planned-but-unbuilt feature without shipping a stub — is worth recording if it holds up at audit.

## Out of scope

- No data-model changes; bucket sets live in `app/fuel.tsx`.
- No EPA cascade build (deferred to Phase 2).
- No changes to `useFuelProfile`, `useTripOdometer`, `markFilledUp`, or any trigger-engine logic.
- No new Preferred Stations behavior.
- Icon additions to the Fuel type segment are bundled into this PR (consistency with the new range-pill icons), but no other icon work elsewhere in the app.
