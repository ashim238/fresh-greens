# Dynamic Type Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Promote the Dynamic Type text-scaling convention from a buried `dynamicType()` JSDoc into a `.cursorrules` rule, and tag the three intentional fixed-size signage/display sites so a future `rg "fontSize:"` sweep doesn't re-flag them.

**Architecture:** Two independent atomic commits, zero behavior change. Commit 1 adds a prose rule to `.cursorrules`. Commit 2 adds three `// dynamic-type exempt` comments next to already-correct fixed-size `fontSize` values (the `// reserved-color sanctioned` precedent). No `fontSize`, `lineHeight`, or token value changes — the app renders byte-identically.

**Tech Stack:** React Native + Expo, TypeScript, StyleSheet. `.cursorrules` is plain Markdown. No test runner — verification is `npx tsc --noEmit` (exit 0) + diff inspection + a confirming `rg` sweep. No runtime smoke (zero behavior change).

**Spec:** [`docs/superpowers/specs/2026-06-20-dynamic-type-guard-design.md`](../specs/2026-06-20-dynamic-type-guard-design.md)

---

## Pre-flight: branch

Start on a fresh branch off `main` (do NOT implement on `main`):

```bash
git checkout main && git pull --ff-only origin main
git checkout -b feat/dynamic-type-guard
```

## File Structure

| File | Responsibility in this PR | What changes |
|---|---|---|
| `.cursorrules` | The cardinal design rulebook | New `## Dynamic Type (text scaling)` section between `## Typography` and `## Tap targets` |
| `app/en-route.tsx` | Speed-limit sign styles | Two `// dynamic-type exempt` comments (`speedLimitCurrentNumber`, `speedLimitNumber`) |
| `components/LifelineModal.tsx` | Avatar display text | One `// dynamic-type exempt` comment (`avatarText`) |

The two commits are independent. `theme/dynamic-type.ts` and `theme/typography.ts` are untouched.

**Context the implementer needs:**
- This is a **documentation/comment-only** PR. No `fontSize`, `lineHeight`, color, or token value may change. If any non-comment line changes, that's a defect.
- The rule wording below is canonical (from the approved spec). Use it verbatim.
- Line numbers are plan-time snapshots and may drift; locate by section header (`.cursorrules`) and style name (`.tsx`). Read the region before editing.

---

### Task 1: `.cursorrules` — add the Dynamic Type rule

**Files:**
- Modify: `.cursorrules` (insert a new section after the `## Typography` block — its last line is the in-modal-prompts bullet at line ~52 — and before the blank line preceding `## Tap targets` at line ~54)

- [ ] **Step 1: Locate the insertion point**

Run: `grep -nE "^## (Typography|Tap targets)" .cursorrules`
Confirm `## Typography` and `## Tap targets` are adjacent sections. The new section goes between them: after the last Typography bullet, with one blank line before and after.

- [ ] **Step 2: Insert the Dynamic Type section**

After the final line of the `## Typography` section (the bullet beginning `- **In-modal user prompts use Title1 Regular.**`) and its following blank line, insert this section (followed by a blank line before `## Tap targets`):

```markdown
## Dynamic Type (text scaling)
All styled text must scale with iOS Settings → Display & Text Size → Larger Text, per WCAG 1.4.4 (Resize Text, Level AA). The mechanism is `dynamicType(typography.X)` from `theme/dynamic-type.ts` — it scales both `fontSize` and `lineHeight` (React Native's `allowFontScaling` alone won't scale an explicit `lineHeight`). Spread it into every text style: `...dynamicType(typography.bodyRegular)`. For stress-state long reads, compose `dynamicType(relaxedLineHeight(typography.X))` (relax first, scale second).

**Raw `fontSize:` in a StyleSheet is forbidden** — it bypasses scaling and excludes low-vision users. Exception: fixed-aspect logo/signage/display text, where scaling would break the metaphor or push fixed-position UI off-screen (per Apple HIG: "unless the text is part of a logo or has a fixed aspect ratio"). Sanctioned exceptions, each tagged in-code with `// dynamic-type exempt`:

1. **Speed-limit sign numbers** (`/en-route` `speedLimitCurrentNumber` 24pt, `speedLimitNumber` 32pt) — US speed-limit signage is fixed-proportion (Overpass Bold on a regulation sign); scaling overflows the sign SVG and breaks the road-sign metaphor.
2. **Lifeline avatar initials** (`LifelineModal` `avatarText` 44pt) — a display-scale identity element (the ring is visual, not body text); no typography-ramp token reaches 44pt, and a single initial won't clip.
```

- [ ] **Step 3: Inspect the diff**

Run: `git diff .cursorrules`
Expected: one new `## Dynamic Type (text scaling)` section inserted between `## Typography` and `## Tap targets`. No existing line changes. The `## Tap targets` section and everything after it is unchanged (only shifted down).

- [ ] **Step 4: Commit**

```bash
git add .cursorrules
git commit -m "docs(cursorrules): add Dynamic Type text-scaling rule + signage exceptions

Promote the text-scaling convention (currently only in the dynamicType()
JSDoc) into the cardinal rulebook: all text routes through
dynamicType(typography.X); raw fontSize is forbidden except fixed-aspect
signage/display, with the two sanctioned exceptions (speed-limit sign
numbers, Lifeline avatar initials) named. Prose-only; no behavior change.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: inline `// dynamic-type exempt` pointers at the three sites

**Files:**
- Modify: `app/en-route.tsx` (`speedLimitCurrentNumber` ~line 2623, `speedLimitNumber` ~line 2658)
- Modify: `components/LifelineModal.tsx` (`avatarText` ~line 170)

Comment-only. All three share the greppable marker `dynamic-type exempt`.

- [ ] **Step 1: Tag `speedLimitCurrentNumber`**

In `app/en-route.tsx`, the `speedLimitCurrentNumber` style currently reads:

```ts
  speedLimitCurrentNumber: {
    // SF Pro Bold stand-in for Overpass Bold (the canonical US speed-
    // limit-sign typeface). Visually close; swap when Overpass loads.
    fontWeight: '700',
    fontSize: 24,
    lineHeight: 28,
    color: colors.white,
    textAlign: 'center',
    letterSpacing: -0.26,
  },
```

Insert one comment line immediately above `fontSize: 24,`:

```ts
    fontWeight: '700',
    // dynamic-type exempt (.cursorrules): fixed-proportion speed-limit signage
    fontSize: 24,
```

- [ ] **Step 2: Tag `speedLimitNumber`**

In `app/en-route.tsx`, the `speedLimitNumber` style currently reads:

```ts
  speedLimitNumber: {
    fontWeight: '700',
    fontSize: 32,
    lineHeight: 36,
    color: colors.black,
    textAlign: 'center',
    letterSpacing: -0.26,
  },
```

Insert one comment line immediately above `fontSize: 32,`:

```ts
    fontWeight: '700',
    // dynamic-type exempt (.cursorrules): fixed-proportion speed-limit signage
    fontSize: 32,
```

- [ ] **Step 3: Tag `avatarText`**

In `components/LifelineModal.tsx`, the `avatarText` style currently reads (preserve the existing comment block):

```ts
  avatarText: {
    // Display-scale identity affordance — the 44pt size has no token
    // equivalent in the typography ramp (largest is title2Emphasized at
    // ~28pt). Hand-set here as the documented exception per the spec's
    // "big avatar moment" sizing.
    ...typography.title2Emphasized,
    color: colors.white,
    // Avatar initials stay at fixed display-scale — the ring is a visual
    // element, not text needing AX5 scaling. The single character won't clip
    // at this size.
    fontSize: 44,
  },
```

Insert one comment line immediately above `fontSize: 44,` (keeping the existing comment block above it intact):

```ts
    // Avatar initials stay at fixed display-scale — the ring is a visual
    // element, not text needing AX5 scaling. The single character won't clip
    // at this size.
    // dynamic-type exempt (.cursorrules): display-scale avatar identity element
    fontSize: 44,
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0, no errors. (Comments can't change types; confirms nothing was broken.)

- [ ] **Step 5: Inspect the diff (comment-only guard)**

Run: `git diff app/en-route.tsx components/LifelineModal.tsx | rg '^[+-]' | rg -v '^(\+\+\+|---)' | rg -v 'dynamic-type exempt'`
Expected: **empty output** — the only added lines are the three `// dynamic-type exempt` comments. If any `fontSize`/`lineHeight`/other line appears, that's a defect — fix before committing.

- [ ] **Step 6: Commit**

```bash
git add app/en-route.tsx components/LifelineModal.tsx
git commit -m "docs(dynamic-type): tag the three fixed-size signage/display exemptions

Inline // dynamic-type exempt pointers (the reserved-color sanctioned
precedent) so the next rg 'fontSize:' sweep self-documents: en-route
speed-limit sign numbers (24/32pt) and LifelineModal avatar initials
(44pt). Comment-only; fontSize/lineHeight values unchanged.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Final verification + PR

**Files:** none modified (verification + PR only)

- [ ] **Step 1: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0, no errors.

- [ ] **Step 2: Confirm the three sites are intact + tagged**

Run: `rg -B1 "fontSize: (24|32|44)" app/en-route.tsx components/LifelineModal.tsx`
Expected: each of the three `fontSize` lines (24, 32, 44) is immediately preceded by a `// dynamic-type exempt (.cursorrules)` comment. The values are unchanged.

- [ ] **Step 3: Confirm the diff is exactly three files, prose/comment only**

Run: `git diff main --stat`
Expected: three files — `.cursorrules`, `app/en-route.tsx` (`+1`), `components/LifelineModal.tsx` (`+1`). `.cursorrules` shows the new section.

Run: `git diff main -- theme/dynamic-type.ts theme/typography.ts`
Expected: empty output (no token/helper change).

Run: `git diff main -- app/en-route.tsx components/LifelineModal.tsx | rg '^[+-]' | rg -v '^(\+\+\+|---)' | rg -v 'dynamic-type exempt'`
Expected: empty output — the ONLY added/removed lines in the two `.tsx` files are the three `// dynamic-type exempt` comments. If any `fontSize`/value line appears, that's a defect.

- [ ] **Step 4: Push and open the PR**

```bash
git push -u origin feat/dynamic-type-guard
gh pr create --title "docs(dynamic-type): codify text-scaling rule + tag the 3 fixed-size exemptions" --body "$(cat <<'EOF'
## Sprint 3 PR 1/3 (PR 8) — Dynamic Type guard

**Finding: 3 raw-fontSize sites, 0 genuine misses.** All three are intentional fixed-size signage/display (Apple HIG fixed-aspect carve-out, already cited in the `dynamicType()` JSDoc). The codebase already scales correctly. This PR promotes the convention into the cardinal rulebook and tags the exemptions — zero behavior change.

| Change | What |
|---|---|
| `.cursorrules` new `## Dynamic Type (text scaling)` | All text → `dynamicType(typography.X)`; raw `fontSize` forbidden except fixed-aspect signage/display; names the 2 sanctioned exceptions |
| Inline tags (×3) | `en-route` `speedLimitCurrentNumber`/`speedLimitNumber` + `LifelineModal` `avatarText` get `// dynamic-type exempt` (the reserved-color `// sanctioned` precedent) |

### Why a documented rule, not a linter
No ESLint / test runner in the project — standing one up for one rule is too heavy. Enforcement mirrors the reserved-color rule (the project's most-guarded invariant): a `.cursorrules` rule + `rg "fontSize:"` at review + inline pointers. Proven model, no new infra.

### Scope
- **No fixes** — 0 misses; the 3 sites stay as-is, only gaining a tag comment.
- **No token/helper changes** — `theme/dynamic-type.ts`, `theme/typography.ts` untouched.

### Verification
- `npx tsc --noEmit` clean.
- Diff is three files; the two `.tsx` files add only a `// dynamic-type exempt` comment each; `fontSize`/`lineHeight` values unchanged.
- No runtime smoke needed (zero visual change).

Spec: `docs/superpowers/specs/2026-06-20-dynamic-type-guard-design.md`
Plan: `docs/superpowers/plans/2026-06-20-dynamic-type-guard.md`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: PR created; URL printed. Report it back.

---

## Self-Review

**1. Spec coverage:**
- Spec "Commit 1 — `.cursorrules` Dynamic Type rule" → Task 1 (wording verbatim from spec). ✓
- Spec "Commit 2 — inline pointers at the 3 sites" → Task 2. ✓
- Spec "Out of scope" (no fixes, no ESLint/hook, no token change) → respected; Task 3 guards `theme/*` and asserts comment-only deltas. ✓
- Spec "Verification (definition of done)" → tsc (Task 2 Step 4, Task 3 Step 1); rule present (Task 1); three tags + unchanged values (Task 2 + Task 3 Step 2/3); `theme/*` not in diff (Task 3 Step 3). ✓

**2. Placeholder scan:** No TBD/TODO/vague steps. Rule text and all three comment strings are given verbatim. ✓

**3. Consistency:** Marker string `dynamic-type exempt (.cursorrules)` is identical across the rule, all three tags, and the guard greps. Style names (`speedLimitCurrentNumber`, `speedLimitNumber`, `avatarText`) and values (24/28, 32/36, 44) match the verified source. ✓

No gaps found.
