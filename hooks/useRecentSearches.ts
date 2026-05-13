import { useCallback, useEffect, useState } from 'react';

import {
  addRecentSearch as addRecentSearchToStore,
  clearRecentSearches as clearRecentSearchesFromStore,
  getRecentSearches,
  removeRecentSearch as removeRecentSearchFromStore,
  type RecentSearch,
} from '../lib/api/recent-searches';

/**
 * Reactive wrapper around the recent-searches adapter. Same shape
 * as useSavedPlaces / useTrustedContact / useRecordings — load on
 * mount, expose add/remove/clear that update both AsyncStorage and
 * local state so the UI re-renders without a manual refetch.
 */
export function useRecentSearches() {
  const [recents, setRecents] = useState<RecentSearch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = await getRecentSearches();
      if (!cancelled) {
        setRecents(stored);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const addRecent = useCallback(
    async (input: Omit<RecentSearch, 'savedAt'>): Promise<void> => {
      const record = await addRecentSearchToStore(input);
      // Mirror the adapter's dedup + cap behavior in local state so
      // the UI doesn't have to wait for a refetch to see the change.
      setRecents((prev) => {
        const MAX = 8;
        const filtered = prev.filter((r) => r.id !== record.id);
        return [record, ...filtered].slice(0, MAX);
      });
    },
    [],
  );

  const removeRecent = useCallback(async (id: string): Promise<void> => {
    await removeRecentSearchFromStore(id);
    setRecents((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const clearRecents = useCallback(async (): Promise<void> => {
    await clearRecentSearchesFromStore();
    setRecents([]);
  }, []);

  return { recents, loading, addRecent, removeRecent, clearRecents };
}
