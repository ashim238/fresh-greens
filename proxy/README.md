# fresh-greens-proxy

Vercel-hosted proxy for the Fresh Greens app's external recommendation source. Holds the Google Places API key server-side and returns formatted recommendations matching the app's `Recommendation` type.

## Endpoint

`GET /api/recs?lat=<num>&lng=<num>&category=<id>`

Returns:

```json
{ "recommendations": [ /* up to 4 Recommendation entries */ ] }
```

Categories supported:
- `black-owned` — Google Places `searchText` with identity-keyword query, 10mi location bias
- `women-owned` — same pattern
- `lgbtq-welcoming` — same pattern
- `late-night-warm-welcome` — same pattern
- `restroom` — OpenStreetMap Overpass `amenity=toilets` (Google has no clean signal)

## Local development

```bash
cd proxy
npm install
vercel dev   # spins up at http://localhost:3000
```

Pull env vars from Vercel:

```bash
vercel link   # link to the deployed project
vercel env pull .env.local
```

## Deployment

```bash
vercel --prod
```

Requires `GOOGLE_PLACES_API_KEY` set in the Vercel project's Environment Variables dashboard.

## Auth / secrets

- `GOOGLE_PLACES_API_KEY` — Places API (New) key from Google Cloud Console. Free $200/month credit covers thesis-demo traffic.
- No Yelp adapter in v1 (Yelp Fusion moved to paid after 30-day trial; see PR discussion).

## CORS

The endpoint allows `*` since the consumer is a mobile app (no cookie auth) and the keys live on the proxy side. No additional access control in v1 — the cache headers and Google's per-key quotas are the rate-limit layer.
