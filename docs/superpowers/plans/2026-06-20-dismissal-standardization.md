# Dismissal Standardization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Conform the one divergent dismissal affordance — `RouteComparisonSheet`'s `hitSlop`-padded sub-44pt close X — to the content-sheet `tapTarget44` pattern, and codify the now-uniform dismissal convention in `.cursorrules`.

**Architecture:** Two atomic commits. Commit 1 is the one real UI fix (a close button grows from ~24pt painted to 44pt painted; same glyph, same position). Commit 2 is a `.cursorrules` prose rule. The audit found every other surface already compliant or intentionally no-X.

**Tech Stack:** React Native + Expo, TypeScript, StyleSheet; `theme/interaction.ts` `tapTarget44` (44×44) + `pressedDim`; Phosphor icons. No test runner — verification is `npx tsc --noEmit` (exit 0) + diff inspection + one manual smoke (the route-comparison sheet).

**Spec:** [`docs/superpowers/specs/2026-06-20-dismissal-standardization-design.md`](../specs/2026-06-20-dismissal-standardization-design.md)

---

## Pre-flight: branch

```bash
git checkout main && git pull --ff-only origin main
git checkout -b feat/dismissal-standardization
```

Do NOT implement on `main`.

## File Structure

| File | Responsibility | What changes |
|---|---|---|
| `components/RouteComparisonSheet.tsx` | Route-comparison bottom-sheet | Close-X Pressable → `tapTarget44` + `pressedDim`, drop `hitSlop`; add `tapTarget44` to the existing interaction import |
| `.cursorrules` | Cardinal rulebook | New `## Dismissal` section after `## Tap targets` |

**Context the implementer needs:**
- `RouteComparisonSheet.tsx` already imports `pressedDim` from `../theme/interaction` (line 15) but NOT `tapTarget44`. Add `tapTarget44` to that existing import line — do not add a second import statement.
- `tapTarget44` is `{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }` — a 44×44 square that centers the 24pt glyph. This is the correct token here (the close X IS a ~square icon button, unlike the wide pills in PR 4).
- The `X` glyph itself does not change (`size={24}`, `colors.labelSecondary`, `weight="regular"`). Only the Pressable wrapping it changes.

---

### Task 1: fix `RouteComparisonSheet` close-X tap target

**Files:**
- Modify: `components/RouteComparisonSheet.tsx` (import line ~15; close Pressable ~lines 64–66)

**Current state (byte-exact):**

Import (line 15):
```ts
import { pressedDim } from '../theme/interaction';
```

Close button (lines 64–66):
```tsx
              <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" hitSlop={12}>
                <X size={24} color={colors.labelSecondary} weight="regular" />
              </Pressable>
```

- [ ] **Step 1: Add `tapTarget44` to the interaction import**

Change line 15 to:
```ts
import { pressedDim, tapTarget44 } from '../theme/interaction';
```

- [ ] **Step 2: Wrap the close X in `tapTarget44` + `pressedDim`, drop `hitSlop`**

Replace the close Pressable (lines 64–66) with:
```tsx
              <Pressable
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Close"
                style={({ pressed }) => [tapTarget44, pressed && pressedDim]}
              >
                <X size={24} color={colors.labelSecondary} weight="regular" />
              </Pressable>
```

The `hitSlop={12}` is removed (the 44pt painted target replaces it as the compliance mechanism). The `X` child is unchanged.

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0, no errors.

- [ ] **Step 4: Confirm hitSlop is gone and the glyph is intact**

Run: `rg "hitSlop|tapTarget44|X size=" components/RouteComparisonSheet.tsx`
Expected: `tapTarget44` appears (import + the style array); no `hitSlop` remains; `X size={24} color={colors.labelSecondary} weight="regular"` is unchanged.

- [ ] **Step 5: Inspect the diff**

Run: `git diff components/RouteComparisonSheet.tsx`
Expected: import line gains `, tapTarget44`; the close Pressable gains `style={({ pressed }) => [tapTarget44, pressed && pressedDim]}` and loses `hitSlop={12}`. The `<X .../>` line and everything else unchanged.

- [ ] **Step 6: Commit**

```bash
git add components/RouteComparisonSheet.tsx
git commit -m "fix(route-comparison): close-X clears 44pt painted (tapTarget44)

The route-comparison sheet's close X was a bare 24pt glyph padded to a
hittable size with hitSlop={12} — sub-44pt painted, the anti-pattern the
tap-target rule forbids. Wrap it in tapTarget44 (44pt painted) + pressedDim,
matching CalendarPickSheet / FuelStopsSheet (the content-sheet close
pattern). Same glyph, same top-right position; only the painted/tappable
box grows.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: `.cursorrules` — add the Dismissal convention

**Files:**
- Modify: `.cursorrules` (insert a new `## Dismissal` section after the `## Tap targets` section at line ~62 and before `## Code conventions` at line ~67)

- [ ] **Step 1: Locate the insertion point**

Run: `grep -nE "^## (Tap targets|Code conventions)" .cursorrules`
The new section goes between them: after the last line of `## Tap targets`, with one blank line before and after.

- [ ] **Step 2: Insert the Dismissal section**

After the final line of `## Tap targets` (the `hitSlop` paragraph) and its blank line, insert (followed by a blank line before `## Code conventions`):

```markdown
## Dismissal
Sheets and overlay cards dismiss via three affordances together: the `DragHandle` (swipe-down), scrim-tap, and a top-right close `X` (Phosphor `X`, `labelSecondary`) in a **≥44pt painted target** — `tapTarget44` on content sheets, or the 48pt `FloatingActionButton` on map-overlay cards (both compliant; pick the one matching the surface's register). The close `X` must clear 44pt painted per the tap-target rule — never `hitSlop` on a bare glyph.

Full-screen modals **may omit** the explicit `X` when dismissal is unambiguous via nav-back or scrim-tap. Sanctioned no-X surfaces: `LiveSafetySheet`, `LifelineModal`, `trip-summary` (nav-back), `HomeBrowseSheet` (swipe/scroll). Don't add close chrome to these — their minimalism is deliberate.
```

- [ ] **Step 3: Inspect the diff**

Run: `git diff .cursorrules`
Expected: one new `## Dismissal` section inserted between `## Tap targets` and `## Code conventions`. No existing line changes.

- [ ] **Step 4: Commit**

```bash
git add .cursorrules
git commit -m "docs(cursorrules): codify the dismissal convention + sanctioned no-X modals

Document the now-uniform pattern (sheets/cards: DragHandle + scrim + a
top-right X in a >=44pt painted target; full-screen modals may omit the X
when nav-back/scrim suffices). Lists the four sanctioned no-X surfaces so
nobody 'fixes' their deliberate minimalism. Prose-only.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Final verification + PR

**Files:** none modified (verification + PR only)

- [ ] **Step 1: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0, no errors.

- [ ] **Step 2: Confirm the diff is exactly two files**

Run: `git diff main --stat`
Expected: `components/RouteComparisonSheet.tsx` and `.cursorrules`. No other files.

- [ ] **Step 3: Confirm no other component changed (no handler renames, no other sheets touched)**

Run: `git diff main --name-only -- 'components/*.tsx' 'app/*.tsx'`
Expected: only `components/RouteComparisonSheet.tsx`. If any other component/screen appears, that's scope creep — investigate.

- [ ] **Step 4: Push and open the PR**

```bash
git push -u origin feat/dismissal-standardization
gh pr create --title "fix(dismissal): route-comparison close-X clears 44pt + codify dismissal convention" --body "$(cat <<'EOF'
## Sprint 3 PR 2/3 (PR 9) — dismissal standardization

**Audit finding:** dismissal is already uniform where it counts — every explicit close is an **X, top-right, with scrim-tap dismissal**. One surface diverged, and the convention was undocumented.

| Change | What |
|---|---|
| `RouteComparisonSheet` close-X | Was `hitSlop={12}` on a bare 24pt glyph (sub-44pt painted — the tap-target anti-pattern). Now `tapTarget44` + `pressedDim`, matching the other content sheets. Same glyph, same position; only the painted/tappable box grows. |
| `.cursorrules` `## Dismissal` (new) | Codifies the pattern (DragHandle + scrim + top-right X in a ≥44pt painted target) and lists the 4 sanctioned no-X modals (`LiveSafetySheet`, `LifelineModal`, `trip-summary`, `HomeBrowseSheet`). |

### Scope
- **One real fix** — the audit (full matrix in the spec) found every other surface already compliant (`tapTarget44` content sheets, 48pt-FAB map-overlay cards) or intentionally no-X.
- **Out:** handler-name churn (`onClose`/`onDismiss`/`onRequestClose` — invisible to users); forcing FAB↔tapTarget44 uniformity (both compliant, both fit their register).

### Verification
- `npx tsc --noEmit` clean.
- Diff is two files; only `RouteComparisonSheet.tsx` among components.
- Smoke: open the route-comparison sheet, confirm the top-right X is comfortably tappable (~44pt), same position, still dismisses via X / scrim / back.

Spec: `docs/superpowers/specs/2026-06-20-dismissal-standardization-design.md`
Plan: `docs/superpowers/plans/2026-06-20-dismissal-standardization.md`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: PR created; URL printed. Report it back.

---

## Self-Review

**1. Spec coverage:**
- Spec "Commit 1 — fix RouteComparisonSheet close-X" → Task 1 (exact before/after + import handling). ✓
- Spec "Commit 2 — .cursorrules Dismissal convention" → Task 2 (wording verbatim). ✓
- Spec "Out of scope" (no handler renames, no FAB↔tapTarget44 unify, no other surfaces) → Task 3 Steps 2–3 guard it. ✓
- Spec "Verification (definition of done)" → tsc (Task 1 Step 3, Task 3 Step 1); hitSlop gone + glyph intact (Task 1 Step 4); Dismissal section (Task 2); two-files-only (Task 3 Step 2). ✓

**2. Placeholder scan:** No TBD/vague steps; exact code + rule text given. ✓

**3. Consistency:** `tapTarget44` / `pressedDim` import + style-array usage match the verified source (pressedDim already imported; only tapTarget44 added). Glyph attributes (`size={24}`, `colors.labelSecondary`, `weight="regular"`) consistent across tasks and source. ✓

No gaps found.
