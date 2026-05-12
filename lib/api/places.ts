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
// Viewbox half-widths in degrees. ~0.7° ≈ 48 miles at mid-latitudes;
// ~2.0° ≈ 140 miles. Tiered search: tight viewbox first (urban users
// get clean "near me" results), wider viewbox fallback when nothing
// matches locally (rural users still get something).
const NARROW_VIEWBOX_DEGREES = 0.7;
const WIDE_VIEWBOX_DEGREES = 2.0;

/**
 * Maps common user-friendly category terms to the OSM tag keywords
 * Nominatim recognizes for category-aware search.
 *
 * Nominatim's default `q=` does name-search — it only matches places
 * whose NAME contains the query. Typing "salon" in NYC returns one
 * place literally named "Angela Salon" because no actual hair salons
 * are named the word "salon"; they're "Curl Up & Dye" etc. But if we
 * query "hairdresser" (the OSM `shop` tag value), Nominatim returns
 * 10 properly-categorized hair salons.
 *
 * This map is a thin pre-processor: if the user's query (trimmed,
 * lowercased) matches a key, we substitute the OSM keyword before
 * the request. Everything else passes through unchanged. The values
 * are OSM tag values from the standard `amenity` / `shop` / `tourism`
 * schemas — not invented.
 */
const CATEGORY_ALIASES: Record<string, string> = {
  salon: 'hairdresser',
  'hair salon': 'hairdresser',
  hair: 'hairdresser',
  barber: 'hairdresser',
  'beauty salon': 'beauty',
  beauty: 'beauty',
  nails: 'beauty',
  'nail salon': 'beauty',
  spa: 'beauty',
  coffee: 'cafe',
  'coffee shop': 'cafe',
  food: 'restaurant',
  gas: 'fuel',
  'gas station': 'fuel',
  parking: 'parking',
  atm: 'atm',
  bank: 'bank',
  pharmacy: 'pharmacy',
  grocery: 'supermarket',
  groceries: 'supermarket',
  pizza: 'restaurant',
  bar: 'bar',
  gym: 'gym',
  fitness: 'gym',
};

function aliasQuery(raw: string): string {
  const key = raw.trim().toLowerCase();
  return CATEGORY_ALIASES[key] ?? raw;
}

/**
 * Strips punctuation and diacritics from a query so a user typing
 * "Lindustrie" can still find a place named "L'industrie" (and the
 * reverse), and "cafe" can find "café". Used as the tier-3 fallback
 * when the original-form search has returned empty in both viewbox
 * sizes — Nominatim's tokenizer normally handles these cases, but
 * the index occasionally preserves the punctuation in ways that
 * trip up unpunctuated queries.
 */
function normalizeQuery(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // combining diacritical marks
    .replace(/['‘’\-]/g, '') // straight + curly apostrophes, hyphen
    .replace(/\s+/g, ' ')
    .trim();
}

export async function searchPlaces(
  query: string,
  userLocation: { latitude: number; longitude: number },
): Promise<Place[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  // Translate common category terms (e.g. "salon" → "hairdresser")
  // into the OSM tag keywords Nominatim recognizes for category
  // search. Without this, name-only matching makes generic queries
  // useless ("salon" returns ~1 result in dense urban areas).
  const queryToSend = aliasQuery(trimmed);

  // Tier 1: tight ~50mi viewbox. Best UX for urban / suburban users —
  // results stay close enough that "near me" is a faithful read.
  const narrow = await fetchPlaces(queryToSend, userLocation, NARROW_VIEWBOX_DEGREES);
  if (narrow.length > 0) return narrow;

  // Tier 2: ~140mi fallback. Rural users (where the nearest match for
  // a niche query might genuinely be 80mi away) get a usable answer
  // instead of an empty list.
  const wide = await fetchPlaces(queryToSend, userLocation, WIDE_VIEWBOX_DEGREES);
  if (wide.length > 0) return wide;

  // Tier 3: punctuation-normalized retry. Fires only when both prior
  // tiers returned empty AND the normalized form actually differs.
  // Helps for "Lindustrie" → "L'industrie" (and reverse), or "cafe"
  // → "café". One extra request only in the long tail.
  const normalized = normalizeQuery(queryToSend);
  if (normalized && normalized !== queryToSend) {
    return fetchPlaces(normalized, userLocation, WIDE_VIEWBOX_DEGREES);
  }
  return [];
}

/**
 * Single Nominatim request with a sized viewbox. Hard-restrict to the
 * box (bounded: '1') so a soft bias can't surface globally-famous
 * results from outside the area. Returns sorted by distance ascending.
 */
async function fetchPlaces(
  query: string,
  userLocation: { latitude: number; longitude: number },
  viewboxDegrees: number,
): Promise<Place[]> {
  const lat = userLocation.latitude;
  const lng = userLocation.longitude;
  const viewbox = [
    lng - viewboxDegrees,
    lat + viewboxDegrees,
    lng + viewboxDegrees,
    lat - viewboxDegrees,
  ].join(',');

  const params = new URLSearchParams({
    q: query,
    format: 'json',
    // 20 (was 10) — category-aware queries can match many POIs and
    // the user should be able to scroll a meaningful list. Distance
    // sort still puts the closest match on top.
    limit: '20',
    addressdetails: '1',
    countrycodes: 'us',
    viewbox,
    bounded: '1', // hard restrict — soft bias lets famous global results through
  });

  const url = `${NOMINATIM_URL}?${params.toString()}`;

  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
  });

  if (!response.ok) {
    throw new Error(`Nominatim returned ${response.status}`);
  }

  const json: NominatimResult[] = await response.json();

  // Sort by distance ascending. Nominatim's default ordering inside a
  // viewbox is relevance-based — for navigation intent ("find me X
  // near me"), distance is the right primary sort.
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
