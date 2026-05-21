import { useEffect, useState } from 'react';

import {
  getOpenNow,
  getRecommendations,
  getTrustedByCommunity,
  type Recommendation,
  type RecommendationCategory,
} from '../lib/api/recommendations';

/**
 * Per-row spec for the multi-row recommendations sheet. The
 * Trusted-by-community + Open-now rows are cross-category aggregators
 * with their own adapters; the per-category rows are thin wrappers
 * around the standard `getRecommendations` adapter scoped to one
 * category.
 */
export type BrowseRowKind =
  | { kind: 'trusted-community' }
  | { kind: 'open-now' }
  | { kind: 'category'; category: RecommendationCategory };

export type BrowseRowSpec = BrowseRowKind & {
  /** Stable identifier so React can key per-row state across reorders. */
  key: string;
};

export type BrowseRowResult = {
  key: string;
  recommendations: Recommendation[];
  loading: boolean;
};

/**
 * Batched per-row fetcher for the home browse sheet. Fires each row's
 * data source in parallel; each row resolves independently and
 * `setState`s its own slot so a slow row doesn't block faster ones.
 *
 * The geo-grid rounding (`Math.round(lat * 200) / 200`, ~0.5mi)
 * matches `useRecommendations` + `useTrustedByCommunity` + the
 * `externalCache` key so a user moving sub-grid distances doesn't
 * trigger 7 simultaneous re-fetches.
 *
 * `refreshKey` ticks on /home focus (per app/home.tsx's
 * `focusRefreshKey`) so newly-submitted community reports surface
 * across all rows that depend on them without crossing a grid bucket.
 */
export function useRecommendationsBatch(opts: {
  rows: BrowseRowSpec[];
  userLocation?: { latitude: number; longitude: number } | null;
  refreshKey?: number;
}) {
  const { rows, userLocation, refreshKey } = opts;
  const [byKey, setByKey] = useState<Record<string, BrowseRowResult>>(() =>
    initialState(rows),
  );

  const gridLat = userLocation
    ? Math.round(userLocation.latitude * 200) / 200
    : null;
  const gridLng = userLocation
    ? Math.round(userLocation.longitude * 200) / 200
    : null;
  // Dep-array signature for the rows array — the array identity is
  // unstable across renders (callers usually inline-define it), so
  // we key on a stringified shape instead.
  const rowsSig = rows.map((r) => r.key).join('|');

  useEffect(() => {
    // Only flip `loading: true` for rows with no cached data — rows that
    // already rendered cards keep showing them through the refresh so
    // we don't skeleton-flash on every grid-key change or focus tick.
    // The per-row async closures below will replace the data once it lands.
    setByKey((prev) => {
      const next: Record<string, BrowseRowResult> = { ...prev };
      for (const row of rows) {
        const prevRecs = prev[row.key]?.recommendations ?? [];
        next[row.key] = {
          key: row.key,
          recommendations: prevRecs,
          loading: prevRecs.length === 0,
        };
      }
      return next;
    });

    let cancelled = false;
    for (const row of rows) {
      (async () => {
        const recs = await fetchForRow(row, userLocation);
        if (cancelled) return;
        setByKey((prev) => ({
          ...prev,
          [row.key]: { key: row.key, recommendations: recs, loading: false },
        }));
      })();
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowsSig, gridLat, gridLng, refreshKey]);

  return { byKey };
}

function initialState(rows: BrowseRowSpec[]): Record<string, BrowseRowResult> {
  const out: Record<string, BrowseRowResult> = {};
  for (const row of rows) {
    out[row.key] = { key: row.key, recommendations: [], loading: true };
  }
  return out;
}

async function fetchForRow(
  row: BrowseRowSpec,
  userLocation?: { latitude: number; longitude: number } | null,
): Promise<Recommendation[]> {
  const loc = userLocation ?? undefined;
  switch (row.kind) {
    case 'trusted-community':
      return getTrustedByCommunity({ userLocation: loc });
    case 'open-now':
      return getOpenNow({ userLocation: loc });
    case 'category':
      return getRecommendations({ category: row.category, userLocation: loc });
  }
}
