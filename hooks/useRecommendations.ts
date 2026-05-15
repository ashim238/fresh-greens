import { useEffect, useState } from 'react';

import {
  getRecommendations,
  type Recommendation,
  type RecommendationCategory,
} from '../lib/api/recommendations';

/**
 * Reactive wrapper around the recommendations adapter. Same shape as
 * useRecentSearches / useSavedPlaces / useTrustedContact — loads on
 * mount, re-runs when the category filter changes.
 *
 * `category` filters server-side via the adapter. `region` is
 * accepted but not yet wired to a reverse-geocode call — v1
 * defaults to whatever the curated catalog returns. v2 hook would
 * accept the user's current lat/lng and reverse-geocode to a region
 * string before passing it to the adapter.
 */
export function useRecommendations(opts: {
  category?: RecommendationCategory;
  region?: string;
} = {}) {
  const { category, region } = opts;
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const recs = await getRecommendations({ category, region });
      if (!cancelled) {
        setRecommendations(recs);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [category, region]);

  return { recommendations, loading };
}
