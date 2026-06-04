import {
  fetchCorridorSample,
  getZonesForRegionMock,
  type Coordinate,
  type Zone,
} from '../api/zones';
import { PREVIEW_BUDGET, TRIP_MOCK_ON_EMPTY } from './constants';
import { collapseHazardZones } from './merge-hazards';
import { planCorridor, planGapFills, planHotLegTighten } from './planner';
import type { FetchBudget, GetZonesForTripOptions, SampleRequest } from './types';

function mergeZones(into: Map<string, Zone>, batch: Zone[]): void {
  for (const z of batch) into.set(z.id, z);
}

function zonesFromMap(map: Map<string, Zone>): Zone[] {
  return collapseHazardZones([...map.values()]);
}

export async function runCorridorBatch(
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
    const remaining = budget.maxCalls - state.calls;
    const slice = requests.slice(
      i,
      i + Math.min(maxParallel, remaining),
    );
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

  const w1 = await runCorridorBatch(plan.wave1, budget, state, budget.maxParallel);
  mergeZones(all, [...w1.merged.values()]);
  options.onPartial?.(zonesFromMap(all), {
    wave: 1,
    requestsDone: state.calls,
    done: false,
  });

  const gapReqs = planGapFills(path, zonesFromMap(all), plan.pathMeters);
  const hotReqs = planHotLegTighten(w1.results, plan.pathMeters);
  const wave2 = [...gapReqs, ...hotReqs, ...plan.wave2];

  const w2 = await runCorridorBatch(wave2, budget, state, budget.maxParallel);
  mergeZones(all, [...w2.merged.values()]);

  if (all.size === 0 && TRIP_MOCK_ON_EMPTY) {
    const mid = path[Math.floor(path.length / 2)] ?? path[0];
    const mock = await getZonesForRegionMock(mid);
    for (const z of mock) all.set(z.id, z);
  }

  options.onPartial?.(zonesFromMap(all), {
    wave: 2,
    requestsDone: state.calls,
    done: true,
  });

  return zonesFromMap(all);
}
