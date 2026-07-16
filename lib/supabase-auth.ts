// Supabase Auth compatibility surface. Credential ownership lives in
// cloud-session so existing callers can keep using these functions before the
// root SessionProvider is activated.

import {
  CloudSessionError,
  ensureCloudSession,
  getCloudSession,
  supabaseCloudSessionOwner,
} from './cloud-session';
import type { SupabaseSession } from './cloud-session';

function anonKey(): string {
  return process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;
}

export async function getSession(): Promise<SupabaseSession | null> {
  try {
    return await getCloudSession();
  } catch (error) {
    if (
      error instanceof CloudSessionError &&
      error.operation === 'refresh'
    ) {
      return null;
    }
    throw error;
  }
}

export async function signInAnonymously(): Promise<SupabaseSession | null> {
  try {
    return await ensureCloudSession();
  } catch (error) {
    if (
      error instanceof CloudSessionError &&
      error.operation === 'local'
    ) {
      throw error;
    }
    console.warn('[supabase-auth] anonymous signup failed');
    return null;
  }
}

export async function signOut(): Promise<void> {
  await supabaseCloudSessionOwner.clearLocalSession();
}

export async function getAuthHeaders(): Promise<Record<string, string>> {
  const session = await getSession();
  if (!session) {
    return {
      apikey: anonKey(),
      'Content-Type': 'application/json',
    };
  }
  return {
    apikey: anonKey(),
    Authorization: `Bearer ${session.access_token}`,
    'Content-Type': 'application/json',
  };
}

export async function getAuthUserId(): Promise<string | null> {
  const session = await getSession();
  return session?.user.id ?? null;
}
