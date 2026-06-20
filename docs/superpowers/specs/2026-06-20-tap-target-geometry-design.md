# Tap-Target Painted Geometry — Design Spec

**Date:** 2026-06-20
**Status:** Approved (brainstorm complete; awaiting plan)
**Sprint:** Design Health Program — Phase 2 Sprint 2, PR 3 of 4
**Sprint plan:** [`docs/superpowers/specs/2026-06-19-design-health-sprint-2-plan.md`](2026-06-19-design-health-sprint-2-plan.md)
**Synthesis source:** [`phase-1-findings/2026-06-19-cross-screen-synthesis.md`](phase-1-findings/2026-06-19-cross-screen-synthesis.md) Section 4, "Tap-Target Painted Geometry"

---

## Goal

Bring every genuinely sub-44pt **painted** tap target up to the iOS HIG 44pt floor. The `.cursorrules` cardinal rule: "iOS HIG 44×44 pt minimum on both axes — on the visual, not just the hit area." Reaching 44pt via `hitSlop` on a sub-44 visual is forbidden; the painted dimension itself must clear the floor.

## What the enumeration found

The Phase 1 synthesis prescribed two component-level fixes plus five screen-level violations — seven items, flagged MEDIUM with a "codebase-wide Button blast" risk note. Reading the actual current geometry collapsed that to **two real fixes**. The synthesis was a point-in-time estimate; intervening polish passes (notably the audit-10 `tapTarget44` migration sweep, 2026-06-04) had already closed most of it.

This section is part of the spec on purpose: it records that the excluded items were **checked and found compliant**, not skipped.

| Synthesis item | Current geometry (verified) | Verdict |
|---|---|---|
| `Button` transparent → `minHeight: 44` | `Button` base style already `height: 44` ("HIG floor", per its own comment). Only **2** `fill="transparent"` call-sites exist (`app/trusted-contact-setup.tsx:297`, `app/onboarding.tsx:333`), both inheriting the 44pt base. | **No-op** — no change; no codebase-wide blast |
| `SettingsRow` tab pill → 44 | `SettingsRow`'s `'segmented'` trailing is interface-only ("renders as 'none', no pill" per its JSDoc). No production tab pill exists. `SettingsRow`'s own `minHeight` is 52. | **No-op** — the control doesn't exist |
| **`legal.tsx` tab pills** (P0, ~28pt) | `styles.tab`: `paddingVertical: spacing.xs` (4pt) + `subheadlineEmphasized` (15pt, ~20pt line) ≈ **28pt painted** | ✅ **REAL — fix** |
| `search.tsx` Clear | `SearchBar`'s `PressableIcon` wraps the glyph in `iconWrap` = **44×44** | Already compliant — exclude |
| `permissions.tsx` recovery | `settingsLinkRow`: `paddingVertical: 16` + `footnoteRegular` (~18pt) ≈ **50pt** | Already compliant — exclude |
| **`pulled-over.tsx` stop-recording** | `guidanceStyles.stopRecordingBtn`: `paddingVertical: 6` + `footnoteRegular` (~18pt) ≈ **30pt painted** | ✅ **REAL — fix** |
| `home.tsx` drag handle | `DragHandle` is a `32×4` decorative grabber. The drag interaction is the bottom-sheet `PanResponder` over the whole sheet header, not the bar. | Misflag — a grabber is not a tap target; forcing it to 44×44 would be wrong. Exclude |

**Result: 7 prescribed → 2 real fixes.** This is a SMALL PR, not MEDIUM.

## Scope

**2 styles, 2 files, 2 atomic commits.**

| File | Change | Commit |
|---|---|---|
| `app/legal.tsx` | `styles.tab` — replace `paddingVertical: spacing.xs` with `minHeight: 44` + `justifyContent: 'center'` | 1 |
| `app/pulled-over.tsx` | `guidanceStyles.stopRecordingBtn` — add `minHeight: 44` + `justifyContent: 'center'` + `alignItems: 'center'` | 2 |

**Out of scope (deliberate):**
- No `Button` change (base already clears 44; only 2 transparent uses, both compliant).
- No `SettingsRow` change (`segmented` renders nothing; `minHeight: 52` already clears 44).
- No `SearchBar`, `permissions`, or `home` change (all verified compliant or misflagged above).
- No new shared token. Both fixes are wide/asymmetric controls (a text-padded pill, a text button), not 44×44 squares — so `tapTarget44` is the **wrong** tool. Its own JSDoc says: "For a wider/asymmetric target (e.g. a text-link with `minHeight: 44` + `paddingHorizontal`), define it locally — this token is the strict 44×44 square only." These fixes follow that documented local pattern.
- No copy, no redesign, no `.cursorrules`/docs edit (the rule and the local-minHeight pattern are already documented at their sources).

---

## Design

### Why `minHeight` + center, not `paddingVertical` or `tapTarget44`

The two controls are **wider than they are tall** — a pill with horizontal padding and a background, and an underlined text button. Three candidate mechanisms:

- **`tapTarget44`** (`{ width: 44, height: 44, ... }`) — a strict square. Would force `width: 44`, crushing the pill/button text. **Wrong** — and its JSDoc explicitly steers wide/asymmetric controls to the local pattern instead.
- **Bump `paddingVertical`** — works, but the resulting height depends on the label's line-height (fragile if typography changes) and leaves a redundant `paddingVertical` alongside the real intent.
- **`minHeight: 44` + `justifyContent: 'center'`** (chosen) — sets the painted height to exactly the floor regardless of line-height, centers the label, preserves `paddingHorizontal` and the pill/button appearance. Predictable and self-documenting.

### Fix 1 — `app/legal.tsx` tab pills

The Privacy / Terms / Licenses pills are the page's primary navigation. Currently ~28pt painted (cramped, reads as caption-tier).

```ts
// styles.tab — before:
tab: {
  paddingVertical: spacing.xs,        // 4pt → ~28pt painted total
  paddingHorizontal: spacing.md,
  borderRadius: 999,
  backgroundColor: colors.systemGroupedBackground,
},
// styles.tab — after:
tab: {
  minHeight: 44,                      // painted floor (HIG)
  justifyContent: 'center',           // vertically center the label
  paddingHorizontal: spacing.md,      // horizontal padding preserved
  borderRadius: 999,
  backgroundColor: colors.systemGroupedBackground,
},
```

`paddingVertical: spacing.xs` is **removed** — `minHeight` + `justifyContent` now set the height; keeping the old 4pt padding would be redundant and confusing. The freshgreen active pill grows from ~28pt to 44pt tall — within normal iOS segmented-control range, and it stops reading as auxiliary metadata. `paddingHorizontal`, `borderRadius`, and both background colors are untouched, so the pill's horizontal shape and color are unchanged.

### Fix 2 — `app/pulled-over.tsx` stop-recording button

The "Stop recording" text button in the guidance phase. Currently ~30pt painted. On a safety screen, a larger stop target is a genuine usability improvement, not just nominal compliance.

```ts
// guidanceStyles.stopRecordingBtn — before:
stopRecordingBtn: {
  paddingVertical: 6,                 // → ~30pt painted total
  paddingHorizontal: 12,
},
// guidanceStyles.stopRecordingBtn — after:
stopRecordingBtn: {
  minHeight: 44,
  justifyContent: 'center',
  alignItems: 'center',
  paddingHorizontal: 12,
},
```

`paddingVertical: 6` is **removed** for the same reason as Fix 1. The underlined `footnoteRegular` label keeps its size; it just gains vertical breathing room inside the 44pt target. `paddingHorizontal: 12` is preserved. Note: `pulled-over.tsx` already imports `tapTarget44` (used for the screen's icon buttons) — that import is **not** reused here; this is the wide-control local pattern, and the import stays as-is for its existing consumers.

---

## Testing

- **`tsc --noEmit`** clean after each commit.
- **Manual smoke (user's responsibility):**
  - `/legal` — tap each of Privacy / Terms / Licenses. The pills are now comfortably tappable (~44pt tall), labels vertically centered, pill width/color unchanged, no overlap in the tab row.
  - `/pulled-over` guidance phase — the "Stop recording" button is comfortably tappable; underlined label unchanged in size; horizontal extent unchanged; no layout shift in the surrounding column.
  - No regression elsewhere — both changes are local to a single style each; nothing else consumes `styles.tab` or `guidanceStyles.stopRecordingBtn`.

---

## Files

- **Modify:** `app/legal.tsx` (`styles.tab`)
- **Modify:** `app/pulled-over.tsx` (`guidanceStyles.stopRecordingBtn`)
- **Untouched (deliberate, verified compliant):** `components/Button.tsx`, `components/settings/SettingsRow.tsx`, `components/SearchBar.tsx`, `app/permissions.tsx`, `app/home.tsx` / `components/DragHandle.tsx`

## Verification (definition of done)

- [ ] `tsc --noEmit` passes after each commit
- [ ] `legal.tsx` `styles.tab` painted height ≥ 44pt; `paddingVertical: spacing.xs` removed; `paddingHorizontal`/`borderRadius`/backgrounds unchanged
- [ ] `pulled-over.tsx` `stopRecordingBtn` painted height ≥ 44pt; `paddingVertical: 6` removed; `paddingHorizontal: 12` preserved
- [ ] Neither fix uses `tapTarget44` (wide/asymmetric controls → local `minHeight` pattern, per the token's JSDoc)
- [ ] No change to `Button`, `SettingsRow`, `SearchBar`, `permissions`, `home`, `DragHandle`
- [ ] No new token, no `.cursorrules`/docs edit
- [ ] Diff is exactly two files

## Sequencing

PR 3 of Sprint 2's 4-PR cluster. Within it, low-blast-first (both fixes are fully independent — order is by isolation, not dependency):

1. **`fix(legal): tab pills clear 44pt painted tap-target`** — `app/legal.tsx` `styles.tab` only.
2. **`fix(pulled-over): stop-recording button clears 44pt painted`** — `app/pulled-over.tsx` `stopRecordingBtn` only.
3. **verify + PR.**

PR 3 closes when these merge. PR 10 (reserved-color audit) — the Sprint 2 closer — brainstorms when PR 3 enters execute/review (pipelined cadence).
