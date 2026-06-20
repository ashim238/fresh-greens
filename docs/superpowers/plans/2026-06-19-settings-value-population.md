# Settings Value-Population Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore the iOS-canonical `value`-slot semantic on `SettingsRow` (value = current state, never description) and populate it where meaningful state exists.

**Architecture:** Three atomic commits, low-blast-first: (1) document the convention in the `SettingsRow` JSDoc; (2) `safety-settings` — move the SOS description from the `value` slot to the existing `RowGroup.footer`, and add a derived recordings count to the Recordings row; (3) `menu` — add a derived saved-places count to the Saved places row. No component code changes (`RowGroup.footer` already exists); no new variants; no behavior change to any tap action.

**Tech Stack:** React Native + Expo, TypeScript. No test runner — verification is `npx tsc --noEmit` + manual device/sim smoke (project norm).

**Spec:** [`docs/superpowers/specs/2026-06-19-settings-value-population-design.md`](../specs/2026-06-19-settings-value-population-design.md)

---

## File Structure

- `components/settings/SettingsRow.tsx` — **modify (JSDoc only).** The value-slot convention lives here so future consumers read the rule at the definition site.
- `app/safety-settings.tsx` — **modify.** SOS description → `RowGroup.footer`; Recordings row gains a derived count.
- `app/menu.tsx` — **modify.** Saved places row gains a derived count (reuses the existing `useSavedPlaces()` call, rebound to expose state).
- **Untouched (deliberate):** `app/zone-preferences.tsx` (already canonical), `components/settings/RowGroup.tsx` (`footer`/`title` props already exist).

---

## Task 0: Branch setup

**Files:** none (git only)

- [ ] **Step 1: Create the feature branch off main**

```bash
git checkout main && git pull --ff-only
git checkout -b feat/settings-value-population
```

- [ ] **Step 2: Confirm clean tsc baseline**

Run: `npx tsc --noEmit`
Expected: exits 0.

---

## Task 1: Document the value-slot convention

**Files:**
- Modify: `components/settings/SettingsRow.tsx` (JSDoc only)

- [ ] **Step 1: Replace the `value` JSDoc line**

In `components/settings/SettingsRow.tsx`, find the existing JSDoc line inside the component's doc-comment block:

```ts
 * `value` renders right-aligned text before the trailing affordance
 * (e.g. "English (US)"). `destructive` makes the row a centered red
 * label with no icon / no trailing (Sign out).
```

Replace the first sentence (the `value` description) so the block becomes:

```ts
 * `value` is iOS-canonical: the current state of the setting this row
 * owns. Use for:
 *   - the setting's configured value: "Marcus Williams", "English (US)"
 *   - a setup-cue when unconfigured: "Add someone you trust", "Set up"
 *   - a count of related items: "3 recordings"
 * Don't use it for descriptions or instructions — those go in
 * `RowGroup.footer` below the card. "Reach a trusted contact or 911"
 * is footer copy, not value copy. `destructive` makes the row a
 * centered red label with no icon / no trailing (Sign out).
```

(Keep the rest of the doc-comment — the `trailing` enum docs, the spec link — unchanged. Only the `value` sentence is rewritten; the `destructive` sentence is preserved at the end.)

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: exits 0. Comment-only change.

- [ ] **Step 3: Commit**

```bash
git add components/settings/SettingsRow.tsx
git commit -m "docs(settings-row): document value-slot convention

value = current state (configured value, setup-cue, or count). Never
a description — those go in RowGroup.footer. Establishes the rule the
safety-settings + menu value-population commits cite.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 2: safety-settings — SOS description to footer + recordings count

**Files:**
- Modify: `app/safety-settings.tsx`

- [ ] **Step 1: Add the `useRecordings` import**

In `app/safety-settings.tsx`, the imports block (lines 17-22) currently has:

```ts
import { RowGroup } from '../components/settings/RowGroup';
import { SettingsHeader } from '../components/settings/SettingsHeader';
import { SettingsRow } from '../components/settings/SettingsRow';
import { useTrustedContact } from '../hooks/useTrustedContact';
import { colors } from '../theme/colors';
import { spacing } from '../theme/spacing';
```

Add the `useRecordings` import after the `useTrustedContact` line:

```ts
import { useTrustedContact } from '../hooks/useTrustedContact';
import { useRecordings } from '../hooks/useRecordings';
```

- [ ] **Step 2: Derive the recordings count**

In the component body, after the existing `trustedContactValue` block (ends at line ~55), add:

```ts
// Recordings count for the row's value slot. Render-mode useRecordings
// call (no error arg per the error-message contract — the /recordings
// screen surfaces load errors via its own 3-state ladder). If the read
// errored or is mid-hydrate, count falls to 0 → undefined value → the
// row shows label + chevron only.
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

- [ ] **Step 3: Move the SOS description to the RowGroup footer**

The current render (around lines 81-100) has:

```tsx
<RowGroup>
  <SettingsRow
    icon={<Asterisk size={24} color={colors.red} weight="bold" />}
    label="Emergency SOS"
    value="Reach a trusted contact or 911"
    onPress={() => router.push('/emergency')}
    accessibilityHint="Opens the SOS screen to call your trusted contact or 911"
  />
  <SettingsRow
    icon={<UserCircle size={24} color={colors.black} weight="duotone" />}
    label="Trusted Contact"
    value={trustedContactValue}
    onPress={handleEditTrustedContact}
  />
  <SettingsRow
    icon={<Microphone size={24} color={colors.black} weight="duotone" />}
    label="Recordings"
    onPress={handleRecordings}
  />
</RowGroup>
```

Replace it with:

```tsx
<RowGroup footer="Reach a trusted contact or 911.">
  <SettingsRow
    icon={<Asterisk size={24} color={colors.red} weight="bold" />}
    label="Emergency SOS"
    onPress={() => router.push('/emergency')}
    accessibilityHint="Opens the SOS screen to call your trusted contact or 911"
  />
  <SettingsRow
    icon={<UserCircle size={24} color={colors.black} weight="duotone" />}
    label="Trusted Contact"
    value={trustedContactValue}
    onPress={handleEditTrustedContact}
  />
  <SettingsRow
    icon={<Microphone size={24} color={colors.black} weight="duotone" />}
    label="Recordings"
    value={recordingsValue}
    onPress={handleRecordings}
  />
</RowGroup>
```

Three edits: (a) `RowGroup` gains `footer="Reach a trusted contact or 911."` (period added — footer copy is sentence-terminated, matching zone-preferences's existing footer); (b) the SOS row drops its `value` prop; (c) the Recordings row gains `value={recordingsValue}`. The `accessibilityHint` on the SOS row is preserved verbatim.

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 5: Commit**

```bash
git add app/safety-settings.tsx
git commit -m "refactor(safety-settings): SOS description to footer + recordings count

Emergency SOS row's 'Reach a trusted contact or 911' moves from the
value slot (where it was a description, not state) into the RowGroup
footer that already existed. Recordings row gains a derived count
('1 recording' / '3 recordings' / nothing when 0) so the row shows
its state per the iOS settings register. No tap-action change.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 3: menu — saved-places count

**Files:**
- Modify: `app/menu.tsx`

- [ ] **Step 1: Rebind the existing `useSavedPlaces` call to expose state**

In `app/menu.tsx`, line 113 currently is:

```ts
const { clear: clearSavedPlacesMutation } = useSavedPlaces();
```

Replace it with a single bound call (do NOT add a second `useSavedPlaces()` — that would create a second hook instance):

```ts
const savedPlacesState = useSavedPlaces();
const { clear: clearSavedPlacesMutation } = savedPlacesState;
const savedPlacesCount = savedPlacesState.ready
  ? savedPlacesState.savedPlaces.length
  : 0;
const savedPlacesValue =
  savedPlacesCount === 0 ? undefined : `${savedPlacesCount} saved`;
```

(`useSavedPlaces` uses the 2-state `useHydratedState` shape — `{ ready: false } | { ready: true; savedPlaces; home }` intersected with mutations — so `savedPlacesState.ready` is the only narrow needed; there's no `ok` branch. The `clearSavedPlacesMutation` binding is preserved verbatim so the existing sign-out flow is unchanged.)

- [ ] **Step 2: Add the count to the Saved places row**

The current Saved places row (around lines 457-461) is:

```tsx
<SettingsRow
  icon={<Bookmark size={24} color={colors.black} weight="duotone" />}
  label="Saved places"
  onPress={handleSavedPlaces}
/>
```

Replace it with:

```tsx
<SettingsRow
  icon={<Bookmark size={24} color={colors.black} weight="duotone" />}
  label="Saved places"
  value={savedPlacesValue}
  onPress={handleSavedPlaces}
/>
```

Singular form is `"1 saved"` not `"1 saved place"` — the noun is implicit from the row label and reads more naturally at small width. (No special-case needed: `"1 saved"` and `"3 saved"` both come from the single `${savedPlacesCount} saved` template, which reads correctly for both.)

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add app/menu.tsx
git commit -m "refactor(menu): add saved-places count to its row

Saved places row gains a derived count ('3 saved' / nothing when 0),
reusing the existing useSavedPlaces call (rebound to expose state
alongside the clear mutation). Other menu rows stay pure-navigation —
their sub-pages are the editors. No tap-action change.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 4: Final verification + PR

**Files:** none (verification + git)

- [ ] **Step 1: Full type-check**

Run: `npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 2: Confirm scope discipline**

```bash
git diff --name-only main...HEAD | sort
```
Expected exactly: `app/menu.tsx`, `app/safety-settings.tsx`, `components/settings/SettingsRow.tsx`.

Expected ABSENT: `app/zone-preferences.tsx` (already canonical), `components/settings/RowGroup.tsx` (no infra change).

Verify the SOS description is no longer in the `value` slot:
```bash
grep -n "Reach a trusted contact or 911" app/safety-settings.tsx
```
Expected: exactly one match, on the `RowGroup footer=` line (NOT a `value=` line). The `accessibilityHint` on the SOS row also contains the phrase — that's fine; confirm the `value="Reach a trusted contact or 911"` prop is gone.

- [ ] **Step 3: Manual smoke**

On a sim/device:
- `/safety-settings`: the SOS row reads as a clean navigation row (icon + "Emergency SOS" + chevron, no inline value text). The footer caption "Reach a trusted contact or 911." sits below the card. The Recordings row shows a count ("1 recording" / "3 recordings") if recordings exist, nothing if zero. The Trusted Contact row is unchanged.
- `/menu`: the Saved places row shows a count ("3 saved") if saved places exist, nothing if zero. All other rows unchanged.
- Tap each modified row → confirm navigation is identical to before (SOS → /emergency, Recordings → /recordings, Saved places → /saved-places).

- [ ] **Step 4: Open the PR**

```bash
git push -u origin feat/settings-value-population
gh pr create --title "refactor(settings): value-population — restore the iOS value-slot semantic" --body "$(cat <<'EOF'
Implements [the settings value-population spec](docs/superpowers/specs/2026-06-19-settings-value-population-design.md) (Design Health Program — Phase 2 Sprint 2, PR 1 of 4). Synthesis pattern: "iOS Settings Register — Value-as-Description."

## What & why

\`SettingsRow.value\` is iOS-canonical: it shows the current **state** of the setting a row owns, never a **description**. Phase 1 caught the drift on \`/safety-settings\` — the Emergency SOS row used its value slot for "Reach a trusted contact or 911" (a description) on the same screen where the Trusted Contact row used it correctly (the contact name). This PR restores the rule, documents it at the component, and populates the slot where real state exists.

## Scope (3 atomic commits, low-blast-first)

- Document the value-slot convention in the SettingsRow JSDoc (value = state; descriptions go in RowGroup.footer)
- \`safety-settings\`: SOS description → the existing RowGroup footer; Recordings row gains a derived count
- \`menu\`: Saved places row gains a derived count

Brainstorm tightened scope vs. the synthesis: \`zone-preferences\` was already canonical (no edit), and \`menu\`'s other rows are pure-navigation (their sub-pages are the editors). Real surface: 1 doc + 2 screens.

## Verification

- ✅ tsc --noEmit clean after every commit
- ✅ Scope discipline: zone-preferences + RowGroup absent from the diff; no new variants
- ✅ No behavior change to any tap action

## ⚠️ Manual smoke still owed (device/sim — reviewer's to run)

- /safety-settings: SOS row reads clean + footer carries the description; Recordings row shows count or nothing
- /menu: Saved places row shows count or nothing; other rows unchanged

First PR of Sprint 2's cheap-wins cluster.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-Review

**1. Spec coverage:**
- Convention JSDoc → Task 1. ✓
- safety-settings SOS description → footer → Task 2 Step 3. ✓
- safety-settings Recordings count → Task 2 Steps 1-3. ✓
- menu Saved places count → Task 3. ✓
- zone-preferences untouched, RowGroup untouched → asserted in Task 4 Step 2. ✓
- tsc + manual smoke → Task 4. ✓

**2. Placeholder scan.** No TBD/TODO. Every step shows actual code. Line numbers are approximate (noted "around line N") with the surrounding code shown verbatim so the implementer matches on content, not line number.

**3. Type consistency.**
- `useRecordings` returns the 3-state union (`ready` + `ok`), so the safety-settings narrow is `recordingsState.ready && recordingsState.ok` — correct (matches PR #3's `RecordingsState`).
- `useSavedPlaces` returns the 2-state union (`ready` only, no `ok`), so the menu narrow is `savedPlacesState.ready` — correct (matches PR #2's `SavedPlacesState`).
- The two count-derivation patterns are intentionally NOT identical (different hook shapes), and the plan calls out the difference explicitly in Task 3 Step 1.
- `recordingsValue` / `savedPlacesValue` are both `string | undefined`, matching `SettingsRow`'s `value?: string` prop.

**Watch item for the implementer:** menu.tsx line 113 must be REPLACED (rebind the single `useSavedPlaces()` call), not augmented with a second call — two `useSavedPlaces()` calls would mount two independent hook instances. Task 3 Step 1 states this explicitly.
