// Fresh Greens — places + address search adapter.
//
// Search against Mapbox Search Box API (v6) for both named POIs
// and street addresses. Was POI-only originally — v5's free-text
// `q=` did substring matching across all types, so "gas station"
// would also match anything else with "station" in the name (police
// stations, train stations, fire stations). v6's Search Box
// `/forward` endpoint is type-aware: we request `poi,address` so
// queries like "Soul Kitchen" surface the POI and queries like
// "123 Main St" surface the address.
//
// Mapbox usage policy: free tier is 100K requests/month, 600/min.
// Comfortably above thesis-demo traffic. Token loaded from
// `process.env.EXPO_PUBLIC_MAPBOX_TOKEN` (set in `.env.local`,
// gitignored).
//
// The adapter returns Place[] with name + address + lat/lng + distance
// from the user's current location. Same shape any future provider
// (MKLocalSearch, Google Places, Foursquare) would slot into.

import type { FuelPriceQuote } from './fuel-prices';

export type Place = {
  /** Stable identifier from the geocoder. */
  id: string;
  /** Concise business name (e.g., "L'industrie Pizzeria"). */
  name: string;
  /** Single-line address for display under the name. */
  address: string;
  /** Coordinates for routing. */
  latitude: number;
  longitude: number;
  /** Distance from the user's location in miles, rounded to 1 decimal. */
  distanceMiles: number;
  /**
   * Business phone when enriched (tow-pick via MKLocalSearch). Absent until
   * `enrichPlaceWithPhone` runs — UI treats missing as gray Call + footnote.
   */
  phone?: string;
  /** Set by `enrichPlacesWithFuelPrices` — Gas/on-route fuel contexts only. */
  fuelPrice?: FuelPriceQuote;
};

// v6 Search Box API response shape. Only the fields we use are typed.
type MapboxFeature = {
  type: 'Feature';
  geometry: { type: 'Point'; coordinates: [number, number] };
  properties: {
    mapbox_id: string;
    name: string;
    /** Full one-line address including the place's name. */
    full_address?: string;
    /** Address portion after the name — "123 Main St, Brooklyn, NY 11211". */
    place_formatted?: string;
    feature_type: string;
    poi_category?: string[];
  };
};

type MapboxResponse = {
  features?: MapboxFeature[];
};

const MAPBOX_URL = 'https://api.mapbox.com/search/searchbox/v1/forward';

const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? '';

/**
 * Search for named POIs matching the query, biased toward the user's
 * current location. Returns up to 10 results sorted by distance
 * ascending.
 *
 * `userLocation` is required — feeds Mapbox's `proximity` parameter
 * (the closer-results-first hint) and the client-side distance sort.
 *
 * No bbox cap. Earlier versions hard-capped results at ~140mi from
 * the user, which paired with the old MAX_ROUTE_DISTANCE_MILES=500
 * routing guard. With routing now accepting 3000mi (PR A) plus the
 * "No route available" state, the bbox was gating *discoverability*
 * before *routability* even got to decide — typing "1600 Pennsylvania
 * Ave" from NYC returned nothing despite the route being trivially
 * computable. Removing it lets exact-address queries surface their
 * canonical match cross-country; the `proximity` parameter still
 * biases nearby results to the top so local searches behave the same.
 */
export type SearchPlacesOptions = {
  /** Mapbox Search Box `types` filter. Defaults to `poi,address`. */
  types?: string;
  /**
   * When true, a transport-level fetch failure throws `PlacesNetworkError`
   * instead of returning `[]`. Tow-pick uses this to skip the Mapbox
   * ladder and fall back to MKLocalSearch without four doomed retries.
   */
  throwOnNetworkError?: boolean;
};

/** Mapbox Search Box fetch failed at the transport layer (offline, DNS, etc.). */
export class PlacesNetworkError extends Error {
  constructor(message = 'Places search network unavailable', cause?: unknown) {
    super(message);
    this.name = 'PlacesNetworkError';
    if (cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = cause;
    }
  }
}

export async function searchPlaces(
  query: string,
  userLocation: { latitude: number; longitude: number },
  options?: SearchPlacesOptions,
): Promise<Place[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  if (!MAPBOX_TOKEN) {
    console.warn(
      '[places] EXPO_PUBLIC_MAPBOX_TOKEN not set — search returns empty.',
    );
    return [];
  }

  const { latitude: lat, longitude: lng } = userLocation;

  const params = new URLSearchParams({
    q: trimmed,
    access_token: MAPBOX_TOKEN,
    proximity: `${lng},${lat}`,
    limit: '10',
    // Include both POIs and street addresses. Was `poi` only, which
    // meant typing a specific street address ("123 Main St") returned
    // zero results — addresses aren't POIs in Mapbox's taxonomy.
    // Both types share the Feature shape; the address branch fills
    // `name` with the street number+name, and `place_formatted` with
    // the rest, so the existing card render works for both.
    //
    // `country` filter intentionally NOT set. Previously hardcoded to
    // 'us' which returned zero results when the user was anywhere
    // outside the US. The `proximity` parameter biases toward the
    // user's location, so local results still surface first — but
    // unconstrained `types: 'poi,address'` lets distant exact matches
    // surface when they're the canonical answer (e.g., a specific
    // street address that's only meaningful in another city).
    types: options?.types ?? 'poi,address',
  });

  const url = `${MAPBOX_URL}?${params.toString()}`;

  let response: Response;
  try {
    response = await fetch(url);
  } catch (err) {
    if (options?.throwOnNetworkError) {
      throw new PlacesNetworkError(undefined, err);
    }
    console.warn('[places] Mapbox fetch failed:', err);
    return [];
  }

  if (response.status === 429) {
    console.warn('[places] Mapbox rate-limited (429); returning empty');
    return [];
  }
  if (!response.ok) {
    throw new Error(`Mapbox returned ${response.status}`);
  }

  const json = (await response.json()) as MapboxResponse;
  const features = json.features ?? [];

  return features
    .map((f) => {
      const [placeLng, placeLat] = f.geometry.coordinates;
      return {
        id: f.properties.mapbox_id,
        name: f.properties.name,
        address: formatAddress(f),
        latitude: placeLat,
        longitude: placeLng,
        distanceMiles: distanceMiles(lat, lng, placeLat, placeLng),
      };
    })
    .sort((a, b) => a.distanceMiles - b.distanceMiles);
}

// --- Helpers --------------------------------------------------------------

/**
 * Prefer Mapbox's pre-formatted `place_formatted` (street + city +
 * state), falling back to `full_address` minus the name prefix.
 * Strip the trailing ", United States" (implied by the `country=us`
 * filter) and the 5-digit ZIP code — both are noise for a one-line
 * display row when the user just wants to know "where is this?"
 */
function formatAddress(f: MapboxFeature): string {
  const { place_formatted, full_address, name } = f.properties;
  const raw = place_formatted
    ?? full_address?.replace(new RegExp(`^${escapeRegExp(name)},\\s*`), '')
    ?? '';
  return trimAddressNoise(raw);
}

/**
 * "123 Main St, Brooklyn, New York 11211, United States"
 *   → "123 Main St, Brooklyn, New York"
 *
 * The ZIP code lands on the row that doubles as a navigation hint
 * ("can you guess where this is?") — and ZIP-without-context is just
 * a 5-digit nuisance. Strip the state suffix's ZIP and the trailing
 * country.
 */
function trimAddressNoise(addr: string): string {
  return addr
    .replace(/,\s*United States$/, '')
    .replace(/\s+\d{5}(-\d{4})?\b/, '');
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Haversine distance in miles. Same formula scoring.ts and edge-
 * indicators.ts would use if they needed it; small enough to inline
 * here rather than extract to a shared util.
 */
function distanceMiles(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 3958.8; // Earth's radius in miles
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}
