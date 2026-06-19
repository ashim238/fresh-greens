import { useCallback } from 'react';

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
import { useHydratedState } from './useHydratedState';

export type StartShareSessionInput = {
  type: ShareSessionType;
  reason: string;
  locationLabel?: string;
  coordinates?: { latitude: number; longitude: number };
};

type ShareSessionWrites = {
  startSession: (input: StartShareSessionInput) => Promise<ShareSession>;
  resendSessionSms: (
    extras?: Pick<NotifyTrustedContactInput, 'locationLabel' | 'coordinates'>,
  ) => Promise<void>;
  endSession: () => Promise<void>;
};

export type ShareSessionState = ShareSessionWrites &
  ({ ready: false } | { ready: true; session: ShareSession | null });

/**
 * Reactive wrapper around the share-session adapter. Single global active
 * session at a time (one Unfamiliar OR one Share Location, never both).
 * Re-reads on focus so a session started from another screen surfaces
 * without a remount.
 *
 * startSession persists the session then auto-opens Messages with a
 * pre-filled text to the trusted contact (user taps Send in Messages).
 */
export function useShareSession(): ShareSessionState {
  const hydrated = useHydratedState<ShareSession | null>(getStoredShareSession);
  // Derived at render so resendSessionSms can close over an already-narrowed
  // value (deps on currentSession keep the callback fresh when it changes).
  const currentSession = hydrated.ready ? hydrated.data : null;

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
      hydrated.setData(withSms);
      await setStoredShareSession(withSms);
      return withSms;
    },
    [hydrated.setData],
  );

  const startSession = useCallback(
    async (input: StartShareSessionInput): Promise<ShareSession> => {
      const next: ShareSession = {
        id: `${input.type}-${Date.now()}`,
        type: input.type,
        reason: input.reason,
        startedAtIso: new Date().toISOString(),
      };
      hydrated.setData(next);
      await setStoredShareSession(next);
      return openSmsForSession(next, {
        locationLabel: input.locationLabel,
        coordinates: input.coordinates,
      });
    },
    [hydrated.setData, openSmsForSession],
  );

  const resendSessionSms = useCallback(
    async (extras?: Pick<NotifyTrustedContactInput, 'locationLabel' | 'coordinates'>) => {
      if (!currentSession) return;
      await openSmsForSession(currentSession, extras);
    },
    [currentSession, openSmsForSession],
  );

  const endSession = useCallback(async () => {
    hydrated.setData(null);
    await clearStoredShareSession();
  }, [hydrated.setData]);

  if (!hydrated.ready) {
    return { ready: false, startSession, resendSessionSms, endSession };
  }
  return { ready: true, session: currentSession, startSession, resendSessionSms, endSession };
}
