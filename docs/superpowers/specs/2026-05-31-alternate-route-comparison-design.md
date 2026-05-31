# Alternate-Route Comparison — Design Spec

**Date:** 2026-05-31
**Status:** Approved scope, pending spec review → implementation planning
**Topic:** Make the /en-route "alternate paths" FAB real — a route-comparison sheet that surfaces each route's safety/time/daylight tradeoff and lets the driver switch the active route.

---

## Goal

Replace the /en-route alternate-paths FAB's coming-soon stub with a **route-comparison sheet**: tap the FAB → see the recommended route alongside its alternates, each with duration / arrival / distance / a descriptor / condition chips (low-light, wildlife, police, road), and **tap a route to switch** the active route — the whole screen follows it. Makes the app's "safer, not just faster" tradeoff legible and respects driver agency. Local-only, no new permission.

## Scope decisions (from brainstorm)

- **Reveal + switch** (not reveal-only): the sheet shows the tradeoff AND tapping a route makes it the active route. Switching keeps the safety framing visible (the recommended is always labeled "Safest route"), so it's an informed choice — driver agency is a thesis value (onboarding 3, "your viewpoint is unique").
- **Condition chips** (Figma-faithful, not plain best-at tags): each route shows the safety-condition categories it passes (low-light / wildlife / police / road), derived from the zones we already load — the "why safer" surfacing.
- **Map duration badges included**: each route polyline carries a floating duration badge (the Figma's per-route time labels).
- **Design reference:** Figma node `2:9033` (file `7DDh6c7tk7OKF4WiA7pEkp`, "Drive" comparison frame). It's a Google-Maps-plugin-era frame — **extract the structure** (per-route detail rows, the "Safest route with current conditions" descriptor, the condition chips, the on-map time badges) and **drop the Google chrome** (origin/destination input fields, transport-mode tabs, "Add stops", Google map/sheet styling). Skin everything to the Fresh Greens brand.

## What already exists (builds on)

- `pickWinner(rawRoutes, allZones, departureTime?)` → `RankedRoute[]` = `Route & { type: 'recommended' | 'alternate'; score: number }`, sorted score-descending (index 0 = recommended). Each route carries `id`, `coordinates: LatLng[]`, `estimatedMinutes`, `distanceMeters`, `steps`, `score`.
- `scoreRoute(route, zones, departureTime?)` dispatches per zone geometry (in-polygon for areas, near-polyline ~20 m for streets, point ~30 m for points) — the proximity logic the condition chips reuse.
- /en-route already: computes `routes = pickWinner(...)`, derives `recommended`, renders all routes as polylines (alternates faint, recommended emphasized gradient), and is **hardwired to `recommended`** across ~31 references (turn steps, ETA, distance, daylight, arrival effects keyed on `recommended?.id`, polyline emphasis). `allZones` is in scope. `mapRef` (`useRef<MapView>`) drives `animateToRegion`. The alternate-paths FAB is the `EnRoutePath` FloatingActionButton in the ETA row (currently no-op, label "Show alternate paths (coming soon)").

---

## Architecture — four units + the FAB wiring

### ① Pure helper — `routeConditions(route, zones)` in `lib/scoring.ts`

Returns the deduped set of **condition categories** a route passes near, for the chips:
```ts
export type RouteCondition = 'low-light' | 'wildlife' | 'police' | 'road';
export function routeConditions(route: Route, zones: Zone[]): RouteCondition[];
```
- Maps zone categories → conditions: `lighting` → `low-light`, `wildlife` → `wildlife`, `police` → `police`, `road-condition` → `road`. (landuse/park/community-report are not charted as conditions in v1 — keep the chip set to the four safety factors the thesis names.)
- Reuses the **same per-zone proximity dispatch** `scoreRoute` uses. To stay DRY, extract that dispatch into a shared internal helper `zoneTouchesRoute(zone, route): boolean` that both `scoreRoute` and `routeConditions` call (small, behavior-preserving refactor of `scoring.ts`).
- Pure, deterministic, no I/O.

### ② The `recommended` → `activeRoute` refactor (the high-risk unit)

/en-route gains `const [activeRouteId, setActiveRouteId] = useState<string | null>(null)` (null = follow the recommended). Derive **two** values:
- `recommended` stays = the score winner (`routes.find(type === 'recommended')`) — used only to label the "Safest route" in the sheet and as the fallback.
- `activeRoute = (activeRouteId && routes.find(r => r.id === activeRouteId)) || recommended` — **what the screen follows.**

Repoint the ~31 `recommended` consumers (turn steps, `nextStepInfo`, ETA/`arrivalDisplay`, distance, daylight gradient, the arrival/guard effects keyed on `recommended?.id`, polyline emphasis) to **`activeRoute`**. Polyline emphasis follows `activeRoute?.id` (emphasized gradient) instead of `type === 'recommended'`. Stale `activeRouteId` after a reroute resolves harmlessly via the `|| recommended` fallback. Switching re-runs the arrival/daylight effects (now keyed on `activeRoute?.id`) — desirable.

### ③ The comparison sheet — `components/RouteComparisonSheet.tsx`

A Modal overlay (same pattern as the just-shipped `FuelStopsSheet`). **Presentational** — /en-route prepares the per-route data and passes it in:
```ts
type ComparisonRow = {
  id: string;
  durationLabel: string;     // "2h 44m"
  arrivalLabel: string;      // "Arrive 11:45 AM"
  distanceLabel: string;     // "186 mi"
  descriptor: string;        // recommended → "Safest route with current conditions"; alternate → time delta vs the RECOMMENDED route's duration: "8 min faster" / "4 min longer" (equal → "Same time")
  conditions: RouteCondition[];
  isActive: boolean;
  isRecommended: boolean;
};
```
Props: `{ visible, rows: ComparisonRow[], onSelectRoute: (id) => void, onClose }`. Each row renders duration + arrival + distance + descriptor + condition chips (icon + label per condition, Fresh-Greens-skinned), the active row marked, the recommended row carrying the "Safest route" descriptor. Tapping a row → `onSelectRoute(id)` (which sets `activeRouteId` + closes). Reuses the repo's a11y-correct scrim pattern (`accessible={false}` + `accessibilityViewIsModal`).

### ④ Map duration badges

Each route polyline gets a floating **duration badge** (a `Marker` at a representative point on the route — the alternates already render; this adds the time label per the Figma). Tapping a badge switches the active route (parity with the sheet). Lower-priority task — sequenced last so the sheet+switch lands first.

### FAB wiring

The `EnRoutePath` FAB's `onPress` opens the sheet (`setShowComparison(true)`); its `accessibilityLabel` drops "(coming soon)" → "Compare routes". Clears another coming-soon dead-end.

---

## Data flow

1. /en-route computes `routes = pickWinner(...)`, `recommended`, `activeRoute`.
2. Tap the alternate-paths FAB → `setShowComparison(true)`.
3. /en-route builds `rows: ComparisonRow[]` from `routes` (duration/arrival/distance via existing format helpers + `formatTimeOfDay`; descriptor from recommended-vs-time-delta; `conditions` via `routeConditions(route, allZones)`; `isActive`/`isRecommended` flags).
4. `<RouteComparisonSheet rows={rows} onSelectRoute={...} />` renders.
5. Tap a row → `setActiveRouteId(id)` + close. `activeRoute` recomputes → the whole screen (ETA, turns, distance, daylight, polyline emphasis) follows the new route; the arrival effects re-run.
6. Map badges read the same `routes` + durations; tapping one also `setActiveRouteId`.

---

## Honesty / App Store

- Real data throughout (computed routes, scores → condition chips, daylight). No fabrication.
- The alternate-paths FAB stops being a "coming soon" dead-end.
- No new permission (routes/zones already loaded; no new data source).
- Switching is honest: the recommended is always labeled "Safest route," so choosing a faster alternate is an informed tradeoff, not a hidden downgrade.

---

## Implementation decomposition — one plan, ordered by risk

Single plan, tasks sequenced so the foundation lands before the UI and the risky refactor is isolated:
1. `routeConditions` helper + the `zoneTouchesRoute` extraction (pure; self-contained).
2. **`recommended` → `activeRoute` refactor** (high-risk; the 31-ref repoint + `activeRouteId` state + polyline emphasis). Isolated as its own task/commit so a regression is easy to bisect.
3. `RouteComparisonSheet` component (presentational).
4. Wire the FAB → sheet + the per-route `ComparisonRow` derivation + switch.
5. Map duration badges (+ tap-to-switch parity).
6. Acceptance + merge.

---

## Dependencies & risks

- **The 31-ref refactor (②)** is the main risk — mechanical but wide, in the most complex screen. Mitigate: grep every `recommended` reference and repoint systematically; tsc + the spec-reviewer catch misses; isolate as its own commit. Keep `recommended` as a distinct derived value (don't delete it — the sheet's "Safest" label + the fallback need it).
- **`zoneTouchesRoute` extraction** must be behavior-preserving for `scoreRoute` (the scoring is thesis-load-bearing). Verify `scoreRoute`'s output is unchanged after the extraction.
- **Map badge overlap** when routes converge — badges may collide near shared segments. v1: place each badge at the route's midpoint and accept some overlap; note for the Figma audit. Don't over-engineer divergent-point math now.
- **Stale `activeRouteId` on reroute** — resolved by the `|| recommended` fallback; confirm the screen snaps back to recommended when the active id disappears.
- **OSRM alternates availability** — `alternatives=true` usually yields 1–2 alternates. Decision for the zero-alternates case: **keep the FAB and show the single recommended row** in the sheet (labeled "Safest route" with its condition chips). The FAB stays put (hiding it would unbalance the ETA-row bracket layout), and a one-row sheet is still honest/useful (your route's conditions at a glance) rather than a dead-end. No special single-route screen.

## Success criteria

- The alternate-paths FAB opens a real comparison sheet — no "coming soon".
- Each route row shows duration + arrival + distance + descriptor + condition chips; the recommended is labeled "Safest route with current conditions".
- Tapping a route switches the active route — ETA, distance, daylight, turn steps, and polyline emphasis all follow it; tapping the recommended switches back.
- Each route polyline shows a duration badge on the map.
- Real data, local-only, no new permission, no fabricated values.

## Out of scope

- Live re-routing / fetching *new* alternates (we compare/switch among the already-computed `pickWinner` set).
- Showing raw numeric safety scores to users (chips, not numbers).
- Turn-by-turn / voice changes (separate track).
- A single-route case where OSRM returns no alternates is handled gracefully but not specially designed.
