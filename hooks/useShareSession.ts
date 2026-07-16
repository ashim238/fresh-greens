import { useCallback, useRef } from 'react';

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
import { useMutation, type Mutation } from './useMutation';

export type StartShareSessionInput = {
  type: ShareSessionType;
  reason: string;
  locationLabel?: string;
  coordinates?: { latitude: number; longitude: number };
};

type ShareSessionMutations = {
  start: Mutation<StartShareSessionInput, ShareSession>;
  end: Mutation<void, void>;
  resend: Mutation<
    Pick<NotifyTrustedContactInput, 'locationLabel' | 'coordinates'> | undefined,
    void
  >;
};

export type ShareSessionState = ShareSessionMutations &
  ({ ready: false } | { ready: true; session: ShareSession | null });

/**
 * Reactive wrapper around the share-session adapter. Single global active
 * session at a time (one Unfamiliar OR one Share Location, never both).
 * Re-reads on focus so a session started from another screen surfaces
 * without a remount.
 *
 * start, end, and resend are Mutation objects — callers must await `.run()`
 * and narrow the discriminated MutationResult before proceeding.
 *
 * start auto-opens Messages with a pre-filled text to the trusted contact
 * (user taps Send in Messages), then persists the session only after the
 * draft opens.
 */
export function useShareSession(): ShareSessionState {
  const hydrated = useHydratedState<ShareSession | null>(getStoredShareSession);
  // Derived at render so resend can close over an already-narrowed
  // value (deps on currentSession keep the callback fresh when it changes).
  const currentSession = hydrated.ready ? hydrated.data : null;
  // Shared id between onOptimistic and startPersist so both sides of the
  // mutation use the same value (prevents ghost-session resurrection on rollback).
  const pendingStartIdRef = useRef<string | null>(null);

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
      if (!result.opened) {
        throw new Error('Messages draft could not be opened');
      }
      const withSms: ShareSession = {
        ...active,
        smsOpenedAtIso: result.openedAtIso,
      };
      hydrated.setData(withSms);
      await setStoredShareSession(withSms);
      return withSms;
    },
    [hydrated.setData],
  );

  // start persist: build the session, open SMS, then persist only if
  // Messages accepted the draft. Failed draft opens roll back the
  // optimistic state and leave no ghost active session in storage.
  const startPersist = useCallback(
    async (input: StartShareSessionInput): Promise<ShareSession> => {
      // Use the id seeded by onOptimistic so the optimistic and the
      // persisted record share the same id (prevents ghost-session
      // resurrection if the SMS-open step fails after storage write).
      const id = pendingStartIdRef.current ?? `${input.type}-${Date.now()}`;
      pendingStartIdRef.current = null;
      const next: ShareSession = {
        id,
        type: input.type,
        reason: input.reason,
        startedAtIso: new Date().toISOString(),
      };
      return openSmsForSession(next, {
        locationLabel: input.locationLabel,
        coordinates: input.coordinates,
      });
    },
    [openSmsForSession],
  );

  const start = useMutation(startPersist, {
    onOptimistic: (input) => {
      const prev = currentSession;
      const id = `${input.type}-${Date.now()}`;
      pendingStartIdRef.current = id;
      const next: ShareSession = {
        id,
        type: input.type,
        reason: input.reason,
        startedAtIso: new Date().toISOString(),
      };
      hydrated.setData(next);
      return () => {
        pendingStartIdRef.current = null;
        hydrated.setData(prev);
      };
    },
  });

  const endPersist = useCallback(async () => {
    await clearStoredShareSession();
  }, []);

  const end = useMutation(endPersist, {
    onOptimistic: () => {
      const prev = currentSession;
      hydrated.setData(null);
      return () => {
        hydrated.setData(prev);
      };
    },
  });

  const resendPersist = useCallback(
    async (
      extras?: Pick<NotifyTrustedContactInput, 'locationLabel' | 'coordinates'>,
    ): Promise<void> => {
      // Silent early return on no-session — matches original behavior;
      // callers fire-and-forget via `void resend.run(undefined)`. A throw
      // here would be silently discarded, promising error handling the
      // callers don't provide.
      if (!currentSession) return;
      await openSmsForSession(currentSession, extras);
    },
    [currentSession, openSmsForSession],
  );

  const resend = useMutation(resendPersist);

  if (!hydrated.ready) {
    return { ready: false, start, end, resend };
  }
  return {
    ready: true,
    session: currentSession,
    start,
    end,
    resend,
  };
}
