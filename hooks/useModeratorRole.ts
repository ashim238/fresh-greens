import { useCallback, useEffect, useState } from 'react';

import { getAuthHeaders, getAuthUserId } from '../lib/supabase-auth';
import { isCommunityCloudConfigured } from '../lib/api/sources/community-cloud';

export function useModeratorRole(): {
  isModerator: boolean;
  loading: boolean;
  refresh: () => void;
} {
  const [isModerator, setIsModerator] = useState(false);
  const [loading, setLoading] = useState(true);

  const check = useCallback(async () => {
    if (!isCommunityCloudConfigured()) {
      setLoading(false);
      return;
    }
    const userId = await getAuthUserId();
    if (!userId) {
      setLoading(false);
      return;
    }
    try {
      const headers = await getAuthHeaders();
      const base = process.env.EXPO_PUBLIC_SUPABASE_URL!.replace(/\/$/, '');
      const url = `${base}/rest/v1/user_roles?user_id=eq.${userId}&role=eq.moderator&select=user_id&limit=1`;
      const res = await fetch(url, { headers });
      if (res.ok) {
        const rows = await res.json();
        setIsModerator(Array.isArray(rows) && rows.length > 0);
      }
    } catch {
      // Network failure — default to non-moderator
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void check();
  }, [check]);

  return { isModerator, loading, refresh: check };
}
