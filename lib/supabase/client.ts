import 'react-native-url-polyfill/auto';

import {
  createClient,
  processLock,
  type SupabaseClient,
  type SupabaseClientOptions,
  type UserResponse,
} from '@supabase/supabase-js';
import { AppState } from 'react-native';

import { getDeviceUUID } from '../device-uuid';
import { supabaseAuthStorage } from './auth-storage';
import type { Database } from './database.types';
import { createSupabaseTransport } from './transport';

export type SupabaseEnvironment = {
  url: string;
  publishableKey: string;
};

type StatelessAuthClient = {
  auth: Pick<SupabaseClient<Database>['auth'], 'getUser'>;
};

export type StatelessAuthClientFactory = (
  url: string,
  publishableKey: string,
  options: SupabaseClientOptions<'public'>,
) => StatelessAuthClient;

const createStatelessAuthClient: StatelessAuthClientFactory = (
  url,
  publishableKey,
  options,
) => createClient<Database>(url, publishableKey, options);

export function readSupabaseEnvironment(
  env: Record<string, string | undefined> = process.env,
): SupabaseEnvironment | null {
  const url = env.EXPO_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey = env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
  return url && publishableKey ? { url, publishableKey } : null;
}

export function createConfiguredSupabaseClient(
  env: SupabaseEnvironment,
): SupabaseClient<Database> {
  return createClient<Database>(env.url, env.publishableKey, {
    auth: {
      storage: supabaseAuthStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      lock: processLock,
    },
    global: {
      fetch: createSupabaseTransport(globalThis.fetch, getDeviceUUID),
    },
  });
}

export async function validateSupabaseAccessToken(
  accessToken: string,
  env: SupabaseEnvironment | null = readSupabaseEnvironment(),
  createVerifier: StatelessAuthClientFactory = createStatelessAuthClient,
): Promise<UserResponse | null> {
  if (!env) return null;

  const verifier = createVerifier(env.url, env.publishableKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
  return verifier.auth.getUser(accessToken);
}

let configuredClient: SupabaseClient<Database> | null | undefined;

export function isSupabaseConfigured(): boolean {
  return readSupabaseEnvironment() !== null;
}

export function getSupabaseClient(): SupabaseClient<Database> | null {
  if (configuredClient !== undefined) return configuredClient;

  const env = readSupabaseEnvironment();
  configuredClient = env ? createConfiguredSupabaseClient(env) : null;
  return configuredClient;
}

export function startSupabaseAutoRefresh(): () => void {
  const client = getSupabaseClient();
  if (!client) return () => undefined;

  const apply = (state: string) => {
    if (state === 'active') client.auth.startAutoRefresh();
    else client.auth.stopAutoRefresh();
  };

  apply(AppState.currentState);
  const subscription = AppState.addEventListener('change', apply);

  return () => {
    subscription.remove();
    client.auth.stopAutoRefresh();
  };
}
