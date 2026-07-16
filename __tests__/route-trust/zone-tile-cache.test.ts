import type { Zone } from '../../lib/api/zones';
import {
  getZonesForAroundFromTiles,
  getZonesForBboxFromTiles,
  loadZoneTile,
  saveZoneTile,
  storeZonesForBboxTiles,
  tileKeyForCoordinate,
  tileKeysCoveringBounds,
} from '../../lib/api/zone-tile-cache';

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

function pointZone(id: string, latitude: number, longitude: number): Zone {
  return {
    id,
    type: 'caution',
    label: id,
    geometry: 'point',
    coordinates: [{ latitude, longitude }],
    source: 'osm-overpass',
    category: 'road-condition',
  };
}

describe('zone tile cache completeness', () => {
  beforeEach(() => {
    mockStorage.clear();
    jest.clearAllMocks();
  });

  test('treats an empty around tile as completed cached evidence', async () => {
    const center = { latitude: 0.02, longitude: 0.02 };
    await saveZoneTile(tileKeyForCoordinate(center), []);

    await expect(getZonesForAroundFromTiles(center, 8_000)).resolves.toEqual([]);
  });

  test('does not satisfy a bbox cache read with only partial tile coverage', async () => {
    const bounds = {
      south: 0.01,
      west: 0.01,
      north: 0.13,
      east: 0.02,
    };
    const firstTileKey = tileKeyForCoordinate({
      latitude: 0.02,
      longitude: 0.02,
    });

    await saveZoneTile(firstTileKey, [pointZone('first-tile', 0.02, 0.02)]);

    await expect(getZonesForBboxFromTiles(bounds)).resolves.toBeNull();
  });

  test('stores bbox results in exact overlapping tile slots instead of fanning out every hazard', async () => {
    const bounds = {
      south: 0.01,
      west: 0.01,
      north: 0.13,
      east: 0.02,
    };
    const firstTileZone = pointZone('first-tile', 0.02, 0.02);

    await storeZonesForBboxTiles(bounds, [firstTileZone]);

    const keys = tileKeysCoveringBounds(bounds);
    const firstTileKey = tileKeyForCoordinate(firstTileZone.coordinates[0]);
    const otherTileKey = keys.find((key) => key !== firstTileKey);

    expect(otherTileKey).toBeDefined();
    await expect(loadZoneTile(firstTileKey)).resolves.toEqual([firstTileZone]);
    await expect(loadZoneTile(otherTileKey!)).resolves.toEqual([]);
  });
});
