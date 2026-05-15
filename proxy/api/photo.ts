// Google Places photo proxy — GET /api/photo?name=<photoName>
//
// Resolves a Places API photo *name* (e.g. `places/XYZ/photos/ABC`,
// returned in /api/recs entries) into the actual image bytes. We
// don't return the bare Google CDN URL because the request URL
// needs the API key (`?key=…`) which can't leak to the client.
//
// Google's `/v1/{name}/media` endpoint returns a 302 redirect to a
// signed Google CDN URL. We follow that redirect ourselves and
// stream the bytes back — clients get a plain image URL to drop
// into `<Image source={{ uri: ... }}>` without ever seeing the key.
//
// Cache headers: 1 day s-maxage. Photo URLs are stable per photoName;
// Vercel's edge cache serves repeat requests without hitting Google.

import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: 'Photo proxy not configured' });
  }

  const nameRaw = req.query.name;
  const name = typeof nameRaw === 'string' ? nameRaw : undefined;
  if (!name) {
    return res.status(400).json({ error: 'Missing `name` query param' });
  }

  // Sanity-check the name format — should look like `places/X/photos/Y`.
  // Reject anything else so we don't proxy arbitrary URLs.
  if (!/^places\/[^/]+\/photos\/[^/]+$/.test(name)) {
    return res.status(400).json({ error: 'Invalid photo name' });
  }

  const maxRaw = req.query.max;
  const max = typeof maxRaw === 'string' ? Math.min(parseInt(maxRaw, 10) || 400, 1600) : 400;

  try {
    const googleUrl = `https://places.googleapis.com/v1/${name}/media?key=${apiKey}&maxHeightPx=${max}`;
    // Google returns a 302 to the signed CDN URL. Fetch it and
    // stream the resulting image back to the client. Using
    // `redirect: 'follow'` (default) means we get the actual
    // image bytes; the response is the CDN-served PNG/JPEG.
    const upstream = await fetch(googleUrl);
    if (!upstream.ok || !upstream.body) {
      console.warn(`[api/photo] upstream ${upstream.status}`);
      return res.status(502).json({ error: 'Upstream photo fetch failed' });
    }

    const contentType = upstream.headers.get('content-type') ?? 'image/jpeg';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=604800');
    res.setHeader('Access-Control-Allow-Origin', '*');

    // Stream the image bytes. Vercel's Node runtime supports
    // ReadableStream → Buffer via arrayBuffer.
    const arrayBuf = await upstream.arrayBuffer();
    res.status(200).send(Buffer.from(arrayBuf));
  } catch (e) {
    console.error('[api/photo] handler error', e);
    return res.status(500).json({ error: 'Photo fetch failed' });
  }
}
