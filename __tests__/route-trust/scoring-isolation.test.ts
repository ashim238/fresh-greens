import { pickWinner, routeConditions, scoreRoute } from '../../lib/scoring';
import type { Route } from '../../lib/api/routes';
import type { Coordinate, Zone } from '../../lib/api/zones';

const DEPARTURE_TIME = new Date('2026-07-15T12:00:00.000Z');

function route(id: string, coordinates: Coordinate[], incidents?: Zone[]): Route {
  return {
    id,
    label: id,
    estimatedMinutes: 10,
    distanceMeters: 1000,
    coordinates,
    mapboxIncidentZones: incidents,
  };
}

function pointIncident(id: string, coordinate: Coordinate): Zone {
  return {
    id,
    type: 'avoid',
    label: id,
    geometry: 'point',
    coordinates: [coordinate],
    source: 'mapbox-incidents',
    category: 'road-condition',
  };
}

describe('route scoring evidence isolation', () => {
  test('route-owned incidents do not penalize another route even when geometry overlaps', () => {
    const incident = pointIncident('incident-on-a', {
      latitude: 40,
      longitude: -73,
    });
    const routeA = route('route-a', [
      { latitude: 40, longitude: -73 },
      { latitude: 40.001, longitude: -73 },
    ], [incident]);
    const routeB = route('route-b', [
      { latitude: 40, longitude: -73 },
      { latitude: 40.001, longitude: -73 },
    ]);

    const ranked = pickWinner([routeA, routeB], [], DEPARTURE_TIME);

    expect(ranked.find((candidate) => candidate.id === 'route-a')?.score).toBe(-5);
    expect(ranked.find((candidate) => candidate.id === 'route-b')?.score).toBe(0);
  });

  test('route-owned incidents are not counted twice when callers still pass polluted shared zones', () => {
    const incident = pointIncident('incident-on-a', {
      latitude: 40,
      longitude: -73,
    });
    const routeA = route('route-a', [
      { latitude: 40, longitude: -73 },
      { latitude: 40.001, longitude: -73 },
    ], [incident]);

    const ranked = pickWinner([routeA], [incident], DEPARTURE_TIME);

    expect(ranked[0].score).toBe(-5);
  });

  test('comparison chips use only shared evidence plus the route owner incidents', () => {
    const incident = pointIncident('incident-on-a', {
      latitude: 40,
      longitude: -73,
    });
    const routeA = route('route-a', [
      { latitude: 40, longitude: -73 },
      { latitude: 40.001, longitude: -73 },
    ], [incident]);
    const routeB = route('route-b', [
      { latitude: 41, longitude: -74 },
      { latitude: 41.001, longitude: -74 },
    ]);

    expect(routeConditions(routeA, [])).toEqual(['road']);
    expect(routeConditions(routeB, [])).toEqual([]);
  });
});
