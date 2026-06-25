import type { Place } from './places';
import { matchMapKitPhoneForPlace } from './match-mapkit-phone';
import {
  AppleMapKitUnavailableError,
  searchMapKitNear,
} from './sources/apple-mapkit';

export { matchMapKitPhoneForPlace } from './match-mapkit-phone';

/**
 * Enrich a single Mapbox place with a phone number from MKLocalSearch.
 * Returns the place unchanged when MK is unavailable or no match is found.
 */
export async function enrichPlaceWithPhone(place: Place): Promise<Place> {
  if (place.phone) return place;

  try {
    const candidates = await searchMapKitNear(place.name, {
      latitude: place.latitude,
      longitude: place.longitude,
    });
    const phone = matchMapKitPhoneForPlace(place, candidates);
    return phone ? { ...place, phone } : place;
  } catch (err) {
    if (err instanceof AppleMapKitUnavailableError) {
      return place;
    }
    console.warn('[enrich-place-phone] MK enrichment failed for', place.name, err);
    return place;
  }
}

/**
 * Progressive tow-pick loader: enrich places one at a time in distance order.
 * Yields each fully-processed row for UI append + bottom spinner pattern.
 */
export async function* enrichPlacesWithPhoneProgressive(
  places: Place[],
): AsyncGenerator<Place> {
  for (const place of places) {
    yield await enrichPlaceWithPhone(place);
  }
}
