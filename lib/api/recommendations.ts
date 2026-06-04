// Fresh Greens — recommendations adapter.
//
// Three-source hybrid powering the /home browse-mode "Around Me"
// card. Each call returns a unified `Recommendation[]` from:
//
//   1. **Curated catalog** (bundled below). Editorial entries with a
//      curator voice attached — same role the Negro Motorist Green
//      Book's editorial selections played for Black travelers
//      1936–67. The curator name + quote do the rhetorical work
//      that an algorithmic "top results near you" can't.
//
//   2. **Community reports** (`getCommunityRecommendations` below
//      — reads `lib/api/community-reports.ts`). The peer-knowledge
//      layer: every Around Me chip is fed by community submissions.
//      Routing:
//        - `categoryId === 'black-owned'` → black-owned chip
//        - `categoryId === 'felt-welcome'` with an identity subTag
//          (`Women-owned`, `LGBTQ+ welcoming`, `Open restroom`,
//          `Late-night welcome`) → matching identity chip
//      That keeps the /report picker at 6 tiles while still letting
//      community knowledge feed all 5 browse-sheet chips — the
//      thesis-claim loop closed at the data layer, not the picker.
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

import { PROXY_RECS_URL } from '../proxy';
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
  /**
   * Distance from the user's current GPS to this rec, in miles.
   * Computed in the adapter when `query.userLocation` is provided;
   * undefined when no user fix is available. Surfaces in the
   * Multi-card variant as the "0.7 mi away" pill (Figma 1133:13614).
   */
  distanceMiles?: number;
  /**
   * Google Places photo *name* (e.g. `places/X/photos/Y`) for the
   * card's hero image. Rendered by the card via the proxy's
   * `/api/photo?name=...` endpoint. Undefined for curated/community
   * entries (no upstream photo) — card falls back to the
   * category-glyph placeholder.
   */
  photoName?: string;
  /**
   * Distinct human-readable vouch labels when this card represents a
   * same-place group trusted in more than one way (e.g.
   * ['Black-owned', 'Felt welcome']). Populated ONLY by
   * getTrustedByCommunity, ONLY when a group has >= 2 distinct vouches.
   * Undefined everywhere else — the card's default pill is unchanged.
   */
  facets?: string[];
};

// --- Public surface ------------------------------------------------------

export type RecommendationQuery = {
  category?: RecommendationCategory;
  region?: string;
  /**
   * User's current GPS, used for: (1) proximity filtering of
   * community submissions (10mi radius — places far outside the
   * driver's area shouldn't compete for chip real estate), (2)
   * proxying to the external adapter (Google Places searchText
   * with a 10mi locationBias around this point), and (3) computing
   * per-entry `distanceMiles` for the card's distance pill.
   */
  userLocation?: { latitude: number; longitude: number };
};

/**
 * Reads recommendations from the three sources and merges them into
 * the order the browse sheet expects:
 *
 *   1. Top community submission (≤10mi from user, if any)
 *   2. Up to 4 external entries (Google Places / OSM Overpass via
 *      the proxy)
 *   3. Curated fallback ONLY when slots 2–5 came back empty
 *      (catastrophic offline / API down) — the curated catalog is
 *      Mobile-only seed content, not a primary source.
 *
 * Dedup by ~50m proximity so a community submission that's also in
 * Google's index doesn't show twice. When `userLocation` is set,
 * `distanceMiles` is computed for every entry so the card can
 * render its "0.7 mi away" pill (Figma 1133:13614).
 */
export async function getRecommendations(
  query: RecommendationQuery = {},
): Promise<Recommendation[]> {
  const [community, external] = await Promise.all([
    getCommunityRecommendations(query),
    getExternalRecommendations(query),
  ]);

  const sorted = sortByDistance(community, query.userLocation);
  const topCommunity = sorted.slice(0, 1);
  const externalSorted = sortByDistance(external, query.userLocation).slice(0, 4);

  const primary = [...topCommunity, ...externalSorted];
  const merged = primary.length > 0
    ? primary
    : await getCuratedRecommendations(query);

  return annotateDistance(dedupBySamePlace(merged), query.userLocation);
}

/**
 * Case/whitespace-insensitive name key for same-place matching. Mirrors
 * the one-liner in lib/api/preferred-stations.ts — kept local rather
 * than shared to avoid coupling the two adapters over a trivial
 * normalize (two copies is under the rule-of-three threshold).
 */
function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

/** ~50m, expressed as squared lat/lng degrees (cheap, no trig). */
const SAME_PLACE_DEG_SQ = (50 / 111000) ** 2;

/**
 * Two recs/points refer to the SAME place when their normalized names
 * match AND they sit within ~50m. Name is the disambiguator — proximity
 * alone collapses distinct neighbors (two storefronts within 50m read as
 * one, and the second is silently dropped). Same fix shape as
 * preferred-stations' `stationsMatch`.
 */
function samePlace(
  a: { name: string; latitude: number; longitude: number },
  b: { name: string; latitude: number; longitude: number },
): boolean {
  if (normalizeName(a.name) !== normalizeName(b.name)) return false;
  const dLat = a.latitude - b.latitude;
  const dLng = a.longitude - b.longitude;
  return dLat * dLat + dLng * dLng < SAME_PLACE_DEG_SQ;
}

/** Haversine miles between two lat/lng pairs. */
function distanceMilesBetween(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const R = 3958.8; // earth radius in miles
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function sortByDistance(
  recs: Recommendation[],
  userLocation: { latitude: number; longitude: number } | undefined,
): Recommendation[] {
  if (!userLocation) return recs;
  return [...recs].sort(
    (a, b) =>
      distanceMilesBetween(userLocation, a) - distanceMilesBetween(userLocation, b),
  );
}

// Curated entries are catastrophic-fallback demo content seeded for
// Mobile, AL. A user in NYC firing curated (because external +
// community both came back empty) sees "1186 mi away" on each card —
// reads as broken data, not signal. Suppress the distance pill for
// curated entries beyond this radius from the user; nearby
// (Mobile-area) users still see a useful "12 mi away" read.
const CURATED_DISTANCE_DROP_MILES = 50;

function annotateDistance(
  recs: Recommendation[],
  userLocation: { latitude: number; longitude: number } | undefined,
): Recommendation[] {
  if (!userLocation) return recs;
  return recs.map((r) => {
    const distance = distanceMilesBetween(userLocation, r);
    if (r.source === 'curated' && distance > CURATED_DISTANCE_DROP_MILES) {
      // Leave `distanceMiles` undefined — the card already gates the
      // distance pill on `r.distanceMiles != null`.
      return r;
    }
    return { ...r, distanceMiles: distance };
  });
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
 * browse-sheet chip. Routing rules:
 *
 *   - `categoryId === 'black-owned'` → `black-owned` chip (always).
 *   - `categoryId === 'felt-welcome'` AND `subTag` is one of the
 *     identity tags (`Women-owned` / `LGBTQ+ welcoming` /
 *     `Open restroom` / `Late-night welcome`) → that identity's chip.
 *   - Any other felt-welcome submission doesn't surface in the
 *     browse-sheet recommendations — it still drops as a marker on
 *     the map, but its place-type subTag isn't enough to claim a
 *     chip.
 *
 * Closes the thesis-claim loop: community submissions now feed every
 * Around Me chip (not just black-owned), routed via the identity
 * subTag the contributor picked on /report.
 */
type FeltWelcomeIdentitySubTag =
  | 'Women-owned'
  | 'LGBTQ+ welcoming'
  | 'Open restroom'
  | 'Late-night welcome';

const IDENTITY_SUBTAG_TO_REC_CATEGORY: Record<
  FeltWelcomeIdentitySubTag,
  RecommendationCategory
> = {
  'Women-owned': 'women-owned',
  'LGBTQ+ welcoming': 'lgbtq-welcoming',
  'Open restroom': 'restroom',
  'Late-night welcome': 'late-night-warm-welcome',
};

const FALLBACK_NAME_BY_REC_CATEGORY: Record<RecommendationCategory, string> = {
  'black-owned': 'Community-reported black-owned business',
  'women-owned': 'Community-reported women-owned place',
  'lgbtq-welcoming': 'Community-flagged LGBTQ+ welcoming place',
  restroom: 'Community-shared open restroom',
  'late-night-warm-welcome': 'Community-shared late-night welcome',
};

function recCategoryForReport(
  categoryId: string,
  subTag: string | undefined,
): RecommendationCategory | null {
  if (categoryId === 'black-owned') return 'black-owned';
  if (categoryId === 'felt-welcome' && subTag) {
    return IDENTITY_SUBTAG_TO_REC_CATEGORY[subTag as FeltWelcomeIdentitySubTag] ?? null;
  }
  return null;
}

/**
 * Display labels for the "vouch" register surfaced on the Trusted-by-
 * community card. Distinct from HomeBrowseSheet's CATEGORY_LABELS (which
 * is keyed by RecommendationCategory and uses title-case "Black-Owned"):
 * this register reads as a community vouch and intentionally adds
 * "Felt welcome", which has no RecommendationCategory (general felt-
 * welcome routes to none).
 */
const VOUCH_LABEL: Record<RecommendationCategory, string> = {
  'black-owned': 'Black-owned',
  'women-owned': 'Women-owned',
  'lgbtq-welcoming': 'LGBTQ+ welcoming',
  restroom: 'Open restroom',
  'late-night-warm-welcome': 'Late-night welcome',
};

/**
 * The vouch label for a single report. Routes via recCategoryForReport
 * (black-owned, or felt-welcome + identity subTag); a felt-welcome report
 * with a place-type or no subTag falls through to "Felt welcome" — the
 * most fundamental vouch. The final "Trusted" is defensive and should be
 * unreachable (the trusted-row candidate filter already excludes non-
 * routing, non-felt-welcome reports).
 */
function vouchLabelForReport(
  categoryId: string,
  subTag: string | undefined,
): string {
  const routed = recCategoryForReport(categoryId, subTag);
  if (routed) return VOUCH_LABEL[routed];
  if (categoryId === 'felt-welcome') return 'Felt welcome';
  return 'Trusted';
}

const COMMUNITY_PROXIMITY_RADIUS_MILES = 10;

async function getCommunityRecommendations(
  query: RecommendationQuery,
): Promise<Recommendation[]> {
  try {
    const reports = await getCommunityReports();
    return reports
      .map((r) => {
        const recCategory = recCategoryForReport(r.categoryId, r.subTag);
        if (!recCategory) return null;
        if (query.category && recCategory !== query.category) return null;
        // Proximity gate — community submissions only surface as
        // recommendations when they're within ~10mi of the driver.
        // Far-away contributions still drop as map markers; they
        // just don't compete for chip real estate. Skipped when no
        // GPS fix yet so we don't drop everything pre-first-fix.
        if (query.userLocation) {
          const miles = distanceMilesBetween(query.userLocation, r.location);
          if (miles > COMMUNITY_PROXIMITY_RADIUS_MILES) return null;
        }
        // Name resolution order: auto-resolved business name (from
        // submit-time /api/nearby lookup) → user-picked subTag →
        // category-fallback ("Community-reported black-owned
        // business"). The placeName is the most concrete and
        // recognizable when present — closes the
        // "community-reported X" → "<real business>" gap that made
        // community recs look like fillers.
        const rec: Recommendation = {
          id: `community-${r.id}`,
          source: 'community',
          category: recCategory,
          name: r.placeName ?? r.subTag ?? FALLBACK_NAME_BY_REC_CATEGORY[recCategory],
          address: '',
          latitude: r.location.latitude,
          longitude: r.location.longitude,
          categoryLabel: r.subTag ?? 'Place',
          region: 'detected', // v1 doesn't reverse-geocode reports
          reportDetail: r.detail,
        };
        return rec;
      })
      .filter((r): r is Recommendation => r !== null);
  } catch {
    return [];
  }
}

// --- Trusted by your community (Round 4 — multi-row Row 1) --------------

/**
 * Cross-category community-only feed for the browse-mode "Trusted by
 * your community" row. The differentiator the spec calls for: not
 * "what's nearby" but "what's actively trusted right now."
 *
 * Scoring is a weighted blend, recency-dominant:
 *
 *   score = 0.7 * recency + 0.3 * count
 *
 *   recency = 1 / (1 + daysSince/7)      // 7-day half-life
 *   count   = log10(reports+1) / log10(11)  // saturates near 10 reports
 *
 * Why these weights:
 *   - Recency carries the "actively trusted" framing — the row should
 *     turn over as the community moves. A 30-day-old report with 10
 *     submissions shouldn't outrank a fresh one.
 *   - Count is the corroboration signal — multiple independent
 *     submissions on the same spot are stronger than one.
 *   - There is no curator-override term: CommunityReport has no
 *     curator field. If that becomes a product need, add a
 *     `curatorBoost?: number` field to CommunityReport and fold a
 *     third weighted term in here.
 *
 * Reports are grouped by `samePlace` (normalized name AND ~50m) so two
 * reports on the same storefront compound their count — and accumulate
 * their distinct vouches into `facets` — instead of competing as
 * separate entries, while different-name neighbors within 50m stay
 * distinct. The most-recent report's metadata wins the group's display
 * (freshest placeName / subTag / detail).
 *
 * Returns up to 7 entries, distance-annotated. Empty when no reports
 * route to a known category — caller handles the empty state.
 */
const TRUSTED_RECENCY_WEIGHT = 0.7;
const TRUSTED_COUNT_WEIGHT = 0.3;
const TRUSTED_RECENCY_HALF_LIFE_DAYS = 7;
const TRUSTED_COUNT_SATURATION = 10;
const TRUSTED_RESULT_LIMIT = 7;

export async function getTrustedByCommunity(
  query: { userLocation?: { latitude: number; longitude: number } } = {},
): Promise<Recommendation[]> {
  try {
    const reports = await getCommunityReports();
    if (reports.length === 0) return [];

    // Step 1: map each report to a candidate { rec, timestamp } with
    // proximity gate. Trusted-by-community is intentionally more
    // permissive than `getCommunityRecommendations` (the focus-mode
    // adapter): a felt-welcome report without an identity subTag
    // *does* belong here. The row's job is to surface community
    // vouches — "this place felt welcoming" is the most fundamental
    // vouch in the app, and excluding it because the user opted out
    // of an identity tag would silently drop the strongest signal we
    // have. Subtag-less felt-welcome (and felt-welcome with a place-
    // type subTag like Restaurant) falls through to 'lgbtq-welcoming'
    // as the display category — Heart glyph reads as warm welcome
    // without claiming a specific identity. The category enum is
    // internal-only here, not surfaced to the user. Per-chip focus
    // mode stays strict via `recCategoryForReport`.
    //
    // Black-owned reports always route via `recCategoryForReport`'s
    // first branch, so they don't need a defensive fallback here.
    type Candidate = { rec: Recommendation; timestamp: number; vouch: string };
    const candidates: Candidate[] = [];
    for (const r of reports) {
      const routedCategory = recCategoryForReport(r.categoryId, r.subTag);
      const isGeneralFeltWelcome =
        !routedCategory && r.categoryId === 'felt-welcome';
      if (!routedCategory && !isGeneralFeltWelcome) continue;
      if (query.userLocation) {
        const miles = distanceMilesBetween(query.userLocation, r.location);
        if (miles > COMMUNITY_PROXIMITY_RADIUS_MILES) continue;
      }
      const displayCategory = routedCategory ?? 'lgbtq-welcoming';
      candidates.push({
        rec: {
          id: `community-${r.id}`,
          source: 'community',
          category: displayCategory,
          name: r.placeName ?? r.subTag ?? FALLBACK_NAME_BY_REC_CATEGORY[displayCategory],
          address: '',
          latitude: r.location.latitude,
          longitude: r.location.longitude,
          categoryLabel: r.subTag ?? 'Felt welcome',
          region: 'detected',
          reportDetail: r.detail,
        },
        timestamp: r.timestamp,
        vouch: vouchLabelForReport(r.categoryId, r.subTag),
      });
    }
    if (candidates.length === 0) return [];

    // Step 2: group by samePlace (normalized name AND ~50m), not
    // proximity alone — so different-name neighbors start their own
    // group instead of merging, while the same place reported under
    // multiple categories collapses into one and accumulates its
    // distinct vouches. The `anchor` (first report's name + location)
    // is the fixed reference; the `rec` is the freshest report's
    // display metadata. Decoupling these fixes an order-dependent
    // merging bug — if we re-anchored on every "freshest metadata
    // wins" update, three reports A↔B↔C where A↔C exceeds the match
    // window but A↔B and B↔C don't could end up in one group OR two
    // depending on insertion order. With a fixed anchor, membership is
    // deterministic regardless of arrival order.
    type Group = {
      anchor: { name: string; latitude: number; longitude: number };
      rec: Recommendation;
      count: number;
      mostRecentTs: number;
      vouches: Set<string>;
    };
    const groups: Group[] = [];
    for (const { rec, timestamp, vouch } of candidates) {
      const existing = groups.find((g) => samePlace(g.anchor, rec));
      if (existing) {
        existing.count += 1;
        existing.vouches.add(vouch);
        if (timestamp > existing.mostRecentTs) {
          existing.mostRecentTs = timestamp;
          existing.rec = rec; // freshest metadata wins the display
        }
      } else {
        groups.push({
          anchor: { name: rec.name, latitude: rec.latitude, longitude: rec.longitude },
          rec,
          count: 1,
          mostRecentTs: timestamp,
          vouches: new Set([vouch]),
        });
      }
    }

    // Step 3: score and rank.
    const now = Date.now();
    const countNorm = Math.log10(TRUSTED_COUNT_SATURATION + 1);
    const scored = groups.map((g) => {
      const daysSince = (now - g.mostRecentTs) / (1000 * 60 * 60 * 24);
      const recency = 1 / (1 + daysSince / TRUSTED_RECENCY_HALF_LIFE_DAYS);
      const count = Math.min(1, Math.log10(g.count + 1) / countNorm);
      const score = TRUSTED_RECENCY_WEIGHT * recency + TRUSTED_COUNT_WEIGHT * count;
      // Surface multiple distinct vouches as facets; single-vouch
      // groups leave facets undefined (unchanged card behavior).
      const rec =
        g.vouches.size >= 2 ? { ...g.rec, facets: [...g.vouches] } : g.rec;
      return { rec, score };
    });
    scored.sort((a, b) => b.score - a.score);

    const top = scored.slice(0, TRUSTED_RESULT_LIMIT).map((s) => s.rec);
    return annotateDistance(top, query.userLocation);
  } catch {
    return [];
  }
}

// --- Open now (Round 4 PR B — multi-row Row 2) ---------------------------

/**
 * Utility row for the multi-row browse sheet. Fans across all 5
 * recommendation categories in parallel (reusing the per-category
 * external cache — no extra cost when each category's row also
 * shows below), filters to entries with `isOpen === true`, dedups
 * by ~50m proximity (a place open under multiple chips, e.g. a
 * Black-owned LGBTQ+-welcoming cafe, shouldn't appear twice), and
 * returns top `OPEN_NOW_RESULT_LIMIT` by distance.
 *
 * `isOpen` is currently per-entry static data the curator/external
 * adapter populated; a v2 swap to live-hours would happen at the
 * adapter layer and this row would pick up the change for free.
 */
const OPEN_NOW_RESULT_LIMIT = 7;

const ALL_REC_CATEGORIES: RecommendationCategory[] = [
  'black-owned',
  'women-owned',
  'lgbtq-welcoming',
  'restroom',
  'late-night-warm-welcome',
];

export async function getOpenNow(
  query: { userLocation?: { latitude: number; longitude: number } } = {},
): Promise<Recommendation[]> {
  const { userLocation } = query;
  if (!userLocation) return [];

  try {
    // allSettled — one flaky category (network blip, proxy 502) shouldn't
    // blank the entire Open Now row; partial results still surface signal.
    const settled = await Promise.allSettled(
      ALL_REC_CATEGORIES.map((category) =>
        getExternalRecommendations({ category, userLocation }),
      ),
    );
    const flat: Recommendation[] = settled.flatMap((r) =>
      r.status === 'fulfilled' ? r.value : [],
    );
    const openOnly = flat.filter((r) => r.isOpen === true);
    if (openOnly.length === 0) return [];
    const sorted = sortByDistance(openOnly, userLocation);
    const deduped = dedupBySamePlace(sorted);
    const top = deduped.slice(0, OPEN_NOW_RESULT_LIMIT);
    return annotateDistance(top, userLocation);
  } catch {
    return [];
  }
}

// --- Source 3: External feed (v2 integration point) ----------------------

/**
 * External recommendations — proxied through a Vercel-hosted
 * endpoint that holds the Google Places API key server-side
 * (`proxy/` in this repo). Restroom category routes to OSM
 * Overpass; everything else to Google Places `searchText` with a
 * 10mi locationBias around `userLocation`.
 *
 * If `userLocation` is missing (no GPS fix yet), returns []
 * immediately — the proxy needs lat/lng to do meaningful work.
 *
 * Cached per (geo-grid + category) for 10 minutes. Two reasons:
 * (1) chip-tap latency is much lower for repeated views; (2) we
 * stay polite to the upstream APIs and respect Google's free-tier
 * quota. Geo-grid bucket = ~0.5mi (`Math.round(lat*200)/200`), so
 * users moving < 0.5mi share the cached result.
 */

type CacheEntry = { ts: number; recs: Recommendation[] };
const CACHE_TTL_MS = 10 * 60 * 1000;
const externalCache = new Map<string, CacheEntry>();

function gridKey(lat: number, lng: number): string {
  const round = (n: number) => Math.round(n * 200) / 200;
  return `${round(lat)},${round(lng)}`;
}

async function getExternalRecommendations(
  query: RecommendationQuery,
): Promise<Recommendation[]> {
  const { category, userLocation } = query;
  if (!category || !userLocation) return [];

  const cacheKey = `${gridKey(userLocation.latitude, userLocation.longitude)}|${category}`;
  const cached = externalCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return cached.recs;
  }

  try {
    const url = `${PROXY_RECS_URL}?lat=${userLocation.latitude}&lng=${userLocation.longitude}&category=${category}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = (await res.json()) as { recommendations?: Recommendation[] };
    const recs = data.recommendations ?? [];
    externalCache.set(cacheKey, { ts: Date.now(), recs });
    return recs;
  } catch (e) {
    // Network failure: silently empty so the source merge falls back
    // to community (and ultimately curated). The card renders an
    // empty state if all three sources strike out.
    return [];
  }
}

// --- Dedup ---------------------------------------------------------------

/**
 * Removes same-place duplicates across sources — same NORMALIZED NAME
 * within ~50m (see `samePlace`). Name-aware so two genuinely different
 * businesses within 50m both survive; proximity-only collapsed them and
 * dropped the second. Preserves the first occurrence (curated wins over
 * community wins over external) so the curator's editorial copy always
 * trumps a peer report or external listing of the same place.
 *
 * Tradeoff: a community report whose placeName didn't resolve (generic
 * fallback name) and the external listing of the same place will now
 * BOTH show, where proximity-only merged them. A generic-named duplicate
 * is strictly less bad than two distinct places collapsing to one.
 */
function dedupBySamePlace(recs: Recommendation[]): Recommendation[] {
  const kept: Recommendation[] = [];
  for (const rec of recs) {
    if (!kept.some((k) => samePlace(k, rec))) kept.push(rec);
  }
  return kept;
}

// --- Curated seed --------------------------------------------------------

/**
 * Three entries per category for the Mobile, AL demo region. Real
 * production would curate per city; this is the thesis-demo
 * starting point. Coordinates are real Mobile locations so the
 * routing pipeline gets a meaningful destination on tap. The
 * HomeBrowseSheet picks one at random on each category change so
 * the chip tap visibly cycles content rather than stuck on the
 * same single entry.
 */
const CURATED_CATALOG: Recommendation[] = [
  // --- Black-owned ---------------------------------------------------------
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
  {
    id: 'curated-black-owned-2',
    source: 'curated',
    category: 'black-owned',
    name: 'Spot of Tea',
    address: '310 Dauphin St, Mobile, AL',
    latitude: 30.6927,
    longitude: -88.0418,
    categoryLabel: 'Restaurant',
    curatorName: 'Jordan',
    curatorQuote:
      'Brunch that runs late and a porch worth lingering on. Order the crab cake omelette and a second pot of tea.',
    tags: [{ label: 'Brunch all day', emoji: '🍳' }],
    priceTier: '$$',
    rating: 4.6,
    reviewCount: 412,
    hoursLabel: 'Closes 3 PM',
    isOpen: true,
    region: 'Mobile, AL',
  },
  {
    id: 'curated-black-owned-3',
    source: 'curated',
    category: 'black-owned',
    name: 'Soul Kitchen Music Hall',
    address: '219 Dauphin St, Mobile, AL',
    latitude: 30.6921,
    longitude: -88.0429,
    categoryLabel: 'Music venue',
    curatorName: 'Jordan',
    curatorQuote:
      'The room they built for the show you didn’t know you needed. Black-owned, blues-rooted, every act welcome.',
    tags: [{ label: 'Live music', emoji: '🎷' }],
    priceTier: '$$',
    rating: 4.8,
    reviewCount: 268,
    hoursLabel: 'Open until midnight',
    isOpen: true,
    region: 'Mobile, AL',
  },

  // --- Women-owned ---------------------------------------------------------
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
  {
    id: 'curated-women-owned-2',
    source: 'curated',
    category: 'women-owned',
    name: 'Iron + Ivy Boutique',
    address: '52 N Royal St, Mobile, AL',
    latitude: 30.6940,
    longitude: -88.0410,
    categoryLabel: 'Boutique',
    curatorName: 'Jordan',
    curatorQuote:
      'Curated by someone with taste — the kind of place where the owner remembers what you almost bought last time.',
    tags: [{ label: 'Local designers', emoji: '🧵' }],
    priceTier: '$$',
    rating: 4.7,
    reviewCount: 89,
    hoursLabel: 'Closes 6 PM',
    isOpen: true,
    region: 'Mobile, AL',
  },
  {
    id: 'curated-women-owned-3',
    source: 'curated',
    category: 'women-owned',
    name: 'Bayside Bloom Florist',
    address: '156 S Conception St, Mobile, AL',
    latitude: 30.6907,
    longitude: -88.0431,
    categoryLabel: 'Florist',
    curatorName: 'Jordan',
    curatorQuote:
      'Bring a friend, walk out with something seasonal and unexpected. Cash arrangements always honored.',
    tags: [{ label: 'Walk-ins welcome', emoji: '💐' }],
    priceTier: '$$',
    rating: 4.8,
    reviewCount: 116,
    hoursLabel: 'Closes 5 PM',
    isOpen: true,
    region: 'Mobile, AL',
  },

  // --- LGBTQ+ welcoming ----------------------------------------------------
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
  {
    id: 'curated-lgbtq-2',
    source: 'curated',
    category: 'lgbtq-welcoming',
    name: 'Gallery 54',
    address: '54 S Section St, Fairhope, AL',
    latitude: 30.5239,
    longitude: -87.9028,
    categoryLabel: 'Gallery',
    curatorName: 'Jordan',
    curatorQuote:
      'Quiet, generous space. The openings are mixed crowds and that’s by design — leadership has always made room.',
    tags: [{ label: 'Open openings', emoji: '🖼️' }],
    rating: 4.9,
    reviewCount: 74,
    hoursLabel: 'Closes 5 PM',
    isOpen: true,
    region: 'Mobile, AL',
  },
  {
    id: 'curated-lgbtq-3',
    source: 'curated',
    category: 'lgbtq-welcoming',
    name: 'Cammie’s Old Dutch Ice Cream',
    address: '2511 Old Shell Rd, Mobile, AL',
    latitude: 30.6796,
    longitude: -88.0734,
    categoryLabel: 'Ice cream',
    curatorName: 'Jordan',
    curatorQuote:
      'Bring whoever you’re with, no one is watching. Family flavor, family-friendly, family means whoever you say.',
    tags: [{ label: 'Late scoops', emoji: '🍦' }],
    priceTier: '$1–10',
    rating: 4.8,
    reviewCount: 522,
    hoursLabel: 'Open until 10 PM',
    isOpen: true,
    region: 'Mobile, AL',
  },

  // --- Restroom ------------------------------------------------------------
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
  {
    id: 'curated-restroom-2',
    source: 'curated',
    category: 'restroom',
    name: 'Mobile Public Library (Ben May)',
    address: '701 Government St, Mobile, AL',
    latitude: 30.6889,
    longitude: -88.0445,
    categoryLabel: 'Library restroom',
    curatorName: 'Jordan',
    curatorQuote:
      'Ground floor by the entrance. Staff treats everyone like a regular — because everyone is, kind of.',
    tags: [{ label: 'No purchase needed', emoji: '📚' }],
    hoursLabel: 'Closes 8 PM',
    isOpen: true,
    region: 'Mobile, AL',
  },
  {
    id: 'curated-restroom-3',
    source: 'curated',
    category: 'restroom',
    name: 'Cathedral Square Park Restrooms',
    address: 'Cathedral Square, Mobile, AL',
    latitude: 30.6905,
    longitude: -88.0421,
    categoryLabel: 'Public restroom',
    curatorName: 'Jordan',
    curatorQuote:
      'Right next to where the food trucks line up Fridays. Stop here before you commit to the line.',
    tags: [{ label: 'Near food trucks', emoji: '🚐' }],
    hoursLabel: 'Open until dusk',
    isOpen: true,
    region: 'Mobile, AL',
  },

  // --- Late Night Warm Welcome --------------------------------------------
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
  {
    id: 'curated-late-night-2',
    source: 'curated',
    category: 'late-night-warm-welcome',
    name: 'Callaghan’s Irish Social Club',
    address: '916 Charleston St, Mobile, AL',
    latitude: 30.6829,
    longitude: -88.0509,
    categoryLabel: 'Pub',
    curatorName: 'Jordan',
    curatorQuote:
      'The Lammie burger and a quiet booth at the back. Hosts know every regular but never push.',
    tags: [{ label: 'Kitchen open late', emoji: '🍔' }],
    priceTier: '$$',
    rating: 4.7,
    reviewCount: 894,
    hoursLabel: 'Open until midnight',
    isOpen: true,
    region: 'Mobile, AL',
  },
  {
    id: 'curated-late-night-3',
    source: 'curated',
    category: 'late-night-warm-welcome',
    name: 'Wintzell’s Oyster House',
    address: '605 Dauphin St, Mobile, AL',
    latitude: 30.6928,
    longitude: -88.0452,
    categoryLabel: 'Restaurant',
    curatorName: 'Jordan',
    curatorQuote:
      'Lit lot, big windows, the kind of place a long drive can end at without feeling like an imposition.',
    tags: [{ label: 'Easy parking', emoji: '🅿️' }],
    priceTier: '$$',
    rating: 4.5,
    reviewCount: 1147,
    hoursLabel: 'Open until 10 PM',
    isOpen: true,
    region: 'Mobile, AL',
  },
];
