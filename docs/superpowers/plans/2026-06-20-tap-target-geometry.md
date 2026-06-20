# Tap-Target Painted Geometry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the two genuinely sub-44pt painted tap targets — the `/legal` tab pills (~28pt) and the `/pulled-over` "Stop recording" button (~30pt) — up to the iOS HIG 44pt painted floor.

**Architecture:** Two independent single-style edits, one per file, each its own atomic commit (low-blast-first). Each uses the local `minHeight: 44` + flex-centering pattern (NOT the `tapTarget44` square token — these are wide/asymmetric controls, and the token's own JSDoc steers them to the local pattern). Preserve all horizontal padding, radius, and color so only the painted height changes.

**Tech Stack:** React Native + Expo, TypeScript, StyleSheet API. No test runner — verification is `npx tsc --noEmit` (exit 0) plus visual inspection of the exact diff. Manual device/sim smoke is the USER's responsibility, not the implementer's.

**Spec:** [`docs/superpowers/specs/2026-06-20-tap-target-geometry-design.md`](../specs/2026-06-20-tap-target-geometry-design.md)

---

## Pre-flight: branch

This plan assumes execution starts on a fresh branch off `main`. The executor (or the subagent-driven controller) must create it before Task 1:

```bash
git checkout main && git pull --ff-only origin main
git checkout -b feat/tap-target-geometry
```

Do NOT start implementation on `main`.

## File Structure

| File | Responsibility in this PR | Style touched |
|---|---|---|
| `app/legal.tsx` | Privacy / Terms / Licenses tab-pill nav row | `styles.tab` (defined at line 370) |
| `app/pulled-over.tsx` | Guidance-phase "Stop recording" text button | `guidanceStyles.stopRecordingBtn` (defined at line 1937) |

Nothing else consumes either style (verified: each name has a single definition site and is referenced only within its own screen). The two tasks are fully independent — order is by isolation, not dependency.

**Context the implementer needs:**
- `spacing` is already imported in `app/legal.tsx` (line 19: `import { spacing } from '../theme/spacing';`). `spacing.xs` = 4, `spacing.md` = 16. No import changes are needed in either task.
- `app/pulled-over.tsx` already imports `tapTarget44` (used elsewhere for icon buttons). **Do NOT reuse it here** and do NOT remove the import — it has other consumers in the file. This fix is the wide-control local pattern.
- Why `minHeight` + centering instead of `tapTarget44` or a `paddingVertical` bump: both controls are wider than tall (a text-padded pill; an underlined text button). `tapTarget44` is `{ width: 44, height: 44, ... }` — a strict square that would crush the text width. A `paddingVertical` bump would make the height depend on label line-height (fragile). `minHeight: 44` + `justifyContent: 'center'` sets the painted height to exactly the floor regardless of line-height, centers the label, and leaves horizontal shape/color untouched.

---

### Task 1: `/legal` tab pills → 44pt painted

**Files:**
- Modify: `app/legal.tsx` (`styles.tab`, line 370–375)

**Current state (byte-exact):**

```ts
  tab: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: 999,
    backgroundColor: colors.systemGroupedBackground,
  },
```

- [ ] **Step 1: Apply the edit**

Replace the `tab` style block exactly as below. The change: remove `paddingVertical: spacing.xs`, add `minHeight: 44` + `justifyContent: 'center'` as the first two properties. `paddingHorizontal`, `borderRadius`, and `backgroundColor` are unchanged.

```ts
  tab: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: 999,
    backgroundColor: colors.systemGroupedBackground,
  },
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: exit code 0, no errors. (`ViewStyle` accepts `minHeight` and `justifyContent`; `paddingVertical` removal introduces no type issue.)

- [ ] **Step 3: Inspect the diff**

Run: `git diff app/legal.tsx`
Expected: exactly one hunk inside `styles.tab` — one line removed (`paddingVertical: spacing.xs,`), two lines added (`minHeight: 44,` and `justifyContent: 'center',`). No other lines in the file change. `paddingHorizontal: spacing.md`, `borderRadius: 999`, and `backgroundColor: colors.systemGroupedBackground` must still be present.

- [ ] **Step 4: Commit**

```bash
git add app/legal.tsx
git commit -m "fix(legal): tab pills clear 44pt painted tap-target

Privacy / Terms / Licenses pills were ~28pt painted (paddingVertical:
spacing.xs + subheadlineEmphasized). Replace the vertical padding with
minHeight: 44 + justifyContent: center so the painted height meets the
iOS HIG floor while the pill's horizontal shape and color are unchanged.
Local minHeight pattern, not tapTarget44 (square-only, per its JSDoc).

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: `/pulled-over` stop-recording button → 44pt painted

**Files:**
- Modify: `app/pulled-over.tsx` (`guidanceStyles.stopRecordingBtn`, line 1937–1940)

**Current state (byte-exact):**

```ts
  stopRecordingBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
```

- [ ] **Step 1: Apply the edit**

Replace the `stopRecordingBtn` style block exactly as below. The change: remove `paddingVertical: 6`, add `minHeight: 44` + `justifyContent: 'center'` + `alignItems: 'center'`. `paddingHorizontal: 12` is unchanged. Do not touch the `tapTarget44` import or `stopRecordingText` (the adjacent style).

```ts
  stopRecordingBtn: {
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: exit code 0, no errors.

- [ ] **Step 3: Inspect the diff**

Run: `git diff app/pulled-over.tsx`
Expected: exactly one hunk inside `guidanceStyles.stopRecordingBtn` — one line removed (`paddingVertical: 6,`), three lines added (`minHeight: 44,`, `justifyContent: 'center',`, `alignItems: 'center',`). `paddingHorizontal: 12` must still be present. No other lines in the file change — in particular the `tapTarget44` import and `stopRecordingText` style are untouched.

- [ ] **Step 4: Commit**

```bash
git add app/pulled-over.tsx
git commit -m "fix(pulled-over): stop-recording button clears 44pt painted

The guidance-phase Stop recording button was ~30pt painted
(paddingVertical: 6 + footnoteRegular). Replace the vertical padding
with minHeight: 44 + flex centering so the painted target meets the
iOS HIG floor — a real usability gain on a safety screen. Horizontal
padding preserved; local minHeight pattern, not tapTarget44.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Final verification + PR

**Files:** none modified (verification + PR only)

- [ ] **Step 1: Full type-check**

Run: `npx tsc --noEmit`
Expected: exit code 0, no errors.

- [ ] **Step 2: Confirm the diff is exactly two files**

Run: `git diff --stat main`
Expected: exactly two files changed — `app/legal.tsx` and `app/pulled-over.tsx`. No other files. The net line delta is small (each file: −1 / +2 or +3).

- [ ] **Step 3: Confirm no forbidden changes crept in**

Run: `git diff main -- components/Button.tsx components/settings/SettingsRow.tsx components/SearchBar.tsx app/permissions.tsx app/home.tsx components/DragHandle.tsx theme/interaction.ts`
Expected: empty output (these files were verified compliant/misflagged in the spec and must NOT change). Also confirm no new shared token was added and `.cursorrules` is unchanged:
Run: `git diff main -- .cursorrules`
Expected: empty output.

- [ ] **Step 4: Push and open the PR**

```bash
git push -u origin feat/tap-target-geometry
gh pr create --title "fix(tap-target): legal tabs + pulled-over stop button clear 44pt painted" --body "$(cat <<'EOF'
## Sprint 2 PR 3 (synthesis PR 4) — tap-target painted geometry

Brings the two genuinely sub-44pt **painted** tap targets up to the iOS HIG 44pt floor.

| Fix | Was | Now |
|---|---|---|
| `app/legal.tsx` Privacy/Terms/Licenses tab pills | ~28pt (`paddingVertical: spacing.xs` + subheadline) | `minHeight: 44` + centered |
| `app/pulled-over.tsx` "Stop recording" button | ~30pt (`paddingVertical: 6` + footnote) | `minHeight: 44` + centered |

Both use the local `minHeight: 44` pattern, not `tapTarget44` — these are wide/asymmetric controls and the token's own JSDoc steers them to the local pattern. Horizontal padding, radius, and color are preserved; only painted height changes.

### Why only 2 fixes (synthesis listed 7)
The Phase 1 synthesis prescribed 2 component-level fixes + 5 screen violations. Reading the actual current geometry collapsed it to 2 real fixes — the rest were already compliant or misflagged (verified in the spec):
- **Button transparent** — base already `height: 44`; only 2 transparent uses, both inherit it. No-op.
- **SettingsRow tab pill** — `segmented` is interface-only (renders nothing); own `minHeight` is 52. No-op.
- **search Clear** — `SearchBar`'s `iconWrap` is already 44×44.
- **permissions recovery** — `settingsLinkRow` `paddingVertical: 16` ≈ 50pt.
- **home drag handle** — a 32×4 decorative grabber; the drag area is the sheet `PanResponder`, not the bar. Not a tap target.

### Verification
- `npx tsc --noEmit` clean.
- Diff is exactly two files.
- Manual smoke (reviewer/owner): on `/legal` the three tab pills are comfortably tappable (~44pt tall, unchanged width/color); on `/pulled-over` guidance phase the "Stop recording" button is comfortably tappable (unchanged label size + horizontal extent).

Spec: `docs/superpowers/specs/2026-06-20-tap-target-geometry-design.md`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: PR created; URL printed. Report the PR number/URL back to the controller.

---

## Self-Review

**1. Spec coverage:**
- Spec Fix 1 (legal tabs) → Task 1. ✓
- Spec Fix 2 (pulled-over stop button) → Task 2. ✓
- Spec "out of scope / verified compliant" (Button, SettingsRow, SearchBar, permissions, home/DragHandle, no new token, no `.cursorrules` edit) → Task 3 Step 3 guards all of these. ✓
- Spec "Verification (definition of done)" checklist → covered: tsc (Task 1/2 Step 2, Task 3 Step 1); `paddingVertical` removals (Task 1 Step 1, Task 2 Step 1); `paddingHorizontal` preserved (diff-inspection steps); not-`tapTarget44` (design note + Task 2 caution); exactly two files (Task 3 Step 2). ✓
- Spec sequencing (low-blast-first, two commits + verify/PR) → Tasks 1, 2, 3. ✓

**2. Placeholder scan:** No TBD/TODO/"handle edge cases"/vague steps. Every code step shows exact before/after. ✓

**3. Type/name consistency:** Style names (`tab`, `stopRecordingBtn`), property names (`minHeight`, `justifyContent`, `alignItems`, `paddingHorizontal`), and the `spacing.md` token are used identically across tasks and match the verified source. ✓

No gaps found.
