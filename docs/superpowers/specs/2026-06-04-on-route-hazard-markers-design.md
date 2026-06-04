# On-route hazard markers — design

**Date:** 2026-06-04
**Status:** Approved (brainstorm)

## Problem

The /home route-preview chip says *"1 low-light zone"* / *"1 police zone"*
but the user can't see *where* that zone falls on the route without
hunting the map. The signal is abstract; the spatial fact is missing.
Worse, the chips and the score now agree on hazards (after the
line-based `routePassesZone` fix), but there's no visual evidence on the
map that links a count to a place.

The /en-route turn card already drops per-hazard glyphs near upcoming
turns via `hazardsNearTurn` (`HAZARD_PROXIMITY_METERS = 200m`), but it
deliberately excludes police (`zoneToHazardCategory` returns null) on
the theory that police is stationary and not "watch out, this is on
your route." That stance was correct when the alternative was a blanket
on-route warning, but it leaves a real awareness gap as the driver
approaches a precinct.

## Goals

- **A.** Drop a small **yellow zone marker on the /home route preview**
  at each OSM hazard the selected route passes — *low-light, wildlife,
  road, police* — snapped to the route line.
- **B.** **Surface police on the /en-route turn card** as a
  proximity-gated heads-up using the existing 200m hazard pipeline.

## Non-goals

- Community reports get no second marker (the orange eye pins stay).
- No on-map yellow teardrop for police *during* en-route (the existing
  `enRouteZones` filter excludes points + police; left as-is).
- No live-police-location data source. The forward-looking framing —
  "the definition widens when we have live data" — lives in the
  docstring on `zoneToHazardCategory`.
- No new color tokens. Yellow `#FFCC00` is already in
  `theme/colors.ts` as the reserved caution signal.

## Design

### Visual

Reuse `components/EnRouteZone.tsx` (canonical Figma `1133:13297`,
already shipped on /en-route) in `state="default"`. Yellow teardrop +
caution-diamond + per-type glyph: low-light / wildlife / road /
**police (new)**. 62×50, drop-shadow baked into the SVG. The tail tip
sits on the snapped coord.

**New asset:** `assets/illustrations/enroute-hazard-police.svg` — the
user's `Group 12.svg`, 62×50, matching the existing
`enroute-hazard-*.svg` family (same yellow `#FFCC00`, same dual M3
drop-shadow filter, same diamond + clipped 24px inner glyph). Reserved-
color rule unaffected — yellow is the documented caution-signal token
in this register.

### Geometry — `nearestPointOnPolyline`

New pure helper in `lib/scoring.ts`:

```ts
export function nearestPointOnPolyline(
  point: Coordinate,
  polyline: Coordinate[],
): Coordinate;
```

Projects `point` onto the nearest segment of `polyline` (reuses the
same equirectangular projection math as the existing
`pointToSegmentDistanceMeters`). Used to snap a zone's anchor onto the
route line so the marker reads as "the hazard is HERE on your path,"
not floating off-route. Pure, total: an empty polyline returns the
input (defensive; callers gate on route presence).

### Data — `routeHazardMarkers` (/home)

New `useMemo` derived from `selectedRoute` + `enabledOsmZones`:

1. Keep only OSM zones whose `routeHazardType(zone)` returns one of
   `police | lowLight | wildlife | road` (excludes community-report by
   design; excludes safe-typed zones; excludes the no-warning lighting
   variants).
2. Keep only zones where `routePassesZone(selectedRoute.coordinates,
   zone)` — same line-based predicate the score + chips use, so
   *marker presence, chip presence, chip count, and score all agree on
   what a route passes.*
3. Map each to `{ coord: nearestPointOnPolyline(zoneAnchor(zone),
   selectedRoute.coordinates), category, id: zone.id }`.
4. Slice to the top **6** by `ROUTE_HAZARD_ORDER` priority. The chip
   carries the authoritative count if there are more — markers are a
   display affordance, not the source of truth.

Renders only when `selectedRoute` is set; absent in browse mode.

### Police on the en-route turn card

Six tsc-enforced sites (every `Record<HazardCategory, …>` and `switch
(category)` flags the missing branch at compile-time, so this can't
land half-done):

1. **`lib/scoring.ts`** — `HazardCategory` union gains `'police'`.
2. **`lib/scoring.ts`** — `HAZARD_SEVERITY`: `police: 1` (lowest;
   demotes existing entries — community-alert: 5, wildlife: 4,
   road-condition: 3, lighting: 2, police: 1). Distinct values
   preserved (the existing tie-breaker comment stays true). Police as
   the lowest severity means when more than 2 hazards cluster near a
   turn, police yields the slot to anything more urgent — exactly the
   "awareness, not action-required" framing.
3. **`lib/scoring.ts`** — `zoneToHazardCategory`: police case returns
   `'police'` (was `null`). Docstring updated to capture the
   forward-looking framing: "Today static OSM precincts within 200m of
   a turn. The definition widens when live police-location data is
   available — same surface, richer data."
4. **`app/en-route.tsx`** — `humanReadableHazard`: police case →
   `'Police presence'`.
5. **`app/en-route.tsx`** — `hazardFullCopy`: police case → e.g.
   `'Stationary police presence near this turn.'`
6. **`components/EnRouteZone.tsx`** — `DefaultMarker` police branch
   renders `EnrouteHazardPolice` (new import). **Not** added to
   `ExtendedPill` — the "For 0.5 mi." copy only makes sense for length
   zones (polygons/polylines), and police is a point. Police points
   never reach the en-route on-map zone-marker pipeline (the existing
   `enRouteZones` filter excludes points), so the absence is correct.

### Surfaces, summarized

| Surface                                  | Police | Low-light | Wildlife | Road | Community |
|------------------------------------------|--------|-----------|----------|------|-----------|
| /home preview — new yellow marker        | ✅     | ✅        | ✅       | ✅   | ❌ (eye pin) |
| /home preview — orange chip + count      | ✅     | ✅        | ✅       | ✅   | ✅         |
| /en-route turn card glyph (200m gate)    | ✅ NEW | ✅        | ✅       | ✅   | ✅         |
| /en-route on-map yellow teardrop         | ❌     | ✅        | ✅       | ✅   | ❌         |

### Reserved-color hygiene

Add a one-line carve-out to `.cursorrules` documenting **yellow =
on-map hazard-zone markers** (the US road-sign caution metaphor) as the
deliberate companion to the orange chip register. Same level of
documentation as the existing carve-outs (#5 recording-red, #9
favorite-star).

## Lifecycle

Markers are children of `<MapView>`, like the other on-route overlays.
Each is keyed `hazard-${zone.id}-${snapshotEpoch}` so they survive zoom
+ route-switch the way the user dot + finish pin do (the
`markerSnapshotEpoch` we proved out via the chevron-vanish thread).
`tracksViewChanges={false}` inherited from `EnRouteZone`'s existing
behavior — fine, because the snapshot epoch forces a remount on the
reflow triggers that would otherwise evict the cached bitmap.

## Error handling

- Empty route coordinates → `routeHazardMarkers` returns `[]`
  (defensive).
- `zoneAnchor` returns `null` for empty zones → skipped in the
  flat-map.
- Police precinct with no street network coverage near it: the route
  simply doesn't pass within 30m (point) and the marker doesn't render
  — consistent with chip behavior.

## Testing

No test runner in the repo (verified-static + device pass).

1. **`npx tsc --noEmit`** — clean for the touched files. The
   tsc-enforced `Record<HazardCategory, …>` and `switch (category)`
   sites are what guarantee the six update sites land coherently.
2. **Throwaway-node assertion** for `nearestPointOnPolyline`:
   - point exactly on a segment → returns the same point;
   - point perpendicular to a long segment → returns the perpendicular
     foot;
   - point past the segment end → returns the clamped endpoint.
3. **Device test:**
   - /home: pick a route that passes 1–2 OSM low-light + 1 police zone
     → the route shows two yellow zone markers snapped to the line, the
     chip block shows the matching counts, and the score reflects them.
   - /en-route: drive (or simulate) toward a precinct → the turn card
     surfaces the police glyph within 200m of the upcoming turn, yields
     the slot to wildlife/road when both are nearby.

## Files touched

- `lib/scoring.ts` — `nearestPointOnPolyline` (new), `HazardCategory`
  + `HAZARD_SEVERITY` + `zoneToHazardCategory` (police).
- `app/home.tsx` — `routeHazardMarkers` memo + render.
- `app/en-route.tsx` — `humanReadableHazard`, `hazardFullCopy` (police
  branches).
- `components/EnRouteZone.tsx` — police branch in `DefaultMarker`,
  import of the new SVG.
- `assets/illustrations/enroute-hazard-police.svg` — new (62×50 default
  marker; user-provided).
- `.cursorrules` — one-line carve-out documenting yellow on-map hazard
  markers.

## Workflow

- **Step 13 (per-PR audit)** required before merge: code-reviewer +
  mobile-ux-optimizer subagent pass.
- **Step 12 (periodic fidelity audit) is overdue** — last audit was
  PROJECT-A/B, 25+ PRs ago, and this PR is itself a design-system
  expansion. **After this PR**, the next branch should be
  `chore/figma-fidelity-audit-N` before more features.
