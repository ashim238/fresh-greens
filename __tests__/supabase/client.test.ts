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

  test('creates one client from a complete environment', () => {
    const client = createConfiguredSupabaseClient({
      url: 'https://project.supabase.co',
      publishableKey: 'sb_publishable_test',
    });
    expect(client.auth).toBeDefined();
  });
});
