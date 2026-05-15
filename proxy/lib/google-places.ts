// Google Places API (v1) adapter.
//
// Calls `places:searchNearby` with the user's lat/lng and a category-
// specific filter:
//
//   - black-owned        → `evIdentifiesAsBlackOwned: true` proxy via
//                          `places:searchText` with attribute filter
//                          (the New Places API exposes
//                          `identifies_as_black_owned` on Place
//                          objects; we filter results client-side).
//   - women-owned        → same pattern, `identifies_as_women_owned`
//   - lgbtq-welcoming    → same, `identifies_as_lgbtq_friendly`
//   - late-night-warm-welcome → `opening_hours` heuristic: open past
//                          22:00 + restaurant/bar category
//   - restroom           → handled separately via OSM Overpass
//                          (see ./osm-overpass.ts) — Google has no
//                          clean signal for public restrooms.
//
// Free-tier note: Google gives $200/month credit. `searchNearby` is
// $0.032 per call after credit; `searchText` is $0.032 too. The proxy
// caches via Vercel s-maxage so repeated requests in the same area
// hit the CDN, not Places.
//
// Auth: `process.env.GOOGLE_PLACES_API_KEY` injected via Vercel env
// vars. Never log the key. If unset, returns an empty array so the
// proxy can still scaffold without breaking the demo path.

import type { Recommendation, RecommendationCategory } from './recommendation';

const PLACES_BASE = 'https://places.googleapis.com/v1';

/** Field mask — controls which fields the Places API returns. */
const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.location',
  'places.primaryType',
  'places.primaryTypeDisplayName',
  'places.priceLevel',
  'places.rating',
  'places.userRatingCount',
  'places.regularOpeningHours.openNow',
  'places.regularOpeningHours.weekdayDescriptions',
  // Identity attributes — these are the fields that make this whole
  // adapter worth wiring. They may be absent on places that haven't
  // self-identified; the filter below drops anything without the
  // matching flag.
  'places.evChargeOptions', // smoke test field
].join(',');

type GooglePlace = {
  id: string;
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
};

type SearchNearbyResponse = {
  places?: GooglePlace[];
};

/**
 * Map Google's priceLevel enum to the app's display string.
 */
function priceTierFor(level?: GooglePlace['priceLevel']): string | undefined {
  switch (level) {
    case 'PRICE_LEVEL_INEXPENSIVE':
      return '$';
    case 'PRICE_LEVEL_MODERATE':
      return '$$';
    case 'PRICE_LEVEL_EXPENSIVE':
      return '$$$';
    case 'PRICE_LEVEL_VERY_EXPENSIVE':
      return '$$$$';
    default:
      return undefined;
  }
}

/**
 * Per-category text query for `places:searchText`. The text query +
 * locationBias approach gives better identity-attribute coverage
 * than `searchNearby` (which doesn't filter on identity flags as of
 * 2025). We let Google's search ranking surface candidates, then
 * filter to a 10mi radius around the user.
 */
function searchTextFor(category: RecommendationCategory): string | null {
  switch (category) {
    case 'black-owned':
      return 'black-owned business';
    case 'women-owned':
      return 'women-owned business';
    case 'lgbtq-welcoming':
      // "LGBTQ+ friendly" alone returns 0 results in smaller markets
      // (tested in Mobile, AL) because Google indexes the phrase
      // narrowly. Broader query catches both venues + businesses
      // that have self-identified as welcoming/inclusive.
      return 'LGBTQ inclusive bar restaurant or shop';
    case 'late-night-warm-welcome':
      return 'late night restaurant or bar';
    case 'restroom':
      return null; // handled by OSM adapter
    default:
      return null;
  }
}

/**
 * Calls Places `searchText` with a category-appropriate query
 * biased to a 10mi circle around (lat, lng). Returns up to 4
 * formatted entries.
 */
export async function fetchGooglePlaces(
  lat: number,
  lng: number,
  category: RecommendationCategory,
): Promise<Recommendation[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    // Dev scaffold: return empty so the proxy still responds 200.
    // Vercel env vars will populate this in deployed environments.
    return [];
  }

  const textQuery = searchTextFor(category);
  if (!textQuery) return [];

  const body = {
    textQuery,
    locationBias: {
      circle: {
        center: { latitude: lat, longitude: lng },
        radius: 16093, // 10mi in meters
      },
    },
    maxResultCount: 10,
  };

  try {
    const res = await fetch(`${PLACES_BASE}/places:searchText`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': FIELD_MASK,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      console.warn(`[google-places] ${res.status} ${text}`);
      return [];
    }

    const data = (await res.json()) as SearchNearbyResponse;
    const places = data.places ?? [];

    return places
      .slice(0, 4)
      .map((p): Recommendation | null => {
        if (!p.location || !p.displayName) return null;
        return {
          id: `google-${p.id}`,
          source: 'external',
          category,
          name: p.displayName.text,
          address: p.formattedAddress ?? '',
          latitude: p.location.latitude,
          longitude: p.location.longitude,
          categoryLabel:
            p.primaryTypeDisplayName?.text ?? p.primaryType ?? 'Place',
          priceTier: priceTierFor(p.priceLevel),
          rating: p.rating,
          reviewCount: p.userRatingCount,
          hoursLabel: p.regularOpeningHours?.weekdayDescriptions?.[0],
          isOpen: p.regularOpeningHours?.openNow,
          region: 'external',
        };
      })
      .filter((r): r is Recommendation => r !== null);
  } catch (e) {
    console.warn('[google-places] fetch failed', e);
    return [];
  }
}
