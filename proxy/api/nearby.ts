// Nearest-business lookup — GET /api/nearby?lat=X&lng=Y
//
// Resolves a lat/lng coordinate to the closest business via Google
// Places `searchNearby`. Used by /report's submission flow to attach
// a real business name to a community report. The community-rec
// path then renders cards with actual recognizable names instead of
// the previous subTag-based fallback ("Restaurant" / "Bar/Cafe").
//
// Request: lat/lng query params. No category filter — we want the
// nearest *anything* the contributor might be standing in front of.
//
// Response: `{ place: { name, address, lat, lng, categoryLabel } | null }`.
// `null` when Google finds nothing within the 50m radius; /report
// falls back to the existing subTag-based naming.
//
// Radius: 50m is tight enough that we surface the business the
// contributor is actually standing at (not the one across the
// street), wide enough that GPS drift doesn't lose the match.
//
// CORS + cache: open `*` + 1-hour s-maxage. Place names don't
// change often; same coord re-queries hit the edge.

import type { VercelRequest, VercelResponse } from '@vercel/node';

const PLACES_NEARBY_URL = 'https://places.googleapis.com/v1/places:searchNearby';

const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.location',
  'places.primaryTypeDisplayName',
].join(',');

type NearbyPlace = {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  primaryTypeDisplayName?: { text: string };
};

type SearchNearbyResponse = {
  places?: NearbyPlace[];
};

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: 'Nearby lookup not configured' });
  }

  const latRaw = req.query.lat;
  const lngRaw = req.query.lng;
  const lat = typeof latRaw === 'string' ? parseFloat(latRaw) : NaN;
  const lng = typeof lngRaw === 'string' ? parseFloat(lngRaw) : NaN;

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return res
      .status(400)
      .json({ error: 'Missing or invalid lat / lng query params' });
  }

  try {
    const body = {
      locationRestriction: {
        circle: {
          center: { latitude: lat, longitude: lng },
          radius: 50,
        },
      },
      maxResultCount: 1,
      rankPreference: 'DISTANCE',
    };

    const upstream = await fetch(PLACES_NEARBY_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': FIELD_MASK,
      },
      body: JSON.stringify(body),
    });

    if (!upstream.ok) {
      console.warn(`[api/nearby] upstream ${upstream.status}`);
      res.setHeader('Cache-Control', 's-maxage=60');
      return res.status(200).json({ place: null });
    }

    const data = (await upstream.json()) as SearchNearbyResponse;
    const top = data.places?.[0];
    if (!top || !top.displayName || !top.location) {
      res.setHeader('Cache-Control', 's-maxage=3600');
      return res.status(200).json({ place: null });
    }

    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json({
      place: {
        name: top.displayName.text,
        address: top.formattedAddress ?? '',
        latitude: top.location.latitude,
        longitude: top.location.longitude,
        categoryLabel: top.primaryTypeDisplayName?.text ?? null,
      },
    });
  } catch (e) {
    console.error('[api/nearby] handler error', e);
    return res.status(500).json({ error: 'Nearby fetch failed' });
  }
}
