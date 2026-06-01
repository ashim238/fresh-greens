# Settings Register Refresh — Design

**Date:** 2026-06-01
**Status:** Approved (brainstorm complete)
**Next step:** Implementation plan via `superpowers:writing-plans`

## Scope

This is **Phase A** of a four-part settings vision. Phase A is the cross-cutting visual register refresh — the prerequisite all later phases consume — **plus** a folded-in minimal-but-real "Connect calendar" feature (added during the brainstorm; the carousel needs a second real tile to earn its keep, and the feature is built honestly rather than stubbed). The other phases are parked for separate brainstorm → spec → plan cycles:

- **Phase B (parked):** General settings page — distance units (mile/km segmented control), prevent auto-lock toggle, language. First consumer of the `SegmentedRow` primitive.
- **Phase C (parked):** Preferred gas type discoverability — re-surface the existing `useFuelProfile().fuelType` in the settings hub.
- **Phase D (parked):** Preferred stations — net-new data (likely `useSavedPlaces` extended with `kind: 'station'`) + list page + add affordance. Green Book–aligned.

Phase A is the dependency: B/C/D all build on the new register, so the register ships first, once, cleanly. After A lands, B/C/D are independent.

**Why the calendar feature is folded in, not stubbed:** the "Connect calendar" tile was deliberately cut at v1 (`menu.tsx:123`) because "the underlying feature doesn't exist and showing a coming-soon tile would lie about state" — the honesty-of-disclosure principle the thesis leans on. To include the tile, we build the real feature: connecting the calendar reads upcoming located events and surfaces them as navigation destinations in `/search`. A tile that connects to nothing would re-create the exact stub the project rejected.

## Goal

Bring Fresh Greens' settings surfaces to the iOS-native grouped-settings register — the visual language users' muscle memory expects from a settings screen — and close the structural gap where `/menu` is the de-facto settings hub without looking like one. Ship it as a single cross-cutting PR so the user never encounters mixed chrome inside the settings flow.

## Structural decisions (from brainstorm)

1. **`/menu` IS the settings hub** (Q1-c). No route change, no `/settings` split. `/menu` is reframed as "Settings": profile becomes a page-header card, the row list becomes the top-level settings nav, the carousel becomes a progressive-disclosure shortcut section.
2. **Header chrome: root gets close-X only; children get chevron-back + close-X** (Q2-a). iOS convention — the root of a settings tree has no parent to point a back-chevron at. Close X always exits the whole flow to `/home`.
3. **iOS grouped-background register** (Q3-a). Page bg flips to `colors.systemGroupedBackground` (light gray); row groups are white cards (`radii.md`, `shadows.e1`) sitting in the gray, with the gray gutter between groups as the visible section subdivision.
4. **Progressive carousel survives and earns its keep** (Q4 + follow-ups). The carousel is a nudge toward high-impact *unset* settings. Each tile hides once its underlying setting is configured; the whole carousel section hides when no tiles remain. Anything reachable from a carousel tile is ALSO reachable from the always-available row list — the carousel is a shortcut, never the only path.
5. **Retrofit all 6 settings pages in one PR** (Q5-a). `/menu`, `/zone-preferences`, `/safety-settings`, `/saved-places`, `/fuel`, `/legal`.
6. **Child-page hero glyphs retire** (Section 3-i). The 48pt category-glyph + Title2 hero element (introduced earlier this session on `/safety-settings`, `/zone-preferences`, `/saved-places`) is removed; page identity moves to the SettingsHeader title text. Accepted personality tradeoff for the iOS-native register.
7. **Connect calendar is built real, folded in** (calendar Q1-3). Surfaces upcoming located events as destinations in `/search` (cal-Q1-a); resolves event location text via the existing `searchPlaces` geocode (cal-Q2-b); unresolved/wrong events get an inline pick-sheet whose corrections persist, keyed by location text (cal-Q3-a).

## Architecture

### New primitives — `components/settings/`

A subdirectory (matching how `lib/api/` groups its adapters) for three components used across all 6 pages.

**`components/settings/SettingsHeader.tsx`**

```ts
{
  title: string;            // centered
  onBack?: () => void;      // chevron-back at left, only when provided
  onClose: () => void;      // close X at right, ALWAYS rendered
}
```

- Chevron-back (Phosphor `CaretLeft`, 28pt) at left when `onBack` is set; an equal-width spacer when not (keeps the title centered).
- Close X (Phosphor `X`, ~24pt glyph) at right, always.
- Both controls are 44pt-visual tap targets per the `.cursorrules` tap-target rule.
- Title centered, `title2Emphasized` (or `bodyEmphasized` — see Layout).

Callers own the behavior:
- `/menu` passes only `onClose` (= dismiss to `/home`).
- Child pages pass `onBack` (= `router.back()` to `/menu`) and `onClose` (= pop to `/home`). The close handler on children uses the existing canGoBack-guarded dismiss-to-home pattern.

**`components/settings/RowGroup.tsx`**

```ts
{
  title?: string;     // uppercase eyebrow caption ABOVE the white card
  footer?: string;    // small caption BELOW the white card
  children: ReactNode;
}
```

- Optional eyebrow caption (uppercase, `footnoteEmphasized`/`subheadlineEmphasized`, `labelSecondary`) above the card.
- White card: `backgroundColor: colors.white`, `borderRadius: radii.md`, `shadows.e1`.
- Thin hairline separators between direct row children (inset to the row's text column, iOS-style). **RowGroup owns the separators** — it maps `React.Children.toArray(children)` and inserts a separator View between adjacent children (none after the last). This keeps `SettingsRow` position-agnostic (a row doesn't need to know whether it's last). Separator: 1pt (`StyleSheet.hairlineWidth` floor), `colors.cardBorderSubtle`, left-inset to clear the row's icon+gap column (~52pt) so it aligns under the label text, iOS-style.
- Optional footer caption below the card (`footnoteRegular`, `labelSecondary`).

**`components/settings/SettingsRow.tsx`**

Generalizes `/menu`'s current inline `SettingsRow` (which only does icon + label + chevron).

```ts
{
  icon?: ReactNode;
  label: string;
  value?: string;                       // right-aligned value text (e.g. "English (US)")
  trailing?: 'chevron' | 'toggle' | 'segmented' | 'none';  // default 'chevron'
  toggleValue?: boolean;
  onToggle?: (next: boolean) => void;
  segmentedOptions?: { label: string; value: string }[];
  segmentedValue?: string;
  onSegmentedChange?: (next: string) => void;
  onPress?: () => void;
  destructive?: boolean;                // red label (Sign out)
}
```

- 44pt min row height; `pressedDim` feedback when `onPress`/`trailing==='chevron'`.
- Trailing variants: `chevron` (Phosphor `CaretRight` 16pt regular), `toggle` (RN `Switch` with the freshgreen track color used elsewhere), `none`, and `segmented` (a pill control).
- **`segmented` is interface-only in Phase A** — there are zero use sites. The prop slots are reserved so Phase B's distance-units row drops in without a component change. The pill rendering is wired in Phase B, not A. (Rule of three: don't build the segmented renderer for zero current consumers.)
- `destructive` tints the label `colors.red`, centers it, omits the icon and chevron (Sign out).

### Theme

No new tokens required. `colors.systemGroupedBackground`, `colors.white`, `colors.red`, `radii.md`, `shadows.e1`, and the typography ramp all exist.

## Page-by-page retrofit

### `/menu` (hub)

Top-to-bottom: SettingsHeader(title="Settings", onClose only) → profile card → progressive carousel (when non-empty) → app-config RowGroup → about RowGroup → sign-out RowGroup (bottom-pinned via `marginTop: 'auto'`).

- **Header:** was bare back-chevron. Now title="Settings" + close X, no chevron.
- **Profile:** same avatar + "Hey there, [name]" content, wrapped as a white card on the gray bg. Non-tappable in Phase A (no profile-edit surface yet).
- **Carousel:** progressive. Two real tiles in Phase A:
  - **Refuel reminders** — hides when `useFuelProfile().profile?.remindersEnabled === true`. Taps → `/fuel`.
  - **Connect calendar** — hides when `useCalendarConnection().connected === true`. Taps → triggers the connect flow (see Connect Calendar Feature below).
  - Whole section unrendered when no eligible tiles remain. White card when rendered; horizontal scroll only when 2+ tiles show.
- **Row list → two RowGroups:**
  - App-config group: **Refuel reminders (NEW)**, Zone Preferences, Safety, Saved places.
  - About group: Privacy & Terms.
  - "Refuel reminders" is the new row — closes the gap where `/fuel` was only reachable via the carousel. Now reachable from the always-available row even when the carousel tile is hidden.
- **Sign out:** was a custom centered text-link Pressable. Now a `destructive` SettingsRow in its own bottom RowGroup.
- Unchanged: ScrollView wrapper, haptics on row press, all routing targets (no URL changes).

### `/zone-preferences` (representative child)

SettingsHeader(title="Zone Preferences", onBack→`router.back()`, onClose→home) → RowGroup[Show zones overlay toggle] → RowGroup(eyebrow="WHAT WE FLAG", footer="Affects route scoring and map flags.")[Police presence, Low-light areas, Community reports toggles].

- Header gains title + close X; the existing 28pt back-chevron becomes SettingsHeader's chevron-back.
- 48pt `MapPinArea` hero glyph + Title2 row retires.
- Page bg → `systemGroupedBackground`.
- Existing `groupCaption` ("What we flag") becomes the RowGroup eyebrow.
- No data/handler changes — same `usePreferences` surface.

### `/safety-settings`

SettingsHeader(title="Safety", onBack, onClose) → one RowGroup[Emergency SOS, Trusted Contact, Recordings]. 48pt Shield hero retires. The Emergency-SOS row keeps its red asterisk leading glyph (it's a per-row icon, not the page hero).

### `/saved-places`

SettingsHeader(title="Saved places", onBack, onClose) → RowGroup[dynamic saved-place rows]. Empty state: centered "No saved places yet" + body directly on the gray bg (no white card when there's nothing to wrap). 48pt Bookmark hero retires.

### `/fuel`

SettingsHeader(title="Refuel reminders", onBack, onClose) → form restructured into RowGroups:
- Car-profile group: car name (TextInput row), fuel type (the existing 4-way picker — rendered as-is inside a RowGroup for Phase A; segmented primitive deferred to B).
- Reminder group: reminders-enabled toggle, cadence stepper.
- Current-state group: "Next reminder: …" status + "I filled up" action (rendered only when reminders enabled, as today).
- Page bg → grouped gray. The chevron-title spacing fix from earlier this session is superseded by the new header.

### `/legal`

SettingsHeader(title="Privacy & Terms", onBack, onClose) → Privacy/Terms/Licenses tab pills stay (they're the page's primary nav) → content body wrapped in a white RowGroup-style card on gray. Page bg → grouped gray.

## Connect Calendar Feature

A minimal-but-real feature folded into Phase A so the carousel's "Connect calendar" tile connects to something. Connecting the calendar reads the user's upcoming events that have a resolvable location and surfaces them as navigation destinations in `/search`.

### New dependency

`expo-calendar` (Expo SDK module; managed-workflow compatible). **Flagged per `.cursorrules` anti-slop #4.** No lighter built-in exists — iOS calendar access requires the native EventKit bridge, which `expo-calendar` is the canonical Expo wrapper for. Read-only access (`Calendar.requestCalendarPermissionsAsync` + `Calendar.getEventsAsync`); the app never writes events.

### Data model — two new adapters

**`lib/api/calendar.ts`** — connection state + event reading.

```ts
export type CalendarConnection = { connected: boolean };  // AsyncStorage: fresh-greens.calendar.v1

export type UpcomingEvent = {
  id: string;            // calendar event id
  title: string;         // event title ("Dentist")
  startsAt: number;      // ms epoch
  locationText: string;  // raw event.location free-text (non-empty — events without location are filtered out upstream)
};

getCalendarConnection(): Promise<CalendarConnection>
setCalendarConnected(connected: boolean): Promise<CalendarConnection>
clearCalendarConnection(): Promise<void>   // sign-out hygiene
// Reads device calendar events in the next CALENDAR_LOOKAHEAD_DAYS window
// that have non-empty location text. Pure of geocoding — that's the hook's job.
getUpcomingLocatedEvents(): Promise<UpcomingEvent[]>
```

`CALENDAR_LOOKAHEAD_DAYS = 7` (named constant; one week of upcoming appointments is the useful horizon — beyond that the list reads as noise).

**`lib/api/calendar-resolutions.ts`** — persisted manual corrections, keyed by location text.

```ts
export type ResolvedPlace = { name: string; latitude: number; longitude: number };
// AsyncStorage: fresh-greens.calendar-resolutions.v1
// Map<locationText, ResolvedPlace>. Keyed by the raw event location string
// (NOT event id) so recurring events + repeated venues reuse one correction.

getResolutions(): Promise<Record<string, ResolvedPlace>>
setResolution(locationText: string, place: ResolvedPlace): Promise<void>
clearResolutions(): Promise<void>   // sign-out hygiene
```

### Hooks

**`hooks/useCalendarConnection.ts`** — reactive wrapper over `lib/api/calendar.ts` connection state. `{ connected, loading, connect, disconnect }`. `connect()` runs the permission request; on grant, persists `connected: true`. On denial, stays `false` and surfaces the standard "enable in Settings" Alert (mirrors the `/permissions` + `/report` camera-permission pattern). Drives both the carousel tile's visibility and the `/search` section's gate.

**`hooks/useUpcomingDestinations.ts`** — the resolver. Composes `getUpcomingLocatedEvents()` + `getResolutions()` + `searchPlaces()`:

1. Read upcoming located events (next 7 days, non-empty location).
2. For each, resolve to coords:
   - If a stored resolution exists for the event's `locationText` → use it (no geocode call).
   - Else `searchPlaces(locationText, nearUser)` → first hit becomes the resolved place. (Same geocode path `/unfamiliar` uses.)
   - If neither yields a place → event is **unresolved** (still listed, but in a "Set location" state, not omitted — the manual-correct affordance is the recovery).
3. Returns `{ resolved: [...], unresolved: [...], loading }` where each item carries the event + (for resolved) its `ResolvedPlace`.

Resolution results are memoized per render pass; geocode calls are made once per distinct unresolved `locationText`.

### `/search` Upcoming section

A new section in `/search`, rendered only when `useCalendarConnection().connected`. Sits alongside the existing saved-places / regular-destinations rows in the same register.

- **Resolved event row:** event title (primary) + resolved place name + relative time ("Dentist · Dr. Lee Dentistry · in 2h"). Tap → routes to that destination (same `router.replace('/home?destLat=…')` pattern saved-place rows use). A subtle trailing "fix" affordance opens the pick-sheet to correct a wrong match.
- **Unresolved event row:** event title + relative time + a "Set location" affordance (the row can't route until resolved). Tap "Set location" → pick-sheet.
- **Empty state:** when connected but no located events in the window, the section doesn't render (no empty card — same honest-omission rule as the rest).

### Pick-sheet (manual correction)

A lightweight bottom-sheet (mirrors the `ReportDetailCard` / `ZoneDetailCard` scrim+sheet chrome) opened from a "Set location" / "fix" tap. Contains a search field pre-filled with the event's `locationText`, runs `searchPlaces` as the user types/submits, lists results. Picking a result calls `setResolution(locationText, place)` → the section re-resolves → that event (and any other event with the same location text) now resolves to the chosen place permanently.

### Sign-out hygiene

`/menu`'s sign-out handler already clears identity-attached stores (contact, saved places, preferences, fuel). Add `clearCalendarConnection()` + `clearResolutions()` to that `Promise.all` so a sign-out doesn't leave another user's calendar resolutions on the device.

### Known limitations (documented, accepted for v1)

- **First-geocode-hit can be wrong** ("Apple Store" → nearest, not intended). Mitigated by the visible resolved place name on the row + the fix affordance. The manual correction persists, so a wrong auto-match is a one-time fix.
- **Non-geocodable events stay unresolved** until manually set ("Zoom", "Mom's" with no address). They appear in the list with "Set location" rather than being hidden — the user decides.
- **Read-only, no event editing/creation.** The app never writes to the calendar.
- **No live event refresh mid-session beyond `/search` focus.** The section re-reads on `/search` focus (matching the `useFocusEffect` re-read pattern used elsewhere); it doesn't subscribe to live calendar-change notifications. Acceptable — appointments don't change minute-to-minute.

## What this design explicitly does NOT do

- No `SegmentedRow` rendering (interface only — Phase B).
- No General settings page (Phase B).
- No preferred-gas-type or preferred-stations surfaces (Phases C/D).
- No profile-edit affordance (profile card is display-only).
- No route changes — every existing `router.push('/...')` target is preserved.
- No calendar *writing* — read-only access; the app never creates or edits events.
- No live calendar-change subscription — `/search` re-reads on focus, no EventKit change-observer.

## Accessibility

- SettingsHeader's chevron-back and close X are 44pt visual tap targets, `accessibilityRole="button"`, labels "Back" and "Close".
- RowGroup eyebrow captions use `accessibilityRole="header"` so VoiceOver announces section boundaries.
- SettingsRow toggle variant pairs `accessibilityLabel` (what it is) + `accessibilityHint` (what it affects), matching the existing `/zone-preferences` toggle a11y.
- Destructive Sign-out row: `accessibilityRole="button"`, label "Sign out".
- Calendar Upcoming rows: resolved rows are `accessibilityRole="button"` labelled "[title], [place], [relative time]. Tap to navigate." Unresolved rows label "[title], [relative time]. Location not set — tap Set location to choose." The pick-sheet's search field + result rows follow the same labelling the existing search surface uses.
- Text sizes inherit the audit-corrected ramp shipped earlier this session (17pt row labels, etc.) — `dynamicType()` wraps preserved.

## Honesty-of-disclosure / thesis alignment

The progressive carousel is the load-bearing thesis touch: it nudges the user toward the settings that most improve *their* safety experience (refuel reminders so they don't run dry in an unsafe area; connect-calendar so appointments become one-tap safe-routed destinations; later, preferred stations per the Green Book lineage), and it disappears once configured rather than nagging. The "shortcut, never the only path" rule keeps the full settings tree honest and discoverable — the carousel can't hide a setting, only accelerate reaching it.

The calendar feature is the sharpest honesty test in this PR and the reason it's built rather than stubbed: the tile was *previously cut* for being a coming-soon lie. Shipping it real — read-only access, only routable events surfaced, unresolved events shown honestly as "Set location" rather than hidden or faked — turns the rejected stub into a genuine capability. The "connect" action grants a real OS permission and produces real navigable destinations; nothing claims a state it doesn't have.

## Deferred / follow-ups

- Phase B: General page + SegmentedRow rendering + distance units + prevent-auto-lock.
- Phase C: preferred-gas-type surfacing.
- Phase D: preferred stations (Green Book).
- `/fuel` form may warrant its own polish pass once it's in the new register and the segmented fuel-type primitive lands in B.
- Profile-edit affordance (tapping the profile card) — out of scope until there's something to edit.
- Calendar feature enhancements: live event-change subscription, multi-calendar selection, geocode-confidence indicator on auto-resolved rows. All deferred — v1 is the minimal honest version.
