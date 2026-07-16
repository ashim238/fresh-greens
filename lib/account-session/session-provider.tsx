import * as AppleAuthentication from 'expo-apple-authentication';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';

import {
  getStoredUser,
  updateStoredUserProfile,
  upsertUser,
  type User,
  type UserProfilePatch,
} from '../api/user';
import { supabaseCloudSessionOwner } from '../cloud-session';
import {
  accountPurgeCoordinator,
  type AccountPurgeResult,
} from './purge-coordinator';
import { readPendingAccountPurge } from './purge-marker';
import {
  accountOperationGate,
  assertAccountOperationOpen,
} from './operation-gate';
import {
  SessionContext,
  SessionUnavailableError,
  type PurgeFailureSummary,
  type SessionContextValue,
  type SessionPhase,
} from './session-context';

export {
  SessionUnavailableError,
  useSession,
  useSessionGeneration,
} from './session-context';
export type {
  PurgeFailureSummary,
  SessionContextValue,
  SessionPhase,
} from './session-context';

const ACCOUNT_OPERATION_DRAIN_TIMEOUT_MS = 2_000;

function failureSummary(
  failures: PurgeFailureSummary['failures'],
): PurgeFailureSummary {
  return {
    failures,
    canFinishOnDevice:
      failures.length === 1 &&
      failures[0].id === 'auth.supabase' &&
      failures[0].scope === 'remote' &&
      failures[0].retryable,
  };
}

function appleDisplayName(
  fullName: AppleAuthentication.AppleAuthenticationFullName | null,
): string | null {
  if (!fullName) return null;
  return [fullName.givenName, fullName.familyName]
    .filter(Boolean)
    .join(' ') || null;
}

export function SessionProvider({ children }: PropsWithChildren) {
  const [phase, setPhase] = useState<SessionPhase>('hydrating');
  const [user, setUser] = useState<User | null>(null);
  const [failure, setFailure] = useState<PurgeFailureSummary | null>(null);
  const [sessionError, setSessionError] = useState<Error | null>(null);
  const [signOutCompletion, setSignOutCompletion] = useState<
    'confirmed' | 'local-only' | null
  >(null);
  const [sessionGeneration, setSessionGeneration] = useState(0);
  const sessionGenerationRef = useRef(sessionGeneration);
  sessionGenerationRef.current = sessionGeneration;

  const drainCurrentOperations = useCallback(async () => {
    const generation = sessionGenerationRef.current;
    accountOperationGate.seal(generation);
    const result = await accountOperationGate.drain(
      generation,
      ACCOUNT_OPERATION_DRAIN_TIMEOUT_MS,
    );
    if (result.kind === 'timed-out') {
      throw new SessionUnavailableError(
        'Account cleanup is waiting for an unfinished operation',
      );
    }
  }, []);

  const enterQuarantineAndDrain = useCallback(async () => {
    setUser(null);
    setFailure(null);
    setSignOutCompletion(null);
    setPhase('signingOut');
    await drainCurrentOperations();
  }, [drainCurrentOperations]);

  const applyPurgeResult = useCallback((result: AccountPurgeResult) => {
    if (result.status === 'failed') {
      setFailure(failureSummary(result.failures));
      setPhase('cleanupFailed');
      return;
    }
    setUser(null);
    setFailure(null);
    setSessionError(null);
    setSignOutCompletion(result.status === 'completed-locally'
      ? 'local-only'
      : result.status === 'completed'
        ? 'confirmed'
        : null);
    const nextGeneration = sessionGenerationRef.current + 1;
    accountOperationGate.open(nextGeneration);
    sessionGenerationRef.current = nextGeneration;
    setSessionGeneration(nextGeneration);
    setPhase('signedOut');
  }, []);

  const openHydratedSession = useCallback((storedUser: User | null) => {
    const nextGeneration = sessionGenerationRef.current + 1;
    accountOperationGate.open(nextGeneration);
    sessionGenerationRef.current = nextGeneration;
    setSessionGeneration(nextGeneration);
    setUser(storedUser);
    setFailure(null);
    setSessionError(null);
    setPhase(storedUser ? 'authenticated' : 'signedOut');
  }, []);

  const hydrateSession = useCallback(async (preserveSessionError = false) => {
    setPhase('hydrating');
    setUser(null);
    setFailure(null);
    if (!preserveSessionError) setSessionError(null);

    await drainCurrentOperations();
    const pendingPurge = await readPendingAccountPurge();
    if (pendingPurge) {
      setPhase('signingOut');
      applyPurgeResult(await accountPurgeCoordinator.recover());
      return;
    }

    const storedUser = await getStoredUser();
    const cloudSession = await supabaseCloudSessionOwner.hydrateLocalSession();
    if (!storedUser && cloudSession.kind === 'found') {
      const result = await accountPurgeCoordinator.begin(async () => {
        await enterQuarantineAndDrain();
      });
      applyPurgeResult(result);
      return;
    }

    openHydratedSession(storedUser);
  }, [
    applyPurgeResult,
    drainCurrentOperations,
    enterQuarantineAndDrain,
    openHydratedSession,
  ]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        await hydrateSession();
      } catch (error) {
        if (cancelled) return;
        setUser(null);
        setSessionError(
          error instanceof Error ? error : new SessionUnavailableError(),
        );
        setPhase('sessionError');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [hydrateSession]);

  useEffect(() => {
    if (phase !== 'authenticated') return;
    const controller = new AbortController();

    void (async () => {
      try {
        await supabaseCloudSessionOwner.ensureSession(controller.signal);
      } catch (error) {
        if (!controller.signal.aborted) {
          console.warn('Cloud session start failed', error);
        }
      }
    })();

    return () => controller.abort();
  }, [phase, sessionGeneration]);

  const signInWithApple = useCallback(async () => {
    if (phase !== 'signedOut') throw new SessionUnavailableError();
    const existing = await getStoredUser();
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
    const signedInUser = await upsertUser({
      id: credential.user,
      provider: 'apple',
      displayName: appleDisplayName(credential.fullName),
      email: credential.email ?? null,
    });

    setUser(signedInUser);
    setFailure(null);
    setSignOutCompletion(null);
    const nextGeneration = sessionGenerationRef.current + 1;
    accountOperationGate.advanceOpenGeneration(nextGeneration);
    sessionGenerationRef.current = nextGeneration;
    setSessionGeneration(nextGeneration);
    setPhase('authenticated');
    return { user: signedInUser, wasReturning: existing !== null };
  }, [phase]);

  const signInAsDevUser = useCallback(async () => {
    if (phase !== 'signedOut') throw new SessionUnavailableError();
    if (!__DEV__) {
      throw new Error('Dev sign-in is only available in development builds');
    }
    const signedInUser = await upsertUser({
      id: 'dev-simulator-user',
      provider: 'apple',
      displayName: 'Dev User',
      email: 'dev@localhost',
    });
    setUser(signedInUser);
    setFailure(null);
    setSignOutCompletion(null);
    const nextGeneration = sessionGenerationRef.current + 1;
    accountOperationGate.advanceOpenGeneration(nextGeneration);
    sessionGenerationRef.current = nextGeneration;
    setSessionGeneration(nextGeneration);
    setPhase('authenticated');
    return signedInUser;
  }, [phase]);

  const beginSignOut = useCallback(async () => {
    if (phase !== 'authenticated') throw new SessionUnavailableError();
    let quarantined = false;
    try {
      const result = await accountPurgeCoordinator.begin(async () => {
        quarantined = true;
        await enterQuarantineAndDrain();
      });
      applyPurgeResult(result);
    } catch (error) {
      if (!quarantined) throw error;
      setFailure({ failures: [], canFinishOnDevice: false });
      setPhase('cleanupFailed');
    }
  }, [applyPurgeResult, enterQuarantineAndDrain, phase]);

  const retryCleanup = useCallback(async () => {
    if (phase !== 'cleanupFailed') throw new SessionUnavailableError();
    setFailure(null);
    setPhase('signingOut');
    try {
      await drainCurrentOperations();
      applyPurgeResult(await accountPurgeCoordinator.recover());
    } catch (error) {
      setFailure({ failures: [], canFinishOnDevice: false });
      setPhase('cleanupFailed');
      throw error;
    }
  }, [applyPurgeResult, drainCurrentOperations, phase]);

  const finishOnDevice = useCallback(async () => {
    if (phase !== 'cleanupFailed' || !failure?.canFinishOnDevice) {
      throw new SessionUnavailableError();
    }
    setFailure(null);
    setPhase('signingOut');
    try {
      applyPurgeResult(await accountPurgeCoordinator.finishOnDevice());
    } catch (error) {
      setFailure({ failures: [], canFinishOnDevice: false });
      setPhase('cleanupFailed');
      throw error;
    }
  }, [applyPurgeResult, failure, phase]);

  const retrySessionHydration = useCallback(async () => {
    if (phase !== 'sessionError') throw new SessionUnavailableError();
    try {
      await hydrateSession(true);
    } catch (error) {
      setUser(null);
      setSessionError(
        error instanceof Error ? error : new SessionUnavailableError(),
      );
      setPhase('sessionError');
    }
  }, [hydrateSession, phase]);

  const updateProfile = useCallback(
    async (patch: UserProfilePatch) => {
      if (phase !== 'authenticated' || !user) return null;
      const updated = await accountOperationGate.runCurrent(async (signal) => {
        const persisted = await updateStoredUserProfile(user.id, patch);
        assertAccountOperationOpen(signal);
        return persisted;
      });
      setUser(updated);
      return updated;
    },
    [phase, user],
  );

  const value = useMemo<SessionContextValue>(
    () => ({
      phase,
      user,
      failure,
      sessionError,
      signOutCompletion,
      sessionGeneration,
      signInWithApple,
      signInAsDevUser,
      beginSignOut,
      retryCleanup,
      finishOnDevice,
      retrySessionHydration,
      updateProfile,
    }),
    [
      beginSignOut,
      failure,
      finishOnDevice,
      phase,
      retryCleanup,
      retrySessionHydration,
      sessionGeneration,
      sessionError,
      signOutCompletion,
      signInAsDevUser,
      signInWithApple,
      updateProfile,
      user,
    ],
  );

  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  );
}
