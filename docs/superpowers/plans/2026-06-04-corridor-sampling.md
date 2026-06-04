# Corridor Sampling + Zone Cache — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace monolithic `getZonesForTrip` sampling with a budgeted corridor planner/executor (waves, gap-fill, straight-leg bbox), persist preview OSM to device cache, and extend coverage ahead of the car on /en-route — while keeping chips honest (loading → ready, long-trip footnote).

**Architecture:** Pure planning in `lib/corridor/planner.ts`, I/O in `lib/corridor/executor.ts` (delegates Overpass to `lib/api/zones.ts`), rolling ahead-of-car in `lib/corridor/navigation.ts`, knobs in `lib/corridor/constants.ts`. `/home` runs `mode: 'preview'` with `onPartial`; `/en-route` hydrates `zone-cache` then runs throttled `mode: 'navigation'`. Community reports stay screen-local (`reportZones`); cache is OSM-only.

**Tech Stack:** React Native + Expo + TypeScript, AsyncStorage (mirror `route-cache.ts`), existing Overpass builders in `zones.ts`, `lib/geo.ts` path helpers, `routePassesZone` from `lib/scoring.ts`. **No new npm dependencies.**

**Spec:** [docs/superpowers/specs/2026-06-04-corridor-sampling-and-data-sources-design.md](../specs/2026-06-04-corridor-sampling-and-data-sources-design.md)

**Verification gate (every task):** `npx tsc --noEmit` must exit 0.

**Planner gate (Tasks 2–3):** `node scripts/verify-corridor-planner.mjs` must exit 0.

**Branch:** `feat/corridor-sampling` off `main` before Task 1.

**Out of scope for this plan:** Part B richness (B0/B1/B4), `ZONE_CACHE_KEY_INCLUDES_ROUTE_ID: true`, v2 meta line under footnote.

---

## File map

| File | Responsibility |
|------|----------------|
| `lib/corridor/constants.ts` | All knobs from spec **Implementation knobs** |
| `lib/corridor/types.ts` | `SampleRequest`, `FetchBudget`, `CorridorMode`, `CorridorFetchMeta`, `CorridorPlan` |
| `lib/corridor/planner.ts` | `classifyLegs`, `planCorridor`, `planGapFills`, `planHotLegTighten`, `corridorRadius` |
| `lib/corridor/executor.ts` | `executeCorridorTrip`, waves, budget, merge-by-id |
| `lib/corridor/navigation.ts` | Uncovered-arc detection, `planNavigationRoll`, `fetchedAlong` tracking |
| `lib/api/zone-cache.ts` | `saveCorridorZones` / `loadCorridorZones` / `clearCorridorZones` |
| `lib/api/zones.ts` | Export `fetchCorridorSample`; thin `getZonesForTrip` delegate |
| `app/home.tsx` | `onPartial`, footnote, `saveCorridorZones`, scoped a11y |
| `app/en-route.tsx` | Cache hydrate, navigation roll, skip duplicate preview on hit |
| `scripts/verify-corridor-planner.mjs` | Node assertions on pure planner (no Jest in repo) |

---

## Task 1: Types + constants

**Files:**
- Create: `lib/corridor/types.ts`
- Create: `lib/corridor/constants.ts`

- [ ] **Step 1: Create `lib/corridor/types.ts`**

```typescript
import type { Coordinate, Zone, ZoneBounds } from '../api/zones';

export type ZoneSourceId = 'osm-overpass';

export type SampleRequest =
  | {
      kind: 'around';
      center: Coordinate;
      radiusMeters: number;
      sources: ZoneSourceId[];
      legId?: string;
    }
  | {
      kind: 'bbox';
      bounds: ZoneBounds;
      sources: ZoneSourceId[];
      legId?: string;
    };

export type FetchBudget = {
  maxMs: number;
  maxCalls: number;
  maxParallel: number;
};

export type CorridorFetchMeta = {
  wave: number;
  requestsDone: number;
  done: boolean;
};

export type CorridorMode = 'preview' | 'navigation';

export type GetZonesForTripOptions = {
  mode?: CorridorMode;
  budget?: FetchBudget;
  onPartial?: (zones: Zone[], meta: CorridorFetchMeta) => void;
  userLocation?: Coordinate | null;
  /** Navigation only — prior rolls + preview coverage. */
  fetchedAlong?: { startM: number; endM: number }[];
};

export type CorridorPlan = {
  wave1: SampleRequest[];
  wave2: SampleRequest[];
  pathMeters: number;
};
```

- [ ] **Step 2: Create `lib/corridor/constants.ts`**

Copy defaults from spec **Implementation knobs** (production = `default` preset):

```typescript
import type { FetchBudget } from './types';

export const PREVIEW_BUDGET: FetchBudget = {
  maxMs: 10_000,
  maxCalls: 16,
  maxParallel: 8,
};

export const NAV_BUDGET: FetchBudget = {
  maxMs: 6_000,
  maxCalls: 2,
  maxParallel: 2,
};

export const LONG_TRIP_METERS = 45_000;
export const WAVE1_ANCHOR_CAP = 8;
export const MAX_SEGMENT_ANCHORS = 20;
export const SEGMENT_TARGET_SPACING_M = 70_000;
export const SEGMENT_MAX_RADIUS_M = 12_000;
export const SEGMENT_MIN_RADIUS_M = 1_500;
export const CORRIDOR_RADIUS_SPACING_FACTOR = 0.4;

export const MIN_STRAIGHT_METERS = 20_000;
export const MAX_BEARING_DELTA_DEG = 12;
export const CARDINAL_TOLERANCE_DEG = 15;
export const BBOX_PAD_METERS = 2_000;

export const GAP_ARC_METERS = 80_000;
export const MAX_GAP_FILLS = 3;
export const GAP_MIN_UNCOVERED_METERS = 60_000;
export const HOT_LEG_ZONE_COUNT = 35;
export const HOT_LEG_RADIUS_FACTOR = 0.5;

export const SEGMENT_TIMEOUT_MS = 8_000;
export const OVERPASS_MIRROR_COUNT = 2;
export const TRIP_MOCK_ON_EMPTY = true;

export const NAV_ROLL_INTERVAL_MS = 45_000;
export const NAV_MIN_MOVE_METERS = 2_000;
export const NAV_AHEAD_METERS = 30_000;
export const NAV_AROUND_RADIUS_M = 3_000;
export const NAV_ROLL_WHEN_BACKGROUNDED = false;

export const ZONE_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
export const ZONE_CACHE_GRID_METERS = 50;
export const ZONE_CACHE_KEY_INCLUDES_ROUTE_ID = false;

export const LONG_TRIP_COPY_METERS = 250_000;
export const LONG_TRIP_FOOTNOTE_COPY =
  'Hazards checked along sampled stretches of this route.';
export const ALL_CLEAR_A11Y_LONG_TRIP =
  'No hazards found in checked areas along this route.';
export const PARTIAL_DEBOUNCE_MS = 0;

export const CLASSIFY_USE_DENSIFIED_POLYLINE = false;
export const COMMUNITY_MERGE_AFTER_WAVE = 1;
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit`  
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add lib/corridor/types.ts lib/corridor/constants.ts
git commit -m "feat: corridor types and sampling knobs"
```

---

## Task 2: Planner (pure) + verification script

**Files:**
- Create: `lib/corridor/planner.ts`
- Create: `scripts/verify-corridor-planner.mjs`

- [ ] **Step 1: Implement bearing + leg helpers in `planner.ts`**

```typescript
import type { Coordinate, ZoneBounds } from '../api/zones';
import { pathLengthMeters, sampleAlongPath } from '../geo';
import {
  BBOX_PAD_METERS,
  CARDINAL_TOLERANCE_DEG,
  CLASSIFY_USE_DENSIFIED_POLYLINE,
  CORRIDOR_RADIUS_SPACING_FACTOR,
  LONG_TRIP_METERS,
  MAX_BEARING_DELTA_DEG,
  MAX_SEGMENT_ANCHORS,
  MIN_STRAIGHT_METERS,
  SEGMENT_MAX_RADIUS_M,
  SEGMENT_MIN_RADIUS_M,
  SEGMENT_TARGET_SPACING_M,
  WAVE1_ANCHOR_CAP,
} from './constants';
import type { CorridorPlan, SampleRequest } from './types';

/** Bearing degrees 0–360 from a → b. */
export function bearingDeg(a: Coordinate, b: Coordinate): number {
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const dLng = ((b.longitude - a.longitude) * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function bearingDelta(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

function isCardinal(meanBearing: number, toleranceDeg: number): boolean {
  const cardinals = [0, 90, 180, 270];
  return cardinals.some((c) => bearingDelta(meanBearing, c) <= toleranceDeg);
}

const METERS_PER_DEGREE_LAT = 111_320;
function metersPerDegreeLng(lat: number): number {
  return METERS_PER_DEGREE_LAT * Math.cos((lat * Math.PI) / 180);
}

export function boundsForPathSlice(
  points: Coordinate[],
  padMeters: number,
): ZoneBounds {
  let south = Infinity;
  let north = -Infinity;
  let west = Infinity;
  let east = -Infinity;
  for (const p of points) {
    south = Math.min(south, p.latitude);
    north = Math.max(north, p.latitude);
    west = Math.min(west, p.longitude);
    east = Math.max(east, p.longitude);
  }
  const midLat = (south + north) / 2;
  const padLat = padMeters / METERS_PER_DEGREE_LAT;
  const padLng = padMeters / metersPerDegreeLng(midLat);
  return {
    south: south - padLat,
    north: north + padLat,
    west: west - padLng,
    east: east + padLng,
  };
}

export type ClassifiedLeg =
  | { kind: 'straight'; points: Coordinate[]; bounds: ZoneBounds; legId: string }
  | { kind: 'curved'; points: Coordinate[]; legId: string };

export function classifyLegs(path: Coordinate[]): ClassifiedLeg[] {
  if (path.length < 2) return [];
  const legs: ClassifiedLeg[] = [];
  let runStart = 0;
  let runLen = 0;
  let bearingSum = 0;
  let bearingCount = 0;
  let prevBearing = bearingDeg(path[0], path[1]);

  for (let i = 1; i < path.length; i++) {
    const segBearing = bearingDeg(path[i - 1], path[i]);
    const segLen = pathLengthMeters([path[i - 1], path[i]]);
    const delta = bearingDelta(prevBearing, segBearing);

    if (i === 1 || delta <= MAX_BEARING_DELTA_DEG) {
      runLen += segLen;
      bearingSum += segBearing;
      bearingCount += 1;
      prevBearing = segBearing;
      continue;
    }

    pushLeg(path, runStart, i, runLen, bearingSum, bearingCount, legs);
    runStart = i - 1;
    runLen = segLen;
    bearingSum = segBearing;
    bearingCount = 1;
    prevBearing = segBearing;
  }
  pushLeg(path, runStart, path.length, runLen, bearingSum, bearingCount, legs);
  return legs;
}

function pushLeg(
  path: Coordinate[],
  startIdx: number,
  endIdx: number,
  runLen: number,
  bearingSum: number,
  bearingCount: number,
  legs: ClassifiedLeg[],
): void {
  const points = path.slice(startIdx, endIdx);
  if (points.length < 2) return;
  const legId = `leg-${legs.length}`;
  const meanBearing = bearingSum / Math.max(1, bearingCount);
  if (
    runLen >= MIN_STRAIGHT_METERS &&
    isCardinal(meanBearing, CARDINAL_TOLERANCE_DEG)
  ) {
    legs.push({
      kind: 'straight',
      points,
      bounds: boundsForPathSlice(points, BBOX_PAD_METERS),
      legId,
    });
  } else {
    legs.push({ kind: 'curved', points, legId });
  }
}

export function corridorRadius(pathMeters: number): number {
  const anchorCount = Math.min(
    MAX_SEGMENT_ANCHORS,
    Math.max(8, Math.ceil(pathMeters / SEGMENT_TARGET_SPACING_M)),
  );
  const spacing = pathMeters / Math.max(1, anchorCount);
  const r = Math.floor(spacing * CORRIDOR_RADIUS_SPACING_FACTOR);
  return Math.min(
    SEGMENT_MAX_RADIUS_M,
    Math.max(SEGMENT_MIN_RADIUS_M, r),
  );
}

function wave1Anchors(path: Coordinate[], pathMeters: number): Coordinate[] {
  const anchorCount = Math.min(
    WAVE1_ANCHOR_CAP,
    Math.max(8, Math.ceil(pathMeters / SEGMENT_TARGET_SPACING_M)),
  );
  const spacing = pathMeters / Math.max(1, anchorCount - 1);
  return sampleAlongPath(path, spacing, anchorCount);
}

function pointCoveredByBboxLeg(
  c: Coordinate,
  legs: ClassifiedLeg[],
): boolean {
  for (const leg of legs) {
    if (leg.kind !== 'straight') continue;
    const b = leg.bounds;
    if (
      c.latitude >= b.south &&
      c.latitude <= b.north &&
      c.longitude >= b.west &&
      c.longitude <= b.east
    ) {
      return true;
    }
  }
  return false;
}

export function planCorridor(path: Coordinate[]): CorridorPlan {
  const pathMeters = pathLengthMeters(path);
  const osm: SampleRequest['sources'] = ['osm-overpass'];

  if (pathMeters <= LONG_TRIP_METERS) {
    const bounds = boundsForPathSlice(path, 1500);
    return {
      wave1: [{ kind: 'bbox', bounds, sources: osm }],
      wave2: [],
      pathMeters,
    };
  }

  const legs = classifyLegs(path);
  const wave1: SampleRequest[] = [];
  for (const leg of legs) {
    if (leg.kind === 'straight') {
      wave1.push({ kind: 'bbox', bounds: leg.bounds, sources: osm, legId: leg.legId });
    }
  }

  const anchors = wave1Anchors(path, pathMeters);
  const radius = corridorRadius(pathMeters);
  for (const center of anchors) {
    if (pointCoveredByBboxLeg(center, legs)) continue;
    wave1.push({
      kind: 'around',
      center,
      radiusMeters: radius,
      sources: osm,
    });
  }

  const cappedWave1 = wave1.slice(0, WAVE1_ANCHOR_CAP + legs.filter((l) => l.kind === 'straight').length);
  return { wave1: cappedWave1, wave2: [], pathMeters };
}
```

Add `planGapFills` and `planHotLegTighten` in the same file (import `routePassesZone` from `../scoring`, `routePointsForZoneTest` is private — use exported `routePassesZone` only):

```typescript
import { routePassesZone } from '../scoring';
import {
  GAP_ARC_METERS,
  GAP_MIN_UNCOVERED_METERS,
  HOT_LEG_RADIUS_FACTOR,
  HOT_LEG_ZONE_COUNT,
  MAX_GAP_FILLS,
} from './constants';

export function planGapFills(
  path: Coordinate[],
  merged: Zone[],
  pathMeters: number,
): SampleRequest[] {
  const out: SampleRequest[] = [];
  const radius = corridorRadius(pathMeters);
  let arcStartM = 0;
  let i = 0;
  while (arcStartM < pathMeters && out.length < MAX_GAP_FILLS) {
    const arcEndM = Math.min(pathMeters, arcStartM + GAP_ARC_METERS);
    if (arcEndM - arcStartM < GAP_MIN_UNCOVERED_METERS) break;
    const slice = slicePathByMeters(path, arcStartM, arcEndM);
    const hit = merged.some((z) => routePassesZone(slice, z));
    if (!hit) {
      const mid = slice[Math.floor(slice.length / 2)] ?? slice[0];
      if (mid) {
        out.push({
          kind: 'around',
          center: mid,
          radiusMeters: radius,
          sources: ['osm-overpass'],
          legId: `gap-${out.length}`,
        });
      }
    }
    arcStartM = arcEndM;
    i += 1;
  }
  return out;
}

/** Points along path from startM to endM (inclusive), for gap-fill / navigation arcs. */
export function slicePathByMeters(
  path: Coordinate[],
  startM: number,
  endM: number,
): Coordinate[] {
  if (path.length < 2) return path;
  const total = pathLengthMeters(path);
  const start = Math.max(0, Math.min(startM, total));
  const end = Math.max(start, Math.min(endM, total));
  if (end <= start) return [interpolateAlongPath(path, start)];

  const out: Coordinate[] = [];
  let accumulated = 0;
  for (let i = 1; i < path.length; i++) {
    const segLen = pathLengthMeters([path[i - 1], path[i]]);
    const segStart = accumulated;
    const segEnd = accumulated + segLen;
    if (segEnd < start) {
      accumulated = segEnd;
      continue;
    }
    if (segStart > end) break;
    if (out.length === 0) out.push(interpolateAlongPath(path, start));
    if (segEnd <= end) {
      out.push(path[i]);
    } else {
      out.push(interpolateAlongPath(path, end));
      break;
    }
    accumulated = segEnd;
  }
  if (out.length === 0) out.push(interpolateAlongPath(path, start));
  return out;
}

/** Linear interpolate by distance-along-path (meters). */
export function interpolateAlongPath(
  path: Coordinate[],
  targetM: number,
): Coordinate {
  if (path.length === 0) return { latitude: 0, longitude: 0 };
  if (path.length === 1 || targetM <= 0) return path[0];
  let accumulated = 0;
  for (let i = 1; i < path.length; i++) {
    const segLen = pathLengthMeters([path[i - 1], path[i]]);
    if (accumulated + segLen >= targetM) {
      const t = (targetM - accumulated) / Math.max(segLen, 1);
      return {
        latitude: path[i - 1].latitude + t * (path[i].latitude - path[i - 1].latitude),
        longitude:
          path[i - 1].longitude + t * (path[i].longitude - path[i - 1].longitude),
      };
    }
    accumulated += segLen;
  }
  return path[path.length - 1];
}

export function planHotLegTighten(
  wave1Results: { request: SampleRequest; zones: Zone[] }[],
  pathMeters: number,
): SampleRequest[] {
  const out: SampleRequest[] = [];
  const baseRadius = corridorRadius(pathMeters);
  const tight = Math.max(
    SEGMENT_MIN_RADIUS_M,
    Math.floor(baseRadius * HOT_LEG_RADIUS_FACTOR),
  );
  for (const { request, zones } of wave1Results) {
    if (zones.length < HOT_LEG_ZONE_COUNT) continue;
    if (request.kind === 'around') {
      out.push({ ...request, radiusMeters: tight, legId: `${request.legId ?? 'hot'}-tight` });
    }
  }
  return out;
}
```

`interpolateAlongPath` + `slicePathByMeters` must ship complete (code above).

- [ ] **Step 2: Create `scripts/verify-corridor-planner.mjs`**

Run with: `node --experimental-strip-types scripts/verify-corridor-planner.mjs`  
(Node 20.6+ / 22+. If strip-types fails on CI Mac, run `npx tsc --noEmit` only and document skip in PR.)

```javascript
import { planCorridor, classifyLegs } from '../lib/corridor/planner.ts';
import { pathLengthMeters } from '../lib/geo.ts';

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exit(1);
  }
}

const shortPath = [
  { latitude: 40.75, longitude: -73.99 },
  { latitude: 40.76, longitude: -73.98 },
];
const shortPlan = planCorridor(shortPath);
assert(shortPlan.wave1.length === 1, 'short trip: one wave1 request');
assert(shortPlan.wave1[0].kind === 'bbox', 'short trip: bbox');

const interstate = [];
for (let lng = -90; lng <= -85; lng += 0.2) {
  interstate.push({ latitude: 33.5, longitude: lng });
}
assert(pathLengthMeters(interstate) > 45_000, 'interstate fixture length');
const legs = classifyLegs(interstate);
assert(legs.some((l) => l.kind === 'straight'), 'interstate has straight leg');
const longPlan = planCorridor(interstate);
assert(
  longPlan.wave1.some((r) => r.kind === 'bbox'),
  'long trip: wave1 includes bbox',
);

console.log('corridor planner: OK');
```

Fix import: `pathLengthMeters` only from `lib/geo.ts` (remove erroneous planner import).

- [ ] **Step 3: Run planner verification**

Run: `node --experimental-strip-types scripts/verify-corridor-planner.mjs`  
Expected: `corridor planner: OK`

Run: `npx tsc --noEmit`  
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add lib/corridor/planner.ts scripts/verify-corridor-planner.mjs
git commit -m "feat: corridor planner with leg classify and gap-fill hooks"
```

---

## Task 3: Overpass sample export + executor

**Files:**
- Modify: `lib/api/zones.ts`
- Create: `lib/corridor/executor.ts`

- [ ] **Step 1: Export `fetchCorridorSample` from `zones.ts`**

Add near existing `fetchZonesAroundCenter`:

```typescript
import type { SampleRequest } from '../corridor/types';
import { OVERPASS_MIRROR_COUNT, SEGMENT_TIMEOUT_MS } from '../corridor/constants';

export async function fetchCorridorSample(
  request: SampleRequest,
): Promise<Zone[]> {
  if (!request.sources.includes('osm-overpass')) return [];
  if (request.kind === 'around') {
    return fetchZonesAroundCenter(
      request.center,
      request.radiusMeters,
    );
  }
  const query = buildOverpassQueryBbox(request.bounds);
  for (let i = 0; i < OVERPASS_MIRROR_COUNT; i++) {
    try {
      return await fetchOverpassZones(
        OVERPASS_ENDPOINTS[i],
        query,
        SEGMENT_TIMEOUT_MS,
      );
    } catch {
      // next mirror
    }
  }
  return [];
}
```

- [ ] **Step 2: Create `lib/corridor/executor.ts`**

```typescript
import { fetchCorridorSample, getZonesForRegionMock, type Coordinate, type Zone } from '../api/zones';
import { PREVIEW_BUDGET, TRIP_MOCK_ON_EMPTY } from './constants';
import { planCorridor, planGapFills, planHotLegTighten } from './planner';
import type {
  CorridorFetchMeta,
  CorridorMode,
  FetchBudget,
  GetZonesForTripOptions,
  SampleRequest,
} from './types';

function mergeZones(into: Map<string, Zone>, batch: Zone[]): void {
  for (const z of batch) into.set(z.id, z);
}

async function runBatch(
  requests: SampleRequest[],
  budget: FetchBudget,
  state: { calls: number; start: number },
  maxParallel: number,
): Promise<{ results: { request: SampleRequest; zones: Zone[] }[]; merged: Map<string, Zone> }> {
  const merged = new Map<string, Zone>();
  const results: { request: SampleRequest; zones: Zone[] }[] = [];
  let i = 0;
  while (i < requests.length) {
    if (state.calls >= budget.maxCalls) break;
    if (Date.now() - state.start >= budget.maxMs) break;
    const slice = requests.slice(i, i + maxParallel);
    const settled = await Promise.allSettled(
      slice.map(async (req) => {
        state.calls += 1;
        const zones = await fetchCorridorSample(req);
        return { request: req, zones };
      }),
    );
    for (const r of settled) {
      if (r.status !== 'fulfilled') continue;
      results.push(r.value);
      mergeZones(merged, r.value.zones);
    }
    i += slice.length;
  }
  return { results, merged };
}

export async function executeCorridorTrip(
  path: Coordinate[],
  options: GetZonesForTripOptions = {},
): Promise<Zone[]> {
  const budget = options.budget ?? PREVIEW_BUDGET;
  const plan = planCorridor(path);
  const state = { calls: 0, start: Date.now() };
  const all = new Map<string, Zone>();

  const w1 = await runBatch(plan.wave1, budget, state, budget.maxParallel);
  mergeZones(all, [...w1.merged.values()]);
  options.onPartial?.([...all.values()], {
    wave: 1,
    requestsDone: state.calls,
    done: false,
  });

  const gapReqs = planGapFills(path, [...all.values()], plan.pathMeters);
  const hotReqs = planHotLegTighten(w1.results, plan.pathMeters);
  const wave2 = [...gapReqs, ...hotReqs, ...plan.wave2];

  const w2 = await runBatch(wave2, budget, state, budget.maxParallel);
  mergeZones(all, [...w2.merged.values()]);

  if (all.size === 0 && TRIP_MOCK_ON_EMPTY) {
    const mid = path[Math.floor(path.length / 2)] ?? path[0];
    const mock = await getZonesForRegionMock(mid);
    for (const z of mock) all.set(z.id, z);
  }

  options.onPartial?.([...all.values()], {
    wave: 2,
    requestsDone: state.calls,
    done: true,
  });

  return [...all.values()];
}
```

Wire `mode: 'navigation'` in Task 5 — preview path above is default.

- [ ] **Step 3: Delegate `getZonesForTrip` in `zones.ts`**

Extend signature (backward compatible — 4th arg optional):

```typescript
export async function getZonesForTrip(
  origin: Coordinate,
  destination: Coordinate,
  routeCoordinates?: Coordinate[],
  options?: import('../corridor/types').GetZonesForTripOptions,
): Promise<Zone[]> {
  const path: Coordinate[] =
    routeCoordinates && routeCoordinates.length >= 2
      ? routeCoordinates
      : [origin, destination];

  if (options?.mode === 'navigation') {
    const { executeNavigationRoll } = await import('../corridor/navigation');
    return executeNavigationRoll(path, options);
  }

  const { executeCorridorTrip } = await import('../corridor/executor');
  return executeCorridorTrip(path, { ...options, mode: 'preview' });
}
```

Remove old inline `fetchZonesAlongAnchors` / parallel anchor body from `getZonesForTrip` once executor passes manual QA (delete dead code in same PR).

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit`  
Run: `node --experimental-strip-types scripts/verify-corridor-planner.mjs`

- [ ] **Step 5: Commit**

```bash
git add lib/api/zones.ts lib/corridor/executor.ts
git commit -m "feat: corridor executor and getZonesForTrip delegate"
```

---

## Task 4: Zone cache

**Files:**
- Create: `lib/api/zone-cache.ts`

- [ ] **Step 1: Create `lib/api/zone-cache.ts`** (mirror `route-cache.ts`)

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Coordinate, Zone } from './zones';
import {
  ZONE_CACHE_TTL_MS,
  ZONE_CACHE_KEY_INCLUDES_ROUTE_ID,
} from '../corridor/constants';

const STORAGE_KEY = '@fresh-greens/corridor-zones-cache';

type CachedCorridorZones = {
  zones: Zone[];
  destination: Coordinate;
  pathMeters: number;
  routeId?: string;
  cachedAt: number;
};

function gridKey(c: Coordinate): string {
  const lat = Math.round(c.latitude * 2000) / 2000;
  const lng = Math.round(c.longitude * 2000) / 2000;
  return `${lat},${lng}`;
}

export async function saveCorridorZones(
  zones: Zone[],
  destination: Coordinate,
  meta: { pathMeters: number; routeId?: string },
): Promise<void> {
  try {
    const payload: CachedCorridorZones = {
      zones,
      destination,
      pathMeters: meta.pathMeters,
      routeId: meta.routeId,
      cachedAt: Date.now(),
    };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch (err) {
    console.warn('[zone-cache] save failed:', err);
  }
}

export async function loadCorridorZones(
  destination: Coordinate,
  routeId?: string,
): Promise<{ zones: Zone[]; pathMeters: number; ageMs: number } | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const cached: CachedCorridorZones = JSON.parse(raw);
    if (gridKey(cached.destination) !== gridKey(destination)) return null;
    if (ZONE_CACHE_KEY_INCLUDES_ROUTE_ID && routeId && cached.routeId !== routeId) {
      return null;
    }
    const age = Date.now() - cached.cachedAt;
    if (age > ZONE_CACHE_TTL_MS) return null;
    return { zones: cached.zones, pathMeters: cached.pathMeters, ageMs: age };
  } catch (err) {
    console.warn('[zone-cache] load failed:', err);
    return null;
  }
}

export async function clearCorridorZones(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.warn('[zone-cache] clear failed:', err);
  }
}
```

- [ ] **Step 2: Call `clearCorridorZones` from trip-end path**

Modify: `app/en-route.tsx` — wherever `clearActiveRoute()` runs on arrival, also `clearCorridorZones()` (import from `zone-cache`).

- [ ] **Step 3: Verify + commit**

```bash
git add lib/api/zone-cache.ts app/en-route.tsx
git commit -m "feat: corridor zone cache for preview to en-route handoff"
```

---

## Task 5: Navigation rolling

**Files:**
- Create: `lib/corridor/navigation.ts`
- Modify: `lib/corridor/executor.ts` (if navigation entry needs shared merge helper)

- [ ] **Step 1: Create `lib/corridor/navigation.ts`**

Implement:

- `projectPointOntoPath(loc, path) → distanceAlongM`
- `isArcCovered(startM, endM, fetchedAlong, mergedZones, slice)` per spec
- `planNavigationRoll(path, distanceAlong, fetchedAlong) → SampleRequest[]` (1–2 `around` at `distanceAlong + NAV_AHEAD_METERS`, radius `NAV_AROUND_RADIUS_M`)
- `executeNavigationRoll(path, options)` — merge into existing zones from `options` (pass prior zones via extending `GetZonesForTripOptions` with `priorZones?: Zone[]` — add to `types.ts`):

```typescript
// types.ts addition:
priorZones?: Zone[];
```

```typescript
export async function executeNavigationRoll(
  path: Coordinate[],
  options: GetZonesForTripOptions,
): Promise<Zone[]> {
  const prior = options.priorZones ?? [];
  const byId = new Map(prior.map((z) => [z.id, z]));
  // plan + runBatch with NAV_BUDGET
  // return [...byId.values()]
}
```

- [ ] **Step 2: Update `getZonesForTrip` navigation branch** to pass `priorZones` from caller (en-route).

- [ ] **Step 3: Verify + commit**

```bash
git add lib/corridor/navigation.ts lib/corridor/types.ts lib/api/zones.ts
git commit -m "feat: navigation corridor rolls ahead of GPS"
```

---

## Task 6: /home — onPartial, cache write, long-trip footnote

**Files:**
- Modify: `app/home.tsx`

- [ ] **Step 1: Import cache + constants**

```typescript
import { saveCorridorZones } from '../lib/api/zone-cache';
import {
  LONG_TRIP_COPY_METERS,
  LONG_TRIP_FOOTNOTE_COPY,
  ALL_CLEAR_A11Y_LONG_TRIP,
  PARTIAL_DEBOUNCE_MS,
} from '../lib/corridor/constants';
import { pathLengthMeters } from '../lib/geo';
```

- [ ] **Step 2: Replace trip zone fetch with options object**

Inside `fetchAndCenterOnUser`, when `destination` is set:

```typescript
setTripZonesStatus('loading');
setOsmZones([]);

let partialTimer: ReturnType<typeof setTimeout> | null = null;
const flushPartial = (zones: Zone[]) => {
  if (PARTIAL_DEBOUNCE_MS <= 0) {
    setOsmZones(zones);
    return;
  }
  if (partialTimer) clearTimeout(partialTimer);
  partialTimer = setTimeout(() => setOsmZones(zones), PARTIAL_DEBOUNCE_MS);
};

const tripZones = await getZonesForTrip(
  center,
  destination,
  fetchedResult.routes[0]?.coordinates,
  {
    mode: 'preview',
    onPartial: (zones) => flushPartial(zones),
  },
);
if (!cancelled) {
  setOsmZones(tripZones);
  setTripZonesStatus('ready');
  const coords = fetchedResult.routes[0]?.coordinates;
  if (coords && coords.length >= 2) {
    await saveCorridorZones(tripZones, destination, {
      pathMeters: pathLengthMeters(coords),
      routeId: fetchedResult.routes[0]?.id,
    });
  }
}
```

Ensure `setTripZonesStatus('ready')` only after final await (not in `finally` while still loading).

- [ ] **Step 3: Long-trip footnote + scoped All-clear a11y**

Below `routeChipsBlock` (inside `recommended && tripZonesStatus !== 'idle'`), when `selectedRoute` exists and `pathLengthMeters(selectedRoute.coordinates) > LONG_TRIP_COPY_METERS` and `tripZonesStatus === 'ready'`:

```tsx
<Text
  style={[styles.routeChipsFootnote, dynamicType(typography.footnoteRegular)]}
  accessibilityRole="text"
>
  {LONG_TRIP_FOOTNOTE_COPY}
</Text>
```

Add `routeChipsFootnote` style: `color: colors.labelTertiary`, `marginTop: 6`.

For All-clear branch, use:

```typescript
const longTrip =
  selectedRoute &&
  pathLengthMeters(selectedRoute.coordinates) > LONG_TRIP_COPY_METERS;
// accessibilityLabel={longTrip ? ALL_CLEAR_A11Y_LONG_TRIP : 'No reported hazards...'}
```

- [ ] **Step 4: Verify + commit**

```bash
git add app/home.tsx
git commit -m "feat(home): corridor preview partial updates, cache, long-trip footnote"
```

---

## Task 7: /en-route — cache hydrate + navigation roll

**Files:**
- Modify: `app/en-route.tsx`

- [ ] **Step 1: Hydrate cache before Overpass**

At start of zone load (inside `getRoutesBetween` `.then` or parallel mount effect):

```typescript
import { loadCorridorZones } from '../lib/api/zone-cache';
import {
  NAV_ROLL_INTERVAL_MS,
  NAV_MIN_MOVE_METERS,
  NAV_ROLL_WHEN_BACKGROUNDED,
} from '../lib/corridor/constants';
import { AppState } from 'react-native';
```

```typescript
const cached = await loadCorridorZones(destination);
if (cached && !cancelled) {
  setOsmZones(cached.zones);
}
const needsPreview = !cached;
// ...
if (needsPreview) {
  const zones = await getZonesForTrip(center, destination, routes[0]?.coordinates, {
    mode: 'preview',
  });
  if (!cancelled) {
    setOsmZones(zones);
    await saveCorridorZones(zones, destination, {
      pathMeters: pathLengthMeters(routes[0]?.coordinates ?? []),
      routeId: routes[0]?.id,
    });
  }
}
```

Remove unconditional `getZonesForTrip` when cache hits.

- [ ] **Step 2: Throttled navigation roll**

Add ref state: `fetchedAlongRef`, `lastRollAtRef`, `lastRollLocRef`, `osmZonesRef` (sync on setOsmZones).

In existing GPS `watchPositionAsync` callback (or dedicated `useEffect` on `userLocation` + `activeRoute`):

```typescript
if (!NAV_ROLL_WHEN_BACKGROUNDED && AppState.currentState !== 'active') return;
const now = Date.now();
if (now - lastRollAtRef.current < NAV_ROLL_INTERVAL_MS) return;
if (lastRollLocRef.current && haversineMeters(lastRollLocRef.current, userLocation) < NAV_MIN_MOVE_METERS) return;

const merged = await getZonesForTrip(center, destination, activeRoute.coordinates, {
  mode: 'navigation',
  userLocation,
  priorZones: osmZonesRef.current,
  fetchedAlong: fetchedAlongRef.current,
});
setOsmZones(merged);
lastRollAtRef.current = now;
lastRollLocRef.current = userLocation;
```

Implement `fetchedAlong` append inside `executeNavigationRoll` when requests fire.

- [ ] **Step 3: Verify + commit**

```bash
git add app/en-route.tsx
git commit -m "feat(en-route): hydrate corridor cache and rolling ahead fetch"
```

---

## Task 8: Manual QA + docs

**Files:**
- Modify: `docs/learnings.md`

- [ ] **Step 1: Manual QA checklist** (device or simulator)

1. Short trip (&lt;45 km): single bbox, chips &lt;3s, `tripZonesStatus` loading → ready.
2. Regional (~100 mi): partial chips may update once; no All clear during loading.
3. Megatrip (NYC → Birmingham): loading ≤~10s; footnote visible; not “one community flag only” when OSM exists on corridor.
4. Go → en-route with preview complete: no second 10s stall; zones present at mount.
5. Dev log: navigation roll increases zone count when simulating drive (optional).

- [ ] **Step 2: Append `docs/learnings.md`**

Branch-headed entry: corridor planner, cache handoff, expectation footnote, knob locations.

- [ ] **Step 3: Final verify**

```bash
npx tsc --noEmit
node --experimental-strip-types scripts/verify-corridor-planner.mjs
```

- [ ] **Step 4: Commit**

```bash
git add docs/learnings.md
git commit -m "docs: corridor sampling learnings"
```

---

## Spec coverage self-review

| Spec requirement | Task |
|------------------|------|
| G1 orchestrated plan → execute | 2, 3 |
| G2 wave 1 + onPartial | 3, 6 |
| G3 gap-fill | 2, 3 |
| G4 wave 2 + hot leg | 2, 3 |
| G5 straight-leg bbox | 2 |
| G6 budget caps | 1, 3 |
| G7 long-trip copy | 6 |
| G12–G15 en-route cache + navigation | 4, 5, 7 |
| zone-cache 24h TTL | 4 |
| Implementation knobs in constants.ts | 1 |
| browse `getZonesForRegion` unchanged | 3 (no touch) |
| Community not in cache | 4, 6 (reportZones unchanged) |
| routePassesZone densification | already in scoring — used by gap-fill |

**Deferred (separate PRs):** Part B richness — see [2026-06-04-corridor-data-richness.md](./2026-06-04-corridor-data-richness.md) (B0→B1→B4→B5); `CLASSIFY_USE_DENSIFIED_POLYLINE` enablement after QA; `ZONE_CACHE_KEY_INCLUDES_ROUTE_ID`; partial meta line v2.

---

## Risks called out during implementation

- **`slicePathByMeters` correctness** — gap-fill and navigation depend on it; test in planner script with known polyline length.
- **Circular imports** — `zones.ts` imports `corridor/constants`; `corridor` imports `zones` for fetch only; use dynamic `import()` in `getZonesForTrip` if tsc reports cycle.
- **`finally` on home** still sets `ready` on error paths — audit so failed fetch does not show All clear (set `ready` with empty zones only when fetch completes, not on throw).
