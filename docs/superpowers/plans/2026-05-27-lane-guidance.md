# Lane Guidance + Mapbox Directions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add multi-lane guidance to the /en-route turn card, backed by a Mapbox Directions migration with OSRM as automatic fallback.

**Architecture:** Three-layer change. Adapter layer adds Mapbox Directions as a new tier above OSRM in `getRoutesBetween`'s source ladder. Type layer adds `Lane` / `LaneDirection` and extends `RouteStep`. UI layer adds a `LaneStrip` component at the top of the existing turn card, gated on distance + active-lane heuristics.

**Tech Stack:** Mapbox Directions API v5, existing `expo-location` GPS subscription, existing `react-native-maps`, existing Phosphor icons, existing theme tokens. No new dependencies.

**Verification rhythm:** Fresh Greens has no test runner. Each task ends with TypeScript strict check (`npx tsc --noEmit`) + explicit manual verification steps. The per-PR rhythm (branch → implement → code-reviewer agent → commit → squash-merge → learnings) from `docs/workflow.md` applies.

**Spec:** [`docs/superpowers/specs/2026-05-27-lane-guidance-design.md`](../specs/2026-05-27-lane-guidance-design.md)

---

## File Structure

**PR 1 — Mapbox adapter (network only, no UI change):**
- `lib/api/routes.ts` (modify) — add `buildMapboxUrl`, `parseMapboxStep`, update `RouteSource` union, update `getRoutesBetween` source ladder
- `app/en-route.tsx` (modify) — flip background-refetch gate from `!== 'osrm'` to `!== 'mapbox'`

**PR 2 — Lane data + UI:**
- `lib/api/routes.ts` (modify) — add `Lane`, `LaneDirection` types; extend `parseMapboxStep` to populate `lanes`; extend `RouteStep` with optional `lanes`
- `theme/colors.ts` (modify) — add `whiteFill12` token
- `components/LaneStrip.tsx` (create) — new component
- `app/en-route.tsx` (modify) — `showLaneStrip` memo + JSX integration at top of turn card

---

# PR 1 — Mapbox Directions Adapter

### Task 1: Branch + update `RouteSource` union

**Files:**
- Modify: `lib/api/routes.ts` (RouteSource type definition)

- [ ] **Step 1: Create branch**

```bash
git checkout main && git pull origin main
git checkout -b feat/mapbox-directions-adapter
```

- [ ] **Step 2: Update `RouteSource` to include `'mapbox'`**

Locate the existing `RouteSource` type definition in `lib/api/routes.ts` (search for `type RouteSource`). Update it:

```ts
/**
 * Where a route came from. The source ladder in getRoutesBetween:
 *   - 'mapbox' — primary network source (lanes, banner instructions)
 *   - 'osrm'   — automatic fallback when Mapbox unreachable/quota
 *   - 'cache'  — AsyncStorage replay when both network sources fail
 *   - 'mock'   — synthetic catastrophe-fallback (also used in tests)
 */
export type RouteSource = 'mapbox' | 'osrm' | 'cache' | 'mock';
```

- [ ] **Step 3: Verify typecheck**

```bash
npx tsc --noEmit
```

Expected: no errors. The new union value is non-breaking for existing call sites that compare to specific strings.

### Task 2: Add `buildMapboxUrl` helper

**Files:**
- Modify: `lib/api/routes.ts` (add new helper near existing `buildOSRMUrl`)

- [ ] **Step 1: Locate `buildOSRMUrl` in `lib/api/routes.ts`**

Search for `function buildOSRMUrl` to find its location.

- [ ] **Step 2: Add `buildMapboxUrl` directly below `buildOSRMUrl`**

```ts
/**
 * Mapbox Directions v5 URL for `driving-traffic` profile.
 *
 *   - `geometries=geojson` + `overview=full` returns the polyline as
 *     a GeoJSON LineString matching OSRM's shape — parseMapboxStep
 *     and parseOSRMStep populate Route.coordinates identically.
 *   - `steps=true` enables turn-by-turn step data.
 *   - `banner_instructions=true` enables lane data (in PR 2's
 *     parseMapboxStep extension). Cheap to enable now even though
 *     PR 1 doesn't read banners — keeps the URL stable across the
 *     two PRs and avoids a second adapter rev when PR 2 lands.
 *   - `driving-traffic` profile uses live traffic data when available
 *     (free tier includes it). Falls back to typical-traffic when not.
 *
 * Token: process.env.EXPO_PUBLIC_MAPBOX_TOKEN (already wired for
 * Search Box in lib/api/places.ts — same token, same account).
 */
function buildMapboxUrl(
  origin: Coordinate,
  destination: Coordinate,
): string | null {
  const token = process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? '';
  if (!token) {
    console.warn('[routes] EXPO_PUBLIC_MAPBOX_TOKEN not set — skipping Mapbox tier.');
    return null;
  }
  const coords = `${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}`;
  const params = new URLSearchParams({
    geometries: 'geojson',
    overview: 'full',
    steps: 'true',
    banner_instructions: 'true',
    access_token: token,
  });
  return `https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${coords}?${params.toString()}`;
}
```

- [ ] **Step 3: Verify typecheck**

```bash
npx tsc --noEmit
```

Expected: no errors.

### Task 3: Add `parseMapboxStep` helper (without lanes)

**Files:**
- Modify: `lib/api/routes.ts` (add new parser near existing `parseOSRMStep`)

- [ ] **Step 1: Locate `parseOSRMStep` in `lib/api/routes.ts`**

Read the function to understand its return shape and any null-guards it does. Mapbox uses the same OSRM-derived schema, so most parsing is structurally identical.

- [ ] **Step 2: Add `parseMapboxStep` directly below `parseOSRMStep`**

PR 1 returns a `RouteStep` with everything *except* `lanes` (added in PR 2 Task 8).

```ts
/**
 * Parse a single Mapbox Directions step into the codebase's
 * RouteStep shape. Mapbox uses an OSRM-derived schema, so step
 * structure (maneuver, geometry, distance, duration, name) is
 * near-identical — the only divergence handled here is the banner
 * shape, which PR 2's lane extension consumes.
 *
 * Returns null when the step is malformed (missing maneuver or
 * geometry coordinates). getRoutesBetween's outer try/catch
 * already swallows nulls — null here just means "skip this step"
 * rather than "fail the whole route."
 */
function parseMapboxStep(step: any): RouteStep | null {
  if (!step?.maneuver) return null;
  if (!step.geometry?.coordinates?.length) return null;

  const kind = classifyManeuver(
    step.maneuver.type,
    step.maneuver.modifier,
  );
  const name: string | undefined = step.name || undefined;

  return {
    kind,
    instruction: buildInstruction(kind, name),
    name,
    distanceMeters: step.distance ?? 0,
    durationSeconds: step.duration ?? 0,
    maneuverLocation: {
      latitude: step.maneuver.location[1],
      longitude: step.maneuver.location[0],
    },
    coordinates: step.geometry.coordinates.map((c: [number, number]) => ({
      latitude: c[1],
      longitude: c[0],
    })),
  };
}
```

- [ ] **Step 3: Verify typecheck**

```bash
npx tsc --noEmit
```

Expected: no errors. `parseMapboxStep` returns the exact same shape `parseOSRMStep` does.

### Task 4: Wire Mapbox tier into `getRoutesBetween` source ladder

**Files:**
- Modify: `lib/api/routes.ts` (update `getRoutesBetween` function body)

- [ ] **Step 1: Locate `getRoutesBetween`**

Search for `export async function getRoutesBetween`. Read the current source ladder (osrm → cache → mock) to understand the existing structure.

- [ ] **Step 2: Add Mapbox tier at the top of the ladder**

Prepend a Mapbox attempt before the existing OSRM attempt. Both must use the same parsing → Route shape, so the downstream code (cache write, return value) is identical.

```ts
// New: Mapbox tier (replaces "try OSRM first" with "try Mapbox first")
const mapboxUrl = buildMapboxUrl(origin, destination);
if (mapboxUrl) {
  try {
    const response = await fetch(mapboxUrl);
    if (response.ok) {
      const data = await response.json();
      const routes = parseMapboxRoutes(data); // see Step 3
      if (routes.length > 0) {
        // Best-effort cache write — same as OSRM tier already does
        void saveActiveRoute(routes, destination);
        return { routes, source: 'mapbox' as const };
      }
    }
  } catch (err) {
    console.warn('[routes] Mapbox tier failed:', err);
    // Fall through to OSRM tier below
  }
}

// Existing OSRM tier stays unchanged — it's now tier 2 instead of tier 1
const osrmUrl = buildOSRMUrl(origin, destination);
// ... existing OSRM code ...
```

- [ ] **Step 3: Add `parseMapboxRoutes` helper**

Mapbox returns routes in `data.routes[]` — parallel to OSRM but with subtly different shape at the route level (legs[] containing steps, not steps[] directly). Add this helper near `parseOSRMStep`:

```ts
/**
 * Parse Mapbox Directions response into Route[]. Mapbox structures
 * each route as `legs[].steps[]` (a "leg" is the path between two
 * waypoints; for a single-waypoint trip there's exactly one leg).
 * Flatten legs into a single steps array for the Route shape.
 */
function parseMapboxRoutes(data: any): Route[] {
  if (!data?.routes?.length) return [];
  return data.routes.map((r: any, idx: number): Route => {
    const legs = r.legs ?? [];
    const allSteps = legs.flatMap((leg: any) => leg.steps ?? []);
    const steps = allSteps
      .map(parseMapboxStep)
      .filter((s: RouteStep | null): s is RouteStep => s !== null);

    const coordinates = (r.geometry?.coordinates ?? []).map(
      (c: [number, number]) => ({
        latitude: c[1],
        longitude: c[0],
      }),
    );

    return {
      id: `mapbox-${idx}`,
      type: idx === 0 ? 'recommended' : 'alternate',
      coordinates,
      estimatedMinutes: Math.round((r.duration ?? 0) / 60),
      distanceMiles: Math.round((r.distance ?? 0) * 0.000621371 * 10) / 10,
      steps,
    };
  });
}
```

- [ ] **Step 4: Verify typecheck**

```bash
npx tsc --noEmit
```

Expected: no errors.

### Task 5: Update background-refetch gate

**Files:**
- Modify: `app/en-route.tsx`

- [ ] **Step 1: Locate the background-refetch effect**

Search `app/en-route.tsx` for `setInterval(90_000` or `90_000`. The effect that fires the refetch is gated on the current `routeSource`.

- [ ] **Step 2: Flip the gate condition**

Change `source !== 'osrm'` to `source !== 'mapbox'` (so the refetch fires when we're on osrm/cache/mock, trying to upgrade to mapbox).

The exact line will be something like:
```ts
if (routeSource === 'osrm') return; // old
```
becomes:
```ts
if (routeSource === 'mapbox') return; // new
```

The comment block above the effect should also be updated to reflect the new semantics.

- [ ] **Step 3: Verify typecheck**

```bash
npx tsc --noEmit
```

Expected: no errors.

### Task 6: PR 1 verification (manual on device)

- [ ] **Step 1: Run the app**

```bash
npx expo start --ios
```

Wait for Metro + simulator to load.

- [ ] **Step 2: Verify Mapbox-sourced fresh route**

From /home, pick a destination via the search bar. Expected behaviors:
- Polyline appears within ~1s
- Daylight gradient renders (same as before)
- Tap "Go" → /en-route renders, no "Offline route" pill (route is fresh from Mapbox)
- Console log shows no `[routes] Mapbox tier failed` warnings

To confirm source=mapbox: add a temporary `console.log('[routes] source:', source)` in en-route's route-loading code, OR check React DevTools state.

- [ ] **Step 3: Verify OSRM fallback**

Block Mapbox at the network level:
```bash
# In a separate terminal — adds a hostfile entry pointing api.mapbox.com to 127.0.0.1
sudo sh -c "echo '127.0.0.1 api.mapbox.com' >> /etc/hosts"
```

Reload the app, pick a destination. Expected:
- Polyline still appears (OSRM fired)
- Console log: `[routes] Mapbox tier failed: ...`
- No broken UI

Restore /etc/hosts afterward:
```bash
sudo sed -i '' '/api.mapbox.com/d' /etc/hosts
```

- [ ] **Step 4: Verify cache fallback**

Disconnect WiFi mid-trip on /en-route after the route has loaded. The "Offline route · 3h old" pill should appear when the next refetch attempt (90s background interval) fails.

- [ ] **Step 5: Verify zone scoring + daylight + hazards still work**

Cross-check on a route in Mobile, AL (the curated catalog's seed region) so community-report markers appear. Verify:
- Daylight gradient on polyline (orange → mauve → indigo)
- Hazard chips render below the turn card when route passes near community reports
- ETA + arrival display correct

### Task 7: PR 1 code-reviewer + commit + merge

- [ ] **Step 1: Run code-reviewer agent**

```
Agent: code-reviewer
Prompt: Review the current diff on feat/mapbox-directions-adapter. Two file changes — lib/api/routes.ts adds Mapbox tier above OSRM in the source ladder, plus app/en-route.tsx flips background-refetch gate. Focus: error handling on the new fetch, cache-write race conditions, type consistency between parseMapboxRoutes and existing parseOSRMRoutes. Report concisely.
```

Address any flagged issues inline. Typecheck again after fixes.

- [ ] **Step 2: Commit + squash-merge**

```bash
git add lib/api/routes.ts app/en-route.tsx
git commit -m "$(cat <<'EOF'
feat: Mapbox Directions as primary route source, OSRM fallback

- New buildMapboxUrl + parseMapboxStep + parseMapboxRoutes adapters
- RouteSource union gains 'mapbox'
- getRoutesBetween source ladder: mapbox → osrm → cache → mock
- en-route background-refetch gate flips from osrm to mapbox
- No UI changes; lane data PR 2 lands next

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"

git checkout main
git merge --squash feat/mapbox-directions-adapter
git commit -m "feat: Mapbox Directions adapter (#XXX)

Mapbox primary, OSRM fallback. Lane data follows in #XXX+1.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"

git branch -D feat/mapbox-directions-adapter
```

- [ ] **Step 3: Decide on learnings entry**

Per `docs/workflow.md` Step 11: if anything in PR 1 took two tries or surprised at audit, append a branch-headed entry to `docs/learnings.md`. If not, skip.

---

**End of PR 1.** Mapbox routing is live with OSRM fallback. No UI change. Verify the app still works as before, then proceed to PR 2.

---

# PR 2 — Lane Data + LaneStrip UI

### Task 8: Branch + add `whiteFill12` color token

**Files:**
- Modify: `theme/colors.ts`

- [ ] **Step 1: Create branch**

```bash
git checkout main && git pull
git checkout -b feat/lane-strip-ui
```

- [ ] **Step 2: Add `whiteFill12` token**

Locate the colors object in `theme/colors.ts`. Add `whiteFill12` near other white/fill tokens:

```ts
// Subtle white fill on dark surfaces (12% opacity). Used by:
//   - LaneStrip active-lane cell background — gives active lanes a
//     faint glow without competing with freshgreen brand color.
// Generalizable to any "active state on a dark surface" pattern.
whiteFill12: 'rgba(255, 255, 255, 0.12)',
```

- [ ] **Step 3: Verify typecheck**

```bash
npx tsc --noEmit
```

Expected: no errors.

### Task 9: Add `Lane` + `LaneDirection` types

**Files:**
- Modify: `lib/api/routes.ts` (add types, extend `RouteStep`)

- [ ] **Step 1: Add types near `ManeuverKind`**

```ts
/**
 * Direction a lane permits. Subset of ManeuverKind — lanes don't
 * have 'depart' / 'arrive' / 'merge' / 'roundabout' as choices.
 * Tighter type prevents misuse downstream and shrinks the glyph
 * dispatch table in LaneStrip.
 */
export type LaneDirection =
  | 'straight'
  | 'slight-left' | 'left' | 'sharp-left'
  | 'slight-right' | 'right' | 'sharp-right'
  | 'uturn';

/**
 * A single lane on the road approaching the next maneuver.
 *
 *   - `active: true`  → driver should use this lane to follow the route
 *   - `directions[]`  → all turns this lane permits (a lane can allow
 *                       "straight or right")
 *   - `activeDirection` → when active, the specific direction to take;
 *                         lets LaneStrip highlight one glyph in a
 *                         multi-direction lane.
 *
 * Lanes are ordered left-to-right as the driver faces forward.
 */
export type Lane = {
  active: boolean;
  directions: LaneDirection[];
  activeDirection?: LaneDirection;
};
```

- [ ] **Step 2: Extend `RouteStep` with optional `lanes`**

Locate the existing `RouteStep` type. Add the `lanes` field:

```ts
export type RouteStep = {
  // ...existing fields
  /** Lane layout for the maneuver. Mapbox-sourced only; OSRM/cache/
      mock steps don't have lane data. Optional throughout the stack. */
  lanes?: Lane[];
};
```

- [ ] **Step 3: Verify typecheck**

```bash
npx tsc --noEmit
```

Expected: no errors. Existing step-creating code (OSRM parser, mock generator, cache loader) doesn't populate `lanes`, which is fine since it's optional.

### Task 10: Extend `parseMapboxStep` to extract lanes

**Files:**
- Modify: `lib/api/routes.ts` (`parseMapboxStep` body + new helper)

- [ ] **Step 1: Add `mapMapboxDirection` helper**

Below `parseMapboxStep`, add:

```ts
/**
 * Maps a Mapbox direction string (e.g., "slight left") to the
 * codebase's LaneDirection enum ("slight-left"). The transform is
 * trivial: space → hyphen.
 */
function mapMapboxDirection(d: string): LaneDirection {
  return d.replace(/ /g, '-') as LaneDirection;
}
```

- [ ] **Step 2: Update `parseMapboxStep` to extract lanes**

Inside `parseMapboxStep`, after the existing field assignments, add lane extraction:

```ts
// Pull lanes from the FIRST banner that has a sub-banner with lane
// components. Mapbox returns banners in order of trigger distance
// (farthest first), so this is the earliest lane coaching for the
// step. Multi-banner refinement (different lane layouts at different
// distances) is deferred to a polish PR.
const laneBanner = (step.bannerInstructions ?? []).find((b: any) =>
  b.sub?.components?.some((c: any) => c.type === 'lane'),
);

const lanes: Lane[] | undefined = laneBanner
  ? laneBanner.sub.components
      .filter((c: any) => c.type === 'lane')
      .map((c: any) => ({
        active: !!c.active,
        directions: (c.directions ?? []).map(mapMapboxDirection),
        activeDirection: c.activeDirection
          ? mapMapboxDirection(c.activeDirection)
          : undefined,
      }))
  : undefined;
```

And include `lanes` in the returned object:

```ts
return {
  // ...existing fields
  lanes,
};
```

- [ ] **Step 3: Verify typecheck**

```bash
npx tsc --noEmit
```

Expected: no errors.

### Task 11: Create `LaneStrip` component

**Files:**
- Create: `components/LaneStrip.tsx`

- [ ] **Step 1: Write the full component**

```tsx
import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View, type ViewStyle } from 'react-native';

// Phosphor deep-imports — same pattern as en-route.tsx
import { ArrowBendUpLeft } from 'phosphor-react-native/src/icons/ArrowBendUpLeft';
import { ArrowBendUpRight } from 'phosphor-react-native/src/icons/ArrowBendUpRight';
import { ArrowElbowLeft } from 'phosphor-react-native/src/icons/ArrowElbowLeft';
import { ArrowElbowRight } from 'phosphor-react-native/src/icons/ArrowElbowRight';
import { ArrowUp } from 'phosphor-react-native/src/icons/ArrowUp';
import { ArrowUpLeft } from 'phosphor-react-native/src/icons/ArrowUpLeft';
import { ArrowUpRight } from 'phosphor-react-native/src/icons/ArrowUpRight';
import { ArrowUTurnLeft } from 'phosphor-react-native/src/icons/ArrowUTurnLeft';

import { useReduceMotion } from '../hooks/useReduceMotion';
import { colors } from '../theme/colors';
import type { Lane, LaneDirection } from '../lib/api/routes';

/**
 * Lane guidance strip — Apple Maps-style row of lane cells shown at
 * the top of the en-route turn card when approaching a multi-lane
 * maneuver. Highlights which lanes the driver should occupy.
 *
 * Visibility is controlled by the `visible` prop — the component is
 * always mounted, fades + grows in/out via an Animated.Value tween.
 * `useReduceMotion()` gates the tween; reduce-motion users get an
 * instant present/absent toggle via setValue.
 *
 * Spec: docs/superpowers/specs/2026-05-27-lane-guidance-design.md
 */
export function LaneStrip({
  lanes,
  visible,
  style,
}: {
  lanes: Lane[];
  visible: boolean;
  style?: ViewStyle;
}) {
  const reduceMotion = useReduceMotion();
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduceMotion) {
      progress.setValue(visible ? 1 : 0);
      return;
    }
    Animated.timing(progress, {
      toValue: visible ? 1 : 0,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      // maxHeight animates; layout properties can't use native driver
      useNativeDriver: false,
    }).start();
  }, [visible, reduceMotion, progress]);

  const maxHeight = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 56],
  });

  return (
    <Animated.View
      style={[styles.strip, { maxHeight, opacity: progress }, style]}
      accessible
      accessibilityRole="text"
      accessibilityLabel={buildLaneLabel(lanes)}
    >
      <View style={styles.cells}>
        {lanes.map((lane, idx) => (
          <LaneCell key={idx} lane={lane} />
        ))}
      </View>
    </Animated.View>
  );
}

function LaneCell({ lane }: { lane: Lane }) {
  return (
    <View style={[styles.cell, lane.active && styles.cellActive]}>
      <View style={styles.glyphRow}>
        {lane.directions.map((dir) => {
          const Icon = iconForDirection(dir);
          const isActiveDir = lane.active && lane.activeDirection === dir;
          const isMultiDir = lane.directions.length > 1;
          // Active lane + matching activeDirection → full opacity
          // Active lane + non-matching direction (multi-direction lane) → 0.5
          // Inactive lane → 0.3
          const opacity = lane.active
            ? isActiveDir || !isMultiDir || !lane.activeDirection
              ? 1.0
              : 0.5
            : 0.3;
          return (
            <Icon
              key={dir}
              size={isMultiDir ? 16 : 24}
              color={colors.white}
              weight="bold"
              style={{ opacity }}
            />
          );
        })}
      </View>
    </View>
  );
}

function iconForDirection(d: LaneDirection) {
  switch (d) {
    case 'straight': return ArrowUp;
    case 'slight-left': return ArrowUpLeft;
    case 'left': return ArrowBendUpLeft;
    case 'sharp-left': return ArrowElbowLeft;
    case 'slight-right': return ArrowUpRight;
    case 'right': return ArrowBendUpRight;
    case 'sharp-right': return ArrowElbowRight;
    case 'uturn': return ArrowUTurnLeft;
  }
}

/**
 * VoiceOver label for the strip as a whole. Counts active lanes from
 * each side, picks the smaller cluster, and frames as "Use {position}
 * lanes" so the driver hears a single coherent instruction rather
 * than per-cell announcements.
 */
function buildLaneLabel(lanes: Lane[]): string {
  if (lanes.length === 0) return 'Lane guidance';
  const activeIndices = lanes
    .map((l, i) => (l.active ? i : -1))
    .filter((i) => i >= 0);
  const total = lanes.length;

  if (activeIndices.length === 0) return 'Lane guidance';
  if (activeIndices.length === total) return 'All lanes go this way';

  const firstActive = activeIndices[0];
  const lastActive = activeIndices[activeIndices.length - 1];
  const isContiguous = lastActive - firstActive === activeIndices.length - 1;

  if (!isContiguous) {
    // Non-contiguous (rare). Generic announcement; the driver can see
    // the strip if they need precision.
    return `Use lanes ${activeIndices.map((i) => i + 1).join(', ')} from the left`;
  }

  const count = activeIndices.length;
  const fromLeft = firstActive;
  const fromRight = total - 1 - lastActive;

  if (count === 1) {
    const ordinal = (n: number) =>
      n === 0 ? 'leftmost' : n === total - 1 ? 'rightmost' : `${n + 1}${nthSuffix(n + 1)}`;
    return `Use the ${ordinal(firstActive)} lane`;
  }

  if (fromLeft === 0) return `Use leftmost ${count} lanes`;
  if (fromRight === 0) return `Use rightmost ${count} lanes`;
  return `Use middle ${count} lanes`;
}

function nthSuffix(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] ?? s[v] ?? s[0];
}

const styles = StyleSheet.create({
  strip: {
    overflow: 'hidden',
  },
  cells: {
    flexDirection: 'row',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  cell: {
    flex: 1,
    minWidth: 32,
    height: 40,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  cellActive: {
    backgroundColor: colors.whiteFill12,
  },
  glyphRow: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
```

- [ ] **Step 2: Verify typecheck**

```bash
npx tsc --noEmit
```

Expected: no errors. If any Phosphor icon import fails, check the exact filename in `node_modules/phosphor-react-native/src/icons/` and adjust (Phosphor's catalog evolves; if `ArrowElbowLeft` doesn't exist, use `ArrowElbowDownLeft` or similar nearest match).

### Task 12: Wire `showLaneStrip` + JSX into `app/en-route.tsx`

**Files:**
- Modify: `app/en-route.tsx`

- [ ] **Step 1: Add `LaneStrip` import**

Near the other component imports in en-route.tsx:

```ts
import { LaneStrip } from '../components/LaneStrip';
```

- [ ] **Step 2: Add `showLaneStrip` memo**

Place near other `nextStepInfo`-derived memos (search for `nextStepInfo` to find the cluster):

```ts
// Lane strip visibility — gated on multiple conditions so the strip
// only appears when it represents a real lane *decision* for the
// driver. See docs/superpowers/specs/2026-05-27-lane-guidance-design.md
// §"Trigger logic" for rationale.
const showLaneStrip = useMemo(() => {
  const lanes = nextStepInfo?.step.lanes;
  if (!lanes || lanes.length < 2) return false;

  // Filter "all lanes go this way" — no decision, no value rendering.
  const activeCount = lanes.filter((l) => l.active).length;
  if (activeCount === 0) return false;
  if (activeCount === lanes.length) return false;

  // Only on approach to a real upcoming maneuver, not terminal states.
  if (nextStepInfo.status !== 'upcoming') return false;

  // 500m is the "you should be looking at this now" threshold.
  return nextStepInfo.distanceMeters < 500;
}, [nextStepInfo]);
```

- [ ] **Step 3: Render `LaneStrip` at top of turn card**

Locate the turn card's JSX (search for `styles.turnCard` or the `turnInstruction` text element). Insert `LaneStrip` as the *first child* of the turn card View, before the existing maneuver icon + instruction row:

```tsx
<View style={styles.turnCard}>
  <LaneStrip
    lanes={nextStepInfo?.step.lanes ?? []}
    visible={showLaneStrip}
  />
  {/* Existing maneuver icon + instruction row stays unchanged */}
  <View style={styles.turnTop}>
    {/* ... */}
  </View>
  {/* Existing hazard row stays unchanged */}
</View>
```

- [ ] **Step 4: Verify typecheck**

```bash
npx tsc --noEmit
```

Expected: no errors.

### Task 13: PR 2 verification (manual on device)

- [ ] **Step 1: Run the app**

```bash
npx expo start --ios
```

- [ ] **Step 2: Pick a route with a known multi-lane maneuver**

Search for a destination that requires a highway exit or fork. Example: from anywhere in a major US metro, pick a destination that requires merging onto an interstate.

- [ ] **Step 3: Verify lane strip appears within 500m of the maneuver**

Drive (or simulate driving via Xcode's Location simulation: Debug → Simulate Location → custom route) toward the maneuver. The lane strip should fade in when you cross the 500m threshold.

Expected:
- 4-5 cells appear in the strip
- Active lanes have a subtle white-fill background
- Inactive lanes are transparent with dimmed glyphs
- Glyphs match the directions (e.g., right exit shows ↗ arrows)

- [ ] **Step 4: Verify reduce-motion behavior**

iOS Settings → Accessibility → Motion → Reduce Motion → On

Reload the app and approach the same maneuver. The strip should appear instantly (no slide-in tween).

- [ ] **Step 5: Verify graceful absence**

Pick a single-lane road destination (residential area, not highway). The strip should never appear. Maneuver instruction renders alone, same as before PR 2.

- [ ] **Step 6: Verify VoiceOver announcement**

Enable VoiceOver. Tap on the turn card. The lane strip should announce something like "Use rightmost 2 lanes" when active. Without VoiceOver, this is silent.

- [ ] **Step 7: Verify Mapbox → OSRM regression doesn't break the strip**

Block Mapbox at the network level (as in Task 6 Step 3) mid-trip. The route refetch should fall back to OSRM; the lane strip should unmount smoothly (fade-out tween if motion enabled). Maneuver instruction + hazard row stay.

### Task 14: PR 2 code-reviewer + commit + merge

- [ ] **Step 1: Run code-reviewer agent**

```
Agent: code-reviewer
Prompt: Review the current diff on feat/lane-strip-ui. Changes: lib/api/routes.ts adds Lane + LaneDirection types and lane extraction in parseMapboxStep, theme/colors.ts adds whiteFill12, components/LaneStrip.tsx is new, app/en-route.tsx wires showLaneStrip memo + JSX. Focus: edge cases in buildLaneLabel (empty lanes, all-active, non-contiguous), Animated.Value cleanup, accessibility correctness on the strip, any subtle reduce-motion edge cases. Report concisely.
```

Address flagged issues inline. Typecheck again after fixes.

- [ ] **Step 2: Commit + squash-merge**

```bash
git add lib/api/routes.ts theme/colors.ts components/LaneStrip.tsx app/en-route.tsx
git commit -m "$(cat <<'EOF'
feat: lane guidance strip on /en-route turn card

- New LaneStrip component renders Apple Maps-style lane cells at the
  top of the turn card when within 500m of a multi-lane maneuver
- Lane data extracted from Mapbox banner_instructions in parseMapboxStep
- Strip is gated: only shows when there's a real lane *decision*
  (not "all lanes go this way")
- Animated mount/unmount with useReduceMotion gating
- VoiceOver label summarizes lane guidance ("Use rightmost N lanes")

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)"

git checkout main
git merge --squash feat/lane-strip-ui
git commit -m "feat: lane guidance strip (#XXX)

Multi-lane visualization on /en-route turn card, driven by Mapbox
banner_instructions. Spec: docs/superpowers/specs/2026-05-27-lane-guidance-design.md

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"

git branch -D feat/lane-strip-ui
```

- [ ] **Step 3: Decide on learnings entry**

Lane-strip rendering, Mapbox response parsing, and Animated.Value layout-property animation are all new territory for this codebase. If any caused surprise at audit, append to `docs/learnings.md`.

---

**End of PR 2.** Lane guidance ships. Spec is fully implemented.

---

# Self-Review

**Spec coverage (per spec §"PR breakdown"):**
- ✅ PR 1: Mapbox adapter — Tasks 1–7
- ✅ PR 2: Lane data + UI — Tasks 8–14
- ⏭️ PR 3 (polish): deferred per spec; not part of this plan

**Placeholder scan:** No "TBD"/"TODO"/"add appropriate error handling." All steps include actual code or commands.

**Type consistency:**
- `LaneDirection` defined in Task 9, used in Task 11 (`iconForDirection`)
- `Lane` defined in Task 9, used in Task 11 (`LaneCell`) and Task 12 (`showLaneStrip` memo)
- `RouteSource` extended in Task 1, used in Task 4 (return value) and Task 5 (gate condition)
- `RouteStep.lanes` extended in Task 9, accessed in Task 12 — types match

**File path consistency:** All paths verified against current repo state (Task 0 implicit — I read the relevant files during plan drafting).
