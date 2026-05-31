import { useCallback, useState } from 'react';

import { useFocusEffect } from 'expo-router';

import {
  clearStoredShareSession,
  getStoredShareSession,
  type ShareSession,
  type ShareSessionType,
  setStoredShareSession,
} from '../lib/api/share-session';

/**
 * Reactive wrapper around the share-session adapter. Single global active
 * session at a time (one Unfamiliar OR one Share Location, never both).
 * Re-reads on focus so a session started from another screen surfaces
 * without a remount.
 *
 * Same shape as useRoadsideProfile / useFuelProfile / useTrustedContact —
 * `loading` only flips false (never back to true on refocus) to avoid a flash.
 */
export function useShareSession() {
  const [session, setSession] = useState<ShareSession | null>(null);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const stored = await getStoredShareSession();
        if (!cancelled) {
          setSession(stored);
          setLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, []),
  );

  // Starts (or replaces) the active session. Caller is responsible for
  // preventing accidental cross-tile replacement — see /safety's guards.
  const startSession = useCallback(
    async (input: { type: ShareSessionType; reason: string }): Promise<ShareSession> => {
      const next: ShareSession = {
        id: `${input.type}-${Date.now()}`,
        type: input.type,
        reason: input.reason,
        startedAtIso: new Date().toISOString(),
      };
      setSession(next);
      await setStoredShareSession(next);
      return next;
    },
    [],
  );

  const endSession = useCallback(async () => {
    setSession(null);
    await clearStoredShareSession();
  }, []);

  return { session, loading, startSession, endSession };
}
