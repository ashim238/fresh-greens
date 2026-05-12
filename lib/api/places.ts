// Fresh Greens — places (POI) search adapter.
//
// Free-text POI search against OpenStreetMap's Nominatim service.
// Free, no API key, fits the existing OSM/OSRM/Overpass adapter pattern.
// Required to power /search's Results state with real business names —
// Apple's `Location.geocodeAsync` only returns coordinates (no names).
//
// Nominatim usage policy: max 1 req/sec, must set a User-Agent, must
// not bulk-scrape. See https://operations.osmfoundation.org/policies/nominatim/.
// For thesis-demo traffic this is comfortably below the rate limit.
//
// The adapter returns Place[] with name + address + lat/lng + distance
// from the user's current location. Same shape any future provider
// (MKLocalSearch, Google Places, Foursquare) would slot into.

export type Place = {
  /** Stable identifier from Nominatim. */
  id: string;
  /** Concise business name (e.g., "Locs of Soul LLC"). */
  name: string;
  /** Single-line address for display under the name. */
  address: string;
  /** Coordinates for routing. */
  latitude: number;
  longitude: number;
  /** Distance from the user's location in miles, rounded to 1 decimal. */
  distanceMiles: number;
};

type NominatimResult = {
  place_id: number;
  display_name: string;
  name?: string;
  lat: string;
  lon: string;
  address?: {
    house_number?: string;
    road?: string;
    city?: string;
    town?: string;
    village?: string;
    suburb?: string;
    state?: string;
    postcode?: string;
  };
};

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const USER_AGENT = 'FreshGreens/1.0 (thesis-demo)';

/**
 * Search for named POIs matching the query, biased toward the user's
 * current location. Returns up to 10 results sorted by Nominatim's
 * relevance score with distance from the user appended.
 *
 * `userLocation` is required — the adapter sorts by distance and
 * biases search results toward the local viewbox. Passing the user's
 * location from the screen is cheaper than calling
 * Location.getCurrentPositionAsync inside the adapter (which would
 * trigger permission prompts in code that's supposed to be I/O-only).
 */
export async function searchPlaces(
  query: string,
  userLocation: { latitude: number; longitude: number },
): Promise<Place[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  // Hard-restrict the search to a ~50mi viewbox around the user's
  // location. 0.7° ≈ 48 miles at mid-latitudes; close enough for
  // thesis demo. Earlier version used `bounded: '0'` (soft bias)
  // which let Nominatim's global relevance ranking surface results
  // thousands of miles away when the query had a well-known global
  // match — e.g. searching "Salon" in NY would return a famous
  // salon on the west coast above any local salons. `bounded: '1'`
  // makes the viewbox a hard limit.
  const lat = userLocation.latitude;
  const lng = userLocation.longitude;
  const viewbox = [lng - 0.7, lat + 0.7, lng + 0.7, lat - 0.7].join(',');

  const params = new URLSearchParams({
    q: trimmed,
    format: 'json',
    limit: '10',
    addressdetails: '1',
    countrycodes: 'us',
    viewbox,
    bounded: '1', // hard restrict to viewbox — see comment above
  });

  const url = `${NOMINATIM_URL}?${params.toString()}`;

  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
  });

  if (!response.ok) {
    throw new Error(`Nominatim returned ${response.status}`);
  }

  const json: NominatimResult[] = await response.json();

  // Sort by distance ascending so the closest match is always first.
  // Nominatim's default ordering inside a viewbox is relevance-based,
  // which can put a famous-but-farther result above a closer obvious
  // match. For "find me X near me" intent, distance is the right
  // primary sort.
  return json
    .map((r) => {
      const placeLat = parseFloat(r.lat);
      const placeLng = parseFloat(r.lon);
      return {
        id: String(r.place_id),
        name: r.name ?? extractName(r.display_name),
        address: formatAddress(r),
        latitude: placeLat,
        longitude: placeLng,
        distanceMiles: distanceMiles(
          userLocation.latitude,
          userLocation.longitude,
          placeLat,
          placeLng,
        ),
      };
    })
    .sort((a, b) => a.distanceMiles - b.distanceMiles);
}

// --- Helpers --------------------------------------------------------------

/**
 * Nominatim's `display_name` is comma-separated: "Foo Salon, 123 Main
 * St, Mobile, AL, 36601, USA". When `name` is missing on the response,
 * fall back to the first segment (the business name itself).
 */
function extractName(displayName: string): string {
  const first = displayName.split(',')[0];
  return first.trim();
}

/**
 * Compose a brief address line from Nominatim's `address` object.
 * Pattern: "{house_number} {road}, {city}" — falls back to truncated
 * display_name if structured fields are missing.
 */
function formatAddress(r: NominatimResult): string {
  const a = r.address;
  if (!a) {
    return truncate(r.display_name, 40);
  }
  const street = [a.house_number, a.road].filter(Boolean).join(' ');
  const city = a.city ?? a.town ?? a.village ?? a.suburb ?? '';
  if (street && city) return `${street}, ${city}`;
  if (street) return street;
  if (city) return city;
  return truncate(r.display_name, 40);
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

/**
 * Haversine distance in miles. Same formula scoring.ts and edge-
 * indicators.ts would use if they needed it; small enough to inline
 * here rather than extract to a shared util — current rule-of-three
 * count is still 1.
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
