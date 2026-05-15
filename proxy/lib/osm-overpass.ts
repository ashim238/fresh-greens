// OpenStreetMap Overpass adapter — public restrooms.
//
// Google Places has no clean signal for public/open restrooms.
// OSM has `amenity=toilets` as a first-class tag, well-maintained
// in urban areas. The Fresh Greens app already uses Overpass for
// zone data (lit streets, parks, etc.) — same upstream, same
// failure modes, same network etiquette.
//
// Query: nodes within a 10mi (16km) bbox around (lat, lng) with
// `amenity=toilets`. Returns up to 4 entries, formatted to the
// shared `Recommendation` shape.
//
// Network: Overpass is volunteer-funded, so we pass a User-Agent
// per the API etiquette guidelines and cap at maxage 600 (10 min)
// to share results across the Vercel CDN.

import type { Recommendation } from './recommendation';

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';

type OverpassNode = {
  type: 'node';
  id: number;
  lat: number;
  lon: number;
  tags?: Record<string, string>;
};

type OverpassResponse = {
  elements?: OverpassNode[];
};

/**
 * Bounding box for a ~10mi radius around (lat, lng). Overpass
 * accepts (south, west, north, east). 1° lat ≈ 69mi, so 10mi ≈
 * 0.145°. Longitude scales by cos(lat) — at Mobile's ~30°N
 * latitude that's 0.167° east/west. Using 0.16° for both is close
 * enough for a search radius; the app re-filters by exact distance
 * before display.
 */
function bboxFor(lat: number, lng: number): string {
  const latDelta = 10 / 69;
  const lngDelta = 10 / (69 * Math.cos((lat * Math.PI) / 180));
  return `${lat - latDelta},${lng - lngDelta},${lat + latDelta},${lng + lngDelta}`;
}

/**
 * Friendly display label for a restroom node. OSM tags carry a
 * `name` sometimes (rare for restrooms), an `operator` (parks dept,
 * etc.), or just bare `amenity=toilets`. Falls through with a
 * generic "Public restroom" so the card always renders something.
 */
function labelFor(tags: Record<string, string> | undefined): string {
  if (!tags) return 'Public restroom';
  if (tags.name) return tags.name;
  if (tags.operator) return `${tags.operator} restroom`;
  return 'Public restroom';
}

/**
 * Sub-label / category text. Surfaces the access tag when known
 * ("yes" / "public" / "customers") so users can read whether it's
 * gated. Falls back to the generic.
 */
function subLabelFor(tags: Record<string, string> | undefined): string {
  if (!tags) return 'Public restroom';
  if (tags.access === 'customers') return 'Customers only';
  if (tags.access === 'permissive') return 'Open access';
  if (tags.access === 'private') return 'Restricted';
  return 'Public restroom';
}

export async function fetchOsmRestrooms(
  lat: number,
  lng: number,
): Promise<Recommendation[]> {
  const bbox = bboxFor(lat, lng);
  const query = `[out:json][timeout:15];node["amenity"="toilets"](${bbox});out body 20;`;

  try {
    const res = await fetch(OVERPASS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'fresh-greens-proxy/0.1 (thesis demo)',
      },
      body: `data=${encodeURIComponent(query)}`,
    });

    if (!res.ok) {
      console.warn(`[osm-overpass] ${res.status}`);
      return [];
    }

    const data = (await res.json()) as OverpassResponse;
    const elements = data.elements ?? [];

    return elements
      .slice(0, 4)
      .map((n): Recommendation => ({
        id: `osm-${n.id}`,
        source: 'external',
        category: 'restroom',
        name: labelFor(n.tags),
        address: '', // OSM nodes don't usually carry a full address
        latitude: n.lat,
        longitude: n.lon,
        categoryLabel: subLabelFor(n.tags),
        hoursLabel: n.tags?.opening_hours,
        region: 'external',
      }));
  } catch (e) {
    console.warn('[osm-overpass] fetch failed', e);
    return [];
  }
}
