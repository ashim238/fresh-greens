# Roadside Assistance — Design Spec

**Date:** 2026-05-31
**Figma node:** [Frame 4 /safety entry](https://www.figma.com/design/7DDh6c7tk7OKF4WiA7pEkp/?node-id=1121-10452) · [Step 1 problem picker](https://www.figma.com/design/7DDh6c7tk7OKF4WiA7pEkp/?node-id=1264-5199) · [Step 2 action menu](https://www.figma.com/design/7DDh6c7tk7OKF4WiA7pEkp/?node-id=1264-5268) · [Step 3 live-status](https://www.figma.com/design/7DDh6c7tk7OKF4WiA7pEkp/?node-id=1277-7085)

## Goal

Ship the **Roadside Assistance** tile from `/safety` as a 3-step flow (problem → action → live-status) that lets the user reach their roadside service, share their location with their trusted contact, and live in a "help is on the way" state until they're back on the road. No fake ETAs, no fake service identity — a one-time setup captures the real ones.

## Architecture

```
/safety  ──tap "Roadside assistance" tile──▶  /roadside (modal page-sheet, multi-step in-route)
                                                       │
                                                       ├── first-time call: push /roadside-setup (stacks on top), back returns to Step 2
                                                       ├── no trusted contact: share row pushes /trusted-contact-setup (stacks on top)
                                                       └── escalation: replace with /pulled-over
```

**Presentation pattern — aligned with `/pulled-over`:**

All four `/safety` sub-flows (`/pulled-over` exists today; `/roadside`, `/unfamiliar`, `/share-location` per [Frame 4](https://www.figma.com/design/7DDh6c7tk7OKF4WiA7pEkp/?node-id=1121-10452)) follow the **same single-route page-sheet modal pattern** that `/pulled-over` established. That means:

- Registered in `app/_layout.tsx` with `presentation: 'modal'` (iOS native page-sheet — slide-up, rounded top, swipe-down to dismiss). One presentation, one swipe-down gesture per sub-flow.
- **Single route per sub-flow**, internal state machine for multi-step content. No nested routes. (`/pulled-over` "consolidates what used to be four stacked modals into a single state-machine modal" — same idea here.)
- **`<DragHandle />`** at the top of every step — the sheet's dismissal affordance. Stays present even when the back-trap is active; the trap blocks the gesture, the visible handle still tells the user this is a sheet.
- **Internal-step back navigation uses a chevron-on-row-1** (visible on Steps 2 and 3 of Roadside) — that's separate from sheet dismissal. Tapping it sets `step` backward; it does NOT dismiss the sheet.
- **Critical-phase dismissal trap uses `usePreventRemove`** from `@react-navigation/native` — the same primitive `/pulled-over` uses for its guidance phase.
- Modal-on-modal stacking is fine — `/roadside-setup` and `/trusted-contact-setup` are pushed *on top of* `/roadside` (both also `presentation: 'modal'`). The underlying sheet stays mounted; popping the top sheet returns to it with state intact.

**Persistence shape:**

- `lib/api/roadside.ts` — AsyncStorage adapter mirroring `lib/api/fuel.ts`. Storage key: `fresh-greens.roadside.v1`.
- Profile: `{ serviceName: string; phoneNumber: string; setAt: number }`. No membership numbers, no multi-service profiles — defer to v2 if asked.
- `hooks/useRoadsideProfile.ts` — reactive wrapper with `useFocusEffect` re-read (matches `useFuelProfile` — coming back from `/roadside-setup` surfaces the profile without remount).

**In-memory session state (lives in `/roadside`, dies on unmount — out of scope for v1 to persist across kills):**

```ts
type Step = 'problem' | 'action' | 'status';
type ProblemType = 'flat-tire' | 'no-start' | 'no-gas' | 'locked-out' | 'other';

type SessionState = {
  step: Step;
  problem: ProblemType | null;
  locationLabel: string;          // reverse-geocoded; "Wrong spot?" can override
  locationCoords: { latitude: number; longitude: number } | null;
  actionTaken: boolean;           // flips true on first call/tow/share — triggers status step
  shareOn: boolean;
  shareToggledAtIso: string | null; // drives "Maya was notified at 9:14 PM" line
};
```

**Transitions:**

- `problem → action` when the user taps any problem row.
- `action → status` the moment `actionTaken` flips true: (a) `Linking.openURL('tel:…')` resolves, (b) tow-search `Linking.openURL('maps://…')` resolves, or (c) `shareOn` flips true.
- `status` is terminal in the route — exit via "I'm back on the road" (`router.back()`) or "Switch to Pulled-over mode" (`router.replace('/pulled-over')`).
- "I figured it out" (Step 2) → `router.back()`.

## Files

**Create:**
- `app/roadside.tsx` — the 3-step flow route
- `app/roadside-setup.tsx` — service-name + phone form (mirror of `app/fuel.tsx`)
- `lib/api/roadside.ts` — AsyncStorage adapter
- `hooks/useRoadsideProfile.ts` — reactive wrapper

**Modify:**
- `app/safety.tsx` line ~77 — Roadside tile `onPress` from inert/TBD to `router.push('/roadside')`
- `app/_layout.tsx` — register `/roadside` + `/roadside-setup` as modal-presentation routes (match `/fuel`, `/pulled-over`)
- `docs/learnings.md` — append entry on the **navy cross-link carve-out** (see below)

**No new shared components.** Specifically:
- "What you shared" card is a one-off `<View>` in `/roadside` — generalize only if a second caller appears.
- "Maya is being notified" pulse dot uses `usePulseOpacity` directly (matches `TrustedContactStatus` precedent), not a new `<StatusPulseDot>` wrapper.

## The 3 steps in detail

### Step 1: Problem picker

**Header pattern** — `<DragHandle />` on row 1 (sheet dismissal affordance — swipe-down on the sheet body or tapping the underlying scrim dismisses to `/safety`). No chevron on Step 1 because there's no internal step to go back to. Gray subtitle "Let's get you the help you need." on row 2, bold display "What's going on?" on row 3.

**5 problem rows** — white cards, `cardBorderSubtle` border, freshgreen icon in a `fillsTertiary` circle on the left, label, chevron right. ≥44pt tap target. Icons (all Phosphor, deep-imported):

| Problem | Phosphor icon | Step 2 phrase |
|---|---|---|
| Flat tire | `Tire` | "with a flat tire" |
| Won't start / Dead battery | `CarBattery` | "with a dead battery" |
| Out of gas | `GasPump` | "out of gas" |
| Locked out | `Lock` | "locked out" |
| Something else | `Wrench` | *(triggers fallback headline — see Step 2)* |

**Location chip** — pill at bottom: `MapPin` icon + reverse-geocoded label (e.g. "Park Slope, Brooklyn"). While the geocode is in-flight, the pill renders **"Locating…"** — never empty. Below: `"Wrong spot?"` muted link, opens the Wrong-spot modal.

**Wrong-spot modal** — Modal (not a route push) with the same scrim-a11y pattern as `RouteComparisonSheet`/`FuelStopsSheet` (`accessible={false}` + `accessibilityViewIsModal`). Single TextInput placeholder "Enter address or area", Confirm button. On confirm: geocode via `Location.geocodeAsync`, update `locationLabel` + `locationCoords` for the session only, dismiss. On geocode fail: inline error "Couldn't find that address. Try again." — don't dismiss.

### Step 2: Action menu

**Header** — `<DragHandle />` on row 1 (sheet still dismissable by swipe-down). Chevron on row 2 — tapping it sets `step` back to `'problem'`, preserving the problem selection so the user can re-pick. Gray subtitle "Got it." on row 3, bold display headline on row 4.

**Headline interpolation:**
- For `flat-tire`/`no-start`/`no-gas`/`locked-out`: `"You're in {locationLabel} {problemPhrase}."`
- For `'other'`: `"You're in {locationLabel} and need help."` (fallback — can't say "with a something else")

**Three action rows:**

1. **"Call your roadside service"** — `Phone` icon. Behavior depends on profile:
   - **Profile exists:** label shows `"Call {serviceName}"`. Tap → `Linking.openURL('tel:{phoneNumber}')`. On URL resolution, `actionTaken` flips true → advances to Step 3.
   - **No profile:** label shows `"Set up your roadside service"`. Tap → `router.push('/roadside-setup')`. On return (via `router.back()`), Step 2 is preserved with problem still selected; if profile now exists, row shows the call CTA. Does NOT flip `actionTaken`.

2. **"Search nearby tow services"** — `MapPin` icon. Tap → `Linking.openURL('maps://?q=tow+truck&sll={lat},{lng}')` (Apple Maps URL scheme). Flips `actionTaken` true.

3. **"Share location w/ {contactName}"** — `ShareNetwork` icon + Switch. Behavior depends on trusted contact:
   - **Contact exists:** Switch with `trackColor={{ false: cardBorderSubtle, true: freshgreen }}`, `thumbColor` white, `accessibilityRole="switch"`, `accessibilityLabel="Share location with {contactName}"`. Toggling ON triggers `Haptics.selectionAsync()`, sets `shareOn = true`, `shareToggledAtIso = new Date().toISOString()`, and (if `actionTaken` was false) flips it true → Step 3. Toggling OFF clears `shareOn` but does NOT revert `actionTaken` (you can't un-call a phone).
   - **No contact:** row collapses to `"Set a trusted contact"` chevron → `router.push('/trusted-contact-setup')`. On return, `useTrustedContact`'s focus-refetch surfaces the new contact (we fixed this Friday — see commit `89f3d84`); row re-renders as the toggle variant.

**"I figured it out" CTA** — bottom, `<Button type="primary" fill="outline">`. The outline variant already exists in `components/Button.tsx`. Tap → `router.back()`.

### Step 3: Live-status

**Header pattern** — `<DragHandle />` on row 1 (still visible — the affordance stays even though the dismissal gesture is trapped; see Hardware-back trap below). No chevron — Step 3 has no "back" action, only forward exits (the explicit CTAs). Gray subtitle "Hang tight." on row 2, bold display headline on row 3.

**Headline interpolation:**
- `"{serviceName} should be on the way."` if profile exists
- `"Help is on the way. Stay where you are."` if profile does not exist

**No ETA copy anywhere.** We don't know the ETA. The thesis-aligned move is honest reassurance, not a fake countdown.

**"What you shared" card** — `colors.systemGroupedBackground` fill (the iOS grouped-list background — definitive precedent for "card-subtle" in our system), no border, `borderRadius: 12`, `padding: spacing.md`. Section title `"What you shared"` in `bodySmall` weight 600. Body line is a `•`-separated chip-list assembled from whatever facts are currently true (live — re-renders if share is toggled on after entering Step 3):
- `problemLabel` (always present)
- `locationLabel` (always present)
- `"{contactName} was notified at {time}"` — only when `shareOn === true` AND `shareToggledAtIso` is non-null. `time` formatted as `"9:14 PM"` (locale-aware).

**"If this gets worse" section title** — `bodySmall`, `colors.labelSecondary`, `marginBottom: spacing.sm`.

**"Switch to Pulled-over mode" row** — same row pattern as Step 2 actions, but the leading icon is `Siren` in **`colors.navy`** (the Pulled-over reserved color). Tap → `router.replace('/pulled-over')`. **This is the navy cross-link carve-out** (see Reserved-color exception below).

**"I'm back on the road" primary CTA** — `<Button type="primary" fill="fill">`, freshgreen. Tap → `router.back()` (returns to `/safety`, which dismisses to `/home`).

**Status pulse row** — directly below the CTA: small green dot using `usePulseOpacity()` + `"{contactName} is being notified"` text in `bodySmall`. Only rendered when `shareOn === true`. The whole row gets `accessibilityLabel="{contactName} is being notified"` (the dot itself is decorative — `accessibilityElementsHidden`).

**Haptic on entry to Step 3:** `Haptics.notificationAsync(Success)` fires once when `step` transitions to `'status'`. The brand "exhale" moment.

## Hardware-back trap (Step 3)

While `step === 'status'`, intercept Android hardware back AND iOS swipe-down-to-dismiss using **`usePreventRemove`** from `@react-navigation/native` — the same primitive `/pulled-over` uses for its guidance phase. The user MUST exit through an explicit CTA — "I'm back on the road" or "Switch to Pulled-over mode." Steps 1 and 2 dismiss normally via swipe-down.

The `<DragHandle />` stays visually present on Step 3 — the dismissal *gesture* is trapped, but the *affordance* still reads as "this is a sheet, not a permanent screen." Removing the DragHandle would suggest the sheet has become a full screen, which is wrong.

**Rationale:** Same logic as `/pulled-over` — accidental dismissal of an active help session is a safety regression. The CTAs read as commitments, the dismissal gesture does not.

## Roadside setup (`/roadside-setup`)

Mirror of `app/fuel.tsx`. Same pattern: chevron-on-row-1 + bold title-on-row-2 header. Two `TextInput`s:

1. **Service name** — placeholder `"AAA, Geico, USAA, …"`. Required.
2. **Phone number** — placeholder `"1-800-…"`. `keyboardType="phone-pad"`. Required. Basic validation: at least 7 digits when stripped. No format coercion (let the user type the dash style they prefer — `tel:` URL scheme handles raw digits).

**Save button** — bottom, `<Button type="primary" fill="fill">`, label `"Save"`. Disabled until both fields validate. On save: persist via `setRoadsideProfile`, `router.back()`.

**Wrapped in `KeyboardAvoidingView`** (iOS behavior `padding`) — same as `/fuel`.

**No notification scheduling.** Unlike `/fuel`, the roadside profile is reactive only — there's no "remind me to renew membership" feature in scope.

## Reserved-color carve-out (navy as cross-link)

**Current rule** (`.cursorrules`): reserved colors (orange/red/yellow/pink/navy) only appear on the route that owns them. Navy belongs to `/pulled-over`.

**Carve-out for this PR:** A reserved color *may* tint an icon in a row whose `onPress` navigates directly to that color's owning route, as a wayfinding affordance.

- **Where:** "Switch to Pulled-over mode" row in `/roadside` Step 3. Navy `Siren` icon.
- **Where it does NOT apply:** Decorative use, secondary navigation, any icon whose row doesn't route directly to the reserved color's owning screen.
- **Why this is safe:** The navy stays a *signal* (here it signals "this row goes to Pulled-over"), not a brand color reassignment.
- **Documentation:** Add a paragraph to `.cursorrules` under the reserved-color rule. Append entry to `docs/learnings.md` explaining the carve-out and the scoping rationale.

## A11y

- All Pressable rows: ≥44pt tap target, `accessibilityRole="button"`, label = visible label.
- Switch row: `accessibilityRole="switch"`, `accessibilityState={{ checked: shareOn }}`, label as specified above.
- Step 3 status pulse row: `accessibilityLabel` on parent, dot `accessibilityElementsHidden`.
- "Wrong spot?" link: `accessibilityRole="link"`, label `"Change location"`.
- Location chip on Step 1: `accessibilityRole="text"` while resolving, `accessibilityLabel="Current location: {locationLabel}"` once resolved.
- Primary/outline CTAs: `accessibilityRole="button"`, label matches visible text.
- Header titles: `accessibilityRole="header"`.

## Out of scope (v1)

- ETA prediction, countdown, or progress bar
- Membership numbers / multi-service profiles
- Persisting an in-progress roadside session across app kills (in-memory only)
- Pre-filling `/pulled-over` with the roadside session's context (fresh start)
- Custom problem types beyond the 5
- Web/Android variants of the dialer/tow-search URLs (iPhone-first per architecture)

## Self-review check (filled in before commit)

- ✅ All 8 polish items folded in (fallback headline, live shared-card, hardware-back trap, setup-return preserves context, Wrong-spot as Modal, locating loading state, haptics, a11y baseline).
- ✅ All 5 design-alignment items resolved (Button.outline already exists; navy carve-out documented; `systemGroupedBackground` chosen as card-subtle token; Phosphor icons named; pulse dot reuses existing hook).
- ✅ Phosphor used throughout; per-icon deep imports.
- ✅ No placeholders, no TBDs.
- ✅ State machine has explicit transitions; no implicit branches.
- ✅ Trusted-contact and roadside-profile both gracefully degrade when missing — flow remains usable.
