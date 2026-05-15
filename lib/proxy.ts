// Fresh Greens — proxy URL constants.
//
// The Vercel proxy at `proxy/` hosts the Google Places + photo
// endpoints. Two consumers currently:
//   - `lib/api/recommendations.ts` calls `/api/recs`
//   - `components/HomeBrowseSheet.tsx` constructs `/api/photo` URLs
//     for the card hero <Image>
//
// Both were independently reading `process.env.EXPO_PUBLIC_PROXY_BASE_URL`
// with the same fallback URL inlined — easy for the two to drift apart
// when the env var moves. This module is the single source of truth.

const DEFAULT_PROXY_BASE_URL = 'https://fresh-greens-proxy.vercel.app';

export const PROXY_BASE_URL =
  process.env.EXPO_PUBLIC_PROXY_BASE_URL ?? DEFAULT_PROXY_BASE_URL;

export const PROXY_RECS_URL = `${PROXY_BASE_URL}/api/recs`;
export const PROXY_PHOTO_URL = `${PROXY_BASE_URL}/api/photo`;
export const PROXY_NEARBY_URL = `${PROXY_BASE_URL}/api/nearby`;

/**
 * Nearest-business response from `/api/nearby`. `place` is null
 * when Google found nothing in the 50m radius around (lat, lng).
 */
export type NearbyPlace = {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  categoryLabel: string | null;
};

/**
 * Look up the nearest business to a coordinate. Returns null on
 * any failure (network, no match, malformed response) so callers
 * can fall back to whatever name they had. Same `null` semantics
 * as the proxy's `{ place: null }`.
 */
export async function fetchNearestPlace(
  latitude: number,
  longitude: number,
): Promise<NearbyPlace | null> {
  try {
    const url = `${PROXY_NEARBY_URL}?lat=${latitude}&lng=${longitude}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = (await res.json()) as { place: NearbyPlace | null };
    return data.place ?? null;
  } catch {
    return null;
  }
}
