import { fetchCorridorSample, type Coordinate, type Zone } from '../api/zones';
import { pathLengthMeters } from '../geo';
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
import type { GetZonesForTripOptions, SampleRequest } from './types';

/** Project `loc` onto `path`; return distance along path in meters from start. */
export function projectPointOntoPath(loc: Coordinate, path: Coordinate[]): number {
  if (path.length < 2) return 0;

  const latToMeters = 111_000;
  const lngToMeters = 111_000 * Math.cos((loc.latitude * Math.PI) / 180);

  let bestDistSq = Infinity;
  let bestAlong = 0;
  let accumulated = 0;

  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i];
    const b = path[i + 1];
    const px = (loc.longitude - a.longitude) * lngToMeters;
    const py = (loc.latitude - a.latitude) * latToMeters;
    const sx = (b.longitude - a.longitude) * lngToMeters;
    const sy = (b.latitude - a.latitude) * latToMeters;
    const segLenSq = sx * sx + sy * sy;
    const segLen = Math.sqrt(segLenSq);
    const t =
      segLenSq === 0 ? 0 : Math.max(0, Math.min(1, (px * sx + py * sy) / segLenSq));
    const dx = px - sx * t;
    const dy = py - sy * t;
    const distSq = dx * dx + dy * dy;

    if (distSq < bestDistSq) {
      bestDistSq = distSq;
      bestAlong = accumulated + t * segLen;
    }
    accumulated += segLen;
  }

  return bestAlong;
}

function priorFetchCoversM(
  m: number,
  fetchedAlong: { startM: number; endM: number }[],
): boolean {
  for (const { startM: fs, endM: fe } of fetchedAlong) {
    const centroid = (fs + fe) / 2;
    if (Math.abs(m - centroid) <= NAV_AHEAD_METERS) return true;
    if (m >= fs && m <= fe) return true;
  }
  return false;
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

  if (priorFetchCoversM(startM, fetchedAlong) && priorFetchCoversM(endM, fetchedAlong)) {
    return true;
  }

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

  return requests.slice(0, NAV_BUDGET.maxCalls);
}

export async function executeNavigationRoll(
  path: Coordinate[],
  options: GetZonesForTripOptions,
): Promise<Zone[]> {
  const prior = options.priorZones ?? [];
  const byId = new Map(prior.map((z) => [z.id, z]));
  const mergedZones = [...byId.values()];
  const fetchedAlong = options.fetchedAlong ?? [];

  const loc = options.userLocation;
  if (!loc || path.length < 2) return mergedZones;

  const distanceAlong = projectPointOntoPath(loc, path);
  const requests = planNavigationRoll(
    path,
    distanceAlong,
    fetchedAlong,
    mergedZones,
  );
  if (requests.length === 0) return mergedZones;

  const budget = options.budget ?? NAV_BUDGET;
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
