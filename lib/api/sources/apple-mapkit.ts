/**
 * iOS MapKit / MKLocalSearch bridge for POI phone enrichment.
 *
 * Mapbox discovers tow POIs; MapKit enriches with `phoneNumber` when available.
 * Requires a dev build (not Expo Go) — `expo-apple-mapkit` native module.
 */

import { Platform } from 'react-native';

export type MapKitSearchResult = {
  name: string;
  latitude: number;
  longitude: number;
  phoneNumber?: string;
};

export const APPLE_MAPKIT_REBUILD_HINT =
  'Apple MapKit search needs a dev build. Run npx expo run:ios, then reopen the app.';

export class AppleMapKitUnavailableError extends Error {
  constructor(message = 'Apple MapKit search is not available on this platform') {
    super(message);
    this.name = 'AppleMapKitUnavailableError';
  }
}

type MapKitModule = typeof import('expo-apple-mapkit');

/** Metro may not expose named exports from dynamic import — require on iOS. */
function resolveSearchLocation(): MapKitModule['searchLocation'] {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mapkit = require('expo-apple-mapkit') as MapKitModule;
  const { searchLocation } = mapkit;
  if (typeof searchLocation !== 'function') {
    throw new AppleMapKitUnavailableError(APPLE_MAPKIT_REBUILD_HINT);
  }
  return searchLocation;
}

/** ~4 km search window around the Mapbox pin. */
const REGION_DELTA = 0.04;

/**
 * Search for POIs near a coordinate. Tow-pick enrichment only — not a
 * replacement for Mapbox text search.
 */
export async function searchMapKitNear(
  query: string,
  near: { latitude: number; longitude: number },
  limit = 5,
): Promise<MapKitSearchResult[]> {
  if (Platform.OS !== 'ios') {
    throw new AppleMapKitUnavailableError();
  }

  const trimmed = query.trim();
  if (!trimmed) return [];

  const searchLocation = resolveSearchLocation();

  const results = await searchLocation(trimmed, {
    region: {
      latitude: near.latitude,
      longitude: near.longitude,
      latitudeDelta: REGION_DELTA,
      longitudeDelta: REGION_DELTA,
    },
    resultLimit: limit,
    includePointsOfInterest: true,
    includeQueries: false,
  });

  return results.map((r) => ({
    name: r.name,
    latitude: r.placemark.coordinate.latitude,
    longitude: r.placemark.coordinate.longitude,
    phoneNumber: r.phoneNumber,
  }));
}
