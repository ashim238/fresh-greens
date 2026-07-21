import { useCallback, useEffect, useState } from 'react';

import { backendAuthRepository } from '../lib/supabase/auth-repository';
import { rolesRepository } from '../lib/supabase/roles-repository';

export function useModeratorRole(): {
  isModerator: boolean;
  loading: boolean;
  refresh: () => void;
} {
  const [isModerator, setIsModerator] = useState(false);
  const [loading, setLoading] = useState(true);

  const check = useCallback(async () => {
    try {
      const userId = await backendAuthRepository.getUserId();
      setIsModerator(
        userId ? await rolesRepository.hasModeratorRole(userId) : false,
      );
    } catch {
      setIsModerator(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void check();
  }, [check]);

  return { isModerator, loading, refresh: check };
}
