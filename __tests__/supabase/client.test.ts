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

import { supabaseAuthStorage } from '../../lib/supabase/auth-storage';
import {
  readSupabaseEnvironment,
  createConfiguredSupabaseClient,
  validateSupabaseAccessToken,
  type StatelessAuthClientFactory,
} from '../../lib/supabase/client';
import { createSupabaseTransport } from '../../lib/supabase/transport';

describe('Supabase client foundation', () => {
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
