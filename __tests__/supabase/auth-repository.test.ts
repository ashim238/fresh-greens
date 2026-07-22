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
  backendAuthRepository,
  createBackendAuthRepository,
  type AppleIdentityInput,
} from '../../lib/supabase/auth-repository';
import { startSupabaseAutoRefresh } from '../../lib/supabase/client';
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

type AccessTokenValidationResponse =
  | Awaited<ReturnType<AuthClient['getUser']>>
  | null;
type AccessTokenValidator = (
  accessToken: string,
) => Promise<AccessTokenValidationResponse>;

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

const client: {
  auth: AuthMethodMocks & {
    admin: {
      signOut: jest.MockedFunction<AuthClient['admin']['signOut']>;
    };
  };
} = {
  auth: {
    getSession: jest.fn(),
    signInAnonymously: jest.fn(),
    linkIdentity: jest.fn(),
    signInWithIdToken: jest.fn(),
    updateUser: jest.fn(),
    getUser: jest.fn(),
    onAuthStateChange: jest.fn(),
    signOut: jest.fn(),
    admin: {
      signOut: jest.fn(),
    },
  },
};

let repository: ReturnType<typeof createBackendAuthRepository>;
const validateAccessToken = jest.fn<
  ReturnType<AccessTokenValidator>,
  Parameters<AccessTokenValidator>
>();
const localSessionStorage = {
  ensureCleared: jest.fn(),
  clearIfAccessTokenMatches: jest.fn(),
};

const input: AppleIdentityInput = {
  identityToken: 'synthetic-apple-id-token',
  nonce: 'synthetic-raw-nonce',
  displayName: 'Test Person',
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
  validateAccessToken.mockResolvedValue({
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
  client.auth.admin.signOut.mockResolvedValue({ data: null, error: null });
  localSessionStorage.ensureCleared.mockResolvedValue(undefined);
  localSessionStorage.clearIfAccessTokenMatches.mockResolvedValue('cleared');

  repository = createBackendAuthRepository(
    () => asClient(),
    validateAccessToken,
    localSessionStorage,
  );
});

describe('backend auth repository', () => {
  test('returns safe no-service results when Supabase is unconfigured', async () => {
    const unavailableVerifier = jest.fn(async () => null);
    const unconfigured = createBackendAuthRepository(
      () => null,
      unavailableVerifier,
    );
    const listener = jest.fn();
    const unsubscribe = unconfigured.subscribe(listener);

    await expect(unconfigured.hydrate()).resolves.toEqual({ kind: 'unconfigured' });
    await expect(unconfigured.ensureAnonymous()).resolves.toBeNull();
    await expect(unconfigured.signInWithApple(input)).resolves.toBeNull();
    await expect(unconfigured.getUserId()).resolves.toBeNull();
    await expect(unconfigured.validateCurrentUser(
      'synthetic-access-token',
    )).resolves.toBe('unavailable');
    await expect(unconfigured.signOutGlobal()).resolves.toEqual({
      kind: 'terminal',
      reason: 'no-session',
    });
    await expect(unconfigured.signOutLocal()).resolves.toBeUndefined();
    await expect(unconfigured.clearLocalSessionIfCurrent(
      'synthetic-access-token',
    )).resolves.toBe('absent');

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

  test('maps an SDK session to the exact product session contract', async () => {
    const sdkSession = session({ id: 'permanent', is_anonymous: false });
    sdkSession.access_token = 'captured-access-token';
    sdkSession.refresh_token = 'must-not-escape';
    sdkSession.user.email = 'person@example.test';
    sdkSession.user.user_metadata = {
      full_name: '  Alice Example  ',
      raw_profile: 'must-not-escape',
    };
    sdkSession.user.app_metadata = {
      provider: 'apple',
      raw_role: 'must-not-escape',
    };
    sdkSession.user.identities = [{
      id: 'apple-identity',
      user_id: 'permanent',
      identity_id: 'apple-identity-id',
      provider: 'apple',
      identity_data: { sub: 'apple-provider-subject' },
    }];
    client.auth.getSession.mockResolvedValue({
      data: { session: sdkSession },
      error: null,
    });

    const state = await repository.hydrate();

    expect(state).toEqual({
      kind: 'authenticated',
      session: {
        accessToken: 'captured-access-token',
        user: {
          id: 'permanent',
          email: 'person@example.test',
          displayName: 'Alice Example',
          provider: 'apple',
          identities: [{
            provider: 'apple',
            subject: 'apple-provider-subject',
          }],
        },
      },
    });
    expect(state).not.toHaveProperty('session.refresh_token');
    expect(state).not.toHaveProperty('session.user.user_metadata');
    expect(state).not.toHaveProperty('session.user.app_metadata');
  });

  test('exposes the real auto-refresh lifecycle through production wiring', () => {
    expect(backendAuthRepository.startAutoRefresh).toBe(
      startSupabaseAutoRefresh,
    );
  });

  test('hydrates a missing session as signed out', async () => {
    client.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });

    await expect(repository.hydrate()).resolves.toEqual({ kind: 'signed-out' });
  });

  test('redacts a rejected session lookup while hydrating', async () => {
    client.auth.getSession.mockRejectedValue(
      new Error('raw session payload synthetic-access-token'),
    );

    await expect(repository.hydrate()).rejects.toMatchObject({
      name: 'BackendAuthError',
      message: 'Unable to restore the online session',
    });
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

  test('reuses an existing authenticated session', async () => {
    const authenticatedSession = session({
      id: 'permanent',
      is_anonymous: false,
    });
    client.auth.getSession.mockResolvedValue({
      data: { session: authenticatedSession },
      error: null,
    });

    await expect(repository.ensureAnonymous()).resolves.toBe(
      authenticatedSession,
    );
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

  test('shares one anonymous sign-in across concurrent signed-out callers', async () => {
    const anonymousSession = session({ id: 'shared-anonymous', is_anonymous: true });
    const signIn = deferred<Awaited<ReturnType<AuthClient['signInAnonymously']>>>();
    client.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });
    client.auth.signInAnonymously.mockReturnValue(signIn.promise);

    const first = repository.ensureAnonymous();
    const second = repository.ensureAnonymous();
    await Promise.resolve();
    await Promise.resolve();

    expect(client.auth.signInAnonymously).toHaveBeenCalledTimes(1);
    signIn.resolve({
      data: { session: anonymousSession, user: anonymousSession.user },
      error: null,
    });

    const [firstSession, secondSession] = await Promise.all([first, second]);
    expect(firstSession).toBe(anonymousSession);
    expect(secondSession).toBe(anonymousSession);

    await expect(repository.ensureAnonymous()).resolves.toBe(anonymousSession);
    expect(client.auth.signInAnonymously).toHaveBeenCalledTimes(2);
  });

  test('shares a failed anonymous sign-in and clears it for retry', async () => {
    const failedSignIn = deferred<Awaited<ReturnType<AuthClient['signInAnonymously']>>>();
    const retrySession = session({ id: 'retry-anonymous', is_anonymous: true });
    client.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });
    client.auth.signInAnonymously
      .mockReturnValueOnce(failedSignIn.promise)
      .mockResolvedValueOnce({
        data: { session: retrySession, user: retrySession.user },
        error: null,
      });

    const first = repository.ensureAnonymous();
    const second = repository.ensureAnonymous();
    await Promise.resolve();
    await Promise.resolve();
    failedSignIn.reject(new Error('synthetic network failure'));

    await expect(Promise.all([first, second])).rejects.toEqual(
      new BackendAuthError('Unable to start an online session'),
    );
    expect(client.auth.signInAnonymously).toHaveBeenCalledTimes(1);

    await expect(repository.ensureAnonymous()).resolves.toBe(retrySession);
    expect(client.auth.signInAnonymously).toHaveBeenCalledTimes(2);
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

  test('redacts a rejected anonymous sign-in request', async () => {
    client.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });
    client.auth.signInAnonymously.mockRejectedValue(
      new Error('raw anonymous payload synthetic-access-token'),
    );

    const error = await repository.ensureAnonymous().catch((cause) => cause);

    expect(error).toBeInstanceOf(BackendAuthError);
    expect(error.message).toBe('Unable to start an online session');
    expect(error.message).not.toContain('synthetic-access-token');
    expect(error.message).not.toContain('raw anonymous payload');
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
      displayName: 'Test Person',
    })).resolves.toMatchObject({ userId: 'permanent', linked: true });
    expect(client.auth.linkIdentity).toHaveBeenCalledWith({
      provider: 'apple',
      token: 'apple-id-token',
      nonce: 'raw-nonce',
    });
    expect(client.auth.updateUser).toHaveBeenCalledWith({
      data: { full_name: 'Test Person' },
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

  test('redacts a rejected Apple identity link request', async () => {
    client.auth.linkIdentity.mockRejectedValue(
      new Error(
        `raw link payload ${input.identityToken} nonce ${input.nonce}`,
      ),
    );

    const error = await repository.signInWithApple(input).catch(
      (cause) => cause,
    );

    expect(error).toBeInstanceOf(BackendAuthError);
    expect(error.message).toBe('Apple sign-in could not be completed');
    expect(error.message).not.toContain(input.identityToken);
    expect(error.message).not.toContain(input.nonce);
    expect(error.message).not.toContain('raw link payload');
  });

  test('redacts a rejected Apple conflict fallback request', async () => {
    client.auth.linkIdentity.mockResolvedValue({
      data: { session: null, user: null },
      error: new AuthApiError('identity conflict', 422, 'identity_already_exists'),
    });
    client.auth.signInWithIdToken.mockRejectedValue(
      new Error(
        `raw fallback payload ${input.identityToken} nonce ${input.nonce}`,
      ),
    );

    const error = await repository.signInWithApple(input).catch(
      (cause) => cause,
    );

    expect(error).toBeInstanceOf(BackendAuthError);
    expect(error.message).toBe('Apple sign-in could not be completed');
    expect(error.message).not.toContain(input.identityToken);
    expect(error.message).not.toContain(input.nonce);
    expect(error.message).not.toContain('raw fallback payload');
  });

  test('does not update metadata when Apple provides no display name', async () => {
    await expect(repository.signInWithApple({
      ...input,
      displayName: null,
    })).resolves.toMatchObject({ userId: 'permanent' });

    expect(client.auth.updateUser).not.toHaveBeenCalled();
  });

  test('redacts a rejected Apple profile update request', async () => {
    client.auth.updateUser.mockRejectedValue(
      new Error(`raw profile payload ${input.identityToken}`),
    );

    const error = await repository.signInWithApple(input).catch(
      (cause) => cause,
    );

    expect(error).toBeInstanceOf(BackendAuthError);
    expect(error.message).toBe('Apple profile could not be saved');
    expect(error.message).not.toContain(input.identityToken);
    expect(error.message).not.toContain('raw profile payload');
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

  test('redacts a rejected user ID lookup', async () => {
    client.auth.getUser.mockRejectedValue(
      new Error('raw user payload synthetic-access-token'),
    );

    const error = await repository.getUserId().catch((cause) => cause);

    expect(error).toBeInstanceOf(BackendAuthError);
    expect(error.message).toBe('Unable to verify the online user');
    expect(error.message).not.toContain('synthetic-access-token');
    expect(error.message).not.toContain('raw user payload');
  });

  test('validates a captured access token without using persistent auth state', async () => {
    const capturedAccessToken = session().access_token;
    validateAccessToken.mockResolvedValue({
      data: { user: user('validated-user') },
      error: null,
    });

    await expect(repository.validateCurrentUser(
      capturedAccessToken,
    )).resolves.toBe('valid');
    expect(validateAccessToken).toHaveBeenCalledWith(capturedAccessToken);
    expect(client.auth.getUser).not.toHaveBeenCalled();
    expect(client.auth.getSession).not.toHaveBeenCalled();
    expect(client.auth.signOut).not.toHaveBeenCalled();
  });

  test.each([401, 403])(
    'treats a confirmed Auth API HTTP %i as an invalid session',
    async (status) => {
      validateAccessToken.mockResolvedValue({
        data: { user: null },
        error: new AuthApiError('invalid auth', status, 'bad_jwt'),
      });

      await expect(repository.validateCurrentUser(
        'synthetic-access-token',
      )).resolves.toBe('invalid');
      expect(client.auth.getUser).not.toHaveBeenCalled();
      expect(client.auth.signOut).not.toHaveBeenCalled();
    },
  );

  test('returns terminal no-session for global sign-out HTTP 404', async () => {
    client.auth.admin.signOut.mockResolvedValue({
      data: null,
      error: new AuthApiError('already absent', 404, 'not_found'),
    });

    await expect(repository.signOutGlobal()).resolves.toEqual({
      kind: 'terminal',
      reason: 'no-session',
    });
    expect(client.auth.signOut).not.toHaveBeenCalled();
  });

  test('treats a successful response with no user as invalid', async () => {
    validateAccessToken.mockResolvedValue(missingUserResponse());

    await expect(repository.validateCurrentUser(
      'synthetic-access-token',
    )).resolves.toBe('invalid');
    expect(client.auth.getUser).not.toHaveBeenCalled();
    expect(client.auth.signOut).not.toHaveBeenCalled();
  });

  test('treats a retryable fetch failure as unavailable without clearing storage', async () => {
    validateAccessToken.mockResolvedValue({
      data: { user: null },
      error: new AuthRetryableFetchError('offline', 0),
    });

    await expect(repository.validateCurrentUser(
      'synthetic-access-token',
    )).resolves.toBe('unavailable');
    expect(client.auth.getUser).not.toHaveBeenCalled();
    expect(client.auth.signOut).not.toHaveBeenCalled();
  });

  test('treats a retryable status-401 fetch failure as unavailable', async () => {
    validateAccessToken.mockResolvedValue({
      data: { user: null },
      error: new AuthRetryableFetchError('offline', 401),
    });

    await expect(repository.validateCurrentUser(
      'synthetic-access-token',
    )).resolves.toBe('unavailable');
    expect(client.auth.getUser).not.toHaveBeenCalled();
    expect(client.auth.signOut).not.toHaveBeenCalled();
  });

  test('does not treat a non-API status-401 error as invalid', async () => {
    validateAccessToken.mockResolvedValue({
      data: { user: null },
      error: new AuthError('unconfirmed auth', 401, 'unknown'),
    });

    await expect(repository.validateCurrentUser(
      'synthetic-access-token',
    )).resolves.toBe('unavailable');
    expect(client.auth.getUser).not.toHaveBeenCalled();
    expect(client.auth.signOut).not.toHaveBeenCalled();
  });

  test('treats an Auth server failure as unavailable without clearing storage', async () => {
    validateAccessToken.mockResolvedValue({
      data: { user: null },
      error: new AuthApiError('server detail', 503, 'server_error'),
    });

    await expect(repository.validateCurrentUser(
      'synthetic-access-token',
    )).resolves.toBe('unavailable');
    expect(client.auth.getUser).not.toHaveBeenCalled();
    expect(client.auth.signOut).not.toHaveBeenCalled();
  });

  test('redacts a rejected stateless validation request', async () => {
    validateAccessToken.mockRejectedValue(
      new AuthRetryableFetchError(
        'raw validation payload synthetic-access-token',
        401,
      ),
    );

    await expect(repository.validateCurrentUser(
      'synthetic-access-token',
    )).resolves.toBe('unavailable');
    expect(client.auth.getUser).not.toHaveBeenCalled();
    expect(client.auth.getSession).not.toHaveBeenCalled();
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
    const currentSession = session({ is_anonymous: true });
    client.auth.getSession.mockResolvedValue({
      data: { session: currentSession },
      error: null,
    });
    client.auth.admin.signOut.mockResolvedValue({ data: null, error: null });

    await expect(repository.signOutGlobal()).resolves.toEqual({
      kind: 'terminal',
      reason: 'signed-out',
    });
    expect(client.auth.admin.signOut).toHaveBeenCalledWith(
      currentSession.access_token,
      'global',
    );
    expect(client.auth.signOut).not.toHaveBeenCalled();
  });

  test('returns terminal no-session when global sign-out has no access token', async () => {
    client.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });

    await expect(repository.signOutGlobal()).resolves.toEqual({
      kind: 'terminal',
      reason: 'no-session',
    });
    expect(client.auth.admin.signOut).not.toHaveBeenCalled();
    expect(client.auth.signOut).not.toHaveBeenCalled();
  });

  test('returns terminal no-session for a missing-session lookup error', async () => {
    client.auth.getSession.mockResolvedValue({
      data: { session: null },
      error: new AuthSessionMissingError(),
    });

    await expect(repository.signOutGlobal()).resolves.toEqual({
      kind: 'terminal',
      reason: 'no-session',
    });
    expect(client.auth.admin.signOut).not.toHaveBeenCalled();
    expect(client.auth.signOut).not.toHaveBeenCalled();
  });

  test.each([401, 403])(
    'returns terminal auth-invalid for global sign-out HTTP %i',
    async (status) => {
      client.auth.admin.signOut.mockResolvedValue({
        data: null,
        error: new AuthApiError('invalid auth', status, 'bad_jwt'),
      });

      await expect(repository.signOutGlobal()).resolves.toEqual({
        kind: 'terminal',
        reason: 'auth-invalid',
      });
      expect(client.auth.signOut).not.toHaveBeenCalled();
    },
  );

  test('preserves local storage after a retryable global sign-out failure', async () => {
    client.auth.admin.signOut.mockResolvedValue({
      data: null,
      error: new AuthRetryableFetchError('offline', 503),
    });

    await expect(repository.signOutGlobal()).resolves.toEqual({
      kind: 'retryable',
      reason: 'network',
    });
    expect(client.auth.signOut).not.toHaveBeenCalled();
  });

  test('prioritizes a retryable fetch error over its HTTP status', async () => {
    client.auth.admin.signOut.mockResolvedValue({
      data: null,
      error: new AuthRetryableFetchError('offline', 401),
    });

    await expect(repository.signOutGlobal()).resolves.toEqual({
      kind: 'retryable',
      reason: 'network',
    });
  });

  test('returns retryable server for a global sign-out server failure', async () => {
    client.auth.admin.signOut.mockResolvedValue({
      data: null,
      error: new AuthApiError('server detail', 503, 'server_error'),
    });

    await expect(repository.signOutGlobal()).resolves.toEqual({
      kind: 'retryable',
      reason: 'server',
    });
  });

  test('returns required failure for an unexpected global sign-out client error', async () => {
    client.auth.admin.signOut.mockResolvedValue({
      data: null,
      error: new AuthApiError('client detail', 422, 'validation_failed'),
    });

    await expect(repository.signOutGlobal()).resolves.toEqual({
      kind: 'required-failure',
      reason: 'unexpected-client',
    });
  });

  test('does not classify a non-5xx status as a server failure', async () => {
    client.auth.admin.signOut.mockResolvedValue({
      data: null,
      error: new AuthError('unexpected detail', 600, 'unexpected_status'),
    });

    await expect(repository.signOutGlobal()).resolves.toEqual({
      kind: 'required-failure',
      reason: 'unexpected-client',
    });
  });

  test('classifies a rejected session lookup without exposing secrets', async () => {
    client.auth.getSession.mockRejectedValue(
      new AuthRetryableFetchError(
        'raw session payload synthetic-access-token',
        503,
      ),
    );

    await expect(repository.signOutGlobal()).resolves.toEqual({
      kind: 'retryable',
      reason: 'network',
    });
    expect(client.auth.admin.signOut).not.toHaveBeenCalled();
    expect(client.auth.signOut).not.toHaveBeenCalled();
  });

  test('classifies an unknown rejected session lookup as required failure', async () => {
    client.auth.getSession.mockRejectedValue(
      new Error('raw session payload synthetic-access-token'),
    );

    await expect(repository.signOutGlobal()).resolves.toEqual({
      kind: 'required-failure',
      reason: 'unexpected-client',
    });
    expect(client.auth.admin.signOut).not.toHaveBeenCalled();
    expect(client.auth.signOut).not.toHaveBeenCalled();
  });

  test('classifies rejected remote revocation without exposing secrets', async () => {
    client.auth.admin.signOut.mockRejectedValue(
      new AuthRetryableFetchError(
        'raw revocation payload synthetic-access-token',
        503,
      ),
    );

    await expect(repository.signOutGlobal()).resolves.toEqual({
      kind: 'retryable',
      reason: 'network',
    });
    expect(client.auth.signOut).not.toHaveBeenCalled();
  });

  test('classifies unknown rejected remote revocation as required failure', async () => {
    client.auth.admin.signOut.mockRejectedValue(
      new Error('raw revocation payload synthetic-access-token'),
    );

    await expect(repository.signOutGlobal()).resolves.toEqual({
      kind: 'required-failure',
      reason: 'unexpected-client',
    });
    expect(client.auth.signOut).not.toHaveBeenCalled();
  });

  test('signs out only the local session', async () => {
    await expect(repository.signOutLocal()).resolves.toBeUndefined();
    expect(client.auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  test('accepts SDK local sign-out errors once the storage postcondition is met', async () => {
    client.auth.signOut.mockResolvedValue({
      error: new AuthApiError('contains a raw token', 422, 'validation_failed'),
    });

    await expect(repository.signOutLocal()).resolves.toBeUndefined();
    expect(localSessionStorage.ensureCleared).toHaveBeenCalledTimes(1);
    expect(client.auth.admin.signOut).not.toHaveBeenCalled();
  });

  test('accepts a rejected offline local sign-out after repository-owned clearing', async () => {
    client.auth.signOut.mockRejectedValue(
      new Error('raw local payload synthetic-access-token'),
    );

    await expect(repository.signOutLocal()).resolves.toBeUndefined();
    expect(localSessionStorage.ensureCleared).toHaveBeenCalledTimes(1);
    expect(client.auth.admin.signOut).not.toHaveBeenCalled();
  });

  test('redacts local sign-out when both the SDK and storage fallback fail', async () => {
    client.auth.signOut.mockRejectedValue(
      new Error('raw local payload synthetic-access-token'),
    );
    localSessionStorage.ensureCleared.mockRejectedValue(
      new Error('raw storage payload synthetic-refresh-token'),
    );

    await expect(repository.signOutLocal()).rejects.toMatchObject({
      name: 'BackendAuthError',
      message: 'Unable to clear the local online session',
    });
  });

  test('clears an invalid token only when it is still the stored session', async () => {
    localSessionStorage.clearIfAccessTokenMatches.mockResolvedValue('changed');

    await expect(repository.clearLocalSessionIfCurrent(
      'captured-access-token',
    )).resolves.toBe('changed');

    expect(localSessionStorage.clearIfAccessTokenMatches).toHaveBeenCalledWith(
      'captured-access-token',
    );
    expect(client.auth.signOut).not.toHaveBeenCalled();
  });
});
