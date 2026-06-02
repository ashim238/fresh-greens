# Preferred Stations — Design Spec

**Date:** 2026-06-02
**Status:** Approved (brainstorm) → ready for implementation plan
**Register:** product (app UI)

## Summary

Let the user mark gas/charging stations they **trust**, remember them, surface them when they need fuel mid-drive, and note when one falls on the route safety already chose. The digital descendant of the Green Book's listed service stations: community-trusted establishments as a first-class signal, layered on top of safety routing — never overriding it.

## Thesis connection

The original Green Book listed service stations safe and welcoming to Black travelers. This feature is that idea made personal + actionable: *you* decide whom you trust, the app remembers, and reassures you when a trusted stop is on your way. The trust signal is **additive** — safety still drives every routing decision.

## Scope (confirmed)

Tier 3 — **route-aware, detect-and-surface**. Three layers, each building on the last:

1. **Mark & remember** — star a station, persist it, manage the list.
2. **Surface to the top** — preferred stations lead the on-route fuel list, flagged.
3. **Detect & surface on route** — note when a trusted station is near the recommended route. **No scoring/route-selection change.** The route detect reuses scoring's existing pure geometry helper `isPointNearPolyline` — currently private, so the only edit to `lib/scoring.ts` is adding `export` to that one function (no logic, weight, or behavior change). The route is NOT nudged.

**Explicitly out of scope:** any change to route *selection* or scoring weights (the "also nudge the route" tier was rejected to keep safety primary).

## Architecture

Three layers, mirroring the app's existing structure (`saved-places` is the closest analog).

### 1. Adapter — `lib/api/preferred-stations.ts` (new)

```ts
export type PreferredStation = {
  id: string;            // local uuid (Date.now()+random), NOT the POI id
  name: string;          // station name as shown ("Wawa", "Shell")
  brand?: string;        // optional brand if distinguishable from name
  latitude: number;
  longitude: number;
  setAt: number;         // ms timestamp
};
```

Functions (mirror `saved-places`):
- `getPreferredStations(): Promise<PreferredStation[]>`
- `addPreferredStation(input: { name; brand?; latitude; longitude }): Promise<PreferredStation>` — dedupes by proximity before adding (no duplicate if one already exists within the match radius).
- `removePreferredStation(id: string): Promise<void>`
- `isPreferredStation(place: { latitude; longitude }): Promise<boolean>` — proximity match.
- `clearPreferredStations(): Promise<void>` — sign-out hygiene.

**Matching is by PROXIMITY, not id.** A station retrieved from search (Nominatim) and the same station on-route (Overpass) carry different ids, so id-matching would fail. Use a `PREFERRED_MATCH_DELTA` (~0.0007°, ≈75 m) on lat/lng — the same technique `saved-places` (`SAVED_MATCH_DELTA`) and `regular-destinations` already use. AsyncStorage key: `fresh-greens.preferred-stations.v1`.

### 2. Hook — `hooks/usePreferredStations.ts` (new)

Reactive wrapper, re-reads on focus (like `useSavedPlaces`):
`{ stations: PreferredStation[]; add(place); remove(id); isPreferred(place): boolean }`.
`isPreferred` is computed synchronously against the in-memory `stations` list (proximity) so star toggles render instantly without an async round-trip.

### 3. UI surfaces

**(a) Trust-star toggle — shared component** `components/PreferredStar.tsx` (new)
A small star button: filled (`Star` weight=fill, `colors.wiltedgreen`) when preferred, outline (`Star` weight=regular, `colors.labelTertiary`) when not. Props: `{ preferred: boolean; onToggle: () => void; accessibilityLabel }`. 44 pt tap target via hitSlop on a compact glyph. Used in both marking surfaces below so the affordance is identical everywhere.

**(b) `FuelStopsSheet` (on-route gas/charging list)** — `components/FuelStopsSheet.tsx` (modify)
- Each stop card gains a `PreferredStar` (right side).
- Preferred stations **sort to the top** of `stops`, each carrying a **"Trusted by you"** badge (fadedgreen pill, `colors.burntgreen` text — the safety-affirmative register, NOT a reserved color).
- The sheet is presentational; the parent (`/en-route`, via `useRouteFuelStops`) owns the data, so it passes `isPreferred(stop)` + `onTogglePreferred(stop)` down, and applies the preferred-first sort before passing `stops`.

**(c) Search "Gas" results** — `app/search.tsx` (modify)
When the active quick-tool is `gas`, each result row gains the same `PreferredStar`. (Other categories — Food/Parking — do not; this is fuel-specific.)

**(d) Management list** — `app/fuel.tsx` (modify)
A new **"Preferred stations"** `RowGroup` (fits the settings register already there):
- One row per `PreferredStation`: name (+ brand subtitle), a remove affordance (trailing, e.g. a destructive `X`/trash with an Alert confirm — mirror `/saved-places` removal).
- **Empty state** (no stations yet): a single muted row — *"Star a gas station you trust and it'll show up here."*
- Placed below the existing fuel-form RowGroups (it's reference/management, not part of the reminder form).

**(e) Route-aware detect & surface** — `app/home.tsx` route-preview (modify)
After the recommended route resolves, compute whether any preferred station falls near the route polyline:
- Reuse **`isPointNearPolyline`** from `lib/scoring.ts`. It's currently a private helper, so the plan adds `export` to it (one-word change, no logic touched) and calls it read-only. For each preferred station, test its point against `recommended.coordinates` with a tolerance (~150 m, slightly looser than the marker match since "near your route" ≠ "exactly on it"). No scoring weights or route-selection behavior change.
- If ≥1 matches → render an additive reassurance line in the conditions area: **"A station you trust is on this route."** (with a small `Star`/fuel glyph, fadedgreen/burntgreen register). If 0 → render nothing (no negative "none of your stations are here" copy).
- Memoized on `recommended` + the preferred-stations list so it doesn't recompute per render.

### Sign-out hygiene
Add `clearPreferredStations()` to `/menu`'s `handleSignOut` `Promise.all` (alongside the existing identity-clears).

## Copy + electric adaptation

- Marking/badge: **"Trusted by you"**; star a11y label: "Trust this station" / "Untrust this station".
- Route line: **"A station you trust is on this route."**
- Electric (`fuelType === 'electric'`): the FuelStopsSheet already titles "Charging on your route"; the badge stays "Trusted by you" (works for a charger too). The /home route line can read "A charger you trust is on this route" when `fuelType === 'electric'`, else "station." Keep one small `noun` helper.

## Data flow

1. User taps a `PreferredStar` on a FuelStopsSheet card or a Gas search result → `add`/`remove` via the hook → persisted → star + (in FuelStopsSheet) sort/badge update reactively.
2. `/fuel` reads the hook for the management list; remove there flows through the same hook.
3. `/home` route-preview reads the hook + the recommended route, runs the read-only proximity check, conditionally shows the reassurance line.
4. Sign-out clears the store.

## Edge cases

- **Same station in search + on-route:** proximity match keeps the star state consistent across both surfaces.
- **Dedupe on add:** `addPreferredStation` skips if a station already exists within `PREFERRED_MATCH_DELTA` (prevents near-duplicate entries from Nominatim vs Overpass coordinate jitter).
- **Empty fuel list / no stops:** FuelStopsSheet behavior unchanged when there are no preferred stations (no badge, default order).
- **Route changes:** the /home detect re-runs when `recommended` changes (memo dep).
- **Honesty of disclosure:** the badge reflects a real saved entry; the route line reflects a real proximity check against the actual route geometry. Nothing claims a state it lacks.

## Files

| File | Action |
|---|---|
| `lib/api/preferred-stations.ts` | create — adapter + proximity matching |
| `hooks/usePreferredStations.ts` | create — reactive hook |
| `components/PreferredStar.tsx` | create — shared trust-star toggle |
| `components/FuelStopsSheet.tsx` | modify — star + preferred-first sort + badge |
| `app/search.tsx` | modify — star on Gas results |
| `app/fuel.tsx` | modify — "Preferred stations" management RowGroup |
| `app/home.tsx` | modify — route-aware detect-and-surface line |
| `lib/scoring.ts` | modify — `export` the existing `isPointNearPolyline` helper (no logic change) |
| `app/menu.tsx` | modify — sign-out clears preferred stations |

## Testing / verification

No test runner; `tsc --noEmit` is the gate per task. Device verification: star a station from the on-route fuel sheet → it pins to top with the badge → appears in `/fuel`'s list → a route passing it shows the "trusted station on this route" line → sign-out clears it.
