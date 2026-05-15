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
