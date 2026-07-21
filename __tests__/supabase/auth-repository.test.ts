import {
  AuthApiError,
  AuthError,
  AuthRetryableFetchError,
  AuthSessionMissingError,
  type AuthChangeEvent,
  type Session,
  type SupabaseClient,
  type User,
} from '@supabase/supabase-js';

import {
  BackendAuthError,
  createBackendAuthRepository,
  type AppleIdentityInput,
} from '../../lib/supabase/auth-repository';
import type { Database } from '../../lib/supabase/database.types';

type AuthClient = SupabaseClient<Database>['auth'];
type AuthMethodMocks = {
  [Method in
    | 'getSession'
    | 'signInAnonymously'
    | 'linkIdentity'
    | 'signInWithIdToken'
    | 'updateUser'
    | 'getUser'
    | 'onAuthStateChange'
    | 'signOut']: jest.MockedFunction<AuthClient[Method]>;
};

const client: { auth: AuthMethodMocks } = {
  auth: {
    getSession: jest.fn(),
    signInAnonymously: jest.fn(),
    linkIdentity: jest.fn(),
    signInWithIdToken: jest.fn(),
    updateUser: jest.fn(),
    getUser: jest.fn(),
    onAuthStateChange: jest.fn(),
    signOut: jest.fn(),
  },
};

let repository: ReturnType<typeof createBackendAuthRepository>;

const input: AppleIdentityInput = {
  identityToken: 'synthetic-apple-id-token',
  nonce: 'synthetic-raw-nonce',
  displayName: 'Myles Ashitey',
};

function user(id: string): User {
  return {
    id,
    app_metadata: { provider: 'apple', providers: ['apple'] },
    user_metadata: {},
    aud: 'authenticated',
    email: `${id}@example.test`,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    is_anonymous: false,
  };
}

function session(
  overrides: { id?: string; is_anonymous?: boolean } = {},
): Session {
  const id = overrides.id ?? 'anonymous-user';
  return {
    access_token: 'synthetic-access-token',
    refresh_token: 'synthetic-refresh-token',
    expires_in: 3600,
    expires_at: 1_800_000_000,
    token_type: 'bearer',
    user: {
      ...user(id),
      is_anonymous: overrides.is_anonymous ?? false,
    },
  };
}

function asClient(): SupabaseClient<Database> {
  return client as unknown as SupabaseClient<Database>;
}

function missingUserResponse() {
  return {
    data: { user: null },
    error: null,
  } as unknown as Awaited<ReturnType<AuthClient['getUser']>>;
}

beforeEach(() => {
  jest.clearAllMocks();

  const anonymousSession = session({ is_anonymous: true });
  client.auth.getSession.mockResolvedValue({
    data: { session: anonymousSession },
    error: null,
  });
  client.auth.signInAnonymously.mockResolvedValue({
    data: { session: anonymousSession, user: anonymousSession.user },
    error: null,
  });
  client.auth.linkIdentity.mockResolvedValue({
    data: {
      session: session({ id: 'permanent' }),
      user: user('permanent'),
    },
    error: null,
  });
  client.auth.signInWithIdToken.mockResolvedValue({
    data: {
      session: session({ id: 'returning' }),
      user: user('returning'),
    },
    error: null,
  });
  client.auth.updateUser.mockResolvedValue({
    data: { user: user('permanent') },
    error: null,
  });
  client.auth.getUser.mockResolvedValue({
    data: { user: user('permanent') },
    error: null,
  });
  client.auth.onAuthStateChange.mockImplementation((callback) => ({
    data: {
      subscription: {
        id: 'synthetic-subscription',
        callback,
        unsubscribe: jest.fn(),
      },
    },
  }));
  client.auth.signOut.mockResolvedValue({ error: null });

  repository = createBackendAuthRepository(() => asClient());
});

describe('backend auth repository', () => {
  test('returns safe no-service results when Supabase is unconfigured', async () => {
    const unconfigured = createBackendAuthRepository(() => null);
    const listener = jest.fn();
    const unsubscribe = unconfigured.subscribe(listener);

    await expect(unconfigured.hydrate()).resolves.toEqual({ kind: 'unconfigured' });
    await expect(unconfigured.ensureAnonymous()).resolves.toBeNull();
    await expect(unconfigured.signInWithApple(input)).resolves.toBeNull();
    await expect(unconfigured.getUserId()).resolves.toBeNull();
    await expect(unconfigured.validateCurrentUser()).resolves.toBe('unavailable');
    await expect(unconfigured.signOutGlobal()).resolves.toEqual({
      kind: 'terminal',
      reason: 'no-session',
    });
    await expect(unconfigured.signOutLocal()).resolves.toBeUndefined();

    expect(unsubscribe()).toBeUndefined();
    expect(listener).not.toHaveBeenCalled();
  });

  test('hydrates an anonymous session without treating it as permanent', async () => {
    client.auth.getSession.mockResolvedValue({
      data: { session: session({ is_anonymous: true }) },
      error: null,
    });

    await expect(repository.hydrate()).resolves.toMatchObject({ kind: 'anonymous' });
  });

  test('hydrates a permanent session as authenticated', async () => {
    client.auth.getSession.mockResolvedValue({
      data: { session: session({ id: 'permanent', is_anonymous: false }) },
      error: null,
    });

    await expect(repository.hydrate()).resolves.toMatchObject({
      kind: 'authenticated',
    });
  });

  test('hydrates a missing session as signed out', async () => {
    client.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });

    await expect(repository.hydrate()).resolves.toEqual({ kind: 'signed-out' });
  });

  test('reuses an existing anonymous session', async () => {
    const anonymousSession = session({ is_anonymous: true });
    client.auth.getSession.mockResolvedValue({
      data: { session: anonymousSession },
      error: null,
    });

    await expect(repository.ensureAnonymous()).resolves.toBe(anonymousSession);
    expect(client.auth.signInAnonymously).not.toHaveBeenCalled();
  });

  test('starts an anonymous session when signed out', async () => {
    const anonymousSession = session({ id: 'new-anonymous', is_anonymous: true });
    client.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });
    client.auth.signInAnonymously.mockResolvedValue({
      data: { session: anonymousSession, user: anonymousSession.user },
      error: null,
    });

    await expect(repository.ensureAnonymous()).resolves.toBe(anonymousSession);
    expect(client.auth.signInAnonymously).toHaveBeenCalledTimes(1);
  });

  test('rejects a successful anonymous response that has no session', async () => {
    client.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });
    client.auth.signInAnonymously.mockResolvedValue({
      data: { session: null, user: null },
      error: null,
    });

    await expect(repository.ensureAnonymous()).rejects.toEqual(
      new BackendAuthError('Unable to start an online session'),
    );
  });

  test('reports a required client failure while starting an anonymous session', async () => {
    client.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });
    client.auth.signInAnonymously.mockResolvedValue({
      data: { session: null, user: null },
      error: new AuthApiError('synthetic SDK detail', 422, 'validation_failed'),
    });

    await expect(repository.ensureAnonymous()).rejects.toMatchObject({
      name: 'BackendAuthError',
      message: 'Unable to start an online session',
    });
  });

  test('links Apple to the current anonymous user', async () => {
    client.auth.getSession.mockResolvedValue({
      data: { session: session({ is_anonymous: true }) },
      error: null,
    });
    client.auth.linkIdentity.mockResolvedValue({
      data: {
        session: session({ id: 'permanent', is_anonymous: false }),
        user: user('permanent'),
      },
      error: null,
    });

    await expect(repository.signInWithApple({
      identityToken: 'apple-id-token',
      nonce: 'raw-nonce',
      displayName: 'Myles Ashitey',
    })).resolves.toMatchObject({ userId: 'permanent', linked: true });
    expect(client.auth.linkIdentity).toHaveBeenCalledWith({
      provider: 'apple',
      token: 'apple-id-token',
      nonce: 'raw-nonce',
    });
    expect(client.auth.updateUser).toHaveBeenCalledWith({
      data: { full_name: 'Myles Ashitey' },
    });
  });

  test('signs into an existing Apple account only for identity conflict', async () => {
    client.auth.linkIdentity.mockResolvedValue({
      data: { session: null, user: null },
      error: new AuthApiError('redacted', 422, 'identity_already_exists'),
    });
    client.auth.signInWithIdToken.mockResolvedValue({
      data: {
        session: session({ id: 'returning', is_anonymous: false }),
        user: user('returning'),
      },
      error: null,
    });

    await expect(repository.signInWithApple(input)).resolves.toMatchObject({
      userId: 'returning',
      linked: false,
    });
    expect(client.auth.signInWithIdToken).toHaveBeenCalledWith({
      provider: 'apple',
      token: input.identityToken,
      nonce: input.nonce,
    });
  });

  test('does not fall back to sign-in for a network linking error', async () => {
    client.auth.linkIdentity.mockResolvedValue({
      data: { session: null, user: null },
      error: new AuthError('offline', undefined, 'network_error'),
    });

    await expect(repository.signInWithApple(input)).rejects.toMatchObject({
      name: 'BackendAuthError',
    });
    expect(client.auth.signInWithIdToken).not.toHaveBeenCalled();
  });

  test('does not update metadata when Apple provides no display name', async () => {
    await expect(repository.signInWithApple({
      ...input,
      displayName: null,
    })).resolves.toMatchObject({ userId: 'permanent' });

    expect(client.auth.updateUser).not.toHaveBeenCalled();
  });

  test('rejects a successful Apple response that has no session', async () => {
    client.auth.linkIdentity.mockResolvedValue({
      data: { session: null, user: null },
      error: null,
    } as unknown as Awaited<ReturnType<AuthClient['linkIdentity']>>);

    await expect(repository.signInWithApple(input)).rejects.toMatchObject({
      name: 'BackendAuthError',
      message: 'Apple sign-in could not be completed',
    });
  });

  test('redacts SDK details and Apple secrets from product errors', async () => {
    client.auth.linkIdentity.mockResolvedValue({
      data: { session: null, user: null },
      error: new AuthApiError(
        `payload ${input.identityToken} nonce ${input.nonce}`,
        400,
        'provider_error',
      ),
    });

    const error = await repository.signInWithApple(input).catch((cause) => cause);

    expect(error).toBeInstanceOf(BackendAuthError);
    expect(error.message).toBe('Apple sign-in could not be completed');
    expect(error.message).not.toContain(input.identityToken);
    expect(error.message).not.toContain(input.nonce);
    expect(error.message).not.toContain('payload');
  });

  test('returns the validated user ID', async () => {
    client.auth.getUser.mockResolvedValue({
      data: { user: user('validated-user') },
      error: null,
    });

    await expect(repository.getUserId()).resolves.toBe('validated-user');
  });

  test('returns no user ID when the SDK returns no user', async () => {
    client.auth.getUser.mockResolvedValue(missingUserResponse());

    await expect(repository.getUserId()).resolves.toBeNull();
  });

  test('redacts SDK errors while reading the user ID', async () => {
    client.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: new AuthApiError('contains raw auth payload', 500, 'server_error'),
    });

    await expect(repository.getUserId()).rejects.toMatchObject({
      name: 'BackendAuthError',
      message: 'Unable to verify the online user',
    });
  });

  test('validates a user through the Auth server', async () => {
    client.auth.getUser.mockResolvedValue({
      data: { user: user('validated-user') },
      error: null,
    });

    await expect(repository.validateCurrentUser()).resolves.toBe('valid');
    expect(client.auth.getUser).toHaveBeenCalledTimes(1);
  });

  test.each([401, 403])(
    'treats a confirmed HTTP %i as an invalid session',
    async (status) => {
      client.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: new AuthApiError('invalid auth', status, 'bad_jwt'),
      });

      await expect(repository.validateCurrentUser()).resolves.toBe('invalid');
      expect(client.auth.signOut).not.toHaveBeenCalled();
    },
  );

  test('treats a successful response with no user as invalid', async () => {
    client.auth.getUser.mockResolvedValue(missingUserResponse());

    await expect(repository.validateCurrentUser()).resolves.toBe('invalid');
    expect(client.auth.signOut).not.toHaveBeenCalled();
  });

  test('treats a retryable fetch failure as unavailable without clearing storage', async () => {
    client.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: new AuthRetryableFetchError('offline', 0),
    });

    await expect(repository.validateCurrentUser()).resolves.toBe('unavailable');
    expect(client.auth.signOut).not.toHaveBeenCalled();
  });

  test('treats an Auth server failure as unavailable without clearing storage', async () => {
    client.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: new AuthApiError('server detail', 503, 'server_error'),
    });

    await expect(repository.validateCurrentUser()).resolves.toBe('unavailable');
    expect(client.auth.signOut).not.toHaveBeenCalled();
  });

  test('maps auth events and unsubscribes from the SDK listener', () => {
    const listener = jest.fn();
    const sdkUnsubscribe = jest.fn();
    let authListener:
      | ((event: AuthChangeEvent, nextSession: Session | null) => void)
      | undefined;
    client.auth.onAuthStateChange.mockImplementation((callback) => {
      authListener = callback;
      return {
        data: {
          subscription: {
            id: 'synthetic-subscription',
            callback,
            unsubscribe: sdkUnsubscribe,
          },
        },
      };
    });

    const unsubscribe = repository.subscribe(listener);
    authListener?.('SIGNED_OUT', null);
    authListener?.('SIGNED_IN', session({ is_anonymous: true }));
    authListener?.('SIGNED_IN', session({ id: 'permanent' }));
    unsubscribe();

    expect(listener).toHaveBeenNthCalledWith(1, { kind: 'signed-out' });
    expect(listener).toHaveBeenNthCalledWith(2, expect.objectContaining({
      kind: 'anonymous',
    }));
    expect(listener).toHaveBeenNthCalledWith(3, expect.objectContaining({
      kind: 'authenticated',
    }));
    expect(sdkUnsubscribe).toHaveBeenCalledTimes(1);
  });

  test('returns terminal success after global sign-out', async () => {
    client.auth.signOut.mockResolvedValue({ error: null });

    await expect(repository.signOutGlobal()).resolves.toEqual({
      kind: 'terminal',
      reason: 'signed-out',
    });
    expect(client.auth.signOut).toHaveBeenCalledWith({ scope: 'global' });
  });

  test('returns terminal no-session when global sign-out has no session', async () => {
    client.auth.signOut.mockResolvedValue({
      error: new AuthSessionMissingError(),
    });

    await expect(repository.signOutGlobal()).resolves.toEqual({
      kind: 'terminal',
      reason: 'no-session',
    });
  });

  test.each([401, 403])(
    'returns terminal auth-invalid for global sign-out HTTP %i',
    async (status) => {
      client.auth.signOut.mockResolvedValue({
        error: new AuthApiError('invalid auth', status, 'bad_jwt'),
      });

      await expect(repository.signOutGlobal()).resolves.toEqual({
        kind: 'terminal',
        reason: 'auth-invalid',
      });
    },
  );

  test('returns retryable network for a global sign-out fetch failure', async () => {
    client.auth.signOut.mockResolvedValue({
      error: new AuthRetryableFetchError('offline', 503),
    });

    await expect(repository.signOutGlobal()).resolves.toEqual({
      kind: 'retryable',
      reason: 'network',
    });
  });

  test('prioritizes a retryable fetch error over its HTTP status', async () => {
    client.auth.signOut.mockResolvedValue({
      error: new AuthRetryableFetchError('offline', 401),
    });

    await expect(repository.signOutGlobal()).resolves.toEqual({
      kind: 'retryable',
      reason: 'network',
    });
  });

  test('returns retryable server for a global sign-out server failure', async () => {
    client.auth.signOut.mockResolvedValue({
      error: new AuthApiError('server detail', 503, 'server_error'),
    });

    await expect(repository.signOutGlobal()).resolves.toEqual({
      kind: 'retryable',
      reason: 'server',
    });
  });

  test('returns required failure for an unexpected global sign-out client error', async () => {
    client.auth.signOut.mockResolvedValue({
      error: new AuthApiError('client detail', 422, 'validation_failed'),
    });

    await expect(repository.signOutGlobal()).resolves.toEqual({
      kind: 'required-failure',
      reason: 'unexpected-client',
    });
  });

  test('does not classify a non-5xx status as a server failure', async () => {
    client.auth.signOut.mockResolvedValue({
      error: new AuthError('unexpected detail', 600, 'unexpected_status'),
    });

    await expect(repository.signOutGlobal()).resolves.toEqual({
      kind: 'required-failure',
      reason: 'unexpected-client',
    });
  });

  test('signs out only the local session', async () => {
    await expect(repository.signOutLocal()).resolves.toBeUndefined();
    expect(client.auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  test('redacts SDK errors from local sign-out failures', async () => {
    client.auth.signOut.mockResolvedValue({
      error: new AuthApiError('contains a raw token', 422, 'validation_failed'),
    });

    await expect(repository.signOutLocal()).rejects.toMatchObject({
      name: 'BackendAuthError',
      message: 'Unable to clear the local online session',
    });
  });
});
