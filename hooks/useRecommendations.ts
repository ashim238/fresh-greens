import { useEffect, useState } from 'react';

import {
  getRecommendations,
  type Recommendation,
  type RecommendationCategory,
} from '../lib/api/recommendations';

/**
 * Reactive wrapper around the recommendations adapter. Loads on
 * mount, re-runs when category / region / userLocation change.
 *
 * `userLocation` flows through to the adapter for three uses:
 *   1. Proximity filter on community submissions (10mi radius —
 *      far-away contributions don't compete for chip real estate)
 *   2. External-source proxy call (Google Places searchText with a
 *      10mi locationBias around the user)
 *   3. Per-entry `distanceMiles` for the card's "0.7 mi away" pill
 *
 * The hook reads from a rounded geo-grid key on the adapter side,
 * so jittery GPS coordinates within ~0.5mi don't bust the cache.
 */
export function useRecommendations(opts: {
  category?: RecommendationCategory;
  region?: string;
  userLocation?: { latitude: number; longitude: number } | null;
} = {}) {
  const { category, region, userLocation } = opts;
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);

  // Round the GPS coord for the effect dep so sub-grid jitter
  // doesn't cause an unnecessary refetch. The adapter's own
  // geo-grid cache key uses the same rounding strategy.
  const gridLat = userLocation ? Math.round(userLocation.latitude * 200) / 200 : null;
  const gridLng = userLocation ? Math.round(userLocation.longitude * 200) / 200 : null;

  useEffect(() => {
    // No category = no fetch. `getRecommendations` will technically
    // return a merged-catalog shape when category is undefined, but
    // no caller of this hook wants that shape — the only consumer
    // (HomeBrowseSheet) renders per-category carousels in focus mode
    // and reads from `useRecommendationsBatch` in browse mode. Firing
    // a pointless community-reports read on every browse-mode mount
    // was a real perf wart caught in the Round 4 PR-A audit.
    if (!category) {
      setRecommendations([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const recs = await getRecommendations({
        category,
        region,
        userLocation: userLocation ?? undefined,
      });
      if (!cancelled) {
        setRecommendations(recs);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, region, gridLat, gridLng]);

  return { recommendations, loading };
}
