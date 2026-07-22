import { useCallback, useEffect, useRef, useState } from 'react';

import { backendAuthRepository } from '../lib/supabase/auth-repository';
import { rolesRepository } from '../lib/supabase/roles-repository';

export function useModeratorRole(): {
  isModerator: boolean;
  loading: boolean;
  refresh: () => void;
} {
  const [isModerator, setIsModerator] = useState(false);
  const [loading, setLoading] = useState(true);
  const requestToken = useRef(0);

  const checkRole = useCallback(async (userId: string, token: number) => {
    try {
      const moderator = await rolesRepository.hasModeratorRole(userId);
      if (requestToken.current === token) setIsModerator(moderator);
    } catch {
      if (requestToken.current === token) setIsModerator(false);
    } finally {
      if (requestToken.current === token) setLoading(false);
    }
  }, []);

  const check = useCallback(async () => {
    const token = ++requestToken.current;
    setIsModerator(false);
    setLoading(true);
    try {
      const userId = await backendAuthRepository.getUserId();
      if (requestToken.current !== token) return;
      if (!userId) {
        setLoading(false);
        return;
      }
      await checkRole(userId, token);
    } catch {
      if (requestToken.current === token) {
        setIsModerator(false);
        setLoading(false);
      }
    }
  }, [checkRole]);

  useEffect(() => {
    void check();
    const unsubscribe = backendAuthRepository.subscribe((state) => {
      const token = ++requestToken.current;
      setIsModerator(false);
      if (state.kind !== 'authenticated') {
        setLoading(false);
        return;
      }
      setLoading(true);
      void checkRole(state.session.user.id, token);
    });

    return () => {
      requestToken.current += 1;
      unsubscribe();
    };
  }, [check, checkRole]);

  return { isModerator, loading, refresh: check };
}
