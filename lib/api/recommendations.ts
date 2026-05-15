// Fresh Greens — recommendations adapter.
//
// Three-source hybrid powering the /home browse-mode "Things to Do"
// card. Each call returns a unified `Recommendation[]` from:
//
//   1. **Curated catalog** (bundled below). Editorial entries with a
//      curator voice attached — same role the Negro Motorist Green
//      Book's editorial selections played for Black travelers
//      1936–67. The curator name + quote do the rhetorical work
//      that an algorithmic "top results near you" can't.
//
//   2. **Community reports** (`getCommunityReportsAsRecommendations`
//      below — filters `lib/api/community-reports.ts` for matching
//      categories). The peer-knowledge layer: when a user submits a
//      black-owned place via /report, it surfaces here too. Only
//      `black-owned` currently flows through this path; expanding
//      ReportCategoryId to cover women-owned / LGBTQ+ / restroom /
//      late-night-warm-welcome is the v2 follow-up that closes
//      the cross-category community contribution loop.
//
//   3. **External feed** (`getExternalRecommendations` — stub
//      below, returns []). Documented integration point for a
//      future Google Places + Yelp Fusion adapter — both expose
//      self-identification attributes (`identifies_as_black_owned`
//      and similar) that could augment coverage. Intentionally
//      no-op in v1: the demo leans on community + curated to keep
//      the thesis claim ("community knowledge as backbone")
//      load-bearing rather than corporate-API-mediated. Long-term
//      direction is EatOkra-style partnership, not Google.
//
// The adapter dedups across sources by lat/lng proximity (~50m) so
// a curated entry that someone has also community-reported doesn't
// show twice.

import type { ImageSourcePropType } from 'react-native';

import { getCommunityReports } from './community-reports';

// --- Types ---------------------------------------------------------------

export type RecommendationCategory =
  | 'black-owned'
  | 'women-owned'
  | 'lgbtq-welcoming'
  | 'restroom'
  | 'late-night-warm-welcome';

export type RecommendationSource = 'curated' | 'community' | 'external';

export type Recommendation = {
  id: string;
  source: RecommendationSource;
  category: RecommendationCategory;
  /** Display name. */
  name: string;
  /** One-line address for the card sub-row. */
  address: string;
  /** Coordinates for routing on tap. */
  latitude: number;
  longitude: number;
  /** Sub-category label ("Cafe", "Restaurant", "Public restroom"). */
  categoryLabel: string;
  /**
   * Curated entries carry a curator voice — name + testimony quote +
   * optional avatar. Community entries leave these undefined; the
   * card renders the user's own report detail in place.
   */
  curatorName?: string;
  curatorQuote?: string;
  curatorAvatar?: ImageSourcePropType;
  /** Quick tags like "A Sunday staple 👀". */
  tags?: Array<{ label: string; emoji?: string }>;
  /** Display string for the price chip — "$1–10", "$$", etc. */
  priceTier?: string;
  rating?: number;
  reviewCount?: number;
  /**
   * Static display label for hours — "Closes 4 PM", "Open 24/7", etc.
   * v1 keeps this a string the curator wrote; v2 would compute from
   * a structured hours field against `new Date()`.
   */
  hoursLabel?: string;
  /**
   * Whether the place is currently open. v1 keeps this static-per-
   * entry; v2 reads structured hours against device clock.
   */
  isOpen?: boolean;
  /** "Mobile, AL" — used for geographic filtering. */
  region: string;
  /** Optional community-report detail when source === 'community'. */
  reportDetail?: string;
};

// --- Public surface ------------------------------------------------------

export type RecommendationQuery = {
  category?: RecommendationCategory;
  region?: string;
};

/**
 * Reads recommendations from the three sources, optionally filtered
 * by category and region. Always returns curated entries first
 * (they're the editorial baseline), then community contributions,
 * then external (currently empty).
 */
export async function getRecommendations(
  query: RecommendationQuery = {},
): Promise<Recommendation[]> {
  const [curated, community, external] = await Promise.all([
    getCuratedRecommendations(query),
    getCommunityRecommendations(query),
    getExternalRecommendations(query),
  ]);

  return dedupByProximity([...curated, ...community, ...external]);
}

// --- Source 1: Curated catalog -------------------------------------------

async function getCuratedRecommendations(
  query: RecommendationQuery,
): Promise<Recommendation[]> {
  let recs: Recommendation[] = CURATED_CATALOG;
  if (query.category) recs = recs.filter((r) => r.category === query.category);
  if (query.region) recs = recs.filter((r) => r.region === query.region);
  return recs;
}

// --- Source 2: Community reports -----------------------------------------

/**
 * Maps community reports → Recommendation[] for the matching
 * categories. v1: only `black-owned` ReportCategoryId flows through
 * (the other four recommendation categories don't have matching
 * report types yet). v2: expand ReportCategoryId to add
 * `women-owned`, `lgbtq-welcoming`, `restroom`, and a
 * `felt-welcome-late` subtype, then route them here.
 */
async function getCommunityRecommendations(
  query: RecommendationQuery,
): Promise<Recommendation[]> {
  // Optimization: only community-reports for `black-owned` currently
  // contribute. If the caller filtered to a different category, skip
  // the AsyncStorage read entirely.
  if (query.category && query.category !== 'black-owned') return [];

  try {
    const reports = await getCommunityReports();
    return reports
      .filter((r) => r.categoryId === 'black-owned')
      .map((r): Recommendation => ({
        id: `community-${r.id}`,
        source: 'community',
        category: 'black-owned',
        name: r.subTag ?? 'Community-reported black-owned business',
        address: '',
        latitude: r.location.latitude,
        longitude: r.location.longitude,
        categoryLabel: r.subTag ?? 'Place',
        region: 'detected', // v1 doesn't reverse-geocode reports
        reportDetail: r.detail,
      }));
  } catch {
    return [];
  }
}

// --- Source 3: External feed (v2 integration point) ----------------------

/**
 * Stubbed external recommendations source. v2 candidates:
 *
 *   - **Google Places API** — `identifies_as_black_owned` attribute
 *     plus general POI metadata. Most reliable geographic coverage
 *     for self-identification flags. Paid after ~$200/month free
 *     tier.
 *
 *   - **Yelp Fusion API** — self-identification attributes added
 *     2020. Free tier ~500 requests/day; sufficient for thesis-
 *     scale traffic. Less canonical than Google.
 *
 *   - **EatOkra / Black Wall Street / Greenwood partnership** —
 *     Black-founded community-curated databases. No public APIs
 *     currently documented; would need partnership negotiation.
 *     Most thesis-aligned long-term direction.
 *
 * Intentionally returns empty in v1: the demo leans on community +
 * curated to keep the thesis claim ("community knowledge as
 * backbone") load-bearing rather than corporate-API-mediated.
 */
async function getExternalRecommendations(
  _query: RecommendationQuery,
): Promise<Recommendation[]> {
  return [];
}

// --- Dedup ---------------------------------------------------------------

/**
 * Removes duplicates across sources by lat/lng proximity (~50m).
 * Preserves the first occurrence (curated wins over community wins
 * over external) so the curator's editorial copy always trumps a
 * peer report or external listing of the same place.
 */
function dedupByProximity(recs: Recommendation[]): Recommendation[] {
  const PROXIMITY_DEG_SQ = (50 / 111000) ** 2; // ~50m in squared lat/lng
  const kept: Recommendation[] = [];
  for (const rec of recs) {
    const collision = kept.find((k) => {
      const dLat = k.latitude - rec.latitude;
      const dLng = k.longitude - rec.longitude;
      return dLat * dLat + dLng * dLng < PROXIMITY_DEG_SQ;
    });
    if (!collision) kept.push(rec);
  }
  return kept;
}

// --- Curated seed --------------------------------------------------------

/**
 * Two entries per category for the Mobile, AL demo region. Real
 * production would curate per city; this is the thesis-demo
 * starting point. Coordinates are real Mobile locations so the
 * routing pipeline gets a meaningful destination on tap.
 */
const CURATED_CATALOG: Recommendation[] = [
  // Black-owned
  {
    id: 'curated-black-owned-1',
    source: 'curated',
    category: 'black-owned',
    name: 'Great Day Latte',
    address: '700 St Francis St, Mobile, AL',
    latitude: 30.6954,
    longitude: -88.0399,
    categoryLabel: 'Cafe',
    curatorName: 'Jordan',
    curatorQuote:
      'An ESSENTIAL part of my daily morning ritual. The fragrant scents and atmosphere remind me of my own kitchen.',
    tags: [{ label: 'A Sunday staple', emoji: '👀' }],
    priceTier: '$1–10',
    rating: 4.7,
    reviewCount: 97,
    hoursLabel: 'Closes 4 PM',
    isOpen: true,
    region: 'Mobile, AL',
  },
  // Women-owned
  {
    id: 'curated-women-owned-1',
    source: 'curated',
    category: 'women-owned',
    name: 'Magnolia Roots Salon',
    address: '253 Dauphin St, Mobile, AL',
    latitude: 30.6918,
    longitude: -88.0431,
    categoryLabel: 'Salon',
    curatorName: 'Jordan',
    curatorQuote:
      'Tasha takes her time. You leave looking your best and feeling like a member of the family.',
    tags: [{ label: 'By appointment', emoji: '📅' }],
    priceTier: '$$',
    rating: 4.9,
    reviewCount: 142,
    hoursLabel: 'Closes 7 PM',
    isOpen: true,
    region: 'Mobile, AL',
  },
  // LGBTQ+ welcoming
  {
    id: 'curated-lgbtq-1',
    source: 'curated',
    category: 'lgbtq-welcoming',
    name: 'B-Bob’s Downtown',
    address: '213 Conti St, Mobile, AL',
    latitude: 30.6943,
    longitude: -88.0421,
    categoryLabel: 'Bar',
    curatorName: 'Jordan',
    curatorQuote:
      'Open for decades, hosts Mobile’s drag scene, and one of the few places everyone has always been welcome.',
    tags: [{ label: 'Drag nights', emoji: '✨' }],
    priceTier: '$$',
    rating: 4.6,
    reviewCount: 318,
    hoursLabel: 'Open until 2 AM',
    isOpen: true,
    region: 'Mobile, AL',
  },
  // Restroom
  {
    id: 'curated-restroom-1',
    source: 'curated',
    category: 'restroom',
    name: 'Bienville Square Restrooms',
    address: 'Bienville Square, Mobile, AL',
    latitude: 30.6924,
    longitude: -88.0413,
    categoryLabel: 'Public restroom',
    curatorName: 'Jordan',
    curatorQuote:
      'Clean, accessible, and you don’t have to buy anything to use them. A real one when you’re downtown.',
    tags: [{ label: 'Accessible', emoji: '♿' }],
    hoursLabel: 'Open 8 AM–9 PM',
    isOpen: true,
    region: 'Mobile, AL',
  },
  // Late Night Warm Welcome
  {
    id: 'curated-late-night-1',
    source: 'curated',
    category: 'late-night-warm-welcome',
    name: 'The Pelican Pub',
    address: '111 Dauphin St, Mobile, AL',
    latitude: 30.6938,
    longitude: -88.0427,
    categoryLabel: 'Pub',
    curatorName: 'Jordan',
    curatorQuote:
      'Late hours, lit parking, and the staff actually says hello. Solid stop on a long drive home.',
    tags: [{ label: 'Well-lit parking', emoji: '💡' }],
    priceTier: '$$',
    rating: 4.4,
    reviewCount: 211,
    hoursLabel: 'Open until 1 AM',
    isOpen: true,
    region: 'Mobile, AL',
  },
];
