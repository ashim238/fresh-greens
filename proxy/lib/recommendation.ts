// Recommendation shape returned by the proxy.
//
// Mirrors `Recommendation` in `../../lib/api/recommendations.ts` of
// the app — keep them in sync so the app can JSON.parse the
// response directly into its typed shape. Fields the app cares
// about for the card render are required; everything else is
// optional and the proxy fills in what's available from the
// upstream (Google Places / OSM).
//
// `source` is always `'external'` from the proxy's perspective.
// The app may re-tag entries to other source types on its side
// before merging, but the wire shape carries `external` to make
// the origin explicit.

export type RecommendationCategory =
  | 'black-owned'
  | 'women-owned'
  | 'lgbtq-welcoming'
  | 'restroom'
  | 'late-night-warm-welcome';

export type Recommendation = {
  id: string;
  source: 'external';
  category: RecommendationCategory;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  categoryLabel: string;
  priceTier?: string;
  rating?: number;
  reviewCount?: number;
  hoursLabel?: string;
  isOpen?: boolean;
  region: string;
};
