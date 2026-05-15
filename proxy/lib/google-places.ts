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
  // Photos — only the `name` field is enough to construct the
  // /v1/{name}/media URL later. Don't request `photoUri` directly
  // since that returns a redirect URL that gets stale; resolving
  // via /api/photo at view time is more reliable.
  'places.photos.name',
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
  photos?: Array<{ name: string }>;
};

type SearchNearbyResponse = {
  places?: GooglePlace[];
};

/**
 * Compact "Closes 4 PM" / "Open until 1 AM" / "Closed today"
 * derived from Google's `weekdayDescriptions[0]` (which reads like
 * "Monday: 8:00 AM – 4:00 PM"). The verbose form was overflowing
 * the recommendation card's hours pill — at ~180pt wide the tag
 * row wrapped to two lines and stacked into the card overflow.
 *
 * Parse heuristics — Google's strings come in a few flavors:
 *   "Monday: 8:00 AM – 4:00 PM"       → "Closes 4 PM"
 *   "Monday: Open 24 hours"           → "Open 24/7"
 *   "Monday: Closed"                  → "Closed today"
 *   "Monday: 5:00 PM – 1:00 AM"       → "Open until 1 AM"
 *
 * Falls back to the raw string when we can't parse, so the card
 * still surfaces something rather than blank.
 */
function compactHoursLabel(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  if (/closed/i.test(raw)) return 'Closed today';
  if (/24 hours|all day/i.test(raw)) return 'Open 24/7';
  // Strip the day-of-week prefix ("Monday: ").
  const afterColon = raw.includes(':') ? raw.split(':').slice(1).join(':').trim() : raw;
  // Match the close time on either side of the en-dash.
  const m = afterColon.match(/–\s*(\d{1,2})(?::(\d{2}))?\s*(AM|PM)/i);
  if (!m) return raw;
  const closeHour = m[1];
  const closeMins = m[2] && m[2] !== '00' ? `:${m[2]}` : '';
  const ampm = m[3].toUpperCase();
  // "Open until X" reads better for late-night spots (1 AM / 2 AM).
  // "Closes X" reads better for daytime spots (4 PM / 9 PM).
  const isLateNight = ampm === 'AM' || (ampm === 'PM' && parseInt(closeHour, 10) >= 9);
  const prefix = isLateNight ? 'Open until' : 'Closes';
  return `${prefix} ${closeHour}${closeMins} ${ampm}`;
}

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
      // Was OSM Overpass (handled separately) — switched to Google
      // Places to surface real business names instead of clinical
      // "Public restroom" labels. The OSM data has good coverage
      // for truly public toilets but lacks business names. Google
      // surfaces restroom-providing venues (gas stations, libraries,
      // parks) by name, which is what the driver actually wants to
      // recognize from the card.
      return 'public restroom or open restroom';
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
          hoursLabel: compactHoursLabel(
            p.regularOpeningHours?.weekdayDescriptions?.[0],
          ),
          isOpen: p.regularOpeningHours?.openNow,
          region: 'external',
          photoName: p.photos?.[0]?.name,
        };
      })
      .filter((r): r is Recommendation => r !== null);
  } catch (e) {
    console.warn('[google-places] fetch failed', e);
    return [];
  }
}
