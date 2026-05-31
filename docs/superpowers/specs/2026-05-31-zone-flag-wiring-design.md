# Zone-Flag Wiring (#44) — Design Spec

**Date:** 2026-05-31
**Status:** Approved scope, pending spec review → implementation planning
**Topic:** Make the /menu Zone Preferences toggles actually do something — wire `flagPolice` / `flagLowLight` / `flagCommunityReports` into route scoring and the map.

---

## Goal

The three Zone-Preferences toggles persist (via `usePreferences` / `preferences.ts`) but currently change nothing. When a flag is OFF, its zone category must stop affecting the route score AND stop appearing on the map — and, for consistency, stop driving the comparison-sheet condition chips and the en-route hazard notices.

## Design decisions (from brainstorm)

- **Untoggled categories are always factored.** The 3 toggles cover `lighting` (flagLowLight), `police` (flagPolice), `community-report` (flagCommunityReports). The other categories — `wildlife`, `road-condition`, `landuse`, `park` — have no toggle and stay always-on (baseline safety factors). No new toggle UI (out of scope).
- **Filter at the source, once.** Derive an `enabledZones` from `allZones` and point every existing `allZones` consumer at it. This keeps `scoreRoute` pure (no flag param — it just scores the zones it's given), and makes scoring, the map overlay, the condition chips, and the hazard notices all respect the flags from one filter.
- **Extend to chips + hazards** (confirmed): a disabled flag removes its category from scoring, the map overlay, the comparison-sheet condition chips, AND the en-route hazard notices — so the app never scores, maps, chips, or warns about a factor the user turned off.

## Architecture

### ① Pure helper — `isZoneCategoryEnabled(category, preferences)` in `lib/api/preferences.ts`

```ts
import type { ZoneCategory } from './zones';

/** Whether a zone category currently counts — gated by the user's flag
    toggles. Categories without a toggle (wildlife/road-condition/landuse/
    park) are always enabled. Defaults to enabled when a flag is missing
    (matches DEFAULT_PREFERENCES' all-true intent). */
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
Pure. (Confirm `ZoneCategory` is exported from `lib/api/zones.ts` — it is.)

### ② Filter at the source on `/home` + `/en-route`

Both screens have `const allZones = useMemo(() => [...osmZones, ...reportZones], …)` feeding `pickWinner(rawRoutes, allZones)` and the overlay/chips/hazards. Add, right after `allZones`:
```ts
const enabledZones = useMemo(
  () => allZones.filter((z) => isZoneCategoryEnabled(z.category, preferences ?? DEFAULT_PREFERENCES)),
  [allZones, preferences],
);
```
Then redirect the consumers from `allZones` → `enabledZones`:
- `pickWinner(rawRoutes, enabledZones)` (both screens) — re-ranks on toggle.
- the zone overlay render (en-route renders from `allZones`; /home renders from `osmZones` — both gate to enabled categories; simplest is to render the enabled subset).
- `routeConditions(route, enabledZones)` (en-route comparison chips).
- `hazardsNearTurn(turnPoint, enabledZones)` + the home police/lighting counts that read `allZones`.

`scoreRoute` / `pickWinner` / `routeConditions` / `hazardsNearTurn` are **unchanged** — they just receive the filtered set. Note: `preferences` already changes identity on toggle, so the `enabledZones` memo (and everything downstream) recomputes automatically.

### ③ Community-report markers

On /home, community reports also render as `LandmarkMarker`s (separate from the osm-zone overlay). Gate that marker render on `isZoneCategoryEnabled('community-report', preferences)` (or `preferences.flagCommunityReports`) so a disabled report category disappears from the map pins too — not just from scoring. (En-route renders reports via the same zone path, so the `enabledZones` filter already covers it there; verify per-screen during implementation.)

## Data flow

`osmZones + reportZones → allZones → enabledZones (filtered by flags) → { pickWinner, overlay, routeConditions, hazardsNearTurn }`. Toggling a flag in /menu changes `preferences` identity → `enabledZones` recomputes → routes re-rank, overlay/chips/hazards update. No new state, no new permission, local-only.

## Honesty / consistency

When a user turns off a factor, the app is consistent everywhere: it doesn't penalize routes for it, doesn't draw it, doesn't chip it, and doesn't warn about it. No "ghost" influence left in any surface.

## Out of scope

- New toggles for the untoggled categories (wildlife/road-condition/landuse/park stay always-on).
- Any change to `scoreRoute`/`pickWinner`/`routeConditions`/`hazardsNearTurn` internals (they stay pure; only their *input* is filtered).
- The `showZones` master toggle (unchanged — it still gates whether the overlay renders at all; the flags filter *which categories* within it).

## Success criteria

- Toggling `flagPolice` / `flagLowLight` / `flagCommunityReports` off in /menu: the corresponding zones stop affecting the recommended route (re-rank), stop rendering on the map (overlay + community markers), stop appearing as comparison chips, and stop triggering hazard notices.
- Untoggled categories are unaffected by any toggle.
- `scoreRoute` and friends remain pure (verified: no flag parameter added).
- tsc clean; no new permission; local-only.

## Files touched

- `lib/api/preferences.ts` — add `isZoneCategoryEnabled`.
- `app/home.tsx` — `enabledZones` derivation; redirect consumers; gate community-report markers.
- `app/en-route.tsx` — `enabledZones` derivation; redirect consumers (pickWinner, routeConditions, hazardsNearTurn, overlay).
