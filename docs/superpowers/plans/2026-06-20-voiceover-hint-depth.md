# VoiceOver Hint Depth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `accessibilityHint` to the 6 safety-flow controls whose action is non-obvious from the label, and promote the hint convention into `.cursorrules`. This closes Phase 2 of the Design Health Program.

**Architecture:** Pure accessibility metadata — six one-line `accessibilityHint` props added to existing `Pressable`s across 4 screen files, plus one `.cursorrules` section. No visual, layout, or behavior change; no label rewrites.

**Tech Stack:** React Native + Expo, TypeScript. `accessibilityHint` is a standard RN prop. No test runner — verification is `npx tsc --noEmit` (exit 0) + diff inspection. VoiceOver output can only be smoke-tested on a real device (the user's job).

**Spec:** [`docs/superpowers/specs/2026-06-20-voiceover-hint-depth-design.md`](../specs/2026-06-20-voiceover-hint-depth-design.md)

---

## Pre-flight: branch

```bash
git checkout main && git pull --ff-only origin main
git checkout -b feat/voiceover-hint-depth
```

Do NOT implement on `main`.

## File Structure

| File | Hints added | Notes |
|---|---|---|
| `app/share-location.tsx` | #1 (reason picker) | interpolates `contactName` (in scope) |
| `app/unfamiliar.tsx` | #2 (problem), #3 (destination) | static strings |
| `app/roadside.tsx` | #4 (problem), #5 (tow) | static strings |
| `app/roadside-setup.tsx` | #6 (Save) | static string |
| `.cursorrules` | — | new `## Accessibility (VoiceOver)` section |
| `docs/next-session.md` | — | record the deferred long-tail sweep (Phase 3) |

**Context the implementer needs:**
- Each hint is added as `accessibilityHint={...}` on the **existing** `Pressable`, immediately after its `accessibilityLabel` (or `accessibilityRole`) prop. Do not change the label, role, or any other prop.
- Line numbers are plan-time snapshots; locate by the anchor text (the `accessibilityLabel` line) shown in each step.
- This is a11y metadata only — nothing visual changes. `tsc` is the gate (it also confirms `contactName` is in scope for hint #1).

---

### Task 1: add the 6 `accessibilityHint` props

**Files:** `app/share-location.tsx`, `app/unfamiliar.tsx`, `app/roadside.tsx`, `app/roadside-setup.tsx`

- [ ] **Step 1: `share-location.tsx` — reason picker (hint #1)**

Find the reason-picker `Pressable` (its label line is `accessibilityLabel={`${r.title}. ${r.clarifier}`}`, followed by `accessibilityState={{ disabled }}`). Add the hint between them:

```tsx
            accessibilityRole="button"
            accessibilityLabel={`${r.title}. ${r.clarifier}`}
            accessibilityHint={`Opens Messages with a safety check-in draft for ${contactName}`}
            accessibilityState={{ disabled }}
```

(`contactName` is in scope here — it already feeds the `NotifyingPulse` footer just below this list.)

- [ ] **Step 2: `unfamiliar.tsx` — problem picker (hint #2)**

Find the problem-picker `Pressable` (label line `accessibilityLabel={`${p.title}. ${p.clarifier}`}`). Add the hint right after it:

```tsx
            accessibilityRole="button"
            accessibilityLabel={`${p.title}. ${p.clarifier}`}
            accessibilityHint="Reports this and starts sharing your location with your trusted contact"
```

(Deliberately NOT interpolated — `contactName` is not guaranteed in the `ProblemPicker` sub-component's scope.)

- [ ] **Step 3: `unfamiliar.tsx` — destination picker (hint #3)**

Find the destination-picker `Pressable` (label line `accessibilityLabel={d.title}`). Add the hint right after it:

```tsx
            accessibilityRole="button"
            accessibilityLabel={d.title}
            accessibilityHint="Routes you there and returns to the map"
```

- [ ] **Step 4: `roadside.tsx` — problem picker (hint #4)**

Find the problem-picker `Pressable` (label line `accessibilityLabel={p.label}`). Add the hint right after it:

```tsx
            accessibilityRole="button"
            accessibilityLabel={p.label}
            accessibilityHint="Selects this problem and shows roadside actions"
```

- [ ] **Step 5: `roadside.tsx` — tow-search row (hint #5)**

Find the tow-search `Pressable` (label line `accessibilityLabel="Search nearby tow services"`). Add the hint right after it:

```tsx
          accessibilityRole="button"
          accessibilityLabel="Search nearby tow services"
          accessibilityHint="Opens Apple Maps to find tow services near you"
```

- [ ] **Step 6: `roadside-setup.tsx` — Save button (hint #6)**

Find the Save `Pressable` (label line `accessibilityLabel="Save"`, followed by `accessibilityState={{ disabled: !canSave }}`). Add the hint between them:

```tsx
            accessibilityRole="button"
            accessibilityLabel="Save"
            accessibilityHint="Saves your roadside service profile"
            accessibilityState={{ disabled: !canSave }}
```

- [ ] **Step 7: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0, no errors. (Confirms the `contactName` interpolation in #1 is in scope and well-typed.)

- [ ] **Step 8: Inspect the diff (hints-only guard)**

Run: `git diff app/share-location.tsx app/unfamiliar.tsx app/roadside.tsx app/roadside-setup.tsx | rg '^[+-]' | rg -v '^(\+\+\+|---)' | rg -v 'accessibilityHint'`
Expected: **empty output** — the only added lines are the six `accessibilityHint` props. If any other line (especially an `accessibilityLabel` change) appears, that's a defect — fix before committing.

- [ ] **Step 9: Commit**

```bash
git add app/share-location.tsx app/unfamiliar.tsx app/roadside.tsx app/roadside-setup.tsx
git commit -m "feat(a11y): add VoiceOver hints to the share / roadside / unfamiliar safety flows

Six accessibilityHint additions where the label is a noun/title and the
outcome is non-obvious: share-location reason picker (opens Messages),
unfamiliar problem + destination pickers (starts location-sharing /
routes), roadside problem + tow-search (shows actions / opens Maps),
roadside-setup Save. House style: present-tense outcome, no 'Tap to'.
A11y metadata only — no visual or behavior change.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: `.cursorrules` Accessibility rule + Phase-3 deferral note

**Files:** `.cursorrules`, `docs/next-session.md`

- [ ] **Step 1: Add the `## Accessibility (VoiceOver)` section to `.cursorrules`**

Locate the END of the `## Tap targets` section — its final paragraph is the `hitSlop` forgiveness paragraph (begins "`hitSlop` is for the narrow case where the visual is *genuinely* constrained…"). Insert the new section immediately after that paragraph (with a blank line before and after).

**Anchor on the Tap-targets `hitSlop` paragraph, NOT on the following `## Code conventions` heading.** PR #241 (dismissal, currently open) may insert a `## Dismissal` section in this same region first; anchoring on the Tap-targets content keeps this robust whether or not `## Dismissal` is present.

Section to insert:

```markdown
## Accessibility (VoiceOver)
Every interactive control needs an `accessibilityRole` + `accessibilityLabel` (what the control *is*). Add an `accessibilityHint` (what tapping *does* — the outcome) when the label is a noun/title, or the consequence is non-obvious or significant (navigates away, opens an external app, starts/stops sharing or recording, is destructive). House style: present-tense outcome phrase, **no "Tap to" prefix** (VoiceOver already announces "button"), calm and factual — e.g. "Opens Messages with a safety check-in draft", "Routes you there and returns to the map". Self-evident verb+object labels ("Save place", "Delete recording", "Close") need no hint.
```

- [ ] **Step 2: Add the deferred-sweep note to `docs/next-session.md`**

In the accessibility / polish area of `docs/next-session.md` (read the file to find the right grouping; if there's an accessibility section, add it there; otherwise add under the general polish list), add this bullet:

```markdown
- **VoiceOver hint long-tail sweep (Phase 3)** — PR 6 (2026-06-20) added hints to the share / roadside / unfamiliar safety flows and excluded `emergency.tsx` (already disambiguated). A second pass over `home.tsx`, the detail cards, and other partially-hinted surfaces for any remaining noun-labeled icon buttons was deferred to keep PR 6 bounded. Convention is now in `.cursorrules` (`## Accessibility (VoiceOver)`).
```

- [ ] **Step 3: Type-check (sanity)**

Run: `npx tsc --noEmit`
Expected: exit 0 (docs/rules changes can't affect types; confirms nothing regressed).

- [ ] **Step 4: Commit**

```bash
git add .cursorrules docs/next-session.md
git commit -m "docs(cursorrules): promote the accessibilityHint convention to the rulebook

Promote the label=what / hint=outcome convention (was only in
FloatingActionButton's JSDoc) into the cardinal rulebook, with the
house style. Record the deferred long-tail hint sweep in next-session.md
(Phase 3). Prose-only.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Final verification + PR

**Files:** none modified (verification + PR only)

- [ ] **Step 1: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0, no errors.

- [ ] **Step 2: Confirm the diff scope**

Run: `git diff main --stat`
Expected: six files — `app/share-location.tsx`, `app/unfamiliar.tsx`, `app/roadside.tsx`, `app/roadside-setup.tsx`, `.cursorrules`, `docs/next-session.md`. The four screen files show small `+` only (the hint lines).

Run: `git diff main -- app/share-location.tsx app/unfamiliar.tsx app/roadside.tsx app/roadside-setup.tsx | rg '^[+-]' | rg -v '^(\+\+\+|---)' | rg -v 'accessibilityHint'`
Expected: empty output — only `accessibilityHint` lines added; no `accessibilityLabel` or other change.

- [ ] **Step 3: Push and open the PR**

```bash
git push -u origin feat/voiceover-hint-depth
gh pr create --title "feat(a11y): VoiceOver hint depth for the safety flows + codify the convention" --body "$(cat <<'EOF'
## Sprint 3 PR 3/3 (PR 6) — VoiceOver hint depth — **closes Phase 2**

A coverage audit (262 labels / 39 hints) found the real gap is modest and concentrated in the **share / roadside / unfamiliar safety flows** (which never got hints, while en-route / home / search already did). `emergency.tsx` was found already-disambiguated and excluded (credited, not skipped).

### The 6 hints
| File | Control | Hint |
|---|---|---|
| `share-location` | reason picker | "Opens Messages with a safety check-in draft for [contact]" |
| `unfamiliar` | problem picker | "Reports this and starts sharing your location with your trusted contact" |
| `unfamiliar` | destination picker | "Routes you there and returns to the map" |
| `roadside` | problem picker | "Selects this problem and shows roadside actions" |
| `roadside` | tow-search | "Opens Apple Maps to find tow services near you" |
| `roadside-setup` | Save | "Saves your roadside service profile" |

Plus a new `.cursorrules` `## Accessibility (VoiceOver)` section promoting the label=what / hint=outcome convention from the `FloatingActionButton` JSDoc.

### Scope
- **Hints-only** — no label rewrites (none were wrong); a11y metadata only, no visual/behavior change.
- **Deferred to Phase 3** (noted in `next-session.md`): a long-tail sweep over `home.tsx` / detail cards for any remaining noun-labeled icon buttons.

### Verification
- `npx tsc --noEmit` clean (also confirms the `contactName` interpolation is in scope).
- Diff is six files; the four screens add only `accessibilityHint` lines.
- **VoiceOver smoke is the reviewer's job** — agents can't test VoiceOver. With VoiceOver on, focus each control and confirm the hint reads naturally after the label.

### Program milestone
Merging this **closes Phase 2** of the Design Health Program: Sprint 1 (3 PRs) + Sprint 2 (4) + Sprint 3 (3) = **10 PRs**.

Spec: `docs/superpowers/specs/2026-06-20-voiceover-hint-depth-design.md`
Plan: `docs/superpowers/plans/2026-06-20-voiceover-hint-depth.md`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: PR created; URL printed. Report it back. (Note: if PR #241 merged first and added `## Dismissal`, a `.cursorrules` rebase may be needed — trivial, since the two sections don't overlap.)

---

## Self-Review

**1. Spec coverage:**
- Spec's 6-hint table → Task 1 Steps 1–6 (exact strings, interpolation handling per spec). ✓
- Spec "Commit 2 — `.cursorrules` Accessibility rule" → Task 2 Step 1 (verbatim wording). ✓
- Spec "deferred long-tail sweep → next-session.md (Phase 3)" → Task 2 Step 2. ✓
- Spec "Out of scope" (emergency excluded, hints-only, no label rewrites) → guarded by Task 1 Step 8 + Task 3 Step 2 (hints-only diff assertion). ✓
- Spec "Verification (DoD)" → tsc (Task 1 Step 7, Task 2 Step 3, Task 3 Step 1); five/six-file scope (Task 3 Step 2); contactName in scope (tsc). ✓ (Note: spec said "five files"; the plan correctly lands six because the Phase-3 deferral note touches `next-session.md` — a documentation addition the spec's DoD explicitly requires. Flagged so the reviewer isn't surprised.)

**2. Placeholder scan:** No TBD/vague steps; every hint string and the rule text is verbatim. ✓

**3. Consistency:** All 6 hint strings, prop name (`accessibilityHint`), and the anchor labels match the spec and the verified render sites. The `contactName` interpolation (only #1) is consistently flagged. ✓

No gaps found.
