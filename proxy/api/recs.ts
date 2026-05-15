// Fresh Greens recommendations proxy — GET /api/recs
//
// Query params:
//   - lat (required) — user's latitude
//   - lng (required) — user's longitude
//   - category (required) — one of:
//       'black-owned' | 'women-owned' | 'lgbtq-welcoming'
//     | 'restroom'    | 'late-night-warm-welcome'
//
// Response: `{ recommendations: Recommendation[] }` — up to 4
// entries matching the app's `Recommendation` shape. The proxy
// dispatches:
//   - restroom → OSM Overpass (no clean Google signal)
//   - everything else → Google Places `searchText` with identity
//     keywords + a 10mi locationBias around (lat, lng)
//
// CORS: open `*` since the app is a mobile client (not a browser
// with cookie auth concerns), and the upstream APIs hold the keys.
// Cache headers: `s-maxage=600` on the Vercel CDN so repeat
// requests from the same geo-grid bucket within 10 min hit the
// edge cache, not Google/OSM.

import type { VercelRequest, VercelResponse } from '@vercel/node';

import { fetchGooglePlaces } from '../lib/google-places.js';
import { fetchOsmRestrooms } from '../lib/osm-overpass.js';
import type { RecommendationCategory } from '../lib/recommendation.js';

const VALID_CATEGORIES: RecommendationCategory[] = [
  'black-owned',
  'women-owned',
  'lgbtq-welcoming',
  'restroom',
  'late-night-warm-welcome',
];

function isValidCategory(s: string | undefined): s is RecommendationCategory {
  return !!s && (VALID_CATEGORIES as string[]).includes(s);
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const latRaw = req.query.lat;
  const lngRaw = req.query.lng;
  const categoryRaw = req.query.category;

  const lat = typeof latRaw === 'string' ? parseFloat(latRaw) : NaN;
  const lng = typeof lngRaw === 'string' ? parseFloat(lngRaw) : NaN;
  const category = typeof categoryRaw === 'string' ? categoryRaw : undefined;

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res
      .status(400)
      .json({ error: 'Missing or invalid lat / lng query params' });
  }
  if (!isValidCategory(category)) {
    return res.status(400).json({
      error: 'Missing or invalid category',
      valid: VALID_CATEGORIES,
    });
  }

  try {
    const recommendations =
      category === 'restroom'
        ? await fetchOsmRestrooms(lat, lng)
        : await fetchGooglePlaces(lat, lng, category);

    return res.status(200).json({ recommendations });
  } catch (e) {
    console.error('[api/recs] handler error', e);
    return res.status(500).json({ error: 'Upstream fetch failed' });
  }
}
