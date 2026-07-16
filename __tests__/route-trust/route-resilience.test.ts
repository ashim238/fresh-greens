import type { Route } from '../../lib/api/routes';
import type { Coordinate, Zone } from '../../lib/api/zones';
import {
  ROUTE_RESILIENCE_STORAGE_KEY,
  createRouteResilienceBundle,
  prepareRouteResilienceBundle,
} from '../../lib/api/route-resilience';

const mockStorage = new Map<string, string>();

jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn((key: string) =>
      Promise.resolve(mockStorage.get(key) ?? null),
    ),
    setItem: jest.fn((key: string, value: string) => {
      mockStorage.set(key, value);
      return Promise.resolve();
    }),
    removeItem: jest.fn((key: string) => {
      mockStorage.delete(key);
      return Promise.resolve();
    }),
  },
}));

jest.mock('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///documents/',
  deleteAsync: jest.fn(() => Promise.resolve()),
}));

function route(id: string, coordinates: Coordinate[]): Route {
  return {
    id,
    label: id,
    estimatedMinutes: 12,
    distanceMeters: 3400,
    coordinates,
  };
}

function zone(id: string): Zone {
  return {
    id,
    type: 'caution',
    label: id,
    geometry: 'point',
    coordinates: [{ latitude: 40, longitude: -73 }],
    source: 'osm-overpass',
    category: 'road-condition',
  };
}

describe('route resilience bundle', () => {
  beforeEach(() => {
    mockStorage.clear();
    jest.clearAllMocks();
  });

  test('creates a stable essential bundle for the selected route', () => {
    const selected = route('route-b', [
      { latitude: 40, longitude: -73 },
      { latitude: 41, longitude: -74 },
    ]);
    const other = route('route-a', [
      { latitude: 40, longitude: -73 },
      { latitude: 40.5, longitude: -73.5 },
    ]);

    const bundle = createRouteResilienceBundle({
      route: selected,
      routes: [selected, other],
      validatedEvidence: [zone('rough-road')],
      departureTimeMs: 1_000,
      createdAtMs: 2_000,
    });
    const reordered = createRouteResilienceBundle({
      route: selected,
      routes: [other, selected],
      validatedEvidence: [zone('rough-road')],
      departureTimeMs: 1_000,
      createdAtMs: 2_000,
    });

    expect(bundle.routeKey).toBe('route-b');
    expect(bundle.routeSetKey).toBe(reordered.routeSetKey);
    expect(bundle.departureTimeMs).toBe(1_000);
    expect(bundle.validatedEvidence.map((entry) => entry.id)).toEqual([
      'rough-road',
    ]);
    expect(bundle.corridorPolicyVersion).toBe('adaptive-corridor-v1');
  });

  test('writes the essential bundle before navigation consumes it', async () => {
    const selected = route('route-a', [
      { latitude: 40, longitude: -73 },
      { latitude: 41, longitude: -74 },
    ]);

    const bundle = await prepareRouteResilienceBundle({
      route: selected,
      routes: [selected],
      validatedEvidence: [],
      departureTimeMs: 1_000,
      createdAtMs: 2_000,
    });

    expect(bundle.route.id).toBe('route-a');
    expect(JSON.parse(mockStorage.get(ROUTE_RESILIENCE_STORAGE_KEY)!)).toEqual(
      bundle,
    );
  });
});
