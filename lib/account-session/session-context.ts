import { createContext, useContext } from 'react';

import type { User, UserProfilePatch } from '../api/user';
import type { AccountPurgeFailure } from './purge-coordinator';

export type SessionPhase =
  | 'hydrating'
  | 'sessionError'
  | 'authenticated'
  | 'signingOut'
  | 'cleanupFailed'
  | 'signedOut';

export type PurgeFailureSummary = {
  failures: AccountPurgeFailure[];
  canFinishOnDevice: boolean;
};

export type SessionContextValue = {
  phase: SessionPhase;
  user: User | null;
  failure: PurgeFailureSummary | null;
  sessionError: Error | null;
  signOutCompletion: 'confirmed' | 'local-only' | null;
  sessionGeneration: number;
  signInWithApple(): Promise<{ user: User; wasReturning: boolean }>;
  signInAsDevUser(): Promise<User>;
  beginSignOut(): Promise<void>;
  retryCleanup(): Promise<void>;
  finishOnDevice(): Promise<void>;
  retrySessionHydration(): Promise<void>;
  updateProfile(patch: UserProfilePatch): Promise<User | null>;
};

export class SessionUnavailableError extends Error {
  constructor(message = 'The account session is not available') {
    super(message);
    this.name = 'SessionUnavailableError';
  }
}

export const SessionContext = createContext<SessionContextValue | null>(null);

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext);
  if (!value) {
    throw new SessionUnavailableError(
      'useSession must be used within SessionProvider',
    );
  }
  return value;
}

/** Shared primitives can retain legacy generation zero in isolated tests. */
export function useSessionGeneration(): number {
  return useContext(SessionContext)?.sessionGeneration ?? 0;
}
