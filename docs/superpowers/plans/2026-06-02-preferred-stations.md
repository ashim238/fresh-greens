# Preferred Stations — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user mark gas/charging stations they trust, surface them atop the on-route fuel sheet, and note when one is near the recommended route — a Green Book-aligned trust signal layered on top of safety routing, never overriding it.

**Architecture:** A new AsyncStorage adapter (`preferred-stations`, proximity-matched, mirroring `saved-places`) + a reactive hook, a shared trust-star toggle, integrations in `FuelStopsSheet`/`/en-route`, `/search` Gas results, `/fuel` (management list), and `/home` (route-detect line). The route detect reuses scoring's existing `isPointNearPolyline` read-only (the one scoring.ts edit is adding `export`).

**Tech Stack:** React Native + Expo + TypeScript, AsyncStorage, the settings-register primitives (`RowGroup`/`SettingsRow`), Phosphor icons.

**Spec:** [docs/superpowers/specs/2026-06-02-preferred-stations-design.md](../specs/2026-06-02-preferred-stations-design.md)

**No test runner** — `tsc` is the verification gate per task: `npx tsc --noEmit 2>&1 | grep -vE "avatar\.png|@vercel/node"` must be empty. Device verification is Task 9.

**Branch:** create `feat/preferred-stations` off `main` before Task 1.

---

## Task 1: Adapter — `lib/api/preferred-stations.ts`

**Files:** Create `lib/api/preferred-stations.ts`

- [ ] **Step 1: Write the adapter**

```ts
// Fresh Greens — preferred-stations adapter.
//
// Persists gas/charging stations the user has marked as trusted. Same
// architectural shape as saved-places.ts: typed PreferredStation, async
// public surface, AsyncStorage backing, backend swap-in preserved.
//
// Identity is by PROXIMITY, not POI id — the same station retrieved from
// search (Nominatim) vs on-route (Overpass) carries a different id, so
// id-matching would treat them as different places. We match on lat/lng
// within PREFERRED_MATCH_DELTA, the same technique regular-destinations.ts
// and the /search saved-row merge already use.
//
// Spec: docs/superpowers/specs/2026-06-02-preferred-stations-design.md

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'fresh-greens.preferred-stations.v1';

// ~0.0007° ≈ 78m of latitude — tighter than the 0.002° (~222m) used for
// destination matching, because distinct gas stations can sit close
// together and we don't want to conflate two real ones.
const PREFERRED_MATCH_DELTA = 0.0007;

export type PreferredStation = {
  id: string;
  /** Station name as shown ("Wawa", "Shell"). */
  name: string;
  /** Optional brand, when distinguishable from name. */
  brand?: string;
  latitude: number;
  longitude: number;
  /** ms timestamp of when this was starred. */
  setAt: number;
};

function near(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): boolean {
  return (
    Math.abs(a.latitude - b.latitude) < PREFERRED_MATCH_DELTA &&
    Math.abs(a.longitude - b.longitude) < PREFERRED_MATCH_DELTA
  );
}

/** Reads all preferred stations, newest first. */
export async function getPreferredStations(): Promise<PreferredStation[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PreferredStation[];
    if (!Array.isArray(parsed)) return [];
    return parsed.sort((a, b) => b.setAt - a.setAt);
  } catch (err) {
    console.warn('getPreferredStations failed', err);
    return [];
  }
}

/**
 * Stars a station. No-op-returns the existing entry if one already sits
 * within PREFERRED_MATCH_DELTA (dedupe against Nominatim/Overpass jitter).
 */
export async function addPreferredStation(input: {
  name: string;
  brand?: string;
  latitude: number;
  longitude: number;
}): Promise<PreferredStation> {
  const existing = await getPreferredStations();
  const dup = existing.find((s) => near(s, input));
  if (dup) return dup;

  const station: PreferredStation = {
    id: `station-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    setAt: Date.now(),
    ...input,
  };
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([...existing, station]));
  return station;
}

/** Removes a preferred station by id. */
export async function removePreferredStation(id: string): Promise<void> {
  const all = await getPreferredStations();
  await AsyncStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(all.filter((s) => s.id !== id)),
  );
}

/** True if a place sits within PREFERRED_MATCH_DELTA of a preferred station. */
export async function isPreferredStation(place: {
  latitude: number;
  longitude: number;
}): Promise<boolean> {
  const all = await getPreferredStations();
  return all.some((s) => near(s, place));
}

/** Sign-out / factory-reset cleanup. */
export async function clearPreferredStations(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}
```

- [ ] **Step 2: Typecheck** — `npx tsc --noEmit 2>&1 | grep "preferred-stations"` → empty.
- [ ] **Step 3: Commit**
```bash
git add lib/api/preferred-stations.ts
git commit -m "feat(preferred-stations): adapter — proximity-matched trusted-station store

Spec: docs/superpowers/specs/2026-06-02-preferred-stations-design.md"
```

---

## Task 2: Hook — `hooks/usePreferredStations.ts`

**Files:** Create `hooks/usePreferredStations.ts`

- [ ] **Step 1: Write the hook**

```tsx
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import {
  addPreferredStation as addToStore,
  clearPreferredStations as clearFromStore,
  getPreferredStations,
  removePreferredStation as removeFromStore,
  type PreferredStation,
} from '../lib/api/preferred-stations';

// Mirror of the adapter's PREFERRED_MATCH_DELTA so isPreferred can answer
// synchronously against in-memory state (instant star toggles, no async).
const MATCH_DELTA = 0.0007;

/**
 * Reactive wrapper around the preferred-stations adapter. Re-reads on
 * focus (like usePreferences) so a star set in the fuel sheet shows in
 * /fuel's list and vice-versa. isPreferred is computed synchronously
 * against `stations` so the star renders without an async round-trip.
 */
export function usePreferredStations() {
  const [stations, setStations] = useState<PreferredStation[]>([]);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const stored = await getPreferredStations();
        if (!cancelled) setStations(stored);
      })();
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const isPreferred = useCallback(
    (place: { latitude: number; longitude: number }): boolean =>
      stations.some(
        (s) =>
          Math.abs(s.latitude - place.latitude) < MATCH_DELTA &&
          Math.abs(s.longitude - place.longitude) < MATCH_DELTA,
      ),
    [stations],
  );

  const add = useCallback(
    async (input: {
      name: string;
      brand?: string;
      latitude: number;
      longitude: number;
    }) => {
      const station = await addToStore(input);
      setStations((prev) =>
        prev.some((s) => s.id === station.id) ? prev : [...prev, station],
      );
      return station;
    },
    [],
  );

  const remove = useCallback(async (id: string) => {
    await removeFromStore(id);
    setStations((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const clearAll = useCallback(async () => {
    await clearFromStore();
    setStations([]);
  }, []);

  return { stations, isPreferred, add, remove, clearAll };
}
```

- [ ] **Step 2: Typecheck** — `npx tsc --noEmit 2>&1 | grep "usePreferredStations"` → empty. (Confirm `useFocusEffect` is imported from `expo-router` — `hooks/usePreferences.ts` does the same.)
- [ ] **Step 3: Commit**
```bash
git add hooks/usePreferredStations.ts
git commit -m "feat(preferred-stations): usePreferredStations hook (reactive, focus-reread)

Spec: docs/superpowers/specs/2026-06-02-preferred-stations-design.md"
```

---

## Task 3: Shared toggle — `components/PreferredStar.tsx`

**Files:** Create `components/PreferredStar.tsx`

- [ ] **Step 1: Write the component**

```tsx
import { Pressable } from 'react-native';

import { Star } from 'phosphor-react-native/src/icons/Star';

import { colors } from '../theme/colors';
import { pressedDim } from '../theme/interaction';

/**
 * Trust-star toggle — identical affordance wherever a gas/charging
 * station is shown (FuelStopsSheet, /search Gas results). Filled
 * wiltedgreen when trusted, hollow labelTertiary otherwise. Compact
 * glyph with hitSlop for a 44pt effective tap target.
 *
 * Spec: docs/superpowers/specs/2026-06-02-preferred-stations-design.md
 */
export function PreferredStar({
  preferred,
  onToggle,
  accessibilityLabel,
}: {
  preferred: boolean;
  onToggle: () => void;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      onPress={onToggle}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel={
        accessibilityLabel ?? (preferred ? 'Untrust this station' : 'Trust this station')
      }
      accessibilityState={{ selected: preferred }}
      style={({ pressed }) => [pressed && pressedDim]}
    >
      <Star
        size={24}
        weight={preferred ? 'fill' : 'regular'}
        color={preferred ? colors.wiltedgreen : colors.labelTertiary}
      />
    </Pressable>
  );
}
```

- [ ] **Step 2: Typecheck** — `npx tsc --noEmit 2>&1 | grep "PreferredStar"` → empty.
- [ ] **Step 3: Commit**
```bash
git add components/PreferredStar.tsx
git commit -m "feat(preferred-stations): shared PreferredStar trust-toggle

Spec: docs/superpowers/specs/2026-06-02-preferred-stations-design.md"
```

---

## Task 4: FuelStopsSheet star + badge + preferred-first sort

**Files:** Modify `components/FuelStopsSheet.tsx`, `app/en-route.tsx`

`FuelStopsSheet` is presentational; the parent (`/en-route`) owns data. So the parent computes preferred-first sort + passes `isPreferred`/`onTogglePreferred` down.

- [ ] **Step 1: Add two props to FuelStopsSheet**

In `components/FuelStopsSheet.tsx`, add to the prop type + destructure:
```tsx
  isPreferred: (stop: Place) => boolean;
  onTogglePreferred: (stop: Place) => void;
```
(Add both to the destructured params and the inline prop type object.)

- [ ] **Step 2: Render the star + badge in each row**

Replace the row's `renderItem` body. The current row is:
```tsx
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
```
Change to (add the badge under the name when preferred, and the star on the right):
```tsx
                  <Pressable
                    style={({ pressed }) => [styles.row, pressed && pressedDim]}
                    onPress={() => onSelectStop(item)}
                    accessibilityRole="button"
                    accessibilityLabel={`${item.name}, ${item.distanceMiles} miles away${isPreferred(item) ? ', trusted by you' : ''}`}
                    accessibilityHint="Shows this stop on the map"
                  >
                    <View style={styles.rowText}>
                      <Text style={styles.rowName} numberOfLines={1}>{item.name}</Text>
                      {isPreferred(item) ? (
                        <View style={styles.trustedBadge}>
                          <Text style={styles.trustedBadgeText}>Trusted by you</Text>
                        </View>
                      ) : (
                        <Text style={styles.rowAddress} numberOfLines={1}>{item.address}</Text>
                      )}
                    </View>
                    <Text style={styles.rowDistance}>{item.distanceMiles} mi</Text>
                    <PreferredStar
                      preferred={isPreferred(item)}
                      onToggle={() => onTogglePreferred(item)}
                    />
                  </Pressable>
```
Add the import at the top: `import { PreferredStar } from './PreferredStar';`

- [ ] **Step 3: Add the badge styles** to FuelStopsSheet's `StyleSheet.create`:
```tsx
  trustedBadge: {
    alignSelf: 'flex-start',
    marginTop: 2,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 100,
    backgroundColor: colors.fadedgreen,
  },
  trustedBadgeText: { ...typography.caption2Emphasized, color: colors.burntgreen },
```
(If `caption2Emphasized` doesn't exist in `theme/typography.ts`, use `caption1Emphasized`.)

- [ ] **Step 4: Wire en-route — hook + sort + pass props**

In `app/en-route.tsx`:
1. Import the hook: `import { usePreferredStations } from '../hooks/usePreferredStations';`
2. In the component body, near `const fuelStops = useRouteFuelStops({...})`:
```tsx
  const { isPreferred, add: addPreferred, remove: removePreferred, stations: preferredStations } =
    usePreferredStations();

  // Preferred stations first, then by distance (the hook's existing order).
  const sortedFuelStops = useMemo(
    () =>
      [...fuelStops.stops].sort(
        (a, b) => Number(isPreferred(b)) - Number(isPreferred(a)),
      ),
    [fuelStops.stops, isPreferred],
  );

  function handleTogglePreferred(stop: Place) {
    if (isPreferred(stop)) {
      const match = preferredStations.find(
        (s) =>
          Math.abs(s.latitude - stop.latitude) < 0.0007 &&
          Math.abs(s.longitude - stop.longitude) < 0.0007,
      );
      if (match) void removePreferred(match.id);
    } else {
      void addPreferred({
        name: stop.name,
        latitude: stop.latitude,
        longitude: stop.longitude,
      });
    }
  }
```
3. At the `<FuelStopsSheet ... />` usage (around line 1898), change `stops={fuelStops.stops}` to `stops={sortedFuelStops}` and add:
```tsx
        isPreferred={isPreferred}
        onTogglePreferred={handleTogglePreferred}
```
(`Place` and `useMemo` are already imported in en-route; confirm and add if not.)

- [ ] **Step 5: Typecheck** — `npx tsc --noEmit 2>&1 | grep -vE "avatar\.png|@vercel/node"` → empty.
- [ ] **Step 6: Commit**
```bash
git add components/FuelStopsSheet.tsx app/en-route.tsx
git commit -m "feat(preferred-stations): star + Trusted-by-you badge + preferred-first in FuelStopsSheet

Spec: docs/superpowers/specs/2026-06-02-preferred-stations-design.md"
```

---

## Task 5: Star on `/search` Gas results

**Files:** Modify `app/search.tsx`

- [ ] **Step 1: Add hook + handler**

Import: `import { usePreferredStations } from '../hooks/usePreferredStations';`
In the `Search` component body:
```tsx
  const {
    isPreferred: isPreferredStation,
    add: addPreferredStation,
    remove: removePreferredStation,
    stations: preferredStationList,
  } = usePreferredStations();

  function handleToggleStation(place: Place) {
    if (isPreferredStation(place)) {
      const match = preferredStationList.find(
        (s) =>
          Math.abs(s.latitude - place.latitude) < 0.0007 &&
          Math.abs(s.longitude - place.longitude) < 0.0007,
      );
      if (match) void removePreferredStation(match.id);
    } else {
      void addPreferredStation({
        name: place.name,
        latitude: place.latitude,
        longitude: place.longitude,
      });
    }
  }
```

- [ ] **Step 2: Render the star on Gas result rows**

The results render at `app/search.tsx:921` (`{results.map((place, idx) => (`). Find the result `<Pressable>` row (`styles.resultRow`). At the END of that row's children (after the existing name/distance content, before the row closes), add — gated on the Gas tool:
```tsx
                  {selectedToolId === 'gas' && (
                    <PreferredStar
                      preferred={isPreferredStation(place)}
                      onToggle={() => handleToggleStation(place)}
                    />
                  )}
```
Add import: `import { PreferredStar } from '../components/PreferredStar';`
Ensure the row is `flexDirection: 'row'` with the star at the trailing edge — read the existing `resultRow` style; if the row's content is in a column wrapper, place the star as a sibling so it sits to the right. The star's `onToggle` must not trigger the row's `onPress` (the inner Pressable stops propagation by handling its own press — verify the row select still works after adding it; if the star tap also selects the place, wrap the star so its press is isolated).

- [ ] **Step 3: Typecheck** — `npx tsc --noEmit 2>&1 | grep -vE "avatar\.png|@vercel/node"` → empty.
- [ ] **Step 4: Commit**
```bash
git add app/search.tsx
git commit -m "feat(preferred-stations): trust-star on /search Gas results

Spec: docs/superpowers/specs/2026-06-02-preferred-stations-design.md"
```

---

## Task 6: `/fuel` "Preferred stations" management RowGroup

**Files:** Modify `app/fuel.tsx`

- [ ] **Step 1: Add hook + remove handler**

Imports:
```tsx
import { Alert } from 'react-native';   // add Alert if not already imported
import { Trash } from 'phosphor-react-native/src/icons/Trash';
import { usePreferredStations } from '../hooks/usePreferredStations';
```
In the `Fuel` component body:
```tsx
  const { stations: preferredStations, remove: removePreferredStation } =
    usePreferredStations();

  function handleRemoveStation(id: string, name: string) {
    Alert.alert('Remove station', `Remove "${name}" from your preferred stations?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => void removePreferredStation(id),
      },
    ]);
  }
```

- [ ] **Step 2: Render the RowGroup**

Add a new `RowGroup` titled "Preferred stations" AFTER the existing fuel-form RowGroups (after the conditional status block, before the Save button). Use the existing `RowGroup` import. Build rows inline:
```tsx
            <RowGroup
              title="Preferred stations"
              footer="Stations you trust — starred from the on-route fuel list or a Gas search."
            >
              {preferredStations.length === 0 ? (
                <View style={styles.emptyStationRow}>
                  <Text style={styles.emptyStationText}>
                    Star a gas station you trust and it&apos;ll show up here.
                  </Text>
                </View>
              ) : (
                preferredStations.map((s) => (
                  <View key={s.id} style={styles.stationRow}>
                    <View style={styles.stationTextStack}>
                      <Text style={styles.stationName} numberOfLines={1}>{s.name}</Text>
                      {s.brand ? (
                        <Text style={styles.stationBrand} numberOfLines={1}>{s.brand}</Text>
                      ) : null}
                    </View>
                    <Pressable
                      onPress={() => handleRemoveStation(s.id, s.name)}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${s.name}`}
                      style={({ pressed }) => [pressed && pressedDim]}
                    >
                      <Trash size={20} color={colors.red} weight="regular" />
                    </Pressable>
                  </View>
                ))
              )}
            </RowGroup>
```
**Reserved-color note:** the `Trash` glyph uses `colors.red` — this is the sanctioned destructive-action use (matches /saved-places removal + the SettingsRow destructive variant), not a reserved-signal violation.

- [ ] **Step 3: Add styles** to fuel.tsx's StyleSheet:
```tsx
  stationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 52,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  stationTextStack: { flex: 1, gap: 2 },
  stationName: { ...dynamicType(typography.bodyRegular), color: colors.black },
  stationBrand: { ...dynamicType(typography.footnoteRegular), color: colors.labelSecondary },
  emptyStationRow: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  emptyStationText: { ...dynamicType(typography.footnoteRegular), color: colors.labelSecondary },
```
(`dynamicType` + `typography` are already imported in fuel.tsx; confirm.)

- [ ] **Step 4: Typecheck** — `npx tsc --noEmit 2>&1 | grep -vE "avatar\.png|@vercel/node"` → empty.
- [ ] **Step 5: Commit**
```bash
git add app/fuel.tsx
git commit -m "feat(preferred-stations): manage list in /fuel (rows + remove + empty state)

Spec: docs/superpowers/specs/2026-06-02-preferred-stations-design.md"
```

---

## Task 7: Export `isPointNearPolyline` + `/home` route-detect line

**Files:** Modify `lib/scoring.ts`, `app/home.tsx`

- [ ] **Step 1: Export the helper**

In `lib/scoring.ts:442`, change `function isPointNearPolyline(` to `export function isPointNearPolyline(`. No other change. (Pure helper; exporting it doesn't alter behavior.)

- [ ] **Step 2: Compute the detect in /home**

In `app/home.tsx`:
```tsx
import { isPointNearPolyline } from '../lib/scoring';
import { usePreferredStations } from '../hooks/usePreferredStations';
```
In the component body (near `routeZoneCounts`):
```tsx
  const { stations: preferredStations } = usePreferredStations();

  // Read-only over scoring: is a trusted station near the recommended
  // route? ~150m tolerance — "near your way", looser than the ~78m
  // station-identity match. Does NOT influence which route is chosen.
  const trustedStationOnRoute = useMemo(() => {
    if (!recommended || preferredStations.length === 0) return false;
    return preferredStations.some((s) =>
      isPointNearPolyline(
        { latitude: s.latitude, longitude: s.longitude },
        recommended.coordinates,
        150,
      ),
    );
  }, [recommended, preferredStations]);

  // "station" vs "charger" by the user's fuel type (read from useFuelProfile,
  // already consumed on this screen as `fuelProfile`).
  const trustedNoun = fuelProfile?.fuelType === 'electric' ? 'charger' : 'station';
```
(Confirm `fuelProfile` is the existing `useFuelProfile()` value in home.tsx; if it's named differently, use that.)

- [ ] **Step 3: Render the line**

Near the route-preview conditions area (after the `Safest route · …` caption, around `app/home.tsx:1961`), add:
```tsx
          {recommended && trustedStationOnRoute && (
            <View style={styles.trustedOnRouteRow}>
              <Star size={16} color={colors.burntgreen} weight="fill" />
              <Text style={styles.trustedOnRouteText}>
                A {trustedNoun} you trust is on this route.
              </Text>
            </View>
          )}
```
Imports: `import { Star } from 'phosphor-react-native/src/icons/Star';`
Styles:
```tsx
  trustedOnRouteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  trustedOnRouteText: {
    ...dynamicType(typography.footnoteRegular),
    color: colors.burntgreen,
  },
```
(`spacing` is used as raw integers in some home styles — match the file's prevailing convention; if it imports `spacing`, use it, else use `4` for xs.)

- [ ] **Step 4: Typecheck** — `npx tsc --noEmit 2>&1 | grep -vE "avatar\.png|@vercel/node"` → empty.
- [ ] **Step 5: Commit**
```bash
git add lib/scoring.ts app/home.tsx
git commit -m "feat(preferred-stations): /home notes a trusted station on the route (read-only)

Exports isPointNearPolyline (no logic change) so the route-preview can
detect a preferred station near the chosen route. Detect-and-surface
only — scoring + route selection unchanged.

Spec: docs/superpowers/specs/2026-06-02-preferred-stations-design.md"
```

---

## Task 8: Sign-out hygiene

**Files:** Modify `app/menu.tsx`

- [ ] **Step 1: Clear on sign-out**

Import: `import { clearPreferredStations } from '../lib/api/preferred-stations';`
In `handleSignOut`'s `Promise.all([...])`, add alongside the other clears:
```tsx
        clearPreferredStations(),
```

- [ ] **Step 2: Typecheck** — `npx tsc --noEmit 2>&1 | grep -vE "avatar\.png|@vercel/node"` → empty.
- [ ] **Step 3: Commit**
```bash
git add app/menu.tsx
git commit -m "feat(preferred-stations): clear on sign-out (hygiene)

Spec: docs/superpowers/specs/2026-06-02-preferred-stations-design.md"
```

---

## Task 9: Verification + final review

**Files:** none modified.

- [ ] **Step 1: Full tsc** — `npx tsc --noEmit 2>&1 | grep -vE "avatar\.png|@vercel/node"; echo done` → empty then `done`.
- [ ] **Step 2: Reserved-color sweep** — `rg "colors\.(orange|red|yellow|pink|navy)" components/PreferredStar.tsx app/fuel.tsx components/FuelStopsSheet.tsx` → only the `/fuel` Trash (destructive, sanctioned). Confirm no reserved color on the star/badge/route-line (they use wiltedgreen/fadedgreen/burntgreen).
- [ ] **Step 3: Final whole-feature code review** (dispatch a code-reviewer over the branch diff).
- [ ] **Step 4: Device verification (needs a dev build):**
  - Star a station from the on-route fuel sheet → it pins to top with the "Trusted by you" badge.
  - It appears in `/fuel`'s "Preferred stations" list; remove it there → gone.
  - Star a Gas search result → consistent star state if it also appears on-route.
  - Route a drive that passes a preferred station → `/home` shows "A station you trust is on this route."
  - Sign out → list cleared.
- [ ] **Step 5:** Use superpowers:finishing-a-development-branch.

---

## Self-review (writing-plans)

**Spec coverage:** adapter (T1), hook (T2), PreferredStar (T3), FuelStopsSheet star+badge+sort (T4), search Gas star (T5), /fuel management list (T6), scoring export + /home detect (T7), sign-out (T8), verification (T9). All 8 spec files covered. ✓

**Placeholder scan:** net-new files (T1–T3) are full code. Modify tasks (T4–T8) show the exact new code + name the precise insertion points; the two genuine "read the file to confirm" dependencies (search's `resultRow` layout for star placement; home's `fuelProfile`/`spacing` conventions) are called out explicitly with fallbacks, not left vague. No TBD/TODO.

**Type consistency:** `PreferredStation {id, name, brand?, latitude, longitude, setAt}` consistent T1→T6. Hook surface `{stations, isPreferred, add, remove, clearAll}` consistent T2→T7. `addPreferredStation(input: {name, brand?, latitude, longitude})` matches all callers. `isPointNearPolyline(point, polyline, thresholdMeters)` matches the real signature. `PREFERRED_MATCH_DELTA = 0.0007` reused as the inline `0.0007` in the en-route/search toggle handlers (note: kept inline there to avoid exporting the const; flagged for the reviewer in case they'd rather export it).

**One flagged risk:** Task 5 (search Gas star) depends on the existing `resultRow` layout — the implementer must confirm the star sits at the trailing edge and its tap is isolated from the row's select `onPress`. Surfaced in-task.

No gaps.
