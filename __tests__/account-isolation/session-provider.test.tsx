import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { Session } from '@supabase/supabase-js';
import type { PropsWithChildren } from 'react';

import {
  deferred,
  resetTestHarness,
} from './test-harness';
import {
  SessionProvider,
  SessionUnavailableError,
  useSession,
} from '../../lib/account-session/session-provider';
import type { AccountPurgeResult } from '../../lib/account-session/purge-coordinator';
import type { User } from '../../lib/api/user';
import type {
  BackendAuthState,
  BackendSessionValidation,
} from '../../lib/supabase/auth-repository';

jest.mock('expo-apple-authentication', () => ({
  signInAsync: jest.fn(),
  AppleAuthenticationScope: {
    FULL_NAME: 'FULL_NAME',
    EMAIL: 'EMAIL',
  },
}));

jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(),
  digestStringAsync: jest.fn(),
  CryptoDigestAlgorithm: {
    SHA256: 'SHA-256',
  },
}));

jest.mock('../../lib/account-session/purge-marker', () => ({
  readPendingAccountPurge: jest.fn(),
}));

jest.mock('../../lib/account-session/purge-coordinator', () => ({
  accountPurgeCoordinator: {
    begin: jest.fn(),
    recover: jest.fn(),
    finishOnDevice: jest.fn(),
  },
}));

jest.mock('../../lib/account-session/operation-gate', () => {
  const actual = jest.requireActual('../../lib/account-session/operation-gate');
  return {
    ...actual,
    accountOperationGate: {
      seal: jest.fn(),
      drain: jest.fn(),
      open: jest.fn(),
      advanceOpenGeneration: jest.fn(),
      runCurrent: jest.fn(),
    },
  };
});

jest.mock('../../lib/supabase/auth-repository', () => ({
  backendAuthRepository: {
    hydrate: jest.fn(),
    validateCurrentUser: jest.fn(),
    signInWithApple: jest.fn(),
    subscribe: jest.fn(),
    signOutLocal: jest.fn(),
  },
}));

jest.mock('../../lib/supabase/client', () => ({
  startSupabaseAutoRefresh: jest.fn(),
}));

jest.mock('../../lib/api/user', () => ({
  getStoredUser: jest.fn(),
  upsertUser: jest.fn(),
  updateStoredUserProfile: jest.fn(),
}));

const AppleAuthentication = jest.mocked(
  require('expo-apple-authentication'),
);
const Crypto = jest.mocked(require('expo-crypto'));
const { readPendingAccountPurge } = jest.mocked(
  require('../../lib/account-session/purge-marker'),
);
const { accountPurgeCoordinator } = jest.mocked(
  require('../../lib/account-session/purge-coordinator'),
);
const operationGateModule = jest.mocked(
  require('../../lib/account-session/operation-gate'),
);
const { accountOperationGate } = operationGateModule;
const { backendAuthRepository } = jest.mocked(
  require('../../lib/supabase/auth-repository'),
);
const { startSupabaseAutoRefresh } = jest.mocked(
  require('../../lib/supabase/client'),
);
const userApi = jest.mocked(require('../../lib/api/user'));

type AppleAuthResult = NonNullable<
  Awaited<ReturnType<typeof backendAuthRepository.signInWithApple>>
>;

const USER: User = {
  id: 'user-a',
  provider: 'apple',
  displayName: 'Alice Example',
  email: 'alice@example.com',
  initials: 'AE',
  avatarUri: null,
  signedInAt: 123,
};

const APPLE_SUBJECT_USER: User = {
  ...USER,
  id: 'apple-provider-subject',
  avatarUri: 'file:///documents/apple-avatar.png',
};

const CANONICAL_USER: User = {
  ...APPLE_SUBJECT_USER,
  id: 'supabase-user',
  email: 'a@example.com',
  signedInAt: 456,
};

function supabaseSession(
  overrides: {
    id?: string;
    is_anonymous?: boolean;
    email?: string;
    fullName?: string;
    accessToken?: string;
  } = {},
): Session {
  const id = overrides.id ?? 'user-a';
  return {
    access_token: overrides.accessToken ?? 'hydrated-access-token',
    refresh_token: 'synthetic-refresh-token',
    expires_in: 3_600,
    expires_at: 1_800_000_000,
    token_type: 'bearer',
    user: {
      id,
      app_metadata: { provider: 'apple', providers: ['apple'] },
      user_metadata: overrides.fullName
        ? { full_name: overrides.fullName }
        : {},
      aud: 'authenticated',
      email: overrides.email ?? `${id}@example.com`,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
      is_anonymous: overrides.is_anonymous ?? false,
    },
  };
}

function wrapper({ children }: PropsWithChildren) {
  return <SessionProvider>{children}</SessionProvider>;
}

describe('SessionProvider', () => {
  let authListener: ((state: BackendAuthState) => void) | undefined;
  let autoRefreshCleanup: jest.Mock;
  let authUnsubscribe: jest.Mock;
  let gateOpen: boolean;
  let gateControllers: Set<AbortController>;

  beforeEach(() => {
    resetTestHarness();
    jest.clearAllMocks();
    gateOpen = true;
    gateControllers = new Set();
    autoRefreshCleanup = jest.fn();
    authUnsubscribe = jest.fn();
    authListener = undefined;

    readPendingAccountPurge.mockResolvedValue(null);
    userApi.getStoredUser.mockResolvedValue(null);
    userApi.upsertUser.mockResolvedValue(USER);
    userApi.updateStoredUserProfile.mockResolvedValue(USER);
    accountPurgeCoordinator.begin.mockResolvedValue({
      status: 'completed',
      failures: [],
    });
    accountPurgeCoordinator.recover.mockResolvedValue({
      status: 'completed',
      failures: [],
    });
    accountPurgeCoordinator.finishOnDevice.mockResolvedValue({
      status: 'completed-locally',
      failures: [],
    });

    accountOperationGate.seal.mockImplementation(() => {
      gateOpen = false;
      for (const controller of gateControllers) controller.abort();
    });
    accountOperationGate.drain.mockResolvedValue({ kind: 'drained' });
    accountOperationGate.open.mockImplementation(() => {
      gateOpen = true;
    });
    accountOperationGate.advanceOpenGeneration.mockImplementation(() => {
      gateOpen = true;
    });
    accountOperationGate.runCurrent.mockImplementation(async (
      operation: (signal: AbortSignal) => Promise<unknown>,
    ) => {
      if (!gateOpen) {
        throw new operationGateModule.AccountOperationClosedError();
      }
      const controller = new AbortController();
      gateControllers.add(controller);
      try {
        return await operation(controller.signal);
      } finally {
        gateControllers.delete(controller);
      }
    });

    backendAuthRepository.hydrate.mockResolvedValue({ kind: 'unconfigured' });
    backendAuthRepository.validateCurrentUser.mockResolvedValue('valid');
    backendAuthRepository.signInWithApple.mockResolvedValue(null);
    backendAuthRepository.signOutLocal.mockResolvedValue(undefined);
    backendAuthRepository.subscribe.mockImplementation((
      listener: (state: BackendAuthState) => void,
    ) => {
      authListener = listener;
      return authUnsubscribe;
    });
    startSupabaseAutoRefresh.mockReturnValue(autoRefreshCleanup);

    Crypto.randomUUID.mockReturnValue('synthetic-raw-nonce');
    Crypto.digestStringAsync.mockResolvedValue('synthetic-hashed-nonce');
    AppleAuthentication.signInAsync.mockResolvedValue({
      user: 'apple-provider-subject',
      identityToken: 'synthetic-apple-id-token',
      authorizationCode: null,
      email: 'apple@example.com',
      fullName: { givenName: 'Alice', familyName: 'Example' },
      realUserStatus: 1,
      state: null,
    });
  });

  afterEach(() => {
    resetTestHarness();
  });

  test('checks purge recovery before hydrating either identity store', async () => {
    const order: string[] = [];
    const markerRead = deferred<null>();
    readPendingAccountPurge.mockImplementation(() => {
      order.push('marker');
      return markerRead.promise;
    });
    userApi.getStoredUser.mockImplementation(async () => {
      order.push('user');
      return USER;
    });
    backendAuthRepository.hydrate.mockImplementation(async () => {
      order.push('backend');
      return { kind: 'unconfigured' };
    });

    const { result } = await renderHook(() => useSession(), { wrapper });

    expect(result.current.phase).toBe('hydrating');
    await act(async () => {
      markerRead.resolve(null);
      await markerRead.promise;
    });
    await waitFor(() => expect(result.current.phase).toBe('authenticated'));

    expect(order).toEqual(['marker', 'user', 'backend']);
    expect(result.current.user).toEqual(USER);
  });

  test('quarantines and recovers an interrupted purge before reading a user', async () => {
    const recovery = deferred<AccountPurgeResult>();
    readPendingAccountPurge.mockResolvedValue({
      version: 1,
      startedAt: '2026-07-15T11:00:00.000Z',
      failedIds: [],
    });
    accountPurgeCoordinator.recover.mockReturnValue(recovery.promise);

    const { result } = await renderHook(() => useSession(), { wrapper });

    await waitFor(() => expect(result.current.phase).toBe('signingOut'));
    expect(accountOperationGate.seal).toHaveBeenCalledWith(0);
    expect(accountOperationGate.drain).toHaveBeenCalledWith(0, 2_000);
    expect(userApi.getStoredUser).not.toHaveBeenCalled();
    expect(backendAuthRepository.hydrate).not.toHaveBeenCalled();

    await act(async () => {
      recovery.resolve({ status: 'completed', failures: [] });
      await recovery.promise;
    });
    await waitFor(() => expect(result.current.phase).toBe('signedOut'));
    expect(result.current.signOutCompletion).toBe('confirmed');
    expect(accountOperationGate.open).toHaveBeenCalledWith(1);
  });

  test('fails closed when startup identity storage cannot be read', async () => {
    userApi.getStoredUser.mockRejectedValue(new Error('identity read failed'));

    const { result } = await renderHook(() => useSession(), { wrapper });

    await waitFor(() => expect(result.current.phase).toBe('sessionError'));
    expect(result.current.user).toBeNull();
    expect(result.current.sessionError).toBeInstanceOf(Error);
  });

  test('does not quarantine when the coordinator cannot write its marker', async () => {
    userApi.getStoredUser.mockResolvedValue(USER);
    accountPurgeCoordinator.begin.mockRejectedValue(
      new Error('marker write failed'),
    );
    const { result } = await renderHook(() => useSession(), { wrapper });
    await waitFor(() => expect(result.current.phase).toBe('authenticated'));

    await expect(result.current.beginSignOut()).rejects.toThrow(
      'marker write failed',
    );

    expect(result.current.phase).toBe('authenticated');
    expect(result.current.user).toEqual(USER);
  });

  test('keeps cleanup failures quarantined after the marker is durable', async () => {
    const completion = deferred<AccountPurgeResult>();
    userApi.getStoredUser.mockResolvedValue(USER);
    accountPurgeCoordinator.begin.mockImplementation(
      async (onQuarantined?: () => void | Promise<void>) => {
        await onQuarantined?.();
        return completion.promise;
      },
    );
    const { result } = await renderHook(() => useSession(), { wrapper });
    await waitFor(() => expect(result.current.phase).toBe('authenticated'));

    let signOut!: Promise<void>;
    await act(() => {
      signOut = result.current.beginSignOut();
    });
    await waitFor(() => expect(result.current.phase).toBe('signingOut'));

    await act(async () => {
      completion.resolve({
        status: 'failed',
        failures: [
          {
            id: 'places.saved',
            errorName: 'Error',
            scope: 'local',
            retryable: true,
          },
        ],
      });
      await signOut;
    });

    expect(result.current.phase).toBe('cleanupFailed');
    expect(result.current.user).toBeNull();
    expect(result.current.failure).toEqual({
      failures: [
        {
          id: 'places.saved',
          errorName: 'Error',
          scope: 'local',
          retryable: true,
        },
      ],
      canFinishOnDevice: false,
    });
  });

  test('keeps an anonymous backend session in the signed-out app phase', async () => {
    backendAuthRepository.hydrate.mockResolvedValue({
      kind: 'anonymous',
      session: supabaseSession({ is_anonymous: true }),
    });

    const { result } = await renderHook(() => useSession(), { wrapper });

    await waitFor(() => expect(result.current.phase).toBe('signedOut'));
    expect(result.current.user).toBeNull();
    expect(accountPurgeCoordinator.begin).not.toHaveBeenCalled();
  });

  test('preserves a local profile while a configured backend is signed out', async () => {
    userApi.getStoredUser.mockResolvedValue(USER);
    backendAuthRepository.hydrate.mockResolvedValue({ kind: 'signed-out' });

    const { result } = await renderHook(() => useSession(), { wrapper });

    await waitFor(() => expect(result.current.phase).toBe('signedOut'));
    expect(result.current.user).toBeNull();
    expect(userApi.upsertUser).not.toHaveBeenCalled();
    expect(accountPurgeCoordinator.begin).not.toHaveBeenCalled();
  });

  test('reconstructs a missing local profile from a permanent backend session', async () => {
    const reconstructed = {
      ...USER,
      id: 'supabase-user',
      displayName: 'Supabase Person',
      email: 'supabase@example.com',
      initials: 'SP',
    };
    backendAuthRepository.hydrate.mockResolvedValue({
      kind: 'authenticated',
      session: supabaseSession({
        id: 'supabase-user',
        fullName: 'Supabase Person',
        email: 'supabase@example.com',
      }),
    });
    userApi.upsertUser.mockResolvedValue(reconstructed);

    const { result } = await renderHook(() => useSession(), { wrapper });

    await waitFor(() => expect(result.current.phase).toBe('authenticated'));
    expect(userApi.upsertUser).toHaveBeenCalledWith({
      id: 'supabase-user',
      provider: 'apple',
      displayName: 'Supabase Person',
      email: 'supabase@example.com',
    });
    expect(result.current.user).toEqual(reconstructed);
  });

  test('keeps an offline permanent session after validation is unavailable', async () => {
    userApi.getStoredUser.mockResolvedValue(USER);
    backendAuthRepository.hydrate.mockResolvedValue({
      kind: 'authenticated',
      session: supabaseSession({ accessToken: 'captured-access-token' }),
    });
    backendAuthRepository.validateCurrentUser.mockResolvedValue('unavailable');

    const { result } = await renderHook(() => useSession(), { wrapper });

    await waitFor(() => expect(result.current.phase).toBe('authenticated'));
    await waitFor(() =>
      expect(backendAuthRepository.validateCurrentUser).toHaveBeenCalledWith(
        'captured-access-token',
      ),
    );
    expect(result.current.user).toEqual(USER);
    expect(backendAuthRepository.signOutLocal).not.toHaveBeenCalled();
  });

  test('signs out a permanent session only after confirmed-invalid validation', async () => {
    userApi.getStoredUser.mockResolvedValue(USER);
    backendAuthRepository.hydrate.mockResolvedValue({
      kind: 'authenticated',
      session: supabaseSession(),
    });
    backendAuthRepository.validateCurrentUser.mockResolvedValue('invalid');

    const { result } = await renderHook(() => useSession(), { wrapper });

    await waitFor(() =>
      expect(backendAuthRepository.signOutLocal).toHaveBeenCalledTimes(1),
    );
    await waitFor(() => expect(result.current.phase).toBe('signedOut'));
    expect(result.current.user).toBeNull();
  });

  test('ignores a stale invalid validation result after a newer auth session opens', async () => {
    const validation = deferred<BackendSessionValidation>();
    const newerUser = { ...USER, id: 'user-b', email: 'user-b@example.com' };
    userApi.getStoredUser.mockResolvedValue(USER);
    userApi.upsertUser.mockResolvedValue(newerUser);
    backendAuthRepository.hydrate.mockResolvedValue({
      kind: 'authenticated',
      session: supabaseSession(),
    });
    backendAuthRepository.validateCurrentUser.mockReturnValue(validation.promise);
    const { result } = await renderHook(() => useSession(), { wrapper });
    await waitFor(() => expect(result.current.phase).toBe('authenticated'));

    await act(() => {
      authListener?.({
        kind: 'authenticated',
        session: supabaseSession({ id: 'user-b', email: 'user-b@example.com' }),
      });
    });
    await waitFor(() => expect(result.current.user?.id).toBe('user-b'));

    await act(async () => {
      validation.resolve('invalid');
      await validation.promise;
    });

    expect(result.current.phase).toBe('authenticated');
    expect(result.current.user?.id).toBe('user-b');
    expect(backendAuthRepository.signOutLocal).not.toHaveBeenCalled();
  });

  test('does not authenticate locally until Apple is persisted by Supabase', async () => {
    const exchange = deferred<AppleAuthResult>();
    userApi.getStoredUser
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(APPLE_SUBJECT_USER);
    userApi.upsertUser.mockResolvedValue(CANONICAL_USER);
    backendAuthRepository.signInWithApple.mockReturnValue(exchange.promise);
    const { result } = await renderHook(() => useSession(), { wrapper });
    await waitFor(() => expect(result.current.phase).toBe('signedOut'));

    let pending!: Promise<unknown>;
    await act(() => {
      pending = result.current.signInWithApple();
    });
    await waitFor(() =>
      expect(backendAuthRepository.signInWithApple).toHaveBeenCalledTimes(1),
    );

    expect(result.current.phase).toBe('signedOut');
    expect(userApi.upsertUser).not.toHaveBeenCalled();

    exchange.resolve({
      userId: 'supabase-user',
      email: 'a@example.com',
      linked: true,
    });
    let signInResult;
    await act(async () => {
      signInResult = await pending;
    });

    expect(userApi.upsertUser).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'supabase-user' }),
      { migrateFromId: 'apple-provider-subject' },
    );
    expect(signInResult).toEqual({ user: CANONICAL_USER, wasReturning: true });
    expect(result.current.phase).toBe('authenticated');
  });

  test('keeps Apple sign-in local-only when Supabase is unconfigured', async () => {
    userApi.upsertUser.mockResolvedValue(APPLE_SUBJECT_USER);
    backendAuthRepository.signInWithApple.mockResolvedValue(null);
    const { result } = await renderHook(() => useSession(), { wrapper });
    await waitFor(() => expect(result.current.phase).toBe('signedOut'));

    await act(async () => {
      await result.current.signInWithApple();
    });

    expect(userApi.upsertUser).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'apple-provider-subject' }),
      { migrateFromId: 'apple-provider-subject' },
    );
    expect(result.current.user).toEqual(APPLE_SUBJECT_USER);
    expect(result.current.phase).toBe('authenticated');
  });

  test('passes a hashed nonce to Apple authentication', async () => {
    userApi.upsertUser.mockResolvedValue(APPLE_SUBJECT_USER);
    const { result } = await renderHook(() => useSession(), { wrapper });
    await waitFor(() => expect(result.current.phase).toBe('signedOut'));

    await act(async () => {
      await result.current.signInWithApple();
    });

    expect(Crypto.digestStringAsync).toHaveBeenCalledWith(
      Crypto.CryptoDigestAlgorithm.SHA256,
      'synthetic-raw-nonce',
    );
    expect(AppleAuthentication.signInAsync).toHaveBeenCalledWith({
      nonce: 'synthetic-hashed-nonce',
      requestedScopes: ['FULL_NAME', 'EMAIL'],
    });
  });

  test('passes only the raw nonce and Apple identity fields to Supabase', async () => {
    userApi.upsertUser.mockResolvedValue(CANONICAL_USER);
    backendAuthRepository.signInWithApple.mockResolvedValue({
      userId: 'supabase-user',
      email: 'a@example.com',
      linked: true,
    });
    const { result } = await renderHook(() => useSession(), { wrapper });
    await waitFor(() => expect(result.current.phase).toBe('signedOut'));

    await act(async () => {
      await result.current.signInWithApple();
    });

    expect(backendAuthRepository.signInWithApple).toHaveBeenCalledWith({
      identityToken: 'synthetic-apple-id-token',
      nonce: 'synthetic-raw-nonce',
      displayName: 'Alice Example',
    });
    expect(userApi.upsertUser).not.toHaveBeenCalledWith(
      expect.objectContaining({
        identityToken: expect.anything(),
        nonce: expect.anything(),
      }),
      expect.anything(),
    );
  });

  test('rejects an Apple credential without an identity token', async () => {
    AppleAuthentication.signInAsync.mockResolvedValue({
      user: 'apple-provider-subject',
      identityToken: null,
      authorizationCode: null,
      email: null,
      fullName: null,
      realUserStatus: 1,
      state: null,
    });
    const { result } = await renderHook(() => useSession(), { wrapper });
    await waitFor(() => expect(result.current.phase).toBe('signedOut'));

    await expect(result.current.signInWithApple()).rejects.toEqual(
      new SessionUnavailableError('Apple did not provide an identity token'),
    );

    expect(backendAuthRepository.signInWithApple).not.toHaveBeenCalled();
    expect(userApi.upsertUser).not.toHaveBeenCalled();
    expect(result.current.phase).toBe('signedOut');
  });

  test('leaves the app signed out when Apple authentication is cancelled', async () => {
    const cancellation = Object.assign(new Error('The user canceled'), {
      code: 'ERR_REQUEST_CANCELED',
    });
    AppleAuthentication.signInAsync.mockRejectedValue(cancellation);
    const { result } = await renderHook(() => useSession(), { wrapper });
    await waitFor(() => expect(result.current.phase).toBe('signedOut'));

    await expect(result.current.signInWithApple()).rejects.toBe(cancellation);

    expect(backendAuthRepository.signInWithApple).not.toHaveBeenCalled();
    expect(userApi.upsertUser).not.toHaveBeenCalled();
    expect(result.current.phase).toBe('signedOut');
  });

  test('reflects a backend auth sign-out event', async () => {
    userApi.getStoredUser.mockResolvedValue(USER);
    backendAuthRepository.hydrate.mockResolvedValue({
      kind: 'authenticated',
      session: supabaseSession(),
    });
    const { result } = await renderHook(() => useSession(), { wrapper });
    await waitFor(() => expect(result.current.phase).toBe('authenticated'));

    await act(() => {
      authListener?.({ kind: 'signed-out' });
    });

    await waitFor(() => expect(result.current.phase).toBe('signedOut'));
    expect(result.current.user).toBeNull();
  });

  test('does not let an auth event reopen the app during purge quarantine', async () => {
    const completion = deferred<AccountPurgeResult>();
    userApi.getStoredUser.mockResolvedValue(USER);
    backendAuthRepository.hydrate.mockResolvedValue({
      kind: 'authenticated',
      session: supabaseSession(),
    });
    accountPurgeCoordinator.begin.mockImplementation(
      async (onQuarantined?: () => void | Promise<void>) => {
        await onQuarantined?.();
        return completion.promise;
      },
    );
    const { result } = await renderHook(() => useSession(), { wrapper });
    await waitFor(() => expect(result.current.phase).toBe('authenticated'));

    let signOut!: Promise<void>;
    await act(() => {
      signOut = result.current.beginSignOut();
    });
    await waitFor(() => expect(result.current.phase).toBe('signingOut'));

    await act(() => {
      authListener?.({
        kind: 'authenticated',
        session: supabaseSession({ id: 'user-b' }),
      });
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.phase).toBe('signingOut');
    expect(result.current.user).toBeNull();

    await act(async () => {
      completion.resolve({ status: 'completed', failures: [] });
      await signOut;
    });
    expect(result.current.phase).toBe('signedOut');
  });

  test('keeps the account quarantined when an old write cannot drain', async () => {
    userApi.getStoredUser.mockResolvedValue(USER);
    const purgeStarted = jest.fn();
    accountPurgeCoordinator.begin.mockImplementation(
      async (onQuarantined?: () => void | Promise<void>) => {
        await onQuarantined?.();
        purgeStarted();
        return { status: 'completed', failures: [] };
      },
    );
    const { result } = await renderHook(() => useSession(), { wrapper });
    await waitFor(() => expect(result.current.phase).toBe('authenticated'));
    accountOperationGate.drain.mockResolvedValue({
      kind: 'timed-out',
      pendingCount: 1,
    });

    await act(async () => {
      await result.current.beginSignOut();
    });

    expect(purgeStarted).not.toHaveBeenCalled();
    expect(result.current.user).toBeNull();
    expect(result.current.phase).toBe('cleanupFailed');
  });

  test('starts auth lifecycle services once and cleans them up on unmount', async () => {
    const { result, rerender, unmount } = await renderHook(() => useSession(), {
      wrapper,
    });
    await waitFor(() => expect(result.current.phase).toBe('signedOut'));

    await rerender(undefined);
    expect(startSupabaseAutoRefresh).toHaveBeenCalledTimes(1);
    expect(backendAuthRepository.subscribe).toHaveBeenCalledTimes(1);

    await unmount();
    expect(autoRefreshCleanup).toHaveBeenCalledTimes(1);
    expect(authUnsubscribe).toHaveBeenCalledTimes(1);
  });
});
