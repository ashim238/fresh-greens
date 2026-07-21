import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import type { Session } from '@supabase/supabase-js';
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
  type AuthProvider,
  type User,
  type UserProfilePatch,
} from '../api/user';
import {
  backendAuthRepository,
  type BackendAuthState,
} from '../supabase/auth-repository';
import { startSupabaseAutoRefresh } from '../supabase/client';
import {
  accountPurgeCoordinator,
  type AccountPurgeResult,
} from './purge-coordinator';
import { readPendingAccountPurge } from './purge-marker';
import {
  AccountOperationClosedError,
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

function backendDisplayName(session: Session): string | null {
  const fullName = session.user.user_metadata.full_name;
  return typeof fullName === 'string' && fullName.trim()
    ? fullName.trim()
    : null;
}

function backendProvider(session: Session): AuthProvider {
  const provider = session.user.app_metadata.provider;
  return provider === 'google' || provider === 'email' ? provider : 'apple';
}

async function profileForBackendSession(
  session: Session,
  storedUser: User | null,
): Promise<User> {
  if (storedUser?.id === session.user.id) return storedUser;
  return upsertUser({
    id: session.user.id,
    provider: backendProvider(session),
    displayName: backendDisplayName(session),
    email: session.user.email ?? null,
  });
}

function isClosedOperation(error: unknown): boolean {
  return error instanceof AccountOperationClosedError;
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
  const phaseRef = useRef(phase);
  const userRef = useRef(user);
  const mountedRef = useRef(true);
  const quarantinedRef = useRef(true);
  const appleSignInRef = useRef(false);
  const authTransitionRef = useRef(false);
  sessionGenerationRef.current = sessionGeneration;
  phaseRef.current = phase;
  userRef.current = user;

  const publishPhase = useCallback((nextPhase: SessionPhase) => {
    phaseRef.current = nextPhase;
    setPhase(nextPhase);
  }, []);

  const publishUser = useCallback((nextUser: User | null) => {
    userRef.current = nextUser;
    setUser(nextUser);
  }, []);

  const publishGeneration = useCallback((nextGeneration: number) => {
    sessionGenerationRef.current = nextGeneration;
    setSessionGeneration(nextGeneration);
  }, []);

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
    quarantinedRef.current = true;
    publishUser(null);
    setFailure(null);
    setSignOutCompletion(null);
    publishPhase('signingOut');
    await drainCurrentOperations();
  }, [drainCurrentOperations, publishPhase, publishUser]);

  const applyPurgeResult = useCallback((result: AccountPurgeResult) => {
    if (result.status === 'failed') {
      quarantinedRef.current = true;
      setFailure(failureSummary(result.failures));
      publishPhase('cleanupFailed');
      return;
    }
    publishUser(null);
    setFailure(null);
    setSessionError(null);
    setSignOutCompletion(result.status === 'completed-locally'
      ? 'local-only'
      : result.status === 'completed'
        ? 'confirmed'
        : null);
    const nextGeneration = sessionGenerationRef.current + 1;
    accountOperationGate.open(nextGeneration);
    publishGeneration(nextGeneration);
    quarantinedRef.current = false;
    publishPhase('signedOut');
  }, [publishGeneration, publishPhase, publishUser]);

  const openHydratedSession = useCallback((storedUser: User | null) => {
    const nextGeneration = sessionGenerationRef.current + 1;
    accountOperationGate.open(nextGeneration);
    publishGeneration(nextGeneration);
    publishUser(storedUser);
    setFailure(null);
    setSessionError(null);
    setSignOutCompletion(null);
    quarantinedRef.current = false;
    publishPhase(storedUser ? 'authenticated' : 'signedOut');
    return nextGeneration;
  }, [publishGeneration, publishPhase, publishUser]);

  const advanceOpenSession = useCallback((nextUser: User | null) => {
    const nextGeneration = sessionGenerationRef.current + 1;
    accountOperationGate.advanceOpenGeneration(nextGeneration);
    publishGeneration(nextGeneration);
    publishUser(nextUser);
    setFailure(null);
    setSessionError(null);
    setSignOutCompletion(null);
    quarantinedRef.current = false;
    publishPhase(nextUser ? 'authenticated' : 'signedOut');
  }, [publishGeneration, publishPhase, publishUser]);

  const validateHydratedSession = useCallback((
    accessToken: string,
    generation: number,
  ) => {
    void (async () => {
      try {
        const validation = await accountOperationGate.runCurrent(
          async (signal) => {
            const result = await backendAuthRepository.validateCurrentUser(
              accessToken,
            );
            assertAccountOperationOpen(signal);
            if (result === 'invalid') {
              await backendAuthRepository.signOutLocal();
              assertAccountOperationOpen(signal);
            }
            return result;
          },
        );
        if (
          validation !== 'invalid' ||
          generation !== sessionGenerationRef.current ||
          quarantinedRef.current ||
          !mountedRef.current
        ) {
          return;
        }
        advanceOpenSession(null);
      } catch (error) {
        if (
          isClosedOperation(error) ||
          generation !== sessionGenerationRef.current ||
          quarantinedRef.current ||
          !mountedRef.current
        ) {
          return;
        }
        publishUser(null);
        setSessionError(
          error instanceof Error ? error : new SessionUnavailableError(),
        );
        publishPhase('sessionError');
      }
    })();
  }, [advanceOpenSession, publishPhase, publishUser]);

  const hydrateSession = useCallback(async (preserveSessionError = false) => {
    quarantinedRef.current = true;
    publishPhase('hydrating');
    publishUser(null);
    setFailure(null);
    if (!preserveSessionError) setSessionError(null);

    await drainCurrentOperations();
    const pendingPurge = await readPendingAccountPurge();
    if (pendingPurge) {
      publishPhase('signingOut');
      applyPurgeResult(await accountPurgeCoordinator.recover());
      return;
    }

    const storedUser = await getStoredUser();
    const backendState = await backendAuthRepository.hydrate();
    if (backendState.kind === 'unconfigured') {
      openHydratedSession(storedUser);
      return;
    }
    if (backendState.kind !== 'authenticated') {
      openHydratedSession(null);
      return;
    }

    const hydratedUser = await profileForBackendSession(
      backendState.session,
      storedUser,
    );
    const generation = openHydratedSession(hydratedUser);
    validateHydratedSession(backendState.session.access_token, generation);
  }, [
    applyPurgeResult,
    drainCurrentOperations,
    openHydratedSession,
    publishPhase,
    publishUser,
    validateHydratedSession,
  ]);

  const transitionFromAuthEvent = useCallback((state: BackendAuthState) => {
    if (
      state.kind === 'unconfigured' ||
      quarantinedRef.current ||
      authTransitionRef.current ||
      !mountedRef.current
    ) {
      return;
    }
    if (state.kind === 'authenticated' && appleSignInRef.current) return;

    const currentPhase = phaseRef.current;
    const currentUser = userRef.current;
    if (
      state.kind === 'authenticated' &&
      currentPhase === 'authenticated' &&
      currentUser?.id === state.session.user.id
    ) {
      return;
    }
    if (
      state.kind !== 'authenticated' &&
      currentPhase === 'signedOut'
    ) {
      return;
    }

    const generation = sessionGenerationRef.current;
    let transitionGeneration = generation;
    authTransitionRef.current = true;
    publishUser(null);
    publishPhase('hydrating');
    void (async () => {
      try {
        accountOperationGate.seal(generation);
        const drain = await accountOperationGate.drain(
          generation,
          ACCOUNT_OPERATION_DRAIN_TIMEOUT_MS,
        );
        if (drain.kind === 'timed-out') {
          throw new SessionUnavailableError(
            'Account session change is waiting for an unfinished operation',
          );
        }
        if (
          generation !== sessionGenerationRef.current ||
          quarantinedRef.current ||
          !mountedRef.current
        ) {
          return;
        }

        const nextGeneration = generation + 1;
        accountOperationGate.open(nextGeneration);
        transitionGeneration = nextGeneration;
        publishGeneration(nextGeneration);

        let nextUser: User | null = null;
        if (state.kind === 'authenticated') {
          nextUser = await accountOperationGate.runCurrent(async (signal) => {
            const storedUser = await getStoredUser();
            assertAccountOperationOpen(signal);
            const profile = await profileForBackendSession(
              state.session,
              storedUser,
            );
            assertAccountOperationOpen(signal);
            return profile;
          });
        }
        if (
          nextGeneration !== sessionGenerationRef.current ||
          quarantinedRef.current ||
          !mountedRef.current
        ) {
          return;
        }

        publishUser(nextUser);
        setFailure(null);
        setSessionError(null);
        setSignOutCompletion(null);
        publishPhase(nextUser ? 'authenticated' : 'signedOut');
      } catch (error) {
        if (
          isClosedOperation(error) ||
          transitionGeneration !== sessionGenerationRef.current ||
          quarantinedRef.current ||
          !mountedRef.current
        ) {
          return;
        }
        publishUser(null);
        setSessionError(
          error instanceof Error ? error : new SessionUnavailableError(),
        );
        publishPhase('sessionError');
      } finally {
        authTransitionRef.current = false;
      }
    })();
  }, [publishGeneration, publishPhase, publishUser]);

  useEffect(() => {
    mountedRef.current = true;
    const stopAutoRefresh = startSupabaseAutoRefresh();
    const unsubscribe = backendAuthRepository.subscribe(transitionFromAuthEvent);
    return () => {
      mountedRef.current = false;
      unsubscribe();
      stopAutoRefresh();
    };
  }, [transitionFromAuthEvent]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        await hydrateSession();
      } catch (error) {
        if (cancelled) return;
        quarantinedRef.current = true;
        publishUser(null);
        setSessionError(
          error instanceof Error ? error : new SessionUnavailableError(),
        );
        publishPhase('sessionError');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [hydrateSession, publishPhase, publishUser]);

  const signInWithApple = useCallback(async () => {
    if (
      phaseRef.current !== 'signedOut' ||
      quarantinedRef.current ||
      appleSignInRef.current
    ) {
      throw new SessionUnavailableError();
    }

    const generation = sessionGenerationRef.current;
    appleSignInRef.current = true;
    try {
      const result = await accountOperationGate.runCurrent(async (signal) => {
        const existing = await getStoredUser();
        assertAccountOperationOpen(signal);
        const rawNonce = Crypto.randomUUID();
        const hashedNonce = await Crypto.digestStringAsync(
          Crypto.CryptoDigestAlgorithm.SHA256,
          rawNonce,
        );
        assertAccountOperationOpen(signal);
        const credential = await AppleAuthentication.signInAsync({
          nonce: hashedNonce,
          requestedScopes: [
            AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
            AppleAuthentication.AppleAuthenticationScope.EMAIL,
          ],
        });
        assertAccountOperationOpen(signal);
        if (!credential.identityToken) {
          throw new SessionUnavailableError(
            'Apple did not provide an identity token',
          );
        }

        const displayName = appleDisplayName(credential.fullName);
        const cloudIdentity = await backendAuthRepository.signInWithApple({
          identityToken: credential.identityToken,
          nonce: rawNonce,
          displayName,
        });
        assertAccountOperationOpen(signal);
        const signedInUser = await upsertUser(
          {
            id: cloudIdentity?.userId ?? credential.user,
            provider: 'apple',
            displayName,
            email: cloudIdentity?.email ?? credential.email ?? null,
          },
          { migrateFromId: credential.user },
        );
        assertAccountOperationOpen(signal);
        return { signedInUser, wasReturning: existing !== null };
      });

      if (
        generation !== sessionGenerationRef.current ||
        quarantinedRef.current ||
        phaseRef.current !== 'signedOut'
      ) {
        throw new SessionUnavailableError();
      }
      advanceOpenSession(result.signedInUser);
      return {
        user: result.signedInUser,
        wasReturning: result.wasReturning,
      };
    } finally {
      appleSignInRef.current = false;
    }
  }, [advanceOpenSession]);

  const signInAsDevUser = useCallback(async () => {
    if (phaseRef.current !== 'signedOut' || quarantinedRef.current) {
      throw new SessionUnavailableError();
    }
    if (!__DEV__) {
      throw new Error('Dev sign-in is only available in development builds');
    }
    const signedInUser = await upsertUser({
      id: 'dev-simulator-user',
      provider: 'apple',
      displayName: 'Dev User',
      email: 'dev@localhost',
    });
    advanceOpenSession(signedInUser);
    return signedInUser;
  }, [advanceOpenSession]);

  const beginSignOut = useCallback(async () => {
    if (phaseRef.current !== 'authenticated') {
      throw new SessionUnavailableError();
    }
    let quarantined = false;
    try {
      const result = await accountPurgeCoordinator.begin(async () => {
        quarantined = true;
        await enterQuarantineAndDrain();
      });
      applyPurgeResult(result);
    } catch (error) {
      if (!quarantined) throw error;
      quarantinedRef.current = true;
      setFailure({ failures: [], canFinishOnDevice: false });
      publishPhase('cleanupFailed');
    }
  }, [applyPurgeResult, enterQuarantineAndDrain, publishPhase]);

  const retryCleanup = useCallback(async () => {
    if (phaseRef.current !== 'cleanupFailed') {
      throw new SessionUnavailableError();
    }
    setFailure(null);
    publishPhase('signingOut');
    try {
      await drainCurrentOperations();
      applyPurgeResult(await accountPurgeCoordinator.recover());
    } catch (error) {
      quarantinedRef.current = true;
      setFailure({ failures: [], canFinishOnDevice: false });
      publishPhase('cleanupFailed');
      throw error;
    }
  }, [applyPurgeResult, drainCurrentOperations, publishPhase]);

  const finishOnDevice = useCallback(async () => {
    if (phaseRef.current !== 'cleanupFailed' || !failure?.canFinishOnDevice) {
      throw new SessionUnavailableError();
    }
    setFailure(null);
    publishPhase('signingOut');
    try {
      applyPurgeResult(await accountPurgeCoordinator.finishOnDevice());
    } catch (error) {
      quarantinedRef.current = true;
      setFailure({ failures: [], canFinishOnDevice: false });
      publishPhase('cleanupFailed');
      throw error;
    }
  }, [applyPurgeResult, failure, publishPhase]);

  const retrySessionHydration = useCallback(async () => {
    if (phaseRef.current !== 'sessionError') {
      throw new SessionUnavailableError();
    }
    try {
      await hydrateSession(true);
    } catch (error) {
      quarantinedRef.current = true;
      publishUser(null);
      setSessionError(
        error instanceof Error ? error : new SessionUnavailableError(),
      );
      publishPhase('sessionError');
    }
  }, [hydrateSession, publishPhase, publishUser]);

  const updateProfile = useCallback(async (patch: UserProfilePatch) => {
    const currentUser = userRef.current;
    if (phaseRef.current !== 'authenticated' || !currentUser) return null;
    const updated = await accountOperationGate.runCurrent(async (signal) => {
      const persisted = await updateStoredUserProfile(currentUser.id, patch);
      assertAccountOperationOpen(signal);
      return persisted;
    });
    publishUser(updated);
    return updated;
  }, [publishUser]);

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
