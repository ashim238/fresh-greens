// Fresh Greens — places (POI) search adapter.
//
// Free-text POI search against Mapbox Geocoding. Was Nominatim
// originally, swapped for rate limit (Mapbox free tier is 10 req/sec
// vs. Nominatim's 1 req/sec) and POI-search quality (Mapbox
// understands category-like queries natively where Nominatim's `q=`
// only matches place names).
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

type MapboxFeature = {
  id: string;
  type: 'Feature';
  /** Full comma-separated label, e.g. "L'industrie, 254 South 2nd St, Brooklyn, NY 11211, USA" */
  place_name: string;
  /** Concise name, e.g. "L'industrie Pizzeria" */
  text: string;
  /** [longitude, latitude] in WGS84 */
  center: [number, number];
};

type MapboxResponse = {
  features?: MapboxFeature[];
};

const MAPBOX_URL = 'https://api.mapbox.com/geocoding/v5/mapbox.places';

const MAPBOX_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? '';

// Bounding box half-width in degrees. ~2.0° ≈ 140 miles at mid-
// latitudes — generous so rural users still get results. Mapbox's
// `proximity` parameter biases toward user location, so closer
// matches naturally surface first; the bbox just enforces a hard
// upper bound on how far results can drift.
const BBOX_DEGREES = 2.0;

/**
 * Search for named POIs matching the query, biased toward the user's
 * current location. Returns up to 10 results sorted by distance from
 * the user ascending.
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
    access_token: MAPBOX_TOKEN,
    proximity: `${lng},${lat}`,
    bbox,
    country: 'us',
    types: 'poi,address',
    limit: '10',
  });

  const url = `${MAPBOX_URL}/${encodeURIComponent(trimmed)}.json?${params.toString()}`;

  let response: Response;
  try {
    response = await fetch(url);
  } catch (err) {
    console.warn('[places] Mapbox fetch failed:', err);
    return [];
  }

  if (response.status === 429) {
    // Mapbox's free tier is 600/min — well above typical typing
    // cadence. If we hit this it's still a transient cap; treat as
    // empty (calm UI) and let the user retry.
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
      const [placeLng, placeLat] = f.center;
      return {
        id: f.id,
        name: f.text,
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
 * Mapbox's `place_name` is comma-separated: "Name, Street, City, ST
 * ZIP, USA". The first segment is `text` (the name); we want the next
 * two segments (street + city) as the address line.
 */
function formatAddress(f: MapboxFeature): string {
  const parts = f.place_name.split(',').map((s) => s.trim());
  // Skip the first segment (name) and the trailing country.
  const middle = parts.slice(1, -1);
  if (middle.length === 0) return parts.join(', ');
  // Street + city is the most useful 2 segments for display.
  return middle.slice(0, 2).join(', ');
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
