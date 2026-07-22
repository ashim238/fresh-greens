const mockSecureStoreValues = new Map<string, string>();

jest.mock('expo-secure-store', () => ({
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 'AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY',
  getItemAsync: jest.fn(async (key: string) => mockSecureStoreValues.get(key) ?? null),
  setItemAsync: jest.fn(async (key: string, value: string) => {
    mockSecureStoreValues.set(key, value);
  }),
  deleteItemAsync: jest.fn(async (key: string) => {
    mockSecureStoreValues.delete(key);
  }),
}));

import * as SecureStore from 'expo-secure-store';
import type { AppStateStatus } from 'react-native';

import {
  clearSupabaseLocalSessionIfAccessTokenMatches,
  ensureSupabaseLocalSessionStorageCleared,
  getSupabaseAuthStorageKey,
  supabaseAuthStorage,
} from '../../lib/supabase/auth-storage';
import {
  readSupabaseEnvironment,
  createConfiguredSupabaseClient,
  startSupabaseAutoRefresh,
  validateSupabaseAccessToken,
  type StatelessAuthClientFactory,
} from '../../lib/supabase/client';
import { createSupabaseTransport } from '../../lib/supabase/transport';

type RefreshClient = {
  auth: {
    startAutoRefresh: jest.Mock;
    stopAutoRefresh: jest.Mock;
  };
};

type RefreshAppState = {
  currentState: AppStateStatus;
  addEventListener: jest.Mock;
};

function autoRefreshHarness(initialState: AppStateStatus) {
  const client: RefreshClient = {
    auth: {
      startAutoRefresh: jest.fn(),
      stopAutoRefresh: jest.fn(),
    },
  };
  let listener: ((state: AppStateStatus) => void) | undefined;
  const remove = jest.fn();
  const appState: RefreshAppState = {
    currentState: initialState,
    addEventListener: jest.fn((_event, nextListener) => {
      listener = nextListener;
      return { remove };
    }),
  };
  const cleanup = startSupabaseAutoRefresh(() => client, appState);
  return {
    appState,
    cleanup,
    client,
    emit: (state: AppStateStatus) => listener?.(state),
    remove,
  };
}

describe('Supabase client foundation', () => {
  beforeEach(() => {
    mockSecureStoreValues.clear();
    jest.clearAllMocks();
  });

  test('treats a partial environment as unconfigured', () => {
    expect(readSupabaseEnvironment({
      EXPO_PUBLIC_SUPABASE_URL: 'https://project.supabase.co',
    })).toBeNull();
  });

  test('stores SDK auth state in SecureStore', async () => {
    await supabaseAuthStorage.setItem('sb-session', 'session-json');
    await expect(supabaseAuthStorage.getItem('sb-session')).resolves.toBe(
      'session-json',
    );
    await supabaseAuthStorage.removeItem('sb-session');
    await expect(SecureStore.getItemAsync('sb-session')).resolves.toBeNull();
  });

  test('derives the same explicit auth storage key used by the SDK client', () => {
    expect(getSupabaseAuthStorageKey('https://project.supabase.co')).toBe(
      'sb-project-auth-token',
    );
  });

  test('clears a remaining SDK session and auxiliary auth storage locally', async () => {
    const env = {
      EXPO_PUBLIC_SUPABASE_URL: 'https://project.supabase.co',
    };
    const storageKey = getSupabaseAuthStorageKey(env.EXPO_PUBLIC_SUPABASE_URL);
    mockSecureStoreValues.set(storageKey, JSON.stringify({
      access_token: 'offline-access-token',
      refresh_token: 'offline-refresh-token',
    }));
    mockSecureStoreValues.set(`${storageKey}-code-verifier`, 'verifier');
    mockSecureStoreValues.set(`${storageKey}-user`, 'user');

    await ensureSupabaseLocalSessionStorageCleared(env);

    expect(mockSecureStoreValues.has(storageKey)).toBe(false);
    expect(mockSecureStoreValues.has(`${storageKey}-code-verifier`)).toBe(false);
    expect(mockSecureStoreValues.has(`${storageKey}-user`)).toBe(false);
  });

  test('does not clear a newer SDK session after stale-token validation', async () => {
    const env = {
      EXPO_PUBLIC_SUPABASE_URL: 'https://project.supabase.co',
    };
    const storageKey = getSupabaseAuthStorageKey(env.EXPO_PUBLIC_SUPABASE_URL);
    const newerSession = JSON.stringify({
      access_token: 'newer-access-token',
      refresh_token: 'newer-refresh-token',
    });
    mockSecureStoreValues.set(storageKey, newerSession);

    await expect(clearSupabaseLocalSessionIfAccessTokenMatches(
      'stale-access-token',
      env,
    )).resolves.toBe('changed');
    expect(mockSecureStoreValues.get(storageKey)).toBe(newerSession);
  });

  test('clears the SDK session when the captured token is still current', async () => {
    const env = {
      EXPO_PUBLIC_SUPABASE_URL: 'https://project.supabase.co',
    };
    const storageKey = getSupabaseAuthStorageKey(env.EXPO_PUBLIC_SUPABASE_URL);
    mockSecureStoreValues.set(storageKey, JSON.stringify({
      access_token: 'captured-access-token',
      refresh_token: 'captured-refresh-token',
    }));

    await expect(clearSupabaseLocalSessionIfAccessTokenMatches(
      'captured-access-token',
      env,
    )).resolves.toBe('cleared');
    expect(mockSecureStoreValues.has(storageKey)).toBe(false);
  });

  test('adds device UUID only to data and function requests', async () => {
    const baseFetch = jest.fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>(
      async () => new Response('{}'),
    );
    const transport = createSupabaseTransport(baseFetch, async () => 'device-a');

    await transport('https://project.supabase.co/rest/v1/reports', {});
    await transport('https://project.supabase.co/auth/v1/token', {});

    expect(new Headers(baseFetch.mock.calls[0][1]?.headers).get('x-device-uuid'))
      .toBe('device-a');
    expect(new Headers(baseFetch.mock.calls[1][1]?.headers).has('x-device-uuid'))
      .toBe(false);
  });

  test('does not add device UUID to Auth URLs with a data-path query', async () => {
    const baseFetch = jest.fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>(
      async () => new Response('{}'),
    );
    const transport = createSupabaseTransport(baseFetch, async () => 'device-a');

    await transport(
      'https://project.supabase.co/auth/v1/token?next=/rest/v1/reports',
      {},
    );

    expect(new Headers(baseFetch.mock.calls[0][1]?.headers).has('x-device-uuid'))
      .toBe(false);
  });

  test('preserves Request headers before overlaying init headers', async () => {
    const baseFetch = jest.fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>(
      async () => new Response('{}'),
    );
    const transport = createSupabaseTransport(baseFetch, async () => 'device-a');
    const request = new Request('https://project.supabase.co/rest/v1/reports', {
      headers: { Authorization: 'Bearer request-token' },
    });

    await transport(request, { headers: { 'x-client-info': 'fresh-greens' } });

    const headers = new Headers(baseFetch.mock.calls[0][1]?.headers);
    expect(headers.get('authorization')).toBe('Bearer request-token');
    expect(headers.get('x-client-info')).toBe('fresh-greens');
    expect(headers.get('x-device-uuid')).toBe('device-a');
  });

  test('creates one client from a complete environment', () => {
    const client = createConfiguredSupabaseClient({
      url: 'https://project.supabase.co',
      publishableKey: 'sb_publishable_test',
    });
    expect(client.auth).toBeDefined();
  });

  test('starts token refresh immediately while the app is active', () => {
    const harness = autoRefreshHarness('active');

    expect(harness.client.auth.startAutoRefresh).toHaveBeenCalledTimes(1);
    expect(harness.client.auth.stopAutoRefresh).not.toHaveBeenCalled();
    expect(harness.appState.addEventListener).toHaveBeenCalledWith(
      'change',
      expect.any(Function),
    );
  });

  test('tracks active and background app-state transitions', () => {
    const harness = autoRefreshHarness('background');

    expect(harness.client.auth.stopAutoRefresh).toHaveBeenCalledTimes(1);
    harness.emit('active');
    expect(harness.client.auth.startAutoRefresh).toHaveBeenCalledTimes(1);
    harness.emit('inactive');
    expect(harness.client.auth.stopAutoRefresh).toHaveBeenCalledTimes(2);
  });

  test('removes the app-state listener and stops refresh during cleanup', () => {
    const harness = autoRefreshHarness('active');

    harness.cleanup();

    expect(harness.remove).toHaveBeenCalledTimes(1);
    expect(harness.client.auth.stopAutoRefresh).toHaveBeenCalledTimes(1);
  });

  test('validates an access token with a fresh non-persisting public client', async () => {
    const response = {
      data: { user: null },
      error: null,
    } as never;
    const getUser = jest.fn(async () => response);
    const createVerifier = jest.fn(() => ({
      auth: { getUser },
    })) as unknown as jest.MockedFunction<StatelessAuthClientFactory>;
    const env = {
      url: 'https://project.supabase.co',
      publishableKey: 'sb_publishable_test',
    };

    await expect(validateSupabaseAccessToken(
      'synthetic-access-token',
      env,
      createVerifier,
    )).resolves.toBe(response);
    await validateSupabaseAccessToken(
      'second-synthetic-access-token',
      env,
      createVerifier,
    );

    expect(createVerifier).toHaveBeenCalledTimes(2);
    expect(createVerifier).toHaveBeenNthCalledWith(
      1,
      env.url,
      env.publishableKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
          detectSessionInUrl: false,
        },
      },
    );
    expect(createVerifier.mock.calls[0][2].auth).not.toHaveProperty('storage');
    expect(getUser).toHaveBeenNthCalledWith(1, 'synthetic-access-token');
    expect(getUser).toHaveBeenNthCalledWith(2, 'second-synthetic-access-token');
  });

  test('does not create a stateless verifier when Supabase is unconfigured', async () => {
    const createVerifier = jest.fn() as unknown as jest.MockedFunction<
      StatelessAuthClientFactory
    >;

    await expect(validateSupabaseAccessToken(
      'synthetic-access-token',
      null,
      createVerifier,
    )).resolves.toBeNull();
    expect(createVerifier).not.toHaveBeenCalled();
  });
});
