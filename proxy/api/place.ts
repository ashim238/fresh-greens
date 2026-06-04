// Place Details proxy — GET /api/place?placeId=<Google place id>
//
// Hydrates card fields for a community report that stored
// `googlePlaceId` at submit time. Keeps the Places API key
// server-side; the app calls this instead of Place Details directly.

import type { VercelRequest, VercelResponse } from '@vercel/node';

import { fetchPlaceDetailsById } from '../lib/place-details.js';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: 'Place details not configured' });
  }

  const placeIdRaw = req.query.placeId;
  const placeId = typeof placeIdRaw === 'string' ? placeIdRaw.trim() : '';
  if (!placeId) {
    return res.status(400).json({ error: 'Missing placeId query param' });
  }

  try {
    const details = await fetchPlaceDetailsById(placeId, apiKey);
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json({ place: details });
  } catch (e) {
    console.error('[api/place] handler error', e);
    return res.status(500).json({ error: 'Place details fetch failed' });
  }
}
