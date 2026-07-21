import {
  isAuthApiError,
  isAuthError,
  isAuthRetryableFetchError,
  isAuthSessionMissingError,
  type Session,
  type SupabaseClient,
  type UserResponse,
} from '@supabase/supabase-js';

import {
  getSupabaseClient,
  validateSupabaseAccessToken,
} from './client';
import type { Database } from './database.types';

export type BackendAuthState =
  | { kind: 'unconfigured' }
  | { kind: 'signed-out' }
  | { kind: 'anonymous'; session: Session }
  | { kind: 'authenticated'; session: Session };

export type BackendSessionValidation = 'valid' | 'invalid' | 'unavailable';

export type AppleIdentityInput = {
  identityToken: string;
  nonce: string;
  displayName: string | null;
};

export type BackendSignOutResult =
  | { kind: 'terminal'; reason: 'signed-out' | 'no-session' | 'auth-invalid' }
  | { kind: 'retryable'; reason: 'network' | 'server' }
  | { kind: 'required-failure'; reason: 'unexpected-client' };

export class BackendAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BackendAuthError';
  }
}

function stateFromSession(session: Session | null): BackendAuthState {
  if (!session) return { kind: 'signed-out' };
  return session.user.is_anonymous
    ? { kind: 'anonymous', session }
    : { kind: 'authenticated', session };
}

type AccessTokenValidator = (
  accessToken: string,
) => Promise<UserResponse | null>;

function validationFromError(error: unknown): BackendSessionValidation {
  if (isAuthRetryableFetchError(error)) return 'unavailable';
  if (
    isAuthApiError(error)
    && (error.status === 401 || error.status === 403)
  ) {
    return 'invalid';
  }
  return 'unavailable';
}

function globalSignOutResultFromError(
  error: unknown,
): BackendSignOutResult {
  if (isAuthSessionMissingError(error)) {
    return { kind: 'terminal', reason: 'no-session' };
  }
  if (isAuthApiError(error) && error.status === 404) {
    return { kind: 'terminal', reason: 'no-session' };
  }
  if (isAuthRetryableFetchError(error)) {
    return { kind: 'retryable', reason: 'network' };
  }
  if (
    isAuthError(error)
    && (error.status === 401 || error.status === 403)
  ) {
    return { kind: 'terminal', reason: 'auth-invalid' };
  }
  if (
    isAuthError(error)
    && error.status !== undefined
    && error.status >= 500
    && error.status <= 599
  ) {
    return { kind: 'retryable', reason: 'server' };
  }
  return { kind: 'required-failure', reason: 'unexpected-client' };
}

export function createBackendAuthRepository(
  readClient: () => SupabaseClient<Database> | null,
  validateAccessToken: AccessTokenValidator = validateSupabaseAccessToken,
) {
  let anonymousSessionRequest: Promise<Session> | null = null;

  async function hydrate(): Promise<BackendAuthState> {
    const client = readClient();
    if (!client) return { kind: 'unconfigured' };

    let response;
    try {
      response = await client.auth.getSession();
    } catch {
      throw new BackendAuthError('Unable to restore the online session');
    }
    const { data, error } = response;
    if (error) {
      throw new BackendAuthError('Unable to restore the online session');
    }
    return stateFromSession(data.session);
  }

  async function ensureAnonymous(): Promise<Session | null> {
    const client = readClient();
    if (!client) return null;

    const state = await hydrate();
    if (state.kind === 'anonymous' || state.kind === 'authenticated') {
      return state.session;
    }

    if (!anonymousSessionRequest) {
      const request = (async () => {
        let response;
        try {
          response = await client.auth.signInAnonymously();
        } catch {
          throw new BackendAuthError('Unable to start an online session');
        }
        const { data, error } = response;
        if (error || !data.session) {
          throw new BackendAuthError('Unable to start an online session');
        }
        return data.session;
      })();
      anonymousSessionRequest = request.finally(() => {
        anonymousSessionRequest = null;
      });
    }
    return anonymousSessionRequest;
  }

  async function signInWithApple(input: AppleIdentityInput) {
    const client = readClient();
    if (!client) return null;

    const current = await ensureAnonymous();
    if (!current) {
      throw new BackendAuthError('Online authentication is unavailable');
    }

    let response;
    try {
      response = await client.auth.linkIdentity({
        provider: 'apple',
        token: input.identityToken,
        nonce: input.nonce,
      });
    } catch {
      throw new BackendAuthError('Apple sign-in could not be completed');
    }
    let linked = true;

    if (response.error?.code === 'identity_already_exists') {
      linked = false;
      try {
        response = await client.auth.signInWithIdToken({
          provider: 'apple',
          token: input.identityToken,
          nonce: input.nonce,
        });
      } catch {
        throw new BackendAuthError('Apple sign-in could not be completed');
      }
    }

    if (response.error || !response.data.session || !response.data.user) {
      throw new BackendAuthError('Apple sign-in could not be completed');
    }

    if (input.displayName) {
      let updateResponse;
      try {
        updateResponse = await client.auth.updateUser({
          data: { full_name: input.displayName },
        });
      } catch {
        throw new BackendAuthError('Apple profile could not be saved');
      }
      if (updateResponse.error) {
        throw new BackendAuthError('Apple profile could not be saved');
      }
    }

    return {
      userId: response.data.user.id,
      email: response.data.user.email ?? null,
      linked,
    };
  }

  async function getUserId(): Promise<string | null> {
    const client = readClient();
    if (!client) return null;

    let response;
    try {
      response = await client.auth.getUser();
    } catch {
      throw new BackendAuthError('Unable to verify the online user');
    }
    const { data, error } = response;
    if (error) {
      throw new BackendAuthError('Unable to verify the online user');
    }
    return data.user?.id ?? null;
  }

  async function validateCurrentUser(
    accessToken: string,
  ): Promise<BackendSessionValidation> {
    let response;
    try {
      response = await validateAccessToken(accessToken);
    } catch (error) {
      return validationFromError(error);
    }
    if (!response) return 'unavailable';
    if (response.error) return validationFromError(response.error);
    return response.data.user ? 'valid' : 'invalid';
  }

  function subscribe(listener: (state: BackendAuthState) => void): () => void {
    const client = readClient();
    if (!client) return () => undefined;

    const { data } = client.auth.onAuthStateChange((_event, session) => {
      listener(stateFromSession(session));
    });
    return () => data.subscription.unsubscribe();
  }

  async function signOutGlobal(): Promise<BackendSignOutResult> {
    const client = readClient();
    if (!client) return { kind: 'terminal', reason: 'no-session' };

    let sessionResponse;
    try {
      sessionResponse = await client.auth.getSession();
    } catch (error) {
      return globalSignOutResultFromError(error);
    }
    if (sessionResponse.error) {
      return globalSignOutResultFromError(sessionResponse.error);
    }
    const accessToken = sessionResponse.data.session?.access_token;
    if (!accessToken) {
      return { kind: 'terminal', reason: 'no-session' };
    }

    try {
      const { error } = await client.auth.admin.signOut(accessToken, 'global');
      return error
        ? globalSignOutResultFromError(error)
        : { kind: 'terminal', reason: 'signed-out' };
    } catch (error) {
      return globalSignOutResultFromError(error);
    }
  }

  async function signOutLocal(): Promise<void> {
    const client = readClient();
    if (!client) return;

    let response;
    try {
      response = await client.auth.signOut({ scope: 'local' });
    } catch {
      throw new BackendAuthError('Unable to clear the local online session');
    }
    const { error } = response;
    if (error) {
      throw new BackendAuthError('Unable to clear the local online session');
    }
  }

  return {
    hydrate,
    validateCurrentUser,
    ensureAnonymous,
    signInWithApple,
    getUserId,
    subscribe,
    signOutGlobal,
    signOutLocal,
  };
}

export const backendAuthRepository = createBackendAuthRepository(
  getSupabaseClient,
);
