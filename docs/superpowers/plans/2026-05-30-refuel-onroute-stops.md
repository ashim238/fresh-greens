# Refuel Reminders — Plan 2 (On-Route Fuel Stops) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On /en-route, when a refuel reminder is set up, surface gas/charging stations **along the active route** — a fuel entry in the Full bottom sheet (with a "due" badge when the reminder is past due) that opens a sheet of route-proximate stops.

**Architecture:** A pure geo helper (`lib/geo.ts`) measures a point's distance to the route polyline; a `useRouteFuelStops` hook fetches POIs via the existing `searchPlaces` Mapbox adapter (query tuned by fuel type) and filters them to those near the route; a presentational `FuelStopsSheet` lists them; /en-route renders a gated fuel entry in the Full bottom sheet that opens the sheet. Local-only, reuses Plan 1's `useFuelProfile`. No new dependency, no new permission.

**Tech Stack:** React Native + Expo + TypeScript, expo-router, `lib/api/places.ts` (Mapbox Search Box), theme tokens.

---

## ⚠️ Verification model (read first)

**No test runner exists** (no jest/test files). Per `CLAUDE.md`, verification is `npx tsc --noEmit` + manual simulator check + code-reviewer subagent. Each task: **edit → typecheck → (manual where applicable) → commit**. No TDD.

**Typecheck command:**
```bash
npx tsc --noEmit 2>&1 | grep -v -E '@expo/vector-icons|@vercel/node|avatar\.png' | head -40
```
Expected after every task: no output.

**Confirmed facts this plan builds on:**
- `searchPlaces(query: string, userLocation: { latitude; longitude }): Promise<Place[]>` — `Place = { id, name, address, latitude, longitude, distanceMiles }`, returns ≤10 sorted by distance to user (`lib/api/places.ts`).
- `useFuelProfile()` returns `{ profile, ... }`; `profile: FuelProfile | null` with `remindersEnabled`, `fuelType`, `nextReminderAt` (Plan 1).
- /en-route: `recommended?.coordinates` is the route polyline (`{ latitude; longitude }[]`); the bottom sheet's `sheetContent` View holds the `etaRow` then a Full-state hazard panel gated on `sheetExpanded`; `userLocation` state exists; the side-button column is crowded (Volume/SOS/Report/Shield + a future alternate-paths FAB) → fuel entry goes in the **bottom sheet**, not the column.
- `lib/edge-indicators.ts` exports `LatLng` but **no** meters-distance helper — Task 1 adds one.

---

## File Structure

| File | Responsibility | Change |
|------|----------------|--------|
| `lib/geo.ts` | Pure great-circle distance + point-to-route distance | **Create** |
| `hooks/useRouteFuelStops.ts` | Fetch POIs (query by fuel type) + filter to route-proximate | **Create** |
| `components/FuelStopsSheet.tsx` | Presentational list of route fuel stops (overlay card) | **Create** |
| `app/en-route.tsx` | Gated fuel entry in Full sheet + render sheet + station tap | **Modify** |

Branch: `feat/refuel-onroute-stops`. Squash-merge to `main` after acceptance.

---

### Task 1: `lib/geo.ts` — pure distance helpers

**Files:** Create `lib/geo.ts`

- [ ] **Step 1: Create the file**

```ts
// Fresh Greens — pure geo distance helpers.
//
// No I/O, deterministic. Used by the on-route fuel-stops feature to keep
// only POIs that sit near the active route polyline. Kept separate from
// lib/edge-indicators.ts (which does screen-space bearing/clamp math, not
// great-circle meters).

import type { LatLng } from './edge-indicators';

const EARTH_RADIUS_M = 6_371_000;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Great-circle distance between two coordinates, in meters (haversine). */
export function haversineMeters(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Approximate distance (meters) from `point` to a route `polyline`,
 * computed as the minimum great-circle distance to any vertex.
 *
 * This is a vertex approximation, not true point-to-segment distance —
 * but OSRM route geometry is densely sampled (vertices every few meters
 * on surface streets), so the error is small and the math stays simple
 * and allocation-free. Returns Infinity for an empty polyline so callers
 * treat "no route" as "nothing is near it".
 */
export function distanceToPolylineMeters(
  point: LatLng,
  polyline: LatLng[],
): number {
  let min = Infinity;
  for (const vertex of polyline) {
    const d = haversineMeters(point, vertex);
    if (d < min) min = d;
  }
  return min;
}
```

- [ ] **Step 2: Typecheck** — run the command. Expected: no output. (Confirms the `LatLng` import from `./edge-indicators` resolves.)

- [ ] **Step 3: Commit**
```bash
git add lib/geo.ts
git commit -m "feat: pure geo distance helpers (haversine + point-to-route)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: `hooks/useRouteFuelStops.ts` — fetch + filter to the route

**Files:** Create `hooks/useRouteFuelStops.ts`

- [ ] **Step 1: Create the hook**

```ts
import { useEffect, useState } from 'react';

import { searchPlaces, type Place } from '../lib/api/places';
import type { FuelType } from '../lib/api/fuel';
import type { LatLng } from '../lib/edge-indicators';
import { distanceToPolylineMeters } from '../lib/geo';

/** Keep stops within this distance of the route polyline. ~1.5 km is a
    short detour; tune on device (spec risk note). */
const ROUTE_PROXIMITY_METERS = 1500;

/** Mapbox category query per fuel type — electric searches charging,
    everything else searches gas. */
function fuelQuery(fuelType: FuelType): string {
  return fuelType === 'electric' ? 'ev charging' : 'gas station';
}

export type RouteFuelStopsState = {
  stops: Place[];
  loading: boolean;
  error: boolean;
};

/**
 * Fetches fuel/charging POIs near the user and keeps only those within
 * ROUTE_PROXIMITY_METERS of the active route polyline, sorted by distance
 * to the user (searchPlaces already returns that order; the proximity
 * filter preserves it). Only fetches when `active` (the sheet is open) so
 * we don't spend Mapbox calls on every /en-route mount.
 */
export function useRouteFuelStops(params: {
  active: boolean;
  routeCoords: LatLng[];
  fuelType: FuelType;
  userLocation: { latitude: number; longitude: number } | null;
}): RouteFuelStopsState {
  const { active, routeCoords, fuelType, userLocation } = params;
  const [state, setState] = useState<RouteFuelStopsState>({
    stops: [],
    loading: false,
    error: false,
  });

  useEffect(() => {
    if (!active || !userLocation || routeCoords.length === 0) return;
    let cancelled = false;
    setState({ stops: [], loading: true, error: false });
    (async () => {
      try {
        const results = await searchPlaces(fuelQuery(fuelType), userLocation);
        const onRoute = results.filter(
          (p) =>
            distanceToPolylineMeters(
              { latitude: p.latitude, longitude: p.longitude },
              routeCoords,
            ) <= ROUTE_PROXIMITY_METERS,
        );
        if (!cancelled) setState({ stops: onRoute, loading: false, error: false });
      } catch (err) {
        console.warn('[fuel-stops] search failed:', err);
        if (!cancelled) setState({ stops: [], loading: false, error: true });
      }
    })();
    return () => {
      cancelled = true;
    };
    // routeCoords is a new array each render; key the effect on its length
    // + the active/fuelType/userLocation identity instead to avoid refetch
    // storms. Length changes when a reroute lands, which is when we'd want
    // a refresh anyway.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, fuelType, userLocation, routeCoords.length]);

  return state;
}
```

- [ ] **Step 2: Typecheck** — expected no output. (Confirms `searchPlaces`/`Place` import, `FuelType` import, `distanceToPolylineMeters` import all resolve.)

- [ ] **Step 3: Commit**
```bash
git add hooks/useRouteFuelStops.ts
git commit -m "feat: useRouteFuelStops — POIs filtered to the active route

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: `components/FuelStopsSheet.tsx` — presentational list

**Files:** Create `components/FuelStopsSheet.tsx`

- [ ] **Step 1: Create the component** (a bottom overlay card; theme-token-correct; reconcile fidelity vs Figma in a later audit)

```tsx
import { Ionicons } from '@expo/vector-icons';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { type Place } from '../lib/api/places';
import { type FuelType } from '../lib/api/fuel';
import { colors } from '../theme/colors';
import { pressedDim } from '../theme/interaction';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

/**
 * FuelStopsSheet — gas/charging stations along the active route. Presented
 * as a bottom overlay sheet over /en-route (Modal so it sits above the map
 * + the en-route bottom sheet). Purely presentational: the parent owns the
 * data (useRouteFuelStops) and the select/close handlers.
 */
export function FuelStopsSheet({
  visible,
  loading,
  error,
  stops,
  fuelType,
  onSelectStop,
  onClose,
}: {
  visible: boolean;
  loading: boolean;
  error: boolean;
  stops: Place[];
  fuelType: FuelType;
  onSelectStop: (stop: Place) => void;
  onClose: () => void;
}) {
  const title = fuelType === 'electric' ? 'Charging on your route' : 'Gas on your route';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close fuel stops">
        {/* Inner Pressable swallows taps so tapping the card doesn't close it. */}
        <Pressable style={styles.card} onPress={() => {}}>
          <SafeAreaView edges={['bottom']}>
            <View style={styles.header}>
              <Text style={styles.title}>{title}</Text>
              <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" hitSlop={12}>
                <Ionicons name="close" size={24} color={colors.labelSecondary} />
              </Pressable>
            </View>

            {loading ? (
              <Text style={styles.message}>Finding stops near your route…</Text>
            ) : error ? (
              <Text style={styles.message}>Couldn’t load stops. Check your connection and try again.</Text>
            ) : stops.length === 0 ? (
              <Text style={styles.message}>No stops found along your route.</Text>
            ) : (
              <FlatList
                data={stops}
                keyExtractor={(s) => s.id}
                accessibilityRole="list"
                style={styles.list}
                renderItem={({ item }) => (
                  <Pressable
                    style={({ pressed }) => [styles.row, pressed && pressedDim]}
                    onPress={() => onSelectStop(item)}
                    accessibilityRole="button"
                    accessibilityLabel={`${item.name}, ${item.distanceMiles} miles away`}
                    accessibilityHint="Shows this stop on the map"
                  >
                    <View style={styles.rowText}>
                      <Text style={styles.rowName} numberOfLines={1}>{item.name}</Text>
                      <Text style={styles.rowAddress} numberOfLines={1}>{item.address}</Text>
                    </View>
                    <Text style={styles.rowDistance}>{item.distanceMiles} mi</Text>
                  </Pressable>
                )}
              />
            )}
          </SafeAreaView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.2)',
    justifyContent: 'flex-end',
  },
  card: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    maxHeight: '70%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: spacing.sm,
  },
  title: { ...typography.title3Emphasized, color: colors.black },
  message: { ...typography.bodyRegular, color: colors.labelSecondary, paddingVertical: spacing.lg },
  list: { marginTop: spacing.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 56,
    borderBottomWidth: 1,
    borderBottomColor: colors.separatorSubtle,
  },
  rowText: { flex: 1, gap: 2 },
  rowName: { ...typography.bodyEmphasized, color: colors.black },
  rowAddress: { ...typography.footnoteRegular, color: colors.labelSecondary },
  rowDistance: { ...typography.subheadlineRegular, color: colors.labelSecondary },
});
```

- [ ] **Step 2: Verify theme tokens** used (`title3Emphasized`, `bodyRegular`, `bodyEmphasized`, `footnoteRegular`, `subheadlineRegular`; `colors.white/black/labelSecondary/separatorSubtle`; `spacing.xs/sm/md/lg`):
```bash
rg -n "title3Emphasized|subheadlineRegular" theme/typography.ts
rg -n "labelSecondary:|separatorSubtle:" theme/colors.ts
```
All should appear (they were confirmed to exist in Plan 1's `/fuel` screen, plus `title3Emphasized`/`subheadlineRegular` are used widely). Substitute the real name if any differs; do NOT invent tokens or inline hex (the `rgba(0,0,0,0.2)` scrim matches the existing modal-scrim convention used by /report — confirm with `rg -n "rgba\(0,0,0,0.2\)" app/` and reuse the same value).

- [ ] **Step 3: Typecheck** — expected no output.

- [ ] **Step 4: Commit**
```bash
git add components/FuelStopsSheet.tsx
git commit -m "feat: FuelStopsSheet — route fuel-stops list overlay

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Wire the fuel entry into /en-route

**Files:** Modify `app/en-route.tsx`

This task edits a large, complex file. **Read the surrounding render first** (the `sheetContent` View ~line 1544+, the Full-state hazard panel that follows the `etaRow`, and how the screen centers the map — search the file for `animateToRegion` / a `MapView` ref) before inserting, and follow the existing patterns.

- [ ] **Step 1: Add imports** (with the other hook/component imports)
```tsx
import { useFuelProfile } from '../hooks/useFuelProfile';
import { useRouteFuelStops } from '../hooks/useRouteFuelStops';
import { FuelStopsSheet } from '../components/FuelStopsSheet';
import { type Place } from '../lib/api/places';
```

- [ ] **Step 2: Add state + derived values** inside the `EnRoute` component body (near the other `useState`/hook calls; `recommended` and `userLocation` already exist)
```tsx
  const { profile: fuelProfile } = useFuelProfile();
  const [showFuelStops, setShowFuelStops] = useState(false);
  // Reminder is "due" when its next-fire time has passed — drives the badge.
  const refuelDue =
    !!fuelProfile?.remindersEnabled &&
    !!fuelProfile.nextReminderAt &&
    new Date(fuelProfile.nextReminderAt).getTime() <= Date.now();
  const fuelStops = useRouteFuelStops({
    active: showFuelStops,
    routeCoords: recommended?.coordinates ?? [],
    fuelType: fuelProfile?.fuelType ?? 'gas',
    userLocation,
  });
```

- [ ] **Step 3: Add the fuel entry to the Full bottom-sheet content.** Inside the `sheetContent` View, after the `etaRow` `</View>` and alongside the Full-state hazard panel (follow the same `sheetExpanded`-gated conditional pattern the hazard panel uses), insert:
```tsx
          {sheetExpanded && fuelProfile?.remindersEnabled && (
            <Pressable
              style={({ pressed }) => [styles.fuelStopsEntry, pressed && pressedDim]}
              onPress={() => setShowFuelStops(true)}
              accessibilityRole="button"
              accessibilityLabel={
                fuelProfile.fuelType === 'electric'
                  ? 'Charging on your route'
                  : 'Gas on your route'
              }
              accessibilityHint="Shows fuel stops along your route"
            >
              <Ionicons
                name={fuelProfile.fuelType === 'electric' ? 'battery-charging' : 'car'}
                size={20}
                color={colors.black}
              />
              <Text style={styles.fuelStopsEntryLabel}>
                {fuelProfile.fuelType === 'electric' ? 'Charging on route' : 'Gas on route'}
              </Text>
              {refuelDue && (
                <View style={styles.fuelStopsDueBadge}>
                  <Text style={styles.fuelStopsDueText}>Due</Text>
                </View>
              )}
            </Pressable>
          )}
```
(If `Ionicons` isn't already imported in en-route, add `import { Ionicons } from '@expo/vector-icons';`. Confirm `colors`, `pressedDim`, `Text`, `Pressable`, `View` are already imported — they are, the screen uses them.)

- [ ] **Step 4: Render the sheet + station-tap handler.** Add the handler in the component body:
```tsx
  // Tapping a stop: close the sheet and recenter the map on it. Uses the
  // SAME map-centering mechanism /en-route already uses elsewhere (read
  // how the screen animates/sets region and reuse it). If no reusable
  // centering exists, just close the sheet (display-only) and report it.
  const handleSelectFuelStop = useCallback((stop: Place) => {
    setShowFuelStops(false);
    // <reuse en-route's existing map recenter here, e.g. mapRef animateToRegion
    //  to { latitude: stop.latitude, longitude: stop.longitude, ...deltas }>
  }, []);
```
Then render the sheet near the other top-level overlays in the returned JSX (e.g. just before the closing fragment/root, alongside where `ReportDetailCard`/modals render):
```tsx
      <FuelStopsSheet
        visible={showFuelStops}
        loading={fuelStops.loading}
        error={fuelStops.error}
        stops={fuelStops.stops}
        fuelType={fuelProfile?.fuelType ?? 'gas'}
        onSelectStop={handleSelectFuelStop}
        onClose={() => setShowFuelStops(false)}
      />
```

- [ ] **Step 5: Add styles** to the en-route StyleSheet
```tsx
  fuelStopsEntry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 44,
    paddingHorizontal: spacing.md,
  },
  fuelStopsEntryLabel: { ...typography.subheadlineEmphasized, color: colors.black, flex: 1 },
  fuelStopsDueBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 100,
    backgroundColor: colors.freshgreen,
  },
  fuelStopsDueText: { ...typography.caption1Emphasized, color: colors.white },
```
(Confirm `spacing` + the typography tokens are imported in en-route; if `spacing` isn't imported, add `import { spacing } from '../theme/spacing';`. If the en-route file uses raw gap numbers instead of `spacing.*`, match the file's local convention rather than introducing `spacing` for one block.)

- [ ] **Step 6: Resolve the map recenter (Step 4 TODO).** Read how /en-route centers the map (it fits the route bounds on load — find the `animateToRegion`/`fitToCoordinates`/region-setter + the `MapView` ref). Wire `handleSelectFuelStop` to recenter on the stop using that same mechanism. If there is genuinely no reusable handle, leave the handler closing-only and note it in the report (display-only stops are an acceptable v1 — the value is *seeing* on-route stations).

- [ ] **Step 7: Typecheck** — expected no output.

- [ ] **Step 8: Manual simulator check**
  - With NO fuel profile / reminders off: no fuel entry appears on /en-route. ✅ (gated)
  - Set up a reminder (via /search → /fuel), start a route to a destination, expand the en-route bottom sheet → a "Gas on route" (or "Charging on route" for electric) entry appears. If the reminder's next date is in the past, a "Due" badge shows.
  - Tap it → the FuelStopsSheet slides up listing gas stations near the route (loading → list/empty/error states). Tap a stop → sheet closes (and the map recenters if Step 6 wired it).
  - Electric fuel type → the entry/sheet say "Charging" and the search uses "ev charging".

- [ ] **Step 9: Commit**
```bash
git add app/en-route.tsx
git commit -m "feat: on-route fuel stops entry in /en-route bottom sheet

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Acceptance + merge

**Files:** none (verification + merge)

- [ ] **Step 1: Full typecheck** — `npx tsc --noEmit 2>&1 | grep -v -E '@expo/vector-icons|@vercel/node|avatar\.png' | head` — expect empty.

- [ ] **Step 2: End-to-end manual check (simulator)** — run the Task 4 Step 8 flow end to end, plus: confirm the fuel entry does NOT appear when reminders are off; confirm rerouting (changing destination mid-trip) refreshes the stops on next open; confirm the sheet scrim-tap and close button both dismiss.

- [ ] **Step 3: Final code-reviewer subagent** on `git diff main...feat/refuel-onroute-stops`. Confirm: the geo approximation is sound; the hook doesn't refetch-storm (keyed on `routeCoords.length`); the fuel entry is correctly gated on `remindersEnabled`; reserved-color rule (freshgreen badge is an allowed CTA/accent — confirm no orange/red/yellow/navy misuse); the en-route integration follows the file's existing sheet/overlay patterns; no fake data. Fix anything flagged, re-review.

- [ ] **Step 4: Squash-merge to `main`**
```bash
git checkout main
git merge --squash feat/refuel-onroute-stops
git commit -m "feat: refuel reminders — on-route fuel stops (Plan 2)

Gas/charging stations along the active route, surfaced in /en-route's Full
bottom sheet when a reminder is set up (with a Due badge). Pure geo helper
+ useRouteFuelStops (reuses the Mapbox POI search) + FuelStopsSheet. Local-
only, no new permission. Completes the refuel-reminders feature.

Plan: docs/superpowers/plans/2026-05-30-refuel-onroute-stops.md

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
git branch -D feat/refuel-onroute-stops
```

- [ ] **Step 5: Append a `docs/learnings.md` entry** if anything non-obvious surfaced (e.g. the vertex-approximation tradeoff for point-to-route distance, or the en-route overlay/Modal layering). Newest at top.

---

## Self-Review

**1. Spec coverage** (spec Unit ④ — on-route fuel stops):
- Fuel affordance on /en-route gated on `remindersEnabled` → Task 4 Step 3. ✅
- "Due" badge when `nextReminderAt` past → Task 4 Steps 2-3 (`refuelDue`). ✅
- Opens a sheet of stops → Task 3 (`FuelStopsSheet`) + Task 4 Step 4. ✅
- Reuses the Mapbox gas POI search; query adapts to fuelType (gas vs ev charging) → Task 2 (`fuelQuery`). ✅
- Filtered/sorted by proximity to the route polyline → Task 1 (`distanceToPolylineMeters`) + Task 2 filter. ✅
- Reuse haversine / add a helper → Task 1 (none existed; added). ✅
- Tap a station → recenter → Task 4 Steps 4+6. ✅ (display-only fallback documented)
- Side-column-crowding coordination → resolved: entry lives in the bottom sheet, not a FAB. ✅

**2. Placeholder scan:** The one intentional TODO is Task 4 Step 4/6's map-recenter, which is explicitly a "read the existing mechanism and reuse it, or fall back to display-only" instruction with a concrete fallback — not a vague placeholder. All component/hook/helper code is complete. Theme-token + scrim-value verification steps guard against invented values.

**3. Type/name consistency:** `Place` (from `lib/api/places`), `FuelType` (from `lib/api/fuel`), `LatLng` (from `lib/edge-indicators`) used consistently. `haversineMeters`/`distanceToPolylineMeters` (Task 1) consumed in Task 2. `useRouteFuelStops` returns `{ stops, loading, error }` (Task 2) — consumed by Task 4's `<FuelStopsSheet>` props (Task 3 signature: `visible, loading, error, stops, fuelType, onSelectStop, onClose`). `refuelDue`/`showFuelStops`/`fuelStops`/`fuelProfile` names consistent across Task 4 steps.

**Risk noted:** Task 4 is the only high-uncertainty task — it edits the large /en-route file, and the map-recenter (Step 6) depends on a centering mechanism this plan didn't fully read. It's scoped with a read-first directive and a display-only fallback so it can't block. The other three tasks are self-contained and fully specified.
