import {
  isAuthRetryableFetchError,
  isAuthSessionMissingError,
  type Session,
  type SupabaseClient,
} from '@supabase/supabase-js';

import { getSupabaseClient } from './client';
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

export function createBackendAuthRepository(
  readClient: () => SupabaseClient<Database> | null,
) {
  async function hydrate(): Promise<BackendAuthState> {
    const client = readClient();
    if (!client) return { kind: 'unconfigured' };

    const { data, error } = await client.auth.getSession();
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

    const { data, error } = await client.auth.signInAnonymously();
    if (error || !data.session) {
      throw new BackendAuthError('Unable to start an online session');
    }
    return data.session;
  }

  async function signInWithApple(input: AppleIdentityInput) {
    const client = readClient();
    if (!client) return null;

    const current = await ensureAnonymous();
    if (!current) {
      throw new BackendAuthError('Online authentication is unavailable');
    }

    let response = await client.auth.linkIdentity({
      provider: 'apple',
      token: input.identityToken,
      nonce: input.nonce,
    });
    let linked = true;

    if (response.error?.code === 'identity_already_exists') {
      linked = false;
      response = await client.auth.signInWithIdToken({
        provider: 'apple',
        token: input.identityToken,
        nonce: input.nonce,
      });
    }

    if (response.error || !response.data.session || !response.data.user) {
      throw new BackendAuthError('Apple sign-in could not be completed');
    }

    if (input.displayName) {
      const { error } = await client.auth.updateUser({
        data: { full_name: input.displayName },
      });
      if (error) {
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

    const { data, error } = await client.auth.getUser();
    if (error) {
      throw new BackendAuthError('Unable to verify the online user');
    }
    return data.user?.id ?? null;
  }

  async function validateCurrentUser(): Promise<BackendSessionValidation> {
    const client = readClient();
    if (!client) return 'unavailable';

    const { data, error } = await client.auth.getUser();
    if (error) {
      return error.status === 401 || error.status === 403
        ? 'invalid'
        : 'unavailable';
    }
    return data.user ? 'valid' : 'invalid';
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

    const { error } = await client.auth.signOut({ scope: 'global' });
    if (!error) return { kind: 'terminal', reason: 'signed-out' };
    if (isAuthSessionMissingError(error)) {
      return { kind: 'terminal', reason: 'no-session' };
    }
    if (isAuthRetryableFetchError(error)) {
      return { kind: 'retryable', reason: 'network' };
    }
    if (error.status === 401 || error.status === 403) {
      return { kind: 'terminal', reason: 'auth-invalid' };
    }
    if (
      error.status !== undefined
      && error.status >= 500
      && error.status <= 599
    ) {
      return { kind: 'retryable', reason: 'server' };
    }
    return { kind: 'required-failure', reason: 'unexpected-client' };
  }

  async function signOutLocal(): Promise<void> {
    const client = readClient();
    if (!client) return;

    const { error } = await client.auth.signOut({ scope: 'local' });
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
