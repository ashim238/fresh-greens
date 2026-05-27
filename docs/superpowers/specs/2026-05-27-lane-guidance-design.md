# Lane guidance + Mapbox Directions migration — design

**Status:** Draft, awaiting user review
**Author:** Brainstorming session, 2026-05-27
**Topic:** Multi-lane visualization on /en-route turn card, backed by a routing-provider migration to Mapbox Directions API.

---

## Goal

When approaching a maneuver on a road with multiple lanes, /en-route should show a lane strip above the turn card indicating which lanes the driver should occupy. Targeted at real users post-thesis (shipping quality, not demo polish).

## Decisions made during brainstorming

| Question | Decision |
|---|---|
| Audience | Real users post-thesis. Shipping quality, fall-through cases must work. |
| Data source | Mapbox Directions API. Lane data lives in `bannerInstructions[].sub.components`. |
| Routing scope | Mapbox primary, OSRM as automatic fallback. Source ladder: `mapbox → osrm → cache → mock`. |
| Placement | Top of the existing en-route turn card (above the maneuver instruction). |
| Animation | Animated mount/unmount with `useReduceMotion()` gating. |
| Design system | Add `colors.whiteFill12` token. All other primitives already exist. |

## Architecture

Three layers stack cleanly, mirroring the existing three-layer architecture (adapters / scoring / screens).

### Adapter layer (`lib/api/routes.ts`)

- New `buildMapboxUrl(origin, dest)` — Mapbox Directions v5 endpoint, params `banner_instructions=true&steps=true&overview=full&geometries=geojson&access_token=…`
- New `parseMapboxStep(step)` — returns the existing `RouteStep` shape *plus* a new `lanes?: Lane[]` field extracted from `step.bannerInstructions[].sub.components`
- Existing `buildOSRMUrl` + `parseOSRMStep` stay untouched
- `getRoutesBetween` source ladder becomes: `mapbox → osrm → cache → mock`. Each tier is tried in order; first success wins.
- `RouteSource` type gains `'mapbox'`.

### Type layer (`lib/api/routes.ts`)

```ts
export type LaneDirection =
  | 'straight'
  | 'slight-left' | 'left' | 'sharp-left'
  | 'slight-right' | 'right' | 'sharp-right'
  | 'uturn';

export type Lane = {
  /** Driver should use this lane to follow the route. */
  active: boolean;
  /** All turns this lane allows. A lane can permit "straight or right". */
  directions: LaneDirection[];
  /** When active, the specific direction to take. Lets us highlight one
      glyph in a multi-direction lane. */
  activeDirection?: LaneDirection;
};

// Extend the existing RouteStep
export type RouteStep = {
  // ...existing fields
  lanes?: Lane[]; // optional — only Mapbox-sourced steps have this
};
```

`LaneDirection` is intentionally a subset of `ManeuverKind` (no `depart`/`arrive`/`merge`/`roundabout` — those aren't lane choices). Tighter type prevents misuse downstream and makes the glyph dispatch table smaller.

### UI layer

- New `components/LaneStrip.tsx`
- Trigger predicate + JSX integration in `app/en-route.tsx`

## Data extraction

`parseMapboxStep` extracts lanes from the first banner that has lane components:

```ts
function parseMapboxStep(step: any): RouteStep {
  // ... existing geometry + maneuver parsing

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
          directions: c.directions.map(mapMapboxDirection),
          activeDirection: c.activeDirection
            ? mapMapboxDirection(c.activeDirection)
            : undefined,
        }))
    : undefined;

  return { /* existing fields */, lanes };
}

function mapMapboxDirection(d: string): LaneDirection {
  // 'slight left' → 'slight-left', 'sharp right' → 'sharp-right', etc.
  return d.replace(/ /g, '-') as LaneDirection;
}
```

## LaneStrip component (`components/LaneStrip.tsx`)

### Props

```ts
type Props = {
  lanes: Lane[];           // from RouteStep.lanes
  visible: boolean;        // drives the animated mount/unmount
  style?: ViewStyle;       // for the turn card's positioning
};
```

### Layout (anchored to 8pt grid)

- Strip width: 100% of turn card content area
- Strip height: 56pt (40pt cell + 8pt top/bottom padding)
- Cell width: `flex: 1` (cells fill width evenly). Minimum 32pt; the strip gets visually tighter rather than scrollable when too many lanes.
- Cell padding: 8pt internal
- Gap between cells: 4pt — cells read as discrete columns without fragmenting into separate widgets
- Glyph size: 24pt single-direction, 16pt each when stacked horizontally in multi-direction cells

### State styling

| State | Cell bg | Glyph color | Glyph opacity |
|---|---|---|---|
| Active | `colors.whiteFill12` (NEW token: `rgba(255,255,255,0.12)`) | `colors.white` | 1.0 |
| Inactive | transparent | `colors.white` | 0.3 (matches `PageControl` inactive) |

### Glyph dispatch (Phosphor deep-imports)

| LaneDirection | Phosphor icon |
|---|---|
| `straight` | `ArrowUp` |
| `slight-left` | `ArrowUpLeft` |
| `left` | `ArrowBendUpLeft` (same as turn card maneuver) |
| `sharp-left` | `ArrowElbowLeft` |
| `slight-right` | `ArrowUpRight` |
| `right` | `ArrowBendUpRight` (same as turn card maneuver) |
| `sharp-right` | `ArrowElbowRight` |
| `uturn` | `ArrowUTurnLeft` |

### Multi-direction lanes

When a lane allows e.g. "straight or right":
- Render glyphs horizontally inside the cell at 16pt each with 4pt gap
- When `lane.active === true` and `activeDirection` is set, the matching glyph gets full opacity; others get 50% (still visible — driver should know the lane permits other turns — but visually subordinate)
- When `lane.active === false`, all glyphs get 30%

### Accessibility

Strip-level a11y (not per-cell, to avoid VoiceOver navigating into individual lanes):

```ts
accessible
accessibilityRole="text"
accessibilityLabel={buildLaneLabel(lanes)}
```

`buildLaneLabel(lanes)` logic:
- All active → `"All lanes go this way"` (rare)
- One active → `"Use the {nth} lane from the {left|right}"` (whichever side it's closer to)
- Contiguous block on left → `"Use leftmost {N} lanes"`
- Contiguous block on right → `"Use rightmost {N} lanes"` (most common — highway exits)
- Middle contiguous block → `"Use middle {N} lanes"`
- Non-contiguous → `"Use lanes {comma-list} from the left"` (rare)

### Animated mount/unmount

```tsx
import { useEffect, useRef } from 'react';
import { Animated, Easing } from 'react-native';
import { useReduceMotion } from '../hooks/useReduceMotion';

export function LaneStrip({ lanes, visible }: Props) {
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
      useNativeDriver: false, // maxHeight animates; native driver isn't usable for layout properties
    }).start();
  }, [visible, reduceMotion]);

  const maxHeight = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 56],
  });

  return (
    <Animated.View style={[styles.strip, { maxHeight, opacity: progress }]}>
      {/* glyph cells */}
    </Animated.View>
  );
}
```

The component is always mounted; presence is purely controlled by the `visible` prop. Reduce-motion users get the same final state with `setValue` instead of a tween.

## Trigger logic (`app/en-route.tsx`)

```ts
const showLaneStrip = useMemo(() => {
  const lanes = nextStepInfo?.step.lanes;
  if (!lanes || lanes.length < 2) return false;

  // The strip earns its real estate by representing a real *decision*.
  // "All lanes go this way" isn't a lane decision — no value rendering.
  const activeCount = lanes.filter(l => l.active).length;
  if (activeCount === 0) return false;
  if (activeCount === lanes.length) return false;

  // Terminal states (arrived, off-route) suppress the strip.
  if (nextStepInfo.status !== 'upcoming') return false;

  // 500m is the "you should be looking at this now" threshold for actually
  // changing lanes. Mapbox primary banners trigger ~800m; secondary ~300m.
  // 500m sits between — earlier feels speculative, later feels rushed.
  return nextStepInfo.distanceMeters < 500;
}, [nextStepInfo]);
```

## JSX integration

```tsx
<View style={styles.turnCard}>
  <LaneStrip
    lanes={nextStepInfo?.step.lanes ?? []}
    visible={showLaneStrip}
  />
  <View style={styles.turnTop}>
    <ManeuverIcon ... />
    <View style={styles.turnText}>
      <Text style={styles.turnInstruction}>{...}</Text>
      <Text style={styles.turnDistance}>{...}</Text>
    </View>
  </View>
  {turnHazards.length > 0 && (
    <View style={styles.hazardRow}>{/* existing */}</View>
  )}
</View>
```

Three-tier vertical composition: **lanes (what to do) → maneuver (when) → hazards (what to watch for)**. Each tier earns its row only when relevant.

## Background-refetch interaction

- Existing 90s background refetch gate changes from `source !== 'osrm'` to `source !== 'mapbox'`
- When Mapbox finally responds after starting on OSRM/cache, lanes appear mid-trip. Strip mounts via the visible prop flip — same animation path as crossing the distance threshold.
- Reverse (Mapbox → OSRM regression) is clean — strip unmounts; maneuver + hazard rows stay.
- `minStepIndexRef` monotonic guard already handles step-array swaps; lanes follow the step they're attached to.

## Failure modes (intentional graceful degradation)

| Scenario | Behavior |
|---|---|
| Mapbox returns a route but no banner_instructions for the step | Strip stays absent. Maneuver instruction alone — same as today. |
| Banner has `active: true` lane but no `activeDirection` | Render all that lane's `directions` glyphs at full opacity (vs. one highlighted). Slight loss of precision; no broken state. |
| Mapbox unreachable → OSRM fallback fires | OSRM steps have no `lanes` field. Strip absent. No error UI. |
| Mapbox quota exceeded | Same as unreachable — OSRM fallback. No user-visible error. |
| Mock route fallback | Mock steps have no `lanes`. Strip absent. Existing "Demo route" pill semantics unchanged. |

## Quota math

- Mapbox Directions free tier: 100k requests/month ≈ 3.3k/day
- Cache hits do not count toward quota
- Per-user load is bounded by destination changes (rare per session) + the 90s background refetch (gated on `source !== 'mapbox'`, so refetch only fires when we're NOT already on Mapbox)
- Comfortable margin for thesis + a small beta cohort

## Zone scoring / daylight / hazard invariance

All operate on `Route.coordinates: Coordinate[]`, populated identically by `parseOSRMStep` and `parseMapboxStep`. The scoring layer is route-source-agnostic by design (the three-layer architecture's main payoff). No changes to `pickWinner`, `gradientSegments`, `hazardsNearTurn`, `isPointInZone`.

Behavioral note: Mapbox and OSRM use different road graphs internally. For the same origin/destination pair they may route via slightly different streets, so the recommended polyline + the zones it passes through may differ. Not a regression — Mapbox is generally more current — but worth knowing during verification.

## PR breakdown

### PR 1 — Mapbox Directions adapter (no UI change)

**Scope:**
- New `buildMapboxUrl`, `parseMapboxStep` in `lib/api/routes.ts`
- `RouteSource` gains `'mapbox'`
- `getRoutesBetween` source ladder: `mapbox → osrm → cache → mock`
- Mapbox access token wired from Expo config (verify Search Box token has Directions scope)
- Background-refetch gate: `source !== 'osrm'` → `source !== 'mapbox'`
- `RouteStep` shape and `Route` shape unchanged externally; downstream just works

**Verification:**
- Fresh trip from /home: source returns `'mapbox'`, polyline appears, no visual change vs. OSRM
- Turn-by-turn on /en-route: instructions visually identical to today
- Disconnect WiFi mid-trip → cache fires → "Offline route · 3h old" pill appears
- Block `api.mapbox.com` at network level → OSRM fallback fires automatically → no broken UI
- Existing surfaces unchanged: home route preview, hazard panel, daylight gradient, ETA cluster
- Leave app idle with destination set → no runaway refetch loop

**Size:** ~300 LOC adapter + ~50 LOC ladder updates. Independently mergeable.

### PR 2 — Lane data + LaneStrip UI

**Scope:**
- New `Lane`, `LaneDirection` types
- `parseMapboxStep` extracts lanes
- `RouteStep` gains optional `lanes`
- New `colors.whiteFill12` token in `theme/colors.ts`
- New `components/LaneStrip.tsx` (Section 3 + animation amendment)
- `showLaneStrip` memo + JSX integration in `app/en-route.tsx`
- `buildLaneLabel` helper for a11y

**Verification:**
- Pick a known multi-lane interchange in Mapbox coverage (e.g., any freeway exit)
- Within 500m of the maneuver, strip appears with correct active-lane highlighting
- Strip layout doesn't break at 5+ lanes
- All-lanes-active scenarios → strip doesn't render
- Single-lane roads → no strip
- VoiceOver announces "Use rightmost N lanes" on approach
- Reduce-motion enabled → strip appears instantly with no slide
- Reduce-motion disabled → strip eases in over 220ms
- Mid-trip Mapbox→OSRM regression: strip unmounts gracefully

**Size:** ~150 LOC component + ~50 LOC integration + types. Depends on PR 1.

### PR 3 — Polish (optional follow-up)

- Multi-banner support (different lane layouts at different distances along the same step)
- Dynamic Type sweep on lane-strip a11y label
- Animation fine-tuning if 220ms ease-out feels off in real use
- Dark mode review (strip uses dark turn card; verify in true dark mode)

## Risks + callouts

1. **Mapbox access token scope.** Search Box token may not have Directions enabled. PR 1 needs to verify before merge.
2. **OSRM is NOT removed.** Stays as fallback tier. Existing "until a Mapbox-Directions or Google-Directions adapter lands" comment updates to reflect new status.
3. **No regressions to zone scoring / daylight / hazard logic.** All operate on `Route.coordinates` which is populated identically.
4. **Thesis-defense bracket.** PR 1 alone gives Mapbox routing (better quality, traffic-aware in future). PR 2 adds the lane viz. If only one fits before defense, PR 1 has more thesis value (unlocks future work).
