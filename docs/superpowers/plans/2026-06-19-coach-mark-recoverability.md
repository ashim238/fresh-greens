# Coach-Mark Recoverability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the map's one-time coach marks a recovery path — a menu "Map guide" that re-arms all marks and routes home, plus an en-route "?" that re-shows the side-FAB labels in the moment.

**Architecture:** Four atomic commits, low-blast-first: (1) extend `useCoachMark` with `show()` (transient re-display) + a standalone `resetCoachMarks()` (persistent global re-arm) — pure-additive; (2) menu "Map guide" row that resets + routes to `/home`; (3) en-route "?" side-FAB that calls `show()`. No new screen, no overlay redesign, no storage-key change (migration-safe). `home.tsx` is untouched — it gets recoverability for free via the global reset.

**Tech Stack:** React Native + Expo, expo-router, AsyncStorage, TypeScript. No test runner — verification is `npx tsc --noEmit` + manual device/sim smoke (project norm).

**Spec:** [`docs/superpowers/specs/2026-06-19-coach-mark-recoverability-design.md`](../specs/2026-06-19-coach-mark-recoverability-design.md)

---

## File Structure

- `hooks/useCoachMark.ts` — **modify.** Add `show()` to the hook return; add a standalone `resetCoachMarks()` export; update the JSDoc. Existing `{ visible, dismiss }` consumers unaffected.
- `app/menu.tsx` — **modify.** New "Map guide" row in the app-config RowGroup + its handler.
- `app/en-route.tsx` — **modify.** New "?" `SideFabRow` at the top of the side-FAB column.
- **Untouched (deliberate):** `app/home.tsx` (recoverability via the global reset).

### Resolved at plan-time (the spec flagged these)

- **`FloatingActionButton` `size` prop accepts `"48"`** — confirmed in `components/FloatingActionButton.tsx` (type `Size = '48' | '56'`; JSDoc reserves `"48"` for 24pt-glyph overlays). The en-route "?" uses `size="48"`.
- **`SideFabRow` renders the bare FAB when `showLabel` is false** (`if (!showLabel) return <>{children}</>`). So the "?" FAB is always visible; the "Guide" label pill only shows when `sideFabCoach.visible` (during coaching). This is the intended behavior — no conditional rendering of the "?" needed.

### Cross-PR rebase note

PR #236 (settings value-population, open, not yet merged) also edits menu's app-config RowGroup — it adds a `value` prop to the **Saved places** row. This PR adds a **Map guide** row *after* Saved places. If #236 merges first, this branch rebases onto a `main` where the Saved places row carries a `value` prop; the Map-guide insertion is still "after the Saved places row" and git will usually auto-merge the adjacent additions (or a 1-line manual resolve). The menu task below is content-anchored ("insert after the Saved places row"), so it works against either state — the implementer reads the live file.

---

## Task 0: Branch setup

**Files:** none (git only)

- [ ] **Step 1: Create the feature branch off main**

```bash
git checkout main && git pull --ff-only
git checkout -b feat/coach-mark-recoverability
```

- [ ] **Step 2: Confirm clean tsc baseline**

Run: `npx tsc --noEmit`
Expected: exits 0.

---

## Task 1: Extend useCoachMark

**Files:**
- Modify: `hooks/useCoachMark.ts`

The current file is 29 lines. Replace its entire contents with the version below — it adds `show()`, `resetCoachMarks()`, and the updated JSDoc, preserving the existing `visible`/`dismiss`/storage behavior verbatim.

- [ ] **Step 1: Rewrite `hooks/useCoachMark.ts`**

```ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

const PREFIX = '@fg:coach:';

/**
 * One-time coach mark flag backed by AsyncStorage.
 *
 * Returns:
 *   - `visible` — true until dismissed (one-shot by default: a
 *     persisted dismissal keeps subsequent mounts hidden).
 *   - `dismiss()` — hides + persists the dismissal.
 *   - `show()` — transient in-session re-display. Sets `visible` true
 *     WITHOUT touching storage, so the persisted "they've seen it"
 *     truth stays accurate. For an in-the-moment "show me again" peek.
 *
 * For a persistent global re-arm (forget all marks so they show fresh
 * on next mount), use the standalone `resetCoachMarks()` below.
 */
export function useCoachMark(key: string) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const seen = await AsyncStorage.getItem(PREFIX + key);
      if (!cancelled && seen == null) setVisible(true);
    })();
    return () => { cancelled = true; };
  }, [key]);

  const dismiss = useCallback(() => {
    setVisible(false);
    AsyncStorage.setItem(PREFIX + key, '1').catch(() => {});
  }, [key]);

  const show = useCallback(() => setVisible(true), []);

  return { visible, dismiss, show };
}

/**
 * Persistent global re-arm — clears every stored coach-mark flag so
 * each coach-marked screen shows its mark fresh on the next mount.
 * Fire-and-forget; errors swallowed (same posture as `dismiss`).
 *
 * Distinct from `show()`: `show()` is a transient in-session peek that
 * leaves the persisted seen-state intact; `resetCoachMarks()` forgets
 * the seen-state entirely.
 */
export async function resetCoachMarks(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const coachKeys = keys.filter((k) => k.startsWith(PREFIX));
    if (coachKeys.length > 0) await AsyncStorage.multiRemove(coachKeys);
  } catch {
    // best-effort — same posture as dismiss()
  }
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: exits 0. The change is purely additive to the return shape (`{ visible, dismiss }` → `{ visible, dismiss, show }`), so the home and en-route consumers — which use `mapCoach.visible` / `mapCoach.dismiss` and `sideFabCoach.visible` / `sideFabCoach.dismiss` via the whole object (not destructured) — still compile.

- [ ] **Step 3: Commit**

```bash
git add hooks/useCoachMark.ts
git commit -m "feat(coach-mark): add show() + resetCoachMarks() for recoverability

show() is a transient in-session re-display (visible=true, no storage
write — the seen-state stays accurate). resetCoachMarks() is a
persistent global re-arm (clears every @fg:coach:* key by prefix).
Pure-additive — existing { visible, dismiss } consumers (home, en-route)
unaffected. Migration-safe: no storage-key changes.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 2: Menu "Map guide" row

**Files:**
- Modify: `app/menu.tsx`

- [ ] **Step 1: Add the imports**

In `app/menu.tsx`, add the Phosphor `Question` deep-import alongside the existing Phosphor icon imports (which include `Bookmark`, `GasPump`, `Shield`, `MapPinArea`, `FileText`):

```ts
import { Question } from 'phosphor-react-native/src/icons/Question';
```

Add the `resetCoachMarks` import (menu does not currently import from `useCoachMark`, so this is a fresh import line near the other `../hooks/...` imports):

```ts
import { resetCoachMarks } from '../hooks/useCoachMark';
```

- [ ] **Step 2: Add the handler**

In the `Menu` component body (which already has `const router = useRouter();`), add the handler alongside the other `handleX` functions (e.g. near `handleSavedPlaces`):

```ts
async function handleMapGuide() {
  await resetCoachMarks();
  router.replace('/home');
}
```

- [ ] **Step 3: Add the row to the app-config RowGroup**

Find the app-config `RowGroup` — it contains the rows: Refuel reminders, Zone Preferences, Safety, Saved places. The **Saved places** row currently looks like (it may also carry a `value` prop if PR #236 has merged — match on the `label="Saved places"` row regardless):

```tsx
<SettingsRow
  icon={<Bookmark size={24} color={colors.black} weight="duotone" />}
  label="Saved places"
  onPress={handleSavedPlaces}
/>
```

Add the Map guide row immediately AFTER the Saved places row, still inside the same `RowGroup` (before its closing `</RowGroup>`):

```tsx
<SettingsRow
  icon={<Question size={24} color={colors.black} weight="duotone" />}
  label="Map guide"
  onPress={handleMapGuide}
/>
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 5: Commit**

```bash
git add app/menu.tsx
git commit -m "feat(menu): add Map guide row

A 'Map guide' row at the bottom of the app-config group re-arms the
coach marks (resetCoachMarks) and routes to /home, where the map-intro
mark re-appears immediately and the en-route mark re-arms for the next
navigation. Phosphor Question icon. No toast — the mark reappearing is
self-evident feedback.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 3: en-route "?" side-column re-entry

**Files:**
- Modify: `app/en-route.tsx`

The side-FAB column is a `<View pointerEvents="box-none">` (around line 2038) holding four `SideFabRow`s: SOS (first, ~line 2066), Safety, Report, Recenter. The en-route mark hook already exists: `const sideFabCoach = useCoachMark('en-route-side-fabs');` (line 378) — it's used as a whole object, so `sideFabCoach.show()` is available after Task 1 with no call-site change.

- [ ] **Step 1: Add the Phosphor `Question` import**

In `app/en-route.tsx`, add the deep-import alongside the existing Phosphor icon imports:

```ts
import { Question } from 'phosphor-react-native/src/icons/Question';
```

- [ ] **Step 2: Insert the "?" SideFabRow at the top of the column**

Find the SOS row — the first `SideFabRow` in the side-FAB column:

```tsx
<SideFabRow label="SOS" showLabel={sideFabCoach.visible}>
  <FloatingActionButton
    size="56"
    onPress={() => {
      Haptics.selectionAsync().catch(() => {});
      router.push('/emergency');
    }}
    accessibilityLabel="Emergency SOS"
    accessibilityHint="Opens trusted-contact and 911 options"
  >
    <SidebtnSos width={32} height={32} />
  </FloatingActionButton>
</SideFabRow>
```

Insert the Guide row IMMEDIATELY BEFORE the SOS row (it becomes the first row in the column — the auxiliary top slot, furthest from the thumb-resting Recenter at the bottom, per the column's existing ordering convention):

```tsx
<SideFabRow label="Guide" showLabel={sideFabCoach.visible}>
  <FloatingActionButton
    size="48"
    onPress={() => sideFabCoach.show()}
    accessibilityLabel="Show map controls guide"
    accessibilityHint="Re-shows the labels for these buttons"
  >
    <Question size={24} color={colors.black} weight="duotone" />
  </FloatingActionButton>
</SideFabRow>
```

Notes baked in from the plan-time reads:
- `size="48"` is valid (the `FloatingActionButton` Size type is `'48' | '56'`; 48 is the reserved 24pt-glyph size). The smaller size reads the "?" as auxiliary to the 56pt safety FABs.
- The glyph is Phosphor `Question` at 24pt — NOT `sidebtn-help.svg` (the swapped-out medical cross with the Red Cross conflict; see the en-route header comment).
- `showLabel={sideFabCoach.visible}` means the "Guide" label pill shows during the first-time coaching (surfacing the re-entry's existence) and the bare "?" FAB remains afterward (per `SideFabRow`'s `!showLabel` bare-children path).
- `colors` is already imported in en-route; no new theme import needed.

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add app/en-route.tsx
git commit -m "feat(en-route): add side-column guide re-entry

A '?' FloatingActionButton at the top of the side-FAB column (the
auxiliary slot, above SOS) calls sideFabCoach.show() to re-display the
button labels in the moment. Phosphor Question glyph at size 48 (reads
as auxiliary to the 56pt safety FABs), NOT sidebtn-help.svg (Red Cross
conflict). The label pill shows during first-time coaching; the bare
'?' remains after dismissal as the re-entry affordance.

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
Expected exactly: `app/en-route.tsx`, `app/menu.tsx`, `hooks/useCoachMark.ts`.

Expected ABSENT: `app/home.tsx` (recoverability via the global reset — no change needed).

Confirm no storage-key change (migration-safe):
```bash
grep -n "@fg:coach:" hooks/useCoachMark.ts
```
Expected: the `PREFIX` constant unchanged (`const PREFIX = '@fg:coach:';`) — the only occurrence.

- [ ] **Step 3: Manual smoke**

On a sim/device:
- **Fresh state** (clear AsyncStorage / first install): `/home` shows the map-intro coach mark; `/en-route` shows the side-FAB labels + the dismiss scrim. Dismiss both.
- **Menu re-arm:** `/menu` → tap "Map guide" → lands on `/home` → the map-intro mark re-appears. Navigate to `/en-route` → side-FAB labels show again (re-armed).
- **en-route in-moment:** on `/en-route` after the labels are dismissed → the "?" FAB is visible at the top of the column. Tap it → labels re-appear + scrim. Tap the scrim → labels hide, the bare "?" remains.
- **Layout:** the "?" doesn't crowd or overlap the SOS FAB; the column reads as a uniform stack.
- **Migration safety:** an existing user (with `@fg:coach:*` keys already set) sees no change on upgrade — marks stay dismissed until they tap "Map guide" or the "?". No mark re-triggers spuriously.

- [ ] **Step 4: Open the PR**

```bash
git push -u origin feat/coach-mark-recoverability
gh pr create --title "feat(coach-mark): recoverability — Map guide + en-route re-entry" --body "$(cat <<'EOF'
Implements [the coach-mark recoverability spec](docs/superpowers/specs/2026-06-19-coach-mark-recoverability-design.md) (Design Health Program — Phase 2 Sprint 2, PR 2 of 4). Synthesis pattern: "Coach Mark One-Shot."

## What & why

The map's coach marks (`/home` map-intro, `/en-route` side-FAB labels) were one-shot — dismissed once, gone forever, no recovery for a user who dismissed too fast or forgot the gestures. This adds two recovery paths:

- **Menu "Map guide"** — a global re-arm: `resetCoachMarks()` clears every `@fg:coach:*` key, then routes to `/home` where the mark re-appears immediately (and the en-route mark re-arms for the next navigation).
- **en-route "?"** — an in-the-moment re-display: a `?` FAB at the top of the side-FAB column calls `show()` to bring the button labels back without leaving the screen.

## Scope (3 atomic commits, low-blast-first)

- `useCoachMark`: add `show()` (transient, no storage write) + standalone `resetCoachMarks()` (persistent global clear). Pure-additive — existing `{ visible, dismiss }` consumers unaffected.
- `menu`: "Map guide" row (reset + route).
- `en-route`: "?" side-FAB (show()).

`home.tsx` is untouched — it gets recoverability for free via the global reset. Migration-safe: no storage-key changes; existing users' dismissed marks stay dismissed until they ask for them back.

## Verification

- ✅ tsc --noEmit clean after every commit
- ✅ Scope discipline: home.tsx absent from the diff; PREFIX unchanged
- ✅ FloatingActionButton size="48" confirmed valid; Phosphor Question glyph (not the Red-Cross-conflict sidebtn-help.svg)

## ⚠️ Manual smoke still owed (device/sim — reviewer's to run)

- Fresh state shows both marks; Map guide re-arms + routes home with the mark re-shown; en-route "?" re-shows labels; the "?" doesn't crowd the SOS FAB; existing users see no spurious re-trigger.

Second PR of Sprint 2's cheap-wins cluster.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-Review

**1. Spec coverage:**
- `useCoachMark` `show()` + `resetCoachMarks()` + JSDoc → Task 1. ✓
- menu "Map guide" row + handler → Task 2. ✓
- en-route "?" SideFabRow → Task 3. ✓
- `home.tsx` untouched, PREFIX unchanged (migration-safe) → asserted in Task 4 Step 2. ✓
- tsc + manual smoke (fresh / re-arm / in-moment / migration) → Task 4. ✓
- size="48" resolved (valid per the component) → Task 3 Step 2 + File Structure. ✓

**2. Placeholder scan.** No TBD/TODO. Every code step shows actual code. Line numbers are approximate and anchored on visible content (the SOS `SideFabRow`, the Saved places row) so the implementer matches on content, not line number — robust to the PR #236 rebase.

**3. Type consistency.**
- `useCoachMark` returns `{ visible, dismiss, show }` (Task 1); consumed as `sideFabCoach.show()` (Task 3) and via `resetCoachMarks()` standalone (Task 2). Names consistent.
- `FloatingActionButton size="48"` matches the component's `Size = '48' | '56'` type.
- `Question` Phosphor deep-import path (`phosphor-react-native/src/icons/Question`) is consistent across Tasks 2 and 3.

**Watch item for the implementer:** if PR #236 has merged into `main` by execution time, the Saved places row in menu.tsx will carry a `value` prop — match the Map-guide insertion on the `label="Saved places"` row regardless of whether it has a `value`. The insertion point is "the next sibling after Saved places, inside the same RowGroup."
