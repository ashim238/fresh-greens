// Google Places Place Details (New) — shared by /api/place.
//
// Hydrates a community report's stored `googlePlaceId` with the
// card fields (photo, rating, hours) without requiring a cross-row
// twin in the external recs feed.

import { compactHoursLabel, priceTierFor } from './google-places-format.js';

const PLACES_BASE = 'https://places.googleapis.com/v1';

const FIELD_MASK = [
  'id',
  'displayName',
  'formattedAddress',
  'location',
  'primaryType',
  'primaryTypeDisplayName',
  'priceLevel',
  'rating',
  'userRatingCount',
  'regularOpeningHours.openNow',
  'regularOpeningHours.weekdayDescriptions',
  'photos.name',
].join(',');

type GooglePlace = {
  id?: string;
  displayName?: { text: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  primaryType?: string;
  primaryTypeDisplayName?: { text: string };
  priceLevel?: 'PRICE_LEVEL_INEXPENSIVE' | 'PRICE_LEVEL_MODERATE' | 'PRICE_LEVEL_EXPENSIVE' | 'PRICE_LEVEL_VERY_EXPENSIVE';
  rating?: number;
  userRatingCount?: number;
  regularOpeningHours?: {
    openNow?: boolean;
    weekdayDescriptions?: string[];
  };
  photos?: Array<{ name: string }>;
};

/** Wire shape returned by GET /api/place — mirrors card fields on Recommendation. */
export type PlaceDetailsPayload = {
  googlePlaceId: string;
  name?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  categoryLabel?: string;
  photoName?: string;
  rating?: number;
  reviewCount?: number;
  hoursLabel?: string;
  isOpen?: boolean;
  priceTier?: string;
};

export async function fetchPlaceDetailsById(
  placeId: string,
  apiKey: string,
): Promise<PlaceDetailsPayload | null> {
  const safeId = placeId.replace(/[^A-Za-z0-9_-]/g, '');
  if (!safeId) return null;

  try {
    const res = await fetch(`${PLACES_BASE}/places/${safeId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': FIELD_MASK,
      },
    });
    if (!res.ok) {
      console.warn(`[place-details] upstream ${res.status}`);
      return null;
    }
    const p = (await res.json()) as GooglePlace;
    if (!p.id) return null;
    return {
      googlePlaceId: p.id,
      name: p.displayName?.text,
      address: p.formattedAddress,
      latitude: p.location?.latitude,
      longitude: p.location?.longitude,
      categoryLabel:
        p.primaryTypeDisplayName?.text ?? p.primaryType ?? undefined,
      photoName: p.photos?.[0]?.name,
      rating: p.rating,
      reviewCount: p.userRatingCount,
      hoursLabel: compactHoursLabel(
        p.regularOpeningHours?.weekdayDescriptions?.[0],
      ),
      isOpen: p.regularOpeningHours?.openNow,
      priceTier: priceTierFor(p.priceLevel),
    };
  } catch (e) {
    console.warn('[place-details] fetch failed', e);
    return null;
  }
}
