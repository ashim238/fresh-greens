import { PlacesNetworkError, searchPlaces, type Place } from './places';
import {
  APPLE_MAPKIT_REBUILD_HINT,
  AppleMapKitUnavailableError,
  searchMapKitNear,
  type MapKitSearchResult,
} from './sources/apple-mapkit';

/** Thrown when Mapbox is offline and on-device MK search cannot run. */
export class TowSearchOfflineError extends Error {
  constructor(
    message = `Can't search for tow trucks while offline. ${APPLE_MAPKIT_REBUILD_HINT}`,
  ) {
    super(message);
    this.name = 'TowSearchOfflineError';
  }
}

/** Mapbox queries tried in order when the network is reachable. */
const MAPBOX_TOW_QUERIES = [
  'towing service',
  'tow truck',
  'tow company',
  'roadside assistance',
] as const;

/** On-device MKLocalSearch variants when Mapbox is empty or offline. */
const MK_TOW_QUERIES = ['towing', 'tow truck', 'roadside assistance'] as const;

function distanceMiles(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 3958.8;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
}

function dedupePlaces(places: Place[]): Place[] {
  const seen = new Set<string>();
  return places.filter((place) => {
    const key = `${place.name.toLowerCase()}-${place.latitude.toFixed(4)}-${place.longitude.toFixed(4)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function mapKitResultToPlace(
  result: MapKitSearchResult,
  origin: { latitude: number; longitude: number },
  index: number,
): Place {
  return {
    id: `mk-tow-${index}-${result.latitude.toFixed(5)}-${result.longitude.toFixed(5)}`,
    name: result.name,
    address: 'Nearby',
    latitude: result.latitude,
    longitude: result.longitude,
    distanceMiles: distanceMiles(
      origin.latitude,
      origin.longitude,
      result.latitude,
      result.longitude,
    ),
    phone: result.phoneNumber,
  };
}

async function searchTowViaMapbox(
  userLocation: { latitude: number; longitude: number },
): Promise<Place[] | 'network-unavailable'> {
  for (let i = 0; i < MAPBOX_TOW_QUERIES.length; i++) {
    const query = MAPBOX_TOW_QUERIES[i];
    try {
      const results = await searchPlaces(query, userLocation, {
        types: 'poi',
        // First query throws on transport failure so we can bail to MK
        // without three more doomed Mapbox round-trips.
        throwOnNetworkError: i === 0,
      });
      if (results.length > 0) {
        return dedupePlaces(results);
      }
    } catch (err) {
      if (err instanceof PlacesNetworkError) {
        console.warn(
          '[search-tow-places] Mapbox offline — falling back to MKLocalSearch',
        );
        return 'network-unavailable';
      }
      throw err;
    }
  }
  return [];
}

async function searchTowViaMapKit(
  userLocation: { latitude: number; longitude: number },
): Promise<Place[]> {
  const merged: Place[] = [];

  for (const query of MK_TOW_QUERIES) {
    const mkResults = await searchMapKitNear(query, userLocation, 10);
    for (const result of mkResults) {
      merged.push(
        mapKitResultToPlace(result, userLocation, merged.length),
      );
    }
    if (merged.length > 0) break;
  }

  return dedupePlaces(merged);
}

/**
 * Tow-pick discovery ladder: Mapbox POI search when online, then
 * MKLocalSearch on iOS (works without Mapbox network). MK rows may
 * already include phone — enrichment becomes a no-op for those.
 */
export async function searchTowPlacesNear(userLocation: {
  latitude: number;
  longitude: number;
}): Promise<Place[]> {
  const mapboxResult = await searchTowViaMapbox(userLocation);
  if (Array.isArray(mapboxResult) && mapboxResult.length > 0) {
    return mapboxResult;
  }

  try {
    const mkPlaces = await searchTowViaMapKit(userLocation);
    if (mkPlaces.length > 0) {
      return mkPlaces;
    }
  } catch (err) {
    if (err instanceof AppleMapKitUnavailableError) {
      if (mapboxResult === 'network-unavailable') {
        throw new TowSearchOfflineError(err.message);
      }
      return [];
    }
    throw err;
  }

  if (mapboxResult === 'network-unavailable') {
    throw new TowSearchOfflineError();
  }

  return [];
}
