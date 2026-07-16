import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';

import {
  deferred,
  resetTestHarness,
} from './test-harness';
import {
  SessionProvider,
  useSession,
} from '../../lib/account-session/session-provider';
import type { AccountPurgeResult } from '../../lib/account-session/purge-coordinator';
import type { User } from '../../lib/api/user';

jest.mock('expo-apple-authentication', () => ({
  signInAsync: jest.fn(),
  AppleAuthenticationScope: {
    FULL_NAME: 'FULL_NAME',
    EMAIL: 'EMAIL',
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

jest.mock('../../lib/account-session/operation-gate', () => ({
  accountOperationGate: {
    seal: jest.fn(),
    drain: jest.fn(),
    open: jest.fn(),
    advanceOpenGeneration: jest.fn(),
    runCurrent: jest.fn((operation) =>
      operation(new AbortController().signal),
    ),
  },
  assertAccountOperationOpen: jest.fn(),
}));

jest.mock('../../lib/cloud-session', () => ({
  supabaseCloudSessionOwner: {
    hydrateLocalSession: jest.fn(),
    ensureSession: jest.fn(),
    revokeCurrentSession: jest.fn(),
    clearLocalSession: jest.fn(),
  },
}));

jest.mock('../../lib/api/user', () => ({
  getStoredUser: jest.fn(),
  upsertUser: jest.fn(),
  updateStoredUserProfile: jest.fn(),
}));

const AppleAuthentication = jest.mocked(
  require('expo-apple-authentication'),
);
const { readPendingAccountPurge } = jest.mocked(
  require('../../lib/account-session/purge-marker'),
);
const { accountPurgeCoordinator } = jest.mocked(
  require('../../lib/account-session/purge-coordinator'),
);
const { supabaseCloudSessionOwner } = jest.mocked(
  require('../../lib/cloud-session'),
);
const { accountOperationGate } = jest.mocked(
  require('../../lib/account-session/operation-gate'),
);
const userApi = jest.mocked(require('../../lib/api/user'));

const USER: User = {
  id: 'user-a',
  provider: 'apple',
  displayName: 'Alice Example',
  email: 'alice@example.com',
  initials: 'AE',
  avatarUri: null,
  signedInAt: 123,
};

function wrapper({ children }: PropsWithChildren) {
  return <SessionProvider>{children}</SessionProvider>;
}

describe('SessionProvider', () => {
  beforeEach(() => {
    resetTestHarness();
    jest.clearAllMocks();
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
    accountOperationGate.drain.mockResolvedValue({ kind: 'drained' });
    supabaseCloudSessionOwner.hydrateLocalSession.mockResolvedValue({
      kind: 'missing',
    });
    supabaseCloudSessionOwner.ensureSession.mockResolvedValue(undefined);
  });

  afterEach(() => {
    resetTestHarness();
  });

  test('checks purge recovery before hydrating an authenticated user', async () => {
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

    const { result } = await renderHook(() => useSession(), { wrapper });

    expect(result.current.phase).toBe('hydrating');
    await act(async () => {
      markerRead.resolve(null);
      await markerRead.promise;
    });
    await waitFor(() => expect(result.current.phase).toBe('authenticated'));

    expect(order).toEqual(['marker', 'user']);
    expect(result.current.user).toEqual(USER);
    await waitFor(() =>
      expect(supabaseCloudSessionOwner.ensureSession).toHaveBeenCalledTimes(1),
    );
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
    expect(supabaseCloudSessionOwner.ensureSession).not.toHaveBeenCalled();

    await act(async () => {
      recovery.resolve({ status: 'completed', failures: [] });
      await recovery.promise;
    });
    await waitFor(() => expect(result.current.phase).toBe('signedOut'));
    expect(result.current.user).toBeNull();
    expect(result.current.signOutCompletion).toBe('confirmed');
    expect(accountOperationGate.open).toHaveBeenCalledWith(1);
  });

  test('fails closed when startup identity storage cannot be read', async () => {
    userApi.getStoredUser.mockRejectedValue(new Error('identity read failed'));

    const { result } = await renderHook(() => useSession(), { wrapper });

    await waitFor(() => expect(result.current.phase).toBe('sessionError'));
    expect(result.current.user).toBeNull();
    expect(result.current.sessionError).toBeInstanceOf(Error);
    expect(supabaseCloudSessionOwner.ensureSession).not.toHaveBeenCalled();
  });

  test('purges an orphaned cloud session before exposing guest sign-in', async () => {
    supabaseCloudSessionOwner.hydrateLocalSession.mockResolvedValue({
      kind: 'found',
    });
    accountPurgeCoordinator.begin.mockImplementation(
      async (onQuarantined?: () => void | Promise<void>) => {
        await onQuarantined?.();
        return { status: 'completed', failures: [] };
      },
    );

    const { result } = await renderHook(() => useSession(), { wrapper });

    await waitFor(() => expect(result.current.phase).toBe('signedOut'));
    expect(accountPurgeCoordinator.begin).toHaveBeenCalledTimes(1);
    expect(result.current.signOutCompletion).toBe('confirmed');
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

  test('closes the authenticated state as soon as quarantine is durable', async () => {
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
    await act(async () => {
      signOut = result.current.beginSignOut();
      await Promise.resolve();
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
    expect(result.current.failure).toEqual({
      failures: [],
      canFinishOnDevice: false,
    });
  });

  test('publishes sign-in to every consumer and returns returning-user state', async () => {
    const existing = { ...USER, signedInAt: 100 };
    userApi.getStoredUser
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(existing);
    AppleAuthentication.signInAsync.mockResolvedValue({
      user: USER.id,
      fullName: { givenName: 'Alice', familyName: 'Example' },
      email: USER.email,
    });

    const { result } = await renderHook(
      () => ({ first: useSession(), second: useSession() }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.first.phase).toBe('signedOut'));

    let signInResult;
    await act(async () => {
      signInResult = await result.current.first.signInWithApple();
    });

    expect(signInResult).toEqual({ user: USER, wasReturning: true });
    expect(result.current.first.user).toEqual(USER);
    expect(result.current.second.user).toEqual(USER);
    expect(result.current.first.phase).toBe('authenticated');
    expect(result.current.first.sessionGeneration).toBe(2);
    expect(accountOperationGate.advanceOpenGeneration).toHaveBeenCalledWith(2);
  });
});
