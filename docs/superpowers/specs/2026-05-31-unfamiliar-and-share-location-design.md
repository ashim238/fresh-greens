# Unfamiliar Area + Share Location — Design Spec

**Date:** 2026-05-31
**Figma nodes:**
- Unfamiliar Step 1 — [1277:7199](https://www.figma.com/design/7DDh6c7tk7OKF4WiA7pEkp/?node-id=1277-7199)
- Unfamiliar Step 2 — [1278:7579](https://www.figma.com/design/7DDh6c7tk7OKF4WiA7pEkp/?node-id=1278-7579)
- Unfamiliar lifeline — [1278:9194](https://www.figma.com/design/7DDh6c7tk7OKF4WiA7pEkp/?node-id=1278-9194)
- Share Location Step 1 — [1279:4684](https://www.figma.com/design/7DDh6c7tk7OKF4WiA7pEkp/?node-id=1279-4684)
- Share Location persistent widget — [1279:4928](https://www.figma.com/design/7DDh6c7tk7OKF4WiA7pEkp/?node-id=1279-4928)

## Goal

Ship the remaining two `/safety` tiles as page-sheet modals backed by a **shared ShareSession state machine**, a **persistent LiveSafetySheet widget** that surfaces the active session on `/home` and `/en-route`, and a **shared NotifyingPulse component**. Unfamiliar Area is a reactive flow (problem → safe-destination); Share Location is proactive (pick a reason, share starts immediately). Both auto-start the share on Step 1 selection — no separate toggle.

This is the work that completes `/safety` to its full 4-tile shape per Frame 1121:10452.

## Why one spec for two features

Unfamiliar and Share Location share substantial machinery: the ShareSession model, the auto-share-on-selection behavior, the persistent widget, the NotifyingPulse pattern, the trusted-contact dependency. Splitting them across two specs would duplicate ~60% of the content and make the shared-infra contracts harder to keep coherent. One spec → one phased plan → one branch.

## Architecture

```
/safety  ──tap "Unfamiliar area" tile──▶   /unfamiliar (modal page-sheet)
                                            ├── Step 1: problem picker (auto-starts share)
                                            ├── Step 2: safe-destination picker → routes to /en-route
                                            └── Lifeline: tap contact pulse → LifelineModal

/safety  ──tap "Share location" tile──▶    /share-location (modal page-sheet)
                                            └── single step: reason picker (auto-starts share)

Globally (when ShareSession is active):
  /home  ──renders──▶  <LiveSafetySheet />  (sticky bottom)
  /en-route  ──renders──▶  <LiveSafetySheet />  (sticky bottom)
```

**Presentation pattern — both follow the established safety-sub-flow shape:**

- `presentation: 'modal'` (iOS page-sheet, slide-up, rounded top)
- `<DragHandle />` at the top of each step
- Internal-step back navigation (Unfamiliar Step 2 → Step 1) uses a chevron
- `usePreventRemove` traps dismissal whenever a session is *active and exiting would orphan it* — see [Dismissal trap rules](#dismissal-trap-rules)

## Shared infrastructure

### `ShareSession` — global session state

**Single active session at a time.** Either a Share Location session OR an Unfamiliar session — never both, never two of the same type.

**`lib/api/share-session.ts`:**

```ts
export type ShareSessionType = 'unfamiliar' | 'share-location';

export type ShareSession = {
  id: string;                    // uuid; survives app kill
  type: ShareSessionType;
  reason: string;                // verbatim user selection — "Just in case", "I'm lost", etc.
  startedAtIso: string;          // anchors the duration counter
};
```

- AsyncStorage key: `fresh-greens.share-session.v1`
- Functions: `getStoredShareSession()`, `setStoredShareSession(session)`, `clearStoredShareSession()`
- Adapter mirrors `lib/api/roadside.ts` / `lib/api/fuel.ts` shape exactly

**`hooks/useShareSession.ts`:**

```ts
export function useShareSession(): {
  session: ShareSession | null;
  loading: boolean;
  startSession: (input: { type: ShareSessionType; reason: string }) => Promise<ShareSession>;
  endSession: () => Promise<void>;
};
```

- `useFocusEffect` re-read pattern (matches `useFuelProfile` / `useRoadsideProfile`)
- `startSession` replaces any prior session optimistically — but the UI guard rails (re-entry + degradation, see below) prevent the user from getting there accidentally
- `endSession` clears storage + sets local state to null

**v1 semantics — "UI-state simulation":**

The session reflects the user's *intent* to share. **No SMS sent, no actual live tracking.** Matches the existing pattern in Roadside's share toggle and Pulled-over's contact phase, which are also state-only. Foreground-only location use; nothing requested. Real backend / SMS hookup explicitly deferred — flag in spec, log to learnings, revisit post-v1.

**Stale-session check on app launch:** If `getStoredShareSession()` returns a session older than 4h, the LiveSafetySheet renders an inline "End sharing?" prompt instead of the standard widget body. v1 behavior; v2 may auto-end with a notification.

### `<NotifyingPulse />` — shared pulse chip

**`components/NotifyingPulse.tsx`:**

```tsx
type Props = {
  contactName: string;
  /** Optional override; defaults to `${contactName} is being notified`. */
  label?: string;
  /** Centered vs. row-left alignment. Default: 'center' (used in flow footers). */
  align?: 'center' | 'start';
};
```

- Renders an `Animated.View` (8x8 freshgreen dot, opacity-pulsing via `usePulseOpacity()`) + a label
- `accessibilityLabel` on the parent View; the dot is `accessibilityElementsHidden`
- **Retrofit Roadside Step 3** to use this component (current inline implementation gets replaced)

Used in:
- Unfamiliar Step 1 + Step 2 footers
- Share Location Step 1 footer
- Inside the LiveSafetySheet
- Inside Roadside Step 3 (retrofit)

### `<LiveSafetySheet />` — persistent widget

**`components/LiveSafetySheet.tsx`:**

Returns `null` when `useShareSession().session` is null. Otherwise renders a sticky bottom sheet anchored to the bottom of its mounting surface. Two states:

**Collapsed (default):**
- 64pt-tall pill / sheet section docked at bottom
- Left: small `<NotifyingPulse align="start" />`
- Center: "Sharing location — {duration}" where duration is `MM:SS` for under 60 min, else `Hh MMm`
- Right: chevron-up affordance
- Tappable to expand

**Expanded (after tap):**
- Matches Figma 1279:4928 layout: DragHandle, "Live" label, "Sharing location" title, card with "Actively sharing" + contact avatar + name + "Partner" relation label + Duration row + Reason row
- "End sharing" outlined CTA (freshgreen border, freshgreen label — `<Button type="primary" fill="outline">`)
- Footer: `<NotifyingPulse />`
- Tap outside the expanded card or swipe down → collapses

**Mounting:**
- Imported and rendered at the **bottom of `app/home.tsx`'s root View**, above the existing bottom sheet stack
- Imported and rendered at the **bottom of `app/en-route.tsx`'s root View**, above any existing bottom UI
- Self-contained: it reads `useShareSession()` directly, no props from parents
- Z-index above /home's daylight strip and /en-route's route info, below modals

**Reason rendering:**
- For `type: 'share-location'`: shows the verbatim user selection ("Just in case", "Heading somewhere new", etc.)
- For `type: 'unfamiliar'`: shows the **session type label only** ("Unfamiliar area"), NOT the specific problem ("I'm being followed", etc.). Privacy-by-default: the widget is glanceable; the specific problem the user declared is for the contact's awareness, not always-visible chrome.

**End-sharing confirmation:**
- For `type: 'unfamiliar'`: `Alert.alert("End sharing?", "Your trusted contact will stop seeing your location.", [Cancel, End])`. Higher-stakes context.
- For `type: 'share-location'`: single tap ends — no confirm. Routine context, friction would feel paternalistic.

### `<LifelineModal />` — Unfamiliar-only escalation

**`components/LifelineModal.tsx`:** Shared component to match Figma 1278:9194.

```tsx
type Props = {
  visible: boolean;
  onClose: () => void;
  contact: TrustedContact;
};
```

- Page-sheet `Modal` (transparent, fade animation, `accessibilityViewIsModal`)
- Big circular trusted-contact avatar (uses `contact.initials` over a wiltedgreen filled circle with freshgreen ring — matches Figma)
- Title: "You're not alone."
- Subtitle: "Your Trusted Contact is alerted during emergencies and can see your current location."
- Two CTAs (stacked, full-width):
  - **Call** — `<Button type="primary" fill="fill">` with `Phone` icon, label "Call". `onPress` → `Linking.openURL("tel:" + contact.phoneNumber.replace(/[^\d+]/g, ''))`
  - **Text** — `<Button type="primary" fill="outline">` with `ChatCircle` Phosphor icon, label "Text". `onPress` → `Linking.openURL("sms:" + contact.phoneNumber.replace(/[^\d+]/g, ''))`
- Footer: `<NotifyingPulse />` text "Your Trusted Contact is being notified" (override default label)
- **Drop** the Figma's "Swipe down on the gray slider to return to navigation" copy — DragHandle carries the affordance

**Entry point:** Only from within `/unfamiliar` — the `<NotifyingPulse />` footer on Step 1 and Step 2 is wrapped in a `<Pressable>` that opens the modal. Other flows (Roadside Step 3, Pulled-over, Share Location widget) do NOT have lifeline entries — keeps the Unfamiliar-only scope clean.

## Route: `/unfamiliar`

### Step 1 — Problem picker

**Header pattern:** `<DragHandle />` row 1, gray subtitle "Ok. You're somewhere unfamiliar." row 2, bold display "What's going on?" row 3.

**Three problem rows** — each a tap card with title + one-line clarifier (matches Figma's two-line row layout, different from Roadside's icon-rows):

| ID | Title | Clarifier |
|---|---|---|
| `lost` | I'm lost | I don't recognize this area and need to get somewhere safe |
| `unsafe` | I feel unsafe | Something about this area feels wrong — I want to leave |
| `followed` | I'm being followed | I think someone is tailing me |

**No leading icon, no chevron** — the row IS the content (matches Figma frame). Background: `colors.systemGroupedBackground` (the card-subtle token established in Roadside).

**Footer:** `<NotifyingPulse contactName={contact.name} />` — wrapped in a Pressable that opens the LifelineModal on tap.

**Tap a problem:**
1. Call `startSession({ type: 'unfamiliar', reason: <title verbatim> })` — share starts.
2. `setStep('destination')` — advance.

### Step 2 — Safe-destination picker

**Header pattern:** DragHandle + chevron-back row 1 (chevron goes back to Step 1, preserving session), gray subtitle "Let's get you someplace safe." row 2, bold display "Where do you want to go?" row 3.

**Disclosure paragraph below header:** "Fresh Greens saves your journey periodically to ensure we can get you back on track." (verbatim from Figma — informational; v1 doesn't actually save journey, but the copy reflects intent and the user's mental model.) Spec-note: this is aspirational language for v1, real journey snapshots are out of scope.

**Three destination rows:**

| ID | Title | Phosphor icon | POI query |
|---|---|---|---|
| `well-lit` | Take me to somewhere well-lit | `Lightbulb` | Search for open-now businesses (the closest honest proxy). Documented as the "well-lit" proxy in code comments. |
| `gas-station` | Take me to a gas station | `GasPump` | Mapbox `fuel` category |
| `on-ramp` | Take me to the nearest on-ramp | `Road` | Mapbox `motorway_junction` / OSM highway-link (use the existing route-source ladder) |

**On tap:**
1. Use `lib/api/places.ts` `searchPlaces` to find the nearest match.
2. `router.replace('/en-route?destination=<lat,lng>&destinationName=<label>')` — routes to the chosen destination using the existing /en-route entry point. The /unfamiliar modal dismisses; LiveSafetySheet appears on /en-route because session is still active.
3. If POI search returns no result: inline `Alert.alert("Couldn't find a {category} nearby. Try a different option.")` — doesn't end session.

**"I'm safe now" outlined CTA** at bottom — `<Button type="primary" fill="outline">`. Ends session (`endSession()`), dismisses modal back to `/safety`.

**Footer:** same `<NotifyingPulse />` + lifeline wrap as Step 1.

### Re-entry behavior

If user taps "Unfamiliar area" on `/safety` while an Unfamiliar session is already active:
- `/unfamiliar` opens directly to the LiveSafetySheet's **expanded** state — NOT the picker.
- Shows the current reason, duration, and "End sharing" CTA.
- This is implemented by inspecting `useShareSession().session.type === 'unfamiliar'` on mount; if true, render the active view, not the picker.

If user taps Share Location tile while an Unfamiliar session is active: Alert "You're in an Unfamiliar area session. End it first to start Share Location."

## Route: `/share-location`

### Single-step reason picker

**Header:** DragHandle row 1, gray subtitle "On it. Sharing your location now." row 2, bold display "What's the situation?" row 3.

Subtitle is honest because the share starts on Step 1 selection — but spec-note: the picker is the entry, the subtitle reflects what's about to happen on selection. The literal *moment* of session start is the user's tap, not the modal opening. This nuance is fine for v1; if it ever reads misleading, swap subtitle to "Quick — what's the reason?"

**Four reason rows** (same two-line card style as Unfamiliar Step 1):

| ID | Title | Clarifier |
|---|---|---|
| `new-place` | Heading somewhere new | I want someone to know where I am |
| `night-drive` | Driving late at night | I could use the additional peace of mind |
| `uneasy` | I feel uneasy | Something's off, and I could use the visibility |
| `routine` | Just in case | Routine safety — nothing specific |

**On tap:**
1. `startSession({ type: 'share-location', reason: <title verbatim> })`.
2. `router.back()` — dismisses /share-location to whatever was underneath (/home or /en-route). LiveSafetySheet appears.

**Footer:** `<NotifyingPulse contactName={contact.name} />` — NO lifeline wrap (Unfamiliar-only).

### Re-entry behavior

If user taps "Share Location" on `/safety` while a share-location session is active:
- `/share-location` opens directly to the expanded LiveSafetySheet state — NOT the picker.
- Shows reason, duration, "End sharing" CTA.

If user taps Unfamiliar tile while share-location session is active: Alert "You're in a Share Location session. End it first to enter Unfamiliar area."

## `/safety` tile wiring + degradation

**Both new tiles** (`app/safety.tsx` lines ~80–90, already inert with `href: null` placeholders) → `href: '/unfamiliar'` and `href: '/share-location'` respectively.

**No-trusted-contact degradation:**

Before pushing either tile's route, intercept the tap in `safety.tsx`:

```tsx
const { contact } = useTrustedContact();
// ...
const handleTilePress = (tile: SafetyTab) => {
  if ((tile.id === 'unfamiliar' || tile.id === 'share-location') && !contact) {
    Alert.alert(
      'Set a trusted contact',
      'These flows share your location with your trusted contact. Set one up first.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Set up', onPress: () => router.push('/trusted-contact-setup') },
      ],
    );
    return;
  }
  if (tile.href) router.push(tile.href);
};
```

Pulled-over and Roadside don't need this gate (they handle contact-missing internally with degraded UI).

## Dismissal trap rules

`usePreventRemove` is the canonical primitive — same pattern as `/pulled-over` and `/roadside` Step 3.

**Unfamiliar:**
- Step 1 (picker, no session yet): swipe-down dismisses freely. No trap.
- Step 1 (re-entry, session active): swipe-down dismisses to /home; session continues, widget visible. No trap — the widget IS the persistence affordance.
- Step 2 (session active, mid-picker): swipe-down dismisses to /home; session continues. No trap.

**Share Location:** Single step. Same logic — swipe-down always allowed; widget carries the session forward.

**Net:** Neither flow needs `usePreventRemove` because the LiveSafetySheet widget is the durable surface. The /pulled-over and /roadside Step 3 patterns trap because losing the modal *loses the state*; here the modal is ephemeral, the widget is the persistence layer.

## Token + design alignment

- All cards / rows: `colors.systemGroupedBackground` fill, no border, `borderRadius: 12`, gap-12 vertical
- All primary CTAs: `<Button type="primary" fill="fill">` (freshgreen)
- All secondary/outlined CTAs: `<Button type="primary" fill="outline">` (freshgreen border + label)
- Phosphor icons (`Lightbulb`, `GasPump`, `Road`, `Phone`, `ChatCircle`) — deep imports
- Pulse dot — extracted `<NotifyingPulse />`; never re-implemented inline
- Token substitutions: same as Roadside/Roadside-setup (`title2Emphasized`, `bodyRegular`, `bodyEmphasized`, `footnoteRegular`, `footnoteEmphasized`)
- `MM:SS` / `Hh MMm` duration formatting (warmer than `HH:MM:SS`) — implement as `formatDuration(secs)` helper in `lib/util/format.ts` (or wherever the existing helpers live; check `lib/util/` first)

## A11y baseline

- Every Pressable: ≥44pt, `accessibilityRole="button"`, label = visible label (or composite "Title. Clarifier." for two-line rows)
- Headers: `accessibilityRole="header"` on each step's title
- `<NotifyingPulse />`: label on parent View, dot `accessibilityElementsHidden`
- LiveSafetySheet collapsed: `accessibilityRole="button"`, label "Sharing location with {contactName}. Tap to expand."
- LiveSafetySheet expanded: title `accessibilityRole="header"`, "End sharing" button labeled
- LifelineModal: scrim `accessible={false}`, modal carries `accessibilityViewIsModal`
- Two-line row a11y label: composite — `"I feel unsafe. Something about this area feels wrong — I want to leave."`

## Out of scope (v1)

- Real SMS / push to contact (deferred; v1 is UI-state simulation)
- Background-location permission (foreground-only)
- Live-tracking refresh (no periodic SMS, no live-map link)
- Persisted journey snapshots (the "saves your journey periodically" copy is aspirational)
- Multiple recipients / sharing with someone other than the trusted contact
- Pulled-over and Roadside in-flow shares promoting to global sessions (kept independent per chosen approach)
- Stale-session auto-end via notification (v1 shows inline prompt only)

## Surface inventory

**Create:**
- `app/unfamiliar.tsx`
- `app/share-location.tsx`
- `lib/api/share-session.ts`
- `hooks/useShareSession.ts`
- `components/NotifyingPulse.tsx`
- `components/LiveSafetySheet.tsx`
- `components/LifelineModal.tsx`
- `lib/util/format-duration.ts` (or extend existing if there's a util module)

**Modify:**
- `app/_layout.tsx` — register `unfamiliar` + `share-location` as modal routes
- `app/safety.tsx` — wire Unfamiliar + Share tiles + add contact gate
- `app/home.tsx` — mount `<LiveSafetySheet />` at root
- `app/en-route.tsx` — mount `<LiveSafetySheet />` at root
- `app/roadside.tsx` — retrofit Step 3 inline pulse to use `<NotifyingPulse />`
- `docs/learnings.md` — entry on the ShareSession single-active-session model + widget anchoring

## Self-review

- ✅ All 7 conceptual decisions baked in (lifeline scope = Unfamiliar only; widget on home + en-route; auto-share on Step 1; well-lit = aspirational proxy; in-flow toggles independent; UI-state simulation; current-session view on re-entry).
- ✅ Both flows use the same shared infra; no duplicated logic.
- ✅ No-contact gate is a one-line addition on `/safety`, not a per-flow degradation.
- ✅ Dismissal traps explicitly NOT needed — widget is the persistence layer.
- ✅ NotifyingPulse extraction backfills Roadside Step 3 as part of Phase A — no drift.
- ✅ Privacy: Unfamiliar's specific problem (e.g. "Being followed") never shown in widget; only session type.
- ✅ Confirmation pattern asymmetric (Unfamiliar end → Alert; Share Location end → single tap) — honest about stakes.
- ✅ "Well-lit" proxy spec'd with a docs note.
- ✅ Component sizes scoped: each new component is ~80–150 lines, single responsibility.
- ✅ No new state-machine surface needed inside the new screens — the global ShareSession IS the state machine.
