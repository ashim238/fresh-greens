# Settings Value-Population — Design Spec

**Date:** 2026-06-19
**Status:** Approved (brainstorm complete; awaiting plan)
**Sprint:** Design Health Program — Phase 2 Sprint 2, PR 1 of 4
**Sprint plan:** [`docs/superpowers/specs/2026-06-19-design-health-sprint-2-plan.md`](2026-06-19-design-health-sprint-2-plan.md)
**Synthesis source:** [`phase-1-findings/2026-06-19-cross-screen-synthesis.md`](phase-1-findings/2026-06-19-cross-screen-synthesis.md) Section 4, "iOS Settings Register — Value-as-Description"

---

## Goal

Restore the iOS-canonical `value`-slot semantic on `SettingsRow` and populate it where meaningful state exists. The `value` slot displays **current state** ("Marcus Williams", "3 recordings"), never **description** ("Reach a trusted contact or 911"). Description copy belongs in `RowGroup.footer` (which already exists). Document the convention in the component so future consumers don't drift.

## The bug being fixed

Phase 1's per-screen critique caught a register drift on `app/safety-settings.tsx`: the Emergency SOS row uses its `value` slot for a description (`"Reach a trusted contact or 911"`) instead of state, on the same screen where the sibling Trusted Contact row uses its `value` slot correctly (the contact's name). Mixed register on one screen, no shared rule.

The synthesis also flagged the Recordings row (no value, where a count would be meaningful) and called out menu's pure-nav rows. Investigation during brainstorm narrowed the actual edit surface:

- **safety-settings** — real fix: SOS row's description belongs in the existing `RowGroup.footer` prop, not the `value` slot
- **safety-settings** — small enhancement: Recordings row gains a derived count
- **menu** — only Saved places has meaningful state (a count); other rows are pure-navigation, their sub-pages are the editors, surfacing state at menu level would invite drift
- **zone-preferences** — already canonical (toggle rows + footer correctly on the "What we flag" group); no change

## Scope

**1 component doc + 2 screens + 3 atomic commits.** Smaller than the synthesis implied — the brainstorm caught that menu and zone-preferences need less work than synthesis predicted.

| File | Change | Commit |
|---|---|---|
| `components/settings/SettingsRow.tsx` | JSDoc update documenting the value-slot convention | 1 |
| `app/safety-settings.tsx` | Move SOS description from `value` to `RowGroup.footer`; add derived count to Recordings row | 2 |
| `app/menu.tsx` | Add derived count to Saved places row | 3 |

**Out of scope (deliberate):**
- `zone-preferences.tsx` — already canonical, no edit needed
- Adding state to menu's non-saved-places rows (Refuel reminders, Zone Preferences, Safety, Privacy & Terms, Sign out) — pure-navigation, sub-pages are the editors
- New SettingsRow variants
- New `RowGroup` props — `footer` and `title` already exist and already do what we need

---

## Design

### The convention (the JSDoc)

`SettingsRow.value` displays the **current state** of the setting that row owns. State includes:

- The setting's configured value: `"Marcus Williams"`, `"English (US)"`
- A setup-cue when the setting is unconfigured: `"Add someone you trust"`, `"Set up"`
- A count of related items: `"3 recordings"`, `"3 saved"`

What `value` **never** carries:

- Descriptions: `"Reach a trusted contact or 911"`
- Instructions: `"Tap to manage your account"`
- Explanations of what the row does

Description / instruction copy belongs in `RowGroup.footer` (existing prop, already canonical iOS pattern). The eyebrow `title` prop handles section grouping.

**The replacement JSDoc paragraph** (replaces the existing line `` `value` renders right-aligned text before the trailing affordance (e.g. "English (US)"). ``):

```ts
/**
 * `value` is iOS-canonical: current state of the setting this row owns.
 * Use for:
 *   - the setting's configured value: "Marcus Williams", "English (US)"
 *   - a setup-cue when unconfigured: "Add someone you trust", "Set up"
 *   - a count of related items: "3 recordings"
 *
 * Don't use for descriptions or instructions — those go in
 * `RowGroup.footer` below the card. "Reach a trusted contact or 911"
 * is footer copy, not value copy.
 */
```

### Per-screen edit map

#### `app/safety-settings.tsx`

**Row 1 — Emergency SOS** (description → footer):

```tsx
// Before
<RowGroup>
  <SettingsRow
    icon={<Asterisk size={24} color={colors.red} weight="bold" />}
    label="Emergency SOS"
    value="Reach a trusted contact or 911"
    onPress={() => router.push('/emergency')}
    accessibilityHint="Opens the SOS screen to call your trusted contact or 911"
  />
  ...
</RowGroup>

// After
<RowGroup footer="Reach a trusted contact or 911.">
  <SettingsRow
    icon={<Asterisk size={24} color={colors.red} weight="bold" />}
    label="Emergency SOS"
    onPress={() => router.push('/emergency')}
    accessibilityHint="Opens the SOS screen to call your trusted contact or 911"
  />
  ...
</RowGroup>
```

Period added to the footer copy — `footer` text is sentence-terminated per the iOS HIG and matches zone-preferences's existing footer (`"Affects route scoring and map flags."`).

**Row 3 — Recordings** (no value → derived count):

```tsx
// In the component body, after the existing useTrustedContact() block:
const recordingsState = useRecordings();
const recordingsCount =
  recordingsState.ready && recordingsState.ok
    ? recordingsState.recordings.length
    : 0;
const recordingsValue =
  recordingsCount === 0
    ? undefined
    : recordingsCount === 1
    ? '1 recording'
    : `${recordingsCount} recordings`;
```

```tsx
// In the render, add value to the existing Recordings row:
<SettingsRow
  icon={<Microphone size={24} color={colors.black} weight="duotone" />}
  label="Recordings"
  value={recordingsValue}
  onPress={handleRecordings}
/>
```

The hook call is **render-mode** for `useRecordings` (per PR #3's contract — no error arg, no log fires). If the read errored (`!ok`), the count falls through to 0 → undefined value → row shows nothing (gracefully degrades; the `/recordings` screen itself surfaces the load error via its own 3-state ladder).

**Imports added:** `useRecordings` from `'../hooks/useRecordings'`.

#### `app/menu.tsx`

**Saved places row** (no value → derived count):

Same shape as Recordings, but the existing `useSavedPlaces` call at line ~113 already exists for the `clear` mutation. Reuse it:

```tsx
// menu.tsx already has:
const { clear: clearSavedPlacesMutation } = useSavedPlaces();

// Augment to also get the count:
const savedPlacesState = useSavedPlaces();
const { clear: clearSavedPlacesMutation } = savedPlacesState;
const savedPlacesCount =
  savedPlacesState.ready ? savedPlacesState.savedPlaces.length : 0;
const savedPlacesValue =
  savedPlacesCount === 0 ? undefined : `${savedPlacesCount} saved`;
```

```tsx
// In the render, add value to the existing Saved places row:
<SettingsRow
  icon={<Bookmark size={24} color={colors.black} weight="duotone" />}
  label="Saved places"
  value={savedPlacesValue}
  onPress={handleSavedPlaces}
/>
```

Singular form is `"1 saved"` not `"1 saved place"` — the noun is implicit from the row label and reads more naturally at small width.

**Other menu rows** (Refuel reminders, Zone Preferences, Safety, Privacy & Terms, Sign out): unchanged. Pure navigation.

---

## Testing

- **`tsc --noEmit`** clean after every commit.
- **Manual smoke:**
  - `/safety-settings`: SOS row reads cleanly as a 2-line row (icon + label + chevron, no inline value). Footer text "Reach a trusted contact or 911." appears below the card. Recordings row shows count when ≥1 recording exists, nothing when 0.
  - `/menu`: Saved places row shows count when ≥1 saved place, nothing when 0. Other rows unchanged.
- **Visual baseline:** the SOS row's height shrinks slightly (no value text). Confirm the row's `minHeight: 52` still applies and the row reads consistent with its siblings.
- **No behavior change:** all tap actions and navigation paths identical to pre-PR.

---

## Files

- **Modify:** `components/settings/SettingsRow.tsx` (JSDoc only)
- **Modify:** `app/safety-settings.tsx`
- **Modify:** `app/menu.tsx`
- **Untouched (deliberate):** `app/zone-preferences.tsx` — already canonical
- **Untouched (deliberate):** `components/settings/RowGroup.tsx` — `footer` and `title` props already exist

## Verification (definition of done)

- [ ] `tsc --noEmit` passes with no errors after each commit
- [ ] SettingsRow JSDoc states the value-slot convention with examples + the footer-is-for-descriptions rule
- [ ] safety-settings SOS row: no `value` prop; `RowGroup` has `footer="Reach a trusted contact or 911."`
- [ ] safety-settings Recordings row: shows derived count (`useRecordings` narrow + singular/plural) or nothing when 0
- [ ] menu Saved places row: shows derived count or nothing when 0
- [ ] zone-preferences.tsx not in diff (confirms scope discipline)
- [ ] RowGroup.tsx not in diff (no infra changes)
- [ ] No new SettingsRow variants introduced

## Sequencing

PR 1 of Sprint 2's 4-PR cluster. Within it, low-blast-first:

1. **`refactor(settings-row): document value-slot convention`** — JSDoc only. Pure-additive doc. Establishes the rule the per-screen commits cite.
2. **`refactor(safety-settings): move SOS description to footer + recordings count`** — 1 screen, 2 edits.
3. **`refactor(menu): add saved-places count`** — 1 screen, 1 edit.

PR 1 closes when these 3 commits are merged. PR 7 (coach-mark recoverability) brainstorm starts when PR 1 enters execute/review (per the sprint plan's pipelined cadence).
