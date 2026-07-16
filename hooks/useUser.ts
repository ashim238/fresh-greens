import { useCallback } from 'react';

import { useSession } from '../lib/account-session/session-provider';
import type { UserProfilePatch } from '../lib/api/user';

/**
 * Compatibility view over the root session authority. This hook intentionally
 * owns no state: every caller sees the same user, phase, and generation.
 */
export function useUser() {
  const session = useSession();

  const signInWithApple = useCallback(async () => {
    const result = await session.signInWithApple();
    return result.user;
  }, [session.signInWithApple]);

  const signOut = useCallback(
    () => session.beginSignOut(),
    [session.beginSignOut],
  );

  const updateProfile = useCallback(
    (patch: UserProfilePatch) => session.updateProfile(patch),
    [session.updateProfile],
  );

  return {
    user: session.user,
    loading: session.phase === 'hydrating',
    phase: session.phase,
    failure: session.failure,
    signOutCompletion: session.signOutCompletion,
    sessionGeneration: session.sessionGeneration,
    signInWithApple,
    signInAsDevUser: session.signInAsDevUser,
    signOut,
    updateProfile,
  };
}
