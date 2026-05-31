# Zone-Flag Wiring (#44) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the /menu Zone-Preferences toggles (`flagPolice`/`flagLowLight`/`flagCommunityReports`) actually gate their zone categories — out of route scoring, the map overlay, the comparison chips, the hazard notices, and the entered-zone pill.

**Architecture:** One pure `isZoneCategoryEnabled(category, preferences)` helper. On /home + /en-route, filter the zone sources by it (per-source derivations) and point every existing zone consumer at the filtered sets. `scoreRoute`/`pickWinner`/`routeConditions`/`hazardsNearTurn` stay pure — only their *input* zones are filtered.

**Tech Stack:** React Native + Expo + TypeScript. Spec: `docs/superpowers/specs/2026-05-31-zone-flag-wiring-design.md`.

---

## ⚠️ Verification model (read first)

**No test runner.** Per `CLAUDE.md`: `npx tsc --noEmit` + manual simulator check + code-reviewer subagent. Each task: edit → typecheck → commit. No TDD.

```bash
npx tsc --noEmit 2>&1 | grep -v -E '@expo/vector-icons|@vercel/node|avatar\.png' | head -40
```
Expected after each task: no output.

**Confirmed (read from source):**
- `lib/api/preferences.ts` exports `DEFAULT_PREFERENCES` (all flags `true`) + the `Preferences` type (has `flagPolice`/`flagLowLight`/`flagCommunityReports`).
- `lib/api/zones.ts` exports `ZoneCategory = 'lighting' | 'landuse' | 'park' | 'police' | 'wildlife' | 'road-condition' | 'community-report'`; `Zone.category?` is optional.
- `usePreferences()` returns `{ preferences }` where `preferences: Preferences | null` (null pre-hydration).
- /home + /en-route both have `const allZones = useMemo(() => [...osmZones, ...reportZones], …)`; consumers enumerated in Tasks 2–3.

---

## File Structure

| File | Change |
|------|--------|
| `lib/api/preferences.ts` | **Modify** — add pure `isZoneCategoryEnabled(category, preferences)` |
| `app/home.tsx` | **Modify** — per-source enabled derivations + redirect consumers + gate report markers |
| `app/en-route.tsx` | **Modify** — per-source enabled derivations + redirect consumers (incl. entered-zone detection) |

Branch: `feat/zone-flag-wiring`. Squash-merge to `main` after acceptance.

---

### Task 1: `isZoneCategoryEnabled` helper

**Files:** Modify `lib/api/preferences.ts`

- [ ] **Step 1: Add the import + helper** (place after the `clearStoredPreferences` function)

At the top of `lib/api/preferences.ts`, add the type import (alongside the existing imports):
```ts
import type { ZoneCategory } from './zones';
```
At the end of the file, add:
```ts
/**
 * Whether a zone category currently counts toward scoring + rendering,
 * gated by the user's flag toggles. Categories without a toggle
 * (wildlife / road-condition / landuse / park) are always enabled —
 * they're baseline safety factors. Pure.
 */
export function isZoneCategoryEnabled(
  category: ZoneCategory | undefined,
  preferences: Preferences,
): boolean {
  switch (category) {
    case 'lighting':
      return preferences.flagLowLight;
    case 'police':
      return preferences.flagPolice;
    case 'community-report':
      return preferences.flagCommunityReports;
    default:
      return true; // landuse / park / wildlife / road-condition / undefined
  }
}
```
(Confirm importing a type from `./zones` into `preferences.ts` doesn't create a circular-import problem — it's a `import type` (erased at compile), so it won't. If tsc complains, report it.)

- [ ] **Step 2: Typecheck** — expected no output.
- [ ] **Step 3: Commit**
```bash
git add lib/api/preferences.ts
git commit -m "feat: isZoneCategoryEnabled — maps zone-flag prefs to category gating

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: /home — filter zones by flags

**Files:** Modify `app/home.tsx`

- [ ] **Step 1: Imports.** The file already imports `usePreferences` and from `../lib/scoring`. Add `isZoneCategoryEnabled` + `DEFAULT_PREFERENCES` from `../lib/api/preferences` (add to the existing import from that module if present, else a new import line). Confirm `preferences` is already destructured from `usePreferences()` (it is — `showZones` derives from it).

- [ ] **Step 2: Replace the `allZones` derivation with per-source enabled derivations.** The current (around line 285):
```tsx
  const allZones = useMemo(
    () => [...osmZones, ...reportZones],
    [osmZones, reportZones],
  );
```
becomes:
```tsx
  // Zones gated by the user's flag toggles (filtered per-source so the
  // overlay, scoring, counts, and report markers all respect the flags).
  const prefs = preferences ?? DEFAULT_PREFERENCES;
  const enabledOsmZones = useMemo(
    () => osmZones.filter((z) => isZoneCategoryEnabled(z.category, prefs)),
    [osmZones, prefs],
  );
  const enabledReportZones = useMemo(
    () => reportZones.filter((z) => isZoneCategoryEnabled(z.category, prefs)),
    [reportZones, prefs],
  );
  const enabledZones = useMemo(
    () => [...enabledOsmZones, ...enabledReportZones],
    [enabledOsmZones, enabledReportZones],
  );
```

- [ ] **Step 3: Redirect every `allZones` / `osmZones` / `reportZones` consumer** to the matching enabled set. Repoint each site (verify line numbers; they shift after Step 2):

  | Consumer (current) | Repoint to |
  |---|---|
  | `pickWinner(rawRoutes, allZones)` (~295) | `pickWinner(rawRoutes, enabledZones)` |
  | `routeZoneCounts` memo `for (const zone of allZones)` + dep `[recommended, allZones]` (~452–467) | `enabledZones` (body + dep) |
  | the zone-overlay `osmZones.map((zone) => …)` (~1067) | `enabledOsmZones.map(…)` |
  | `clusteredReports`: `clusterPointZones(reportZones, …)` + dep `[reportZones, …]` (~504–507) | `enabledReportZones` (arg + dep) |
  | the off-screen report EdgeIndicator block that reads `reportZones` (~1305, `reportZones.filter/map(...)`) | `enabledReportZones` |
  | the zone-legend/strip gate `allZones.length > 0` (~1818) | `enabledZones.length > 0` |

  The rule: scoring/counts/legend → `enabledZones`; the osm overlay → `enabledOsmZones`; anything rendering community-report pins (clusters + individual markers + off-screen indicators, all sourced from `reportZones`) → `enabledReportZones`. After this, raw `allZones` should have **no remaining consumers** — it's replaced by `enabledZones` (the Step-2 edit removed the `allZones` binding, so any leftover reference is a tsc error that flags a missed site). `osmZones`/`reportZones` raw state stays (the source of truth + the filters read them).

- [ ] **Step 4: Typecheck.** Expected no output. A `Cannot find name 'allZones'` error means a consumer was missed in Step 3 — fix it. Then grep: `rg -n "allZones" app/home.tsx` should return ZERO hits (it's fully replaced).

- [ ] **Step 5: Manual check (controller verifies on device):** /menu → toggle Police off → the recommended route re-ranks (no longer penalized for police), police zones vanish from the overlay; toggle Low light off → lighting zones gone; toggle Community reports off → report pins disappear from the map. Toggling back restores. Untoggled categories (parks/wildlife) unaffected.

- [ ] **Step 6: Commit**
```bash
git add app/home.tsx
git commit -m "feat: /home — gate zones by flag prefs (scoring + overlay + report pins + counts)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: /en-route — filter zones by flags

**Files:** Modify `app/en-route.tsx`

- [ ] **Step 1: Imports.** The file already imports `usePreferences` (line ~50) and from `../lib/scoring`. Add `isZoneCategoryEnabled` + `DEFAULT_PREFERENCES` from `../lib/api/preferences`. Confirm `preferences` is destructured from `usePreferences()` (it is — `showZones` derives from it at ~261).

- [ ] **Step 2: Replace the `allZones` derivation** (around line 332) with per-source enabled derivations (same shape as /home):
```tsx
  const prefs = preferences ?? DEFAULT_PREFERENCES;
  const enabledOsmZones = useMemo(
    () => osmZones.filter((z) => isZoneCategoryEnabled(z.category, prefs)),
    [osmZones, prefs],
  );
  const enabledReportZones = useMemo(
    () => reportZones.filter((z) => isZoneCategoryEnabled(z.category, prefs)),
    [reportZones, prefs],
  );
  const enabledZones = useMemo(
    () => [...enabledOsmZones, ...enabledReportZones],
    [enabledOsmZones, enabledReportZones],
  );
```
(Verify the current `allZones` is exactly `[...osmZones, ...reportZones]` from `osmZones`/`reportZones` state — it is. If en-route composes `allZones` from different sources, adapt the per-source filters to match.)

- [ ] **Step 3: Redirect the consumers:**

  | Consumer (current) | Repoint to |
  |---|---|
  | `pickWinner(rawRoutes, allZones)` (~347) | `enabledZones` |
  | `routeConditions(route, allZones)` (~383) | `enabledZones` |
  | `hazardsNearTurn(turnPoint, allZones)` (~625) + dep `[activeRoute, nextStepInfo, allZones]` (~635) | `enabledZones` (body + dep) |
  | the zone-overlay `allZones.map(...)` (~1134) | `enabledZones.map(...)` |
  | the entered-zone pill detection reading `osmZones` — `osmZones.flatMap(...)` (~421, dep `[osmZones]` ~430) and `osmZones.filter((z) => z.category === 'police' \|\| 'wildlife' \|\| 'lighting' \|\| 'road-condition')` (~458, dep `[osmZones]` ~466) | `enabledOsmZones` (body + dep — so a disabled category doesn't fire an entry pill) |
  | the report-marker clustering `clusterPointZones(reportZones, …)` (~343, dep `[reportZones, …]` ~344) | `enabledReportZones` (arg + dep — so disabled report pins don't render) |

  Rule: every site that reads `allZones` → `enabledZones`; the two entered-zone-detection sites that read `osmZones` → `enabledOsmZones`; the report-cluster site that reads `reportZones` → `enabledReportZones`. **Verified:** /en-route consumes `reportZones` separately at line ~343 (it renders report markers, same as /home), so all three enabled derivations are used — keep them. After this, raw `allZones` has no consumers (the Step-2 edit removed the binding).

- [ ] **Step 4: Typecheck.** Expected no output. `rg -n "allZones" app/en-route.tsx` → ZERO hits. If `enabledReportZones`/`enabledOsmZones` is unused, remove it (the code-reviewer flags dead bindings).

- [ ] **Step 5: Manual check (controller):** start a route; /menu toggle Police off → en-route route re-ranks, police zones gone from the overlay, the comparison-sheet "Police" chip gone, no police hazard notice, no police entry pill. Same for Low light. Toggling back restores.

- [ ] **Step 6: Commit**
```bash
git add app/en-route.tsx
git commit -m "feat: /en-route — gate zones by flag prefs (scoring + chips + hazards + overlay + entry pill)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Acceptance + merge

**Files:** none.

- [ ] **Step 1: Full typecheck** — expected empty. Plus `rg -n "\ballZones\b" app/home.tsx app/en-route.tsx` → ZERO hits (fully replaced by `enabledZones`).
- [ ] **Step 2: End-to-end manual (simulator):** for each of the 3 flags, toggle off in /menu and confirm the factor disappears from: the recommended route ranking (/home + /en-route), the map overlay, the /home report pins (for community-reports), the /en-route comparison chips + hazard notices + entry pill. Toggle back → restored. Confirm untoggled categories (wildlife/road/park/landuse) are never affected. Confirm `showZones` master toggle still independently hides/shows the overlay.
- [ ] **Step 3: Final code-reviewer subagent** on `git diff main...feat/zone-flag-wiring`. Confirm: `isZoneCategoryEnabled` is pure + correct mapping; `scoreRoute`/`pickWinner`/`routeConditions`/`hazardsNearTurn` are UNCHANGED (only inputs filtered); no raw `allZones` consumers left; no unused enabled-derivation bindings; reserved-color rule intact; the `prefs = preferences ?? DEFAULT_PREFERENCES` fallback is consistent across both screens. Fix + re-review.
- [ ] **Step 4: Squash-merge to `main`**
```bash
git checkout main
git merge --squash feat/zone-flag-wiring
git commit -m "feat: wire zone-flag preference toggles into scoring + map (#44)

flagPolice/flagLowLight/flagCommunityReports now gate their categories out
of route scoring, the map overlay, the comparison chips, the hazard
notices, and the entered-zone pill — via a pure isZoneCategoryEnabled
helper + a per-source enabled-zones filter on /home + /en-route. scoreRoute
and friends stay pure (inputs filtered). Untoggled categories always on.
Phase 1.

Plan: docs/superpowers/plans/2026-05-31-zone-flag-wiring.md

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
git branch -D feat/zone-flag-wiring
```
- [ ] **Step 5:** strike #44 in `docs/next-session.md` (and update the task list); add a `docs/learnings.md` entry if anything non-obvious surfaced (e.g. the filter-at-source pattern keeping `scoreRoute` pure, or per-source vs combined filtering).

---

## Self-Review

**1. Spec coverage:** helper (Task 1); filter-at-source on /home (Task 2) + /en-route (Task 3) covering scoring, overlay, chips, hazards, report pins, AND the entered-zone pill (the spec's "no ghost influence in any surface" — the entry pill is one more surface, included for consistency); untoggled-always-on (the helper's `default: true`); `scoreRoute` pure (only inputs filtered — no signature change). Community-report pins gated (Task 2, via `enabledReportZones`). ✅

**2. Placeholder scan:** the redirect tables enumerate each site with the exact repoint; the `enabledReportZones`-may-be-unused-on-/en-route case is given a concrete decision rule ("use whichever keeps zero unused bindings") rather than left vague. No "handle the rest" hand-waving.

**3. Type/name consistency:** `isZoneCategoryEnabled(category, preferences)` (Task 1) called identically in Tasks 2–3. `enabledZones`/`enabledOsmZones`/`enabledReportZones`/`prefs` names consistent across both screens. `DEFAULT_PREFERENCES` fallback identical. The `allZones`→`enabledZones` replacement is the load-bearing rename; the "grep allZones → zero hits" check in each task catches a missed consumer (tsc also errors on a dangling `allZones`).

**Risk noted:** the main risk is a *missed consumer* leaving a dangling `allZones` reference — caught hard by tsc (removed binding → compile error) + the per-task grep. Both screens are symmetric (verified): each consumes `osmZones` (overlay + en-route entry-pill), `reportZones` (report markers/clustering), and `allZones` (scoring/counts/conditions/hazards), so all three enabled derivations are used on both — no unused bindings.
