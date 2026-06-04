import type { Coordinate, Zone } from '../api/zones';
import { haversineMeters, pathLengthMeters } from '../geo';
import { routePassesZone } from '../scoring';
import {
  NAV_AHEAD_METERS,
  NAV_AROUND_RADIUS_M,
  NAV_BUDGET,
} from './constants';
import { runCorridorBatch } from './executor';
import {
  interpolateAlongPath,
  slicePathByMeters,
} from './planner';
import type { FetchBudget, GetZonesForTripOptions, SampleRequest } from './types';

function pointOnSegment(a: Coordinate, b: Coordinate, t: number): Coordinate {
  return {
    latitude: a.latitude + t * (b.latitude - a.latitude),
    longitude: a.longitude + t * (b.longitude - a.longitude),
  };
}

/** Fraction along segment [a,b] minimizing haversine distance to `loc`. */
function closestFractionOnSegment(loc: Coordinate, a: Coordinate, b: Coordinate): number {
  if (a.latitude === b.latitude && a.longitude === b.longitude) return 0;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 20; i++) {
    const m1 = lo + (hi - lo) / 3;
    const m2 = hi - (hi - lo) / 3;
    const d1 = haversineMeters(loc, pointOnSegment(a, b, m1));
    const d2 = haversineMeters(loc, pointOnSegment(a, b, m2));
    if (d1 < d2) hi = m2;
    else lo = m1;
  }
  return (lo + hi) / 2;
}

/** Project `loc` onto `path`; return distance along path in meters from start. */
export function projectPointOntoPath(loc: Coordinate, path: Coordinate[]): number {
  if (path.length < 2) return 0;

  let bestDist = Infinity;
  let bestAlong = 0;
  let accumulated = 0;

  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i];
    const b = path[i + 1];
    const segLen = pathLengthMeters([a, b]);
    const t = closestFractionOnSegment(loc, a, b);
    const dist = haversineMeters(loc, pointOnSegment(a, b, t));

    if (dist < bestDist) {
      bestDist = dist;
      bestAlong = accumulated + t * segLen;
    }
    accumulated += segLen;
  }

  return bestAlong;
}

/** True when preview/navigation already sampled this arc or zones hit the slice. */
export function isArcCovered(
  startM: number,
  endM: number,
  fetchedAlong: { startM: number; endM: number }[],
  mergedZones: Zone[],
  slice: Coordinate[],
): boolean {
  if (mergedZones.some((z) => routePassesZone(slice, z))) return true;

  if (endM <= startM) return true;

  for (const { startM: fs, endM: fe } of fetchedAlong) {
    const overlap = Math.min(endM, fe) - Math.max(startM, fs);
    if (overlap >= (endM - startM) * 0.5) return true;
  }

  return false;
}

/** Plan 1–2 ahead `around` samples when the corridor in front is uncovered. */
export function planNavigationRoll(
  path: Coordinate[],
  distanceAlong: number,
  fetchedAlong: { startM: number; endM: number }[],
  mergedZones: Zone[],
  budget: FetchBudget,
): SampleRequest[] {
  const pathMeters = pathLengthMeters(path);
  const aheadStart = Math.max(0, distanceAlong);
  const aheadEnd = Math.min(pathMeters, distanceAlong + NAV_AHEAD_METERS);
  if (aheadEnd - aheadStart < 500) return [];

  const slice = slicePathByMeters(path, aheadStart, aheadEnd);
  if (isArcCovered(aheadStart, aheadEnd, fetchedAlong, mergedZones, slice)) {
    return [];
  }

  const osm = ['osm-overpass'] as const;
  const requests: SampleRequest[] = [];
  const midM = (aheadStart + aheadEnd) / 2;
  requests.push({
    kind: 'around',
    center: interpolateAlongPath(path, midM),
    radiusMeters: NAV_AROUND_RADIUS_M,
    sources: [...osm],
    legId: 'nav-ahead',
  });

  if (aheadEnd - aheadStart > NAV_AHEAD_METERS * 0.4) {
    requests.push({
      kind: 'around',
      center: interpolateAlongPath(path, aheadEnd),
      radiusMeters: NAV_AROUND_RADIUS_M,
      sources: [...osm],
      legId: 'nav-tip',
    });
  }

  return requests.slice(0, budget.maxCalls);
}

let warnedMissingFetchedAlong = false;

/**
 * Navigation roll: sample ahead of `userLocation` and merge into `priorZones`.
 * En-route callers MUST pass a stable `fetchedAlong` array ref (Task 7) so
 * coverage intervals accumulate across rolls; if omitted, rolls still run but
 * coverage is not tracked.
 */
export async function executeNavigationRoll(
  path: Coordinate[],
  options: GetZonesForTripOptions,
): Promise<Zone[]> {
  const prior = options.priorZones ?? [];
  const byId = new Map(prior.map((z) => [z.id, z]));
  const mergedZones = [...byId.values()];
  const fetchedAlong = options.fetchedAlong ?? [];
  if (options.fetchedAlong === undefined) {
    if (__DEV__ && !warnedMissingFetchedAlong) {
      warnedMissingFetchedAlong = true;
      console.warn(
        '[corridor] executeNavigationRoll: fetchedAlong omitted; pass a stable array ref from en-route (Task 7)',
      );
    }
  }

  const loc = options.userLocation;
  if (!loc || path.length < 2) return mergedZones;

  const distanceAlong = projectPointOntoPath(loc, path);
  const budget = options.budget ?? NAV_BUDGET;
  const requests = planNavigationRoll(
    path,
    distanceAlong,
    fetchedAlong,
    mergedZones,
    budget,
  );
  if (requests.length === 0) return mergedZones;
  const state = { calls: 0, start: Date.now() };
  const pathMeters = pathLengthMeters(path);
  const aheadEnd = Math.min(pathMeters, distanceAlong + NAV_AHEAD_METERS);

  const batch = await runCorridorBatch(
    requests,
    budget,
    state,
    budget.maxParallel,
  );
  for (const z of batch.merged.values()) byId.set(z.id, z);

  if (batch.results.length > 0) {
    fetchedAlong.push({ startM: distanceAlong, endM: aheadEnd });
    if (__DEV__) {
      const added = batch.merged.size;
      console.log(`[corridor] navigation +${added} zones`);
    }
  }

  return [...byId.values()];
}
