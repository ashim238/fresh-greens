# Alternate-Route Comparison Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the /en-route "alternate paths" FAB real — a comparison sheet (duration / arrival / distance / "Safest route" descriptor / condition chips) that lets the driver switch the active route, with per-route duration badges on the map.

**Architecture:** A pure `routeConditions(route, zones)` helper (reusing the already-exported `isPointInZone`) powers the chips; an `activeRouteId` state + derived `activeRoute` replaces the ~31 hardwired `recommended` references so the screen follows the selected route; a presentational `RouteComparisonSheet` Modal lists the routes; the FAB opens it and tapping a row switches; the map gains per-route duration badges. Source-agnostic (operates on `pickWinner`'s `RankedRoute[]`).

**Tech Stack:** React Native + Expo + TypeScript, expo-router, react-native-maps, theme tokens. Spec: `docs/superpowers/specs/2026-05-31-alternate-route-comparison-design.md`. Figma reference `2:9033` (extract structure, drop Google chrome).

---

## ⚠️ Verification model (read first)

**No test runner exists.** Per `CLAUDE.md`, verification is `npx tsc --noEmit` + manual simulator check + code-reviewer subagent. Each task: **edit → typecheck → (manual where applicable) → commit**. No TDD.

**Typecheck:**
```bash
npx tsc --noEmit 2>&1 | grep -v -E '@expo/vector-icons|@vercel/node|avatar\.png' | head -40
```
Expected after every task: no output.

**Confirmed facts (read from source):**
- `lib/scoring.ts` exports `isPointInZone(point: Coordinate, zone: Zone): boolean` — the geometry-dispatch proximity check (polygon ray-cast / polyline near-line / point-distance) that `scoreRoute` itself uses. **`routeConditions` reuses it — no extraction needed** (the spec's `zoneTouchesRoute` already exists as `isPointInZone`).
- `Zone = { type: 'safe'|'caution'|'avoid'; geometry; category?: ZoneCategory; coordinates }`. `ZoneCategory` includes `'lighting' | 'landuse' | 'park' | 'police' | 'wildlife' | 'road-condition' | 'community-report'` (category is OPTIONAL). `Route` carries `id`, `coordinates`, `estimatedMinutes`, `distanceMeters`, `steps`. `RankedRoute = Route & { type: 'recommended'|'alternate'; score }`.
- /en-route: `routes = pickWinner(...)`; `recommended = routes.find(r => r.type === 'recommended')` (line 349); the `recommended` consumers + the `routePolylines` memo + the `EnRoutePath` FAB are enumerated in Task 2. `allZones`, `mapRef` (`useRef<MapView>`), `cloudCoverPct`, `gradientSegments`, `routeColors` are in scope. The project's tsconfig does **not** flag unused locals (orphans are removed manually), so an as-yet-unused `setActiveRouteId` in Task 2 typechecks clean.

---

## File Structure

| File | Responsibility | Change |
|------|----------------|--------|
| `lib/scoring.ts` | Scoring + zone proximity | **Modify** — add pure `routeConditions(route, zones)` (reuses `isPointInZone`) |
| `app/en-route.tsx` | Nav screen | **Modify** — `activeRouteId`+`activeRoute` refactor; FAB→sheet; ComparisonRow derivation; map badges |
| `components/RouteComparisonSheet.tsx` | Comparison list overlay | **Create** — presentational Modal |

Branch: `feat/alternate-route-comparison`. Squash-merge to `main` after acceptance.

---

### Task 1: `routeConditions` helper in `lib/scoring.ts`

**Files:** Modify `lib/scoring.ts`

- [ ] **Step 1: Add the type + helper** (place after `isPointInZone`'s definition; reuse it — do NOT reimplement proximity math)

```ts
/** Safety-condition categories surfaced as chips in the route comparison. */
export type RouteCondition = 'low-light' | 'wildlife' | 'police' | 'road';

/** Maps a Zone category to a comparison condition (only the four safety
    factors the thesis names; landuse/park/community-report are not charted). */
function conditionForCategory(
  category: Zone['category'],
): RouteCondition | null {
  switch (category) {
    case 'lighting':
      return 'low-light';
    case 'wildlife':
      return 'wildlife';
    case 'police':
      return 'police';
    case 'road-condition':
      return 'road';
    default:
      return null;
  }
}

/**
 * The deduped set of safety conditions a route passes near — powers the
 * comparison-sheet chips. Reuses `isPointInZone` (the same proximity
 * dispatch `scoreRoute` uses), so chips and score stay consistent. Pure.
 * Order is stable: low-light, wildlife, police, road.
 */
export function routeConditions(route: Route, zones: Zone[]): RouteCondition[] {
  const present = new Set<RouteCondition>();
  for (const zone of zones) {
    const condition = conditionForCategory(zone.category);
    if (!condition || present.has(condition)) continue;
    if (route.coordinates.some((point) => isPointInZone(point, zone))) {
      present.add(condition);
    }
  }
  const order: RouteCondition[] = ['low-light', 'wildlife', 'police', 'road'];
  return order.filter((c) => present.has(c));
}
```
(Confirm `Route` and `Zone` are already imported/in-scope in `scoring.ts` — they are, `scoreRoute` uses both.)

- [ ] **Step 2: Typecheck** — expected no output.

- [ ] **Step 3: Commit**
```bash
git add lib/scoring.ts
git commit -m "feat: routeConditions() — safety conditions a route passes (for comparison chips)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: `recommended` → `activeRoute` refactor in `app/en-route.tsx` (HIGH RISK — isolated)

**Files:** Modify `app/en-route.tsx`

This is the risky task: ~14 functional sites repoint from `recommended` to a new `activeRoute`. Keep `recommended` (it's the score winner — the sheet's "Safest" label + the fallback need it). **Read each site before editing.**

- [ ] **Step 1: Add the state + `activeRoute` derivation** immediately AFTER the `recommended` line (line 349 `const recommended = routes.find((route) => route.type === 'recommended');`)

```tsx
  // Which route the screen follows. null = follow the recommended (the
  // score winner). The comparison sheet sets this to switch routes; a
  // stale id (after a reroute changes the set) falls back to recommended.
  const [activeRouteId, setActiveRouteId] = useState<string | null>(null);
  const activeRoute =
    (activeRouteId != null && routes.find((r) => r.id === activeRouteId)) ||
    recommended;
```
(`setActiveRouteId` is consumed in Task 4 — unused here is tsc-clean per the verification note.)

- [ ] **Step 2: Repoint the `recommended` consumers to `activeRoute`.** These sites currently read `recommended` but describe *the route the screen is on*, so they follow `activeRoute`. Repoint each (the `recommended?.x` / `recommended.x` / dep-array `recommended` → `activeRoute`). Leave line 349's `recommended` definition and pure comments alone. Sites (verify each against the file):

  | Line(s) | What | Change |
  |---|---|---|
  | 364 | fuel-stops `routeCoords: recommended?.coordinates ?? []` | → `activeRoute?.coordinates ?? []` |
  | 467 | arrival-guard effect dep `[recommended?.id]` | → `[activeRoute?.id]` |
  | 476–482 | `nextStepInfo`: `if (!recommended ...) ... recommended.steps ...` + dep `[recommended, userLocation]` | `recommended`→`activeRoute` throughout |
  | 540, 543 | arrival params `recommended?.distanceMeters` / `recommended?.estimatedMinutes` | → `activeRoute?.…` |
  | 570 | reset-guard dep `[recommended?.id]` | → `[activeRoute?.id]` |
  | 578–591 | hazard memo: `if (!recommended || recommended.coordinates...) ... recommended.coordinates[0]` + dep `[recommended, nextStepInfo, allZones]` | `recommended`→`activeRoute` |
  | 714–732 | `arrivalDisplay` memo: `recommended?.estimatedMinutes` + dep `[recommended, params.destEstMinutes]` | → `activeRoute?.…` + dep `[activeRoute, …]` |
  | 738–746 | `distanceMiles` memo: `recommended?.distanceMeters` + dep | → `activeRoute?.…` |
  | 753–758 | `durationMinutes` memo: `recommended?.estimatedMinutes` + dep | → `activeRoute?.…` |

  The rule: any `recommended` that feeds the displayed ETA / distance / duration / turn steps / hazards / fuel-route / their effect deps → `activeRoute`. Pure comments (244, 354, 463, 529, 558, 1553) and the line-349 definition stay.

- [ ] **Step 3: Rewrite the `routePolylines` memo so emphasis follows `activeRoute`** (currently emphasizes `type === 'recommended'`). Replace lines 675–705:

```tsx
  const routePolylines = useMemo(
    () => {
      // Active route renders LAST (its gradient paints over the faint
      // alternates), matching /home's paint-order workaround.
      const ordered = [
        ...routes.filter((r) => r.id !== activeRoute?.id),
        ...routes.filter((r) => r.id === activeRoute?.id),
      ];
      return ordered.flatMap((route) => {
        if (route.id === activeRoute?.id) {
          return gradientSegments(route, undefined, cloudCoverPct).map((segment, idx) => (
            <Polyline
              key={`${route.id}-seg-${idx}`}
              coordinates={segment.coordinates}
              strokeColor={segment.color}
              strokeWidth={routeColors.recommended.width}
            />
          ));
        }
        return [
          <Polyline
            key={route.id}
            coordinates={route.coordinates}
            strokeColor={routeColors.alternate.stroke}
            strokeWidth={routeColors.alternate.width}
          />,
        ];
      });
    },
    [routes, activeRoute?.id, cloudCoverPct],
  );
```
(Note: non-active routes now always use `routeColors.alternate` — previously `routeColors[route.type]`. Since the active route is the only emphasized one, the faint treatment is uniform for the rest. `routeColors.recommended.width` stays as the emphasized stroke width for the active gradient.)

- [ ] **Step 4: Typecheck** — expected no output. Then **grep audit**: `rg -n "recommended" app/en-route.tsx` — every remaining hit must be either the line-349 definition, a pure comment, or intentional (none should feed the live displayed values). List them in your report.

- [ ] **Step 5: Manual sanity (controller will verify on device):** screen still renders the recommended route by default (`activeRouteId` null → `activeRoute === recommended`), ETA/distance/turns unchanged from before. This task introduces no visible change yet — it's a pure refactor; switching arrives in Task 4.

- [ ] **Step 6: Commit**
```bash
git add app/en-route.tsx
git commit -m "refactor: /en-route follows activeRoute (not hardwired recommended)

Adds activeRouteId state + derived activeRoute; repoints the ~14 display/
effect consumers + polyline emphasis. Default (null) = recommended, so no
behavior change yet. Foundation for route switching.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: `components/RouteComparisonSheet.tsx` (presentational)

**Files:** Create `components/RouteComparisonSheet.tsx`

- [ ] **Step 1: Create the component** (Modal overlay, same scrim/a11y pattern as the shipped `FuelStopsSheet`; anchored to Figma `2:9033` structure — reconcile pixel fidelity in a later audit)

```tsx
import { Ionicons } from '@expo/vector-icons';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { type RouteCondition } from '../lib/scoring';
import { colors } from '../theme/colors';
import { pressedDim } from '../theme/interaction';
import { spacing } from '../theme/spacing';
import { typography } from '../theme/typography';

export type ComparisonRow = {
  id: string;
  durationLabel: string;   // "2h 44m"
  arrivalLabel: string;    // "Arrive 11:45 AM"
  distanceLabel: string;   // "186 mi"
  descriptor: string;      // "Safest route with current conditions" / "8 min faster"
  conditions: RouteCondition[];
  isActive: boolean;
  isRecommended: boolean;
};

const CONDITION_META: Record<RouteCondition, { label: string; icon: keyof typeof Ionicons.glyphMap }> = {
  'low-light': { label: 'Low light', icon: 'moon' },
  wildlife: { label: 'Wildlife', icon: 'paw' },
  police: { label: 'Police', icon: 'shield' },
  road: { label: 'Road', icon: 'construct' },
};

/**
 * RouteComparisonSheet — compare the recommended route + alternates and
 * switch the active one. Presentational: the parent (/en-route) builds the
 * rows and owns selection. Bottom Modal overlay (same pattern as
 * FuelStopsSheet). Anchored to Figma 2:9033 (structure only).
 */
export function RouteComparisonSheet({
  visible,
  rows,
  onSelectRoute,
  onClose,
}: {
  visible: boolean;
  rows: ComparisonRow[];
  onSelectRoute: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent statusBarTranslucent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose} accessible={false} accessibilityViewIsModal>
        <Pressable style={styles.card} onPress={() => {}}>
          <SafeAreaView edges={['bottom']}>
            <View style={styles.header}>
              <Text style={styles.title}>Routes</Text>
              <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" hitSlop={12}>
                <Ionicons name="close" size={24} color={colors.labelSecondary} />
              </Pressable>
            </View>

            <FlatList
              data={rows}
              keyExtractor={(r) => r.id}
              accessibilityRole="list"
              renderItem={({ item }) => (
                <Pressable
                  style={({ pressed }) => [
                    styles.row,
                    item.isActive && styles.rowActive,
                    pressed && pressedDim,
                  ]}
                  onPress={() => onSelectRoute(item.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: item.isActive }}
                  accessibilityLabel={`${item.durationLabel}, ${item.descriptor}. ${item.arrivalLabel}, ${item.distanceLabel}.`}
                  accessibilityHint={item.isActive ? 'Current route' : 'Switch to this route'}
                >
                  <View style={styles.rowTop}>
                    <Text style={styles.duration}>{item.durationLabel}</Text>
                    {item.isActive && (
                      <Ionicons name="checkmark-circle" size={20} color={colors.freshgreen} />
                    )}
                  </View>
                  <Text style={[styles.descriptor, item.isRecommended && styles.descriptorSafe]}>
                    {item.descriptor}
                  </Text>
                  <Text style={styles.meta}>
                    {item.arrivalLabel} · {item.distanceLabel}
                  </Text>
                  {item.conditions.length > 0 && (
                    <View style={styles.chips}>
                      {item.conditions.map((c) => (
                        <View key={c} style={styles.chip}>
                          <Ionicons name={CONDITION_META[c].icon} size={13} color={colors.labelSecondary} />
                          <Text style={styles.chipText}>{CONDITION_META[c].label}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </Pressable>
              )}
            />
          </SafeAreaView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.6)', justifyContent: 'flex-end' },
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
  row: {
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.separatorSubtle,
    gap: 4,
  },
  rowActive: { /* active row gets the checkmark; no fill needed */ },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  duration: { ...typography.title2Emphasized, color: colors.black },
  descriptor: { ...typography.subheadlineRegular, color: colors.labelSecondary },
  descriptorSafe: { ...typography.subheadlineEmphasized, color: colors.freshgreen },
  meta: { ...typography.footnoteRegular, color: colors.labelSecondary },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: 4 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  chipText: { ...typography.caption1Regular, color: colors.labelSecondary },
});
```

- [ ] **Step 2: Verify theme tokens** (`title3Emphasized`, `title2Emphasized`, `subheadlineRegular`, `subheadlineEmphasized`, `footnoteRegular`, `caption1Regular`; `colors.white/black/labelSecondary/separatorSubtle/freshgreen`; `spacing.sm/md/lg`) exist:
```bash
rg -n "title2Emphasized|title3Emphasized|subheadlineRegular|subheadlineEmphasized|caption1Regular" theme/typography.ts
rg -n "freshgreen:|labelSecondary:|separatorSubtle:" theme/colors.ts
```
All should appear (confirmed in prior tasks). Substitute real names if any differ; do NOT invent tokens. The `rgba(0, 0, 0, 0.6)` scrim matches the FuelStopsSheet/report convention.

- [ ] **Step 3: Typecheck** — expected no output.

- [ ] **Step 4: Commit**
```bash
git add components/RouteComparisonSheet.tsx
git commit -m "feat: RouteComparisonSheet — compare/switch routes overlay

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Wire the FAB → sheet + build `ComparisonRow[]` + switch (`app/en-route.tsx`)

**Files:** Modify `app/en-route.tsx`

- [ ] **Step 1: Imports** — verified against the current file:
  - Add the new component import: `import { RouteComparisonSheet, type ComparisonRow } from '../components/RouteComparisonSheet';`
  - **Add `routeConditions` to the EXISTING `../lib/scoring` import** (the file already imports `pickWinner` from there — append `routeConditions`, don't add a second import line).
  - **`formatDuration` is ALREADY imported** (line 76: `import { formatDistance, formatDuration } from '../lib/format';`). **Add `formatTimeOfDay`** to that same line → `import { formatDistance, formatDuration, formatTimeOfDay } from '../lib/format';`. Do NOT re-import `formatDuration`.

- [ ] **Step 2: State + the rows derivation** (near the other state; `routes`, `recommended`, `activeRoute`, `allZones` exist from Task 2)
```tsx
  const [showComparison, setShowComparison] = useState(false);

  const comparisonRows = useMemo<ComparisonRow[]>(() => {
    const recMinutes = recommended?.estimatedMinutes ?? null;
    return routes.map((route) => {
      const minutes = route.estimatedMinutes;
      const arrival = new Date(Date.now() + minutes * 60_000);
      // time-delta descriptor vs the recommended (the "safe" baseline)
      let descriptor: string;
      if (route.type === 'recommended') {
        descriptor = 'Safest route with current conditions';
      } else if (recMinutes == null || minutes === recMinutes) {
        descriptor = 'Same time';
      } else {
        const delta = minutes - recMinutes;
        descriptor = delta < 0 ? `${-delta} min faster` : `${delta} min longer`;
      }
      return {
        id: route.id,
        durationLabel: formatDuration(minutes),
        arrivalLabel: `Arrive ${formatTimeOfDay(arrival)}`,
        distanceLabel: `${(route.distanceMeters / 1609.344).toFixed(0)} mi`,
        descriptor,
        conditions: routeConditions(route, allZones),
        isActive: route.id === activeRoute?.id,
        isRecommended: route.type === 'recommended',
      };
    });
  }, [routes, recommended, activeRoute?.id, allZones]);

  const handleSelectRoute = useCallback((id: string) => {
    setActiveRouteId(id);
    setShowComparison(false);
  }, []);
```
(`formatDuration` and `formatTimeOfDay`: reuse the existing helpers from `lib/format.ts`. If the file already formats duration via a local helper, reuse that; confirm the exact names and import them. If no `formatDuration` exists, format inline: `h > 0 ? \`${h}h ${m}m\` : \`${m} min\``.)

- [ ] **Step 3: Wire the FAB** (the `EnRoutePath` FloatingActionButton, currently no-op, label "Show alternate paths (coming soon)") — add `onPress` + relabel:
```tsx
            <FloatingActionButton
              size="48"
              accessibilityLabel="Compare routes"
              accessibilityHint="Compare alternate routes and switch"
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                setShowComparison(true);
              }}
            >
              <EnRoutePath width={24} height={24} />
            </FloatingActionButton>
```
(Confirm `Haptics` is imported — it is, used elsewhere.)

- [ ] **Step 4: Render the sheet** near the other top-level overlays (alongside `FuelStopsSheet` / `ReportDetailCard`):
```tsx
      <RouteComparisonSheet
        visible={showComparison}
        rows={comparisonRows}
        onSelectRoute={handleSelectRoute}
        onClose={() => setShowComparison(false)}
      />
```

- [ ] **Step 5: Typecheck** — expected no output.

- [ ] **Step 6: Manual simulator check (controller verifies):** tap the alternate-paths FAB → sheet lists the routes (recommended labeled "Safest route", alternates show "+N min" + chips); tap an alternate → sheet closes, the screen's ETA/distance/turns + the emphasized polyline switch to it; tap the recommended → switches back.

- [ ] **Step 7: Commit**
```bash
git add app/en-route.tsx
git commit -m "feat: alternate-paths FAB opens route comparison + switches active route

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Per-route map duration badges (`app/en-route.tsx`)

**Files:** Modify `app/en-route.tsx`

- [ ] **Step 1: Render a duration badge Marker per route** at the route's midpoint, near the `{routePolylines}` render (line ~1196). Tapping a badge switches to that route (parity with the sheet).
```tsx
        {routes.map((route) => {
          const mid = route.coordinates[Math.floor(route.coordinates.length / 2)];
          if (!mid) return null;
          const isActive = route.id === activeRoute?.id;
          return (
            <Marker
              key={`badge-${route.id}`}
              coordinate={mid}
              anchor={{ x: 0.5, y: 0.5 }}
              onPress={() => setActiveRouteId(route.id)}
              tracksViewChanges={false}
            >
              <View style={[styles.routeBadge, isActive && styles.routeBadgeActive]}>
                <Text style={[styles.routeBadgeText, isActive && styles.routeBadgeTextActive]}>
                  {formatDuration(route.estimatedMinutes)}
                </Text>
              </View>
            </Marker>
          );
        })}
```
(Confirm `Marker` is imported from `react-native-maps` — the file already imports `Polyline`/`Polygon` from it; add `Marker` if not present. Reuse the same `formatDuration` as Task 4.)

- [ ] **Step 2: Add badge styles** (raw numeric values matching en-route's local convention — the file uses raw numbers, not `spacing.*`):
```tsx
  routeBadge: {
    backgroundColor: colors.white,
    borderRadius: 100,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: colors.separatorSubtle,
  },
  routeBadgeActive: { backgroundColor: colors.freshgreen, borderColor: colors.freshgreen },
  routeBadgeText: { ...typography.caption1Emphasized, color: colors.black },
  routeBadgeTextActive: { color: colors.white },
```

- [ ] **Step 3: Typecheck** — expected no output.

- [ ] **Step 4: Manual check (controller):** each route shows a duration badge on the map; the active route's badge is filled freshgreen; tapping a non-active badge switches to it (ETA/polyline follow). Note: badges may overlap where routes converge — acceptable v1 (Figma-audit follow-up).

- [ ] **Step 5: Commit**
```bash
git add app/en-route.tsx
git commit -m "feat: per-route duration badges on the /en-route map (tap to switch)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Acceptance + merge

**Files:** none (verification + merge)

- [ ] **Step 1: Full typecheck** — expected empty.
- [ ] **Step 2: End-to-end manual check (simulator):** start a route with alternates → tap the Compare FAB → sheet rows correct (Safest label, time deltas, chips); switch to an alternate (ETA/distance/turns/polyline/daylight all follow); switch back via the recommended row; tap a map badge to switch; confirm the recommended-by-default state is unchanged on fresh load; confirm a zero-alternate route shows a single "Safest route" row (no crash).
- [ ] **Step 3: Final code-reviewer subagent** on `git diff main...feat/alternate-route-comparison`. Confirm: the `recommended`→`activeRoute` refactor repointed every display/effect site (grep `recommended` — only the definition + comments remain) with no missed consumer; `recommended` retained for the Safest label + fallback; `routeConditions` reuses `isPointInZone` (no duplicated proximity math) and is pure; reserved-color rule (freshgreen accents allowed); the sheet's a11y scrim matches the repo precedent; no fabricated data; rules-of-hooks intact. Fix + re-review.
- [ ] **Step 4: Squash-merge to `main`**
```bash
git checkout main
git merge --squash feat/alternate-route-comparison
git commit -m "feat: alternate-route comparison (/en-route)

The alternate-paths FAB opens a comparison sheet (duration/arrival/distance/
'Safest route' descriptor/condition chips); tapping a route switches the
active route — ETA, distance, turns, daylight, and polyline emphasis follow
it. Per-route duration badges on the map (tap to switch). routeConditions()
helper (reuses isPointInZone); recommended→activeRoute refactor. Anchored to
Figma 2:9033. Local-only, no new permission. Phase 1 (Effort A).

Plan: docs/superpowers/plans/2026-05-31-alternate-route-comparison.md

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
git branch -D feat/alternate-route-comparison
```
- [ ] **Step 5: `docs/learnings.md` entry** if anything non-obvious surfaced (e.g. the `activeRoute` vs `recommended` split — keeping both — or a missed-repoint gotcha). Newest at top. Also reconcile `docs/next-session.md` (mark Effort A's alternate-route comparison shipped + voice/volume hidden).

---

## Self-Review

**1. Spec coverage** (against the spec):
- `routeConditions` helper reusing `isPointInZone` → Task 1 (and the spec's `zoneTouchesRoute` extraction is unnecessary — documented). ✅
- `recommended`→`activeRoute` refactor (state + ~14 repoints + polyline emphasis) → Task 2. ✅
- `RouteComparisonSheet` (duration/arrival/distance/descriptor/chips, active marked, tap→switch) → Task 3 + Task 4 derivation. ✅
- Descriptor: recommended "Safest route…"; alternate time-delta vs recommended ("8 min faster"/"4 min longer"/"Same time") → Task 4 Step 2. ✅
- FAB opens sheet (no more "coming soon") → Task 4 Step 3. ✅
- Map duration badges + tap-to-switch → Task 5. ✅
- Zero-alternates = single "Safest" row → covered (rows maps all `routes`; one route → one row) + Task 6 check. ✅

**2. Placeholder scan:** every code step is complete. The only "confirm the helper name" notes (formatDuration/formatTimeOfDay) are real reuse instructions with an inline fallback given — not placeholders. Theme-token + Marker/Haptics import-existence checks guard against assumptions.

**3. Type/name consistency:** `RouteCondition`/`routeConditions` (Task 1) consumed in Task 3 (`CONDITION_META`) + Task 4 (derivation). `ComparisonRow` (Task 3) built in Task 4. `activeRouteId`/`activeRoute`/`setActiveRouteId` (Task 2) used in Tasks 4–5. `recommended` retained (Task 2) + used for the Safest baseline (Task 4). `showComparison`/`comparisonRows`/`handleSelectRoute` consistent across Task 4.

**Risk noted:** Task 2 is the high-risk task (the repoint). It's isolated as its own commit; the Step-4 grep audit + tsc + the spec-reviewer catch missed sites. `recommended` is deliberately kept (not renamed) so the score-winner label + fallback survive.
