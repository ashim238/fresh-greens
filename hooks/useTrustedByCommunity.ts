import { useEffect, useState } from 'react';

import {
  getTrustedByCommunity,
  type Recommendation,
} from '../lib/api/recommendations';

/**
 * Reactive wrapper around `getTrustedByCommunity`. Loads on mount,
 * re-runs when the user moves between geo-grid buckets (~0.5mi) and
 * whenever the underlying community-reports store may have changed
 * (caller passes `refreshKey` — typically a focus-effect counter on
 * /home that ticks after the user submits a report).
 *
 * Pattern mirrors `useRecommendations`: rounded lat/lng deps so
 * sub-grid GPS jitter doesn't refetch.
 */
export function useTrustedByCommunity(opts: {
  userLocation?: { latitude: number; longitude: number } | null;
  refreshKey?: number;
} = {}) {
  const { userLocation, refreshKey } = opts;
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);

  const gridLat = userLocation ? Math.round(userLocation.latitude * 200) / 200 : null;
  const gridLng = userLocation ? Math.round(userLocation.longitude * 200) / 200 : null;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const recs = await getTrustedByCommunity({
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
  }, [gridLat, gridLng, refreshKey]);

  return { recommendations, loading };
}
