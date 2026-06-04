import { useCallback, useState } from 'react';

import { useFocusEffect } from 'expo-router';

import { getTrustedContact } from '../lib/api/trusted-contact';
import {
  clearStoredShareSession,
  getStoredShareSession,
  type ShareSession,
  type ShareSessionType,
  setStoredShareSession,
} from '../lib/api/share-session';
import {
  notifyTrustedContact,
  readNotifyCoordinates,
  type NotifyTrustedContactInput,
} from '../lib/notify-trusted-contact';

export type StartShareSessionInput = {
  type: ShareSessionType;
  reason: string;
  locationLabel?: string;
  coordinates?: { latitude: number; longitude: number };
};

/**
 * Reactive wrapper around the share-session adapter. Single global active
 * session at a time (one Unfamiliar OR one Share Location, never both).
 * Re-reads on focus so a session started from another screen surfaces
 * without a remount.
 *
 * startSession persists the session then auto-opens Messages with a
 * pre-filled text to the trusted contact (user taps Send in Messages).
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

  const openSmsForSession = useCallback(
    async (
      active: ShareSession,
      extras?: Pick<NotifyTrustedContactInput, 'locationLabel' | 'coordinates'>,
    ): Promise<ShareSession> => {
      const contact = await getTrustedContact();
      let coordinates = extras?.coordinates;
      let locationLabel = extras?.locationLabel;
      if (!coordinates) {
        const geo = await readNotifyCoordinates();
        coordinates = geo.coordinates;
        locationLabel = locationLabel ?? geo.locationLabel;
      }
      const result = await notifyTrustedContact(contact, {
        flow: active.type,
        reason: active.reason,
        locationLabel,
        coordinates,
      });
      if (!result.notifiedAtIso) return active;
      const withSms: ShareSession = {
        ...active,
        smsOpenedAtIso: result.notifiedAtIso,
      };
      setSession(withSms);
      await setStoredShareSession(withSms);
      return withSms;
    },
    [],
  );

  const startSession = useCallback(
    async (input: StartShareSessionInput): Promise<ShareSession> => {
      const next: ShareSession = {
        id: `${input.type}-${Date.now()}`,
        type: input.type,
        reason: input.reason,
        startedAtIso: new Date().toISOString(),
      };
      setSession(next);
      await setStoredShareSession(next);
      return openSmsForSession(next, {
        locationLabel: input.locationLabel,
        coordinates: input.coordinates,
      });
    },
    [openSmsForSession],
  );

  const resendSessionSms = useCallback(
    async (
      extras?: Pick<NotifyTrustedContactInput, 'locationLabel' | 'coordinates'>,
    ) => {
      if (!session) return;
      await openSmsForSession(session, extras);
    },
    [session, openSmsForSession],
  );

  const endSession = useCallback(async () => {
    setSession(null);
    await clearStoredShareSession();
  }, []);

  return { session, loading, startSession, resendSessionSms, endSession };
}
