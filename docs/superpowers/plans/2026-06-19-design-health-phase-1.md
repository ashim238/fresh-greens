# Design Health Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish a uniform deep-critique baseline for every user-facing screen in the Fresh Greens app (~25 screens), then produce one cross-screen synthesis report that names the recurring patterns we'll address in Phase 2.

**Architecture:** Phase 1 is diagnostic only — no source files in `app/`, `components/`, `hooks/`, `lib/`, or `theme/` are modified. The work is: dispatch a series of `/impeccable critique`-shaped subagents (one per screen) that persist standardized snapshots to `.impeccable/critique/`, then dispatch one synthesis subagent that reads every snapshot and produces a single findings report. Critique runs are parallel-safe and execute up to 4-wide for wall-clock; the synthesis runs sequentially after all critiques land.

**Tech Stack:** The `/impeccable critique` flow (Sonnet subagent for design review + the bundled `detect.mjs` deterministic scanner + the `critique-storage.mjs` snapshot helper). No app code, no test runner. Verification is procedural: snapshot files exist with the expected frontmatter shape and the synthesis report contains the five required sections.

**Spec:** [`docs/superpowers/specs/2026-06-19-design-health-program-design.md`](../specs/2026-06-19-design-health-program-design.md)

**Verification model:** Each task has a precise verification step (the snapshot file exists at the expected path AND its frontmatter parses with the required keys). We commit in waves of 5 critique snapshots to keep history readable. The synthesis report is a final commit. No tsc, no test runner, no device pass.

---

## File map

- **Reads only** (no code edits):
  - `app/{screen}.tsx` × 25
  - `components/`, `theme/*.ts`, `.cursorrules`, `PRODUCT.md`, `DESIGN.md`
- **Creates:**
  - `.impeccable/critique/{ISO-timestamp}__{slug}.md` × 25 (+1 for the home re-baseline = 26 snapshots total)
  - `docs/superpowers/specs/phase-1-findings/2026-06-19-cross-screen-synthesis.md` (one)

No deletions. No edits to existing files.

---

## Critique order (lowest batch-audit score first; ties broken by alphabetical slug)

| # | Screen | Batch score | Notes |
|---|---|---|---|
| 1 | `roadside` | 28 | Tier C — first failure to fix-fast on |
| 2 | `search` | 30 | |
| 3 | `home` | 29 (critique) | **Re-baseline** after PR #231 — pre-polish snapshot already exists |
| 4 | `fuel` | 31 (pre-v2) | Post-v2 state; v2 polish landed in PR #230 |
| 5 | `legal` | 32 | |
| 6 | `report` | 32 | Alphabetically before trip-summary |
| 7 | `trip-summary` | 32 | |
| 8 | `menu` | 33 | Alphabetically before sign-out |
| 9 | `sign-out` | 33 | |
| 10 | `get-started` | 34 | |
| 11 | `login` | 34 | |
| 12 | `unfamiliar` | 34 | |
| 13 | `en-route` | n/a | Traffic-priority slot — fresh deep critique |
| 14 | `pulled-over` | n/a | Traffic-priority slot — fresh deep critique |
| 15 | `emergency` | 35 | Alphabetical |
| 16 | `recordings` | 35 | |
| 17 | `trusted-contact-setup` | 35 | |
| 18 | `roadside-setup` | 36 | |
| 19 | `permissions` | 37 | Alphabetical |
| 20 | `saved-places` | 37 | |
| 21 | `share-location` | 37 | |
| 22 | `onboarding` | 38 | Alphabetical |
| 23 | `safety` | 38 | |
| 24 | `safety-settings` | 39 | |
| 25 | `zone-preferences` | 40 | |

The home re-baseline is sequenced as #3 to surface its post-polish score early. There are 26 critique runs total: the 25 above plus the home re-baseline (also #3 — the same row, but it produces a new snapshot file alongside the pre-polish one).

---

## Task 0: Branch setup

**Files:**
- Create branch `program/design-health-phase-1` from current `main`.

- [ ] **Step 1: Verify on main and clean**

Run: `git status --short`
Expected: only the pre-existing untracked entries (`.impeccable/` and `scripts/generate-routing-zones-pdf.py` — neither is touched by this plan).

Run: `git branch --show-current`
Expected: `main`.

- [ ] **Step 2: Pull main to make sure we're at the latest**

Run: `git pull origin main`
Expected: "Already up to date." (the design-health spec at `cb538c2` should be the latest commit on main per the prior session).

Run: `git log --oneline -1`
Expected: `cb538c2 docs(spec): design health program — three-phase strategic spec + Phase 1 in detail`

- [ ] **Step 3: Create + check out the branch**

Run: `git checkout -b program/design-health-phase-1`
Expected: `Switched to a new branch 'program/design-health-phase-1'`

- [ ] **Step 4: No commit on this task**

Branch creation is not a commit. Move to Task 1.

---

## Task 1: Critique wave A (screens 1–5, two batches of parallel)

**Files (created by this task):**
- `.impeccable/critique/{ts}__app-roadside-tsx.md`
- `.impeccable/critique/{ts}__app-search-tsx.md`
- `.impeccable/critique/{ts}__app-home-tsx.md` (the home re-baseline — a NEW file, the existing pre-polish snapshot stays)
- `.impeccable/critique/{ts}__app-fuel-tsx.md`
- `.impeccable/critique/{ts}__app-legal-tsx.md`

Wave A runs **two parallel batches** within the task to honor the 4-wide ceiling: first batch is 4 concurrent (#1–#4), then a single follow-on (#5).

- [ ] **Step 1: Resolve slugs for wave A**

For each screen, compute the slug via the storage helper. Slugs are deterministic from the file path, so this step is verification:

Run:
```bash
SKILL=/Users/mylesashitey/.claude/plugins/cache/impeccable/impeccable/3.7.1/skills/impeccable
for f in app/roadside.tsx app/search.tsx app/home.tsx app/fuel.tsx app/legal.tsx; do
  echo -n "$f → "
  node $SKILL/scripts/critique-storage.mjs slug "$f"
done
```
Expected output:
```
app/roadside.tsx → app-roadside-tsx
app/search.tsx → app-search-tsx
app/home.tsx → app-home-tsx
app/fuel.tsx → app-fuel-tsx
app/legal.tsx → app-legal-tsx
```

- [ ] **Step 2: Run the first parallel batch (4 critiques: roadside, search, home, fuel)**

Dispatch 4 subagents in a **single message** with multiple Agent tool calls. Each uses this exact prompt template (substitute `{SCREEN}`, `{SLUG}`, `{SUPPORTING_FILES}` per row):

```
You are running an /impeccable critique on `{SCREEN}` for the Fresh Greens app's Design
Health Phase 1 baseline. Working dir: /Users/mylesashitey/code/fresh-greens. READ-ONLY —
do not edit any files.

## Files to read
- {SCREEN} (the screen under review)
- {SUPPORTING_FILES} (any sub-components this screen renders heavily — see below)
- theme/colors.ts, theme/typography.ts, theme/spacing.ts, theme/radii.ts, theme/shadows.ts, theme/interaction.ts
- .cursorrules (the design rulebook)
- PRODUCT.md, DESIGN.md (loaded at session start; reference for brand register)

## Context
Brand: "The Steady Companion." Calm, grounded, earthy. Safety through composure.
Reserved-color rule: orange = hazard only, red = recording only, navy = safety affordance.
In-flow CTAs/links stay freshgreen/wiltedgreen.
Tap-target rule: 44pt PAINTED targets (not hitSlop substitutes).
Icons: Phosphor only, per-icon deep imports.

## Your job — produce a rigorous design review

1. **AI slop verdict.** Would someone believe "AI made this"? Check the absolute bans
   (gradient text, glassmorphism-as-default, identical card grids, eyebrow labels on
   every section, side-stripe borders). One sentence.

2. **Nielsen's 10 heuristics — score each 0-4** (4 = genuinely excellent; most real
   interfaces score 20-32). One-line key issue per heuristic. Total /40 with the
   rating band (36-40 Excellent, 28-35 Good, 20-27 Acceptable, 12-19 Poor).

3. **Cognitive load checklist** (8 items: single focus, chunking ≤4/group, grouping,
   visual hierarchy, one-thing-at-a-time, ≤4 options/decision, working memory,
   progressive disclosure). Count failures: 0-1 low, 2-3 moderate, 4+ high.

4. **Emotional journey** — peak, valley, reassurance at charged moments.

5. **2-3 genuine strengths** (specific, with WHY they work).

6. **4-6 priority issues**, each tagged P0 (blocking) / P1 (major) / P2 (minor) /
   P3 (polish). Per issue: What / Why it matters / concrete Fix.

7. **Persona red flags** for Sam (accessibility — screen reader, contrast, VoiceOver),
   Casey (distracted one-handed mobile), and a project-specific persona: a Black driver
   assessing route safety in a charged moment (derived from PRODUCT.md — does the UI
   reassure without alarming? is the reasoning visible?).

Be direct and specific — name exact elements and line numbers. Don't soften. Return
the full structured review as your final message.

## Supporting files to read (per screen)
{SUPPORTING_FILES}
```

The `{SUPPORTING_FILES}` substitutions for this batch:

| Screen | Supporting files |
|---|---|
| `app/roadside.tsx` | `components/LifelineModal.tsx` (if rendered), `components/DragHandle.tsx` |
| `app/search.tsx` | `components/SearchBar.tsx` (the screen's primary input chrome) |
| `app/home.tsx` | `components/HomeBrowseSheet.tsx`, `components/RouteHazardDetailCard.tsx` |
| `app/fuel.tsx` | None beyond theme — fuel is mostly self-contained |

All four subagents use **model: sonnet** (the home critique earlier this session validated this depth at sonnet; haiku produces shallower output that wouldn't add to what the batch audits already gave us).

- [ ] **Step 3: Parse each subagent's final report and write a snapshot**

For each of the 4 returns: the subagent returns the structured critique as its final message. The orchestrating agent (you) does the following per critique:

1. Write the critique body to a temp file at `/tmp/critique-{slug}-body.md`. The body
   is everything from the "## Design Health Score" heading through the end of the
   "## Questions to Consider" section. Do NOT include any "Ask the User" or
   "Recommended Actions" sections — Phase 1 doesn't ask follow-up questions per critique.
2. Compute total_score (sum of the 10 heuristic scores from the score table) and
   p0_count / p1_count (count of P0 and P1 issues in the Priority Issues section).
3. Run the storage helper:

```bash
SKILL=/Users/mylesashitey/.claude/plugins/cache/impeccable/impeccable/3.7.1/skills/impeccable
IMPECCABLE_CRITIQUE_META='{"target":"{SCREEN}","total_score":{N},"p0_count":{N},"p1_count":{N}}' \
  node $SKILL/scripts/critique-storage.mjs write {SLUG} /tmp/critique-{slug}-body.md
```

Expected: the helper prints the absolute path of the written snapshot file.

4. Delete the temp file: `rm /tmp/critique-{slug}-body.md`.

- [ ] **Step 4: Verify all 4 snapshots exist with valid frontmatter**

Run:
```bash
for slug in app-roadside-tsx app-search-tsx app-home-tsx app-fuel-tsx; do
  latest=$(ls -t .impeccable/critique/*__${slug}.md 2>/dev/null | head -1)
  if [ -z "$latest" ]; then echo "MISSING: $slug"; continue; fi
  echo "=== $slug ==="
  head -8 "$latest"
done
```

Expected: 4 file headers printed, each beginning with `---`, each containing
`target:`, `total_score:`, `p0_count:`, `p1_count:`, `timestamp:`, `slug:` lines.
For `app-home-tsx`, the LATEST file (sorted by ls -t) is the new re-baseline; the
older pre-polish one stays in place.

- [ ] **Step 5: Run the follow-on critique (#5: legal)**

Single dispatch this time — the screen is small enough that a fifth concurrent
slot adds no wall-clock benefit:

Dispatch one subagent with the same prompt template, substituting:
- `{SCREEN}` = `app/legal.tsx`
- `{SLUG}` = `app-legal-tsx`
- `{SUPPORTING_FILES}` = `None beyond theme — legal is mostly long-form content with sticky tabs`

When it returns, repeat the snapshot-writing routine from Step 3 with the legal slug.

- [ ] **Step 6: Verify legal snapshot exists**

Run:
```bash
latest=$(ls -t .impeccable/critique/*__app-legal-tsx.md 2>/dev/null | head -1)
head -8 "$latest"
```
Expected: frontmatter block printed with the six required keys.

- [ ] **Step 7: Commit wave A (5 critiques)**

Run:
```bash
git add .impeccable/critique/
git commit -m "$(cat <<'EOF'
chore(design-health): Phase 1 wave A — 5 critique baselines

Snapshots for roadside, search, home (re-baseline post-#231), fuel
(post-v2), legal. Lowest-batch-score-first sweep, first wave.

No code changes — diagnostic only per the Phase 1 spec at
docs/superpowers/specs/2026-06-19-design-health-program-design.md.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 8: Failure handling — re-dispatch any incomplete critique**

If any subagent in Steps 2 or 5 returned a malformed report (missing the heuristic
table, missing Priority Issues, truncated, or otherwise non-conforming), re-dispatch
THAT subagent ONCE with a tightened prompt that demands only the minimum:

```
You are re-running an /impeccable critique on `{SCREEN}` after the first attempt
returned malformed output. Same context as before. Return ONLY:

1. Nielsen's 10 heuristic scores in a table (# | Heuristic | Score | Key Issue).
   Total /40 at the bottom.
2. 4-6 priority issues tagged P0/P1/P2/P3 with file:line refs and concrete fixes.

Skip strengths, persona walks, minor observations. Strict format.
```

If the re-dispatch ALSO returns malformed output, write a snapshot with
`total_score: 0`, `p0_count: 0`, `p1_count: 0` and a body containing only the
literal text `INCOMPLETE — see critique-rerun-log for details`. Note the slug
in your progress reporting. The synthesis subagent later will see the INCOMPLETE
marker and exclude that snapshot from pattern detection.

---

## Task 2: Critique wave B (screens 6–10)

**Files (created by this task):**
- `.impeccable/critique/{ts}__app-report-tsx.md`
- `.impeccable/critique/{ts}__app-trip-summary-tsx.md`
- `.impeccable/critique/{ts}__app-menu-tsx.md`
- `.impeccable/critique/{ts}__app-sign-out-tsx.md`
- `.impeccable/critique/{ts}__app-get-started-tsx.md`

- [ ] **Step 1: Resolve slugs**

Run:
```bash
SKILL=/Users/mylesashitey/.claude/plugins/cache/impeccable/impeccable/3.7.1/skills/impeccable
for f in app/report.tsx app/trip-summary.tsx app/menu.tsx app/sign-out.tsx app/get-started.tsx; do
  echo -n "$f → "; node $SKILL/scripts/critique-storage.mjs slug "$f"
done
```
Expected: `app-report-tsx`, `app-trip-summary-tsx`, `app-menu-tsx`, `app-sign-out-tsx`, `app-get-started-tsx`.

- [ ] **Step 2: First parallel batch (4 critiques: report, trip-summary, menu, sign-out)**

Use the prompt template from Task 1 Step 2. Substitutions:

| Screen | Supporting files |
|---|---|
| `app/report.tsx` | `components/Hazard.tsx`, `components/DragHandle.tsx` |
| `app/trip-summary.tsx` | `components/DragHandle.tsx` |
| `app/menu.tsx` | `components/settings/RowGroup.tsx`, `components/settings/SettingsRow.tsx`, `components/settings/SettingsHeader.tsx` |
| `app/sign-out.tsx` | None beyond theme |

All four use **model: sonnet**.

- [ ] **Step 3: Parse + write snapshots (same routine as Task 1 Step 3)**

For each return: temp file → compute scores/counts → `critique-storage.mjs write` → delete temp.

- [ ] **Step 4: Verify the 4 snapshots**

```bash
for slug in app-report-tsx app-trip-summary-tsx app-menu-tsx app-sign-out-tsx; do
  latest=$(ls -t .impeccable/critique/*__${slug}.md 2>/dev/null | head -1)
  if [ -z "$latest" ]; then echo "MISSING: $slug"; continue; fi
  echo "=== $slug ==="; head -8 "$latest"
done
```
Expected: 4 frontmatter blocks printed.

- [ ] **Step 5: Follow-on critique (#10: get-started)**

Dispatch one subagent with substitutions:
- `{SCREEN}` = `app/get-started.tsx`
- `{SLUG}` = `app-get-started-tsx`
- `{SUPPORTING_FILES}` = `app/login.tsx (near-clone — note any divergences)`

Write the snapshot per Task 1 Step 3 routine.

- [ ] **Step 6: Verify get-started snapshot**

```bash
latest=$(ls -t .impeccable/critique/*__app-get-started-tsx.md 2>/dev/null | head -1)
head -8 "$latest"
```
Expected: frontmatter block printed.

- [ ] **Step 7: Commit wave B**

```bash
git add .impeccable/critique/
git commit -m "$(cat <<'EOF'
chore(design-health): Phase 1 wave B — 5 critique baselines

Snapshots for report, trip-summary, menu, sign-out, get-started.
Continues the lowest-batch-score-first sweep.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 8: Failure handling**

Apply the same re-dispatch routine as Task 1 Step 8 to any malformed critique in this wave.

---

## Task 3: Critique wave C (screens 11–15)

**Files (created by this task):**
- `.impeccable/critique/{ts}__app-login-tsx.md`
- `.impeccable/critique/{ts}__app-unfamiliar-tsx.md`
- `.impeccable/critique/{ts}__app-en-route-tsx.md`
- `.impeccable/critique/{ts}__app-pulled-over-tsx.md`
- `.impeccable/critique/{ts}__app-emergency-tsx.md`

- [ ] **Step 1: Resolve slugs**

Run:
```bash
SKILL=/Users/mylesashitey/.claude/plugins/cache/impeccable/impeccable/3.7.1/skills/impeccable
for f in app/login.tsx app/unfamiliar.tsx app/en-route.tsx app/pulled-over.tsx app/emergency.tsx; do
  echo -n "$f → "; node $SKILL/scripts/critique-storage.mjs slug "$f"
done
```
Expected: `app-login-tsx`, `app-unfamiliar-tsx`, `app-en-route-tsx`, `app-pulled-over-tsx`, `app-emergency-tsx`.

- [ ] **Step 2: First parallel batch (4 critiques: login, unfamiliar, en-route, pulled-over)**

Note: `app/en-route.tsx` is the largest screen file in the app (~2800+ lines). Its critique subagent's token budget may approach 200k. Plan for ~10 minutes wall-clock on that one specifically; the parallel batch finishes when the slowest does.

Use the prompt template from Task 1 Step 2. Substitutions:

| Screen | Supporting files |
|---|---|
| `app/login.tsx` | `app/get-started.tsx` (near-clone; note divergences) |
| `app/unfamiliar.tsx` | `components/LifelineModal.tsx`, `components/DragHandle.tsx` |
| `app/en-route.tsx` | `components/EnRouteCarMarker.tsx`, `components/EnRouteZone.tsx`, `components/LaneStrip.tsx`, `hooks/useCoachMark.ts` |
| `app/pulled-over.tsx` | `components/DragHandle.tsx`, `hooks/useDisclosureDuty.ts` |

All four use **model: sonnet**.

- [ ] **Step 3: Parse + write snapshots**

Routine identical to Task 1 Step 3.

- [ ] **Step 4: Verify the 4 snapshots**

```bash
for slug in app-login-tsx app-unfamiliar-tsx app-en-route-tsx app-pulled-over-tsx; do
  latest=$(ls -t .impeccable/critique/*__${slug}.md 2>/dev/null | head -1)
  if [ -z "$latest" ]; then echo "MISSING: $slug"; continue; fi
  echo "=== $slug ==="; head -8 "$latest"
done
```
Expected: 4 frontmatter blocks printed.

- [ ] **Step 5: Follow-on critique (#15: emergency)**

Dispatch one subagent with substitutions:
- `{SCREEN}` = `app/emergency.tsx`
- `{SLUG}` = `app-emergency-tsx`
- `{SUPPORTING_FILES}` = `components/LifelineModal.tsx`

Write snapshot per the routine.

- [ ] **Step 6: Verify emergency snapshot**

```bash
latest=$(ls -t .impeccable/critique/*__app-emergency-tsx.md 2>/dev/null | head -1)
head -8 "$latest"
```
Expected: frontmatter printed.

- [ ] **Step 7: Commit wave C**

```bash
git add .impeccable/critique/
git commit -m "$(cat <<'EOF'
chore(design-health): Phase 1 wave C — 5 critique baselines

Snapshots for login, unfamiliar, en-route (fresh deep critique),
pulled-over (fresh deep critique), emergency. Continues sweep.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 8: Failure handling**

Same re-dispatch routine as Task 1 Step 8.

---

## Task 4: Critique wave D (screens 16–20)

**Files (created by this task):**
- `.impeccable/critique/{ts}__app-recordings-tsx.md`
- `.impeccable/critique/{ts}__app-trusted-contact-setup-tsx.md`
- `.impeccable/critique/{ts}__app-roadside-setup-tsx.md`
- `.impeccable/critique/{ts}__app-permissions-tsx.md`
- `.impeccable/critique/{ts}__app-saved-places-tsx.md`

- [ ] **Step 1: Resolve slugs**

Run:
```bash
SKILL=/Users/mylesashitey/.claude/plugins/cache/impeccable/impeccable/3.7.1/skills/impeccable
for f in app/recordings.tsx app/trusted-contact-setup.tsx app/roadside-setup.tsx app/permissions.tsx app/saved-places.tsx; do
  echo -n "$f → "; node $SKILL/scripts/critique-storage.mjs slug "$f"
done
```
Expected: `app-recordings-tsx`, `app-trusted-contact-setup-tsx`, `app-roadside-setup-tsx`, `app-permissions-tsx`, `app-saved-places-tsx`.

- [ ] **Step 2: First parallel batch (4 critiques: recordings, trusted-contact-setup, roadside-setup, permissions)**

Use the prompt template from Task 1 Step 2. Substitutions:

| Screen | Supporting files |
|---|---|
| `app/recordings.tsx` | `hooks/useRecordings.ts` |
| `app/trusted-contact-setup.tsx` | `hooks/useTrustedContact.ts` |
| `app/roadside-setup.tsx` | `hooks/useRoadsideProfile.ts` |
| `app/permissions.tsx` | None beyond theme |

All four use **model: sonnet**.

- [ ] **Step 3: Parse + write snapshots**

Routine identical to Task 1 Step 3.

- [ ] **Step 4: Verify the 4 snapshots**

```bash
for slug in app-recordings-tsx app-trusted-contact-setup-tsx app-roadside-setup-tsx app-permissions-tsx; do
  latest=$(ls -t .impeccable/critique/*__${slug}.md 2>/dev/null | head -1)
  if [ -z "$latest" ]; then echo "MISSING: $slug"; continue; fi
  echo "=== $slug ==="; head -8 "$latest"
done
```
Expected: 4 frontmatter blocks printed.

- [ ] **Step 5: Follow-on critique (#20: saved-places)**

Dispatch one subagent with substitutions:
- `{SCREEN}` = `app/saved-places.tsx`
- `{SLUG}` = `app-saved-places-tsx`
- `{SUPPORTING_FILES}` = `hooks/useSavedPlaces.ts`

Write snapshot per the routine.

- [ ] **Step 6: Verify saved-places snapshot**

```bash
latest=$(ls -t .impeccable/critique/*__app-saved-places-tsx.md 2>/dev/null | head -1)
head -8 "$latest"
```
Expected: frontmatter printed.

- [ ] **Step 7: Commit wave D**

```bash
git add .impeccable/critique/
git commit -m "$(cat <<'EOF'
chore(design-health): Phase 1 wave D — 5 critique baselines

Snapshots for recordings, trusted-contact-setup, roadside-setup,
permissions, saved-places. Approaching the Tier-A end of the sweep.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 8: Failure handling**

Same re-dispatch routine as Task 1 Step 8.

---

## Task 5: Critique wave E (screens 21–25)

**Files (created by this task):**
- `.impeccable/critique/{ts}__app-share-location-tsx.md`
- `.impeccable/critique/{ts}__app-onboarding-tsx.md`
- `.impeccable/critique/{ts}__app-safety-tsx.md`
- `.impeccable/critique/{ts}__app-safety-settings-tsx.md`
- `.impeccable/critique/{ts}__app-zone-preferences-tsx.md`

- [ ] **Step 1: Resolve slugs**

Run:
```bash
SKILL=/Users/mylesashitey/.claude/plugins/cache/impeccable/impeccable/3.7.1/skills/impeccable
for f in app/share-location.tsx app/onboarding.tsx app/safety.tsx app/safety-settings.tsx app/zone-preferences.tsx; do
  echo -n "$f → "; node $SKILL/scripts/critique-storage.mjs slug "$f"
done
```
Expected: `app-share-location-tsx`, `app-onboarding-tsx`, `app-safety-tsx`, `app-safety-settings-tsx`, `app-zone-preferences-tsx`.

- [ ] **Step 2: First parallel batch (4 critiques: share-location, onboarding, safety, safety-settings)**

Use the prompt template from Task 1 Step 2. Substitutions:

| Screen | Supporting files |
|---|---|
| `app/share-location.tsx` | `hooks/useShareSession.ts` |
| `app/onboarding.tsx` | `components/PageControl.tsx` |
| `app/safety.tsx` | None beyond theme (safety is a 2×2 tile picker) |
| `app/safety-settings.tsx` | `components/settings/RowGroup.tsx`, `components/settings/SettingsRow.tsx` |

All four use **model: sonnet**.

- [ ] **Step 3: Parse + write snapshots**

Routine identical to Task 1 Step 3.

- [ ] **Step 4: Verify the 4 snapshots**

```bash
for slug in app-share-location-tsx app-onboarding-tsx app-safety-tsx app-safety-settings-tsx; do
  latest=$(ls -t .impeccable/critique/*__${slug}.md 2>/dev/null | head -1)
  if [ -z "$latest" ]; then echo "MISSING: $slug"; continue; fi
  echo "=== $slug ==="; head -8 "$latest"
done
```
Expected: 4 frontmatter blocks printed.

- [ ] **Step 5: Follow-on critique (#25: zone-preferences)**

Dispatch one subagent with substitutions:
- `{SCREEN}` = `app/zone-preferences.tsx`
- `{SLUG}` = `app-zone-preferences-tsx`
- `{SUPPORTING_FILES}` = `hooks/usePreferences.ts`, `components/settings/RowGroup.tsx`, `components/settings/SettingsRow.tsx`

Write snapshot per the routine.

- [ ] **Step 6: Verify zone-preferences snapshot + complete-set check**

```bash
latest=$(ls -t .impeccable/critique/*__app-zone-preferences-tsx.md 2>/dev/null | head -1)
head -8 "$latest"

echo "---total snapshot count---"
ls .impeccable/critique/ | grep -c '\.md$'
```
Expected: zone-preferences frontmatter printed. Total `.md` count = **26** (25 fresh + 1 pre-existing pre-polish home snapshot from earlier in this session).

If the count is less than 26, list the missing slugs:

```bash
EXPECTED=( \
  app-roadside-tsx app-search-tsx app-home-tsx app-fuel-tsx app-legal-tsx \
  app-report-tsx app-trip-summary-tsx app-menu-tsx app-sign-out-tsx app-get-started-tsx \
  app-login-tsx app-unfamiliar-tsx app-en-route-tsx app-pulled-over-tsx app-emergency-tsx \
  app-recordings-tsx app-trusted-contact-setup-tsx app-roadside-setup-tsx app-permissions-tsx app-saved-places-tsx \
  app-share-location-tsx app-onboarding-tsx app-safety-tsx app-safety-settings-tsx app-zone-preferences-tsx \
)
for slug in "${EXPECTED[@]}"; do
  latest=$(ls -t .impeccable/critique/*__${slug}.md 2>/dev/null | head -1)
  if [ -z "$latest" ]; then echo "MISSING: $slug"; fi
done
```
Expected: no output (all 25 slugs have at least one snapshot).

- [ ] **Step 7: Commit wave E (final critique commit)**

```bash
git add .impeccable/critique/
git commit -m "$(cat <<'EOF'
chore(design-health): Phase 1 wave E — final 5 critique baselines

Snapshots for share-location, onboarding, safety, safety-settings,
zone-preferences. Closes the 25-screen critique sweep; synthesis report
follows.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 8: Failure handling**

Same re-dispatch routine as Task 1 Step 8.

---

## Task 6: Synthesis subagent — cross-screen findings report

**Files:**
- Create directory: `docs/superpowers/specs/phase-1-findings/`
- Create file: `docs/superpowers/specs/phase-1-findings/2026-06-19-cross-screen-synthesis.md`

- [ ] **Step 1: Make the findings directory**

Run:
```bash
mkdir -p docs/superpowers/specs/phase-1-findings
ls docs/superpowers/specs/phase-1-findings/ || echo "directory ready, empty"
```
Expected: empty directory listing.

- [ ] **Step 2: Dispatch the synthesis subagent**

One subagent, **model: sonnet** (this is judgment-heavy synthesis work — pattern detection across 25 critiques requires real reasoning).

Prompt (use exactly):

```
You are the synthesis step of Fresh Greens' Design Health Phase 1 program. Working
dir: /Users/mylesashitey/code/fresh-greens. READ-ONLY — do not edit any files
EXCEPT the single output file specified at the end.

## Your inputs

Read EVERY snapshot file in `.impeccable/critique/`. There are 26 files total: 25
fresh Phase 1 snapshots plus one pre-polish snapshot for app/home.tsx from earlier
this session (timestamp prefix 2026-06-19T03-47-20Z).

DEDUPLICATION RULE: When two snapshots share the same `slug:` in their frontmatter,
USE ONLY THE MOST RECENT (by timestamp). The pre-polish home snapshot is superseded
by the post-PR-#231 re-baseline. After deduplication you should have exactly 25
distinct slugs.

EXCLUSION RULE: Any snapshot whose body contains the literal string
"INCOMPLETE — see critique-rerun-log for details" is excluded from pattern
detection but still listed in the score table with an "INCOMPLETE" marker.

## Read these too, for context

- docs/superpowers/specs/2026-06-19-design-health-program-design.md (the program spec — defines what "deep critique" means and what Phase 2/3 will do with your output)
- PRODUCT.md, DESIGN.md (already-loaded context for what "good" looks like for this app)

## Produce ONE report

Write it to: `docs/superpowers/specs/phase-1-findings/2026-06-19-cross-screen-synthesis.md`

The report has FIVE sections in this exact order:

### 1. Score table

A markdown table sorted from lowest total to highest:

| Rank | Slug | Total /40 | H1 | H2 | H3 | H4 | H5 | H6 | H7 | H8 | H9 | H10 | P0 | P1 | Tier | Gap to 35 |

Tier column: "C" if total ≤27, "B" if 28-34, "A" if 35-40. Gap to 35 column:
"+0" if already ≥35, otherwise the positive integer needed (e.g. "+3" for a 32/40).
For INCOMPLETE snapshots, fill the row with "—" in score columns and "INCOMPLETE"
in the Tier column.

Below the table, one paragraph summarizing the distribution: how many at Tier A,
how many below, the median score, and any outliers.

### 2. Recurring patterns

For every P0 and P1 issue named in any snapshot, identify which patterns recur.
A "pattern" is a class of issue that appears on 3 OR MORE screens. Examples from
the home critique that may or may not recur: silent error swallowing (no retry
path), inconsistent dismiss patterns across modal surfaces, hidden discoverability
on power features, hitSlop-as-compliance, off-ramp spacing/radius values, generic
first-run coaching that loses brand voice.

For EACH pattern that clears the 3+ threshold, write a block:

**Pattern: {one-line name}**
- Description: {one sentence}
- Consuming screens: {comma-separated slug list}
- Proposed system-level fix: {concrete extraction or design-system change}
- Expected lift: {per-screen heuristic delta, typically +1 to +2 on which heuristic}
- Estimated Phase 2 cost: {token estimate for the extraction PR}

Patterns appearing on 1 or 2 screens DO NOT go in this section; they belong in
section 5 (Phase 3 tail).

### 3. Component-extraction candidates

Derived from section 2 but framed as code-level extractions. Each entry:

**`<ComponentName>` or `useHookName()`**
- Replaces: {list of existing implementations across the codebase}
- Source pattern from section 2: {pattern name}
- Touch surface: {number of screens, number of call sites}

If you find duplication that the critiques didn't explicitly call out (e.g. you
see three pill implementations with similar styles), flag it here with a "(novel)"
suffix on the entry.

### 4. Phase 2 scope estimate

Recommend a Phase 2 plan as an ordered list, sequenced by lift count (most-consuming-
screens first). For each:

1. {extraction name} — lifts {N} screens, est. {N}M tokens

Below the list:
- Total estimated Phase 2 token cost
- Go/no-go assessment against the spec's criteria:
  - GO if ≥3 patterns each lift ≥3 screens
  - TRIM if only 1-2 patterns reach the threshold
  - RE-SCOPE if findings deviate from expectations
- One-paragraph rationale for your recommendation.

### 5. Phase 3 tail

Per-screen issues that are screen-specific (appear on 1-2 screens, not extracted
by Phase 2). Group by slug. For each slug with screen-specific findings:

**{slug} ({current total}/40 → needs +{gap} to clear 35)**
- {issue 1, with reference to source critique path}
- {issue 2, ...}

If a slug already scores ≥35, write: "Already clears 35. No tail required."

## Output discipline

- Use the design system's voice — calm, grounded, specific. No "very interesting"
  filler. No emoji.
- Quote file:line refs from the underlying critiques when naming issues.
- Don't add a "conclusion" or "next steps" section. The five sections above ARE
  the report.

When done, return as your final message the absolute path of the file you wrote
and a one-paragraph executive summary (which the user will see in chat).
```

- [ ] **Step 3: Verify the report exists and contains the five sections**

Run:
```bash
test -f docs/superpowers/specs/phase-1-findings/2026-06-19-cross-screen-synthesis.md && echo "exists" || echo "MISSING"
echo "---section headers---"
grep -nE '^### [0-9]\.' docs/superpowers/specs/phase-1-findings/2026-06-19-cross-screen-synthesis.md
```
Expected:
```
exists
---section headers---
{line}:### 1. Score table
{line}:### 2. Recurring patterns
{line}:### 3. Component-extraction candidates
{line}:### 4. Phase 2 scope estimate
{line}:### 5. Phase 3 tail
```

If any section header is missing, dispatch a re-run with: "Your previous synthesis
omitted section {N}. Please add it now to the existing file at {path}, preserving
the other sections. Return the diff."

- [ ] **Step 4: Sanity-check the score-table row count**

Run:
```bash
# Count score-table rows (between the table header and the next blank line).
awk '/^\| Rank /{f=1; next} f && /^\|/ {print} f && /^[^|]/{exit}' \
  docs/superpowers/specs/phase-1-findings/2026-06-19-cross-screen-synthesis.md | \
  grep -v '^\|---' | wc -l
```
Expected: `25` (25 distinct slugs after dedup).

If the count is 26 or higher, the dedup rule wasn't applied — re-dispatch the
synthesis with: "Your score table has duplicate slugs. The dedup rule is: when
two snapshots share a slug, use only the most recent timestamp. Regenerate the
table at {path}."

- [ ] **Step 5: Commit the synthesis report**

```bash
git add docs/superpowers/specs/phase-1-findings/
git commit -m "$(cat <<'EOF'
docs(design-health): Phase 1 synthesis — cross-screen findings report

Synthesis subagent read all 25 deduplicated critique snapshots and
produced the cross-screen findings report: score table, recurring
patterns (3+ screen threshold), component-extraction candidates,
Phase 2 scope estimate with go/no-go assessment, Phase 3 tail.

Output of Phase 1. Informs the Phase 2 brainstorm + spec to come.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Checkpoint preparation — present findings to user in chat

**Files:**
- None modified. This task is a structured chat presentation.

- [ ] **Step 1: Read the synthesis report**

Run:
```bash
cat docs/superpowers/specs/phase-1-findings/2026-06-19-cross-screen-synthesis.md
```

You're loading the full report into your own context to present it cleanly.

- [ ] **Step 2: Present the executive summary in chat**

Write a chat message with this structure (substitute the bracketed values from the report):

```
Phase 1 complete. **Design Health baseline established** across {N_TOTAL} screens.

**Headline numbers:**
- Already ≥35 (Tier A): {N_A} screens
- Tier B (28-34): {N_B} screens
- Tier C (≤27): {N_C} screens
- Median score: {MEDIAN}/40
- Total P0 issues across the app: {P0_TOTAL}
- Total P1 issues across the app: {P1_TOTAL}

**Recurring patterns identified:** {N_PATTERNS} patterns clear the 3+ screen
threshold. Top three by consuming-screen count:
1. {Pattern 1 name} — {N} screens — proposed fix: {extraction}
2. {Pattern 2 name} — {N} screens — proposed fix: {extraction}
3. {Pattern 3 name} — {N} screens — proposed fix: {extraction}

**Phase 2 recommendation (per synthesis):** {GO / TRIM / RE-SCOPE}. Estimated
token cost: ~{N}M.

**Phase 3 tail:** {N} screens still need targeted polish after Phase 2 extractions
land. Total per-screen polish PRs estimated.

Full report: `docs/superpowers/specs/phase-1-findings/2026-06-19-cross-screen-synthesis.md`
```

- [ ] **Step 3: Ask the three structured checkpoint questions via AskUserQuestion**

Per the spec's checkpoint protocol, dispatch one `AskUserQuestion` tool call with
THREE questions:

**Question 1 — per-screen state:**
"Score table showed {N_BELOW_EXPECTED} screens scoring lower than batch suggested
and {N_ABOVE_EXPECTED} scoring higher. {Specific surprise, if any — e.g. 'Tier-A
batch screen X actually scored 29 under deep critique.'} Anything in the table
you want to investigate before we decide remediation?"

Options:
- "No surprises — proceed to Phase 2 sign-off"
- "Investigate {specific slug} — its score is below what I expected"
- "Investigate the methodology — too many scores diverge from batch in the same direction"

(If no real surprises in the data, use only the first two options.)

**Question 2 — Phase 2 scope:**
"Synthesis recommends extracting {N} patterns (named above). Each lifts {N} screens.
Total estimated Phase 2 cost: ~{N}M tokens."

Options:
- "Accept the recommended set — proceed to Phase 2 brainstorm"
- "Trim — extract only the top {2 or 3} by lift count"
- "Add to it — there's a pattern I want extracted that isn't on the list"
- "Stop after Phase 1 — the per-screen polish backlog is enough"

**Question 3 — Phase 3 tail sequencing (only if Phase 2 is going ahead):**
"After Phase 2 extractions, {N} screens will still need targeted polish to clear
35. How should we sequence the per-screen tail?"

Options:
- "Largest score-gap first (worst-screens-first)"
- "Highest-traffic first (home/en-route/pulled-over priority)"
- "Stop at 35 floor — defer everything else to next-session.md"

- [ ] **Step 4: Record the user's answers as a follow-up commit on this branch**

Once the user answers, write their decisions as a short markdown file at
`docs/superpowers/specs/phase-1-findings/2026-06-19-checkpoint-decisions.md`:

```markdown
# Phase 1 Checkpoint — User Decisions

**Date:** 2026-06-19
**Synthesis report:** ./2026-06-19-cross-screen-synthesis.md

## Decisions

1. **Per-screen state:** {user's answer}
2. **Phase 2 scope:** {user's answer}
3. **Phase 3 tail sequencing:** {user's answer or "deferred"}

## Next action

{Based on answers — e.g. "Brainstorm Phase 2 spec with the recommended pattern set" OR "Stop here; per-screen polish backlog routed to next-session.md."}
```

Commit it:

```bash
git add docs/superpowers/specs/phase-1-findings/2026-06-19-checkpoint-decisions.md
git commit -m "$(cat <<'EOF'
docs(design-health): Phase 1 checkpoint decisions

User's decisions on the three structured checkpoint questions, recorded
for the next phase's brainstorm.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 5: Open the Phase 1 PR**

```bash
git push -u origin program/design-health-phase-1

gh pr create --base main --head program/design-health-phase-1 \
  --title "program(design-health): Phase 1 — 25-screen baseline + synthesis" \
  --body "$(cat <<'EOF'
## Summary

Phase 1 of the Design Health Program. Diagnostic only — no code changes. Establishes a uniform deep-critique baseline across every user-facing screen and produces the cross-screen synthesis report that will inform Phase 2.

**Spec:** [`docs/superpowers/specs/2026-06-19-design-health-program-design.md`](docs/superpowers/specs/2026-06-19-design-health-program-design.md)
**Plan:** [`docs/superpowers/plans/2026-06-19-design-health-phase-1.md`](docs/superpowers/plans/2026-06-19-design-health-phase-1.md)

## What ships

- **25 critique snapshots** in `.impeccable/critique/` (one per screen, frontmatter-validated)
- **Cross-screen synthesis report** at `docs/superpowers/specs/phase-1-findings/2026-06-19-cross-screen-synthesis.md` — score table, recurring patterns (3+ screen threshold), component-extraction candidates, Phase 2 scope estimate with go/no-go, Phase 3 tail
- **Checkpoint decisions** at `docs/superpowers/specs/phase-1-findings/2026-06-19-checkpoint-decisions.md` — the user's responses to the three structured questions, captured for the next phase's brainstorm

## What does NOT ship

- No code changes (no `app/`, `components/`, `hooks/`, `lib/`, `theme/` edits)
- No Phase 2 extractions — those land in a future PR after the next brainstorm
- No CI gate — the Definition-of-Done step is a Phase 3 follow-up

## Verification

- All 25 expected slugs present in `.impeccable/critique/` (the verification script in plan Task 5 Step 6 confirmed this)
- Synthesis report contains all 5 required sections (header grep in plan Task 6 Step 3)
- Score table has exactly 25 rows (dedup rule applied; plan Task 6 Step 4)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Return the PR URL.

---

## Out of scope (per spec, restated for the implementer)

- No code changes to `app/`, `components/`, `hooks/`, `lib/`, `theme/`. Diagnostic only.
- No CI gate setup. The Definition-of-Done workflow step is a Phase 3 task, not Phase 1.
- No critique of non-screen files (hooks, lib adapters, scoring logic). They're evaluated indirectly through the screens that consume them.
- No fixing issues during Phase 1. Findings are recorded; remediation is Phase 2 (system lift) and Phase 3 (per-screen tail).
- No device testing. Phase 1 doesn't ship code.
- No new specs or plans. The Phase 2 spec is brainstormed AFTER the checkpoint, in a separate conversation turn.
