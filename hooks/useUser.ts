import * as AppleAuthentication from 'expo-apple-authentication';
import { useCallback, useEffect, useState } from 'react';

import {
  clearStoredUser,
  getStoredUser,
  updateUserProfile,
  upsertUser,
  type User,
} from '../lib/api/user';

/**
 * Reactive wrapper around the user adapter. Loads the stored user on
 * mount, exposes sign-in / sign-out helpers, and a `loading` flag for
 * the brief window while AsyncStorage is being read.
 *
 * Usage:
 *   const { user, loading, signInWithApple, signOut } = useUser();
 *
 * `signInWithApple` resolves to the freshly-stored User on success and
 * throws on failure. The caller is responsible for navigation choices
 * (route to /home for returning users, /onboarding for first-time
 * users) — the hook keeps no opinion on flow, just identity.
 *
 * Note: this hook is local-only today. Each consumer reads its own
 * snapshot; cross-screen invalidation isn't wired up. That's fine while
 * the only places that read user are the screens that mount in response
 * to user state changes (Welcome → /home, /get-started after sign-in,
 * etc). When Settings + a real backend land, this will probably become
 * a context provider so the user object is one place in the tree.
 */
export function useUser() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = await getStoredUser();
      if (!cancelled) {
        setUser(stored);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const signInWithApple = useCallback(async (): Promise<User> => {
    // Apple's response includes fullName + email ONLY on the first
    // sign-in to this app — subsequent sign-ins return only `user`
    // (the stable identifier). upsertUser merges with any cached
    // values so returning users keep their displayName + initials.
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });

    const displayName = credential.fullName
      ? [credential.fullName.givenName, credential.fullName.familyName]
          .filter(Boolean)
          .join(' ') || null
      : null;

    const stored = await upsertUser({
      id: credential.user,
      provider: 'apple',
      displayName,
      email: credential.email ?? null,
    });

    setUser(stored);
    return stored;
  }, []);

  const signOut = useCallback(async () => {
    await clearStoredUser();
    setUser(null);
  }, []);

  /**
   * Edit the display name and/or avatar photo. No-op (returns null) if
   * nobody's signed in. Reflects the change into local state so the
   * /menu profile card updates immediately.
   */
  const updateProfile = useCallback(
    async (patch: { displayName?: string | null; avatarUri?: string | null }) => {
      const updated = await updateUserProfile(patch);
      if (updated) setUser(updated);
      return updated;
    },
    [],
  );

  return { user, loading, signInWithApple, signOut, updateProfile };
}
