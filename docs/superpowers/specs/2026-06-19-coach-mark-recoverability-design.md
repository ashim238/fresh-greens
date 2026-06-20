# Coach-Mark Recoverability — Design Spec

**Date:** 2026-06-19
**Status:** Approved (brainstorm complete; awaiting plan)
**Sprint:** Design Health Program — Phase 2 Sprint 2, PR 2 of 4
**Sprint plan:** [`docs/superpowers/specs/2026-06-19-design-health-sprint-2-plan.md`](2026-06-19-design-health-sprint-2-plan.md)
**Synthesis source:** [`phase-1-findings/2026-06-19-cross-screen-synthesis.md`](phase-1-findings/2026-06-19-cross-screen-synthesis.md) Section 4, "Coach Mark One-Shot"

---

## Goal

Give the map's one-time coach marks a recovery path. Today a user who dismisses them once — or returns weeks later having forgotten the gestures — has no way to bring them back. Add a global re-arm (menu "Map guide") and an in-the-moment re-display (en-route side-column "?").

## The bug being fixed

Phase 1 critique flagged the coach marks on `/home` (`home-map-intro`) and `/en-route` (`en-route-side-fabs`) as one-shot: shown once, dismissed forever, no recovery. The `useCoachMark` hook persists a per-key seen-flag in AsyncStorage (`@fg:coach:<key>`); once set, the mark never shows again. The synthesis prescribed: extend `useCoachMark` with a reset path + a discoverable menu entry + an en-route re-display trigger.

## How coach marks work today (verified)

- `hooks/useCoachMark.ts` — `useCoachMark(key)` returns `{ visible, dismiss }`. On mount, reads `@fg:coach:<key>`; if unset, `visible = true`. `dismiss()` sets `visible = false` and persists `'1'`. Per-key, prefix-namespaced.
- Two marks exist: `home-map-intro` (home, line 826) and `en-route-side-fabs` (en-route, line 378).
- The en-route mark drives the **side-FAB label pills**: the column of FABs (SOS / Safety / Report / Recenter) shows text labels when `sideFabCoach.visible`, plus a full-screen tap-to-dismiss scrim. "Re-showing" the en-route mark = re-showing those labels.

## Scope

**1 hook + 2 screens + 4 atomic commits.**

| File | Change | Commit |
|---|---|---|
| `hooks/useCoachMark.ts` | Add `show()` to the return; add standalone `resetCoachMarks()` export; document the recoverable contract | 1 |
| `app/menu.tsx` | New "Map guide" row in the app-config RowGroup + handler (reset + navigate) | 2 |
| `app/en-route.tsx` | New 5th `SideFabRow` ("?") at the top of the side-FAB column | 3 |

**Out of scope (deliberate):**
- No new standalone guide screen (that's a feature, not a recoverability fix)
- No coach-mark overlay redesign
- No storage-key changes (migration-safe — existing seen-flags keep working)
- `app/home.tsx` untouched — the `home-map-intro` mark gets recoverability for free via the global reset (its existing mount-time read re-fires after `router.replace('/home')`)

---

## Design

### Hook extension — `hooks/useCoachMark.ts`

Two additions, both built on the existing `@fg:coach:` prefix. The existing `{ visible, dismiss }` API and all current consumers are unaffected.

**`show()` — added to the hook return.** A transient, in-session re-display: sets `visible = true` without touching storage, so the persisted "they've seen it" truth stays accurate. For the en-route in-the-moment peek.

```ts
const show = useCallback(() => setVisible(true), []);
return { visible, dismiss, show };
```

**`resetCoachMarks()` — standalone module export.** A persistent global re-arm: enumerates every `@fg:coach:*` key and clears them, so the next mount of any coach-marked screen shows the mark fresh. Fire-and-forget (errors swallowed, same posture as `dismiss`).

```ts
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

**The two grains are distinct by design:**
- `show()` = "peek now, still counts as seen" (transient, no storage write)
- `resetCoachMarks()` = "forget I saw any of them, re-arm fresh" (persistent global clear)

**JSDoc** updated to document the one-shot-vs-recoverable contract — the hook is one-shot by default (persisted dismissal), recoverable via `show()` (transient) or `resetCoachMarks()` (persistent).

### Menu "Map guide" row — `app/menu.tsx`

A new `SettingsRow` at the **bottom** of the app-config `RowGroup` (Refuel reminders / Zone Preferences / Safety / Saved places). Phosphor `Question` icon (per the Phosphor-only icon rule), label "Map guide", default chevron.

```tsx
// add to imports (Phosphor deep-import per CLAUDE.md icon rule):
import { Question } from 'phosphor-react-native/src/icons/Question';
// add resetCoachMarks to the useCoachMark import:
import { resetCoachMarks } from '../hooks/useCoachMark';
```

```tsx
// new row at the bottom of the app-config RowGroup, after "Saved places":
<SettingsRow
  icon={<Question size={24} color={colors.black} weight="duotone" />}
  label="Map guide"
  onPress={handleMapGuide}
/>
```

```ts
// handler in the component body:
async function handleMapGuide() {
  await resetCoachMarks();
  router.replace('/home');
}
```

Tap → global re-arm → land on `/home` → the `home-map-intro` mark re-appears immediately (its mount-time read sees the cleared flag); `en-route-side-fabs` re-arms for the next navigation. Self-evident feedback (the mark shows up); no toast — Steady Companion stays quiet.

### en-route "?" affordance — `app/en-route.tsx`

A 5th `SideFabRow` at the **top** of the side-FAB column (above SOS — the auxiliary slot the column's existing comment reserves: "auxiliary at top, furthest from the thumb-resting Recenter at the bottom"). Rendered **always-present** (no conditional → no layout shift). Phosphor `Question` glyph (NOT `sidebtn-help.svg` — that asset is the swapped-out medical cross with the Red Cross conflict, see the en-route header comment + `/emergency`).

```tsx
// add to imports (Phosphor deep-import):
import { Question } from 'phosphor-react-native/src/icons/Question';
```

```tsx
// new SideFabRow at the TOP of the column, BEFORE the SOS row:
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

**Interaction coherence with the existing dismiss-scrim:**
- When `sideFabCoach.visible` (first visit or just-re-shown): labels show + the full-screen scrim is on top catching taps. The "?" isn't needed then (and isn't reachable — the scrim intercepts).
- After dismiss: scrim gone, labels hidden, "?" tappable → `sideFabCoach.show()` → labels return + scrim re-arms.

The "?" sits visually separated above the safety cluster, so there's no fat-finger risk on SOS.

**Size caveat for the plan:** `FloatingActionButton` is used at `size="56"` elsewhere in this column. The plan must verify `FloatingActionButton`'s `size` prop accepts `"48"`. If it does not, the "?" uses `size="56"` to match the column uniformly (the top placement + Question glyph already distinguish it as auxiliary; matching size is an acceptable fallback). Determine the actual supported sizes when writing the plan.

---

## Testing

- **`tsc --noEmit`** clean after every commit.
- **Manual smoke:**
  - Fresh state (clear AsyncStorage or first install): `/home` shows the map-intro mark; `/en-route` shows the side-FAB labels + scrim. Dismiss both.
  - `/menu` → tap "Map guide" → lands on `/home` → map-intro mark re-appears. Navigate to `/en-route` → side-FAB labels show again (re-armed).
  - On `/en-route` after dismissing the labels: the "?" FAB is visible at the top of the column. Tap it → labels re-appear + scrim. Tap scrim → labels hide, "?" remains.
  - Confirm the "?" doesn't crowd or overlap the SOS FAB; the column reads as a uniform stack.
- **Migration safety:** an existing user (who has `@fg:coach:*` keys set) sees no change on upgrade — the marks stay dismissed until they tap "Map guide" or the "?". No mark re-triggers spuriously.

---

## Files

- **Modify:** `hooks/useCoachMark.ts` (add `show()`, `resetCoachMarks()`, JSDoc)
- **Modify:** `app/menu.tsx` (new "Map guide" row + handler)
- **Modify:** `app/en-route.tsx` (new "?" SideFabRow)
- **Untouched (deliberate):** `app/home.tsx` (recoverability via global reset, no change needed)

## Verification (definition of done)

- [ ] `tsc --noEmit` passes with no errors after each commit
- [ ] `useCoachMark` returns `{ visible, dismiss, show }`; existing `{ visible, dismiss }` consumers (home, en-route) still compile and behave identically
- [ ] `resetCoachMarks()` is exported, clears all `@fg:coach:*` keys, swallows errors
- [ ] menu "Map guide" row: resets + `router.replace('/home')`; lands on home with the mark re-shown
- [ ] en-route "?" SideFabRow at the top of the column, calls `sideFabCoach.show()`, uses Phosphor `Question` (not sidebtn-help.svg)
- [ ] No storage-key changes; existing seen-flags unaffected (migration-safe)
- [ ] `app/home.tsx` not in the diff (confirms it needs no change)
- [ ] No new guide screen, no overlay redesign

## Sequencing

PR 2 of Sprint 2's 4-PR cluster. Within it, low-blast-first:

1. **`feat(coach-mark): add show() + resetCoachMarks() for recoverability`** — `hooks/useCoachMark.ts` only. Pure-additive; existing consumers unaffected.
2. **`feat(menu): add Map guide row`** — menu.tsx: new row + handler (consumes `resetCoachMarks`).
3. **`feat(en-route): add side-column guide re-entry`** — en-route.tsx: the 5th SideFabRow (consumes `show()`).
4. **verify + PR.**

PR 2 closes when these merge. PR 4 (tap-target geometry) brainstorm starts when PR 2 enters execute/review (pipelined cadence).
