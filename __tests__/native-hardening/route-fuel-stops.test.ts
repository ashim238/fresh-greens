import { routeFuelStopsIdentity } from '../../hooks/useRouteFuelStops';

describe('route fuel-stop identity', () => {
  test('different route geometry with the same coordinate count gets different fallback keys', () => {
    const first = routeFuelStopsIdentity(undefined, [
      { latitude: 40.1, longitude: -73.1 },
      { latitude: 40.2, longitude: -73.2 },
      { latitude: 40.3, longitude: -73.3 },
    ]);
    const second = routeFuelStopsIdentity(undefined, [
      { latitude: 41.1, longitude: -74.1 },
      { latitude: 41.2, longitude: -74.2 },
      { latitude: 41.3, longitude: -74.3 },
    ]);

    expect(first).not.toBe(second);
  });

  test('provided route keys win over fallback geometry signatures', () => {
    expect(
      routeFuelStopsIdentity('route-abc', [
        { latitude: 40.1, longitude: -73.1 },
      ]),
    ).toBe('route-abc');
  });
});
