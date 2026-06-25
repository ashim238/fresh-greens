# Spike: MKLocalSearch phone enrichment for tow-pick

**Branch:** `spike/mklocalsearch-tow-phone`  
**Status:** Shipped on branch — `expo-apple-mapkit@0.2.0`, tow-pick UI in `/roadside`, MKLocalSearch verified on iOS dev build (2026-06-25). Match heuristics: `npx tsx lib/enrich-place-phone.fixtures.ts`.
**Spec:** `docs/next-session.md` (Roadside `tow-pick` row)

## Goal

Prove we can attach `phone?: string` to Mapbox-ranked `Place` rows via iOS
MKLocalSearch, so `tow-pick` can offer in-app `tel:` without Maps handoff.

## Architecture (locked in grill-me)

1. **Mapbox** `searchPlaces("tow truck", userLocation)` — ranked list (existing).
2. **MKLocalSearch** — enrich each row by name + proximity; set `Place.phone`.
3. **UI (follow-up PR)** — `tow-pick` sub-step in `/roadside`; progressive rows.

## Candidate dependency

**[`expo-apple-mapkit`](https://github.com/evanoralph/expo-apple-mapkit)** — Expo module,
SDK 54+, returns `phoneNumber?: string` on search results. iOS-only (acceptable for
thesis iPhone-first scope).

Alternatives considered:

| Option | Verdict |
|--------|---------|
| `react-native-mk-local-search` | Bare RN module; more manual linking vs expo-apple-mapkit |
| Mapbox `/retrieve` metadata | Phone in `metadata` is often sales-gated; try after MK |
| Apple Maps URL handoff | Rejected in grill-me — context loss, no dispatch guarantee |

**Before `npm install`:** confirm install size + dev-build requirement with user per
`.cursorrules` anti-slop #4.

## Adapter seam (this spike)

- `Place.phone?: string` on `lib/api/places.ts`
- `lib/api/enrich-place-phone.ts` — `enrichPlacesWithPhone(places, origin)`
- `lib/api/sources/apple-mapkit.ts` — MK bridge (throws `UnavailableError` until module wired)

## Verification plan (dev build required)

1. Install `expo-apple-mapkit`; `npx pod-install`; EAS/dev build on device or Simulator.
2. Run spike from a temp dev-only affordance OR `npx tsx` script that calls the adapter
   with a fixed coord (e.g. NYC / user's test area).
3. Log hit rate: N Mapbox tow POIs → M with non-empty `phone`.
4. Record in `docs/learnings.md` if hit rate &lt; 50% (may need coordinate+name matching tuning).

## Match strategy (v1)

For each Mapbox `Place`:

1. MKLocalSearch natural query: `place.name` (or `"${place.name} tow"` if name is generic).
2. Region: circle ~2 km around `place.latitude/longitude`.
3. Pick best MK result by name similarity + distance &lt; 200 m.
4. Copy `phoneNumber` when present.

## UNVERIFIED-IN-RUNTIME

All MK paths until dev build spike completes.
