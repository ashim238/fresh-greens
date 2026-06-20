# Reserved-Color Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the reserved-color audit (26 use-sites, 0 violations) by codifying the two compliant-but-undocumented uses — destructive-action red (new carve-out #11) and the preferred-marker yellow ring (broaden #9) — plus inline "sanctioned" pointers, so a future `rg` sweep doesn't re-flag them.

**Architecture:** Two independent atomic commits, zero behavior change. Commit 1 edits `.cursorrules` prose (the rule's source of truth). Commit 2 adds two code comments next to already-correct color values — no value, token, or layout changes. Nothing functional moves.

**Tech Stack:** React Native + Expo, TypeScript, StyleSheet. `.cursorrules` is plain Markdown. No test runner — verification is `npx tsc --noEmit` (exit 0) + diff inspection + a confirming `rg` sweep. No runtime smoke needed (the app renders byte-identically).

**Spec:** [`docs/superpowers/specs/2026-06-20-reserved-color-audit-design.md`](../specs/2026-06-20-reserved-color-audit-design.md)

---

## Pre-flight: branch

Start on a fresh branch off `main` (do NOT implement on `main`):

```bash
git checkout main && git pull --ff-only origin main
git checkout -b feat/reserved-color-audit
```

## File Structure

| File | Responsibility in this PR | What changes |
|---|---|---|
| `.cursorrules` | The reserved-color rule (source of truth) | Add carve-out #11; append one sentence to #9 |
| `components/settings/SettingsRow.tsx` | Destructive-row label style | One comment on `destructiveLabel`'s `color: colors.red` |
| `components/FuelStopMarker.tsx` | Preferred-stop marker ring style | One comment on `iconCirclePreferred`'s `borderColor: colors.yellow` |

The two commits are fully independent. `theme/colors.ts` and all 24 other reserved-color use-sites are intentionally untouched.

**Context the implementer needs:**
- This is a **documentation/comment-only** PR. No color value, token reference, or layout property may change. If any `colors.*` value or any non-comment line of code changes, that's a defect.
- The exact carve-out wording below is canonical (copied from the approved spec). Use it verbatim — do not paraphrase.
- Line numbers below were captured at plan time and may drift by a line or two; the anchor text (the start of each carve-out, the style names) is the reliable locator. Read the file region before editing.

---

### Task 1: `.cursorrules` — add carve-out #11, broaden #9

**Files:**
- Modify: `.cursorrules` (carve-out #9 at line ~38; insert #11 after #10 at line ~39, before the blank line ~40 and the `**Cross-link carve-out:**` paragraph at line ~41)

- [ ] **Step 1: Read the current carve-out region**

Run: `sed -n '36,42p' .cursorrules` (or read the file). Confirm: line ~38 is carve-out `9.` (Preferred-station favorite star), line ~39 is carve-out `10.` (On-map hazard-zone markers), line ~40 is blank, line ~41 is `**Cross-link carve-out:**`.

- [ ] **Step 2: Append the FuelStopMarker sentence to carve-out #9**

Carve-out #9 currently ends with: `… The hollow (not-saved) star stays `labelTertiary` gray.`

Append one space + this sentence to the END of that same line (do not create a new line item — it stays part of bullet `9.`):

```
The same favorite-gold extends on-map: `FuelStopMarker`'s `iconCirclePreferred` uses a `colors.yellow` border as the companion to the star — same "saved/preferred" semantic, same iconography logic.
```

So #9's line ends: `…stays `labelTertiary` gray. The same favorite-gold extends on-map: `FuelStopMarker`'s `iconCirclePreferred` uses a `colors.yellow` border as the companion to the star — same "saved/preferred" semantic, same iconography logic.`

- [ ] **Step 3: Insert carve-out #11 after #10**

Immediately after carve-out `10.`'s line (line ~39) and before the blank line that precedes `**Cross-link carve-out:**`, insert this new list item:

```
11. **Destructive-action row labels** (red): a `SettingsRow` with `destructive` (e.g. /menu's "Sign out") renders its label in `colors.red`. iOS-universal convention — destructive/irreversible actions (Delete, Sign out, Remove) use system red `#FF3B30` everywhere on the platform. Same universal-iconography logic as the error-red (#8) and recording-red (#5) carve-outs: the convention is global enough not to compete with the safety-flow signals. Confined to the `destructive` variant; non-destructive rows use label-primary.
```

The resulting order must be: `9.` (now ending with the appended sentence), `10.`, `11.` (new), blank line, `**Cross-link carve-out:**`.

- [ ] **Step 4: Inspect the diff**

Run: `git diff .cursorrules`
Expected: carve-out `9.`'s line gains the trailing sentence; a new `11.` line appears after `10.`. No other lines change. No existing carve-out text (#1–#10, cross-link) is altered beyond #9's appended sentence.

- [ ] **Step 5: Commit**

```bash
git add .cursorrules
git commit -m "docs(cursorrules): codify destructive-red (#11) + broaden favorite-gold (#9)

Reserved-color audit (26 use-sites, 0 violations) found two compliant
uses not named by any carve-out: SettingsRow destructive-row red labels
(iOS-universal destructive action) and FuelStopMarker's preferred yellow
ring (on-map sibling of the #9 favorite star). Codify both so a future
rg sweep doesn't re-flag them. Prose-only; no behavior change.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: inline "sanctioned" pointers at the two codified sites

**Files:**
- Modify: `components/settings/SettingsRow.tsx` (`destructiveLabel` style, `color: colors.red` at line ~171)
- Modify: `components/FuelStopMarker.tsx` (`iconCirclePreferred` style, `borderColor: colors.yellow` at line ~83)

This mirrors the existing `app/index.tsx:345` precedent (a pointer comment so the next `rg` sweep self-documents). Comment-only — the color values must not change.

- [ ] **Step 1: Add the SettingsRow pointer**

In `components/settings/SettingsRow.tsx`, the `destructiveLabel` style currently reads:

```ts
  destructiveLabel: {
    ...dynamicType(typography.bodyRegular),
    color: colors.red,
    textAlign: 'center',
    flex: 1,
  },
```

Insert a comment line immediately above `color: colors.red,`:

```ts
  destructiveLabel: {
    ...dynamicType(typography.bodyRegular),
    // reserved-color sanctioned (.cursorrules #11): iOS-universal destructive red
    color: colors.red,
    textAlign: 'center',
    flex: 1,
  },
```

- [ ] **Step 2: Add the FuelStopMarker pointer**

In `components/FuelStopMarker.tsx`, the `iconCirclePreferred` style currently reads:

```ts
  iconCirclePreferred: {
    borderColor: colors.yellow,
    borderWidth: 2,
  },
```

Insert a comment line immediately above `borderColor: colors.yellow,`:

```ts
  iconCirclePreferred: {
    // reserved-color sanctioned (.cursorrules #9): favorite-gold ring, on-map sibling of PreferredStar
    borderColor: colors.yellow,
    borderWidth: 2,
  },
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0, no errors. (Comments can't change types; this confirms nothing was accidentally broken.)

- [ ] **Step 4: Inspect the diff**

Run: `git diff components/settings/SettingsRow.tsx components/FuelStopMarker.tsx`
Expected: exactly two hunks, each adding exactly one `// reserved-color sanctioned …` comment line. The `color: colors.red` and `borderColor: colors.yellow` values are unchanged. No other lines change.

- [ ] **Step 5: Commit**

```bash
git add components/settings/SettingsRow.tsx components/FuelStopMarker.tsx
git commit -m "docs(reserved-color): inline sanctioned pointers at the two codified sites

Pointer comments (the index.tsx:345 precedent) so the next rg sweep
self-documents: SettingsRow destructiveLabel cites .cursorrules #11,
FuelStopMarker iconCirclePreferred cites #9. Comment-only; the
colors.red / colors.yellow values are unchanged.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Final verification + PR

**Files:** none modified (verification + PR only)

- [ ] **Step 1: Type-check**

Run: `npx tsc --noEmit`
Expected: exit 0, no errors.

- [ ] **Step 2: Confirm the census is unchanged (no use-site added/removed)**

Run: `rg "colors\.(orange|red|yellow|pink|navy)\b" app/ components/ --no-heading | wc -l`
Expected: the same count as the audit baseline — **26** lines (25 use-sites + 1 comment-only match in `SafetyErrorMessage.tsx`; the two new pointer comments do NOT match this pattern because they say `colors.red`/`colors.yellow` inside a `//` comment — verify they are not double-counted: the regex matches `colors.red` even in a comment, so the count will rise by 2 to **28**. Treat **28** as expected: 26 baseline + 2 new comment references). Either way, confirm the only delta is the two new comment lines.

  To be unambiguous, run instead: `git diff main --stat` — see Step 3.

- [ ] **Step 3: Confirm the diff is exactly three files, comment/prose only**

Run: `git diff main --stat`
Expected: exactly three files — `.cursorrules`, `components/settings/SettingsRow.tsx`, `components/FuelStopMarker.tsx`. The two `.tsx` files show `+1` line each (the comment). `.cursorrules` shows the #9 edit + the new #11.

Run: `git diff main -- theme/colors.ts`
Expected: empty output (no token change).

Run: `git diff main -- components/settings/SettingsRow.tsx components/FuelStopMarker.tsx | rg '^[+-]' | rg -v '^(\+\+\+|---)' | rg -v 'reserved-color sanctioned'`
Expected: empty output — i.e. the ONLY added/removed lines in the two `.tsx` files are the two `// reserved-color sanctioned` comments. If any `colors.*` value line appears, that's a defect — fix before proceeding.

- [ ] **Step 4: Push and open the PR**

```bash
git push -u origin feat/reserved-color-audit
gh pr create --title "docs(reserved-color): audit closeout — codify destructive-red (#11) + favorite-gold ring (#9)" --body "$(cat <<'EOF'
## Sprint 2 PR 4/4 (the closer) — reserved-color audit

**Finding: 26 use-sites, 0 violations.** The project's cardinal design invariant was already clean. Full census in the spec. This PR closes the audit by codifying the two compliant-but-unnamed uses so a future `rg` sweep doesn't re-flag them — zero behavior change.

| Change | What |
|---|---|
| `.cursorrules` carve-out **#11** (new) | Destructive-action row labels (red) — iOS-universal destructive red on `SettingsRow` `destructive` rows (e.g. /menu "Sign out") |
| `.cursorrules` carve-out **#9** (broadened) | Names `FuelStopMarker`'s `iconCirclePreferred` yellow ring as the on-map sibling of the favorite star |
| Inline pointers (×2) | `SettingsRow` `destructiveLabel` → cites #11; `FuelStopMarker` `iconCirclePreferred` → cites #9 (the `index.tsx:345` precedent) |

### Scope
- **No fixes** — there are no violations. The 24 other reserved-color sites are confirmed compliant and untouched.
- **No token renames, no lint tooling, no behavior change.** Prose + two code comments only; the app renders byte-identically.

### Verification
- `npx tsc --noEmit` clean.
- Diff is exactly three files; the two `.tsx` files add only a `// reserved-color sanctioned` comment each; `colors.red`/`colors.yellow` values unchanged; `theme/colors.ts` untouched.
- No runtime smoke needed (zero visual change).

Spec: `docs/superpowers/specs/2026-06-20-reserved-color-audit-design.md`
Plan: `docs/superpowers/plans/2026-06-20-reserved-color-audit.md`

**This PR closes Sprint 2** (PRs 5, 7, 4, 10 all shipped).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: PR created; URL printed. Report the PR number/URL back.

---

## Self-Review

**1. Spec coverage:**
- Spec "Commit 1 — `.cursorrules`: add #11, broaden #9" → Task 1. ✓ (wording copied verbatim from spec)
- Spec "Commit 2 — inline pointers at the two sites" → Task 2. ✓
- Spec "Out of scope" (no fixes, no token rename, no lint, only the two non-obvious sites get pointers) → respected; Task 3 Step 3 guards `theme/colors.ts` and asserts comment-only deltas. ✓
- Spec "Verification (definition of done)" → tsc (Task 2 Step 3, Task 3 Step 1); #11 present + #9 appended (Task 1); pointer comments + unchanged values (Task 2 + Task 3 Step 3); `theme/colors.ts` not in diff (Task 3 Step 3). ✓
- Spec census/finding (0 violations, documentation only) → reflected in PR body + the no-fix scope. ✓

**2. Placeholder scan:** No TBD/TODO/vague steps. Carve-out text and comment text are given verbatim. ✓

**3. Consistency:** Carve-out numbers (#11 new, #9 broadened, citing #5/#8 for precedent), style names (`destructiveLabel`, `iconCirclePreferred`), color tokens (`colors.red`, `colors.yellow`), and comment strings are identical across Tasks 1–3 and match the verified source. ✓

One note corrected inline: Task 3 Step 2's raw `rg | wc -l` count rises from 26 → 28 because the regex matches `colors.red`/`colors.yellow` even inside the new `//` comments. The authoritative check is the comment-only diff assertion in Step 3, not the raw count. Flagged so the implementer doesn't read 28 as a defect.
