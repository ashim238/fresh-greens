// Fresh Greens — places (POI) search adapter.
//
// POI search against Mapbox Search Box API (v6). Was Mapbox v5
// Geocoding originally — v5's free-text `q=` did substring matching,
// so "gas station" would also match anything else with "station" in
// the name (police stations, train stations, fire stations). v6's
// Search Box `/forward` endpoint is POI-category-aware and routes
// natural-language queries to the right OSM categories.
//
// Mapbox usage policy: free tier is 100K requests/month, 600/min.
// Comfortably above thesis-demo traffic. Token loaded from
// `process.env.EXPO_PUBLIC_MAPBOX_TOKEN` (set in `.env.local`,
// gitignored).
//
// The adapter returns Place[] with name + address + lat/lng + distance
// from the user's current location. Same shape any future provider
// (MKLocalSearch, Google Places, Foursquare) would slot into.

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

// Bounding box half-width in degrees. ~2.0° ≈ 140 miles at mid-
// latitudes — generous so rural users still get results. The
// `proximity` parameter biases toward user location, so closer
// matches naturally surface first; the bbox enforces a hard upper
// bound on how far results can drift.
const BBOX_DEGREES = 2.0;

/**
 * Search for named POIs matching the query, biased toward the user's
 * current location. Returns up to 10 results sorted by distance
 * ascending.
 *
 * `userLocation` is required — feeds Mapbox's `proximity` parameter
 * (the closer-results-first hint) and the client-side distance sort.
 */
export async function searchPlaces(
  query: string,
  userLocation: { latitude: number; longitude: number },
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
  const bbox = [
    lng - BBOX_DEGREES,
    lat - BBOX_DEGREES,
    lng + BBOX_DEGREES,
    lat + BBOX_DEGREES,
  ].join(',');

  const params = new URLSearchParams({
    q: trimmed,
    access_token: MAPBOX_TOKEN,
    proximity: `${lng},${lat}`,
    bbox,
    country: 'us',
    limit: '10',
    types: 'poi',
  });

  const url = `${MAPBOX_URL}?${params.toString()}`;

  let response: Response;
  try {
    response = await fetch(url);
  } catch (err) {
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
 * state), falling back to `full_address` minus the name prefix. Both
 * are populated for POIs in the v6 response.
 */
function formatAddress(f: MapboxFeature): string {
  const { place_formatted, full_address, name } = f.properties;
  if (place_formatted) {
    // Trim the trailing ", United States" — too noisy for a one-line
    // display row, US-only is implied by the country filter.
    return place_formatted.replace(/,\s*United States$/, '');
  }
  if (full_address) {
    return full_address
      .replace(new RegExp(`^${escapeRegExp(name)},\\s*`), '')
      .replace(/,\s*United States$/, '');
  }
  return '';
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
